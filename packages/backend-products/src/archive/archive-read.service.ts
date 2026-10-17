import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { OrganizationsService } from "@bartech/backend-organizations";
import type { ProductType } from "@bartech/database";
import type { CreateProductContext } from "../product.dto.js";
import { ArchiveReadRepository } from "./archive-read.repository.js";

@Injectable()
export class ArchiveReadService {
  constructor(
    private readonly repository: ArchiveReadRepository,
    private readonly organizations: OrganizationsService,
  ) {}

  async list(context: CreateProductContext, query?: string, type?: ProductType) {
    await this.assertAccess(context);
    return this.repository.list(
      context.venueId,
      query?.trim().replace(/\s+/gu, " ") || undefined,
      type,
    );
  }

  async getById(context: CreateProductContext, productId: string) {
    await this.assertAccess(context);
    const card = await this.repository.card(context.venueId, productId);
    if (!card) throw new NotFoundException("Продукт не найден или недоступен");
    return card;
  }

  private async assertAccess(context: CreateProductContext) {
    if (context.internalUserId || !context.userId)
      throw new ForbiddenException("Служебный доступ не включает архив");
    const workspace = await this.organizations.findWorkspaceForUser(
      context.userId,
      context.companyId,
      context.venueId,
    );
    if (!workspace) throw new NotFoundException("Рабочее пространство не найдено");
    if (!workspace.permissions.includes("view_archive"))
      throw new ForbiddenException("У вас нет доступа к архиву");
  }
}
