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
    <section class="mx-auto max-w-3xl">
      <NuxtLink :to="`${basePath}/archive`" class="text-sm text-primary hover:underline"
        >← Архив</NuxtLink
      >
      <Message v-if="cardQuery.isError.value" severity="error" :closable="false" class="mt-5"
        >У вас нет доступа или материал больше не существует.</Message
      >
      <Skeleton v-else-if="cardQuery.isLoading.value" class="mt-5" height="12rem" />
      <article v-else-if="product" class="mt-5">
        <header class="border-b border-surface pb-4">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p class="text-xs font-semibold uppercase text-primary">
                {{ productTypeLabels[product.type] }} · В архиве
              </p>
              <h1 class="text-xl mt-2 font-semibold">{{ product.name }}</h1>
            </div>
            <Button
              v-if="canManage"
              label="Восстановить"
              icon="pi pi-refresh"
              size="small"
              @click="restoreVisible = true"
            />
          </div>
          <p class="mt-3 text-sm text-color-secondary">
            Карточка доступна только для чтения. Для изменения сначала восстановите её.
          </p>
          <dl class="mt-3 flex flex-wrap gap-3 text-sm text-color-secondary">
            <div v-if="product.category">
              <dt class="inline">Категория:</dt>
              <dd class="inline">{{ product.category }}</dd>
            </div>
            <div v-if="product.brand">
              <dt class="inline">Бренд:</dt>
              <dd class="inline">{{ product.brand }}</dd>
            </div>
            <div v-if="product.strength !== null">
              <dt class="inline">Крепость:</dt>
              <dd class="inline">{{ product.strength }}%</dd>
            </div>
            <div v-if="product.country">
              <dt class="inline">Страна:</dt>
              <dd class="inline">{{ product.country }}</dd>
            </div>
            <div v-if="product.externalIdentifier">
              <dt class="inline">Идентификатор:</dt>
              <dd class="inline">{{ product.externalIdentifier }}</dd>
            </div>
            <div v-if="product.glass">
              <dt class="inline">Посуда:</dt>
              <dd class="inline">{{ product.glass }}</dd>
            </div>
            <div v-if="product.ice">
              <dt class="inline">Лёд:</dt>
              <dd class="inline">{{ product.ice }}</dd>
            </div>
            <div v-if="product.preparationMethod">
              <dt class="inline">Метод:</dt>
              <dd class="inline">{{ product.preparationMethod }}</dd>
            </div>
          </dl>
        </header>
        <section v-if="product.components.length" class="border-b border-surface py-4">
          <h2 class="text-base font-semibold">Состав</h2>
          <ul class="mt-2 divide-y divide-surface">
            <li
              v-for="component in product.components"
              :key="component.id"
              class="flex justify-between gap-3 py-2 text-sm"
            >
              <span
                ><NuxtLink
                  v-if="componentPath(component.productId, component.productType, component.status)"
                  :to="componentPath(component.productId, component.productType, component.status)!"
                  class="text-primary hover:underline"
                  >{{ component.name }}</NuxtLink
                ><span v-else>{{ component.name }}</span
                ><span
                  v-if="component.status === 'ARCHIVED'"
                  class="ml-2 text-xs text-color-secondary"
                  >В архиве</span
                ></span
              >
              <span class="whitespace-nowrap text-color-secondary"
                >{{ component.amount }} {{ component.unit }}</span
              >
            </li>
          </ul>
        </section>
        <section v-if="product.garnishes.length" class="border-b border-surface py-4">
          <h2 class="text-base font-semibold">Гарниры</h2>
          <ul class="mt-2 space-y-2 text-sm">
            <li v-for="garnish in product.garnishes" :key="garnish.id">
              <span v-if="garnish.kind === 'QUICK'">{{ garnish.name }}</span>
              <NuxtLink
                v-else
                :to="componentPath(garnish.id, garnish.type, garnish.status)!"
                class="text-primary hover:underline"
                >{{ garnish.name }}</NuxtLink
              ><span v-if="garnish.status === 'ARCHIVED'" class="ml-2 text-xs text-color-secondary"
                >В архиве</span
              >
            </li>
          </ul>
        </section>
        <section v-if="product.technology" class="border-b border-surface py-4">
          <h2 class="text-base font-semibold">Технология приготовления</h2>
          <p class="mt-2 whitespace-pre-line text-sm leading-6">{{ product.technology }}</p>
        </section>
        <section v-if="product.output || product.comment" class="py-4">
          <p v-if="product.output" class="text-sm">
            Фактический выход: {{ product.output.amount }} {{ product.output.unit }}
          </p>
          <p v-if="product.comment" class="mt-3 whitespace-pre-line text-sm text-color-secondary">
            {{ product.comment }}
          </p>
        </section>
      </article>
    </section>
    <ArchiveRestoreDialog
      v-if="canManage && product"
      v-model:visible="restoreVisible"
      :company-id="companyId"
      :venue-id="venueId"
      :product-id="product.id"
      :product-type="product.type"
    />
  </WorkspaceShell>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import WorkspaceShell from "~/features/workspace/components/WorkspaceShell.vue";
import { useVenueWorkspace } from "~/features/workspace/composables/useVenueWorkspace";
import { useProductArchive } from "../composables/useProductArchive";
import { activeProductPath, productTypeLabels } from "../product-links";
import ArchiveRestoreDialog from "./ArchiveRestoreDialog.vue";

const props = defineProps<{ productId: string }>();
const { currentUser, errorMessage, loading, switchWorkspace, workspace, workplaces } =
  useVenueWorkspace();
const companyId = computed(() => workspace.value?.company.id ?? "");
const venueId = computed(() => workspace.value?.venue.id ?? "");
const basePath = computed(() => `/app/companies/${companyId.value}/venues/${venueId.value}`);
const { card } = useProductArchive(companyId, venueId);
const cardQuery = card(() => props.productId);
const product = computed(() => cardQuery.data.value);
const canManage = computed(
  () => workspace.value?.permissions.includes("manage_product_archive") ?? false,
);
const restoreVisible = ref(false);
function componentPath(id: string, type: string, status: string) {
  return status === "ARCHIVED"
    ? `${basePath.value}/archive/${id}`
    : activeProductPath(basePath.value, { id, type });
}
</script>
