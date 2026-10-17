<template>
  <Button
    v-if="canManage"
    label="В архив"
    icon="pi pi-inbox"
    size="small"
    severity="secondary"
    variant="text"
    @click="visible = true"
  />
  <Dialog
    v-model:visible="visible"
    modal
    header="Архивировать продукт"
    class="w-full max-w-lg"
    :closable="!busy"
    :close-on-escape="!busy"
  >
    <Message v-if="errorMessage" severity="error" :closable="false" class="mb-4">{{
      errorMessage
    }}</Message>
    <p class="text-sm">
      «{{ productName }}» исчезнет из активной продукции. Карточка и её состав сохранятся в архиве;
      изменить её можно будет после восстановления.
    </p>
    <div v-if="affectedProducts.length" class="mt-4">
      <p class="text-sm font-medium">Продукт используется в активных техкартах:</p>
      <ul class="mt-2 space-y-2 text-sm">
        <li v-for="product in affectedProducts" :key="product.id">
          <NuxtLink
            v-if="activeProductPath(basePath, product)"
            :to="activeProductPath(basePath, product)!"
            class="text-primary hover:underline"
            >{{ product.name }}</NuxtLink
          >
          <span v-else>{{ product.name }}</span>
        </li>
      </ul>
    </div>
    <template #footer>
      <Button
        label="Отмена"
        size="small"
        severity="secondary"
        variant="text"
        :disabled="busy"
        @click="visible = false"
      />
      <Button label="Архивировать" size="small" :loading="busy" @click="submit" />
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ArchiveRequestError, useProductArchive } from "../composables/useProductArchive";
import { activeProductPath } from "../product-links";

const props = defineProps<{
  companyId: string;
  venueId: string;
  productId: string;
  productType: import("../composables/useProductArchive").ProductAnalyticsType;
  productName: string;
  canManage: boolean;
}>();
const emit = defineEmits<{ archived: [] }>();
const { archive } = useProductArchive(
  () => props.companyId,
  () => props.venueId,
);
const visible = ref(false);
const busy = ref(false);
const errorMessage = ref("");
const affectedProducts = ref<Array<{ id: string; type: string; name: string }>>([]);
const basePath = computed(() => `/app/companies/${props.companyId}/venues/${props.venueId}`);
watch(visible, (open) => {
  if (open) {
    errorMessage.value = "";
    affectedProducts.value = [];
  }
});

async function submit() {
  if (busy.value) return;
  busy.value = true;
  errorMessage.value = "";
  affectedProducts.value = [];
  try {
    await archive(props.productId, props.productType);
    visible.value = false;
    emit("archived");
    await navigateTo(`${basePath.value}/archive/${props.productId}`);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Не удалось архивировать продукт";
    if (error instanceof ArchiveRequestError)
      affectedProducts.value = error.problem.affectedProducts ?? [];
  } finally {
    busy.value = false;
  }
}
</script>
