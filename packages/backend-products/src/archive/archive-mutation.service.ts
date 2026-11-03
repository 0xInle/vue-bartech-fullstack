import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, type ProductType } from "@bartech/database";
import { OrganizationsService } from "@bartech/backend-organizations";
import type { CreateProductContext } from "../product.dto.js";
import type { ArchiveInput, ArchiveRestoreInput, PermanentDeleteInput } from "./archive.dto.js";
import type { ArchivePlan, PermanentDeletePlan } from "./archive.dto.js";
import { ArchiveReadRepository } from "./archive-read.repository.js";
import { ArchiveMutationRepository } from "./archive-mutation.repository.js";
import { buildRestorePlan, productLinks, resolveRestore } from "./archive-restore-plan.js";
import { buildPermanentDeletePlan } from "./permanent-delete-plan.js";
import { assertAllowedComponent } from "../product-rules.js";

@Injectable()
export class ArchiveMutationService {
  constructor(
    private readonly repository: ArchiveMutationRepository,
    private readonly reads: ArchiveReadRepository,
    private readonly organizations: OrganizationsService,
  ) {}

  async archivePlan(context: CreateProductContext, productId: string): Promise<ArchivePlan> {
    await this.assertPermission(context);
    return this.repository.database.$transaction(async (transaction) => {
      await this.repository.lockVenue(transaction, context.venueId);
      const graph = await this.reads.graph(transaction, context.venueId);
      const plan = buildPermanentDeletePlan(
        graph,
        productId,
        await this.repository.globalIngredientReplacements(transaction),
      );
      if (plan.root.status !== "ACTIVE" || plan.root.type === "INGREDIENT")
        throw new NotFoundException("Продукт не найден или недоступен");
      return this.toArchivePlan(plan);
    });
  }

