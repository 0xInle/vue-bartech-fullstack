import { useQuery, useQueryClient } from "@tanstack/vue-query";
import {
  invitationsControllerCreate,
  invitationsControllerRevoke,
  invitationsControllerTeam,
  teamControllerEndMembership,
  teamControllerUpdateMember,
} from "@bartech/api-client";
import type { TeamControllerUpdateMemberMutationBody } from "@bartech/api-client";
import { useIdentityFlow } from "~/features/identity/composables/useIdentityFlow";
import { requestApi } from "~/utils/api-response";

export type VenueRole = "BARTENDER" | "SENIOR_BARTENDER" | "BARBACK" | "TRAINEE" | "BAR_MANAGER";
export type PermissionCode = TeamControllerUpdateMemberMutationBody["permissions"][number];
export type UpdateTeamMemberInput = Pick<
  TeamControllerUpdateMemberMutationBody,
  "role" | "permissions"
>;
export type TeamMember = {
  id: string;
  fullName: string;
  email: string;
  role: VenueRole;
  terminationDate: string | null;
  permissions: PermissionCode[];
  availableRoles: VenueRole[];
  availablePermissions: PermissionCode[];
  canManagePermissionOverrides: boolean;
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
    await queryClient.invalidateQueries({ queryKey: ["workspace"] });
    await queryClient.invalidateQueries({ queryKey: ["schedule", companyId, venueId] });
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

  async function updateMember(membershipId: string, input: UpdateTeamMemberInput): Promise<void> {
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

  async function endMembership(membershipId: string, terminationDate: string): Promise<void> {
    await identity.refreshCsrf();
    const response = await teamControllerEndMembership(
      companyId,
      venueId,
      membershipId,
      { terminationDate },
      {
        credentials: "include",
        headers: { "x-csrf-token": identity.csrfToken.value },
      },
      identity.apiFetch,
    );
    await requestApi(Promise.resolve(response));
    await queryClient.invalidateQueries({ queryKey });
    await queryClient.invalidateQueries({ queryKey: ["workspace"] });
    await queryClient.invalidateQueries({ queryKey: ["schedule", companyId, venueId] });
  }

  return { teamQuery, createInvitation, revokeInvitation, updateMember, endMembership };
}
