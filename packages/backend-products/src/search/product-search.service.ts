import {
  BadRequestException,
  Injectable,
} from "@nestjs/common";
import { ProductContextAccess } from "../product-context-access.js";
import type { CreateProductContext } from "../product.dto.js";
import { createSearchVariants, normalizeSearchText } from "./product-search-rules.js";
import { ProductSearchRepository, type ProductSearchScope } from "./product-search.repository.js";

const supportedTypes = ["INGREDIENT", "PREPARATION", "GARNISH", "COCKTAIL"] as const;

@Injectable()
export class ProductSearchService {
  constructor(
    private readonly repository: ProductSearchRepository,
    private readonly access: ProductContextAccess,
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
      allowFuzzy: query.length >= 3,
      brand: input.brand ? normalizeSearchText(input.brand) : undefined,
      categoryCode: input.categoryCode?.trim().toLowerCase(),
    });
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
