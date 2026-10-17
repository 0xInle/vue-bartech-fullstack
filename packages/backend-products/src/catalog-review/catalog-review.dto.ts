export type CatalogCandidate = {
  id: string;
  status: "NEEDS_REVIEW";
  reason: string;
  confidence: number | null;
  processedAt: Date;
  local: {
    id: string;
    name: string;
    categoryCode: string;
    brand: string | null;
    strength: string | null;
    country: string | null;
    externalIdentifier: string | null;
  };
  suggestion: { id: string; name: string } | null;
};

export type GlobalIngredientInput = {
  name: string;
  categoryCode: string;
  brand?: string;
  strength?: number;
  country?: string;
  externalIdentifier?: string;
};
