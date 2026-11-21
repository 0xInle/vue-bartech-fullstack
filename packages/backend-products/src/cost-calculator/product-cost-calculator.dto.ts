export type CostCalculatorUnit = {
  id: string;
  code: string;
  label: string;
  kind: "VOLUME" | "MASS" | "COUNT" | "BAR_MEASURE" | null;
};

export type CostCalculatorProduct = {
  id: string;
  name: string;
  type: "INGREDIENT" | "PREPARATION" | "GARNISH" | "COCKTAIL";
  output: { amount: number; unit: CostCalculatorUnit } | null;
  components: Array<{
    id: string;
    amount: number;
    unit: CostCalculatorUnit;
    product: CostCalculatorProduct;
  }>;
  garnishes: Array<
    | { id: string; name: string; kind: "PRODUCT"; product: CostCalculatorProduct }
    | { id: string; name: string; kind: "QUICK" }
  >;
};

export type CostCalculatorRecipe = {
  product: CostCalculatorProduct;
  units: CostCalculatorUnit[];
  priceUnits: CostCalculatorUnit[];
};

export type CostCalculationInput = {
  ingredientInputs: Array<
    | { lineKey: string; mode: "UNIT_PRICE"; priceUnitId: string; unitPrice: number }
    | { lineKey: string; mode: "ESTIMATE"; estimatedCost: number }
    | { lineKey: string; mode: "OMIT" }
  >;
  quickGarnishes: Array<
    | {
        id: string;
        mode: "UNIT_PRICE";
        amount: number;
        unitId: string;
        priceUnitId: string;
        unitPrice: number;
      }
    | { id: string; mode: "ESTIMATE"; estimatedPrice: number }
    | { id: string; mode: "OMIT" }
  >;
};

export type CostCalculationResult = {
  productId: string;
  productName: string;
  productType: "PREPARATION" | "GARNISH" | "COCKTAIL";
  totalCost: number;
  costPerOutputUnit: number | null;
  output: CostCalculatorProduct["output"];
  units: CostCalculatorUnit[];
  complete: boolean;
  hasEstimates: boolean;
  lines: Array<{
    lineKey: string;
    name: string;
    amount: number | null;
    unit: CostCalculatorUnit | null;
    cost: number | null;
    estimated: boolean;
    issue: string | null;
  }>;
  issues: string[];
};
