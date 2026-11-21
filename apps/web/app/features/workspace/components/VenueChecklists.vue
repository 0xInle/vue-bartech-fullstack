<template>
  <section
    class="w-full min-w-0 rounded-lg border border-[var(--p-content-border-color)] p-2"
    aria-labelledby="venue-checklists-title"
  >
    <header class="flex items-center justify-between gap-2">
      <div class="flex items-center gap-2">
        <i class="pi pi-list text-sm text-primary" aria-hidden="true" />
        <h2 id="venue-checklists-title" class="text-sm font-semibold">Чек-листы</h2>
      </div>
      <div class="flex shrink-0 items-center gap-1">
        <Button
          v-if="canManage"
          label="Создать чек-лист"
          size="small"
          :disabled="isMutating"
          @click="openCreateDialog"
        />
        <Button
          :icon="collapsed ? 'pi pi-chevron-down' : 'pi pi-chevron-up'"
          :aria-label="collapsed ? 'Развернуть чек-листы' : 'Свернуть чек-листы'"
          :aria-expanded="!collapsed"
          size="small"
          severity="secondary"
          variant="text"
          class="workspace-action-icon-button"
          @click="collapsed = !collapsed"
        />
      </div>
    </header>

    <Transition name="dashboard-collapse">
      <div v-if="!collapsed" class="dashboard-collapse">
        <div class="space-y-2">
          <Message
            v-if="mutationError"
            severity="error"
            size="small"
            :closable="false"
            :pt="compactMessagePt"
          >
            {{ mutationError }}
          </Message>
          <Message
            v-if="checklistsQuery.isError.value"
            severity="error"
            size="small"
            :closable="false"
            :pt="compactMessagePt"
          >
            Не удалось загрузить чек-листы.
            <Button label="Повторить" size="small" text @click="checklistsQuery.refetch()" />
          </Message>
          <LoadingIndicator v-else-if="checklistsQuery.isLoading.value" />
          <p v-else-if="!checklists.length" class="text-xs text-color-secondary" aria-live="polite">
            Пока чек-листов нет.
          </p>
          <ul
            v-else
            :class="['space-y-2', checklists.length > 10 && 'dashboard-list-scroll--checklists']"
            aria-label="Чек-листы заведения"
          >
            <li
              v-for="checklist in checklists"
              :key="checklist.id"
              class="checklist-item flex min-w-0 cursor-pointer items-center gap-2 rounded-lg border border-[var(--p-content-border-color)] px-2 py-0 transition-colors"
            >
              <Button
                unstyled
                class="min-w-0 flex-1 cursor-pointer rounded-sm text-left focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
                @click="openViewDialog(checklist)"
              >
                <span class="break-words text-sm">{{ checklist.title }}</span>
              </Button>
              <div v-if="canManage" class="flex shrink-0 items-center gap-1">
                <Button
                  icon="pi pi-pencil"
                  severity="secondary"
                  variant="text"
                  size="small"
                  aria-label="Редактировать чек-лист"
                  :disabled="isMutating"
                  @click="openEditDialog(checklist)"
                />
                <Button
                  icon="pi pi-trash"
                  severity="danger"
                  variant="text"
                  size="small"
                  aria-label="Удалить чек-лист"
                  :disabled="isMutating"
                  @click="openDeleteDialog(checklist)"
                />
              </div>
            </li>
          </ul>
        </div>
      </div>
    </Transition>

    <VenueChecklistViewDialog v-model:visible="viewDialogVisible" :checklist="selectedChecklist" />
    <VenueChecklistEditorDialog
      v-model:visible="editorDialogVisible"
      :checklist="selectedChecklist"
      :busy="isSaving"
      :error-message="mutationError"
      @submit="saveChecklist"
    />

    <Dialog
      :visible="deleteDialogVisible"
      modal
      :draggable="false"
      :dismissable-mask="!deleteMutation.isPending.value"
      :close-on-escape="!deleteMutation.isPending.value"
      :close-button-props="{
        disabled: deleteMutation.isPending.value,
        severity: 'secondary',
        text: true,
        rounded: true,
      }"
      header="Удалить чек-лист?"
      class="dialog-size-sm"
      :pt="{ pcCloseButton: { root: { class: '!rounded-md' } } }"
      @update:visible="deleteDialogVisible = $event"
    >
      <p class="text-sm">
        Чек-лист «{{ selectedForDeletion?.title }}» будет удалён для всех сотрудников заведения.
      </p>
      <template #footer>
        <Button
          label="Отмена"
          size="small"
          severity="secondary"
          variant="text"
          :disabled="deleteMutation.isPending.value"
          @click="deleteDialogVisible = false"
        />
        <Button
          label="Удалить"
          size="small"
          severity="danger"
          :loading="deleteMutation.isPending.value"
          :disabled="!selectedForDeletion || deleteMutation.isPending.value"
          @click="deleteChecklist"
        />
      </template>
    </Dialog>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import type { SaveVenueChecklistDto, VenueChecklistDto } from "@bartech/api-client";
