<template>
  <div v-if="loading" class="w-full pt-8"><LoadingIndicator screen /></div>
  <div v-else-if="errorMessage" class="w-full pt-8">
    <Message severity="error" :closable="false" :pt="compactMessagePt">{{ errorMessage }}</Message>
  </div>
  <WorkspaceShell
    v-else-if="workspace && currentUser"
    :workspace="workspace"
    :workplaces="workplaces"
    :full-name="currentUser.fullName"
    @switch="switchWorkspace"
  >
    <section class="w-full">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <h1 class="text-xl font-semibold tracking-tight">Ингредиенты</h1>
        <Button
          v-if="canManage"
          label="Создать ингредиент"
          size="small"
          @click="openCreateDialog"
        />
      </div>
      <div class="mt-5 grid gap-3 pt-2 sm:grid-cols-[minmax(0,1fr)_14rem]">
        <FloatLabel variant="on" class="min-w-0">
          <IconField>
            <InputIcon class="pi pi-search" />
            <InputText
              id="local-ingredient-search"
              v-model="query"
              size="small"
              class="w-full"
              aria-label="Поиск ингредиентов по названию"
            />
          </IconField>
          <label for="local-ingredient-search" class="text-xs">Поиск по названию</label>
        </FloatLabel>
        <FloatLabel variant="on" class="min-w-0">
          <Select
            v-model="categoryFilter"
            input-id="local-ingredient-category-filter"
            :options="categoryOptions"
            option-label="name"
            option-value="name"
            size="small"
            class="w-full"
            show-clear
            fluid
            aria-label="Фильтр ингредиентов по категории"
          />
          <label for="local-ingredient-category-filter" class="text-xs">Категория</label>
        </FloatLabel>
      </div>
      <Message
        v-if="listQuery.isError.value"
        severity="error"
        :closable="false"
        :pt="compactMessagePt"
        class="mt-5"
      >
        Не удалось загрузить ингредиенты. Попробуйте обновить страницу.
      </Message>
      <div v-else-if="listQuery.isLoading.value" class="mt-5"><LoadingIndicator screen /></div>
      <div v-else-if="ingredients.length" class="mt-5">
        <DataTable
          :value="ingredients"
          data-key="id"
          size="small"
          row-hover
          class="product-list-table hidden text-sm md:block"
          :pt="tablePt"
        >
          <Column field="name" header="Название" :pt="columnPt">
            <template #body="{ data }"
              ><span class="font-medium">{{ data.name }}</span></template
            >
          </Column>
          <Column
            header="Категория"
            style="width: 1%; white-space: nowrap"
            header-class="px-2"
            body-class="px-2"
            :pt="columnPt"
          >
            <template #body="{ data }">{{ data.category || "—" }}</template>
          </Column>
          <Column
            header="Действие"
            style="width: 1%; white-space: nowrap"
            header-class="px-2"
            body-class="px-2"
            :pt="columnPt"
          >
            <template #body="{ data }">
              <div class="flex items-center gap-1" @click.stop>
                <Button
                  v-if="canManage"
                  v-tooltip.top="{ value: 'Редактировать', class: 'app-tooltip' }"
                  icon="pi pi-pencil"
                  size="small"
                  severity="secondary"
                  variant="text"
                  aria-label="Редактировать ингредиент"
                  @click="openRenameDialog(data)"
                />
                <PermanentDeleteActionButton
                  :company-id="companyId"
                  :venue-id="venueId"
                  :product-id="data.id"
                  :product-name="data.name"
                  product-type="INGREDIENT"
                  :can-manage="canDeletePermanently"
                  @deleted="listQuery.refetch()"
                />
              </div>
            </template>
          </Column>
        </DataTable>
        <div class="grid gap-3 md:hidden">
          <article
            v-for="item in ingredients"
            :key="item.id"
            class="rounded-lg border border-surface bg-surface-0 p-4"
            style="border-color: var(--p-content-border-color)"
          >
            <h2 class="text-sm font-semibold">{{ item.name }}</h2>
            <dl class="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
              <dt class="text-color-secondary">Категория</dt>
              <dd>{{ item.category || "—" }}</dd>
            </dl>
            <div class="mt-2 flex gap-1">
              <Button
                v-if="canManage"
                label="Редактировать"
                size="small"
                severity="secondary"
                variant="text"
                @click="openRenameDialog(item)"
              />
              <PermanentDeleteActionButton
                :company-id="companyId"
                :venue-id="venueId"
                :product-id="item.id"
                :product-name="item.name"
                product-type="INGREDIENT"
                :can-manage="canDeletePermanently"
                @deleted="listQuery.refetch()"
              />
            </div>
          </article>
        </div>
      </div>
      <div
        v-else
        class="mt-5 rounded-lg border border-dashed border-surface p-6 text-center"
        style="border-color: var(--p-content-border-color)"
      >
        <p class="text-xs text-color-secondary">
          {{
            hasFilters
              ? "По заданным условиям ингредиенты не найдены."
              : "Список ингредиентов пуст. Вы можете их создать, если не нашли в общей базе."
          }}
        </p>
      </div>
    </section>
    <Dialog
      v-model:visible="createDialogVisible"
      modal
      :closable="!createSaving"
      :close-on-escape="!createSaving"
      :dismissable-mask="!createSaving"
      :draggable="false"
      header="Создать ингредиент"
      class="dialog-size-sm"
      :pt="{ pcCloseButton: { root: { class: '!rounded-md' } } }"
    >
      <LocalIngredientCreateForm
        :key="createDialogKey"
        compact
        dialog-layout
        submit-label="Создать"
        category-select-append-to="body"
        :categories="ingredientCategories"
        :create="createLocalIngredient"
        @cancel="createDialogVisible = false"
        @created="handleIngredientCreated"
      />
      <Message v-if="referencesQuery.isError.value" severity="error" :closable="false" class="mt-3">
        Не удалось загрузить категории ингредиентов.
      </Message>
      <span v-if="referencesQuery.isLoading.value" class="mt-3 block text-xs text-color-secondary"
        >Загружаем категории ингредиентов…</span
      >
    </Dialog>
    <Dialog
      v-model:visible="renameDialogVisible"
      modal
      :closable="!renameSaving"
      :close-on-escape="!renameSaving"
      :dismissable-mask="!renameSaving"
      :draggable="false"
      header="Редактировать ингредиент"
      class="dialog-size-sm"
      :pt="{ pcCloseButton: { root: { class: '!rounded-md' } } }"
    >
      <Message v-if="renameError" severity="error" :closable="false" class="mb-4">
        {{ renameError }}
      </Message>
      <div class="flex flex-col gap-2">
        <div class="pt-2">
          <FloatLabel variant="on" class="w-full">
            <InputText
              id="local-ingredient-rename"
              v-model="renameValue"
              size="small"
              fluid
              :invalid="renameAttempted && !renameValue.trim()"
              maxlength="160"
              @keydown.enter.prevent="saveRename"
            />
            <label for="local-ingredient-rename" class="text-xs">Название</label>
          </FloatLabel>
        </div>
        <div class="pt-2">
          <FloatLabel variant="on" class="w-full min-w-0">
            <Select
              v-model="editCategoryCode"
              input-id="local-ingredient-edit-category"
              :options="editCategoryOptions"
              option-label="name"
              option-value="code"
              size="small"
              fluid
              :invalid="renameAttempted && !editCategoryCode"
            />
            <label for="local-ingredient-edit-category" class="text-xs">Категория</label>
          </FloatLabel>
        </div>
      </div>
      <template #footer>
        <Button
          label="Отмена"
          severity="secondary"
          variant="text"
          size="small"
          :disabled="renameSaving"
          @click="renameDialogVisible = false"
        />
        <Button label="Сохранить" size="small" :loading="renameSaving" @click="saveRename" />
      </template>
    </Dialog>
  </WorkspaceShell>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useQuery, useQueryClient } from "@tanstack/vue-query";
