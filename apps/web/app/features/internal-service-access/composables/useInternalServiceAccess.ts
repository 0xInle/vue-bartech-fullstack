import type { Ref } from "vue";
import { useQuery, useQueryClient } from "@tanstack/vue-query";
import { identityControllerCsrf } from "@bartech/api-client";

export type ServiceGrant = {
  id: string;
  companyId: string;
  venueId: string | null;
  scopeType: "COMPANY" | "VENUE";
  expiresAt: string;
  company: { id: string; name: string; venues: Array<{ id: string; name: string }> };
  venue: { id: string; name: string } | null;
  author: { profile: { fullName: string } | null };
  request: { id: string; reason: string } | null;
  sessions: Array<{ id: string; expiresAt: string }>;
};

export type ServiceSession = {
  id: string;
  companyId: string;
  venueId: string | null;
  expiresAt: string;
};

export function useInternalServiceAccess(enabled: Ref<boolean>) {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  const grantsQuery = useQuery({
    queryKey: ["internal-service-access-grants"],
    enabled,
    retry: false,
    queryFn: async ({ signal }) =>
      readResponse<ServiceGrant[]>(
        await apiFetch("/api/v1/internal/service-access/grants", {
          credentials: "include",
          signal,
        }),
      ),
  });

  async function start(grantId: string): Promise<ServiceSession> {
    const response = await mutate(`/api/v1/internal/service-access/grants/${grantId}/sessions`);
    await queryClient.invalidateQueries({ queryKey: ["internal-service-access-grants"] });
    return response as ServiceSession;
  }

  async function end(sessionId: string) {
    await mutate(`/api/v1/internal/service-access/sessions/${sessionId}/end`);
    await queryClient.invalidateQueries({ queryKey: ["internal-service-access-grants"] });
  }

  async function mutate(path: string) {
    const csrf = await identityControllerCsrf({ credentials: "include" }, apiFetch);
    if (csrf.status < 200 || csrf.status >= 300) throw new Error("Не удалось проверить запрос");
    const response = await apiFetch(path, {
      method: "POST",
      credentials: "include",
      headers: { "x-csrf-token": csrf.data.token },
    });
    return readResponse(await response);
  }

  return { grantsQuery, start, end };
}

async function readResponse<T = unknown>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as { detail?: string };
  if (!response.ok) throw new Error(body.detail ?? "Не удалось выполнить запрос");
  return body as T;
}
