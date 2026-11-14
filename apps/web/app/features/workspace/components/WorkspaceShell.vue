<template>
  <div class="min-h-screen bg-surface-50 text-color lg:flex">
    <aside
      class="hidden w-[16rem] shrink-0 flex-col border-r border-surface bg-surface-0 p-4 lg:flex"
      style="border-color: var(--p-content-border-color)"
    >
      <div class="mb-6 flex items-center justify-between">
        <NuxtLink
          to="/"
          class="text-sm font-bold uppercase tracking-[0.2em]"
          style="color: var(--p-button-text-primary-color)"
        >
          IndieBar
        </NuxtLink>
      </div>
      <PanelMenu
        v-model:expanded-keys="expandedKeys"
        :model="menuItems"
        class="workspace-panel-menu w-full flex-1"
      />
      <div
        class="mt-auto border-t border-surface pt-4"
        style="border-color: var(--p-content-border-color)"
      >
        <WorkspaceIdentity
          :workspace="workspace"
          :workplaces="workplaces"
          :full-name="fullName"
          :show-full-name="false"
          class="mb-2"
          @switch="switchWorkspace"
        />
        <p class="truncate px-3 text-center text-xs text-color-secondary">
          {{ fullName }}
        </p>
        <WorkspaceActionBar @open-profile="profileVisible = true" />
      </div>
    </aside>

    <div
      class="fixed inset-x-0 top-0 z-10 border-b border-surface bg-surface-0 p-3 lg:hidden"
      style="border-color: var(--p-content-border-color)"
    >
      <div class="mb-2 flex items-center justify-between">
        <NuxtLink
          to="/"
          class="text-sm font-bold uppercase tracking-[0.2em]"
          style="color: var(--p-button-text-primary-color)"
        >
          IndieBar
        </NuxtLink>
      </div>
      <WorkspaceIdentity
        :workspace="workspace"
        :workplaces="workplaces"
        :full-name="fullName"
        @switch="switchWorkspace"
      />
    </div>

    <main
      class="min-w-0 flex-1 px-4 pb-24 pt-28 sm:px-6 lg:px-8 lg:pb-8 lg:pt-4"
      :class="isSchedulePage ? 'flex h-dvh min-h-0 flex-col overflow-hidden' : ''"
    >
      <div v-if="!isHome" class="mb-5 flex shrink-0 justify-end xl:hidden">
        <WorkspaceProductSearch :workspace="workspace" mode="trigger" />
      </div>
      <CompanyClosureBanner :company-id="workspace.company.id" />
      <div v-if="isSchedulePage" class="flex min-h-0 min-w-0 flex-1 flex-col">
        <slot />
      </div>
      <slot v-else />
    </main>

    <WorkspaceProductDrawer :workspace="workspace" />
    <nav
      aria-label="Мобильная навигация"
      class="fixed inset-x-0 bottom-0 z-10 flex border-t border-surface bg-surface-0 p-1 lg:hidden"
      style="border-color: var(--p-content-border-color)"
    >
      <Button
        v-for="item in mobileQuickItems"
        :key="item.key"
        :label="item.label"
        :to="item.to"
        as="router-link"
        severity="secondary"
        variant="text"
        size="small"
        class="min-w-0 flex-1 px-1 text-xs"
        :class="{ 'workspace-nav-active': item.active }"
        :aria-current="item.active ? 'page' : undefined"
      />
      <Button
        label="Ещё"
        severity="secondary"
        variant="text"
        size="small"
        class="min-w-0 flex-1 px-1 text-xs"
        :class="{ 'workspace-nav-active': isMoreActive }"
        @click="moreVisible = true"
      />
    </nav>

    <Drawer
      v-model:visible="moreVisible"
      dismissable
      header="Разделы"
      position="right"
      class="drawer-size-sm"
      :pt="{ pcCloseButton: { root: { class: '!rounded-md' } } }"
    >
      <WorkspaceIdentity
        :workspace="workspace"
        :workplaces="workplaces"
        :full-name="fullName"
        :show-full-name="false"
        class="mb-6 border-b border-surface pb-4"
        style="border-color: var(--p-content-border-color)"
        @switch="switchWorkspace"
      />
      <PanelMenu
        v-model:expanded-keys="expandedKeys"
        :model="moreMenuItems"
        class="workspace-panel-menu w-full"
      />
      <div
        class="mt-6 border-t border-surface pt-4"
        style="border-color: var(--p-content-border-color)"
      >
        <p class="truncate px-3 text-center text-xs text-color-secondary">
          {{ fullName }}
        </p>
        <WorkspaceActionBar @open-profile="openProfile" @open-docs="moreVisible = false" />
      </div>
    </Drawer>
    <AccountProfileDrawer v-model:visible="profileVisible" />
  </div>
