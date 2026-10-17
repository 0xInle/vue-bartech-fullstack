<template>
  <main class="mx-auto max-w-6xl px-4 py-8 sm:px-6">
    <header class="mb-6">
      <NuxtLink to="/internal" class="text-sm font-semibold text-primary"
        >Внутренняя панель</NuxtLink
      >
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 class="mt-4 text-2xl font-semibold tracking-tight">Проверка ингредиентов каталога</h1>
          <p class="mt-2 text-sm text-color-secondary">
            Очередь содержит только локальную карточку ингредиента и данные сопоставления.
          </p>
        </div>
        <NuxtLink
          v-if="authorized"
          to="/internal/catalog/manage"
          class="text-sm font-semibold text-primary"
        >
          Управление каталогом
        </NuxtLink>
      </div>
    </header>

    <Message v-if="loadingSession" severity="info" :closable="false"
      >Проверяем внутреннюю сессию…</Message
    >
    <Message v-else-if="!authorized" severity="error" :closable="false"
      >Нет разрешения на управление глобальным каталогом.</Message
    >
    <Message v-else-if="error" severity="error" :closable="false">{{ error }}</Message>
    <Message v-else-if="catalog.candidatesQuery.isLoading.value" severity="info" :closable="false"
      >Загружаем кандидатов…</Message
    >
    <Message v-else-if="catalog.candidatesQuery.error.value" severity="error" :closable="false"
      >Не удалось загрузить очередь кандидатов.</Message
    >
    <Message
      v-else-if="!catalog.candidatesQuery.data.value?.items.length"
      severity="info"
      :closable="false"
      >В очереди нет кандидатов на проверку.</Message
    >
    <div v-else class="grid gap-6 lg:grid-cols-[minmax(16rem,0.8fr)_minmax(0,1.2fr)]">
      <section aria-label="Очередь кандидатов" class="space-y-3">
        <h2 class="text-lg font-semibold">Очередь</h2>
        <button
          v-for="candidate in catalog.candidatesQuery.data.value.items"
          :key="candidate.id"
          type="button"
          class="w-full rounded-lg border p-3 text-left"
          :class="
            selected?.id === candidate.id
              ? 'border-primary bg-primary-50'
              : 'border-surface bg-surface-0'
          "
          @click="select(candidate)"
        >
          <span class="block font-medium">{{ candidate.local.name }}</span>
          <span class="mt-1 block text-sm text-color-secondary"
            >{{ candidate.local.categoryCode }} · {{ reasonLabel(candidate.reason) }}</span
          >
        </button>
        <div class="flex justify-between">
          <Button
            label="Назад"
            severity="secondary"
            size="small"
            :disabled="catalog.page.value === 0"
            @click="catalog.page.value--"
          />
          <span class="self-center text-sm text-color-secondary"
            >Страница {{ catalog.page.value + 1 }}</span
          >
          <Button
            label="Дальше"
            severity="secondary"
            size="small"
            :disabled="!catalog.candidatesQuery.data.value?.hasMore"
            @click="catalog.page.value++"
          />
        </div>
      </section>

      <section
        v-if="selected"
        class="space-y-5 rounded-lg border border-surface bg-surface-0 p-4 sm:p-6"
      >
        <div>
          <h2 class="text-xl font-semibold">{{ selected.local.name }}</h2>
          <p class="mt-1 text-sm text-color-secondary">
            Основание: {{ reasonLabel(selected.reason)
            }}<span v-if="selected.confidence != null">
              · оценка {{ Math.round(selected.confidence * 100) }}%</span
            >
          </p>
          <dl class="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt class="text-color-secondary">Категория</dt>
              <dd>{{ selected.local.categoryCode }}</dd>
            </div>
            <div>
              <dt class="text-color-secondary">Бренд</dt>
              <dd>{{ selected.local.brand || "—" }}</dd>
            </div>
            <div>
              <dt class="text-color-secondary">Крепость</dt>
              <dd>{{ selected.local.strength ?? "—" }}</dd>
            </div>
            <div>
              <dt class="text-color-secondary">Страна</dt>
              <dd>{{ selected.local.country || "—" }}</dd>
            </div>
            <div>
              <dt class="text-color-secondary">Технический идентификатор</dt>
              <dd>{{ selected.local.externalIdentifier || "—" }}</dd>
            </div>
          </dl>
        </div>

        <div class="space-y-3 border-t border-surface pt-4">
          <h3 class="font-semibold">Связать с глобальным ингредиентом</h3>
          <InputText
            v-model="catalog.searchText.value"
            size="small"
            class="w-full"
            placeholder="Поиск по названию или подтверждённому алиасу"
          />
          <Message
            v-if="catalog.searchText.value.trim().length < 2"
            severity="info"
            :closable="false"
            >Введите не менее двух символов.</Message
          >
          <Message v-else-if="catalog.searchQuery.isLoading.value" severity="info" :closable="false"
            >Ищем в глобальном каталоге…</Message
          >
          <Message v-else-if="catalog.searchQuery.error.value" severity="error" :closable="false"
            >Не удалось выполнить поиск.</Message
          >
          <Message
            v-else-if="catalog.searchQuery.data.value?.length === 0"
            severity="info"
            :closable="false"
            >Совпадений не найдено.</Message
          >
          <ul v-else class="space-y-2">
            <li
              v-for="item in catalog.searchQuery.data.value"
              :key="item.id"
              class="flex flex-wrap items-center justify-between gap-3 rounded-md bg-surface-50 p-3"
            >
              <span
                ><strong>{{ item.name }}</strong
                ><span class="ml-2 text-sm text-color-secondary"
                  >{{ item.categoryCode
                  }}<template v-if="item.brand"> · {{ item.brand }}</template></span
                ></span
              >
              <Button
                label="Выбрать"
                size="small"
                :disabled="busy"
                @click="selectedGlobal = item"
              />
            </li>
          </ul>
          <div v-if="selectedGlobal" class="rounded-md border border-primary p-3 text-sm">
            Связать с «{{ selectedGlobal.name }}»?
            <div class="mt-2 flex gap-2">
              <Button
                label="Подтвердить связь"
                size="small"
                :loading="busy"
                @click="linkSelected"
              /><Button
                label="Отмена"
                severity="secondary"
                size="small"
                @click="selectedGlobal = null"
              />
            </div>
          </div>
        </div>

        <form class="space-y-3 border-t border-surface pt-4" @submit.prevent="requestCreate">
          <h3 class="font-semibold">Создать новый глобальный ингредиент</h3>
          <FloatLabel variant="on"
            ><InputText
              id="global-name"
              v-model="form.name"
              required
              maxlength="160"
              size="small"
              class="w-full"
            /><label for="global-name">Название</label></FloatLabel
          >
          <FloatLabel variant="on"
            ><Select
              v-model="form.categoryCode"
              :options="categories"
              option-label="name"
              option-value="code"
              required
              size="small"
              class="w-full"
            /><label for="global-category">Категория</label></FloatLabel
          >
          <FloatLabel variant="on"
            ><InputText
              id="global-brand"
              v-model="form.brand"
              maxlength="120"
              size="small"
              class="w-full"
            /><label for="global-brand">Бренд</label></FloatLabel
          >
          <div class="grid gap-3 sm:grid-cols-3">
            <FloatLabel variant="on"
              ><InputNumber
                v-model="form.strength"
                input-id="global-strength"
                :min="0"
                :max="100"
                :max-fraction-digits="2"
                size="small"
                class="w-full"
              /><label for="global-strength">Крепость</label></FloatLabel
            >
            <FloatLabel variant="on"
              ><InputText
                id="global-country"
                v-model="form.country"
                maxlength="80"
                size="small"
                class="w-full"
              /><label for="global-country">Страна</label></FloatLabel
            >
            <FloatLabel variant="on"
              ><InputText
                id="global-identifier"
                v-model="form.externalIdentifier"
                maxlength="120"
                size="small"
                class="w-full"
              /><label for="global-identifier">Идентификатор</label></FloatLabel
            >
          </div>
          <Button
            type="submit"
            label="Создать глобальный ингредиент"
            size="small"
            :disabled="busy"
          />
          <div v-if="confirmCreate" class="rounded-md border border-primary p-3 text-sm">
            Создать карточку и заменить ею ссылки только в исходном заведении?
            <div class="mt-2 flex gap-2">
              <Button
                label="Подтвердить создание"
                size="small"
                :loading="busy"
                @click="createSelected"
              /><Button
                label="Отмена"
                severity="secondary"
                size="small"
                @click="confirmCreate = false"
              />
            </div>
          </div>
        </form>

        <div class="border-t border-surface pt-4">
          <Button
            label="Оставить локальным"
            severity="secondary"
            size="small"
            :disabled="busy"
            @click="confirmKeep = true"
          />
          <div v-if="confirmKeep" class="mt-3 rounded-md border border-surface p-3 text-sm">
            Закрыть кандидата? Он вернётся в очередь только после изменения локальной карточки.
            <div class="mt-2 flex gap-2">
              <Button
                label="Подтвердить"
                size="small"
                :loading="busy"
                @click="keepSelected"
              /><Button
                label="Отмена"
                severity="secondary"
                size="small"
                @click="confirmKeep = false"
              />
            </div>
          </div>
        </div>
      </section>
      <Message v-else severity="info" :closable="false">Выберите кандидата из очереди.</Message>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import type {
  CatalogCandidateResponseDto,
  GlobalIngredientSearchItemDto,
} from "@bartech/api-client";
import { useInternalAuth } from "~/features/internal-auth/composables/useInternalAuth";
import { useInternalCatalog } from "../composables/useInternalCatalog";

