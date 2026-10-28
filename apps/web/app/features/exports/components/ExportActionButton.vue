<template>
  <div
    v-if="canExport"
    class="flex flex-col gap-2"
    :class="fullWidth ? 'min-w-0 items-stretch' : 'items-start'"
  >
    <Button
      :class="{ 'w-full': fullWidth }"
      :label="label"
      icon="pi pi-file-pdf"
      size="small"
      severity="secondary"
      variant="outlined"
      :loading="loading"
      :disabled="loading"
      @click="create"
    />
    <Message v-if="errorMessage" severity="error" :closable="false" size="small">
      {{ errorMessage }}
    </Message>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useProductExports } from "../composables/useProductExports";

const props = withDefaults(
  defineProps<{
    companyId: string;
    venueId: string;
    productId: string;
    canExport: boolean;
    label?: string;
    fullWidth?: boolean;
  }>(),
  {
    label: "Скачать PDF",
    fullWidth: false,
  },
);
const exports = useProductExports(
  () => props.companyId,
  () => props.venueId,
  "",
);
const loading = ref(false);
const errorMessage = ref("");

async function create(): Promise<void> {
  loading.value = true;
  errorMessage.value = "";
  try {
    const id = await exports.createSingle(props.productId);
    await exports.open(id);
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "Не удалось создать запрос выгрузки.";
  } finally {
    loading.value = false;
  }
}
</script>