import { useVenueChecklists } from "~/features/workspace/composables/useVenueChecklists";
import { compactMessagePt } from "~/utils/primevue-message";
import VenueChecklistEditorDialog from "./VenueChecklistEditorDialog.vue";
import VenueChecklistViewDialog from "./VenueChecklistViewDialog.vue";

const props = defineProps<{ companyId: string; venueId: string; canManage: boolean }>();
const { checklistsQuery, createMutation, updateMutation, deleteMutation } = useVenueChecklists(
  () => props.companyId,
  () => props.venueId,
);
const checklists = computed(() => checklistsQuery.data.value ?? []);
const collapsed = ref(false);
const viewDialogVisible = ref(false);
const editorDialogVisible = ref(false);
const deleteDialogVisible = ref(false);
const selectedChecklist = ref<VenueChecklistDto | null>(null);
const selectedForDeletion = ref<VenueChecklistDto | null>(null);
const mutationError = ref("");
const isSaving = computed(() => createMutation.isPending.value || updateMutation.isPending.value);
const isMutating = computed(() => isSaving.value || deleteMutation.isPending.value);

function openViewDialog(checklist: VenueChecklistDto): void {
  selectedChecklist.value = checklist;
  viewDialogVisible.value = true;
}

function openCreateDialog(): void {
  mutationError.value = "";
  selectedChecklist.value = null;
  editorDialogVisible.value = true;
}

function openEditDialog(checklist: VenueChecklistDto): void {
  mutationError.value = "";
  selectedChecklist.value = checklist;
  editorDialogVisible.value = true;
}

function openDeleteDialog(checklist: VenueChecklistDto): void {
  mutationError.value = "";
  selectedForDeletion.value = checklist;
  deleteDialogVisible.value = true;
}

async function saveChecklist(input: SaveVenueChecklistDto): Promise<void> {
  mutationError.value = "";
  try {
    if (selectedChecklist.value) {
      await updateMutation.mutateAsync({ id: selectedChecklist.value.id, input });
    } else {
      await createMutation.mutateAsync(input);
    }
    editorDialogVisible.value = false;
    selectedChecklist.value = null;
  } catch (error) {
    mutationError.value = error instanceof Error ? error.message : "Не удалось сохранить чек-лист.";
  }
}

async function deleteChecklist(): Promise<void> {
  const target = selectedForDeletion.value;
  if (!target || deleteMutation.isPending.value) return;
  mutationError.value = "";
  try {
    await deleteMutation.mutateAsync(target.id);
    deleteDialogVisible.value = false;
    selectedForDeletion.value = null;
  } catch (error) {
    mutationError.value = error instanceof Error ? error.message : "Не удалось удалить чек-лист.";
  }
}
</script>

<style scoped>
.checklist-item:hover {
  background-color: color-mix(in srgb, var(--p-primary-100) 70%, var(--p-content-background));
}
</style>
