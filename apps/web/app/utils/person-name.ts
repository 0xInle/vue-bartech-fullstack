const PERSON_NAME_PART = /^\p{L}[\p{L}\p{M}]*(?:[-'’][\p{L}\p{M}]+)*$/u;

export function normalizePersonName(value: string): string {
  return value.trim().replace(/\s+/gu, " ");
}

export function isValidPersonName(value: string): boolean {
  const parts = normalizePersonName(value).split(" ");

  return (
    parts.length >= 2 &&
    parts.every((part) => PERSON_NAME_PART.test(part) && (part.match(/\p{L}/gu)?.length ?? 0) >= 2)
  );
}
