<template>
  <section class="mt-8 rounded-xl border border-surface bg-surface-0 p-5">
    <h2 class="text-base font-semibold">Закрытие</h2>
    <p v-if="workspace" class="mt-2 text-sm text-color-secondary">
      Закрытие заведения удалит его команду, продукцию и рабочие данные без возможности
      восстановления.
    </p>
    <div class="mt-4 flex flex-wrap gap-2">
      <Button
        v-if="workspace && canLeaveAndClose && canOperate"
        label="Покинуть и закрыть заведение"
        icon="pi pi-sign-out"
        severity="danger"
        size="small"
        @click="openDialog('leaveVenue')"
      />
      <Button
        v-if="workspace && canCloseVenue && canOperate"
        label="Закрыть заведение"
        icon="pi pi-times-circle"
        severity="danger"
        size="small"
        @click="openDialog('venue')"
      />
      <Button
        v-if="showCompanyActions && canCloseCompany && canOperate"
        label="Закрыть компанию"
        icon="pi pi-building"
        severity="danger"
        size="small"
        @click="openDialog('company')"
      />
    </div>
    <Dialog v-model:visible="dialogVisible" modal :header="dialogTitle" class="w-full max-w-lg">
      <p class="text-sm text-color-secondary">{{ dialogDescription }}</p>
      <Message v-if="preparingOperation" severity="info" :closable="false" class="mt-4">
        Подготавливаем операцию закрытия…
      </Message>
      <ClosureExportPicker
        v-else-if="operationId"
        :company-id="companyId"
        :venue-id="workspace?.venue.id"
        :operation-id="operationId"
        :operation-type="dialogMode === 'company' ? 'COMPANY' : 'VENUE'"
        :can-view-archive="workspace?.permissions.includes('view_archive')"
        :can-create="true"
        @ready="selectedExportId = $event"
        @requested="onExportRequested"
      />
      <Button
        v-if="dialogMode !== 'company'"
        class="mt-4"
        label="Продолжить без выгрузки"
        severity="secondary"
        outlined
        size="small"
        :disabled="preparingOperation"
        @click="chooseNoExport"
      />
      <Button
        v-else
        class="mt-4"
        label="Продолжить без выгрузки"
        severity="secondary"
        outlined
        size="small"
        :disabled="preparingOperation"
        @click="chooseNoExport"
      />
      <p v-if="withoutExport" class="mt-3 text-sm text-color-secondary">
        Вы подтвердили закрытие без выгрузки продукции.
      </p>
      <label class="mt-5 block text-sm font-medium" for="closure-confirmation">
        Введите название точно, с учётом регистра
      </label>
      <InputText
        id="closure-confirmation"
        v-model="confirmationName"
        size="small"
        class="mt-2 w-full"
        autocomplete="off"
      />
      <Message v-if="errorMessage" severity="error" :closable="false" class="mt-3">
        {{ errorMessage }}
      </Message>
      <template #footer>
        <Button label="Отмена" severity="secondary" text size="small" @click="closeDialog" />
        <Button
          :label="confirmLabel"
          severity="danger"
          size="small"
          :loading="isSubmitting"
          :disabled="confirmationName !== expectedName || !operationId || !hasChosenClosurePath"
          @click="confirmClosure"
        />
      </template>
    </Dialog>
  </section>
</template>

<script setup lang="ts">
import { useOrganizationLifecycle } from "~/features/organizations/composables/useOrganizationLifecycle";
import ClosureExportPicker from "~/features/exports/components/ClosureExportPicker.vue";
import type { CompanySummary, Workspace } from "~/types/user-workspaces";

defineOptions({ name: "OrganizationLifecyclePanel" });

