<template>
  <Drawer
    :visible="visible"
    dismissable
    position="right"
    class="drawer-size-md"
    :pt="drawerPt"
    @update:visible="emit('update:visible', $event)"
  >
    <template #header="{ class: titleClass }">
      <div class="flex min-w-0 flex-wrap items-center gap-2">
        <span :class="[titleClass, 'leading-none']">{{
          product?.name ?? "Карточка продукта"
        }}</span>
        <Tag
          v-if="product"
          :value="productTypeLabels[product.type]"
          severity="secondary"
          :pt="compactTagPt"
        />
        <Tag v-if="product" value="В архиве" severity="secondary" :pt="compactTagPt" />
      </div>
    </template>
    <Message v-if="cardQuery.isError.value" severity="error" :closable="false">
      Карточка не найдена или недоступна в этом заведении.
    </Message>
    <LoadingIndicator v-else-if="cardQuery.isLoading.value" />
    <article v-else-if="product" class="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
      <dl class="flex flex-wrap gap-x-4 gap-y-2 text-sm text-color-secondary">
        <div v-if="product.category">
          <dt class="inline">Категория:</dt>
          <dd class="ml-1 inline">{{ product.category }}</dd>
        </div>
        <div v-if="product.brand">
          <dt class="inline">Бренд:</dt>
          <dd class="ml-1 inline">{{ product.brand }}</dd>
        </div>
        <div v-if="product.strength !== null">
          <dt class="inline">Крепость:</dt>
          <dd class="ml-1 inline">{{ product.strength }}%</dd>
        </div>
        <div v-if="product.country">
          <dt class="inline">Страна:</dt>
          <dd class="ml-1 inline">{{ product.country }}</dd>
        </div>
        <div v-if="product.externalIdentifier">
          <dt class="inline">Идентификатор:</dt>
          <dd class="ml-1 inline">{{ product.externalIdentifier }}</dd>
        </div>
        <div v-if="product.glass">
          <dt class="inline">Посуда:</dt>
          <dd class="ml-1 inline">{{ product.glass }}</dd>
        </div>
        <div v-if="product.ice">
          <dt class="inline">Лёд:</dt>
          <dd class="ml-1 inline">{{ product.ice }}</dd>
        </div>
        <div v-if="product.preparationMethod">
          <dt class="inline">Метод:</dt>
          <dd class="ml-1 inline">{{ product.preparationMethod }}</dd>
        </div>
      </dl>
      <section v-if="product.components.length">
        <h2 class="text-base font-semibold">Состав</h2>
        <ul class="mt-2 divide-y divide-[var(--p-content-border-color)]">
          <li
            v-for="component in product.components"
            :key="component.id"
            class="flex justify-between gap-3 py-2 text-sm"
          >
            <span>
              {{ component.name }}
              <span
                v-if="component.status === 'ARCHIVED'"
                class="ml-2 text-xs text-color-secondary"
              >
                В архиве
              </span>
            </span>
            <span class="whitespace-nowrap text-color-secondary">
              {{ component.amount }} {{ component.unit }}
            </span>
          </li>
        </ul>
      </section>
      <section v-if="product.garnishes.length">
        <h2 class="text-base font-semibold">Гарниры</h2>
        <ul class="mt-2 space-y-2 text-sm">
          <li v-for="garnish in product.garnishes" :key="garnish.id">
            {{ garnish.name }}
            <span v-if="garnish.status === 'ARCHIVED'" class="ml-2 text-xs text-color-secondary">
              В архиве
            </span>
          </li>
        </ul>
      </section>
      <section v-if="product.technology">
        <h2 class="text-base font-semibold">Технология приготовления</h2>
        <p class="mt-2 whitespace-pre-line text-sm leading-6">{{ product.technology }}</p>
      </section>
      <section v-if="product.output || product.comment">
        <p v-if="product.output" class="text-sm">
          Фактический выход: {{ product.output.amount }} {{ product.output.unit }}
        </p>
        <p v-if="product.comment" class="mt-3 whitespace-pre-line text-sm text-color-secondary">
          {{ product.comment }}
        </p>
      </section>
    </article>
  </Drawer>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { Workspace } from "~/types/user-workspaces";
import { useProductArchive } from "../composables/useProductArchive";
import { productTypeLabels } from "../product-links";

const props = defineProps<{
  visible: boolean;
  productId: string;
  workspace: Workspace;
}>();
const emit = defineEmits<{ "update:visible": [visible: boolean] }>();
const companyId = computed(() => props.workspace.company.id);
const venueId = computed(() => props.workspace.venue.id);
const { card } = useProductArchive(companyId, venueId);
const cardQuery = card(() => props.productId);
const product = computed(() => cardQuery.data.value);
const compactTagPt = {
  root: { style: { fontSize: "0.75rem", padding: "0.125rem 0.375rem" } },
  label: { style: { fontWeight: "400" } },
};
const drawerPt = {
  header: { class: "!items-center" },
  title: { style: { fontSize: "1.25rem", fontWeight: "600" } },
  root: { class: "h-full" },
  content: { class: "flex min-h-0 flex-1 flex-col overflow-hidden" },
  pcCloseButton: { root: { class: "!rounded-md" } },
};
</script>
