<template>
  <main class="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
    <header>
      <NuxtLink to="/internal" class="text-sm font-semibold text-primary"
        >Внутренняя панель</NuxtLink
      >
      <h1 class="text-xl mt-4 font-semibold tracking-tight">Управление глобальным каталогом</h1>
      <p class="mt-2 text-sm text-color-secondary">
        Карточки и алиасы каталога. Сведения о заведениях и рецептурах здесь не отображаются.
      </p>
      <NuxtLink
        to="/internal/catalog/categories"
        class="mt-3 inline-block text-sm font-semibold text-primary"
        >Управление категориями</NuxtLink
      >
    </header>

    <LoadingIndicator v-if="loadingSession" screen />
    <Message v-else-if="!authorized" severity="error" :closable="false">
      Нет разрешения на управление глобальным каталогом.
    </Message>
    <Message v-else-if="error" severity="error" :closable="false">{{ error }}</Message>

    <div v-else class="grid gap-6 lg:grid-cols-[minmax(18rem,0.75fr)_minmax(0,1.25fr)]">
      <Message v-if="actionError" class="lg:col-span-2" severity="error" :closable="false">
        {{ actionError }}
      </Message>
      <section class="space-y-4">
        <div class="flex flex-wrap gap-2">
          <InputText
            v-model="catalog.searchText.value"
            size="small"
            class="min-w-48 flex-1"
            placeholder="Поиск по названию или подтверждённому алиасу"
          />
          <Select
            v-model="catalog.status.value"
            :options="statusOptions"
            option-label="label"
            option-value="value"
            size="small"
            aria-label="Статус карточек"
          />
        </div>
        <LoadingIndicator v-if="catalog.listQuery.isLoading.value" screen />
        <Message v-else-if="catalog.listQuery.error.value" severity="error" :closable="false"
          >Не удалось загрузить каталог.</Message
        >
        <Message
          v-else-if="!catalog.listQuery.data.value?.items.length"
          severity="info"
          :closable="false"
          >Карточки не найдены.</Message
        >
        <ul v-else class="space-y-2">
          <li v-for="item in catalog.listQuery.data.value.items" :key="item.id">
            <button
              type="button"
              class="w-full rounded-lg border p-3 text-left"
              :class="
                catalog.selectedId.value === item.id
                  ? 'border-primary bg-primary-50'
                  : 'border-surface bg-surface-0'
              "
              @click="select(item.id)"
            >
              <span class="flex items-center justify-between gap-2 font-medium">
                {{ item.name }}
                <Tag v-if="item.status === 'ARCHIVED'" value="Архив" severity="secondary" />
              </span>
              <span class="mt-1 block text-sm text-color-secondary"
                >{{ item.categoryCode
                }}<template v-if="item.brand"> · {{ item.brand }}</template></span
              >
            </button>
          </li>
        </ul>
        <div class="flex items-center justify-between">
          <Button
            label="Назад"
            severity="secondary"
            size="small"
            :disabled="catalog.page.value === 0"
            @click="catalog.page.value--"
          />
          <span class="text-sm text-color-secondary">Страница {{ catalog.page.value + 1 }}</span>
          <Button
            label="Дальше"
            severity="secondary"
            size="small"
            :disabled="!catalog.listQuery.data.value?.hasMore"
            @click="catalog.page.value++"
          />
        </div>
      </section>

      <section
        v-if="card"
        class="space-y-6 rounded-lg border border-surface bg-surface-0 p-4 sm:p-6"
      >
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h2 class="text-base font-semibold">{{ card.name }}</h2>
          <Tag
            :value="card.status === 'ACTIVE' ? 'Активная' : 'Архивная'"
            :severity="card.status === 'ACTIVE' ? 'success' : 'secondary'"
          />
        </div>
        <Message v-if="card.status !== 'ACTIVE'" severity="info" :closable="false"
          >Архивную карточку можно выбрать только как дубликат при слиянии.</Message
        >

        <form class="space-y-3" @submit.prevent="saveCard">
          <h3 class="text-sm font-semibold">Данные карточки</h3>
          <FloatLabel variant="on"
            ><InputText
              id="manage-name"
              v-model="form.name"
              required
              maxlength="160"
              size="small"
              class="w-full"
              :disabled="!editable || busy"
            /><label for="manage-name">Официальное название</label></FloatLabel
          >
          <FloatLabel variant="on"
            ><Select
              v-model="form.categoryCode"
              input-id="manage-category"
              :options="categoryOptions"
              option-label="name"
              option-value="code"
              required
              size="small"
              class="w-full"
              :disabled="!editable || busy"
            /><label for="manage-category">Системная категория</label></FloatLabel
          >
          <Message v-if="!card.categoryIsActive" severity="warn" :closable="false">
            Текущая категория «{{ card.categoryName }}» неактивна. Её можно сохранить без изменения
            или выбрать активную категорию.
          </Message>
          <FloatLabel variant="on"
            ><InputText
              id="manage-brand"
              v-model="form.brand"
              maxlength="120"
              size="small"
              class="w-full"
              :disabled="!editable || busy"
            /><label for="manage-brand">Бренд</label></FloatLabel
          >
          <div class="grid gap-3 sm:grid-cols-3">
            <FloatLabel variant="on"
              ><InputNumber
                v-model="form.strength"
                input-id="manage-strength"
                :min="0"
                :max="100"
                :max-fraction-digits="2"
                size="small"
                class="w-full"
                :disabled="!editable || busy"
              /><label for="manage-strength">Крепость</label></FloatLabel
            >
            <FloatLabel variant="on"
              ><InputText
                id="manage-country"
                v-model="form.country"
                maxlength="80"
                size="small"
                class="w-full"
                :disabled="!editable || busy"
              /><label for="manage-country">Страна</label></FloatLabel
            >
            <FloatLabel variant="on"
              ><InputText
                id="manage-identifier"
                v-model="form.externalIdentifier"
                maxlength="120"
                size="small"
                class="w-full"
                :disabled="!editable || busy"
              /><label for="manage-identifier">Технический идентификатор</label></FloatLabel
            >
          </div>
          <Button
            type="submit"
            label="Сохранить карточку"
            size="small"
            :disabled="!editable || busy"
            :loading="busy"
          />
        </form>

        <section class="space-y-3 border-t border-surface pt-4">
          <h3 class="text-sm font-semibold">Алиасы</h3>
          <p class="text-sm text-color-secondary">
            Новые алиасы не участвуют в поиске, пока их отдельно не подтвердят.
          </p>
          <form class="flex gap-2" @submit.prevent="addAlias">
            <InputText
              v-model="aliasValue"
              maxlength="160"
              size="small"
              class="min-w-0 flex-1"
              placeholder="Альтернативное название"
              :disabled="!editable || busy"
            />
            <Button
              type="submit"
              label="Добавить"
              size="small"
              :disabled="!editable || busy || !aliasValue.trim()"
            />
          </form>
          <ul class="space-y-2">
            <li
              v-for="alias in card.aliases"
              :key="alias.id"
              class="flex flex-wrap items-center justify-between gap-2 rounded-md bg-surface-50 p-3"
            >
              <span>{{ alias.value }}</span>
              <div class="flex flex-wrap items-center gap-2">
                <Tag
                  :value="alias.isConfirmed ? 'Подтверждён' : 'Не подтверждён'"
                  :severity="alias.isConfirmed ? 'success' : 'secondary'"
                />
                <Button
                  v-if="!alias.isConfirmed"
                  label="Подтвердить"
                  size="small"
                  severity="secondary"
                  :disabled="!editable || busy"
                  @click="run(() => catalog.confirmAlias(catalog.selectedId.value, alias.id))"
                />
                <Button
                  v-if="deleteAliasId !== alias.id"
                  label="Удалить"
                  size="small"
                  severity="danger"
                  text
                  :disabled="!editable || busy"
                  @click="deleteAliasId = alias.id"
                />
                <template v-else>
                  <Button
                    label="Подтвердить удаление"
                    size="small"
                    severity="danger"
                    :disabled="busy"
                    @click="run(() => catalog.deleteAlias(catalog.selectedId.value, alias.id))"
                  />
                  <Button
                    label="Отмена"
                    size="small"
                    severity="secondary"
                    text
                    @click="deleteAliasId = ''"
                  />
                </template>
              </div>
            </li>
          </ul>
        </section>

        <section class="space-y-3 border-t border-surface pt-4">
          <h3 class="text-sm font-semibold">Слияние дубликатов</h3>
          <p class="text-sm text-color-secondary">
            Выберите каноническую карточку и карточку-дубликат. Ссылки всех заведений будут
            перенесены автоматически.
          </p>
          <div class="grid gap-3 sm:grid-cols-2">
            <FloatLabel variant="on"
              ><Select
                v-model="mergeCanonicalId"
                input-id="merge-canonical"
                :options="activeCards"
                option-label="name"
                option-value="id"
                size="small"
                class="w-full"
                :disabled="busy"
              /><label for="merge-canonical">Каноническая карточка</label></FloatLabel
            >
            <FloatLabel variant="on"
              ><Select
                v-model="mergeDuplicateId"
                input-id="merge-duplicate"
                :options="duplicateCards"
                option-label="name"
                option-value="id"
                size="small"
                class="w-full"
                :disabled="busy"
              /><label for="merge-duplicate">Дубликат</label></FloatLabel
            >
          </div>
          <Button
            label="Предварительный просмотр"
            size="small"
            severity="secondary"
            :disabled="
              busy ||
              !mergeCanonicalId ||
              !mergeDuplicateId ||
              mergeCanonicalId === mergeDuplicateId
            "
            @click="loadPreview"
          />
          <div v-if="preview" class="space-y-3 rounded-md border border-surface p-3 text-sm">
            <p>
              <strong>Останется:</strong> {{ preview.canonical.name }}. Значения карточки-дубликата
              заполнят только пустые поля.
            </p>
            <p>
              <strong>Удалится:</strong> {{ preview.duplicate.name }} ({{
                preview.duplicate.status === "ACTIVE" ? "активная" : "архивная"
              }}).
            </p>
            <p>
              Переносится ссылок во всех заведениях: <strong>{{ preview.referenceCount }}</strong
              >.
            </p>
            <p v-if="preview.aliasesToMove.length">
              Переносимые алиасы:
              {{ preview.aliasesToMove.map((alias) => alias.value).join(", ") }}.
            </p>
            <p v-if="preview.oldNameAlias">
              Название дубликата станет подтверждённым алиасом: {{ preview.oldNameAlias }}.
            </p>
            <Message v-if="preview.conflicts.length" severity="error" :closable="false">
              Слияние заблокировано конфликтом с карточкой «{{ preview.conflicts[0]?.name }}».
              Сначала разрешите конфликт.
            </Message>
            <template v-else>
              <Message severity="warn" :closable="false"
                >После подтверждения карточка-дубликат будет удалена, а все её ссылки заменены
                канонической.</Message
              >
              <Button
                label="Подтвердить слияние"
                size="small"
                severity="danger"
                :disabled="busy"
                :loading="busy"
                @click="confirmMerge"
              />
            </template>
          </div>
        </section>
      </section>
      <LoadingIndicator
        v-else-if="catalog.selectedId.value && catalog.cardQuery.isLoading.value"
        screen
      />
      <Message v-else-if="catalog.cardQuery.error.value" severity="error" :closable="false"
        >Не удалось загрузить карточку.</Message
      >
      <Message v-else severity="info" :closable="false">Выберите глобальный ингредиент.</Message>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import type { GlobalIngredientCardDto } from "@bartech/api-client";
