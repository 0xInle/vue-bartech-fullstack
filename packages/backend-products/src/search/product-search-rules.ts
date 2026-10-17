export type ProductSearchMatchReason =
  "EXACT_NAME" | "CONFIRMED_ALIAS" | "PREFIX" | "FUZZY_NAME" | "ATTRIBUTE_MATCH";

export function normalizeSearchText(value: string): string {
  return value
    .trim()
    .replace(/\s+/gu, " ")
    .toLocaleLowerCase("ru-RU")
    .replaceAll("ё", "е")
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

export function createSearchVariants(value: string): string[] {
  const normalized = normalizeSearchText(value);
  const variants = [normalized, toLatin(normalized), toCyrillic(normalized)];
  return [...new Set(variants.filter((variant) => variant.length >= 2))];
}

function toLatin(value: string): string {
  const transliteration: Record<string, string> = {
    а: "a",
    б: "b",
    в: "v",
    г: "g",
    д: "d",
    е: "e",
    ж: "zh",
    з: "z",
    и: "i",
    й: "y",
    к: "k",
    л: "l",
    м: "m",
    н: "n",
    о: "o",
    п: "p",
    р: "r",
    с: "s",
    т: "t",
    у: "u",
    ф: "f",
    х: "kh",
    ц: "ts",
    ч: "ch",
    ш: "sh",
    щ: "shch",
    ъ: "",
    ы: "y",
    ь: "",
    э: "e",
    ю: "yu",
    я: "ya",
  };
  return [...value].map((character) => transliteration[character] ?? character).join("");
}

function toCyrillic(value: string): string {
  const replacements: Array<[RegExp, string]> = [
    [/shch/gu, "щ"],
    [/zh/gu, "ж"],
    [/kh/gu, "х"],
    [/ts/gu, "ц"],
    [/ch/gu, "ч"],
    [/sh/gu, "ш"],
    [/yu/gu, "ю"],
    [/ya/gu, "я"],
  ];
  let result = value;
  for (const [pattern, replacement] of replacements) result = result.replace(pattern, replacement);
  const transliteration: Record<string, string> = {
    a: "а",
    b: "б",
    c: "к",
    d: "д",
    e: "е",
    f: "ф",
    g: "г",
    h: "х",
    i: "и",
    j: "дж",
    k: "к",
    l: "л",
    m: "м",
    n: "н",
    o: "о",
    p: "п",
    q: "к",
    r: "р",
    s: "с",
    t: "т",
    u: "у",
    v: "в",
    w: "в",
    x: "кс",
    y: "й",
    z: "з",
  };
  return [...result].map((character) => transliteration[character] ?? character).join("");
}
