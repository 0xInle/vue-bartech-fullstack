export function compareCategoryNames(first: string, second: string): number {
  const firstIsOther = first.trim().toLocaleLowerCase("ru") === "другое";
  const secondIsOther = second.trim().toLocaleLowerCase("ru") === "другое";
  if (firstIsOther !== secondIsOther) return firstIsOther ? 1 : -1;
  return first.localeCompare(second, "ru", { sensitivity: "base" });
}
