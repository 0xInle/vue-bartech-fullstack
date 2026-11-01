<template>
  <Button
    v-if="canManage"
    v-tooltip.top="{ value: 'Удалить', class: 'app-tooltip' }"
    icon="pi pi-trash"
    size="small"
    severity="danger"
    variant="text"
    aria-label="Удалить продукт навсегда"
    @click.stop="open"
  />
  <Dialog
    v-model:visible="visible"
    modal
    :dismissable-mask="!busy && !productDrawerOpen"
    :draggable="false"
    header="Подтверждение удаления"
    :class="dialogClass"
    :closable="!busy"
    :close-on-escape="!busy && !productDrawerOpen"
    :pt="{ pcCloseButton: { root: { class: '!rounded-md' } } }"
  >
    <AutoHeight :active="visible">
      <Message v-if="errorMessage" severity="error" :closable="false" class="mb-4">{{
        errorMessage
      }}</Message>
      <div v-if="loadingPlan" class="flex items-center justify-center">
        <LoadingIndicator />
      </div>
      <template v-else-if="plan">
        <template v-if="!hasUsages">
          <p class="text-sm">
            <span>
              {{ permanentDeleteMessages[plan.root.type] }}
              <strong>{{ plan.root.name }}</strong>
              {{ permanentDeleteMessageEndings[plan.root.type] }}
            </span>
          </p>
        </template>
        <template v-else>
          <p class="text-sm">
            <strong>{{ plan.root.name }}</strong> используется в следующих {{ usageTypeSummary }}:
          </p>
          <div ref="usageList" class="mt-3 max-h-72 overflow-auto">
            <DataTable
              :value="allUsages"
              data-key="id"
              size="small"
              class="product-list-table w-full text-sm"
              :pt="dependencyTablePt"
            >
              <Column field="parentName" header="Название">
                <template #body="{ data }">
                  <a
                    v-if="usagePath(data.parentId, data.parentType, data.parentStatus)"
                    :href="
                      usagePath(data.parentId, data.parentType, data.parentStatus) ?? undefined
                    "
                    class="cursor-pointer break-words text-sm font-medium hover:text-primary hover:underline"
                    @click="handleUsageLinkClick($event, data)"
                  >
                    {{ data.parentName }}
                  </a>
                  <span v-else class="text-sm font-medium">{{ data.parentName }}</span>
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
          <template v-if="mode === 'REPLACE' && hasActiveUsages">
            <div
              ref="replacementControls"
              class="grid grid-cols-1 items-center gap-2 pt-2"
              :class="
                stackedRows
                  ? 'sm:grid-cols-1'
                  : 'sm:grid-cols-[minmax(12rem,1fr)_auto_minmax(12rem,1fr)]'
              "
            >
              <div class="min-w-0 pt-2">
                <FloatLabel variant="on">
                  <Select
                    :model-value="plan.root.id"
                    input-id="permanent-delete-source-product"
                    :options="[plan.root]"
                    option-label="name"
                    option-value="id"
                    size="small"
                    class="w-full"
                    disabled
                    fluid
                  />
                  <label for="permanent-delete-source-product" class="text-xs">
                    Текущий продукт
                  </label>
                </FloatLabel>
              </div>
              <span
                aria-hidden="true"
                class="rotate-90 text-center text-color-secondary sm:translate-y-1 sm:rotate-0"
                :class="stackedRows ? 'sm:rotate-90' : ''"
                >→</span
              >
              <div class="min-w-0 pt-2">
                <FloatLabel variant="on">
                  <Select
                    :model-value="commonReplacementId"
                    input-id="permanent-delete-common-replacement"
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
                    @update:model-value="handleCommonReplacementChange"
                  />
                  <label for="permanent-delete-common-replacement" class="text-xs">
                    {{ productTypeLabels[plan.root.type] }}
                  </label>
                </FloatLabel>
              </div>
            </div>
            <Message
              v-if="!commonReplacementOptions.length"
              severity="info"
              :closable="false"
              class="mt-3"
            >
              Единой допустимой замены для всех связей нет. Выбрать замену невозможно.
            </Message>
          </template>
          <div v-if="mode === 'DELETE_CHAIN'" class="mt-1 w-full pt-2">
            <FloatLabel variant="on" class="w-full">
              <InputText
                id="permanent-product-delete-confirmation"
                v-model="confirmationName"
                size="small"
                class="w-full"
                :disabled="busy"
                autocomplete="off"
              />
              <label for="permanent-product-delete-confirmation" class="text-xs">
                {{ confirmationPlaceholder(plan.root.type) }}
              </label>
            </FloatLabel>
          </div>
          <Message v-if="plan.archivedUsages.length" severity="warn" :closable="false" class="mt-4">
            В архиве есть связанные продукты. Их нельзя заменить: восстановите их и измените
            отдельно либо выберите режим удаления.
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
              :severity="mode === 'REPLACE' ? 'primary' : 'success'"
              :outlined="mode !== 'REPLACE'"
              :loading="busy && mode === 'REPLACE'"
              :disabled="
                busy ||
                loadingPlan ||
                Boolean(plan.archivedUsages.length) ||
                (mode === 'REPLACE' && !canConfirm)
              "
              @click="selectMode('REPLACE')"
            />
            <Button
              :label="mode === 'DELETE_CHAIN' ? 'Подтвердить удаление' : 'Удалить в активных'"
              size="small"
              severity="danger"
              :outlined="mode !== 'DELETE_CHAIN'"
              :loading="busy && mode === 'DELETE_CHAIN'"
              :disabled="busy || loadingPlan || (mode === 'DELETE_CHAIN' && !canConfirm)"
              @click="selectMode('DELETE_CHAIN')"
            />
          </div>
          <p
            v-if="
              mode === 'REPLACE' && plan.activeUsages.some((usage) => !usage.replacements.length)
            "
            class="mt-3 text-xs text-color-secondary"
          >
            Для некоторых связанных продуктов нет подходящей замены. Можно удалить связанные
            продукты.
          </p>
        </template>
      </template>
    </AutoHeight>
    <template v-if="!plan || !hasUsages" #footer>
      <Button
        label="Отмена"
        size="small"
        severity="secondary"
        variant="text"
        :disabled="busy"
        @click="visible = false"
      />
      <Button
        v-if="plan && !hasUsages"
        label="Удалить"
        size="small"
        severity="danger"
        :loading="busy"
        :disabled="!canConfirm"
        @click="submit"
      />
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { PermanentDeleteRequestError, useProductArchive } from "../composables/useProductArchive";
import type { PermanentDeletePlan } from "../composables/useProductArchive";
import { activeProductPath, productTypeLabels } from "../product-links";
import { useWorkspaceProductDrawer } from "~/composables/useWorkspaceProductDrawer";

