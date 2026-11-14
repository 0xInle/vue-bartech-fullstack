<template>
  <Dialog
    v-model:visible="visible"
    modal
    :dismissable-mask="!busy"
    :closable="!busy"
    :close-on-escape="!busy"
    header="Выйти из компании?"
    class="dialog-size-sm"
    :pt="{ pcCloseButton: { root: { class: '!rounded-md' } } }"
  >
    <form class="space-y-3 pt-2" novalidate @submit.prevent="submit">
      <div v-if="errorMessage" class="p-1">
        <Message
          severity="error"
          size="small"
          :closable="false"
          :pt="compactMessagePt"
          class="w-full"
        >
          {{ errorMessage }}
        </Message>
      </div>
      <p class="text-sm text-color-secondary">
        Доступ к этой компании и её рабочим пространствам завершится:
      </p>
      <ul
        v-if="venueNames.length"
        class="list-inside list-disc space-y-1 text-sm text-color-secondary"
      >
        <li v-for="venueName in venueNames" :key="venueName">{{ venueName }}</li>
      </ul>
      <FloatLabel class="w-full" variant="on">
        <InputText
          id="company-exit-confirmation"
          v-model="confirmationName"
          size="small"
          class="w-full"
          :invalid="validationAttempted && !confirmationNameMatches"
          autocomplete="off"
          required
          :disabled="busy"
        />
        <label for="company-exit-confirmation" class="text-xs">
          Введите название компании для подтверждения
        </label>
      </FloatLabel>
      <div class="grid grid-cols-2 gap-2">
        <Button
          type="button"
          label="Отмена"
          severity="secondary"
          variant="outlined"
          size="small"
          class="w-full"
          :disabled="busy"
          @click="visible = false"
        />
        <Button
          type="submit"
          :label="busy ? 'Завершаем выход…' : 'Выйти'"
          severity="danger"
          size="small"
          class="w-full"
          :loading="busy"
          :disabled="busy || !confirmationNameMatches"
        />
      </div>
    </form>
  </Dialog>
</template>

<script setup lang="ts">
import type { CompanySummary } from "~/types/user-workspaces";
import { useCompanyExit } from "~/features/organizations/composables/useCompanyExit";
import { compactMessagePt } from "~/utils/primevue-message";

const props = defineProps<{ company: CompanySummary; venueNames: string[] }>();
const { leaveCompany } = useCompanyExit();
const visible = ref(false);
const busy = ref(false);
const confirmationName = ref("");
const errorMessage = ref("");
const validationAttempted = ref(false);
const confirmationNameMatches = computed(
  () =>
    confirmationName.value.trim().toLocaleLowerCase("ru-RU") ===
    props.company.name.trim().toLocaleLowerCase("ru-RU"),
);
function open(): void {
  confirmationName.value = "";
  errorMessage.value = "";
  validationAttempted.value = false;
  visible.value = true;
}

async function submit(): Promise<void> {
  validationAttempted.value = true;
  if (!confirmationNameMatches.value || busy.value) return;
  busy.value = true;
  errorMessage.value = "";
  try {
    await leaveCompany(props.company.id, confirmationName.value);
    visible.value = false;
  } catch {
    errorMessage.value =
      "Выход из компании невозможен, пока вы не передадите права на управление другому сотруднику.";
  } finally {
    busy.value = false;
  }
}

defineExpose({ open });
</script>
