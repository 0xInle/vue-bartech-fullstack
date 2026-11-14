<template>
  <section class="space-y-2 text-center">
    <p class="truncate px-3 text-xs text-color-secondary">
      {{ props.workspace.company.name }}
    </p>
    <p v-if="workplaces.length <= 1" class="truncate px-3 text-xs text-color-secondary">
      {{ props.workspace.venue.name }}
    </p>
    <Button
      v-else
      type="button"
      :label="props.workspace.venue.name"
      icon="pi pi-chevron-down"
      severity="secondary"
      variant="text"
      size="small"
      class="w-full justify-center"
      aria-label="Выбрать заведение"
      aria-haspopup="true"
      :aria-expanded="workspaceSwitcherOpen"
      @click="openWorkspaceList"
    />
    <Popover
      ref="workspacePopover"
      class="min-w-56 p-2"
      @show="workspaceSwitcherOpen = true"
      @hide="workspaceSwitcherOpen = false"
    >
      <FloatLabel v-if="workplaces.length > 8" class="mb-2 w-full px-1 pt-2" variant="on">
        <InputText :id="searchInputId" v-model="searchText" size="small" class="w-full" />
        <label :for="searchInputId" class="text-xs">Найти заведение</label>
      </FloatLabel>
      <div class="max-h-80 overflow-y-auto">
        <section
          v-for="group in filteredWorkspaceGroups"
          :key="group.company.id"
          class="mb-2 last:mb-0"
        >
          <p class="px-2 py-1 text-xs font-semibold text-color-secondary">
            {{ group.company.name }}
          </p>
          <Button
            v-for="item in group.workplaces"
            :key="`${item.company.id}:${item.venue.id}`"
            :label="item.venue.name"
            severity="secondary"
            variant="text"
            size="small"
            class="w-full justify-start"
            :disabled="isCurrentWorkspace(item)"
            :aria-current="isCurrentWorkspace(item) ? 'page' : undefined"
            @click="selectWorkspace(item)"
          />
        </section>
      </div>
    </Popover>
    <p v-if="props.showFullName" class="truncate px-3 text-xs text-color-secondary">
      {{ props.fullName }}
    </p>
  </section>
</template>

<script setup lang="ts">
import Popover from "primevue/popover";
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
const workspacePopover = ref<InstanceType<typeof Popover> | null>(null);
const workspaceSwitcherOpen = ref(false);
const searchText = ref("");
const searchInputId = useId();
const workspaceGroups = computed(() => {
  const groups = new Map<string, { company: Workspace["company"]; workplaces: Workspace[] }>();
  for (const workplace of props.workplaces) {
    const group = groups.get(workplace.company.id) ?? {
      company: workplace.company,
      workplaces: [],
    };
    group.workplaces.push(workplace);
    groups.set(workplace.company.id, group);
  }
  return [...groups.values()];
});
const filteredWorkspaceGroups = computed(() => {
  const query = searchText.value.trim().toLocaleLowerCase("ru");
  if (!query) return workspaceGroups.value;
  return workspaceGroups.value
    .map((group) => ({
      ...group,
      workplaces: group.workplaces.filter((workplace) =>
        `${group.company.name} ${workplace.venue.name}`.toLocaleLowerCase("ru").includes(query),
      ),
    }))
    .filter((group) => group.workplaces.length);
});

function isCurrentWorkspace(item: Workspace): boolean {
  return (
    item.company.id === props.workspace.company.id && item.venue.id === props.workspace.venue.id
  );
}

function openWorkspaceList(event: MouseEvent): void {
  if (props.workplaces.length > 1) workspacePopover.value?.toggle(event);
}

function selectWorkspace(item: Workspace): void {
  workspacePopover.value?.hide();
  searchText.value = "";
  if (!isCurrentWorkspace(item)) emit("switch", item);
}
</script>