import {
  productsControllerCreateIngredient,
  productsControllerGetReferences,
  productsControllerUpdateLocalIngredientName,
} from "@bartech/api-client";
import type {
  ProductsControllerCreateIngredientMutationBody,
  productsControllerGetReferencesResponse200,
} from "@bartech/api-client";
import WorkspaceShell from "~/features/workspace/components/WorkspaceShell.vue";
import { useVenueWorkspace } from "~/features/workspace/composables/useVenueWorkspace";
import {
  useProductArchive,
  type LocalIngredient,
} from "~/features/archive/composables/useProductArchive";
import PermanentDeleteActionButton from "~/features/archive/components/PermanentDeleteActionButton.vue";
import LocalIngredientCreateForm from "./LocalIngredientCreateForm.vue";
import { useIdentityFlow } from "~/features/identity/composables/useIdentityFlow";
import { useProductAnalytics } from "~/features/analytics/composables/useProductAnalytics";
import { requestApi } from "~/utils/api-response";
import { compareCategoryNames } from "~/utils/category-order";
import { compactMessagePt } from "~/utils/primevue-message";
import IconField from "primevue/iconfield";
import InputIcon from "primevue/inputicon";

const { currentUser, errorMessage, loading, switchWorkspace, workspace, workplaces } =
  useVenueWorkspace();
