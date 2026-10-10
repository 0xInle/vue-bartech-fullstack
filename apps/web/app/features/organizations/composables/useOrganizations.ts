import type { CurrentUser, Workspace } from "~/types/user-workspaces";

export function useOrganizations(currentUser: Ref<CurrentUser | null>) {
  const workplaces = computed<Workspace[]>(() => currentUser.value?.workplaces ?? []);

  async function openFirstWorkplace(): Promise<void> {
    const workplace = workplaces.value[0];
    if (workplace) {
      await navigateTo(`/app/companies/${workplace.company.id}/venues/${workplace.venue.id}`);
    }
  }

  return { workplaces, openFirstWorkplace };
}
