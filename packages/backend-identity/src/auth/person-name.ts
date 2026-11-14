const PERSON_NAME_PART = /^\p{L}[\p{L}\p{M}]*(?:[-'’][\p{L}\p{M}]+)*$/u;

export function normalizePersonName(value: string): string | null {
  const normalized = value.trim().replace(/\s+/gu, " ");
  const parts = normalized.split(" ");
  const isValid =
    parts.length >= 2 &&
    parts.every((part) => PERSON_NAME_PART.test(part) && (part.match(/\p{L}/gu)?.length ?? 0) >= 2);

  return isValid ? normalized : null;
}