const props = defineProps<{
  companyId: string;
  venueId: string;
  productId: string;
  productName: string;
  productType: import("../composables/useProductArchive").ProductAnalyticsType;
  canManage: boolean;
}>();
const emit = defineEmits<{ deleted: [productId: string] }>();
const { permanentDeletePlan, deletePermanently } = useProductArchive(
  () => props.companyId,
  () => props.venueId,
);
const { open: openProductDrawer, target: productDrawerTarget } = useWorkspaceProductDrawer();
const visible = ref(false);
const busy = ref(false);
const loadingPlan = ref(false);
const confirmationName = ref("");
const errorMessage = ref("");
const plan = ref<PermanentDeletePlan | null>(null);
const mode = ref<"REPLACE" | "DELETE_CHAIN" | null>(null);
const dialogSize = ref<"md" | "lg">("md");
const stackedRows = ref(false);
const requiredRowWidth = ref(0);
const usageList = ref<HTMLElement | null>(null);
const replacementControls = ref<HTMLElement | null>(null);
const resizeObserver = ref<ResizeObserver | null>(null);
const commonReplacementId = ref<string | null>(null);
const hasUsages = computed(() =>
  Boolean(plan.value?.activeUsages.length || plan.value?.archivedUsages.length),
);
const productDrawerOpen = computed(() => Boolean(productDrawerTarget.value));
const hasActiveUsages = computed(() => Boolean(plan.value?.activeUsages.length));
const dialogClass = computed(() => `dialog-size-${dialogSize.value}`);
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
const allUsages = computed(() => [
  ...(plan.value?.activeUsages ?? []),
  ...(plan.value?.archivedUsages ?? []),
]);
const commonReplacementOptions = computed(() => {
  const activeUsages = plan.value?.activeUsages ?? [];
  if (!activeUsages.length) return [];

  const allowedIds = new Set(activeUsages[0].replacements.map((replacement) => replacement.id));
  for (const usage of activeUsages.slice(1)) {
    const usageIds = new Set(usage.replacements.map((replacement) => replacement.id));
    for (const id of allowedIds) {
      if (!usageIds.has(id)) allowedIds.delete(id);
    }
  }

  return activeUsages[0].replacements.filter((replacement) => allowedIds.has(replacement.id));
});
const usageTypePrepositions = {
  INGREDIENT: "ингредиентах",
  PREPARATION: "заготовках",
  GARNISH: "гарнирах",
  COCKTAIL: "коктейлях",
};
const usageTypeSummary = computed(() => {
  const types = [...new Set(allUsages.value.map((usage) => usage.parentType))].map(
    (type) => usageTypePrepositions[type],
  );
  if (types.length < 2) return types[0] ?? "продуктах";
  return `${types.slice(0, -1).join(", ")} и ${types.at(-1)}`;
});
const permanentDeleteMessages = {
  INGREDIENT: "Ингредиент",
  PREPARATION: "Заготовка",
  GARNISH: "Гарнир",
  COCKTAIL: "Коктейль",
};
const permanentDeleteMessageEndings = {
  INGREDIENT: "будет удалён без возможности восстановления.",
  PREPARATION: "будет удалена без возможности восстановления.",
  GARNISH: "будет удалён без возможности восстановления.",
  COCKTAIL: "будет удалён без возможности восстановления.",
};
const canConfirm = computed(() => {
  if (busy.value || loadingPlan.value || !plan.value) return false;
  if (!hasUsages.value) return true;
  if (mode.value === "REPLACE") {
    if (plan.value.archivedUsages.length || !plan.value.activeUsages.length) return false;
    return commonReplacementOptions.value.some(
      (replacement) => replacement.id === commonReplacementId.value,
    );
  }
  if (mode.value === "DELETE_CHAIN") return confirmationName.value === plan.value.root.name;
  return false;
});
const basePath = computed(() => `/app/companies/${props.companyId}/venues/${props.venueId}`);

