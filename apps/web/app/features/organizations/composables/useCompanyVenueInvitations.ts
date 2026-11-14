import { useQuery, useQueryClient } from "@tanstack/vue-query";
import {
  invitationsControllerCompanyVenueInvitations,
  invitationsControllerCreateNewVenueInvitation,
  invitationsControllerRevokeNewVenueInvitation,
} from "@bartech/api-client";
import { useIdentityFlow } from "~/features/identity/composables/useIdentityFlow";
import { requestApi } from "~/utils/api-response";

export type CompanyVenueInvitation = {
  id: string;
  email: string;
  purpose: "CREATE_VENUE";
  role: NewVenueInviteRole;
  status: "ACTIVE" | "IN_PROGRESS";
  createdAt: string;
  expiresAt: string;
  canRevoke: boolean;
};

export type NewVenueInviteRole = "BAR_MANAGER" | "SENIOR_BARTENDER" | "BARTENDER";

export function useCompanyVenueInvitations(companyId: string, enabled = true) {
  const identity = useIdentityFlow();
  const queryClient = useQueryClient();
  const queryKey = ["company-venue-invitations", companyId];
  const invitationsQuery = useQuery({
    queryKey,
    retry: false,
    enabled,
    queryFn: async ({ signal }) => {
      const response = await invitationsControllerCompanyVenueInvitations(
        companyId,
        { credentials: "include", signal },
        identity.apiFetch,
      );
      return requestApi<{ invitations: CompanyVenueInvitation[] }>(Promise.resolve(response));
    },
  });

  async function createInvitation(
    email: string,
    role: NewVenueInviteRole = "BAR_MANAGER",
  ): Promise<void> {
    await identity.refreshCsrf();
    const response = await invitationsControllerCreateNewVenueInvitation(
      companyId,
      { email, role },
      {
        credentials: "include",
        headers: { "x-csrf-token": identity.csrfToken.value },
      },
      identity.apiFetch,
    );
    await requestApi(Promise.resolve(response));
    await queryClient.invalidateQueries({ queryKey });
  }

  async function revokeInvitation(invitationId: string): Promise<void> {
    await identity.refreshCsrf();
    const response = await invitationsControllerRevokeNewVenueInvitation(
      companyId,
      { invitationId },
      {
        credentials: "include",
        headers: { "x-csrf-token": identity.csrfToken.value },
      },
      identity.apiFetch,
    );
    await requestApi(Promise.resolve(response));
    await queryClient.invalidateQueries({ queryKey });
  }

  return { invitationsQuery, createInvitation, revokeInvitation };
}
