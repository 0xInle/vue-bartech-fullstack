import { Injectable, NotFoundException } from "@nestjs/common";
import { ProductContextAccess } from "../product-context-access.js";
import type { CreateProductContext } from "../product.dto.js";
import { ProductSearchService } from "../search/product-search.service.js";
import { CocktailReadRepository } from "./cocktail-read.repository.js";

@Injectable()
export class CocktailReadService {
  constructor(
    private readonly repository: CocktailReadRepository,
    private readonly access: ProductContextAccess,
    private readonly search: ProductSearchService,
  ) {}

  async list(context: CreateProductContext, query?: string) {
    await this.assertViewAccess(context);
    const normalizedQuery = normalizeQuery(query);
    const matchingIds = normalizedQuery
      ? await this.search.findWorkspaceMatches(context, "COCKTAIL", normalizedQuery)
      : undefined;
    return this.repository.list(context.venueId, matchingIds);
  }

  async getById(context: CreateProductContext, cocktailId: string) {
    await this.assertViewAccess(context);
    const cocktail = await this.repository.getById(context.venueId, cocktailId);
    if (!cocktail) throw new NotFoundException("Коктейль не найден");
    return cocktail;
  }

  async listGarnishes(context: CreateProductContext, query?: string) {
    await this.assertViewAccess(context);
    const normalizedQuery = normalizeQuery(query);
    const matchingIds = normalizedQuery
      ? await this.search.findWorkspaceMatches(context, "GARNISH", normalizedQuery)
      : undefined;
    return this.repository.listGarnishes(context.venueId, matchingIds);
  }

  private async assertViewAccess(context: CreateProductContext): Promise<void> {
    await this.access.assert(context, "view_products");
  }
}

function normalizeQuery(query?: string): string | undefined {
  const value = query?.trim().replace(/\s+/gu, " ");
  return value || undefined;
}
