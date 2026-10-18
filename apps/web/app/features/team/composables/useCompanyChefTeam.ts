import { useQuery, useQueryClient } from "@tanstack/vue-query";
import {
  invitationsControllerCompanyChefTeam,
  invitationsControllerCreateChefInvitation,
  invitationsControllerRevokeChefInvitation,
} from "@bartech/api-client";
import { useIdentityFlow } from "~/features/identity/composables/useIdentityFlow";
import { requestApi } from "~/utils/api-response";

export type CompanyChefMember = { id: string; fullName: string; email: string };
export type CompanyChefInvitation = {
  id: string;
  email: string;
  status: "ACTIVE" | "IN_PROGRESS";
  createdAt: string;
  expiresAt: string;
};

export function useCompanyChefTeam(companyId: string, enabled = true) {
  const identity = useIdentityFlow();
  const queryClient = useQueryClient();
  const queryKey = ["company-chef-team", companyId];
  const teamQuery = useQuery({
    queryKey,
    retry: false,
    enabled,
    queryFn: async ({ signal }) => {
      const response = await invitationsControllerCompanyChefTeam(
        companyId,
        { credentials: "include", signal },
        identity.apiFetch,
      );
      return requestApi<{ members: CompanyChefMember[]; invitations: CompanyChefInvitation[] }>(
        Promise.resolve(response),
      );
    },
  });

  async function createInvitation(email: string): Promise<void> {
    await identity.refreshCsrf();
    const response = await invitationsControllerCreateChefInvitation(
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
    const response = await invitationsControllerRevokeChefInvitation(
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

  return { teamQuery, createInvitation, revokeInvitation };
}