import { useInternalAuth } from "~/features/internal-auth/composables/useInternalAuth";
import { useInternalCatalogManagement } from "../composables/useInternalCatalogManagement";

defineOptions({ name: "InternalCatalogManagementScreen" });
const apiFetch = useApiFetch();
const auth = useInternalAuth();
const enabled = ref(false);
const loadingSession = ref(true);
const busy = ref(false);
const error = ref("");
const actionError = ref("");
const aliasValue = ref("");
const deleteAliasId = ref("");
const categories = ref<Array<{ code: string; name: string; isActive: boolean }>>([]);
const preview = ref<Awaited<
  ReturnType<ReturnType<typeof useInternalCatalogManagement>["previewMerge"]>
> | null>(null);
const mergeCanonicalId = ref("");
const mergeDuplicateId = ref("");
const form = reactive({
  name: "",
  categoryCode: "",
  brand: "",
  strength: null as number | null,
  country: "",
  externalIdentifier: "",
});
const catalog = useInternalCatalogManagement(enabled);
const authorized = computed(() => Boolean(auth.state.user?.permissions.includes("global_catalog")));
const card = computed<GlobalIngredientCardDto | null>(() => catalog.cardQuery.data.value ?? null);
const categoryOptions = computed(() => {
  const active = categories.value.filter((category) => category.isActive);
  if (card.value && !card.value.categoryIsActive) {
    return [
      ...active,
      { code: card.value.categoryCode, name: card.value.categoryName, isActive: false },
    ];
  }
  return active;
});
const editable = computed(() => card.value?.status === "ACTIVE");
const statusOptions = [
  { label: "Активные", value: "ACTIVE" },
  { label: "Все статусы", value: "ALL" },
];
const activeCards = computed(() =>
  (catalog.listQuery.data.value?.items ?? []).filter((item) => item.status === "ACTIVE"),
);
const duplicateCards = computed(() => catalog.listQuery.data.value?.items ?? []);

