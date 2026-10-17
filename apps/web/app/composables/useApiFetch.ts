import { analyticsDeviceType } from "~/features/analytics/utils/device-type";

export function useApiFetch(): typeof globalThis.fetch {
  const config = useRuntimeConfig();
  const requestUrl = useRequestURL();
  const requestCookie = import.meta.server ? useRequestHeaders(["cookie"]).cookie : undefined;
  const csrfToken = useState("identity-csrf-token", () => "");
  const baseUrl = config.public.apiBaseUrl || requestUrl.origin;

  return (input, init) => {
    const request = input instanceof Request ? new Request(input, init) : undefined;
    const path =
      request?.url ??
      (typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    const requestMethod = request?.method ?? init?.method ?? "GET";
    const method = requestMethod.toUpperCase();

    if (
      import.meta.client &&
      navigator.onLine === false &&
      method !== "GET" &&
      method !== "HEAD" &&
      method !== "OPTIONS"
    ) {
      return Promise.reject(
        new Error("Нет подключения к интернету. Подключитесь к сети, чтобы сохранить изменения."),
      );
    }

    const targetUrl = new URL(path, baseUrl);
    const headers = new Headers(request?.headers ?? init?.headers);

    if (requestCookie && targetUrl.origin === requestUrl.origin && !headers.has("cookie")) {
      headers.set("cookie", requestCookie);
    }

    const pending = request
      ? globalThis.fetch(new Request(request, { headers }))
      : globalThis.fetch(targetUrl, { ...init, headers });
    if (
      !import.meta.client ||
      !targetUrl.pathname.startsWith("/api/v1/") ||
      targetUrl.pathname.includes("/internal/")
    ) {
      return pending;
    }
    return pending.then(
      (response) => {
        if (response.status >= 500) reportTechnicalError("API", targetUrl, csrfToken.value);
        return response;
      },
      (error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          reportTechnicalError("NETWORK", targetUrl, csrfToken.value);
        }
        throw error;
      },
    );
  };
}

function reportTechnicalError(
  errorCategory: "API" | "NETWORK",
  failedUrl: URL,
  csrfToken: string,
): void {
  if (!csrfToken || failedUrl.pathname.endsWith("/analytics/events")) return;
  try {
    if (!globalThis.crypto?.randomUUID) return;
    const eventUrl = new URL("/api/v1/analytics/events", failedUrl.origin);
    void globalThis
      .fetch(eventUrl, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
        body: JSON.stringify({
          eventId: crypto.randomUUID(),
          eventType: "TECHNICAL_ERROR",
          deviceType: analyticsDeviceType(),
          errorCategory,
          result: "FAILURE",
        }),
      })
      .catch(() => undefined);
  } catch {
    // Ошибка аналитики не должна менять результат исходного API-запроса.
  }
}
