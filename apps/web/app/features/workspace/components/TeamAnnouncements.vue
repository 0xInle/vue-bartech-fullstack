<template>
  <section
    class="w-full min-w-0 rounded-lg border border-[var(--p-content-border-color)] p-2"
    aria-labelledby="team-announcements-title"
  >
    <header class="flex items-center justify-between gap-2">
      <div class="flex items-center gap-2">
        <i class="pi pi-megaphone text-sm text-primary" aria-hidden="true" />
        <h2 id="team-announcements-title" class="text-sm font-semibold">Объявления</h2>
      </div>
      <div class="flex shrink-0 items-center gap-1">
        <Button
          v-if="canManage"
          label="Новое объявление"
          size="small"
          :disabled="isMutating"
          @click="openCreateDialog"
        />
        <Button
          :icon="collapsed ? 'pi pi-chevron-down' : 'pi pi-chevron-up'"
          :aria-label="collapsed ? 'Развернуть объявления' : 'Свернуть объявления'"
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
            v-if="announcementsQuery.isError.value"
            severity="error"
            size="small"
            :closable="false"
            :pt="compactMessagePt"
          >
            Не удалось загрузить объявления.
            <Button label="Повторить" size="small" text @click="announcementsQuery.refetch()" />
          </Message>
          <LoadingIndicator v-else-if="announcementsQuery.isLoading.value" />
          <p
            v-else-if="!announcements.length"
            class="text-xs text-color-secondary"
            aria-live="polite"
          >
            Пока объявлений нет.
          </p>
          <ul
            v-else
            :class="[
              'space-y-2',
              announcements.length > 10 && 'dashboard-list-scroll--announcements',
            ]"
            aria-label="Объявления заведения"
          >
            <li
              v-for="announcement in announcements"
              :key="announcement.id"
              class="flex min-w-0 items-center gap-2 rounded-lg border border-[var(--p-content-border-color)] px-2 py-1.5"
            >
              <div class="min-w-0 flex-1">
                <p class="break-words text-sm font-semibold">{{ announcement.title }}</p>
                <p class="break-words whitespace-pre-line text-xs text-color-secondary">
                  {{ announcement.body }}
                </p>
              </div>
              <Tag
                :value="formatDate(announcement.createdAt)"
                severity="secondary"
                :pt="compactTagPt"
              />
              <div v-if="canManage" class="flex shrink-0 items-center gap-1">
                <Button
                  icon="pi pi-pencil"
                  severity="secondary"
                  variant="text"
                  size="small"
                  aria-label="Редактировать объявление"
                  :disabled="isMutating"
                  @click="openEditDialog(announcement)"
                />
                <Button
                  icon="pi pi-trash"
                  severity="danger"
                  variant="text"
                  size="small"
                  aria-label="Удалить объявление"
                  :disabled="isMutating"
                  @click="openDeleteDialog(announcement)"
                />
              </div>
            </li>
          </ul>
        </div>
      </div>
    </Transition>

    <TeamAnnouncementDialog
      v-model:visible="dialogVisible"
      :announcement="selectedAnnouncement"
      :busy="isSaving"
      :error-message="mutationError"
      @submit="saveAnnouncement"
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
      header="Удалить объявление?"
      class="dialog-size-sm"
      :pt="{ pcCloseButton: { root: { class: '!rounded-md' } } }"
      @update:visible="deleteDialogVisible = $event"
    >
      <p class="text-sm">
        Объявление «{{ selectedForDeletion?.title }}» будет удалено для всех сотрудников заведения.
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
          @click="deleteAnnouncement"
        />
      </template>
    </Dialog>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import type { SaveVenueAnnouncementDto, VenueAnnouncementDto } from "@bartech/api-client";
import { useVenueAnnouncements } from "~/features/workspace/composables/useVenueAnnouncements";
import { compactMessagePt } from "~/utils/primevue-message";
import TeamAnnouncementDialog from "./TeamAnnouncementDialog.vue";

const props = defineProps<{ companyId: string; venueId: string; canManage: boolean }>();
const { announcementsQuery, createMutation, updateMutation, deleteMutation } =
  useVenueAnnouncements(
    () => props.companyId,
    () => props.venueId,
  );
const announcements = computed(() => announcementsQuery.data.value ?? []);
const collapsed = ref(false);
const dialogVisible = ref(false);
const deleteDialogVisible = ref(false);
const selectedAnnouncement = ref<VenueAnnouncementDto | null>(null);
const selectedForDeletion = ref<VenueAnnouncementDto | null>(null);
const mutationError = ref("");
const isSaving = computed(() => createMutation.isPending.value || updateMutation.isPending.value);
const isMutating = computed(() => isSaving.value || deleteMutation.isPending.value);

const compactTagPt = {
  root: { style: { fontSize: "0.75rem", padding: "0.125rem 0.375rem" } },
  label: { style: { fontWeight: "400" } },
};

function openCreateDialog(): void {
  mutationError.value = "";
  selectedAnnouncement.value = null;
  dialogVisible.value = true;
}

function openEditDialog(announcement: VenueAnnouncementDto): void {
  mutationError.value = "";
  selectedAnnouncement.value = announcement;
  dialogVisible.value = true;
}

function openDeleteDialog(announcement: VenueAnnouncementDto): void {
  mutationError.value = "";
  selectedForDeletion.value = announcement;
  deleteDialogVisible.value = true;
}

async function saveAnnouncement(input: SaveVenueAnnouncementDto): Promise<void> {
  mutationError.value = "";
  try {
    if (selectedAnnouncement.value) {
      await updateMutation.mutateAsync({ id: selectedAnnouncement.value.id, input });
    } else {
      await createMutation.mutateAsync(input);
    }
    dialogVisible.value = false;
    selectedAnnouncement.value = null;
  } catch (error) {
    mutationError.value =
      error instanceof Error ? error.message : "Не удалось сохранить объявление.";
  }
}

async function deleteAnnouncement(): Promise<void> {
  const target = selectedForDeletion.value;
  if (!target || deleteMutation.isPending.value) return;

  mutationError.value = "";
  try {
    await deleteMutation.mutateAsync(target.id);
    deleteDialogVisible.value = false;
    selectedForDeletion.value = null;
  } catch (error) {
    mutationError.value = error instanceof Error ? error.message : "Не удалось удалить объявление.";
  }
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" }).format(
    new Date(value),
  );
}
</script>
