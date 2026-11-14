import { useQueryClient } from "@tanstack/vue-query";
import { organizationsControllerLeaveCompany } from "@bartech/api-client";
import { useIdentityFlow } from "~/features/identity/composables/useIdentityFlow";
import { requestApi } from "~/utils/api-response";

export function useCompanyExit() {
  const identity = useIdentityFlow();
  const queryClient = useQueryClient();

  async function leaveCompany(companyId: string, confirmationName: string): Promise<void> {
    if (!identity.csrfToken.value) await identity.refreshCsrf();
    await requestApi(
      organizationsControllerLeaveCompany(
        companyId,
        { confirmationName },
        identity.mutationOptions(),
        identity.apiFetch,
      ),
    );
    await identity.loadSession();
    await queryClient.invalidateQueries();
    await navigateTo("/");
  }

  return { leaveCompany };
}
