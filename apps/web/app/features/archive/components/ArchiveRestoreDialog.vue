<template>
  <slot name="trigger" :open="open" :loading="loadingPlan" />
  <Dialog
    v-model:visible="visible"
    modal
    :draggable="false"
    :dismissable-mask="!busy"
    header="Восстановить продукт"
    :class="dialogClass"
    closable
    :close-on-escape="!busy"
    :close-button-props="{ disabled: busy, severity: 'secondary', text: true, rounded: true }"
    :pt="{ pcCloseButton: { root: { class: '!rounded-md' } } }"
  >
    <Message
      v-if="errorMessage"
      severity="error"
      size="small"
      :closable="false"
      :pt="compactMessagePt"
      class="mb-3"
      >{{ errorMessage }}</Message
    >
    <Message
      v-if="planChanged || warningMessage"
      severity="warn"
      size="small"
      :closable="false"
      :pt="compactMessagePt"
      class="mb-4"
    >
      {{
        planChanged
          ? "Связи продукта были изменены. Восстановление не выполнено. План обновлён. Проверьте актуальный список и подтвердите действие ещё раз."
          : warningMessage
      }}
    </Message>
    <template v-if="plan">
      <p class="text-sm text-color-secondary">
        {{
          products.length === 1
            ? "Продукт будет возвращён в активный список."
            : "Вместе с продуктом будут восстановлены все архивные продукты, необходимые для его состава."
        }}
      </p>
      <Message
        v-if="conflictingProducts.length && !warningMessage && !planChanged"
        severity="warn"
        size="small"
        :closable="false"
        :pt="compactMessagePt"
        class="mt-3"
      >
        Названия некоторых продуктов уже заняты. Измените названия конфликтующих продуктов, чтобы
        продолжить.
      </Message>
      <div class="mt-3 max-h-72 overflow-auto">
        <DataTable
          :value="products"
          data-key="id"
          size="small"
          class="product-list-table w-full text-sm"
          :pt="dependencyTablePt"
        >
          <Column field="name" header="Название">
            <template #body="{ data }">
              <span class="break-words text-sm font-medium">{{ data.name }}</span>
            </template>
          </Column>
          <Column
            header="Продукт"
            style="width: 1%; white-space: nowrap"
            header-class="px-2"
            body-class="px-2"
          >
            <template #body="{ data }">
              <Tag :value="productTypeLabels[data.type]" severity="secondary" :pt="compactTagPt" />
            </template>
          </Column>
          <Column v-if="conflictingProducts.length" header="Новое название">
            <template #body="{ data }">
              <div v-if="isConflicting(data)" class="min-w-48 pt-2">
                <FloatLabel variant="on">
                  <InputText
                    :id="`restore-name-${data.id}`"
                    v-model="newNames[data.id]"
                    size="small"
                    maxlength="160"
                    class="w-full"
                    :disabled="busy"
                  />
                  <label :for="`restore-name-${data.id}`" class="text-xs">
                    Новое название · {{ productTypeLabels[data.type].toLowerCase() }}
                  </label>
                </FloatLabel>
              </div>
            </template>
          </Column>
        </DataTable>
      </div>
    </template>
    <template #footer>
      <Button
        label="Отмена"
        size="small"
        severity="secondary"
        variant="text"
        :disabled="busy"
        @click="visible = false"
      />
      <Button
        v-if="!plan && !loadingPlan"
        label="Повторить проверку"
        size="small"
        :disabled="busy || loadingPlan"
        @click="retryPlan"
      />
      <Button
        v-else
        label="Восстановить"
        size="small"
        :loading="busy"
        :disabled="!plan || loadingPlan || incompleteNames"
        @click="submit"
      />
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import {
  ArchiveRequestError,
  useProductArchive,
  type ArchivePlan,
  type RestoreInput,
  type ProductAnalyticsType,
} from "../composables/useProductArchive";
import { activeProductPath, productTypeLabels } from "../product-links";
import { compactMessagePt } from "~/utils/primevue-message";
import { useToast } from "primevue/usetoast";

