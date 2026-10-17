import { Injectable, NotFoundException } from "@nestjs/common";
import { ProductContextAccess } from "../product-context-access.js";
import type { CreateProductContext } from "../product.dto.js";
import type { PreparationListSort } from "./preparation-read.dto.js";
import { PreparationReadRepository } from "./preparation-read.repository.js";

@Injectable()
export class PreparationReadService {
  constructor(
    private readonly repository: PreparationReadRepository,
    private readonly access: ProductContextAccess,
  ) {}

  async list(context: CreateProductContext, query?: string, categoryCode?: string, sort?: string) {
    await this.assertViewAccess(context);
    return this.repository.list(
      context.venueId,
      normalizeQuery(query),
      normalizeCategoryCode(categoryCode),
      normalizeSort(sort),
    );
  }

  async getById(context: CreateProductContext, preparationId: string) {
    await this.assertViewAccess(context);
    const preparation = await this.repository.getById(context.venueId, preparationId);
    if (!preparation) throw new NotFoundException("Заготовка не найдена");
    return preparation;
  }

  private async assertViewAccess(context: CreateProductContext): Promise<void> {
    await this.access.assert(context, "view_products");
  }
}

function normalizeQuery(query?: string): string | undefined {
  const value = query?.trim().replace(/\s+/gu, " ");
  return value || undefined;
}

function normalizeCategoryCode(categoryCode?: string): string | undefined {
  const value = categoryCode?.trim().toLowerCase();
  return value || undefined;
}

function normalizeSort(sort?: string): PreparationListSort {
  return sort === "updated" ? "updated" : "name";
}
