import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@bartech/database";
import { OrganizationsService } from "@bartech/backend-organizations";
import type { CreateProductContext } from "../product.dto.js";
import type { ArchiveRestoreInput } from "./archive.dto.js";
import { ArchiveReadRepository } from "./archive-read.repository.js";
import { ArchiveMutationRepository } from "./archive-mutation.repository.js";
import { buildRestorePlan, productLinks, resolveRestore } from "./archive-restore-plan.js";

@Injectable()
export class ArchiveMutationService {
  constructor(
    private readonly repository: ArchiveMutationRepository,
    private readonly reads: ArchiveReadRepository,
    private readonly organizations: OrganizationsService,
  ) {}

  async archive(context: CreateProductContext, productId: string) {
    await this.assertPermission(context);
    return this.repository.database.$transaction(async (transaction) => {
      await this.repository.lockVenue(transaction, context.venueId);
      await this.assertPermission(context);
      const graph = await this.reads.graph(transaction, context.venueId);
      const product = graph.local.find((item) => item.id === productId && item.status === "ACTIVE");
      if (!product) throw new NotFoundException("Продукт не найден или недоступен");
      const affectedProducts = graph.local
        .filter(
          (item) =>
            item.status === "ACTIVE" &&
            productLinks(item).some((link) => link.productId === productId),
        )
        .map(({ id, type, name }) => ({ id, type, name }));
      if (affectedProducts.length)
        throw new ConflictException({
          code: "PRODUCT_ARCHIVE_ACTIVE_DEPENDENCIES",
          message: "Сначала измените или архивируйте использующие продукт техкарты",
          affectedProducts,
        });
      const result = await this.repository.setStatus(transaction, context, productId, "ARCHIVED");
      await this.repository.audit(transaction, context, productId, "product.archived");
      return result;
    });
  }

  async ingredientOptions(context: CreateProductContext, query?: string) {
    await this.assertPermission(context);
    return this.reads.ingredientOptions(
      context.venueId,
      query?.trim().replace(/\s+/gu, " ") || undefined,
    );
  }

  async restorePlan(context: CreateProductContext, productId: string) {
    await this.assertPermission(context);
    return this.repository.database.$transaction(async (transaction) => {
      await this.repository.lockVenue(transaction, context.venueId);
      return buildRestorePlan(await this.reads.graph(transaction, context.venueId), productId);
    });
  }

  async restore(context: CreateProductContext, productId: string, input: ArchiveRestoreInput) {
    await this.assertPermission(context);
    try {
      return await this.repository.database.$transaction(async (transaction) => {
        await this.repository.lockVenue(transaction, context.venueId);
        await this.assertPermission(context);
        const graph = await this.reads.graph(transaction, context.venueId);
        const plan = buildRestorePlan(graph, productId);
        if (plan.confirmationFingerprint !== input.confirmationFingerprint)
          throw new ConflictException({
            code: "PRODUCT_ARCHIVE_RESTORE_PLAN_CHANGED",
            message: "Данные изменились. Проверьте обновлённый план и подтвердите ещё раз",
            restorePlan: plan,
          });
        const resolved = resolveRestore(graph, plan, input);
        for (const replacement of resolved.replacements) {
          if (replacement.garnish)
            await this.repository.replaceGarnish(
              transaction,
              context.venueId,
              replacement.rowId,
              replacement.replacementProductId,
            );
          else
            await this.repository.replaceComponent(
              transaction,
              context.venueId,
              replacement.rowId,
              replacement.replacementProductId,
            );
        }
        const restoredProducts = [];
        for (const [id, name] of resolved.restored) {
          restoredProducts.push(
            await this.repository.setStatus(transaction, context, id, "ACTIVE", name),
          );
          await this.repository.audit(transaction, context, id, "product.restored");
        }
        return {
          restoredProducts,
          replacements: resolved.replacements.map(
            ({ parentId, productId, replacementProductId }) => ({
              parentId,
              productId,
              replacementProductId,
            }),
          ),
        };
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ["P2002", "P2003"].includes(error.code)
      )
        throw new ConflictException(
          "Связанные данные или названия изменились. Обновите план восстановления",
        );
      throw error;
    }
  }

  private async assertPermission(context: CreateProductContext) {
    if (context.internalUserId || !context.userId)
      throw new ForbiddenException("Служебный доступ не включает архив");
    const workspace = await this.organizations.findWorkspaceForUser(
      context.userId,
      context.companyId,
      context.venueId,
    );
    if (!workspace) throw new NotFoundException("Рабочее пространство не найдено");
    if (!workspace.permissions.includes("manage_product_archive"))
      throw new ForbiddenException("У вас нет доступа к управлению архивом этого заведения");
  }
}
