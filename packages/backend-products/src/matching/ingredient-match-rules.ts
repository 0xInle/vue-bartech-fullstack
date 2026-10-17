export type IngredientMatchReason =
  "FUZZY_NAME" | "ATTRIBUTE_CONFLICT" | "MULTIPLE_CANDIDATES" | "NO_CONFIDENT_MATCH";

type IngredientCharacteristics = {
  categoryCode: string;
  brandNormalized: string | null;
  strength: number | null;
  country: string | null;
  externalIdentifier: string | null;
};

export function hasCompatibleSpecifiedCharacteristics(
  source: IngredientCharacteristics,
  candidate: IngredientCharacteristics,
): boolean {
  return (
    source.categoryCode === candidate.categoryCode &&
    compatible(source.brandNormalized, candidate.brandNormalized) &&
    compatible(source.strength, candidate.strength) &&
    compatible(
      source.country?.toLocaleLowerCase("ru-RU") ?? null,
      candidate.country?.toLocaleLowerCase("ru-RU") ?? null,
    ) &&
    compatible(source.externalIdentifier, candidate.externalIdentifier)
  );
}

export function hasExactStrictCharacteristics(
  source: IngredientCharacteristics,
  candidate: IngredientCharacteristics,
): boolean {
  return (
    source.categoryCode === candidate.categoryCode &&
    Boolean(source.brandNormalized) &&
    source.brandNormalized === candidate.brandNormalized &&
    compatible(source.strength, candidate.strength) &&
    compatible(
      source.country?.toLocaleLowerCase("ru-RU") ?? null,
      candidate.country?.toLocaleLowerCase("ru-RU") ?? null,
    ) &&
    compatible(source.externalIdentifier, candidate.externalIdentifier)
  );
}

function compatible<T>(source: T | null, candidate: T | null): boolean {
  return source === null || source === candidate;
}
