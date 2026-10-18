import { BadRequestException, Injectable } from "@nestjs/common";
import { ProductContextAccess } from "../product-context-access.js";
import { OrganizationsService } from "@bartech/backend-organizations";
import type { CreateProductContext } from "../product.dto.js";
import { createSearchVariants, normalizeSearchText } from "./product-search-rules.js";
import { ProductSearchRepository, type ProductSearchScope } from "./product-search.repository.js";

const supportedTypes = ["INGREDIENT", "PREPARATION", "GARNISH", "COCKTAIL"] as const;

@Injectable()
export class ProductSearchService {
  constructor(
    private readonly repository: ProductSearchRepository,
    private readonly access: ProductContextAccess,
    private readonly organizations: OrganizationsService,
  ) {}

  async search(
    context: CreateProductContext,
    input: {
      query: string;
      scope: ProductSearchScope;
      types?: string;
      brand?: string;
      categoryCode?: string;
    },
  ) {
    await this.access.assert(context, "view_products");

    const query = normalizeSearchText(input.query);
    if (query.length < 2) throw new BadRequestException("Введите не менее двух символов");
    const types =
      input.scope === "COMPONENT" ? ["INGREDIENT", "PREPARATION"] : parseTypes(input.types);
    return this.repository.search({
      venueId: context.venueId,
      scope: input.scope,
      types,
      variants: createSearchVariants(query),
      allowFuzzy: query.length >= 4,
      brand: input.brand ? normalizeSearchText(input.brand) : undefined,
      categoryCode: input.categoryCode?.trim().toLowerCase(),
    });
  }

  async searchCompanyPage(
    userId: string,
    companyId: string,
    input: {
      query: string;
      types?: string;
      offset?: number;
      limit?: number;
      categoryType?: "INGREDIENT" | "PREPARATION";
      categoryCode?: string;
    },
  ) {
    await this.organizations.assertChefBartenderInCompany(userId, companyId);
    const query = normalizeSearchText(input.query);
    if (query.length < 2) throw new BadRequestException("Введите не менее двух символов");
    validateCategory(input.categoryType, input.categoryCode);
    return this.repository.searchPage({
      companyId,
      types: parseTypes(input.types),
      variants: createSearchVariants(query),
      allowFuzzy: query.length >= 4,
      offset: input.offset ?? 0,
      limit: input.limit ?? 20,
      categoryType: input.categoryType,
      categoryCode: input.categoryCode,
    });
  }

  async searchWorkspacePage(
    context: CreateProductContext,
    input: {
      query: string;
      types?: string;
      offset?: number;
      limit?: number;
      categoryType?: "INGREDIENT" | "PREPARATION";
      categoryCode?: string;
    },
  ) {
    await this.access.assert(context, "view_products");
    const query = normalizeSearchText(input.query);
    if (query.length < 2) throw new BadRequestException("Введите не менее двух символов");
    validateCategory(input.categoryType, input.categoryCode);
    return this.repository.searchPage({
      venueId: context.venueId,
      types: parseTypes(input.types),
      variants: createSearchVariants(query),
      allowFuzzy: query.length >= 4,
      offset: input.offset ?? 0,
      limit: input.limit ?? 20,
      categoryType: input.categoryType,
      categoryCode: input.categoryCode,
    });
  }

  async findWorkspaceMatches(
    context: CreateProductContext,
    type: "COCKTAIL" | "PREPARATION" | "GARNISH",
    rawQuery: string,
  ): Promise<string[]> {
    await this.access.assert(context, "view_products");
    const query = normalizeSearchText(rawQuery);
    if (!query) return [];
    return this.repository.findWorkspaceMatches({
      venueId: context.venueId,
      type,
      variants: createSearchVariants(query),
      allowFuzzy: query.length >= 4,
    });
  }
}

function validateCategory(categoryType?: string, categoryCode?: string): void {
  if (Boolean(categoryType) !== Boolean(categoryCode)) {
    throw new BadRequestException("Тип и код категории должны передаваться вместе");
  }
}

function parseTypes(value?: string): string[] {
  if (!value) return [...supportedTypes];
  const types = [
    ...new Set(
      value
        .split(",")
        .map((type) => type.trim().toUpperCase())
        .filter(Boolean),
    ),
  ];
  if (
    !types.length ||
    types.some((type) => !supportedTypes.includes(type as (typeof supportedTypes)[number]))
  ) {
    throw new BadRequestException("Укажите допустимые типы продукции");
  }
  return types;
}
