<template>
  <div class="min-h-screen bg-surface-50 text-color lg:flex">
    <aside class="hidden w-64 shrink-0 flex-col border-r border-surface bg-surface-0 p-4 lg:flex">
      <NuxtLink to="/" class="mb-6 text-sm font-bold uppercase tracking-[0.2em] text-primary">
        IndieBar
      </NuxtLink>

      <div class="mb-6">
        <p class="mb-2 text-xs font-medium text-color-secondary">Рабочие пространства</p>
        <Select
          v-if="workspaceOptions.length > 1"
          :model-value="workspaceKey"
          :options="workspaceOptions"
          option-label="label"
          option-value="key"
          size="small"
          class="w-full"
          aria-label="Выбрать заведение"
          @update:model-value="selectWorkspace"
        />
        <div v-else class="rounded-lg border border-surface p-3">
          <p class="truncate text-xs font-semibold uppercase tracking-wide text-primary">
            {{ workspace.venue.name }}
          </p>
          <p class="mt-1 truncate text-xs text-color-secondary">{{ workspace.company.name }}</p>
        </div>
      </div>

      <nav aria-label="Основная навигация" class="flex flex-col gap-1">
        <Button
          v-for="item in navigationItems"
          :key="item.key"
          :label="item.label"
          :icon="item.icon"
          :to="item.to"
          as="router-link"
          severity="secondary"
          variant="text"
          size="small"
          class="w-full justify-start"
          :class="{ 'workspace-nav-active': item.active }"
          :aria-current="item.active ? 'page' : undefined"
        />
      </nav>

      <Button
        label="Помощь"
        icon="pi pi-question-circle"
        :to="supportPath"
        as="router-link"
        severity="secondary"
        variant="text"
        size="small"
        class="mt-2 w-full justify-start"
      />

      <div class="mt-auto border-t border-surface pt-4">
        <p class="truncate px-3 text-sm font-medium">{{ fullName }}</p>
        <Button
          :to="profilePath"
          as="router-link"
          label="Профиль"
          icon="pi pi-user"
          severity="secondary"
          variant="text"
          size="small"
          class="mt-2 w-full justify-start"
          :class="{ 'workspace-nav-active': isProfile }"
          :aria-current="isProfile ? 'page' : undefined"
        />
      </div>
    </aside>

    <div class="fixed inset-x-0 top-0 z-10 border-b border-surface bg-surface-0 p-3 lg:hidden">
      <div class="mb-2">
        <NuxtLink to="/" class="text-sm font-bold uppercase tracking-[0.2em] text-primary">
          IndieBar
        </NuxtLink>
      </div>
      <Select
        v-if="workspaceOptions.length > 1"
        :model-value="workspaceKey"
        :options="workspaceOptions"
        option-label="label"
        option-value="key"
        size="small"
        class="w-full"
        aria-label="Выбрать заведение"
        @update:model-value="selectWorkspace"
      />
      <div v-else class="text-sm">
        <span class="font-medium">{{ workspace.venue.name }}</span>
        <span class="text-color-secondary"> · {{ workspace.company.name }}</span>
      </div>
    </div>

    <main class="min-w-0 flex-1 px-4 pb-24 pt-28 sm:px-6 lg:px-8 lg:pb-8 lg:pt-8">
      <CompanyClosureBanner :company-id="workspace.company.id" />
      <slot />
    </main>

    <nav
      aria-label="Мобильная навигация"
      class="fixed inset-x-0 bottom-0 z-10 flex border-t border-surface bg-surface-0 p-1 lg:hidden"
    >
      <Button
        v-for="item in navigationItems"
        :key="item.key"
        :label="item.mobileLabel"
        :icon="item.icon"
        icon-pos="top"
        :to="item.to"
        as="router-link"
        severity="secondary"
        variant="text"
        size="small"
        class="min-w-0 flex-1 flex-col gap-1 px-1 text-xs"
        :class="{ 'workspace-nav-active': item.active }"
        :aria-current="item.active ? 'page' : undefined"
      />
      <Button
        label="Помощь"
        icon="pi pi-question-circle"
        icon-pos="top"
        :to="supportPath"
        as="router-link"
        severity="secondary"
        variant="text"
        size="small"
        class="min-w-0 flex-1 flex-col gap-1 px-1 text-xs"
      />
      <Button
        :label="'Профиль'"
        icon="pi pi-user"
        icon-pos="top"
        :to="profilePath"
        as="router-link"
        severity="secondary"
        variant="text"
        size="small"
        class="min-w-0 flex-1 flex-col gap-1 px-1 text-xs"
        :class="{ 'workspace-nav-active': isProfile }"
        :aria-current="isProfile ? 'page' : undefined"
      />
    </nav>
  </div>
</template>

<script setup lang="ts">
import type { Workspace } from "~/types/user-workspaces";
import CompanyClosureBanner from "~/features/organizations/components/CompanyClosureBanner.vue";

defineOptions({ name: "WorkspaceShell" });

const props = defineProps<{
  workspace: Workspace;
  workplaces: Workspace[];
  fullName: string;
}>();
const emit = defineEmits<{ switch: [workspace: Workspace] }>();
const route = useRoute();

