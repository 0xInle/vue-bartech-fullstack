<template>
  <div class="min-h-screen bg-surface-50 text-color lg:flex">
    <aside
      class="hidden w-72 shrink-0 flex-col border-r border-surface bg-surface-0 p-4 lg:flex"
      style="border-color: var(--p-content-border-color)"
    >
      <NuxtLink
        to="/"
        class="mb-6 text-sm font-bold uppercase tracking-[0.2em]"
        style="color: var(--p-button-text-primary-color)"
      >
        IndieBar
      </NuxtLink>
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
          @switch="emit('switch', $event)"
        />
        <p class="truncate px-3 text-center text-xs text-color-secondary">
          {{ fullName }}
        </p>
        <div class="mt-2 flex justify-center">
          <Button
            :to="profilePath"
            as="router-link"
            label="Профиль"
            severity="primary"
            variant="text"
            size="small"
            class="w-fit justify-center"
            :aria-current="isProfile ? 'page' : undefined"
          />
        </div>
      </div>
    </aside>

    <div
      class="fixed inset-x-0 top-0 z-10 border-b border-surface bg-surface-0 p-3 lg:hidden"
      style="border-color: var(--p-content-border-color)"
    >
      <div class="mb-2">
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
        @switch="emit('switch', $event)"
      />
    </div>

    <main class="min-w-0 flex-1 px-4 pb-24 pt-28 sm:px-6 lg:px-8 lg:pb-8 lg:pt-4">
      <div v-if="!isHome" class="mb-5 flex justify-end xl:hidden">
        <WorkspaceProductSearch :workspace="workspace" mode="trigger" />
      </div>
      <CompanyClosureBanner :company-id="workspace.company.id" />
      <slot />
    </main>

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

    <Drawer v-model:visible="moreVisible" header="Разделы" position="right" class="w-full sm:!w-96">
      <WorkspaceIdentity
        :workspace="workspace"
        :workplaces="workplaces"
        :full-name="fullName"
        :show-full-name="false"
        class="mb-6 border-b border-surface pb-4"
        style="border-color: var(--p-content-border-color)"
        @switch="emit('switch', $event)"
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
        <div class="mt-2 flex justify-center">
          <Button
            :to="profilePath"
            as="router-link"
            label="Профиль"
            severity="primary"
            variant="text"
            size="small"
            class="w-fit justify-center"
            @click="moreVisible = false"
          />
        </div>
      </div>
    </Drawer>
  </div>
</template>

<script setup lang="ts">
import type { MenuItem } from "primevue/menuitem";
import type { Workspace } from "~/types/user-workspaces";
import CompanyClosureBanner from "~/features/organizations/components/CompanyClosureBanner.vue";
import WorkspaceIdentity from "./WorkspaceIdentity.vue";
import WorkspaceProductSearch from "~/features/products/components/WorkspaceProductSearch.vue";

defineOptions({ name: "WorkspaceShell" });

const props = defineProps<{ workspace: Workspace; workplaces: Workspace[]; fullName: string }>();
const emit = defineEmits<{ switch: [workspace: Workspace] }>();
const route = useRoute();
const moreVisible = ref(false);
const expandedKeys = ref<Record<string, boolean>>({ catalog: true, management: true });

const homePath = computed(
  () => `/app/companies/${props.workspace.company.id}/venues/${props.workspace.venue.id}`,
);
const profilePath = computed(() => `${homePath.value}/profile`);
const supportPath = computed(
  () => `/app/support?companyId=${props.workspace.company.id}&venueId=${props.workspace.venue.id}`,
);
const paths = computed(() => ({
  archive: `${homePath.value}/archive`,
  cocktails: `${homePath.value}/cocktails`,
  garnishes: `${homePath.value}/garnishes`,
  history: `${homePath.value}/history`,
  management: `${homePath.value}/management`,
  preparations: `${homePath.value}/preparations`,
  team: `${homePath.value}/team`,
  exports: `${homePath.value}/exports`,
}));
const isHome = computed(() => route.path === homePath.value);
const isProfile = computed(() => route.path === profilePath.value);

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
  if (props.workspace.permissions.includes("view_team")) {
    items.push(linkItem("Команда", paths.value.team, isPathActive(paths.value.team)));
  }
  if (props.workspace.permissions.includes("view_products")) {
    items.push({
      key: "catalog",
      label: "Каталог",
      items: [
        linkItem("Коктейли", paths.value.cocktails, isPathActive(paths.value.cocktails)),
        linkItem("Заготовки", paths.value.preparations, isPathActive(paths.value.preparations)),
        linkItem("Гарниры", paths.value.garnishes, isPathActive(paths.value.garnishes)),
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
  const canManageCompanyVenues = props.workplaces.some(
    (workspace) =>
      workspace.company.id === props.workspace.company.id &&
      ["create_venues", "manage_venue", "manage_venues"].some((permission) =>
        workspace.permissions.includes(permission),
      ),
  );
  if (canManageCompanyVenues) {
    managementItems.push(
      linkItem("Заведения", paths.value.management, isPathActive(paths.value.management)),
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
const isMoreActive = computed(
  () => mobileQuickItems.value.every((item) => !item.active) && !isProfile.value,
);

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
  color: var(--p-text-color);
  background: var(--p-surface-100);
}

:deep(.workspace-panel-menu .workspace-menu-item-active .p-panelmenu-item-link:hover) {
  background: var(--p-surface-200);
}

:deep(.p-button.workspace-nav-active) {
  color: var(--p-text-color);
  background: var(--p-surface-100);
}

:deep(.p-button.workspace-nav-active:hover) {
  background: var(--p-surface-200);
}
</style>