const companyId = computed(() => workspace.value?.company.id ?? "");
const venueId = computed(() => workspace.value?.venue.id ?? "");
const query = ref("");
const categoryFilter = ref<string | null>(null);
const createDialogVisible = ref(false);
const createDialogKey = ref(0);
const createSaving = ref(false);
const renameDialogVisible = ref(false);
const renameSaving = ref(false);
const renameAttempted = ref(false);
const renameError = ref("");
const renameValue = ref("");
const editCategoryCode = ref("");
const editingIngredient = ref<LocalIngredient | null>(null);
const identity = useIdentityFlow();
const analytics = useProductAnalytics();
const queryClient = useQueryClient();
const canManage = computed(() => workspace.value?.permissions.includes("manage_products") ?? false);
const canDeletePermanently = computed(
  () => workspace.value?.permissions.includes("delete_products_permanently") ?? false,
);
const { localIngredients } = useProductArchive(companyId, venueId);
const listQuery = localIngredients(query);
const ingredients = computed(() => {
  return (listQuery.data.value ?? []).filter(
    (item) => !categoryFilter.value || item.category === categoryFilter.value,
  );
});
const categoryOptions = computed(() => {
  const names = new Set(
    (referencesQuery.data.value?.ingredientCategories ?? []).map((item) => item.name),
  );
  return [...names].sort(compareCategoryNames).map((name) => ({ name }));
});
const editCategoryOptions = computed(() => {
  const options = (referencesQuery.data.value?.ingredientCategories ?? []).map(
    ({ code, name }) => ({
      code,
      name,
    }),
  );
  if (
    editingIngredient.value &&
    !options.some((category) => category.code === editCategoryCode.value)
  ) {
    options.push({
      code: editCategoryCode.value,
      name: editingIngredient.value.category,
    });
  }
  return options.sort((first, second) => compareCategoryNames(first.name, second.name));
});
const hasFilters = computed(() => Boolean(query.value.trim() || categoryFilter.value));
const referencesQuery = useQuery({
  queryKey: computed(() => ["product-references", companyId.value, venueId.value, "client"]),
  enabled: computed(() => Boolean(companyId.value && venueId.value)),
  retry: false,
  queryFn: async ({ signal }) =>
    requestApi<productsControllerGetReferencesResponse200["data"]>(
      await productsControllerGetReferences(
        companyId.value,
        venueId.value,
        { credentials: "include", signal },
        identity.apiFetch,
      ),
    ),
});
const ingredientCategories = computed(() => referencesQuery.data.value?.ingredientCategories ?? []);

