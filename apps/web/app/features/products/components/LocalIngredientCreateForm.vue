<template>
  <Card class="border border-surface bg-surface-50">
    <template #content>
      <form class="flex flex-col gap-3" @submit.prevent="submit">
        <div>
          <p class="text-sm font-medium">Новый локальный ингредиент</p>
          <p class="mt-1 text-xs text-color-secondary">Он будет доступен только этому заведению.</p>
        </div>
        <Message v-if="errorMessage" severity="error" :closable="false" size="small">
          {{ errorMessage }}
        </Message>
        <InputText v-model="name" size="small" placeholder="Название ингредиента" fluid />
        <Select
          v-model="categoryCode"
          :options="categories"
          option-label="name"
          option-value="code"
          placeholder="Категория"
          size="small"
          fluid
        />
        <InputText v-model="brand" size="small" placeholder="Бренд — необязательно" fluid />
        <div class="flex justify-end gap-2">
          <Button
            label="Отмена"
            severity="secondary"
            variant="text"
            size="small"
            @click="emit('cancel')"
          />
          <Button label="Создать" type="submit" size="small" :loading="saving" />
        </div>
      </form>
    </template>
  </Card>
</template>

<script setup lang="ts">
import { ref } from "vue";
import type { ProductCreated } from "../types";

const props = defineProps<{
  categories: Array<{ code: string; name: string }>;
  create: (input: {
    name: string;
    categoryCode: string;
    brand?: string;
  }) => Promise<ProductCreated>;
}>();
const emit = defineEmits<{ cancel: []; created: [product: ProductCreated] }>();

const name = ref("");
const categoryCode = ref("");
const brand = ref("");
const saving = ref(false);
const errorMessage = ref("");

async function submit(): Promise<void> {
  errorMessage.value = "";
  if (!name.value.trim() || !categoryCode.value) {
    errorMessage.value = "Укажите название и категорию ингредиента.";
    return;
  }
  saving.value = true;
  try {
    const product = await props.create({
      name: name.value.trim(),
      categoryCode: categoryCode.value,
      brand: brand.value.trim() || undefined,
    });
    emit("created", product);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Не удалось создать ингредиент.";
  } finally {
    saving.value = false;
  }
}
</script>
