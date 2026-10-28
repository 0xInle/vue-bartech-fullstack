<template>
  <Drawer
    :visible="visible"
    position="right"
    class="drawer-size-md"
    :pt="{
      header: { class: '!items-center' },
      title: { style: { fontSize: '1.25rem', fontWeight: '600' } },
      root: { class: 'h-full' },
      content: { class: 'flex min-h-0 flex-1 flex-col overflow-hidden' },
      pcCloseButton: { root: { class: '!rounded-md' } },
    }"
    @update:visible="emit('update:visible', $event)"
  >
    <template #header="{ class: titleClass }">
      <div class="flex min-w-0 flex-wrap items-center gap-2">
        <span :class="[titleClass, 'leading-none']">{{
          cocktail?.name ?? "Карточка коктейля"
        }}</span>
        <Tag
          v-for="category in cocktail?.categories ?? []"
          :key="category.id"
          :value="category.label"
          severity="secondary"
          :pt="compactTagPt"
        />
        <Tag
          v-if="cocktail"
          :value="cocktail.status === 'ACTIVE' ? 'Активен' : 'Архивирован'"
          :severity="cocktail.status === 'ACTIVE' ? 'success' : 'secondary'"
          :pt="compactTagPt"
        />
      </div>
    </template>

    <Message
      v-if="cocktailQuery.isError.value"
      severity="error"
      :closable="false"
      :pt="compactMessagePt"
    >
      Коктейль не найден или недоступен в этом заведении.
    </Message>
    <LoadingIndicator v-else-if="cocktailQuery.isLoading.value" />
    <article v-else-if="cocktail" class="flex min-h-0 flex-1 flex-col gap-3">
      <div class="min-h-0 flex-1 overflow-y-auto">
        <Card class="!border-0 !bg-transparent !shadow-none" :pt="cocktailCardPt">
          <template #content>
            <div class="flex flex-col gap-3">
              <section>
                <h2
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
                    v-for="component in cocktail.components"
                    :key="component.id"
                    class="flex justify-between gap-4 py-1.5 text-sm"
                  >
                    <span>{{ component.name }}</span>
                    <span class="whitespace-nowrap text-color-secondary"
                      >{{ component.amount }} {{ component.unit }}</span
                    >
                  </li>
                </ul>
                <div
                  v-if="cocktail.output"
                  class="mt-2 flex items-center justify-between gap-4 border-t border-[var(--p-content-border-color)] pt-1.5 text-sm"
                >
                  <span class="text-color-secondary">Фактический выход:</span>
                  <span class="whitespace-nowrap">
                    {{ cocktail.output.amount }} {{ cocktail.output.unit }}
                  </span>
                </div>
              </section>

              <section v-if="cocktail.garnishes.length">
                <h2
                  class="mb-1 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-semibold"
                  :style="sectionHeadingStyle"
                >
                  <span
                    aria-hidden="true"
                    class="h-4 w-1 shrink-0 rounded-full"
                    :style="sectionMarkerStyle"
                  />
                  Гарнир:
                </h2>
                <p class="text-sm text-color-secondary">
                  {{ cocktail.garnishes.map((item) => item.name).join(", ") }}
                </p>
              </section>

              <section v-if="cocktail.glass || cocktail.ice || cocktail.preparationMethod">
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
                  <li v-if="cocktail.glass" class="flex justify-between gap-4 py-1.5 text-sm">
                    <span class="shrink-0 font-medium">Посуда:</span>
                    <span class="min-w-0 text-right">{{ cocktail.glass }}</span>
                  </li>
                  <li v-if="cocktail.ice" class="flex justify-between gap-4 py-1.5 text-sm">
                    <span class="shrink-0 font-medium">Лёд:</span>
                    <span class="min-w-0 text-right">{{ cocktail.ice }}</span>
                  </li>
                  <li
                    v-if="cocktail.preparationMethod"
                    class="flex justify-between gap-4 py-1.5 text-sm"
                  >
                    <span class="shrink-0 font-medium">Метод:</span>
                    <span class="min-w-0 text-right">{{ cocktail.preparationMethod }}</span>
                  </li>
                </ul>
              </section>

              <section>
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
                <p class="whitespace-pre-line text-sm leading-5">{{ cocktail.technology }}</p>
              </section>

              <section v-if="cocktail.comment">
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
                  {{ cocktail.comment }}
                </p>
              </section>
            </div>
          </template>
        </Card>
      </div>
      <div class="mt-auto flex w-full shrink-0 gap-2 bg-surface-0 py-2">
        <Button
          v-if="canManage"
          class="min-w-0 flex-1"
          label="Редактировать"
          icon="pi pi-pencil"
          size="small"
          severity="secondary"
          variant="outlined"
          @click="emit('edit', cocktail.id)"
        />
        <ExportActionButton
          class="min-w-0 flex-1"
          :company-id="companyId"
          :venue-id="venueId"
          :product-id="cocktail.id"
          :can-export="canExport"
          label="Скачать"
          full-width
        />
        <Button
          v-if="canViewHistory"
          class="min-w-0 flex-[1.5] whitespace-nowrap"
          :to="historyLocation"
          as="router-link"
          label="История изменений"
          icon="pi pi-history"
          size="small"
          severity="secondary"
          variant="outlined"
        />
      </div>
    </article>
  </Drawer>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { Workspace } from "~/types/user-workspaces";
import { useCocktails } from "../composables/useCocktails";
import ExportActionButton from "~/features/exports/components/ExportActionButton.vue";
import { compactMessagePt } from "~/utils/primevue-message";

const props = defineProps<{
  visible: boolean;
  cocktailId: string;
  workspace: Workspace;
}>();
const emit = defineEmits<{
  "update:visible": [visible: boolean];
  edit: [cocktailId: string];
}>();
const companyId = computed(() => props.workspace.company.id);
const venueId = computed(() => props.workspace.venue.id);
const { cocktailQuery: createCocktailQuery } = useCocktails(companyId, venueId);
const cocktailQuery = createCocktailQuery(() => props.cocktailId);
const cocktail = computed(() => cocktailQuery.data.value ?? null);
const canExport = computed(() => props.workspace.permissions.includes("export_data"));
const canViewHistory = computed(() => props.workspace.permissions.includes("view_history"));
const canManage = computed(() => props.workspace.permissions.includes("manage_products"));
const compactTagPt = {
  root: { style: { fontSize: "0.75rem", padding: "0.125rem 0.375rem" } },
  label: { style: { fontWeight: "400" } },
};
const cocktailCardPt = {
  body: { class: "!p-0" },
  content: { class: "!p-0" },
};
const sectionHeadingStyle = { backgroundColor: "var(--p-surface-50)" };
const sectionMarkerStyle = { backgroundColor: "var(--p-primary-color)" };
const historyLocation = computed(() => ({
  path: `/app/companies/${companyId.value}/venues/${venueId.value}/history`,
  query: { entityType: "PRODUCT", entityId: props.cocktailId },
}));
</script>