</template>

<script setup lang="ts">
import type { MenuItem } from "primevue/menuitem";
import type { Workspace } from "~/types/user-workspaces";
import CompanyClosureBanner from "~/features/organizations/components/CompanyClosureBanner.vue";
import WorkspaceIdentity from "./WorkspaceIdentity.vue";
import WorkspaceProductSearch from "~/features/products/components/WorkspaceProductSearch.vue";
import WorkspaceProductDrawer from "~/components/WorkspaceProductDrawer.vue";
import WorkspaceActionBar from "./WorkspaceActionBar.vue";
import AccountProfileDrawer from "~/features/identity/components/AccountProfileDrawer.vue";

defineOptions({ name: "WorkspaceShell" });

const props = defineProps<{ workspace: Workspace; workplaces: Workspace[]; fullName: string }>();
const emit = defineEmits<{ switch: [workspace: Workspace] }>();
const route = useRoute();
const moreVisible = ref(false);
const expandedKeys = ref<Record<string, boolean>>({ catalog: true, team: true });

const homePath = computed(
  () => `/app/companies/${props.workspace.company.id}/venues/${props.workspace.venue.id}`,
);
const supportPath = computed(
  () => `/app/support?companyId=${props.workspace.company.id}&venueId=${props.workspace.venue.id}`,
);
const paths = computed(() => ({
  archive: `${homePath.value}/archive`,
  cocktails: `${homePath.value}/cocktails`,
  ingredients: `${homePath.value}/ingredients`,
  garnishes: `${homePath.value}/garnishes`,
  history: `${homePath.value}/history`,
  preparations: `${homePath.value}/preparations`,
  schedule: `${homePath.value}/schedule`,
  teamManagement: `${homePath.value}/team/management`,
  exports: `${homePath.value}/exports`,
}));
const isHome = computed(() => route.path === homePath.value);
const isSchedulePage = computed(() => route.path === paths.value.schedule);
const profileVisible = ref(false);

function isPathActive(path: string): boolean {
  return route.path === path || route.path.startsWith(`${path}/`);
}

function linkItem(label: string, to: string, active: boolean): MenuItem {
  return {
    label,
    class: active ? "workspace-menu-item-active" : undefined,
    command: () => {
      moreVisible.value = false;
      return navigateTo(to);
    },
  };
}

