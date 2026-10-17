<template>
  <main class="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
    <header>
      <NuxtLink to="/internal/catalog/manage" class="text-sm font-semibold text-primary"
        >Управление каталогом</NuxtLink
      >
      <h1 class="mt-4 text-2xl font-semibold tracking-tight">Категории ингредиентов</h1>
      <p class="mt-2 text-sm text-color-secondary">
        Общие категории глобального каталога и временных локальных ингредиентов.
      </p>
    </header>

    <Message v-if="loadingSession" severity="info" :closable="false"
      >Проверяем внутреннюю сессию…</Message
    >
    <Message v-else-if="!authorized" severity="error" :closable="false">
      Нет разрешения на управление глобальным каталогом.
    </Message>
    <Message
      v-else-if="categories.categoriesQuery.isLoading.value"
      severity="info"
      :closable="false"
      >Загружаем категории…</Message
    >
    <Message v-else-if="categories.categoriesQuery.error.value" severity="error" :closable="false">
      {{ errorMessage(categories.categoriesQuery.error.value) }}
    </Message>
    <div v-else class="space-y-6">
      <Message v-if="actionError" severity="error" :closable="false">{{ actionError }}</Message>

      <form
        class="grid gap-3 rounded-lg border border-surface p-4 sm:grid-cols-[1fr_1fr_auto]"
        @submit.prevent="create"
      >
        <InputText
          v-model="newName"
          required
          maxlength="80"
          size="small"
          placeholder="Название категории"
        />
        <Select
          v-model="newParentCode"
          :options="parentOptions"
          option-label="label"
          option-value="value"
          size="small"
          placeholder="Корневая категория"
          aria-label="Родительская категория"
        />
        <Button label="Создать" type="submit" size="small" :disabled="busy || !newName.trim()" />
      </form>

      <ul class="space-y-3">
        <li v-for="category in categoryList" :key="category.code">
          <form
            class="grid gap-3 rounded-lg border border-surface p-4 sm:grid-cols-[minmax(10rem,1fr)_minmax(10rem,1fr)_6rem_auto]"
            @submit.prevent="save(category)"
          >
            <div>
              <div class="flex items-center gap-2">
                <span class="font-medium"
                  >{{ category.parentCode ? "↳ " : "" }}{{ category.name }}</span
                >
                <Tag
                  :value="category.isActive ? 'Активна' : 'Неактивна'"
                  :severity="category.isActive ? 'success' : 'secondary'"
                />
                <Tag v-if="category.code === 'other'" value="Системная" severity="info" />
              </div>
              <span class="mt-1 block text-xs text-color-secondary">{{ category.code }}</span>
            </div>
            <InputText
              v-model="draftFor(category).name"
              required
              maxlength="80"
              size="small"
              aria-label="Название категории"
              :disabled="busy || category.code === 'other'"
            />
            <InputNumber
              v-model="draftFor(category).sortOrder"
              :min="0"
              :max-fraction-digits="0"
              size="small"
              aria-label="Порядок отображения"
              :disabled="busy"
            />
            <div class="flex flex-wrap gap-2 sm:justify-end">
              <Button
                label="Сохранить"
                type="submit"
                size="small"
                severity="secondary"
                :disabled="busy"
              />
              <Button
                v-if="category.isActive"
                label="Деактивировать"
                type="button"
                size="small"
                severity="danger"
                :disabled="busy || category.code === 'other'"
                @click="setActive(category, false)"
              />
              <Button
                v-else
                label="Активировать"
                type="button"
                size="small"
                @click="setActive(category, true)"
              />
            </div>
            <Select
              v-if="category.code !== 'other'"
              v-model="draftFor(category).parentCode"
              :options="rootOptions"
              option-label="label"
              option-value="value"
              size="small"
              aria-label="Родительская категория"
              :disabled="busy || hasChildren(category.code)"
              class="sm:col-start-2"
            />
          </form>
        </li>
      </ul>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import type { Category } from "../composables/useInternalCatalogCategories";
import { useInternalCatalogCategories } from "../composables/useInternalCatalogCategories";
import { useInternalAuth } from "~/features/internal-auth/composables/useInternalAuth";

defineOptions({ name: "InternalCatalogCategoriesScreen" });
const auth = useInternalAuth();
const enabled = ref(false);
const loadingSession = ref(true);
const busy = ref(false);
const actionError = ref("");
const newName = ref("");
const newParentCode = ref<string | null>(null);
const drafts = reactive<
  Record<string, { name: string; parentCode: string | null; sortOrder: number }>
>({});
const categories = useInternalCatalogCategories(enabled);
const authorized = computed(() => Boolean(auth.state.user?.permissions.includes("global_catalog")));
const categoryList = computed(() => categories.categoriesQuery.data.value ?? []);
const rootOptions = computed(() => [
  { label: "Корневая категория", value: null },
  ...categoryList.value
    .filter((item) => item.parentCode === null && item.isActive)
    .map((item) => ({ label: item.name, value: item.code })),
]);
const parentOptions = computed(() => [
  { label: "Корневая категория", value: null },
  ...rootOptions.value.slice(1),
]);

watch(
  categoryList,
  (items) => {
    for (const item of items) {
      drafts[item.code] = {
        name: item.name,
        parentCode: item.parentCode,
        sortOrder: item.sortOrder,
      };
    }
  },
  { immediate: true },
);

onMounted(async () => {
  await auth.loadSession();
  enabled.value = authorized.value;
  loadingSession.value = false;
});

async function create() {
  await run(async () => {
    await categories.create({
      name: newName.value,
      parentCode: newParentCode.value,
      sortOrder: nextOrder(),
    });
    newName.value = "";
  });
}

async function save(category: Category) {
  const draft = draftFor(category);
  await run(() =>
    categories.update(category.code, {
      ...(category.code !== "other" ? { name: draft.name } : {}),
      ...(category.code !== "other" ? { parentCode: draft.parentCode } : {}),
      sortOrder: draft.sortOrder,
    }),
  );
}

function draftFor(category: Category) {
  return (drafts[category.code] ??= {
    name: category.name,
    parentCode: category.parentCode ?? null,
    sortOrder: category.sortOrder,
  });
}

async function setActive(category: Category, active: boolean) {
  await run(() => categories.setActive(category.code, active));
}

async function run(operation: () => Promise<unknown>) {
  actionError.value = "";
  busy.value = true;
  try {
    await operation();
  } catch (error) {
    actionError.value = errorMessage(error);
  } finally {
    busy.value = false;
  }
}

function nextOrder() {
  const siblings = categoryList.value.filter((item) => item.parentCode === newParentCode.value);
  return siblings.reduce((max, item) => Math.max(max, item.sortOrder), -1) + 1;
}

function hasChildren(code: string) {
  return categoryList.value.some((item) => item.parentCode === code);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Не удалось выполнить операцию";
}
</script>
