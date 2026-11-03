<template>
  <div
    v-if="canExport"
    class="flex flex-col gap-2"
    :class="fullWidth ? 'min-w-max items-stretch' : 'items-start'"
  >
    <Button
      class="whitespace-nowrap !px-1"
      :class="{ 'w-full': fullWidth }"
      :label="label"
      size="small"
      severity="secondary"
      variant="outlined"
      :loading="loading"
      :disabled="loading || isPending"
      @click="create"
    />
    <Message v-if="errorMessage" severity="error" :closable="false" size="small">
      {{ errorMessage }}
    </Message>
    <ProductExportProgressDialog
      :visible="dialogVisible"
      :creating="loading"
      :loading="exports.statusQuery.isLoading.value"
      :status-error="exports.statusQuery.isError.value"
      :request="request"
      :error-message="dialogError"
      :download-loading="downloading"
      @close="closeDialog"
      @download="download"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useProductExports } from "../composables/useProductExports";
import ProductExportProgressDialog from "./ProductExportProgressDialog.vue";

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
const exportId = ref("");
const exports = useProductExports(
  () => props.companyId,
  () => props.venueId,
  () => exportId.value,
);
const loading = ref(false);
const errorMessage = ref("");
const dialogError = ref("");
const dialogVisible = ref(false);
const downloading = ref(false);
const request = computed(() => exports.statusQuery.data.value ?? null);
const isPending = computed(
  () =>
    loading.value || request.value?.status === "QUEUED" || request.value?.status === "PROCESSING",
);

async function create(): Promise<void> {
  dialogVisible.value = true;
  dialogError.value = "";
  errorMessage.value = "";
  exportId.value = "";
  loading.value = true;
  try {
    exportId.value = await exports.createSingle(props.productId);
  } catch (error) {
    dialogError.value =
      error instanceof Error ? error.message : "Не удалось создать запрос выгрузки.";
    errorMessage.value = dialogError.value;
  } finally {
    loading.value = false;
  }
}

function closeDialog(): void {
  if (isPending.value) return;
  dialogVisible.value = false;
  dialogError.value = "";
  exportId.value = "";
}

async function download(): Promise<void> {
  downloading.value = true;
  dialogError.value = "";
  try {
    await exports.download();
  } catch (error) {
    dialogError.value =
      error instanceof Error ? error.message : "Не удалось получить ссылку на файл.";
  } finally {
    downloading.value = false;
  }
}
</script>
