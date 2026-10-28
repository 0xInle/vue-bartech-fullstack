export type CocktailListItem = {
  id: string;
  name: string;
  categories: string[];
  componentSummary: string;
  updatedAt: Date;
};

export type CocktailGarnishOption = {
  id: string;
  name: string;
  kind: "PRODUCT" | "QUICK";
};

export type CocktailCard = {
  id: string;
  name: string;
  type: "COCKTAIL";
  status: "ACTIVE";
  components: Array<{
    id: string;
    productId: string;
    productType: "INGREDIENT" | "PREPARATION";
    unitId: string;
    name: string;
    amount: number;
    unit: string;
  }>;
  garnishes: CocktailGarnishOption[];
  categories: Array<{ id: string; label: string }>;
  technology: string;
  output: { amount: number; unitId: string; unit: string } | null;
  comment: string | null;
  glass: string | null;
  glassId: string | null;
  ice: string | null;
  iceId: string | null;
  preparationMethod: string | null;
  preparationMethodId: string | null;
};
