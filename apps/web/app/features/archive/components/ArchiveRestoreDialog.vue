<template>
  <Dialog
    v-model:visible="visible"
    modal
    header="Восстановить продукт"
    class="w-full max-w-2xl"
    :closable="!busy"
    :close-on-escape="!busy"
  >
    <Message v-if="errorMessage" severity="error" :closable="false" class="mb-4">{{
      errorMessage
    }}</Message>
    <Skeleton v-if="loading" height="8rem" />
    <template v-else-if="plan">
      <p class="text-sm">
        Восстановление вернёт карточку в активную продукцию. Проверьте весь список изменений.
      </p>
      <div class="mt-4 rounded-lg border border-surface p-3">
        <p class="text-sm font-medium">{{ plan.root.name }}</p>
        <label class="mt-2 flex flex-col gap-2 text-sm">
          {{
            plan.root.nameConflict
              ? "Название уже занято — укажите новое"
              : "Новое название (необязательно)"
          }}
          <InputText v-model="newName" size="small" maxlength="160" />
        </label>
      </div>
      <div
        v-for="node in relevantPlan.dependencies"
        :key="node.id"
        class="mt-3 rounded-lg border border-surface p-3"
      >
        <p class="text-sm font-medium">{{ node.name }}</p>
        <p class="mt-1 text-xs text-color-secondary">
          {{ productTypeLabels[node.type] }} · Используется: {{ parentNames(node.parentIds) }}
        </p>
        <label class="mt-3 flex flex-col gap-2 text-sm">
          Действие
          <Select
            v-model="decisions[node.id]!.action"
            :options="actions"
            option-label="label"
            option-value="value"
            size="small"
          />
        </label>
        <label
          v-if="decisions[node.id]?.action === 'REPLACE'"
          class="mt-3 flex flex-col gap-2 text-sm"
        >
          Активная замена
          <Select
            v-model="decisions[node.id]!.replacementProductId"
            :options="availableReplacements(node)"
            option-label="name"
            option-value="id"
            placeholder="Выберите продукт"
            size="small"
            filter
          />
          <span
            v-if="
              decisions[node.id]?.replacementProductId &&
              !availableReplacements(node).some(
                (candidate) => candidate.id === decisions[node.id]?.replacementProductId,
              )
            "
            class="text-sm text-red-600"
          >
            Эта замена уже выбрана для другого гарнира. Выберите другой продукт.
          </span>
        </label>
        <label v-else class="mt-3 flex flex-col gap-2 text-sm">
          {{
            node.nameConflict
              ? "Название уже занято — укажите новое"
              : "Новое название (необязательно)"
          }}
          <InputText v-model="decisions[node.id]!.newName" size="small" maxlength="160" />
        </label>
      </div>
      <p
        v-if="relevantPlan.dependencies.length < plan.dependencies.length"
        class="mt-3 text-sm text-color-secondary"
      >
        Компоненты заменённых карточек не участвуют в восстановлении и остаются без изменений.
      </p>
      <section class="mt-4 rounded-lg bg-surface-100 p-3 text-sm" aria-label="Итог восстановления">
        <p class="font-medium">Будут восстановлены:</p>
        <ul class="mt-2 space-y-1">
          <li v-for="name in summary.restored" :key="name">{{ name }}</li>
        </ul>
        <template v-if="summary.replacements.length">
          <p class="mt-3 font-medium">Замены только в восстанавливаемых карточках:</p>
          <ul class="mt-2 space-y-1">
            <li v-for="line in summary.replacements" :key="line">{{ line }}</li>
          </ul>
        </template>
      </section>
      <label class="mt-4 flex items-start gap-2 text-sm">
        <Checkbox v-model="confirmed" binary :disabled="busy" />
        Подтверждаю восстановление перечисленных карточек и замену указанных связей
      </label>
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
      <Button v-if="!plan && !loading" label="Повторить" size="small" @click="load" />
      <Button
        v-else
        label="Восстановить"
        size="small"
        :loading="busy"
        :disabled="!plan || !confirmed || loading || incompleteDecision"
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

const props = defineProps<{
  companyId: string;
  venueId: string;
  productId: string;
  productType: ProductAnalyticsType;
}>();
const visible = defineModel<boolean>("visible", { default: false });
const plan = ref<ArchivePlan | null>(null);
const decisions = reactive<Record<string, RestoreInput["decisions"][number]>>({});
const newName = ref("");
const confirmed = ref(false);
const busy = ref(false);
const loading = ref(false);
const errorMessage = ref("");
const { restorePlan, restore } = useProductArchive(
  () => props.companyId,
  () => props.venueId,
);
const actions = [
  { value: "RESTORE", label: "Восстановить исходный продукт" },
  { value: "REPLACE", label: "Заменить активным продуктом" },
];

