export function useApiFetch(): typeof globalThis.fetch {
  const config = useRuntimeConfig();
  const requestUrl = useRequestURL();
  const requestCookie = import.meta.server ? useRequestHeaders(["cookie"]).cookie : undefined;
  const baseUrl = config.public.apiBaseUrl || requestUrl.origin;

  return (input, init) => {
    const path = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const targetUrl = new URL(path, baseUrl);
    const headers = new Headers(init?.headers);

    if (requestCookie && targetUrl.origin === requestUrl.origin && !headers.has("cookie")) {
      headers.set("cookie", requestCookie);
    }

    return globalThis.fetch(targetUrl, { ...init, headers });
  };
}
