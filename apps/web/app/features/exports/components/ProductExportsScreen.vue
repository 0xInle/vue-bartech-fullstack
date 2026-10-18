<template>
  <section class="mx-auto max-w-5xl">
    <header class="mb-6">
      <p class="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Продукция</p>
      <h1 class="mt-2 text-2xl font-semibold tracking-tight">Выгрузка данных</h1>
      <p class="mt-2 text-sm text-color-secondary">
        Подготовьте PDF техкарты, пакет выбранных карточек или резервную копию продукции заведения.
      </p>
    </header>

    <template v-if="exportId">
      <LoadingIndicator v-if="exports.statusQuery.isLoading.value" screen />
      <Message v-else-if="exports.statusQuery.isError.value" severity="error" :closable="false">
        Запрос выгрузки недоступен. Проверьте доступ к рабочему пространству.
      </Message>
      <Message v-else-if="pageError" severity="error" :closable="false" class="mb-4">
        {{ pageError }}
      </Message>
      <div v-else-if="request" class="rounded-lg border border-surface p-5">
        <h2 class="text-lg font-semibold">{{ statusTitle(request.status) }}</h2>
        <p class="mt-2 text-sm text-color-secondary">
          {{ exportTypeLabel(request.type) }} · создано {{ formatDate(request.createdAt) }}
        </p>
        <Message v-if="request.status === 'FAILED'" severity="error" :closable="false" class="mt-4">
          Не удалось подготовить файл. Создайте новую выгрузку.
        </Message>
        <Message
          v-else-if="request.status === 'EXPIRED'"
          severity="warn"
          :closable="false"
          class="mt-4"
        >
          Срок хранения завершён. Создайте новую выгрузку.
        </Message>
        <div class="mt-5 flex flex-wrap gap-2">
          <Button
            v-if="request.status === 'READY'"
            label="Скачать файл"
            icon="pi pi-download"
            size="small"
            @click="download"
          />
          <Button
            v-if="['FAILED', 'EXPIRED', 'READY'].includes(request.status)"
            label="Новая выгрузка"
            icon="pi pi-plus"
            severity="secondary"
            outlined
            size="small"
            :to="basePath"
            as="router-link"
          />
        </div>
      </div>
    </template>

    <template v-else>
      <Message v-if="pageError" severity="error" :closable="false" class="mb-4">
        {{ pageError }}
      </Message>
      <LoadingIndicator v-if="productsQuery.isLoading.value" screen />
      <Message v-else-if="productsQuery.isError.value" severity="error" :closable="false">
        Не удалось загрузить продукцию. Проверьте доступ и повторите попытку.
        <Button label="Повторить" size="small" text @click="productsQuery.refetch()" />
      </Message>
      <template v-else>
        <div
          class="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-surface p-4"
        >
          <span class="text-sm font-medium">Тип продукции:</span>
          <label
            v-for="option in typeOptions"
            :key="option.value"
            class="flex items-center gap-2 text-sm"
          >
            <Checkbox
              v-model="visibleTypes"
              :input-id="`export-type-${option.value}`"
              :value="option.value"
            />
            <span>{{ option.label }}</span>
          </label>
        </div>

        <label v-if="canViewArchive" class="mb-4 flex items-center gap-2 text-sm">
          <Checkbox v-model="includeArchived" input-id="include-export-archive" binary />
          <span>Показывать и включать доступные архивные карточки</span>
        </label>

        <div class="mb-4 flex flex-wrap gap-2">
          <Button
            label="Скачать выбранные PDF в ZIP"
            icon="pi pi-file-export"
            size="small"
            :disabled="!selectedIds.length || creating"
            :loading="creating"
            @click="createBatch"
          />
          <Button
            label="Резервная выгрузка заведения"
            icon="pi pi-database"
            severity="secondary"
            outlined
            size="small"
            :disabled="creating || !canViewArchive"
            :loading="creatingBackup"
            @click="createBackup"
          />
        </div>

        <Message v-if="!canViewArchive" severity="info" :closable="false" class="mb-4">
          Для резервной выгрузки активных и архивных карточек нужен доступ к архиву.
        </Message>

        <div
          v-if="visibleProducts.length"
          class="divide-y divide-surface rounded-lg border border-surface"
        >
          <label
            v-for="product in visibleProducts"
            :key="product.id"
            class="flex cursor-pointer items-center gap-3 p-3"
          >
            <Checkbox
              v-model="selectedIds"
              :input-id="`export-product-${product.id}`"
              :value="product.id"
            />
            <span class="min-w-0 flex-1 truncate text-sm">{{ product.name }}</span>
            <span class="text-xs text-color-secondary">{{ productTypeLabel(product.type) }}</span>
            <span v-if="product.status === 'ARCHIVED'" class="text-xs text-color-secondary"
              >Архив</span
            >
          </label>
        </div>
        <Message v-else severity="secondary" :closable="false">
          По выбранным типам нет доступных техкарт.
        </Message>
      </template>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useQuery } from "@tanstack/vue-query";
import {
  productsControllerListArchive,
  productsControllerListCocktails,
  productsControllerListGarnishes,
  productsControllerListPreparations,
} from "@bartech/api-client";
import type {
  ArchiveListItemDto,
  CocktailListItemResponseDto,
  GarnishListItemResponseDto,
  PreparationListItemResponseDto,
} from "@bartech/api-client";
import { useIdentityFlow } from "~/features/identity/composables/useIdentityFlow";
import { useProductExports } from "../composables/useProductExports";
import { requestApi } from "~/utils/api-response";

