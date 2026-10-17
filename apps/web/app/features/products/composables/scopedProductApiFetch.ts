export function scopedProductApiFetch<T extends (...args: never[]) => unknown>(
  apiFetch: T,
  serviceBasePath: string,
): T {
  return (async (...args: Parameters<T>) => {
    const [input] = args;
    if (typeof input !== "string") return apiFetch(...args);
    const url = new URL(input, "http://localhost");
    const marker = url.pathname.match(
      /\/api\/v1\/organizations\/companies\/[^/]+\/venues\/[^/]+\/products(.*)$/u,
    );
    if (!marker) return apiFetch(...args);
    url.pathname = `${serviceBasePath}${marker[1]}`;
    const next = [...args] as unknown[];
    next[0] = `${url.pathname}${url.search}`;
    return apiFetch(...(next as Parameters<T>));
  }) as T;
}
