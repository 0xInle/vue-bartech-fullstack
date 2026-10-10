import type { CurrentUser, Workspace } from "~/types/user-workspaces";

export function useOrganizations(currentUser: Ref<CurrentUser | null>) {
  const workplaces = computed<Workspace[]>(() => currentUser.value?.workplaces ?? []);
  const companies = computed(() => currentUser.value?.companies ?? []);

  async function openFirstWorkplace(): Promise<void> {
    const workplace = workplaces.value[0];
    if (workplace) {
      await navigateTo(`/app/companies/${workplace.company.id}/venues/${workplace.venue.id}`);
      return;
    }
    const company = companies.value[0];
    if (company) await navigateTo(`/app/companies/${company.id}`);
  }

  return { companies, workplaces, openFirstWorkplace };
}