const props = withDefaults(
  defineProps<{ workspace?: Workspace; company?: CompanySummary; showCompanyActions?: boolean }>(),
  { workspace: undefined, company: undefined, showCompanyActions: true },
);
const {
  closeVenue,
  leaveAndCloseVenue,
  leaveAndCloseQuery,
  beginCompanyClosure,
  prepareVenueClosure,
  prepareCompanyClosure,
  closureQuery,
} = useOrganizationLifecycle(
  computed(() => props.workspace?.company.id ?? props.company?.id ?? ""),
  computed(() => props.workspace?.venue.id ?? ""),
);
const dialogVisible = ref(false);
const confirmationName = ref("");
const errorMessage = ref("");
const isSubmitting = ref(false);
const preparingOperation = ref(false);
const operationId = ref("");
const selectedExportId = ref("");
const exportRequested = ref(false);
const withoutExport = ref(false);
const dialogMode = ref<"venue" | "leaveVenue" | "company">("venue");
const isPending = computed(() => closureQuery.data.value?.status === "PENDING_CLOSURE");
const canOperate = computed(() => closureQuery.isSuccess.value && !isPending.value);
const canLeaveAndClose = computed(() => leaveAndCloseQuery.data.value?.available === true);
const canCloseVenue = computed(
  () =>
    props.workspace?.role === "bar_manager" ||
    props.workspace?.role === "chef_bartender" ||
    Boolean(props.workspace?.permissions.includes("manage_team")),
);
const canCloseCompany = computed(
  () => Boolean(props.company) || props.workspace?.role === "chef_bartender",
);
const expectedName = computed(() =>
  dialogMode.value !== "company"
    ? (props.workspace?.venue.name ?? "")
    : (props.workspace?.company.name ?? props.company?.name ?? ""),
);
const dialogTitle = computed(() =>
  dialogMode.value === "company"
    ? "Закрыть компанию?"
    : dialogMode.value === "leaveVenue"
      ? "Покинуть и закрыть заведение?"
      : "Закрыть заведение?",
);
const dialogDescription = computed(() =>
  dialogMode.value === "leaveVenue"
    ? "Вы единственный локальный сотрудник. Заведение и его рабочие данные будут удалены сразу, а ваше участие в нём прекратится. Перед подтверждением можно отдельно выгрузить продукцию."
    : dialogMode.value === "venue"
      ? "Действие немедленно удалит заведение и его рабочие данные. Перед подтверждением можно отдельно выгрузить продукцию или продолжить без выгрузки."
      : "Компания перейдёт в режим только для чтения на 168 часов. В этот срок шеф-бармен или бар-менеджер сможет отменить закрытие.",
);
const confirmLabel = computed(() =>
  dialogMode.value === "company"
    ? withoutExport.value
      ? "Начать без выгрузки"
      : "Начать ожидание закрытия"
    : dialogMode.value === "leaveVenue"
      ? withoutExport.value
        ? "Покинуть и закрыть без выгрузки"
        : "Покинуть и закрыть с выгрузкой"
      : withoutExport.value
        ? "Закрыть без выгрузки"
        : "Закрыть с выгрузкой",
);
const companyId = computed(() => props.workspace?.company.id ?? props.company?.id ?? "");
const venueId = computed(() => props.workspace?.venue.id ?? "");
const hasChosenClosurePath = computed(() =>
  dialogMode.value === "company"
    ? exportRequested.value || withoutExport.value
    : Boolean(selectedExportId.value) || withoutExport.value,
);

async function openDialog(mode: "venue" | "leaveVenue" | "company") {
  dialogMode.value = mode;
  confirmationName.value = "";
  errorMessage.value = "";
  operationId.value = "";
  selectedExportId.value = "";
  exportRequested.value = false;
  withoutExport.value = false;
  dialogVisible.value = true;
  preparingOperation.value = true;
  try {
    const operation =
      mode === "company" ? await prepareCompanyClosure() : await prepareVenueClosure(venueId.value);
    operationId.value = operation.id;
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "Не удалось подготовить операцию закрытия.";
  } finally {
    preparingOperation.value = false;
  }
}

function chooseNoExport() {
  withoutExport.value = true;
  selectedExportId.value = "";
}

function onExportRequested() {
  exportRequested.value = true;
  withoutExport.value = false;
}

function closeDialog() {
  dialogVisible.value = false;
}

async function confirmClosure() {
  isSubmitting.value = true;
  errorMessage.value = "";
  try {
    if (dialogMode.value !== "company") {
      if (dialogMode.value === "leaveVenue") {
        await leaveAndCloseVenue(
          venueId.value,
          confirmationName.value,
          operationId.value,
          selectedExportId.value || undefined,
          withoutExport.value,
        );
      } else {
        await closeVenue(
          venueId.value,
          confirmationName.value,
          operationId.value,
          selectedExportId.value || undefined,
          withoutExport.value,
        );
      }
      await navigateTo(`/app/closures/${operationId.value}`);
    } else {
      await beginCompanyClosure(confirmationName.value, operationId.value, withoutExport.value);
      closeDialog();
    }
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "Не удалось выполнить закрытие. Попробуйте ещё раз.";
  } finally {
    isSubmitting.value = false;
  }
}
</script>