defineOptions({ name: "InternalCatalogScreen" });
const auth = useInternalAuth();
const enabled = ref(false);
const loadingSession = ref(true);
const error = ref("");
const busy = ref(false);
const selected = ref<CatalogCandidateResponseDto | null>(null);
const selectedGlobal = ref<GlobalIngredientSearchItemDto | null>(null);
const confirmCreate = ref(false);
const confirmKeep = ref(false);
const form = reactive({
  name: "",
  categoryCode: "",
  brand: "",
  strength: null as number | null,
  country: "",
  externalIdentifier: "",
});
const catalog = useInternalCatalog(enabled);
const authorized = computed(() => Boolean(auth.state.user?.permissions.includes("global_catalog")));
const categories = ref<Array<{ code: string; name: string }>>([]);

onMounted(async () => {
  await auth.loadSession();
  enabled.value = authorized.value;
  loadingSession.value = false;
  if (enabled.value) {
    try {
      categories.value = await catalog.loadCategories();
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : "Не удалось загрузить категории";
    }
  }
});

function select(candidate: CatalogCandidateResponseDto) {
  selected.value = candidate;
  selectedGlobal.value = null;
  confirmCreate.value = false;
  confirmKeep.value = false;
  Object.assign(form, {
    name: candidate.local.name,
    categoryCode: candidate.local.categoryCode,
    brand: candidate.local.brand ?? "",
    strength: candidate.local.strength ? Number(candidate.local.strength) : null,
    country: candidate.local.country ?? "",
    externalIdentifier: candidate.local.externalIdentifier ?? "",
  });
}

