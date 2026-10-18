<template>
  <section class="space-y-2 text-center">
    <p class="truncate px-3 text-xs text-color-secondary">{{ props.workspace.company.name }}</p>
    <Select
      v-if="workspaceOptions.length > 1"
      :model-value="workspaceKey"
      :options="workspaceOptions"
      option-label="label"
      option-value="key"
      size="small"
      class="workspace-identity-select w-full text-xs"
      aria-label="Выбрать заведение"
      @update:model-value="selectWorkspace"
    />
    <p v-else class="truncate px-3 text-xs text-color-secondary">
      {{ props.workspace.venue.name }}
    </p>
    <p v-if="props.showFullName" class="truncate px-3 text-sm font-medium text-color-secondary">
      {{ props.fullName }}
    </p>
  </section>
</template>

<script setup lang="ts">
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
const workspaceKey = computed(() => `${props.workspace.company.id}:${props.workspace.venue.id}`);
const workspaceOptions = computed(() =>
  props.workplaces.map((item) => ({
    ...item,
    key: `${item.company.id}:${item.venue.id}`,
    label: `${item.company.name} · ${item.venue.name}`,
  })),
);

function selectWorkspace(key: string): void {
  const selected = props.workplaces.find((item) => `${item.company.id}:${item.venue.id}` === key);
  if (selected) emit("switch", selected);
}
</script>

<style scoped>
:deep(.workspace-identity-select .p-select-label) {
  font-size: 0.75rem;
  line-height: 1rem;
  text-align: center;
}
</style>
