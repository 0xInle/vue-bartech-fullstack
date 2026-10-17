import { Injectable, NotFoundException } from "@nestjs/common";
import { ProductContextAccess } from "../product-context-access.js";
import type { CreateProductContext } from "../product.dto.js";
import type { GarnishListSort } from "./garnish-read.dto.js";
import { GarnishReadRepository } from "./garnish-read.repository.js";

@Injectable()
export class GarnishReadService {
  constructor(
    private readonly repository: GarnishReadRepository,
    private readonly access: ProductContextAccess,
  ) {}

  async list(context: CreateProductContext, query?: string, sort?: string) {
    await this.assertViewAccess(context);
    return this.repository.list(context.venueId, normalizeQuery(query), normalizeSort(sort));
  }

  async getById(context: CreateProductContext, garnishId: string) {
    await this.assertViewAccess(context);
    const garnish = await this.repository.getById(context.venueId, garnishId);
    if (!garnish) throw new NotFoundException("Гарнир не найден");
    return garnish;
  }

  private async assertViewAccess(context: CreateProductContext): Promise<void> {
    await this.access.assert(context, "view_products");
  }
}

function normalizeQuery(query?: string): string | undefined {
  const value = query?.trim().replace(/\s+/gu, " ");
  return value || undefined;
}

function normalizeSort(sort?: string): GarnishListSort {
  return sort === "updated" ? "updated" : "name";
}
