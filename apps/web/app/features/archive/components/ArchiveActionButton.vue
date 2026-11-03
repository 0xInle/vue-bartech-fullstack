<template>
  <Button
    v-if="canManage"
    v-tooltip.top="iconOnly ? { value: 'Архивировать', class: 'app-tooltip' } : undefined"
    :label="iconOnly ? undefined : 'В архив'"
    icon="pi pi-inbox"
    size="small"
    severity="secondary"
    variant="text"
    :aria-label="iconOnly ? 'Архивировать продукт' : undefined"
    :loading="loadingPlan"
    :disabled="loadingPlan || busy"
    @click.stop="open"
  />
  <Dialog
    v-model:visible="visible"
    modal
    :dismissable-mask="!busy && !productDrawerOpen"
    :draggable="false"
    header="Архивировать продукт"
    :class="dialogClass"
    closable
    :close-on-escape="!busy && !productDrawerOpen"
    :close-button-props="{ disabled: busy, severity: 'secondary', text: true, rounded: true }"
    :pt="{ pcCloseButton: { root: { class: '!rounded-md' } } }"
  >
    <div v-if="planChanged" class="pt-1">
      <Message severity="warn" size="small" :closable="false" :pt="compactMessagePt" class="mb-4">
        Связи продукта были изменены. Архивация не выполнена. План обновлён. Проверьте актуальный
        список и подтвердите действие ещё раз.
      </Message>
    </div>
    <Message v-if="errorMessage" severity="error" :closable="false" class="mb-4">
      {{ errorMessage }}
    </Message>
    <template v-if="plan">
      <template v-if="!hasActiveUsages">
        <p class="text-sm">
          Переместить в архив {{ archiveProductType }} <strong>{{ plan.root.name }}</strong
          >? Продукт исчезнет из активного списка, но его состав сохранится. Восстановить продукт
          можно будет в любой момент.
        </p>
      </template>
      <template v-else>
        <p class="text-sm">
          <strong>{{ plan.root.name }}</strong>
          {{
            mode === "ARCHIVE_CHAIN"
              ? "и активные продукты из зависимой цепочки будут архивированы:"
              : `используется в следующих ${usageTypeSummary}:`
          }}
        </p>
        <div class="mt-3 max-h-72 overflow-auto">
          <DataTable
            :value="displayedRows"
            data-key="id"
            size="small"
            class="product-list-table w-full text-sm"
            :pt="dependencyTablePt"
          >
            <Column field="parentName" header="Название">
              <template #body="{ data }">
                <a
                  v-if="usagePath(data.parentId, data.parentType, data.parentStatus)"
                  :href="usagePath(data.parentId, data.parentType, data.parentStatus) ?? undefined"
                  class="cursor-pointer break-words text-sm font-medium hover:text-primary hover:underline"
                  @click="handleUsageLinkClick($event, data)"
                >
                  {{ data.parentName }}
                </a>
                <span v-else class="break-words text-sm font-medium">{{ data.parentName }}</span>
              </template>
            </Column>
            <Column
              header="Продукт"
              style="width: 1%; white-space: nowrap"
              header-class="px-2"
              body-class="px-2"
            >
              <template #body="{ data }">
                <div class="flex items-center gap-1">
                  <Tag
                    :value="productTypeLabels[data.parentType]"
                    severity="secondary"
                    :pt="compactTagPt"
                  />
                  <Tag
                    v-if="data.parentStatus === 'ARCHIVED'"
                    value="В архиве"
                    severity="secondary"
                    :pt="compactTagPt"
                  />
                </div>
              </template>
            </Column>
          </DataTable>
        </div>
        <Message v-if="!plan.canReplace" severity="warn" :closable="false" class="mt-3">
          Для всех активных связей нет общей допустимой замены. Доступна архивация связанных
          продуктов.
        </Message>
        <div v-if="mode === 'REPLACE'">
          <div
            class="grid grid-cols-1 items-center gap-2 pt-2 sm:grid-cols-[minmax(12rem,1fr)_auto_minmax(12rem,1fr)]"
          >
            <div class="min-w-0 pt-2">
              <FloatLabel variant="on">
                <Select
                  :model-value="plan.root.id"
                  input-id="archive-source-product"
                  :options="[plan.root]"
                  option-label="name"
                  option-value="id"
                  size="small"
                  class="w-full"
                  disabled
                  fluid
                />
                <label for="archive-source-product" class="text-xs">Текущий продукт</label>
              </FloatLabel>
            </div>
            <span
              aria-hidden="true"
              class="rotate-90 text-center text-color-secondary sm:translate-y-1 sm:rotate-0"
              >→</span
            >
            <div class="min-w-0 pt-2">
              <FloatLabel variant="on">
                <Select
                  :model-value="replacementProductId"
                  input-id="archive-replacement-product"
                  :options="commonReplacementOptions"
                  option-label="name"
                  option-value="id"
                  :placeholder="commonReplacementOptions.length ? undefined : 'Нет общей замены'"
                  :pt="{ emptyMessage: { class: 'text-sm' } }"
                  size="small"
                  class="w-full"
                  filter
                  show-clear
                  fluid
                  :disabled="busy || !commonReplacementOptions.length"
                  @update:model-value="replacementProductId = $event"
                />
                <label for="archive-replacement-product" class="text-xs">
                  {{ productTypeLabels[plan.root.type] }}
                </label>
              </FloatLabel>
            </div>
          </div>
        </div>
        <div v-if="mode === 'ARCHIVE_CHAIN'" class="mt-1 w-full pt-2">
          <FloatLabel variant="on" class="w-full">
            <InputText
              id="archive-chain-confirmation"
              v-model="confirmationName"
              size="small"
              class="w-full"
              :disabled="busy"
              autocomplete="off"
            />
            <label for="archive-chain-confirmation" class="text-xs">
              {{ confirmationPlaceholder(plan.root.type) }}
            </label>
          </FloatLabel>
        </div>
        <Message v-if="plan.archivedUsages.length" severity="info" :closable="false" class="mt-3">
          Связи с уже архивными продуктами сохранятся без изменений.
        </Message>
        <div class="mt-4 flex flex-wrap justify-end gap-2">
          <Button
            label="Отмена"
            size="small"
            severity="secondary"
            variant="text"
            :disabled="busy"
            @click="visible = false"
          />
          <Button
            :label="mode === 'REPLACE' ? 'Подтвердить замену' : 'Заменить в активных'"
            size="small"
            severity="success"
            :outlined="mode !== 'REPLACE'"
            :loading="busy && mode === 'REPLACE'"
            :disabled="busy || !plan.canReplace || (mode === 'REPLACE' && !replacementProductId)"
            @click="selectMode('REPLACE')"
          />
          <Button
            :label="mode === 'ARCHIVE_CHAIN' ? 'Подтвердить архивацию' : 'Архивировать связанные'"
            size="small"
            severity="danger"
            :outlined="mode !== 'ARCHIVE_CHAIN'"
            :loading="busy && mode === 'ARCHIVE_CHAIN'"
            :disabled="busy || (mode === 'ARCHIVE_CHAIN' && confirmationName !== plan.root.name)"
            @click="selectMode('ARCHIVE_CHAIN')"
          />
        </div>
      </template>
    </template>
    <template v-if="!hasActiveUsages || (errorMessage && !plan)" #footer>
      <Button
        label="Отмена"
        size="small"
        severity="secondary"
        variant="text"
        :disabled="busy"
        @click="visible = false"
      />
      <Button
        v-if="errorMessage && !plan"
        label="Повторить проверку"
        size="small"
        :disabled="busy || loadingPlan"
        @click="retryPlan"
      />
      <Button
        v-else-if="plan && !hasActiveUsages"
        label="Архивировать"
        size="small"
        :loading="busy"
        :disabled="busy"
        @click="submit('ARCHIVE')"
      />
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { ArchiveRequestError, useProductArchive } from "../composables/useProductArchive";
import type { ProductArchivePlan } from "../composables/useProductArchive";
import { activeProductPath, productTypeLabels } from "../product-links";
import { compactMessagePt } from "~/utils/primevue-message";
import { useWorkspaceProductDrawer } from "~/composables/useWorkspaceProductDrawer";