  async archive(context: CreateProductContext, productId: string, input: ArchiveInput) {
    await this.assertPermission(context);
    return this.repository.database.$transaction(async (transaction) => {
      await this.repository.lockVenue(transaction, context.venueId);
      await this.assertPermission(context);
      const graph = await this.reads.graph(transaction, context.venueId);
      const product = graph.local.find((item) => item.id === productId && item.status === "ACTIVE");
      if (!product) throw new NotFoundException("Продукт не найден или недоступен");
      if (product.type === "INGREDIENT")
        throw new BadRequestException("Локальные ингредиенты нельзя архивировать");
      const plan = buildPermanentDeletePlan(
        graph,
        productId,
        await this.repository.globalIngredientReplacements(transaction),
      );
      if (input.confirmationFingerprint !== plan.confirmationFingerprint)
        throw new ConflictException({
          code: "PRODUCT_ARCHIVE_PLAN_CHANGED",
          message:
            "Связи продукции изменились. Проверьте обновлённый план и подтвердите действие ещё раз",
          plan: this.toArchivePlan(plan),
        });
      if (input.action !== "ARCHIVE_CHAIN" && input.confirmationName)
        throw new BadRequestException("Для этого сценария ввод названия не требуется");
      if (input.action === "REPLACE") {
        const replacementId = input.replacementProductId;
        if (!replacementId || !plan.activeUsages.length)
          throw new BadRequestException("Выберите замену для активных использований");
        const commonCandidates = plan.activeUsages[0]!.replacements.filter((candidate) =>
          plan.activeUsages.every((usage) =>
            usage.replacements.some((replacement) => replacement.id === candidate.id),
          ),
        );
        if (!commonCandidates.some((candidate) => candidate.id === replacementId))
          throw new BadRequestException("Выберите замену, подходящую для всех использований");
        const candidate = await this.repository.replacementProduct(
          transaction,
          context.venueId,
          replacementId,
        );
        if (!candidate) throw new ConflictException("Выбранная замена больше недоступна");
        const replacementRows = new Map(plan.activeUsages.map(({ id }) => [id, candidate.id]));
        const finalLinks = new Map<string, string[]>();
        for (const parent of graph.local.filter(
          (item) => item.id !== productId && item.status === "ACTIVE",
        ))
          finalLinks.set(
            parent.id,
            productLinks(parent).map((link) => replacementRows.get(link.rowId) ?? link.productId),
          );
        const visited = new Set<string>();
        const visiting = new Set<string>();
        const visit = (id: string) => {
          if (visiting.has(id))
            throw new ConflictException("Выбранная замена создаёт цикл зависимостей");
          if (visited.has(id)) return;
          visiting.add(id);
          for (const childId of finalLinks.get(id) ?? []) visit(childId);
          visiting.delete(id);
          visited.add(id);
        };
        for (const id of finalLinks.keys()) visit(id);
        const result = [];
        const changedParents = new Map<string, { type: string; name: string }>();
        for (const usage of plan.activeUsages) {
          const parent = graph.local.find((item) => item.id === usage.parentId);
          if (!parent || parent.status !== "ACTIVE")
            throw new ConflictException("Использующая карточка изменилась. Обновите план");
          if (usage.relation === "GARNISH")
            await this.repository.replaceGarnish(
              transaction,
              context.venueId,
              usage.id,
              candidate.id,
            );
          else
            await this.repository.replaceComponent(
              transaction,
              context.venueId,
              usage.id,
              candidate.id,
              candidate.venueId,
            );
          changedParents.set(parent.id, { type: parent.type, name: parent.name });
          result.push({ parentId: parent.id, productId, replacementProductId: candidate.id });
        }
        for (const [parentId, parent] of changedParents) {
          await this.repository.touchParentProduct(
            transaction,
            context.venueId,
            parentId,
            context.userId,
          );
          await this.repository.audit(transaction, context, parentId, "product.updated", {
            productType: parent.type,
            name: parent.name,
          });
        }
        await this.repository.setStatus(transaction, context, productId, "ARCHIVED");
        await this.repository.audit(transaction, context, productId, "product.archived");
        return { archivedProducts: [plan.root], replacements: result };
      }
      if (input.replacementProductId)
        throw new BadRequestException("Для архивации замены не передаются");
      if (input.action === "ARCHIVE_CHAIN" && input.confirmationName !== plan.root.name)
        throw new BadRequestException(
          "Введите точное название исходной карточки для подтверждения",
        );
      if (
        input.action === "ARCHIVE" &&
        plan.deleteChain.some((item) => item.id !== productId && item.status === "ACTIVE")
      )
        throw new ConflictException({
          code: "PRODUCT_ARCHIVE_ACTIVE_DEPENDENCIES",
          message: "Выберите замену или архивирование связанных продуктов",
        });
      if (
        input.action === "ARCHIVE_CHAIN" &&
        !plan.deleteChain.some((item) => item.id !== productId && item.status === "ACTIVE")
      )
        throw new BadRequestException("Связанные активные продукты отсутствуют");
      if (input.action !== "ARCHIVE" && input.action !== "ARCHIVE_CHAIN")
        throw new BadRequestException("Неизвестный сценарий архивации");
      const toArchive =
        input.action === "ARCHIVE_CHAIN"
          ? plan.deleteChain.filter((item) => item.status === "ACTIVE")
          : [plan.root];
      for (const item of toArchive) {
        await this.repository.setStatus(transaction, context, item.id, "ARCHIVED");
        await this.repository.audit(transaction, context, item.id, "product.archived");
      }
      return { archivedProducts: toArchive, replacements: [] };
    });
  }

  async restorePlan(context: CreateProductContext, productId: string) {
    await this.assertPermission(context);
    return this.repository.database.$transaction(async (transaction) => {
      await this.repository.lockVenue(transaction, context.venueId);
      return buildRestorePlan(await this.reads.graph(transaction, context.venueId), productId);
    });
  }

  async permanentDeletePlan(
    context: CreateProductContext,
    productId: string,
  ): Promise<PermanentDeletePlan> {
    await this.assertPermanentDeletePermission(context);
    return this.repository.database.$transaction(async (transaction) => {
      await this.repository.lockVenue(transaction, context.venueId);
      const graph = await this.reads.graph(transaction, context.venueId);
      return buildPermanentDeletePlan(
        graph,
        productId,
        await this.repository.globalIngredientReplacements(transaction),
      );
    });
  }

