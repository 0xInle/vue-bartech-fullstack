import { useQuery, useQueryClient } from "@tanstack/vue-query";
import {
  invitationsControllerCompanyVenueInvitations,
  invitationsControllerCreateVenueManagerInvitation,
  invitationsControllerRevokeVenueManagerInvitation,
} from "@bartech/api-client";
import { useIdentityFlow } from "~/features/identity/composables/useIdentityFlow";
import { requestApi } from "~/utils/api-response";

export type CompanyVenueInvitation = {
  id: string;
  email: string;
  purpose: "CREATE_VENUE_AS_BAR_MANAGER";
  role: "BAR_MANAGER";
  status: "ACTIVE" | "IN_PROGRESS";
  createdAt: string;
  expiresAt: string;
  canRevoke: boolean;
};

export function useCompanyVenueInvitations(companyId: string) {
  const identity = useIdentityFlow();
  const queryClient = useQueryClient();
  const queryKey = ["company-venue-invitations", companyId];
  const invitationsQuery = useQuery({
    queryKey,
    retry: false,
    queryFn: async ({ signal }) => {
      const response = await invitationsControllerCompanyVenueInvitations(
        companyId,
        { credentials: "include", signal },
        identity.apiFetch,
      );
      return requestApi<{ invitations: CompanyVenueInvitation[] }>(Promise.resolve(response));
    },
  });

  async function createInvitation(email: string): Promise<void> {
    await identity.refreshCsrf();
    const response = await invitationsControllerCreateVenueManagerInvitation(
      companyId,
      { email },
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
    const response = await invitationsControllerRevokeVenueManagerInvitation(
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
