export type ProductExportSnapshot = {
  venue: { id: string; companyId: string; name: string };
  generatedAt: string;
  products: Array<Record<string, unknown>>;
  dependencies: {
    units: Array<Record<string, unknown>>;
    referenceValues: Array<Record<string, unknown>>;
    ingredientCategories: Array<Record<string, unknown>>;
    preparationCategories: Array<Record<string, unknown>>;
    globalIngredients: Array<Record<string, unknown>>;
  };
};

export type ProductExportContext = { companyId: string; venueId: string };
