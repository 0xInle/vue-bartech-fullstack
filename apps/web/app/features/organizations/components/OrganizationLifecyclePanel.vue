<template>
  <section v-if="showActions" class="mt-8 rounded-xl border border-surface bg-surface-0 p-5">
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
  </section>
  <Dialog
    v-model:visible="dialogVisible"
    modal
    :dismissable-mask="!preparingOperation && !isSubmitting"
    :closable="dialogMode === 'company' ? !preparingOperation && !isSubmitting : true"
    :close-on-escape="!preparingOperation && !isSubmitting"
    :header="dialogTitle"
    :class="dialogMode === 'company' ? 'w-full max-w-lg' : 'dialog-size-sm'"
    :close-button-props="{
      disabled: preparingOperation || isSubmitting,
      severity: 'secondary',
      text: true,
      rounded: true,
    }"
    :pt="{ pcCloseButton: { root: { class: '!rounded-md' } } }"
  >
    <LoadingIndicator v-if="preparingOperation" class="py-8" />
    <template v-else>
      <div v-if="errorMessage" class="mb-3 p-1">
        <Message severity="error" size="small" :closable="false" :pt="compactMessagePt">
          {{ formatDialogError(errorMessage) }}
        </Message>
      </div>
      <p class="text-sm text-color-secondary">{{ dialogDescription }}</p>
      <ClosureExportPicker
        v-if="operationId"
        ref="closureExportPickerRef"
        :company-id="companyId"
        :operation-id="operationId"
        :operation-type="dialogMode === 'company' ? 'COMPANY' : 'VENUE'"
        :can-create="true"
        @ready="selectedExportId = $event"
        @requested="onExportRequested"
        @error="errorMessage = $event"
      />
      <template v-if="dialogMode === 'company'">
        <Button
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
      </template>
      <div v-else class="mt-4 pt-2">
        <FloatLabel class="w-full" variant="on">
          <InputText
            id="closure-confirmation"
            v-model="confirmationName"
            size="small"
            class="w-full"
            autocomplete="off"
            :disabled="isSubmitting"
          />
          <label for="closure-confirmation" class="text-xs">
            Введите название заведения для подтверждения
          </label>
        </FloatLabel>
      </div>
    </template>
    <template v-if="!preparingOperation" #footer>
      <template v-if="dialogMode === 'company'">
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
      <div v-else class="flex w-full gap-2">
        <Button
          label="Отмена"
          severity="secondary"
          variant="outlined"
          size="small"
          class="flex-auto whitespace-nowrap"
          :disabled="preparingOperation || isSubmitting"
          @click="closeDialog"
        />
        <Button
          label="Выгрузить"
          size="small"
          class="flex-auto whitespace-nowrap"
          :loading="closureExportPickerRef?.isCreating"
          :disabled="!operationId || closureExportPickerRef?.isProcessing"
          @click="requestVenueExport"
        />
        <Button
          :label="dialogMode === 'leaveVenue' ? 'Покинуть и закрыть' : 'Закрыть'"
          severity="danger"
          size="small"
          class="flex-auto whitespace-nowrap"
          :loading="isSubmitting"
          :disabled="!isConfirmationNameValid || !operationId || preparingOperation"
          @click="confirmClosure"
        />
      </div>
    </template>
  </Dialog>
  <Dialog
    v-model:visible="selfLeaveVisible"
    modal
    :dismissable-mask="!isLeaving"
    :closable="!isLeaving"
    :close-on-escape="!isLeaving"
    header="Покинуть заведение?"
    class="dialog-size-sm"
    :pt="{ pcCloseButton: { root: { class: '!rounded-md' } } }"
  >
    <div v-if="selfLeaveError" class="mb-3 p-1">
      <Message severity="error" :closable="false">
        {{ formatDialogError(selfLeaveError) }}
      </Message>
    </div>
    <p class="text-sm text-color-secondary">
      Ваша роль в этом заведении завершится сегодня. Компания, аккаунт и доступ к другим заведениям
      останутся без изменений.
    </p>
    <div class="mt-3 pt-2">
      <FloatLabel class="w-full" variant="on">
        <InputText
          id="self-leave-confirmation"
          v-model="selfLeaveConfirmationName"
          size="small"
          class="w-full"
          autocomplete="off"
          :disabled="isLeaving"
        />
        <label for="self-leave-confirmation" class="text-xs">Название заведения</label>
      </FloatLabel>
    </div>
    <template #footer>
      <div class="grid w-full grid-cols-2 gap-2">
        <Button
          label="Отмена"
          severity="secondary"
          variant="outlined"
          size="small"
          class="w-full"
          :disabled="isLeaving"
          @click="selfLeaveVisible = false"
        />
        <Button
          label="Покинуть заведение"
          severity="danger"
          size="small"
          class="w-full"
          :loading="isLeaving"
          :disabled="selfLeaveConfirmationName !== (props.workspace?.venue.name ?? '')"
          @click="confirmSelfLeave"
        />
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { useOrganizationLifecycle } from "~/features/organizations/composables/useOrganizationLifecycle";
import { useIdentityFlow } from "~/features/identity/composables/useIdentityFlow";
import ClosureExportPicker from "~/features/exports/components/ClosureExportPicker.vue";
import { compactMessagePt } from "~/utils/primevue-message";
import type { CompanySummary, Workspace } from "~/types/user-workspaces";

defineOptions({ name: "OrganizationLifecyclePanel" });

