<template>
  <div v-if="canExport" class="flex flex-col items-start gap-2">
    <Button
      label="Скачать PDF"
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

const props = defineProps<{
  companyId: string;
  venueId: string;
  productId: string;
  canExport: boolean;
}>();
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
