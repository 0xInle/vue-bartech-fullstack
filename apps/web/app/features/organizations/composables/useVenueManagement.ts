import { organizationsControllerCreateVenue } from "@bartech/api-client";
import { useIdentityFlow } from "~/features/identity/composables/useIdentityFlow";
import type { Workspace } from "~/types/user-workspaces";
import { requestApi } from "~/utils/api-response";

export function useVenueManagement(companyId: string) {
  const identity = useIdentityFlow();
  const managedWorkspaces = computed(() =>
    (identity.currentUser.value?.workplaces ?? []).filter(
      (workspace: Workspace) =>
        workspace.company.id === companyId &&
        ["manage_venue", "manage_venues"].some((permission) =>
          workspace.permissions.includes(permission),
        ),
    ),
  );
  const canCreateVenue = computed(() =>
    (identity.currentUser.value?.workplaces ?? []).some(
      (workspace: Workspace) =>
        workspace.company.id === companyId && workspace.permissions.includes("create_venues"),
    ),
  );
  const canInviteManager = computed(() =>
    (identity.currentUser.value?.workplaces ?? []).some(
      (workspace: Workspace) =>
        workspace.company.id === companyId && workspace.permissions.includes("invite_bar_manager"),
    ),
  );

  async function createVenue(venueName: string) {
    if (!identity.csrfToken.value) await identity.refreshCsrf();
    return requestApi(
      organizationsControllerCreateVenue(
        companyId,
        { venueName },
        identity.mutationOptions(),
        identity.apiFetch,
      ),
    );
  }

  return { canCreateVenue, canInviteManager, createVenue, managedWorkspaces };
}
