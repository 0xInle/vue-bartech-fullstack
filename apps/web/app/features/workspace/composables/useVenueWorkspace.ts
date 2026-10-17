import { useQuery } from "@tanstack/vue-query";
import { organizationsControllerGetWorkspace } from "@bartech/api-client";
import { useIdentityFlow } from "~/features/identity/composables/useIdentityFlow";
import type { CurrentUser, Workspace } from "~/types/user-workspaces";
import { requestApi } from "~/utils/api-response";

export function useVenueWorkspace() {
  const route = useRoute();
  const identity = useIdentityFlow();
  const companyId = computed(() => String(route.params.companyId ?? ""));
  const venueId = computed(() => String(route.params.venueId ?? ""));
  const workspaceQuery = useQuery({
    queryKey: computed(() => ["workspace", companyId.value, venueId.value]),
    enabled: computed(() => identity.sessionState.value === "authenticated"),
    retry: false,
    queryFn: async ({ signal }) => {
      const response = await organizationsControllerGetWorkspace(
        companyId.value,
        venueId.value,
        {
          credentials: "include",
          signal,
        },
        identity.apiFetch,
      );
      if (response.status === 404) {
        throw new Error("У вас нет доступа или рабочее пространство больше не существует.");
      }
      return requestApi<Workspace>(Promise.resolve(response));
    },
  });

  onMounted(async () => {
    if (identity.sessionState.value === "authenticated") return;

    await Promise.allSettled([identity.refreshCsrf()]);
    await identity.loadSession();
    if (identity.sessionState.value === "unauthenticated") await navigateTo("/");
  });

  const currentUser = computed(() => identity.currentUser.value as CurrentUser | null);
  const workspace = computed(() => workspaceQuery.data.value ?? null);
  const errorMessage = computed(() => {
    if (identity.sessionState.value === "error") return identity.sessionErrorMessage.value;
    return workspaceQuery.error.value instanceof Error ? workspaceQuery.error.value.message : "";
  });
  const loading = computed(
    () =>
      identity.sessionState.value === "idle" ||
      identity.sessionState.value === "loading" ||
      workspaceQuery.isLoading.value,
  );

  async function switchWorkspace(selected: Workspace): Promise<void> {
    await navigateTo(`/app/companies/${selected.company.id}/venues/${selected.venue.id}`);
  }

  return {
    currentUser,
    errorMessage,
    identity,
    loading,
    switchWorkspace,
    workspace,
    workplaces: computed(() => currentUser.value?.workplaces ?? []),
  };
}
