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
        <Tag
          v-if="product?.category"
          :value="product.category"
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
    <article v-else-if="product" class="flex min-h-0 flex-1 flex-col gap-3">
      <div class="min-h-0 flex-1 overflow-y-auto">
        <Card class="!border-0 !bg-transparent !shadow-none" :pt="cardPt">
          <template #content>
            <div class="flex flex-col gap-3">
              <section v-if="product.components.length || product.output">
                <h2
                  v-if="product.components.length"
                  class="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-semibold"
                  :style="sectionHeadingStyle"
                >
                  <span
                    aria-hidden="true"
                    class="h-4 w-1 shrink-0 rounded-full"
                    :style="sectionMarkerStyle"
                  />
                  Состав:
                </h2>
                <ul class="mt-1 divide-y divide-[var(--p-content-border-color)]">
                  <li
                    v-for="component in product.components"
                    :key="component.id"
                    class="flex justify-between gap-4 py-1.5 text-sm"
                  >
                    <span>
                      <NuxtLink
                        v-if="
                          componentPath(
                            component.productId,
                            component.productType,
                            component.status,
                          )
                        "
                        :to="
                          componentPath(
                            component.productId,
                            component.productType,
                            component.status,
                          )!
                        "
                        class="text-primary hover:underline"
                      >
                        {{ component.name }}
                      </NuxtLink>
                      <span v-else>{{ component.name }}</span>
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
                <div
                  v-if="product.output"
                  class="mt-2 flex items-center justify-between gap-4 border-t border-[var(--p-content-border-color)] pt-1.5 text-sm"
                >
                  <span class="text-color-secondary">Фактический выход:</span>
                  <span class="whitespace-nowrap">
                    {{ product.output.amount }} {{ product.output.unit }}
                  </span>
                </div>
              </section>
              <section v-if="product.garnishes.length">
                <h2
                  class="mb-1 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-semibold"
                  :style="sectionHeadingStyle"
                >
                  <span
                    aria-hidden="true"
                    class="h-4 w-1 shrink-0 rounded-full"
                    :style="sectionMarkerStyle"
                  />
                  Гарниры:
                </h2>
                <ul class="space-y-2 text-sm">
                  <li v-for="garnish in product.garnishes" :key="garnish.id">
                    <NuxtLink
                      v-if="garnishPath(garnish.id, garnish.type, garnish.status)"
                      :to="garnishPath(garnish.id, garnish.type, garnish.status)!"
                      class="text-primary hover:underline"
                    >
                      {{ garnish.name }}
                    </NuxtLink>
                    <span v-else>{{ garnish.name }}</span>
                    <span
                      v-if="garnish.status === 'ARCHIVED'"
                      class="ml-2 text-xs text-color-secondary"
                    >
                      В архиве
                    </span>
                  </li>
                </ul>
              </section>
              <section v-if="product.glass || product.ice || product.preparationMethod">
                <h2
                  class="mb-1 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-semibold"
                  :style="sectionHeadingStyle"
                >
                  <span
                    aria-hidden="true"
                    class="h-4 w-1 shrink-0 rounded-full"
                    :style="sectionMarkerStyle"
                  />
                  Подача и приготовление:
                </h2>
                <ul class="divide-y divide-[var(--p-content-border-color)]">
                  <li v-if="product.glass" class="flex justify-between gap-4 py-1.5 text-sm">
                    <span class="shrink-0 font-medium">Посуда:</span>
                    <span class="min-w-0 text-right">{{ product.glass }}</span>
                  </li>
                  <li v-if="product.ice" class="flex justify-between gap-4 py-1.5 text-sm">
                    <span class="shrink-0 font-medium">Лёд:</span>
                    <span class="min-w-0 text-right">{{ product.ice }}</span>
                  </li>
                  <li
                    v-if="product.preparationMethod"
                    class="flex justify-between gap-4 py-1.5 text-sm"
                  >
                    <span class="shrink-0 font-medium">Метод:</span>
                    <span class="min-w-0 text-right">{{ product.preparationMethod }}</span>
                  </li>
                </ul>
              </section>
              <section v-if="product.technology">
                <h2
                  class="mb-1 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-semibold"
                  :style="sectionHeadingStyle"
                >
                  <span
                    aria-hidden="true"
                    class="h-4 w-1 shrink-0 rounded-full"
                    :style="sectionMarkerStyle"
                  />
                  Технология приготовления:
                </h2>
                <p class="whitespace-pre-line text-sm leading-5">{{ product.technology }}</p>
              </section>
              <section v-if="product.comment">
                <h2
                  class="mb-1 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-semibold"
                  :style="sectionHeadingStyle"
                >
                  <span
                    aria-hidden="true"
                    class="h-4 w-1 shrink-0 rounded-full"
                    :style="sectionMarkerStyle"
                  />
                  Комментарий:
                </h2>
                <p class="whitespace-pre-line text-sm text-color-secondary">
                  {{ product.comment }}
                </p>
              </section>
            </div>
          </template>
        </Card>
      </div>
      <div
        v-if="showActions && (canManageArchive || canDeletePermanently)"
        class="mt-auto flex w-full shrink-0 flex-nowrap gap-2 bg-surface-0 py-2"
      >
        <ArchiveRestoreDialog
          v-if="canManageArchive"
          :company-id="companyId"
          :venue-id="venueId"
          :product-id="product.id"
          :product-type="product.type"
        >
          <template #trigger="{ open, loading }">
            <Button
              class="min-w-max flex-auto shrink-0 whitespace-nowrap"
              label="Восстановить"
              size="small"
              :loading="loading"
              :disabled="loading"
              @click.stop="open"
            />
          </template>
        </ArchiveRestoreDialog>
        <PermanentDeleteActionButton
          v-if="canDeletePermanently"
          :company-id="companyId"
          :venue-id="venueId"
          :product-id="product.id"
          :product-name="product.name"
          :product-type="product.type"
          :can-manage="canDeletePermanently"
          :icon-only="false"
          @deleted="emit('deleted', $event)"
        />
      </div>
    </article>
  </Drawer>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { Workspace } from "~/types/user-workspaces";