function handleCommonReplacementChange(nextId: string | null): void {
  commonReplacementId.value = nextId;
}

function availableWidthAtSize(element: HTMLElement, size: "md" | "lg"): number {
  const dialog = element.closest<HTMLElement>(".p-dialog");
  if (!dialog) return element.clientWidth;

  const rootStyle = getComputedStyle(document.documentElement);
  const widthToken = Number.parseFloat(rootStyle.getPropertyValue(`--dialog-width-${size}`));
  const rootFontSize = Number.parseFloat(rootStyle.fontSize);
  const widthRem = widthToken * rootFontSize;
  const dialogWidth = Math.min(widthRem, window.innerWidth - 2 * rootFontSize);

  return element.clientWidth + dialogWidth - dialog.getBoundingClientRect().width;
}

function updateDialogSize(): void {
  const controls = replacementControls.value;
  if (
    !visible.value ||
    !plan.value ||
    mode.value !== "REPLACE" ||
    !controls ||
    !window.matchMedia("(min-width: 40rem)").matches
  ) {
    dialogSize.value = "md";
    stackedRows.value = false;
    requiredRowWidth.value = 0;
    return;
  }

  if (dialogSize.value === "md" && !stackedRows.value) {
    requiredRowWidth.value = controls.scrollWidth;
  }

  const needsLarge = requiredRowWidth.value > availableWidthAtSize(controls, "md");
  dialogSize.value = needsLarge ? "lg" : "md";
  stackedRows.value = needsLarge && requiredRowWidth.value > availableWidthAtSize(controls, "lg");
}

