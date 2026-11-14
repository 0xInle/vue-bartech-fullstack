import type { CurrentUser, Workspace } from "~/types/user-workspaces";
import { organizationsControllerCreate } from "@bartech/api-client";
import { requestApi } from "~/utils/api-response";

type InitialRole = "CHEF_BARTENDER" | "BAR_MANAGER" | "SENIOR_BARTENDER" | "BARTENDER";

export function useOrganizations(
  currentUser: Ref<CurrentUser | null>,
  mutationOptions: () => RequestInit,
  apiFetch: typeof globalThis.fetch,
) {
  const workplaces = computed<Workspace[]>(() => currentUser.value?.workplaces ?? []);
  const companies = computed(() => currentUser.value?.companies ?? []);

  async function createCompany(input: {
    companyName: string;
    venueName: string;
    initialRole: InitialRole;
  }): Promise<string> {
    const result = await requestApi<{ redirectTo: string }>(
      organizationsControllerCreate(input, mutationOptions(), apiFetch),
    );
    return result.redirectTo;
  }

  return { companies, workplaces, createCompany };
}
