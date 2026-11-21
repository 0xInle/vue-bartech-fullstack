<template>
  <section
    class="w-full min-w-0 rounded-lg border border-[var(--p-content-border-color)] p-2"
    aria-labelledby="venue-reminders-title"
  >
    <header class="flex items-center justify-between gap-2">
      <div class="flex min-w-0 flex-1 items-center gap-2">
        <i class="pi pi-check-square text-sm text-primary" aria-hidden="true" />
        <h2 id="venue-reminders-title" class="text-sm font-semibold">Задачи</h2>
      </div>
      <Button
        :icon="collapsed ? 'pi pi-chevron-down' : 'pi pi-chevron-up'"
        :aria-label="collapsed ? 'Развернуть задачи' : 'Свернуть задачи'"
        :aria-expanded="!collapsed"
        size="small"
        severity="secondary"
        variant="text"
        class="workspace-action-icon-button shrink-0"
        @click="collapsed = !collapsed"
      />
    </header>

    <Transition name="dashboard-collapse">
      <div v-if="!collapsed" class="dashboard-collapse">
        <div class="space-y-2">
          <form
            class="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2"
            @submit.prevent="submit"
          >
            <FloatLabel variant="on" class="w-full">
              <InputText
                id="venue-reminder-text"
                v-model="text"
                size="small"
                class="w-full"
                maxlength="500"
                :disabled="isMutating"
                @input="errorMessage = ''"
              />
              <label for="venue-reminder-text" class="text-xs">Новая задача</label>
            </FloatLabel>
            <Button
              type="submit"
              label="Добавить"
              size="small"
              :loading="createMutation.isPending.value"
              :disabled="isMutating || !text.trim()"
            />
          </form>

          <div class="space-y-2">
            <div v-if="errorMessage" class="p-1">
              <Message severity="error" :closable="false" :pt="compactMessagePt">
                {{ errorMessage }}
              </Message>
            </div>
            <div v-if="remindersQuery.isError.value" class="p-1">
              <Message severity="error" :closable="false" :pt="compactMessagePt">
                Не удалось загрузить задачи. Обновите страницу и попробуйте ещё раз.
              </Message>
            </div>
            <LoadingIndicator v-if="remindersQuery.isLoading.value" />
            <p
              v-else-if="!remindersQuery.isError.value && !reminders.length"
              class="text-xs text-color-secondary"
              aria-live="polite"
            >
              Пока задач нет.
            </p>
            <ul
              v-else-if="!remindersQuery.isError.value"
              :class="['space-y-1', reminders.length > 10 && 'dashboard-list-scroll--tasks']"
              aria-label="Список личных задач"
            >
              <li v-for="reminder in reminders" :key="reminder.id" class="flex items-center gap-2">
                <Checkbox
                  :model-value="Boolean(reminder.completedAt)"
                  binary
                  size="small"
                  :disabled="isMutating"
                  :aria-label="
                    reminder.completedAt
                      ? 'Вернуть задачу в активные'
                      : 'Отметить задачу выполненной'
                  "
                  @update:model-value="setCompleted(reminder.id, Boolean($event))"
                />
                <span
                  class="min-w-0 flex-1 break-words text-sm"
                  :class="reminder.completedAt ? 'text-color-secondary line-through' : ''"
                >
                  {{ reminder.text }}
                </span>
                <Button
                  icon="pi pi-trash"
                  severity="secondary"
                  variant="text"
                  size="small"
                  aria-label="Удалить задачу"
                  :disabled="isMutating"
                  @click="remove(reminder.id)"
                />
              </li>
            </ul>
          </div>
        </div>
      </div>
    </Transition>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, toRef } from "vue";
import type { VenueReminderDto } from "@bartech/api-client";
import { useVenueReminders } from "~/features/workspace/composables/useVenueReminders";
import { compactMessagePt } from "~/utils/primevue-message";

const props = defineProps<{ companyId: string; venueId: string }>();
const { remindersQuery, createMutation, completionMutation, deleteMutation } = useVenueReminders(
  toRef(props, "companyId"),
  toRef(props, "venueId"),
);
const reminders = computed<VenueReminderDto[]>(() => remindersQuery.data.value ?? []);
const collapsed = ref(false);
const text = ref("");
const errorMessage = ref("");
const isMutating = computed(
  () =>
    createMutation.isPending.value ||
    completionMutation.isPending.value ||
    deleteMutation.isPending.value,
);

async function submit(): Promise<void> {
  const normalizedText = text.value.trim();
  if (!normalizedText || isMutating.value) return;

  errorMessage.value = "";
  try {
    await createMutation.mutateAsync(normalizedText);
    text.value = "";
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "Не удалось добавить задачу. Попробуйте ещё раз.";
  }
}

async function setCompleted(id: string, completed: boolean): Promise<void> {
  errorMessage.value = "";
  try {
    await completionMutation.mutateAsync({ id, completed });
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "Не удалось изменить задачу. Попробуйте ещё раз.";
  }
}

async function remove(id: string): Promise<void> {
  errorMessage.value = "";
  try {
    await deleteMutation.mutateAsync(id);
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "Не удалось удалить задачу. Попробуйте ещё раз.";
  }
}
</script>