function observeDependencyLayout(): void {
  if (!resizeObserver.value || !visible.value) return;

  resizeObserver.value.disconnect();
  if (usageList.value) resizeObserver.value.observe(usageList.value);
  if (replacementControls.value) resizeObserver.value.observe(replacementControls.value);
}

function usagePath(id: string, type: string, status: string) {
  return status === "ARCHIVED"
    ? `${basePath.value}/archive/${id}`
    : activeProductPath(basePath.value, { id, type });
}

function openUsageDrawer(usage: PermanentDeletePlan["activeUsages"][number]): void {
  if (usage.parentType === "INGREDIENT") return;
  openProductDrawer({ id: usage.parentId, type: usage.parentType, status: usage.parentStatus });
}

function handleUsageLinkClick(
  event: MouseEvent,
  usage: PermanentDeletePlan["activeUsages"][number],
): void {
  const isPlainLeftClick =
    event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

  if (!isPlainLeftClick) return;

  event.preventDefault();
  openUsageDrawer(usage);
}

function confirmationPlaceholder(type: keyof typeof productTypeLabels): string {
  const names = {
    INGREDIENT: "ингредиента",
    PREPARATION: "заготовки",
    GARNISH: "гарнира",
    COCKTAIL: "коктейля",
  };
  return `Введите точное название ${names[type]}`;
}

function selectMode(nextMode: "REPLACE" | "DELETE_CHAIN"): void {
  if (busy.value || loadingPlan.value) return;
  if (mode.value === nextMode) {
    void submit();
    return;
  }
  mode.value = nextMode;
}
watch(visible, (open) => {
  if (open) {
    dialogSize.value = "md";
    stackedRows.value = false;
    requiredRowWidth.value = 0;
    confirmationName.value = "";
    errorMessage.value = "";
    commonReplacementId.value = null;
    mode.value = null;
    plan.value = null;
    void loadPlan();
  }
});

watch(
  [visible, plan, mode],
  async () => {
    await nextTick();
    stackedRows.value = false;
    requiredRowWidth.value = 0;
    await nextTick();
    observeDependencyLayout();
    updateDialogSize();
  },
  { flush: "post" },
);

onMounted(() => {
  resizeObserver.value = new ResizeObserver(updateDialogSize);
  observeDependencyLayout();
});

onBeforeUnmount(() => resizeObserver.value?.disconnect());

async function open(): Promise<void> {
  if (!busy.value) visible.value = true;
}

async function loadPlan(): Promise<void> {
  loadingPlan.value = true;
  try {
    plan.value = await permanentDeletePlan(props.productId);
    mode.value = null;
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Не удалось проверить продукт";
  } finally {
    loadingPlan.value = false;
  }
}

async function submit(): Promise<void> {
  if (!canConfirm.value || !plan.value) return;
  busy.value = true;
  errorMessage.value = "";
  try {
    const action = hasUsages.value ? mode.value : "DELETE";
    await deletePermanently(props.productId, {
      action,
      confirmationFingerprint: plan.value.confirmationFingerprint,
      ...(action === "DELETE_CHAIN" ? { confirmationName: confirmationName.value } : {}),
      ...(action === "REPLACE" ? { replacementProductId: commonReplacementId.value! } : {}),
    });
    visible.value = false;
    emit("deleted", props.productId);
  } catch (error) {
    errorMessage.value =
      error instanceof PermanentDeleteRequestError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Не удалось удалить продукт";
    if (error instanceof PermanentDeleteRequestError && error.problem.plan) {
      plan.value = error.problem.plan;
      commonReplacementId.value = null;
      mode.value = null;
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
