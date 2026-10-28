<template>
  <div
    v-if="compact"
    class="flex w-full min-w-0 flex-col gap-2"
    role="group"
    aria-label="Создание ингредиента"
  >
    <Message
      v-if="errorMessage"
      severity="error"
      size="small"
      :closable="false"
      :pt="compactMessagePt"
      class="w-full min-w-0"
    >
      {{ errorMessage }}
    </Message>
    <FloatLabel variant="on" class="w-full min-w-0">
      <InputText
        id="local-ingredient-name"
        v-model="name"
        size="small"
        fluid
        @keydown.enter.prevent="submit"
      />
      <label for="local-ingredient-name" class="text-xs">Ингредиент</label>
    </FloatLabel>
    <FloatLabel variant="on" class="w-full min-w-0">
      <Select
        ref="categorySelect"
        v-model="categoryCode"
        input-id="local-ingredient-category"
        :options="categories"
        option-label="name"
        option-value="code"
        size="small"
        fluid
        append-to="self"
        :pt="{ overlay: { class: 'w-max min-w-full' } }"
        @show="handleCategorySelectShow"
      >
        <template #option="{ option }">
          <div @mousedown.stop @click="selectCategory(option.code)">{{ option.name }}</div>
        </template>
      </Select>
      <label for="local-ingredient-category" class="text-xs">Категория</label>
    </FloatLabel>
    <div class="flex w-full min-w-0 flex-wrap justify-end gap-2">
      <Button
        label="Отмена"
        severity="secondary"
        variant="text"
        size="small"
        :disabled="saving"
        @click.stop="emit('cancel')"
      />
      <Button label="Добавить" type="button" size="small" :loading="saving" @click.stop="submit" />
    </div>
  </div>
  <Card v-else class="border border-surface bg-surface-50">
    <template #content>
      <form class="flex flex-col gap-3" @submit.prevent="submit">
        <div>
          <p class="text-sm font-medium">Новый локальный ингредиент</p>
          <p class="mt-1 text-xs text-color-secondary">Он будет доступен только этому заведению.</p>
        </div>
        <Message
          v-if="errorMessage"
          severity="error"
          size="small"
          :closable="false"
          :pt="compactMessagePt"
        >
          {{ errorMessage }}
        </Message>
        <FloatLabel variant="on">
          <InputText id="local-ingredient-name" v-model="name" size="small" fluid />
          <label for="local-ingredient-name" class="text-xs">Название ингредиента</label>
        </FloatLabel>
        <FloatLabel variant="on">
          <Select
            v-model="categoryCode"
            input-id="local-ingredient-category"
            :options="categories"
            option-label="name"
            option-value="code"
            size="small"
            fluid
          />
          <label for="local-ingredient-category" class="text-xs">Категория</label>
        </FloatLabel>
        <FloatLabel variant="on">
          <InputText id="local-ingredient-brand" v-model="brand" size="small" fluid />
          <label for="local-ingredient-brand" class="text-xs">Бренд — необязательно</label>
        </FloatLabel>
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
import { compactMessagePt } from "~/utils/primevue-message";
import {
  keepPrimeVueOverlayOpenOnScroll,
  keepPrimeVueOverlayWithinDrawer,
  type PrimeVueOverlayRef,
} from "~/utils/primevue-overlay";

const props = defineProps<{
  categories: Array<{ code: string; name: string }>;
  compact?: boolean;
  initialName?: string;
  create: (input: {
    name: string;
    categoryCode: string;
    brand?: string;
  }) => Promise<ProductCreated>;
}>();
const emit = defineEmits<{ cancel: []; created: [product: ProductCreated] }>();

const name = ref(props.initialName ?? "");
const categoryCode = ref("");
const categorySelect = ref<PrimeVueOverlayRef | null>(null);
const brand = ref("");
const saving = ref(false);
const errorMessage = ref("");

function handleCategorySelectShow(): void {
  keepPrimeVueOverlayOpenOnScroll(categorySelect.value);
  keepPrimeVueOverlayWithinDrawer(categorySelect.value);
}

function selectCategory(code: string): void {
  categoryCode.value = code;
  categorySelect.value?.hide();
}

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
    errorMessage.value = props.compact
      ? "Не удалось создать ингредиент."
      : error instanceof Error
        ? error.message
        : "Не удалось создать ингредиент.";
  } finally {
    saving.value = false;
  }
}
</script>
