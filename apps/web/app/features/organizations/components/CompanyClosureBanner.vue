<template>
  <Message
    v-if="closure?.status === 'PENDING_CLOSURE'"
    severity="warn"
    :closable="false"
    class="mb-6"
  >
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p class="font-semibold">Компания ожидает закрытия</p>
        <p class="mt-1 text-sm">
          Удаление запланировано на {{ deadlineText }} по московскому времени. Данные доступны
          только для просмотра.
        </p>
        <p v-if="errorMessage" class="mt-2 text-sm">{{ errorMessage }}</p>
        <NuxtLink
          v-if="closure.operationId"
          :to="`/app/closures/${closure.operationId}`"
          class="mt-2 inline-block text-sm font-medium text-primary"
        >
          Открыть страницу результата закрытия
        </NuxtLink>
      </div>
      <Button
        v-if="closure.canCancel"
        label="Отменить закрытие"
        severity="secondary"
        size="small"
        :loading="isCancelling"
        @click="cancelClosure"
      />
    </div>
  </Message>
  <ClosureExportPicker
    v-if="closure?.status === 'PENDING_CLOSURE' && closure.operationId"
    :company-id="companyId"
    :operation-id="closure.operationId"
    operation-type="COMPANY"
  />
</template>

<script setup lang="ts">
import { useOrganizationLifecycle } from "~/features/organizations/composables/useOrganizationLifecycle";
import ClosureExportPicker from "~/features/exports/components/ClosureExportPicker.vue";

defineOptions({ name: "CompanyClosureBanner" });

const props = defineProps<{ companyId: string }>();
const { closureQuery, cancelCompanyClosure } = useOrganizationLifecycle(
  computed(() => props.companyId),
);
const isCancelling = ref(false);
const companyId = computed(() => props.companyId);
const errorMessage = ref("");
const closure = computed(() => closureQuery.data.value);
const deadlineText = computed(() => {
  const deadline = closure.value?.closureDeadline;
  if (!deadline) return "";
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Moscow",
  }).format(new Date(deadline));
});

async function cancelClosure() {
  isCancelling.value = true;
  errorMessage.value = "";
  try {
    await cancelCompanyClosure();
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "Не удалось отменить закрытие компании.";
  } finally {
    isCancelling.value = false;
  }
}
</script>
