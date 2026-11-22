<template>
  <section class="space-y-2">
    <p class="truncate px-3 text-center text-xs text-color-secondary">
      {{ props.workspace.company.name }}
    </p>
    <Button
      v-if="workplaces.length > 1"
      type="button"
      :label="props.workspace.venue.name"
      :icon="workspaceSwitcherOpen ? 'pi pi-chevron-up' : 'pi pi-chevron-down'"
      icon-pos="right"
      severity="secondary"
      variant="text"
      size="small"
      class="w-full justify-between"
      :pt="{
        label: {
          style: {
            fontFamily: 'inherit',
            fontSize: '0.75rem',
            color: 'var(--p-text-color)',
          },
        },
      }"
      aria-label="Выбрать заведение"
      :aria-expanded="workspaceSwitcherOpen"
      aria-haspopup="true"
      @click="toggleWorkspaceList"
    />
    <p v-else class="truncate px-3 text-center text-xs text-color-secondary">
      {{ props.workspace.venue.name }}
    </p>
    <Menu
      ref="workspaceMenu"
      :model="workspaceMenuItems"
      popup
      aria-label="Рабочие пространства"
      class="min-w-56"
      :pt="{
        list: { class: 'max-h-80 overflow-y-auto' },
        itemContent: { class: 'text-xs' },
        itemLink: ({ context }) => ({
          class: '!justify-center',
          style: context.item?.active
            ? { color: 'var(--p-primary-color)', fontWeight: 600 }
            : undefined,
        }),
        itemLabel: {
          class: 'text-center text-xs',
          style: { fontFamily: 'inherit', fontSize: '0.75rem' },
        },
      }"
      @show="workspaceSwitcherOpen = true"
      @hide="workspaceSwitcherOpen = false"
    />
    <p v-if="props.showFullName" class="truncate px-3 text-center text-xs text-color-secondary">
      {{ props.fullName }}
    </p>
  </section>
</template>

<script setup lang="ts">
import Menu from "primevue/menu";
import type { MenuItem } from "primevue/menuitem";
import type { Workspace } from "~/types/user-workspaces";

const props = withDefaults(
  defineProps<{
    workspace: Workspace;
    workplaces: Workspace[];
    fullName: string;
    showFullName?: boolean;
  }>(),
  { showFullName: true },
);
const emit = defineEmits<{ switch: [workspace: Workspace] }>();
const workspaceMenu = ref<InstanceType<typeof Menu> | null>(null);
const workspaceSwitcherOpen = ref(false);
const workspaceMenuItems = computed<MenuItem[]>(() =>
  props.workplaces.map((workplace) => ({
    label: workplace.venue.name,
    active: isCurrentWorkspace(workplace),
    command: () => selectWorkspace(workplace),
  })),
);

function toggleWorkspaceList(event: MouseEvent): void {
  workspaceMenu.value?.toggle(event);
}

function isCurrentWorkspace(workplace: Workspace): boolean {
  return (
    workplace.company.id === props.workspace.company.id &&
    workplace.venue.id === props.workspace.venue.id
  );
}

function selectWorkspace(workplace: Workspace): void {
  workspaceMenu.value?.hide();
  if (!isCurrentWorkspace(workplace)) emit("switch", workplace);
}
</script>