watch(catalog.status, () => {
  catalog.page.value = 0;
});

watch(card, (value) => {
  preview.value = null;
  deleteAliasId.value = "";
  if (!value) return;
  Object.assign(form, {
    name: value.name,
    categoryCode: value.categoryCode,
    brand: value.brand ?? "",
    strength: value.strength ? Number(value.strength) : null,
    country: value.country ?? "",
    externalIdentifier: value.externalIdentifier ?? "",
  });
  mergeCanonicalId.value = value.status === "ACTIVE" ? value.id : "";
  mergeDuplicateId.value = "";
});

onMounted(async () => {
  await auth.loadSession();
  enabled.value = authorized.value;
  loadingSession.value = false;
  if (!enabled.value) return;
  try {
    const response = await apiFetch("/api/v1/internal/catalog/manage/categories", {
      credentials: "include",
    });
    if (!response.ok) throw new Error("Не удалось загрузить категории");
    categories.value = (await response.json()) as typeof categories.value;
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "Не удалось загрузить категории";
  }
});

function select(productId: string) {
  catalog.select(productId);
}

async function run(action: () => Promise<unknown>) {
  actionError.value = "";
  busy.value = true;
  try {
    await action();
    aliasValue.value = "";
    deleteAliasId.value = "";
  } catch (cause) {
    if (
      cause instanceof Error &&
      "code" in cause &&
      (cause.code === "CATALOG_MERGE_STALE" || cause.code === "CATALOG_MERGE_CONFLICT")
    ) {
      preview.value = null;
      await catalog.refresh(catalog.selectedId.value);
    }
    actionError.value = cause instanceof Error ? cause.message : "Не удалось выполнить операцию";
  } finally {
    busy.value = false;
  }
}

function saveCard() {
  if (!card.value) return;
  return run(() =>
    catalog.update(card.value!.id, {
      name: form.name,
      categoryCode: form.categoryCode,
      brand: form.brand || null,
      strength: form.strength,
      country: form.country || null,
      externalIdentifier: form.externalIdentifier || null,
    }),
  );
}

function addAlias() {
  if (!card.value || !aliasValue.value.trim()) return;
  return run(() => catalog.addAlias(card.value!.id, { value: aliasValue.value }));
}

async function loadPreview() {
  if (!mergeCanonicalId.value || !mergeDuplicateId.value) return;
  await run(async () => {
    preview.value = await catalog.previewMerge({
      canonicalId: mergeCanonicalId.value,
      duplicateId: mergeDuplicateId.value,
    });
  });
}

async function confirmMerge() {
  if (!preview.value) return;
  await run(async () => {
    await catalog.merge({
      canonicalId: preview.value!.canonical.id,
      duplicateId: preview.value!.duplicate.id,
      canonicalUpdatedAt: preview.value!.canonical.updatedAt,
      duplicateUpdatedAt: preview.value!.duplicate.updatedAt,
    });
    preview.value = null;
  });
}
</script>