const workspaceKey = computed(() => `${props.workspace.company.id}:${props.workspace.venue.id}`);
const workspaceOptions = computed(() =>
  props.workplaces.map((item) => ({
    ...item,
    key: `${item.company.id}:${item.venue.id}`,
    label: `${item.company.name} · ${item.venue.name}`,
  })),
);
const homePath = computed(
  () => `/app/companies/${props.workspace.company.id}/venues/${props.workspace.venue.id}`,
);
const profilePath = computed(() => `${homePath.value}/profile`);
const supportPath = computed(
  () => `/app/support?companyId=${props.workspace.company.id}&venueId=${props.workspace.venue.id}`,
);
const teamPath = computed(() => `${homePath.value}/team`);
const cocktailsPath = computed(() => `${homePath.value}/cocktails`);
const preparationsPath = computed(() => `${homePath.value}/preparations`);
const garnishesPath = computed(() => `${homePath.value}/garnishes`);
const archivePath = computed(() => `${homePath.value}/archive`);
const historyPath = computed(() => `${homePath.value}/history`);
const exportsPath = computed(() => `${homePath.value}/exports`);
const companyChefPath = computed(() => `${homePath.value}/chefs`);
const newVenuePath = computed(() => `${homePath.value}/new-venue`);
const isHome = computed(() => route.path === homePath.value);
const isProfile = computed(() => route.path === profilePath.value);
const isTeam = computed(() => route.path === teamPath.value);
const isCocktails = computed(
  () => route.path === cocktailsPath.value || route.path.startsWith(`${cocktailsPath.value}/`),
);
const isPreparations = computed(
  () =>
    route.path === preparationsPath.value || route.path.startsWith(`${preparationsPath.value}/`),
);
const isGarnishes = computed(
  () => route.path === garnishesPath.value || route.path.startsWith(`${garnishesPath.value}/`),
);
const isCompanyChefs = computed(() => route.path === companyChefPath.value);
const isNewVenue = computed(() => route.path === newVenuePath.value);
const navigationItems = computed(() => {
  const items = [
    {
      key: "home",
      label: "Главная",
      mobileLabel: "Главная",
      icon: "pi pi-home",
      to: homePath.value,
      active: isHome.value,
    },
  ];

  if (props.workspace.permissions.includes("view_products")) {
    items.push({
      key: "cocktails",
      label: "Коктейли",
      mobileLabel: "Коктейли",
      icon: "pi pi-book",
      to: cocktailsPath.value,
      active: isCocktails.value,
    });
    items.push({
      key: "preparations",
      label: "Заготовки",
      mobileLabel: "Заготовки",
      icon: "pi pi-box",
      to: preparationsPath.value,
      active: isPreparations.value,
    });
    items.push({
      key: "garnishes",
      label: "Гарниры",
      mobileLabel: "Гарниры",
      icon: "pi pi-sparkles",
      to: garnishesPath.value,
      active: isGarnishes.value,
    });
  }

  if (props.workspace.permissions.includes("view_archive")) {
    items.push({
      key: "archive",
      label: "Архив",
      mobileLabel: "Архив",
      icon: "pi pi-inbox",
      to: archivePath.value,
      active: route.path === archivePath.value || route.path.startsWith(`${archivePath.value}/`),
    });
  }

  if (props.workspace.permissions.includes("export_data")) {
    items.push({
      key: "exports",
      label: "Выгрузка данных",
      mobileLabel: "Выгрузка",
      icon: "pi pi-download",
      to: exportsPath.value,
      active: route.path === exportsPath.value || route.path.startsWith(`${exportsPath.value}/`),
    });
  }

  if (props.workspace.permissions.includes("view_team")) {
    items.push({
      key: "team",
      label: "Команда",
      mobileLabel: "Команда",
      icon: "pi pi-users",
      to: teamPath.value,
      active: isTeam.value,
    });
  }

  if (
    props.workspace.permissions.includes("view_history") ||
    props.workspace.permissions.includes("view_products")
  ) {
    items.push({
      key: "history",
      label: "История",
      mobileLabel: "История",
      icon: "pi pi-history",
      to: historyPath.value,
      active: route.path === historyPath.value,
    });
  }

  if (props.workspace.permissions.includes("invite_chef_bartender")) {
    items.push(
      {
        key: "chefs",
        label: "Шеф-бармены компании",
        mobileLabel: "Шеф-бармены",
        icon: "pi pi-briefcase",
        to: companyChefPath.value,
        active: isCompanyChefs.value,
      },
      {
        key: "new-venue",
        label: "Новое заведение",
        mobileLabel: "Новое заведение",
        icon: "pi pi-plus-circle",
        to: newVenuePath.value,
        active: isNewVenue.value,
      },
    );
  }

  return items;
});

function selectWorkspace(key: string): void {
  const selected = props.workplaces.find((item) => `${item.company.id}:${item.venue.id}` === key);
  if (selected) emit("switch", selected);
}
</script>

<style scoped>
:deep(.p-button.workspace-nav-active) {
  color: var(--p-primary-color);
  background: var(--p-primary-50);
}

:deep(.p-button.workspace-nav-active:hover) {
  background: var(--p-primary-100);
}
</style>