const props = withDefaults(
  defineProps<{
    workspace?: Workspace;
    company?: CompanySummary;
    showCompanyActions?: boolean;
    showActions?: boolean;
  }>(),
  { workspace: undefined, company: undefined, showCompanyActions: true, showActions: true },
);
const identity = useIdentityFlow();
const {
  closeVenue,
  leaveAndCloseVenue,
  leaveVenue,
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
const selfLeaveVisible = ref(false);
const selfLeaveConfirmationName = ref("");
const selfLeaveError = ref("");
const isLeaving = ref(false);
const confirmationName = ref("");
const errorMessage = ref("");
const isSubmitting = ref(false);
const preparingOperation = ref(false);
const operationId = ref("");
const closureExportPickerRef = ref<InstanceType<typeof ClosureExportPicker> | null>(null);
const selectedExportId = ref("");
const exportRequested = ref(false);
const withoutExport = ref(false);
const dialogMode = ref<"venue" | "leaveVenue" | "company">("venue");
const isPending = computed(() => closureQuery.data.value?.status === "PENDING_CLOSURE");
const canOperate = computed(() => closureQuery.isSuccess.value && !isPending.value);
const canLeaveAndClose = computed(() => leaveAndCloseQuery.data.value?.available === true);
const canCloseVenue = computed(() =>
  Boolean(props.workspace?.permissions.includes("manage_venue")),
);
const canCloseCompany = computed(() => props.workspace?.role === "chef_bartender");
const expectedName = computed(() =>
  dialogMode.value !== "company"
    ? (props.workspace?.venue.name ?? "")
    : (props.workspace?.company.name ?? props.company?.name ?? ""),
);
const isConfirmationNameValid = computed(() =>
  dialogMode.value === "company"
    ? confirmationName.value === expectedName.value
    : confirmationName.value.toLocaleLowerCase("ru-RU") ===
      expectedName.value.toLocaleLowerCase("ru-RU"),
);

function formatDialogError(message: string): string {
  const trimmed = message.trim();
  if (!trimmed) return "";
  const trailingPunctuation = trimmed.match(/[.!?…:;]+$/)?.[0];
  if (!trailingPunctuation) return `${trimmed}.`;
  const terminalMark = trailingPunctuation.includes("…")
    ? "…"
    : trailingPunctuation.includes("?")
      ? "?"
      : trailingPunctuation.includes("!")
        ? "!"
        : ".";
  return `${trimmed.slice(0, -trailingPunctuation.length).trimEnd()}${terminalMark}`;
}
const dialogTitle = computed(() =>
  dialogMode.value === "company"
    ? "Закрыть компанию?"
    : dialogMode.value === "leaveVenue"
      ? "Покинуть и закрыть заведение?"
      : "Закрыть заведение?",
);
const dialogDescription = computed(() =>
  dialogMode.value === "company"
    ? "Компания перейдёт в режим только для чтения на 168 часов. В этот срок отменить закрытие сможет только шеф-бармен."
    : "Все рабочие данные будут удалены без возможности восстановления. Вы можете выгрузить все рецепты перед удалением.",
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
const hasChosenClosurePath = computed(() => exportRequested.value || withoutExport.value);

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

async function openSelfLeave(): Promise<void> {
  selfLeaveError.value = "";
  const availability = await leaveAndCloseQuery.refetch();
  if (availability.isError || !availability.data) {
    selfLeaveVisible.value = true;
    selfLeaveError.value = "Не удалось проверить, можно ли покинуть заведение. Попробуйте ещё раз.";
    return;
  }
  if (availability.data.available) {
    await openDialog("leaveVenue");
    return;
  }
  selfLeaveConfirmationName.value = "";
  selfLeaveVisible.value = true;
}

async function confirmSelfLeave(): Promise<void> {
  isLeaving.value = true;
  selfLeaveError.value = "";
  try {
    await leaveVenue(venueId.value, selfLeaveConfirmationName.value);
    await identity.loadSession();
    const nextWorkspace = identity.currentUser.value?.workplaces[0];
    if (nextWorkspace) {
      await navigateTo(
        `/app/companies/${nextWorkspace.company.id}/venues/${nextWorkspace.venue.id}`,
      );
      return;
    }
    const nextCompany = identity.currentUser.value?.companies[0];
    await navigateTo(nextCompany ? `/app/companies/${nextCompany.id}` : "/");
  } catch (error) {
    selfLeaveError.value =
      error instanceof Error ? error.message : "Не удалось покинуть заведение. Попробуйте ещё раз.";
  } finally {
    isLeaving.value = false;
  }
}

async function openVenueClosure(): Promise<void> {
  await openDialog("venue");
}

async function openCompanyClosure(): Promise<void> {
  if (props.workspace?.role === "chef_bartender" || props.company) await openDialog("company");
}

defineExpose({ openVenueClosure, openCompanyClosure, openSelfLeave });

function chooseNoExport() {
  withoutExport.value = true;
  selectedExportId.value = "";
}

function onExportRequested() {
  if (dialogMode.value === "company") {
    exportRequested.value = true;
    withoutExport.value = false;
  } else {
    selectedExportId.value = "";
  }
}

function requestVenueExport() {
  errorMessage.value = "";
  void closureExportPickerRef.value?.createVenueExport();
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
          !selectedExportId.value,
        );
      } else {
        await closeVenue(
          venueId.value,
          confirmationName.value,
          operationId.value,
          selectedExportId.value || undefined,
          !selectedExportId.value,
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
