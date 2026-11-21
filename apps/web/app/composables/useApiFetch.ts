import { analyticsDeviceType } from "~/features/analytics/utils/device-type";
import { useQueryClient } from "@tanstack/vue-query";

export function useApiFetch(): typeof globalThis.fetch {
  const queryClient = useQueryClient();
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
    const isApiRequest = import.meta.client && targetUrl.pathname.startsWith("/api/v1/");
    const shouldRefreshAudit = isApiRequest && isAuditMutation(targetUrl.pathname, method);
    const shouldReportError = isApiRequest && !targetUrl.pathname.includes("/internal/");
    if (!shouldRefreshAudit && !shouldReportError) return pending;

    return pending.then(
      (response) => {
        if (shouldReportError && response.status >= 500)
          reportTechnicalError("API", targetUrl, csrfToken.value);
        if (shouldRefreshAudit && response.ok) {
          void Promise.all([
            queryClient.invalidateQueries({ queryKey: ["audit-history"] }),
            queryClient.invalidateQueries({ queryKey: ["audit-history-authors"] }),
          ]);
        }
        return response;
      },
      (error: unknown) => {
        if (shouldReportError && !(error instanceof DOMException && error.name === "AbortError")) {
          reportTechnicalError("NETWORK", targetUrl, csrfToken.value);
        }
        throw error;
      },
    );
  };
}

function isAuditMutation(pathname: string, method: string): boolean {
  if (["GET", "HEAD", "OPTIONS"].includes(method)) return false;

  // Список соответствует операциям, создающим видимые записи AuditEvent.
  return [
    /^\/api\/v1\/organizations\/companies\/[^/]+\/venues\/[^/]+\/(?:announcements|checklists)(?:\/[^/]+)?$/,
    /^\/api\/v1\/organizations\/companies\/[^/]+\/venues\/[^/]+\/team\/(?:add-existing|[^/]+(?:\/end)?)$/,
    /^\/api\/v1\/organizations\/companies\/[^/]+\/(?:chef-invitations|venue-invitations)(?:\/revoke)?$/,
    /^\/api\/v1\/organizations\/companies\/[^/]+\/venues\/[^/]+\/invitations(?:\/revoke)?$/,
    /^\/api\/v1\/invitations\/(?:accept|decline|cancel|complete)$/,
    /^\/api\/v1\/organizations\/companies\/[^/]+\/venues\/[^/]+\/products\/(?:ingredients|preparations|garnishes|cocktails)(?:\/[^/]+)?$/,
    /^\/api\/v1\/organizations\/companies\/[^/]+\/venues\/[^/]+\/products\/(?:[^/]+\/(?:archive|permanent-delete)|archive\/[^/]+\/restore)$/,
    /^\/api\/v1\/support\/requests(?:\/[^/]+\/messages)?$/,
    /^\/api\/v1\/support\/access-grants\/(?:requests\/[^/]+\/messages\/[^/]+\/approve-access|[^/]+\/revoke)$/,
    /^\/api\/v1\/internal\/service-access\/(?:grants\/[^/]+\/sessions|sessions\/[^/]+\/end)$/,
    /^\/api\/v1\/internal\/service-sessions\/[^/]+\/companies\/[^/]+\/venues\/[^/]+\/products\/(?:ingredients|preparations|garnishes|cocktails)(?:\/[^/]+)?$/,
    /^\/api\/v1\/support\/requests\/[^/]+\/access-grants\/[^/]+\/revoke$/,
    /^\/api\/v1\/internal\/support\/requests\/[^/]+\/access-grants\/[^/]+\/revoke$/,
    /^\/api\/v1\/internal\/catalog\/candidates\/[^/]+\/(?:link|create-global|keep-local)$/,
  ].some((route) => route.test(pathname));
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