const menuItems = computed<MenuItem[]>(() => {
  const items: MenuItem[] = [linkItem("Главная", homePath.value, isHome.value)];
  const teamItems: MenuItem[] = [];
  if (props.workspace.permissions.includes("manage_team")) {
    teamItems.push(
      linkItem(
        "Управление командой",
        paths.value.teamManagement,
        isPathActive(paths.value.teamManagement),
      ),
    );
  }
  if (props.workspace.permissions.includes("view_team")) {
    teamItems.push(
      linkItem("График работы", paths.value.schedule, route.path === paths.value.schedule),
    );
  }
  if (teamItems.length) {
    items.push({ key: "team", label: "Команда", items: teamItems });
  }
  if (props.workspace.permissions.includes("view_products")) {
    items.push({
      key: "catalog",
      label: "Каталог",
      items: [
        linkItem("Коктейли", paths.value.cocktails, isPathActive(paths.value.cocktails)),
        linkItem("Заготовки", paths.value.preparations, isPathActive(paths.value.preparations)),
        linkItem("Гарниры", paths.value.garnishes, isPathActive(paths.value.garnishes)),
        linkItem("Ингредиенты", paths.value.ingredients, isPathActive(paths.value.ingredients)),
      ],
    });
  }
  const managementItems: MenuItem[] = [];
  if (props.workspace.permissions.includes("view_archive")) {
    managementItems.push(linkItem("Архив", paths.value.archive, isPathActive(paths.value.archive)));
  }
  if (props.workspace.permissions.includes("export_data")) {
    managementItems.push(
      linkItem("Выгрузка", paths.value.exports, isPathActive(paths.value.exports)),
    );
  }
  if (
    props.workspace.permissions.includes("view_history") ||
    props.workspace.permissions.includes("view_products")
  ) {
    managementItems.push(
      linkItem("История", paths.value.history, isPathActive(paths.value.history)),
    );
  }
  if (managementItems.length) {
    items.push({ key: "management", label: "Управление", items: managementItems });
  }
  items.push(linkItem("Техподдержка", supportPath.value, route.path.startsWith("/app/support")));
  return items;
});
const moreMenuItems = computed(() => menuItems.value.filter((item) => item.label !== "Главная"));
const mobileQuickItems = computed(() =>
  menuItems.value
    .flatMap((item) => item.items ?? [item])
    .filter(
      (item) =>
        typeof item.label === "string" &&
        ["Главная", "Коктейли", "Заготовки", "Гарниры"].includes(item.label),
    )
    .map((item) => {
      const { to, label } = getMenuLink(typeof item.label === "string" ? item.label : "");
      return { key: label, label, to, active: isPathActive(to) };
    }),
);
const isMoreActive = computed(() => mobileQuickItems.value.every((item) => !item.active));

function switchWorkspace(workspace: Workspace): void {
  moreVisible.value = false;
  emit("switch", workspace);
}

function openProfile(): void {
  moreVisible.value = false;
  profileVisible.value = true;
}

function getMenuLink(label: string): { label: string; to: string } {
  const links: Record<string, string> = {
    Главная: homePath.value,
    Коктейли: paths.value.cocktails,
    Заготовки: paths.value.preparations,
    Гарниры: paths.value.garnishes,
  };
  return { label, to: links[label] ?? homePath.value };
}
</script>

<style scoped>
:deep(.workspace-panel-menu .p-panelmenu-item-link) {
  color: var(--p-text-color-secondary);
  padding: 0.35rem 0.75rem;
  font-size: 0.875rem;
  font-weight: 400;
  line-height: 1.25rem;
}

:deep(.workspace-panel-menu .p-panelmenu-header-link) {
  display: flex;
  padding: 0.4rem 0.75rem;
  font-size: 0.875rem;
  font-weight: 400;
  line-height: 1.25rem;
}

:deep(.workspace-panel-menu .p-panelmenu-submenu-icon) {
  order: 1;
  margin-left: auto;
  width: 0.75rem;
  height: 0.75rem;
}

:deep(.workspace-panel-menu .workspace-menu-item-active .p-panelmenu-item-link) {
  color: var(--p-navigation-item-active-color);
  background: var(--p-navigation-item-active-background);
}

:deep(.workspace-panel-menu .workspace-menu-item-active .p-panelmenu-item-link:hover) {
  color: var(--p-navigation-item-focus-color);
  background: var(--p-navigation-item-focus-background);
}

:deep(.p-button.workspace-nav-active) {
  color: var(--p-navigation-item-active-color);
  background: var(--p-navigation-item-active-background);
}

:deep(.p-button.workspace-nav-active:hover) {
  color: var(--p-navigation-item-focus-color);
  background: var(--p-navigation-item-focus-background);
}
</style>
