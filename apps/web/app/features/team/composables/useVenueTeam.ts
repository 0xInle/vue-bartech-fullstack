import { useQuery, useQueryClient } from "@tanstack/vue-query";
import {
  invitationsControllerCreate,
  invitationsControllerRevoke,
  invitationsControllerTeam,
  teamControllerUpdateMember,
} from "@bartech/api-client";
import { useIdentityFlow } from "~/features/identity/composables/useIdentityFlow";
import { requestApi } from "~/utils/api-response";

export type VenueRole = "BARTENDER" | "SENIOR_BARTENDER" | "BAR_MANAGER";
export type TeamMember = {
  id: string;
  fullName: string;
  email: string;
  role: VenueRole;
  delegatedPermissions: string[];
  availableRoles: VenueRole[];
  availableDelegatedPermissions: string[];
  canManageDelegatedPermissions: boolean;
  isCurrentUser: boolean;
};
export type VenueInvitation = {
  id: string;
  email: string;
  role: VenueRole;
  status: "ACTIVE" | "IN_PROGRESS";
  createdAt: string;
  expiresAt: string;
  canRevoke: boolean;
};

export function useVenueTeam(companyId: string, venueId: string) {
  const identity = useIdentityFlow();
  const queryClient = useQueryClient();
  const queryKey = ["venue-team", companyId, venueId];
  const teamQuery = useQuery({
    queryKey,
    retry: false,
    queryFn: async ({ signal }) => {
      const response = await invitationsControllerTeam(
        companyId,
        venueId,
        { credentials: "include", signal },
        identity.apiFetch,
      );
      return requestApi<{ members: TeamMember[]; invitations: VenueInvitation[] }>(
        Promise.resolve(response),
      );
    },
  });

  async function createInvitation(email: string, role: VenueRole): Promise<void> {
    await identity.refreshCsrf();
    const response = await invitationsControllerCreate(
      companyId,
      venueId,
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
    const response = await invitationsControllerRevoke(
      companyId,
      venueId,
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

  async function updateMember(
    membershipId: string,
    input: Pick<TeamMember, "role" | "delegatedPermissions">,
  ): Promise<void> {
    await identity.refreshCsrf();
    const response = await teamControllerUpdateMember(
      companyId,
      venueId,
      membershipId,
      input,
      {
        credentials: "include",
        headers: { "x-csrf-token": identity.csrfToken.value },
      },
      identity.apiFetch,
    );
    await requestApi(Promise.resolve(response));
    await queryClient.invalidateQueries({ queryKey });
  }

  return { teamQuery, createInvitation, revokeInvitation, updateMember };
}