function applyPlan(next: ArchivePlan) {
  const validIds = new Set(next.dependencies.map((node) => node.id));
  for (const id of Object.keys(decisions)) if (!validIds.has(id)) delete decisions[id];
  for (const node of next.dependencies) {
    const previous = decisions[node.id];
    decisions[node.id] =
      previous &&
      (previous.action !== "REPLACE" ||
        node.replacements.some((candidate) => candidate.id === previous.replacementProductId))
        ? previous
        : { productId: node.id, action: "RESTORE" };
  }
  plan.value = next;
  confirmed.value = false;
}

async function load() {
  loading.value = true;
  errorMessage.value = "";
  try {
    applyPlan(await restorePlan(props.productId));
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "Не удалось получить план восстановления";
  } finally {
    loading.value = false;
  }
}

watch(visible, (open) => {
  if (open) {
    plan.value = null;
    newName.value = "";
    for (const id of Object.keys(decisions)) delete decisions[id];
    void load();
  }
});
watch(
  [decisions, newName],
  () => {
    confirmed.value = false;
  },
  { deep: true },
);

function parentNames(ids: string[]) {
  return ids
    .filter((id) => relevantPlan.value.restoredIds.has(id))
    .map((id) =>
      id === plan.value?.root.id
        ? plan.value.root.name
        : (plan.value?.dependencies.find((node) => node.id === id)?.name ?? "Карточка"),
    )
    .join(", ");
}

const relevantPlan = computed(() => {
  const restoredIds = new Set<string>(plan.value ? [plan.value.root.id] : []);
  const relevantIds = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of plan.value?.dependencies ?? []) {
      if (relevantIds.has(node.id) || !node.parentIds.some((id) => restoredIds.has(id))) continue;
      relevantIds.add(node.id);
      if (decisions[node.id]?.action !== "REPLACE") restoredIds.add(node.id);
      changed = true;
    }
  }
  return {
    restoredIds,
    dependencies: plan.value?.dependencies.filter((node) => relevantIds.has(node.id)) ?? [],
  };
});

function availableReplacements(node: ArchivePlan["dependencies"][number]) {
  if (node.type !== "GARNISH") return node.replacements;
  return node.replacements.filter(
    (candidate) =>
      !relevantPlan.value.dependencies.some(
        (other) =>
          other.id !== node.id &&
          other.type === "GARNISH" &&
          other.parentIds.some((id) => node.parentIds.includes(id)) &&
          decisions[other.id]?.action === "REPLACE" &&
          decisions[other.id]?.replacementProductId === candidate.id,
      ),
  );
}

const incompleteDecision = computed(() =>
  relevantPlan.value.dependencies.some((node) => {
    const decision = decisions[node.id];
    return (
      !decision ||
      (decision.action === "REPLACE" &&
        !availableReplacements(node).some(
          (candidate) => candidate.id === decision.replacementProductId,
        ))
    );
  }),
);

const summary = computed(() => {
  if (!plan.value) return { restored: [], replacements: [] };
  const names: string[] = [newName.value.trim() || plan.value.root.name];
  const replacements: string[] = [];
  const visited = new Set<string>([plan.value.root.id]);
  const walk = (parentId: string, parentName: string) => {
    for (const node of plan.value!.dependencies.filter((item) =>
      item.parentIds.includes(parentId),
    )) {
      const decision = decisions[node.id];
      if (decision?.action === "REPLACE")
        replacements.push(
          `${parentName}: ${node.name} → ${node.replacements.find((item) => item.id === decision.replacementProductId)?.name ?? "выберите замену"}`,
        );
      else if (!visited.has(node.id)) {
        visited.add(node.id);
        const name = decision?.newName?.trim() || node.name;
        names.push(name);
        walk(node.id, name);
      }
    }
  };
  walk(plan.value.root.id, names[0]!);
  return { restored: names, replacements };
});

async function submit() {
  if (!plan.value || !confirmed.value || busy.value || incompleteDecision.value) return;
  busy.value = true;
  errorMessage.value = "";
  try {
    await restore(
      props.productId,
      {
        confirmationFingerprint: plan.value.confirmationFingerprint,
        decisions: relevantPlan.value.dependencies.map((node) => {
          const decision = decisions[node.id]!;
          return decision.action === "REPLACE"
            ? {
                productId: node.id,
                action: "REPLACE",
                replacementProductId: decision.replacementProductId,
              }
            : { productId: node.id, action: "RESTORE", newName: decision.newName || undefined };
        }),
        newName: newName.value || undefined,
      },
      props.productType,
    );
    const base = `/app/companies/${props.companyId}/venues/${props.venueId}`;
    const path = activeProductPath(base, plan.value.root);
    visible.value = false;
    await navigateTo(path ?? `${base}/archive?restored=1`);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Не удалось восстановить продукт";
    if (error instanceof ArchiveRequestError && error.problem.restorePlan)
      applyPlan(error.problem.restorePlan);
  } finally {
    busy.value = false;
  }
}
</script>
