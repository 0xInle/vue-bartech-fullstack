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
  </WorkspaceShell>
</template>

<script setup lang="ts">
import { computed } from "vue";
import WorkspaceShell from "~/features/workspace/components/WorkspaceShell.vue";
import { useVenueWorkspace } from "~/features/workspace/composables/useVenueWorkspace";
import { useProductArchive, type ArchiveItem } from "../composables/useProductArchive";
import { productTypeLabels } from "../product-links";

const { currentUser, errorMessage, loading, switchWorkspace, workspace, workplaces } =
  useVenueWorkspace();
const companyId = computed(() => workspace.value?.company.id ?? "");
const venueId = computed(() => workspace.value?.venue.id ?? "");
const basePath = computed(() => `/app/companies/${companyId.value}/venues/${venueId.value}`);
const route = useRoute();
const router = useRouter();
const typeOptions = Object.entries(productTypeLabels)
  .filter(([value]) => value !== "INGREDIENT")
  .map(([value, label]) => ({ value, label }));
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
</script>