const props = defineProps<{
  companyId: string;
  venueId: string;
  exportId?: string;
  permissions: string[];
}>();
const identity = useIdentityFlow();
const canViewArchive = computed(() => props.permissions.includes("view_archive"));
const company = computed(() => props.companyId);
const venue = computed(() => props.venueId);
const exports = useProductExports(company, venue, () => props.exportId ?? "");
const selectedIds = ref<string[]>([]);
const includeArchived = ref(false);
const visibleTypes = ref(["COCKTAIL", "PREPARATION", "GARNISH"]);
const creating = ref(false);
const creatingBackup = ref(false);
const pageError = ref("");
const typeOptions = [
  { label: "Коктейли", value: "COCKTAIL" },
  { label: "Заготовки", value: "PREPARATION" },
  { label: "Гарниры", value: "GARNISH" },
];
const basePath = computed(
  () => `/app/companies/${props.companyId}/venues/${props.venueId}/exports`,
);
const productsQuery = useQuery({
  queryKey: computed(() => [
    "product-export-options",
    props.companyId,
    props.venueId,
    includeArchived.value,
  ]),
  enabled: computed(() => Boolean(props.companyId && props.venueId && !props.exportId)),
  retry: false,
  queryFn: async ({ signal }): Promise<ExportProduct[]> => {
    const [cocktails, preparations, garnishes, archive] = await Promise.all([
      productsControllerListCocktails(
        props.companyId,
        props.venueId,
        undefined,
        { credentials: "include", signal },
        identity.apiFetch,
      ),
      productsControllerListPreparations(
        props.companyId,
        props.venueId,
        undefined,
        { credentials: "include", signal },
        identity.apiFetch,
      ),
      productsControllerListGarnishes(
        props.companyId,
        props.venueId,
        undefined,
        { credentials: "include", signal },
        identity.apiFetch,
      ),
      includeArchived.value && canViewArchive.value
        ? productsControllerListArchive(
            props.companyId,
            props.venueId,
            undefined,
            { credentials: "include", signal },
            identity.apiFetch,
          )
        : Promise.resolve({ data: [], status: 200 }),
    ]);
    const activeProducts = [
      ...(await requestApi<CocktailListItemResponseDto[]>(Promise.resolve(cocktails)).then(
        (items) =>
          items.map((item) => ({ ...item, type: "COCKTAIL" as const, status: "ACTIVE" as const })),
      )),
      ...(await requestApi<PreparationListItemResponseDto[]>(Promise.resolve(preparations)).then(
        (items) =>
          items.map((item) => ({
            ...item,
            type: "PREPARATION" as const,
            status: "ACTIVE" as const,
          })),
      )),
      ...(await requestApi<GarnishListItemResponseDto[]>(Promise.resolve(garnishes)).then((items) =>
        items.map((item) => ({ ...item, type: "GARNISH" as const, status: "ACTIVE" as const })),
      )),
    ];
    const archived = await requestApi<ArchiveListItemDto[]>(Promise.resolve(archive));
    return [
      ...activeProducts,
      ...archived.map((item) => ({ ...item, status: "ARCHIVED" as const })),
    ];
  },
});
const visibleProducts = computed(() =>
  (productsQuery.data.value ?? []).filter((product) => visibleTypes.value.includes(product.type)),
);
const selectedVisibleIds = computed(() => new Set(visibleProducts.value.map(({ id }) => id)));
const selectedVisible = computed(() =>
  selectedIds.value.filter((id) => selectedVisibleIds.value.has(id)),
);
const request = computed(() => exports.statusQuery.data.value ?? null);

async function createBatch(): Promise<void> {
  pageError.value = "";
  creating.value = true;
  try {
    const id = await exports.createBatch({
      productIds: selectedVisible.value,
      includeArchived: includeArchived.value,
    });
    await exports.open(id);
  } catch (error) {
    pageError.value =
      error instanceof Error ? error.message : "Не удалось создать запрос выгрузки.";
  } finally {
    creating.value = false;
  }
}

async function createBackup(): Promise<void> {
  pageError.value = "";
  creatingBackup.value = true;
  try {
    const id = await exports.createBackup();
    await exports.open(id);
  } catch (error) {
    pageError.value =
      error instanceof Error ? error.message : "Не удалось создать запрос выгрузки.";
  } finally {
    creatingBackup.value = false;
  }
}

async function download(): Promise<void> {
  try {
    await exports.download();
  } catch (error) {
    pageError.value =
      error instanceof Error ? error.message : "Не удалось получить ссылку на файл.";
  }
}

function statusTitle(status: string): string {
  return (
    {
      QUEUED: "В очереди",
      PROCESSING: "Подготавливаем файл",
      READY: "Файл готов",
      FAILED: "Не удалось подготовить файл",
      EXPIRED: "Срок хранения завершён",
    }[status] ?? "Состояние выгрузки"
  );
}

function exportTypeLabel(type: string): string {
  return (
    {
      SINGLE_PDF: "PDF техкарты",
      BATCH_PDF_ZIP: "ZIP с PDF техкарт",
      VENUE_BACKUP_ZIP: "Резервная выгрузка заведения",
    }[type] ?? "Выгрузка"
  );
}

function productTypeLabel(type: string): string {
  return typeOptions.find((item) => item.value === type)?.label ?? "Техкарта";
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}

type ExportProduct =
  | (CocktailListItemResponseDto & { type: "COCKTAIL"; status: "ACTIVE" })
  | (PreparationListItemResponseDto & { type: "PREPARATION"; status: "ACTIVE" })
  | (GarnishListItemResponseDto & { type: "GARNISH"; status: "ACTIVE" })
  | (ArchiveListItemDto & { status: "ARCHIVED" });
</script>
