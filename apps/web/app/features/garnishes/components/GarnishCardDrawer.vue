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
        <span :class="[titleClass, 'leading-none']">{{ garnish?.name ?? "Карточка гарнира" }}</span>
        <Tag
          v-if="garnish"
          :value="garnish.workflowStatus === 'IN_DEVELOPMENT' ? 'Проработка' : 'Активен'"
          :severity="garnish.workflowStatus === 'IN_DEVELOPMENT' ? 'warn' : 'success'"
          :pt="compactTagPt"
        />
      </div>
    </template>
    <Message
      v-if="garnishQuery.isError.value"
      severity="error"
      :closable="false"
      :pt="compactMessagePt"
      >Гарнир не найден или недоступен в этом заведении.</Message
    >
    <LoadingIndicator v-else-if="garnishQuery.isLoading.value" />
    <article v-else-if="garnish" class="flex min-h-0 flex-1 flex-col gap-3">
      <div class="min-h-0 flex-1 overflow-y-auto">
        <Card class="!border-0 !bg-transparent !shadow-none" :pt="cardPt">
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
                  />Состав:
                </h2>
                <ul class="mt-1 divide-y divide-[var(--p-content-border-color)]">
                  <li
                    v-for="component in garnish.components"
                    :key="component.id"
                    class="flex justify-between gap-4 py-1.5 text-sm"
                  >
                    <NuxtLink
                      v-if="!readOnly && component.productType === 'PREPARATION'"
                      :to="preparationPath(component.productId)"
                      class="text-primary hover:underline"
                      >{{ component.name }}</NuxtLink
                    >
                    <span v-else>{{ component.name }}</span
                    ><span class="whitespace-nowrap text-color-secondary"
                      >{{ component.amount }} {{ component.unit }}</span
                    >
                  </li>
                </ul>
                <div
                  v-if="garnish.output"
                  class="mt-2 flex items-center justify-between gap-4 border-t border-[var(--p-content-border-color)] pt-1.5 text-sm"
                >
                  <span class="text-color-secondary">Фактический выход:</span
                  ><span class="whitespace-nowrap"
                    >{{ garnish.output.amount }} {{ garnish.output.unit }}</span
                  >
                </div>
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
                  />Технология приготовления:
                </h2>
                <p class="whitespace-pre-line text-sm leading-5">{{ garnish.technology }}</p>
              </section>
              <section v-if="garnish.comment">
                <h2
                  class="mb-1 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-semibold"
                  :style="sectionHeadingStyle"
                >
                  <span
                    aria-hidden="true"
                    class="h-4 w-1 shrink-0 rounded-full"
                    :style="sectionMarkerStyle"
                  />Комментарий:
                </h2>
                <p class="whitespace-pre-line text-sm text-color-secondary">
                  {{ garnish.comment }}
                </p>
              </section>
            </div>
          </template>
        </Card>
      </div>
      <div class="mt-auto flex w-full shrink-0 flex-nowrap gap-2 bg-surface-0 py-2">
        <Button
          v-if="canManage"
          class="min-w-max flex-auto shrink-0 whitespace-nowrap !px-1"
          label="Редактировать"
          size="small"
          severity="secondary"
          variant="outlined"
          @click="emit('edit', garnish.id)"
        />
        <ExportActionButton
          class="min-w-max flex-auto shrink-0"
          :company-id="companyId"
          :venue-id="venueId"
          :product-id="garnish.id"
          :can-export="canExport"
          label="Скачать"
          full-width
        />
        <Button
          v-if="canViewHistory"
          :to="historyLocation"
          as="router-link"
          class="min-w-max flex-auto shrink-0 whitespace-nowrap !px-1"
          label="История изменений"
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
import ExportActionButton from "~/features/exports/components/ExportActionButton.vue";
import type { Workspace } from "~/types/user-workspaces";
import { useGarnishes } from "../composables/useGarnishes";
import { compactMessagePt } from "~/utils/primevue-message";

const props = defineProps<{
  garnishId: string;
  readOnly?: boolean;
  visible: boolean;
  workspace: Workspace;
}>();
const emit = defineEmits<{ "update:visible": [visible: boolean]; edit: [garnishId: string] }>();
const companyId = computed(() => props.workspace.company.id);
const venueId = computed(() => props.workspace.venue.id);
const { garnishQuery: createGarnishQuery } = useGarnishes(companyId, venueId, { list: false });
const garnishQuery = createGarnishQuery(() => props.garnishId);
const garnish = computed(() => garnishQuery.data.value ?? null);
const canManage = computed(
  () => !props.readOnly && props.workspace.permissions.includes("manage_products"),
);
const canExport = computed(() => props.workspace.permissions.includes("export_data"));
const canViewHistory = computed(
  () => !props.readOnly && props.workspace.permissions.includes("view_history"),
);
const historyLocation = computed(() => ({
  path: `/app/companies/${companyId.value}/venues/${venueId.value}/history`,
  query: { entityType: "PRODUCT", entityId: props.garnishId },
}));
const drawerPt = {
  header: { class: "!items-center" },
  title: { style: { fontSize: "1.25rem", fontWeight: "600" } },
  root: { class: "h-full" },
  content: { class: "flex min-h-0 flex-1 flex-col overflow-hidden" },
  pcCloseButton: { root: { class: "!rounded-md" } },
};
const cardPt = { body: { class: "!p-0" }, content: { class: "!p-0" } };
const compactTagPt = {
  root: { style: { fontSize: "0.75rem", padding: "0.125rem 0.375rem" } },
  label: { style: { fontWeight: "400" } },
};
const sectionHeadingStyle = { backgroundColor: "var(--p-surface-50)" };
const sectionMarkerStyle = { backgroundColor: "var(--p-primary-color)" };
function preparationPath(id: string): string {
  return `/app/companies/${companyId.value}/venues/${venueId.value}/preparations/${id}`;
}
</script>
