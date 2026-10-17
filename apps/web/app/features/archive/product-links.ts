export const productTypeLabels = {
  INGREDIENT: "Ингредиент",
  PREPARATION: "Заготовка",
  GARNISH: "Гарнир",
  COCKTAIL: "Коктейль",
};

export function activeProductPath(
  base: string,
  product: { id: string; type: string },
): string | null {
  const sections: Record<string, string> = {
    PREPARATION: "preparations",
    GARNISH: "garnishes",
    COCKTAIL: "cocktails",
  };
  return sections[product.type] ? `${base}/${sections[product.type]}/${product.id}` : null;
}
