export type ProductComponentInput = {
  productId: string;
  unitId: string;
  amount: number;
};

export type ProductBaseInput = {
  name: string;
  technology: string;
  comment?: string;
  output?: { amount: number; unitId: string };
  components: ProductComponentInput[];
};

export type LocalIngredientInput = {
  name: string;
  categoryCode: string;
  brand?: string;
  strength?: number;
  country?: string;
  externalIdentifier?: string;
};

export type PreparationInput = ProductBaseInput & { categoryCode: string };

export type CocktailInput = ProductBaseInput & {
  glassId: string;
  iceId: string;
  preparationMethodId: string;
  garnishIds?: string[];
  quickGarnishIds?: string[];
  garnishSelections?: Array<{ id: string; kind: "PRODUCT" | "QUICK" }>;
  categoryIds?: string[];
};

export type CreateProductContext = {
  companyId: string;
  venueId: string;
} & (
  | {
      userId: string;
      internalUserId?: never;
      internalSessionId?: never;
      grantId?: never;
      serviceSessionId?: never;
    }
  | {
      userId: null;
      internalUserId: string;
      internalSessionId: string;
      grantId: string;
      serviceSessionId: string;
    }
);
