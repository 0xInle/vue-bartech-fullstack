import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { OrganizationsService } from "@bartech/backend-organizations";
import { SupportAccessService } from "@bartech/backend-support";
import type { Prisma } from "@bartech/database";
import type { CreateProductContext } from "./product.dto.js";

@Injectable()
export class ProductContextAccess {
  constructor(
    private readonly organizations: OrganizationsService,
    private readonly supportAccess: SupportAccessService,
  ) {}

  async assert(
    context: CreateProductContext,
    permission: "view_products" | "manage_products",
    transaction?: Prisma.TransactionClient,
  ) {
    if (context.internalUserId) {
      await this.supportAccess.assertActiveSession(
        context.serviceSessionId,
        context.internalUserId,
        context.internalSessionId,
        context.companyId,
        context.venueId,
        transaction,
      );
      return;
    }
    if (!context.userId) throw new ForbiddenException("Контекст продукта недоступен");
    const workspace = await this.organizations.findWorkspaceForUser(
      context.userId,
      context.companyId,
      context.venueId,
    );
    if (!workspace) throw new NotFoundException("Рабочее пространство не найдено");
    if (!workspace.permissions.includes(permission)) {
      throw new ForbiddenException("У вас нет доступа к этому действию");
    }
  }
}
