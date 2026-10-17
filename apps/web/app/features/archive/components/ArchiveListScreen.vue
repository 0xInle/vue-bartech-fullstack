<template>
  <div v-if="loading" class="mx-auto max-w-5xl pt-8"><Skeleton height="12rem" /></div>
  <Message v-else-if="errorMessage" severity="error" :closable="false">{{ errorMessage }}</Message>
  <WorkspaceShell
    v-else-if="workspace && currentUser"
    :workspace="workspace"
    :workplaces="workplaces"
    :full-name="currentUser.fullName"
    @switch="switchWorkspace"
  >
    <section class="mx-auto max-w-5xl">
      <header class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 class="text-xl font-semibold">Архив</h1>
          <p class="mt-2 text-sm text-color-secondary">
            Архивные карточки текущего заведения. Их нельзя использовать в новых техкартах.
          </p>
        </div>
        <Button
          v-if="canManage"
          label="Архивировать локальный ингредиент"
          icon="pi pi-inbox"
          size="small"
          severity="secondary"
          variant="outlined"
          @click="ingredientDialogVisible = true"
        />
      </header>
      <Message v-if="route.query.restored === '1'" severity="success" :closable="false" class="mt-4"
        >Ингредиент восстановлен и доступен для выбора в техкартах.</Message
      >
      <div class="mt-5 flex flex-col gap-3 sm:flex-row">
        <InputText
          v-model="query"
          placeholder="Найти по названию"
          aria-label="Поиск в архиве"
          size="small"
          class="min-w-0 flex-1"
          maxlength="160"
        />
        <Select
          v-model="type"
          :options="typeOptions"
          option-label="label"
          option-value="value"
          placeholder="Все типы"
          show-clear
          size="small"
          aria-label="Тип продукции"
          class="sm:w-56"
        />
      </div>
      <Message v-if="listQuery.isError.value" severity="error" :closable="false" class="mt-5"
        >Не удалось загрузить архив.
        <Button label="Повторить" size="small" variant="link" @click="listQuery.refetch()"
      /></Message>
      <Skeleton v-else-if="listQuery.isLoading.value" class="mt-5" height="10rem" />
      <p v-else-if="!listQuery.data.value?.length" class="mt-6 text-sm text-color-secondary">
        {{
          query || type
            ? "По выбранным условиям ничего не найдено."
            : "В архиве пока нет продукции."
        }}
      </p>
      <ul v-else class="mt-5 divide-y divide-surface border-y border-surface">
        <li v-for="product in listQuery.data.value" :key="product.id">
          <NuxtLink
            :to="`${basePath}/archive/${product.id}`"
            class="flex items-center justify-between gap-3 py-3 text-sm hover:text-primary"
          >
            <div>
              <p class="font-medium">{{ product.name }}</p>
              <p class="mt-1 text-xs text-color-secondary">{{ productTypeLabels[product.type] }}</p>
            </div>
            <Tag value="В архиве" severity="secondary" />
          </NuxtLink>
        </li>
      </ul>
    </section>
    <Dialog
      v-model:visible="ingredientDialogVisible"
      modal
      header="Архивировать локальный ингредиент"
      class="w-full max-w-lg"
    >
      <p class="mb-4 text-sm text-color-secondary">
        Найдите временный ингредиент этого заведения. Глобальный каталог здесь не показывается.
      </p>
      <AutoComplete
        v-model="ingredient"
        :suggestions="ingredientQuery.data.value ?? []"
        option-label="name"
        size="small"
        fluid
        :delay="250"
        :loading="ingredientQuery.isFetching.value"
        :force-selection="true"
        placeholder="Название ингредиента"
        aria-label="Название локального ингредиента"
        @complete="ingredientSearch = $event.query"
      />
      <Message v-if="ingredientQuery.isError.value" severity="error" :closable="false" class="mt-3"
        >Не удалось выполнить поиск.</Message
      >
      <p
        v-else-if="
          ingredientSearch.length >= 2 &&
          !ingredientQuery.isFetching.value &&
          !ingredientQuery.data.value?.length
        "
        class="mt-3 text-sm text-color-secondary"
      >
        Локальные ингредиенты не найдены.
      </p>
      <div v-if="ingredient && typeof ingredient !== 'string'" class="mt-4">
        <ArchiveActionButton
          :company-id="companyId"
          :venue-id="venueId"
          :product-id="ingredient.id"
          product-type="INGREDIENT"
          :product-name="ingredient.name"
          :can-manage="canManage"
          @archived="ingredientDialogVisible = false"
        />
      </div>
    </Dialog>
  </WorkspaceShell>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { productsControllerListArchiveIngredientOptions } from "@bartech/api-client";
import type { productsControllerListArchiveIngredientOptionsResponse200 } from "@bartech/api-client";
import WorkspaceShell from "~/features/workspace/components/WorkspaceShell.vue";
import { useVenueWorkspace } from "~/features/workspace/composables/useVenueWorkspace";
import { useIdentityFlow } from "~/features/identity/composables/useIdentityFlow";
import { requestApi } from "~/utils/api-response";
import { useProductArchive, type ArchiveItem } from "../composables/useProductArchive";
import { productTypeLabels } from "../product-links";
import ArchiveActionButton from "./ArchiveActionButton.vue";

const { currentUser, errorMessage, loading, switchWorkspace, workspace, workplaces } =
  useVenueWorkspace();
const companyId = computed(() => workspace.value?.company.id ?? "");
const venueId = computed(() => workspace.value?.venue.id ?? "");
const basePath = computed(() => `/app/companies/${companyId.value}/venues/${venueId.value}`);
const route = useRoute();
const router = useRouter();
const typeOptions = Object.entries(productTypeLabels).map(([value, label]) => ({ value, label }));
const query = computed({
  get: () => (typeof route.query.query === "string" ? route.query.query : ""),
  set: (value: string) => {
    void router.replace({ query: { ...route.query, query: value || undefined } });
  },
});
const type = computed({
  get: () =>
    typeOptions.some((item) => item.value === route.query.type)
      ? (route.query.type as ArchiveItem["type"])
      : undefined,
  set: (value: ArchiveItem["type"] | undefined) => {
    void router.replace({ query: { ...route.query, type: value || undefined } });
  },
});
const { list } = useProductArchive(companyId, venueId);
const listQuery = list(query, type);
const canManage = computed(
  () => workspace.value?.permissions.includes("manage_product_archive") ?? false,
);
const ingredientDialogVisible = ref(false);
const ingredientSearch = ref("");
type IngredientOption = productsControllerListArchiveIngredientOptionsResponse200["data"][number];
const ingredient = ref<IngredientOption | string | null>(null);
const identity = useIdentityFlow();
const ingredientQuery = useQuery({
  queryKey: computed(() => [
    "archive-ingredient-options",
    companyId.value,
    venueId.value,
    ingredientSearch.value.trim(),
  ]),
  enabled: computed(
    () =>
      ingredientDialogVisible.value && canManage.value && ingredientSearch.value.trim().length >= 2,
  ),
  retry: false,
  queryFn: ({ signal }) =>
    requestApi<IngredientOption[]>(
      productsControllerListArchiveIngredientOptions(
        companyId.value,
        venueId.value,
        { query: ingredientSearch.value.trim() },
        { credentials: "include", signal },
        identity.apiFetch,
      ),
    ),
});
watch(ingredientDialogVisible, (open) => {
  if (open) {
    ingredient.value = null;
    ingredientSearch.value = "";
  }
});
</script>