function requestCreate() {
  confirmCreate.value = true;
}

async function run(action: () => Promise<unknown>) {
  error.value = "";
  busy.value = true;
  try {
    await action();
    selected.value = null;
    selectedGlobal.value = null;
    confirmCreate.value = false;
    confirmKeep.value = false;
  } catch (cause) {
    if (isCandidateUnavailable(cause)) {
      selected.value = null;
      selectedGlobal.value = null;
      confirmCreate.value = false;
      confirmKeep.value = false;
      error.value = "Кандидат больше недоступен. Очередь обновлена.";
    } else {
      error.value = cause instanceof Error ? cause.message : "Не удалось обработать кандидата";
    }
  } finally {
    busy.value = false;
  }
}

function isCandidateUnavailable(error: unknown): boolean {
  return (
    error instanceof Error && "code" in error && error.code === "CATALOG_CANDIDATE_UNAVAILABLE"
  );
}

function linkSelected() {
  if (selected.value && selectedGlobal.value)
    return run(() => catalog.link(selected.value!.id, selectedGlobal.value!.id));
}

function createSelected() {
  if (!selected.value) return;
  return run(() =>
    catalog.createGlobal(selected.value!.id, {
      name: form.name,
      categoryCode: form.categoryCode,
      brand: form.brand || undefined,
      strength: form.strength ?? undefined,
      country: form.country || undefined,
      externalIdentifier: form.externalIdentifier || undefined,
    }),
  );
}

function keepSelected() {
  if (selected.value) return run(() => catalog.keepLocal(selected.value!.id));
}

function reasonLabel(reason: string) {
  return (
    (
      {
        FUZZY_NAME: "похожее название",
        ATTRIBUTE_CONFLICT: "различаются характеристики",
        MULTIPLE_CANDIDATES: "несколько вариантов",
        NO_CONFIDENT_MATCH: "нет уверенного совпадения",
      } as Record<string, string>
    )[reason] ?? reason
  );
}
</script>