const props = defineProps<{
  companyId: string;
  venueId: string;
  productId: string;
  productType: ProductAnalyticsType;
  stayOnPage?: boolean;
}>();
const emit = defineEmits<{ restored: [productId: string] }>();
const toast = useToast();
const visible = ref(false);
const plan = ref<ArchivePlan | null>(null);
const newNames = reactive<Record<string, string>>({});
const lateConflictIds = reactive(new Set<string>());
const busy = ref(false);
const loadingPlan = ref(false);
const errorMessage = ref("");
const warningMessage = ref("");
const planChanged = ref(false);
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
const { restorePlan, restore } = useProductArchive(
  () => props.companyId,
  () => props.venueId,
);
const products = computed(() => (plan.value ? [plan.value.root, ...plan.value.dependencies] : []));
const dialogClass = computed(() => {
  const longestName = Math.max(...products.value.map((product) => product.name.length), 0);
  return `dialog-size-${products.value.length > 6 || longestName > 38 ? "lg" : "md"}`;
});
const conflictingProducts = computed(() => products.value.filter(isConflicting));
const incompleteNames = computed(() =>
  conflictingProducts.value.some((product) => !newNames[product.id]?.trim()),
);

function isConflicting(product: ArchivePlan["root"] | ArchivePlan["dependencies"][number]) {
  return product.nameConflict || lateConflictIds.has(product.id);
}

function applyPlan(next: ArchivePlan) {
  const conflicts = new Set(
    [next.root, ...next.dependencies].filter(isConflicting).map((product) => product.id),
  );
  for (const id of Object.keys(newNames)) if (!conflicts.has(id)) delete newNames[id];
  for (const id of lateConflictIds) if (!conflicts.has(id)) lateConflictIds.delete(id);
  plan.value = next;
}

function resetForm() {
  plan.value = null;
  errorMessage.value = "";
  warningMessage.value = "";
  planChanged.value = false;
  for (const id of Object.keys(newNames)) delete newNames[id];
  lateConflictIds.clear();
}

async function load() {
  loadingPlan.value = true;
  try {
    applyPlan(await restorePlan(props.productId));
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "Не удалось получить план восстановления";
  } finally {
    loadingPlan.value = false;
  }
}

async function open() {
  if (busy.value || loadingPlan.value) return;
  resetForm();
  await load();
  visible.value = true;
}

async function retryPlan() {
  if (busy.value || loadingPlan.value) return;
  visible.value = false;
  resetForm();
  await load();
  visible.value = true;
}

watch(
  [newNames, lateConflictIds],
  () => {
    errorMessage.value = "";
    warningMessage.value = "";
  },
  { deep: true },
);

async function submit() {
  if (!plan.value || busy.value || incompleteNames.value) return;
  busy.value = true;
  errorMessage.value = "";
  warningMessage.value = "";
  planChanged.value = false;
  const currentPlan = plan.value;
  try {
    await restore(
      props.productId,
      {
        confirmationFingerprint: currentPlan.confirmationFingerprint,
        names: conflictingProducts.value.map((product) => ({
          productId: product.id,
          name: newNames[product.id]!.trim(),
        })),
      } satisfies RestoreInput,
      props.productType,
    );
    const base = `/app/companies/${props.companyId}/venues/${props.venueId}`;
    const path = activeProductPath(base, currentPlan.root);
    toast.add({ severity: "success", summary: "Продукт восстановлен.", life: 3000 });
    visible.value = false;
    emit("restored", currentPlan.root.id);
    if (props.stayOnPage) return;
    await navigateTo(path ?? `${base}/archive`);
  } catch (error) {
    const changedPlanError =
      error instanceof ArchiveRequestError &&
      error.problem.code === "PRODUCT_ARCHIVE_RESTORE_PLAN_CHANGED";
    if (changedPlanError && error instanceof ArchiveRequestError) {
      for (const id of Object.keys(newNames)) delete newNames[id];
      lateConflictIds.clear();
      if (error.problem.restorePlan) {
        planChanged.value = true;
        applyPlan(error.problem.restorePlan);
      } else {
        planChanged.value = false;
        plan.value = null;
        errorMessage.value = "Не удалось обновить план восстановления. Повторите проверку.";
      }
    } else if (
      error instanceof ArchiveRequestError &&
      error.problem.code === "PRODUCT_ARCHIVE_NAME_CONFLICT"
    ) {
      const productId = error.problem.productId;
      if (productId) lateConflictIds.add(productId);
      warningMessage.value = "Название уже занято. Укажите новое название продукта.";
    } else {
      errorMessage.value =
        error instanceof Error ? error.message : "Не удалось восстановить продукт";
    }
    if (!changedPlanError && error instanceof ArchiveRequestError && error.problem.restorePlan)
      applyPlan(error.problem.restorePlan);
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