async function createLocalIngredient(input: ProductsControllerCreateIngredientMutationBody) {
  createSaving.value = true;
  try {
    await identity.refreshCsrf();
    const created = await requestApi(
      await productsControllerCreateIngredient(
        companyId.value,
        venueId.value,
        input,
        { credentials: "include", headers: { "x-csrf-token": identity.csrfToken.value } },
        identity.apiFetch,
      ),
    );
    void analytics.track({ eventType: "PRODUCT_CREATE_COMPLETED", productType: "INGREDIENT" });
    return created;
  } finally {
    createSaving.value = false;
  }
}

async function handleIngredientCreated(): Promise<void> {
  createDialogVisible.value = false;
  await listQuery.refetch();
}

function openCreateDialog(): void {
  createDialogKey.value += 1;
  createDialogVisible.value = true;
}

function openRenameDialog(item: LocalIngredient): void {
  const categories = referencesQuery.data.value?.ingredientCategories ?? [];
  const category =
    categories.find(({ code }) => code === item.categoryCode) ??
    categories.find(({ name }) => name === item.category);
  editingIngredient.value = item;
  renameValue.value = item.name;
  editCategoryCode.value = category?.code ?? item.categoryCode ?? "";
  renameAttempted.value = false;
  renameError.value = "";
  renameDialogVisible.value = true;
}

async function saveRename(): Promise<void> {
  renameAttempted.value = true;
  renameError.value = "";
  const name = renameValue.value.trim().replace(/\s+/gu, " ");
  if (!name || !editCategoryCode.value || !editingIngredient.value || renameSaving.value) return;
  renameSaving.value = true;
  try {
    await identity.refreshCsrf();
    await requestApi(
      await productsControllerUpdateLocalIngredientName(
        companyId.value,
        venueId.value,
        editingIngredient.value.id,
        { name, categoryCode: editCategoryCode.value },
        { credentials: "include", headers: { "x-csrf-token": identity.csrfToken.value } },
        identity.apiFetch,
      ),
    );
    renameDialogVisible.value = false;
    await queryClient.invalidateQueries({
      queryKey: ["local-ingredients", companyId.value, venueId.value],
    });
  } catch (error) {
    renameError.value =
      error instanceof Error ? error.message : "Не удалось сохранить изменения ингредиента.";
  } finally {
    renameSaving.value = false;
  }
}

const tablePt = {
  root: {
    style: {
      "--p-datatable-border-color": "var(--p-content-border-color)",
      "--p-datatable-header-cell-background": "transparent",
      "--p-datatable-row-background": "transparent",
      "--p-datatable-row-hover-background":
        "color-mix(in srgb, var(--p-primary-100) 70%, var(--p-content-background))",
      border: "1px solid var(--p-datatable-border-color)",
      borderRadius: "var(--p-content-border-radius)",
    },
  },
  headerCell: {
    class: "whitespace-nowrap px-1 py-1 text-sm",
    style: {
      borderTop: "0",
      borderRight: "0",
      borderLeft: "0",
      borderBottom: "1px solid var(--p-content-border-color)",
      fontWeight: "400",
    },
  },
  bodyCell: {
    class: "px-1 py-1 text-sm",
    style: {
      borderTop: "0",
      borderRight: "0",
      borderLeft: "0",
      borderBottom: "1px solid var(--p-content-border-color)",
    },
  },
};
const columnPt = { bodyCell: { style: { paddingBlock: "0" } } };
</script>

<style scoped>
:deep(.product-list-table .p-datatable-tbody > tr:last-child > td) {
  border-block-end-width: 0;
}
</style>
