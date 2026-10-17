import { computed } from "vue";
import { useQuery, useQueryClient } from "@tanstack/vue-query";
import { identityControllerCsrf } from "@bartech/api-client";
import { useIdentityFlow } from "~/features/identity/composables/useIdentityFlow";

type AccessGrant = {
  id: string;
  companyId: string;
  venueId: string | null;
  scopeType: "COMPANY" | "VENUE";
  requestId: string | null;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  companyName?: string;
  venueName?: string | null;
  active?: boolean;
};

export function useSupportAccessGrants() {
  const identity = useIdentityFlow();
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  const userId = computed(() => identity.currentUser.value?.id ?? "");
  const grantsQuery = useQuery({
    queryKey: computed(() => ["support-access-grants", userId.value]),
    enabled: computed(() => Boolean(userId.value)),
    retry: false,
    queryFn: async ({ signal }) => {
      const response = await apiFetch("/api/v1/support/access-grants", {
        credentials: "include",
        signal,
      });
      return readResponse<AccessGrant[]>(response);
    },
  });

  async function create(input: { companyId: string; venueId?: string; requestId?: string }) {
    const csrf = await identityControllerCsrf({ credentials: "include" }, identity.apiFetch);
    if (csrf.status < 200 || csrf.status >= 300) throw new Error("Не удалось проверить запрос");
    const response = await apiFetch("/api/v1/support/access-grants", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json", "x-csrf-token": csrf.data.token },
      body: JSON.stringify(input),
    });
    const grant = await readResponse<AccessGrant>(response);
    await queryClient.invalidateQueries({ queryKey: ["support-access-grants", userId.value] });
    return grant;
  }

  async function revoke(grantId: string) {
    const csrf = await identityControllerCsrf({ credentials: "include" }, identity.apiFetch);
    if (csrf.status < 200 || csrf.status >= 300) throw new Error("Не удалось проверить запрос");
    const response = await apiFetch(`/api/v1/support/access-grants/${grantId}/revoke`, {
      method: "POST",
      credentials: "include",
      headers: { "x-csrf-token": csrf.data.token },
    });
    await readResponse(response);
    await queryClient.invalidateQueries({ queryKey: ["support-access-grants", userId.value] });
  }

  return { grantsQuery, create, revoke };
}

async function readResponse<T = unknown>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as { detail?: string };
  if (!response.ok) throw new Error(body.detail ?? "Не удалось выполнить запрос");
  return body as T;
}