import { useProductArchive } from "../composables/useProductArchive";
import { activeProductPath, productTypeLabels } from "../product-links";
import ArchiveRestoreDialog from "./ArchiveRestoreDialog.vue";
import PermanentDeleteActionButton from "./PermanentDeleteActionButton.vue";

const props = defineProps<{
  visible: boolean;
  productId: string;
  workspace: Workspace;
  showActions?: boolean;
}>();
const emit = defineEmits<{
  "update:visible": [visible: boolean];
  deleted: [productId: string];
}>();
const companyId = computed(() => props.workspace.company.id);
const venueId = computed(() => props.workspace.venue.id);
const { card } = useProductArchive(companyId, venueId);
const cardQuery = card(() => props.productId);
const product = computed(() => cardQuery.data.value);
const canManageArchive = computed(() =>
  props.workspace.permissions.includes("manage_product_archive"),
);
const canDeletePermanently = computed(() =>
  props.workspace.permissions.includes("delete_products_permanently"),
);
const basePath = computed(() => `/app/companies/${companyId.value}/venues/${venueId.value}`);
const compactTagPt = {
  root: { style: { fontSize: "0.75rem", padding: "0.125rem 0.375rem" } },
  label: { style: { fontWeight: "400" } },
};
const cardPt = { body: { class: "!p-0" }, content: { class: "!p-0" } };
const sectionHeadingStyle = { backgroundColor: "var(--p-surface-50)" };
const sectionMarkerStyle = { backgroundColor: "var(--p-primary-color)" };
const drawerPt = {
  header: { class: "!items-center" },
  title: { style: { fontSize: "1.25rem", fontWeight: "600" } },
  root: { class: "h-full" },
  content: { class: "flex min-h-0 flex-1 flex-col overflow-hidden" },
  pcCloseButton: { root: { class: "!rounded-md" } },
};

function componentPath(id: string, type: string, status: string): string | null {
  if (status === "ARCHIVED") return `${basePath.value}/archive/${id}`;
  return activeProductPath(basePath.value, { id, type });
}

function garnishPath(id: string, type: string, status: string | null): string | null {
  if (type === "QUICK" || status === null) return null;
  return componentPath(id, type, status);
}
</script>