const props = defineProps<{
  companyId: string;
  venueId: string;
  productId: string;
  productType: import("../composables/useProductArchive").ProductAnalyticsType;
  productName: string;
  canManage: boolean;
  iconOnly?: boolean;
  stayOnPage?: boolean;
}>();
const emit = defineEmits<{ archived: [] }>();
const { archive, archivePlan } = useProductArchive(
  () => props.companyId,
  () => props.venueId,
);
const { open: openProductDrawer, target: productDrawerTarget } = useWorkspaceProductDrawer();
const visible = ref(false);
const busy = ref(false);
const loadingPlan = ref(false);
const errorMessage = ref("");
const planChanged = ref(false);
const plan = ref<ProductArchivePlan | null>(null);
const mode = ref<"REPLACE" | "ARCHIVE_CHAIN" | null>(null);
const replacementProductId = ref<string | null>(null);
const confirmationName = ref("");
const basePath = computed(() => `/app/companies/${props.companyId}/venues/${props.venueId}`);
const hasActiveUsages = computed(() =>
  Boolean(plan.value?.archiveChain.some((item) => item.id !== plan.value?.root.id)),
);
const productDrawerOpen = computed(() => Boolean(productDrawerTarget.value));
const archiveProductType = computed(
  () =>
    ({
      INGREDIENT: "ингредиент",
      COCKTAIL: "коктейль",
      PREPARATION: "заготовку",
      GARNISH: "гарнир",
    })[plan.value?.root.type ?? "GARNISH"],
);
const dialogClass = computed(() => {
  const longestName = Math.max(
    plan.value?.root.name.length ?? props.productName.length,
    ...allUsages.value.map(({ parentName }) => parentName.length),
    ...(plan.value?.archiveChain.map(({ name }) => name.length) ?? []),
  );
  return `dialog-size-${longestName > 38 ? "lg" : "md"}`;
});
const allUsages = computed(() => [
  ...(plan.value?.activeUsages ?? []),
  ...(plan.value?.archivedUsages ?? []),
]);
const displayedRows = computed(() =>
  mode.value === "ARCHIVE_CHAIN"
    ? (plan.value?.archiveChain ?? [])
        .filter(({ id }) => id !== plan.value?.root.id)
        .map((product) => ({
          id: product.id,
          parentId: product.id,
          parentType: product.type,
          parentName: product.name,
          parentStatus: product.status,
        }))
    : allUsages.value,
);
const commonReplacementOptions = computed(() => {
  const usages = plan.value?.activeUsages ?? [];
  if (!usages.length) return [];
  const allowed = new Set(usages[0]!.replacements.map(({ id }) => id));
  for (const usage of usages.slice(1)) {
    const usageIds = new Set(usage.replacements.map(({ id }) => id));
    for (const id of allowed) if (!usageIds.has(id)) allowed.delete(id);
  }
  return usages[0]!.replacements.filter(({ id }) => allowed.has(id));
});
const usageTypePrepositions = {
  INGREDIENT: "ингредиентах",
  PREPARATION: "заготовках",
  GARNISH: "гарнирах",
  COCKTAIL: "коктейлях",
};
const usageTypeSummary = computed(() => {
  const types = [...new Set(allUsages.value.map(({ parentType }) => parentType))].map(
    (type) => usageTypePrepositions[type],
  );
  if (types.length < 2) return types[0] ?? "продуктах";
  return `${types.slice(0, -1).join(", ")} и ${types.at(-1)}`;
});
const compactTagPt = {
  root: { style: { fontSize: "0.75rem", padding: "0.125rem 0.375rem" } },
  label: { style: { fontWeight: "400" } },
};
const dependencyTablePt = {
  root: {
    style: {
      "--p-datatable-border-color": "var(--p-content-border-color)",
      "--p-datatable-header-cell-background": "transparent",
      "--p-datatable-row-background": "transparent",
      border: "1px solid var(--p-content-border-color)",
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

async function loadPlan(): Promise<boolean> {
  loadingPlan.value = true;
  errorMessage.value = "";
  plan.value = null;
  mode.value = null;
  replacementProductId.value = null;
  confirmationName.value = "";
  try {
    plan.value = await archivePlan(props.productId);
    planChanged.value = false;
    return true;
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "Не удалось проверить связи продукта";
    return false;
  } finally {
    loadingPlan.value = false;
  }
}

async function open(): Promise<void> {
  if (!(await loadPlan())) visible.value = true;
  else visible.value = true;
}

async function retryPlan(): Promise<void> {
  if (await loadPlan()) errorMessage.value = "";
}

function usagePath(id: string, type: string, status: string) {
  return status === "ARCHIVED"
    ? `${basePath.value}/archive/${id}`
    : activeProductPath(basePath.value, { id, type });
}

function handleUsageLinkClick(
  event: MouseEvent,
  usage: ProductArchivePlan["activeUsages"][number],
): void {
  const plainLeftClick =
    event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
  if (!plainLeftClick) return;
  event.preventDefault();
  openProductDrawer({ id: usage.parentId, type: usage.parentType, status: usage.parentStatus });
}

function selectMode(nextMode: "REPLACE" | "ARCHIVE_CHAIN"): void {
  if (busy.value) return;
  if (mode.value === nextMode) {
    void submit(nextMode);
    return;
  }
  mode.value = nextMode;
  replacementProductId.value = null;
  confirmationName.value = "";
}

function confirmationPlaceholder(type: ProductArchivePlan["root"]["type"]): string {
  const names = {
    INGREDIENT: "ингредиента",
    PREPARATION: "заготовки",
    GARNISH: "гарнира",
    COCKTAIL: "коктейля",
  };
  return `Введите точное название ${names[type]}`;
}

async function submit(action: "ARCHIVE" | "REPLACE" | "ARCHIVE_CHAIN"): Promise<void> {
  if (busy.value || !plan.value) return;
  if (action === "REPLACE" && !replacementProductId.value) return;
  if (action === "ARCHIVE_CHAIN" && confirmationName.value !== plan.value.root.name) return;
  busy.value = true;
  errorMessage.value = "";
  try {
    await archive(props.productId, props.productType, {
      action,
      confirmationFingerprint: plan.value.confirmationFingerprint,
      ...(action === "ARCHIVE_CHAIN" ? { confirmationName: confirmationName.value } : {}),
      ...(action === "REPLACE" ? { replacementProductId: replacementProductId.value! } : {}),
    });
    visible.value = false;
    emit("archived");
    if (!props.stayOnPage) await navigateTo(`${basePath.value}/archive/${props.productId}`);
  } catch (error) {
    const planChangedError =
      error instanceof ArchiveRequestError && error.problem.code === "PRODUCT_ARCHIVE_PLAN_CHANGED";
    const hasChangedPlan = planChangedError && Boolean(error.problem.plan);
    errorMessage.value = hasChangedPlan
      ? ""
      : error instanceof Error
        ? error.message
        : "Не удалось архивировать продукт. Попробуйте ещё раз.";
    planChanged.value = hasChangedPlan;
    if (planChangedError) {
      plan.value = error.problem.plan ?? null;
      mode.value = null;
      replacementProductId.value = null;
      confirmationName.value = "";
      if (!plan.value)
        errorMessage.value = "Не удалось обновить актуальный план. Повторите проверку.";
    }
  } finally {
    busy.value = false;
  }
}
</script>

<style scoped>
:deep(.product-list-table .p-datatable-tbody > tr:last-child > td) {
  border-block-end-width: 0;
}
</style>