  async deletePermanently(
    context: CreateProductContext,
    productId: string,
    input: PermanentDeleteInput,
  ) {
    await this.assertPermanentDeletePermission(context);
    try {
      return await this.repository.database.$transaction(async (transaction) => {
        await this.repository.lockVenue(transaction, context.venueId);
        await this.assertPermanentDeletePermission(context);
        const graph = await this.reads.graph(transaction, context.venueId);
        const plan = buildPermanentDeletePlan(
          graph,
          productId,
          await this.repository.globalIngredientReplacements(transaction),
        );
        if (input.confirmationFingerprint !== plan.confirmationFingerprint)
          throw new ConflictException({
            code: "PRODUCT_PERMANENT_DELETE_PLAN_CHANGED",
            message:
              "Данные использования изменились. Обновите план и подтвердите действие ещё раз",
            plan,
          });
        if (plan.root.status === "ARCHIVED") {
          const activeDependants = plan.deleteChain.filter(
            (item) => item.id !== plan.root.id && item.status === "ACTIVE",
          );
          if (activeDependants.length)
            throw new ConflictException({
              code: "PRODUCT_PERMANENT_DELETE_DEPENDENCIES",
              message:
                "Архивную карточку нельзя удалить, пока у неё есть активные зависимые продукты. Сначала архивируйте их отдельно",
              plan,
            });
          if (input.action === "REPLACE")
            throw new BadRequestException("Для архивной карточки замена недоступна");
        }
        if (input.action === "REPLACE") {
          if (plan.archivedUsages.length)
            throw new ConflictException("Архивные карточки нужно восстановить и изменить отдельно");
          if (!plan.activeUsages.length || !input.replacementProductId)
            throw new BadRequestException("Выберите замену для активных использований");
          const replacementId = input.replacementProductId;
          const candidate = await this.repository.replacementProduct(
            transaction,
            context.venueId,
            replacementId,
          );
          if (!candidate) throw new ConflictException("Выбранная замена больше недоступна");
          const replacementCandidates = new Map<
            string,
            { id: string; type: ProductType; venueId: string | null }
          >();
          for (const usage of plan.activeUsages) {
            if (!usage.replacements.some((item) => item.id === replacementId))
              throw new BadRequestException(
                "Единая замена недопустима для одного из использований",
              );
            const parent = graph.local.find((item) => item.id === usage.parentId);
            if (!parent || parent.status !== "ACTIVE")
              throw new ConflictException("Использующая карточка изменилась. Обновите план");
            if (usage.relation === "GARNISH") {
              if (candidate.venueId !== context.venueId || candidate.type !== "GARNISH")
                throw new BadRequestException(
                  "Для гарнира выберите активный гарнир этого заведения",
                );
            } else assertAllowedComponent(parent.type, candidate.type);
            replacementCandidates.set(usage.id, candidate);
          }
          const replacementsByRow = new Map(
            [...replacementCandidates].map(([usageId, candidate]) => [usageId, candidate.id]),
          );
          const finalLinks = new Map<string, string[]>();
          for (const parent of graph.local.filter(
            (item) => item.id !== productId && item.status === "ACTIVE",
          ))
            finalLinks.set(
              parent.id,
              productLinks(parent)
                .filter(
                  (link) => !(link.productId === productId && !replacementsByRow.has(link.rowId)),
                )
                .map((link) => replacementsByRow.get(link.rowId) ?? link.productId),
            );
          const visited = new Set<string>();
          const visiting = new Set<string>();
          const visit = (id: string) => {
            if (visiting.has(id))
              throw new ConflictException("Выбранная замена создаёт цикл зависимостей");
            if (visited.has(id)) return;
            visiting.add(id);
            for (const childId of finalLinks.get(id) ?? []) visit(childId);
            visiting.delete(id);
            visited.add(id);
          };
          for (const id of finalLinks.keys()) visit(id);
          const replacementResults = [];
          const changedParents = new Map<string, { type: string; name: string }>();
          for (const usage of plan.activeUsages) {
            const candidate = replacementCandidates.get(usage.id)!;
            const parent = graph.local.find((item) => item.id === usage.parentId);
            if (!parent)
              throw new ConflictException("Использующая карточка изменилась. Обновите план");
            if (usage.relation === "GARNISH")
              await this.repository.replaceGarnish(
                transaction,
                context.venueId,
                usage.id,
                candidate.id,
              );
            else
              await this.repository.replaceComponent(
                transaction,
                context.venueId,
                usage.id,
                candidate.id,
                candidate.venueId,
              );
            changedParents.set(parent.id, { type: parent.type, name: parent.name });
            replacementResults.push({
              parentId: parent.id,
              productId: productId,
              replacementProductId: candidate.id,
            });
          }
          for (const [parentId, parent] of changedParents) {
            await this.repository.touchParentProduct(
              transaction,
              context.venueId,
              parentId,
              context.userId,
            );
            await this.repository.audit(transaction, context, parentId, "product.updated", {
              productType: parent.type,
              name: parent.name,
            });
          }
          await this.auditPermanentDelete(transaction, context, plan.root);
          const deleted = await this.repository.deletePermanentProduct(
            transaction,
            context.venueId,
            productId,
          );
          return { deletedProducts: [deleted], replacements: replacementResults };
        }

        if (input.action === "DELETE") {
          if (plan.activeUsages.length || plan.archivedUsages.length)
            throw new ConflictException({
              code: "PRODUCT_PERMANENT_DELETE_DEPENDENCIES",
              message: "У продукта есть использования. Выберите замену или удаление цепочки",
              plan,
            });
          if (input.confirmationName || input.replacementProductId)
            throw new BadRequestException(
              "Для удаления без зависимостей ввод названия не требуется",
            );
          await this.auditPermanentDelete(transaction, context, plan.root);
          const deleted = await this.repository.deletePermanentProduct(
            transaction,
            context.venueId,
            productId,
          );
          return { deletedProducts: [deleted], replacements: [] };
        }

        if (input.action !== "DELETE_CHAIN" || plan.deleteChain.length < 2)
          throw new BadRequestException(
            "Удаление цепочки доступно только при наличии зависимых карточек",
          );
        if (input.confirmationName !== plan.root.name)
          throw new BadRequestException(
            "Введите точное название исходной карточки для подтверждения",
          );
        if (input.replacementProductId)
          throw new BadRequestException("Для удаления цепочки замены не передаются");
        const ids = plan.deleteChain.map(({ id }) => id);
        await this.repository.deleteReferencesToProducts(transaction, context.venueId, ids);
        const deletedProducts = [];
        for (const item of [...plan.deleteChain].sort((a, b) => b.id.localeCompare(a.id))) {
          await this.auditPermanentDelete(transaction, context, item);
          deletedProducts.push(
            await this.repository.deletePermanentProduct(transaction, context.venueId, item.id),
          );
        }
        return { deletedProducts, replacements: [] };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003")
        throw new ConflictException({
          code: "PRODUCT_PERMANENT_DELETE_DEPENDENCIES",
          message: "Продукт успели использовать. Обновите список зависимостей перед удалением",
          plan: await this.permanentDeletePlan(context, productId).catch(() => undefined),
        });
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
        throw new ConflictException("Выбранная замена уже есть в карточке. Обновите план");
      throw error;
    }
  }

  private auditPermanentDelete(
    transaction: Prisma.TransactionClient,
    context: CreateProductContext,
    product: { id: string; name: string; type: string; status: string },
  ) {
    return this.repository.audit(transaction, context, product.id, "product.permanently_deleted", {
      name: product.name,
      type: product.type,
      status: product.status,
    });
  }

  private toArchivePlan(plan: PermanentDeletePlan): ArchivePlan {
    const commonReplacementIds = plan.activeUsages.length
      ? plan.activeUsages[0]!.replacements.filter((candidate) =>
          plan.activeUsages.every((usage) =>
            usage.replacements.some((replacement) => replacement.id === candidate.id),
          ),
        ).map(({ id }) => id)
      : [];
    return {
      root: plan.root,
      activeUsages: plan.activeUsages,
      archivedUsages: plan.archivedUsages,
      archiveChain: plan.deleteChain.filter((item) => item.status === "ACTIVE"),
      canReplace: commonReplacementIds.length > 0,
      confirmationFingerprint: plan.confirmationFingerprint,
    };
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
        const restoredProducts = [];
        for (const [id, name] of resolved.restored) {
          restoredProducts.push(
            await this.repository.setStatus(transaction, context, id, "ACTIVE", name),
          );
          await this.repository.audit(transaction, context, id, "product.restored");
        }
        return { restoredProducts };
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

  private async assertPermanentDeletePermission(context: CreateProductContext) {
    if (context.internalUserId || !context.userId)
      throw new ForbiddenException("Служебный доступ не включает безвозвратное удаление продукции");
    const workspace = await this.organizations.findWorkspaceForUser(
      context.userId,
      context.companyId,
      context.venueId,
    );
    if (!workspace) throw new NotFoundException("Рабочее пространство не найдено");
    if (!workspace.permissions.includes("delete_products_permanently"))
      throw new ForbiddenException(
        "У вас нет права на безвозвратное удаление продукции этого заведения",
      );
  }
}
