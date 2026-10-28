import { Injectable } from "@nestjs/common";
import type { ProductExportContext, ProductExportSnapshot } from "./product-export.dto.js";
import { ProductExportReadRepository } from "./product-export-read.repository.js";

type ProductExportSource = Awaited<ReturnType<ProductExportReadRepository["read"]>>;

@Injectable()
export class ProductExportReadService {
  constructor(private readonly repository: ProductExportReadRepository) {}

  async readSnapshot(
    context: ProductExportContext,
    productIds?: string[],
    includeArchived = false,
  ): Promise<ProductExportSnapshot> {
    const data = await this.repository.read(
      context.companyId,
      context.venueId,
      productIds,
      includeArchived,
    );
    return {
      venue: data.venue,
      generatedAt: new Date().toISOString(),
      products: data.products.map(sanitizeProduct),
      dependencies: {
        units: data.units.map(({ id, code, label, kind, venueId }) => ({
          id,
          code,
          label,
          kind,
          venueId,
        })),
        referenceValues: data.referenceValues.map(
          ({ id, type, code, label, venueId, sortOrder, isActive }) => ({
            id,
            type,
            code,
            label,
            venueId,
            sortOrder,
            isActive,
          }),
        ),
        ingredientCategories: data.ingredientCategories.map(
          ({ id, code, name, parentCode, sortOrder, isActive }) => ({
            id,
            code,
            name,
            parentCode,
            sortOrder,
            isActive,
          }),
        ),
        preparationCategories: data.preparationCategories.map(
          ({ id, code, name, sortOrder, isActive }) => ({ id, code, name, sortOrder, isActive }),
        ),
        globalIngredients: data.globalIngredients.map(sanitizeProduct),
      },
    };
  }
}

function sanitizeProduct(
  product: ProductExportSource["products"][number],
): Record<string, unknown> {
  return {
    id: product.id,
    type: product.type,
    status: product.status,
    venueId: product.venueId,
    name: product.name,
    technology: product.technology,
    comment: product.comment,
    outputAmount: product.outputAmount?.toString() ?? null,
    outputUnitId: product.outputUnitId,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
    ingredient: product.ingredient
      ? {
          categoryCode: product.ingredient.categoryCode,
          category: product.ingredient.category.name,
          brand: product.ingredient.brand,
          strength: product.ingredient.strength?.toString() ?? null,
          country: product.ingredient.country,
          externalIdentifier: product.ingredient.externalIdentifier,
        }
      : null,
    preparation: product.preparation
      ? {
          categoryCode: product.preparation.categoryCode,
          category: product.preparation.category.name,
        }
      : null,
    cocktail: product.cocktail
      ? {
          glassId: product.cocktail.glassId,
          glass: product.cocktail.glass?.label ?? null,
          iceId: product.cocktail.iceId,
          ice: product.cocktail.ice?.label ?? null,
          preparationMethodId: product.cocktail.preparationMethodId,
          preparationMethod: product.cocktail.preparationMethod?.label ?? null,
        }
      : null,
    components: product.parentComponents.map((component) => ({
      id: component.id,
      productId: component.componentProductId,
      venueId: component.componentVenueId,
      amount: component.amount.toString(),
      unitId: component.unitId,
      position: component.position,
      product: component.componentProduct
        ? {
            id: component.componentProduct.id,
            type: component.componentProduct.type,
            name: component.componentProduct.name,
            status: component.componentProduct.status,
            category: component.componentProduct.ingredient?.category.name ?? null,
            brand: component.componentProduct.ingredient?.brand ?? null,
            strength: component.componentProduct.ingredient?.strength?.toString() ?? null,
          }
        : null,
    })),
    garnishes: [
      ...product.cocktailGarnishes.map((entry) => ({
        id: entry.garnishId,
        position: entry.position,
        kind: "PRODUCT",
        name: entry.garnish?.name ?? null,
      })),
      ...product.cocktailQuickGarnishes.map((entry) => ({
        id: entry.referenceValueId,
        position: entry.position,
        kind: "QUICK",
        name: entry.referenceValue.label,
      })),
    ].sort((a, b) => a.position - b.position),
  };
}
