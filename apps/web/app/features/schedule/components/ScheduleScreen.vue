<template>
  <LoadingIndicator v-if="!previewMode && schedule.monthQuery.isLoading.value" screen />
  <section v-else class="space-y-5">
    <header class="flex flex-wrap items-center gap-3">
      <div class="flex flex-wrap items-center gap-2">
        <Button
          icon="pi pi-chevron-left"
          severity="secondary"
          variant="outlined"
          size="small"
          aria-label="Предыдущий месяц"
          :disabled="!canMove(-1)"
          @click="moveMonth(-1)"
        />
        <span class="min-w-36 text-center text-sm font-medium">{{ monthLabel }}</span>
        <Button
          icon="pi pi-chevron-right"
          severity="secondary"
          variant="outlined"
          size="small"
          aria-label="Следующий месяц"
          :disabled="!canMove(1)"
          @click="moveMonth(1)"
        />
        <Button
          v-if="canManage"
          label="Настроить"
          severity="secondary"
          variant="outlined"
          size="small"
          :disabled="previewMode"
          @click="settingsVisible = true"
        />
        <Button
          v-if="canManage"
          label="Сформировать"
          size="small"
          :disabled="previewMode"
          @click="openGenerate"
        />
        <Button
          v-if="canManage"
          label="Продлить"
          severity="secondary"
          variant="outlined"
          size="small"
          :disabled="previewMode"
          @click="extendSchedule"
        />
        <Button
          v-if="canManage"
          label="Шаблон смены"
          severity="secondary"
          variant="outlined"
          size="small"
          :disabled="previewMode"
          @click="openTemplateEditor"
        />
        <SelectButton
          v-if="canManage"
          v-model="exportFormat"
          :options="exportOptions"
          option-label="label"
          option-value="value"
          size="small"
          aria-label="Формат выгрузки"
          :disabled="previewMode"
        />
        <Button
          v-if="canManage"
          label="Выгрузить"
          severity="secondary"
          variant="outlined"
          size="small"
          :loading="busy"
          :disabled="previewMode"
          @click="download"
        />
      </div>
    </header>

    <Message v-if="error" severity="error" :closable="false">{{ error }}</Message>
    <Message
      v-if="!previewMode && schedule.monthQuery.isError.value"
      severity="error"
      :closable="false"
      >Не удалось загрузить график. Обновите страницу и попробуйте ещё раз.</Message
    >
    <div v-if="canManage && selectedCells.length" class="flex flex-wrap items-center gap-2">
      <span class="text-sm text-color-secondary">Выбрано ячеек: {{ selectedCells.length }}</span>
      <Select
        v-model="bulkKind"
        :options="valueKinds"
        option-label="label"
        option-value="value"
        size="small"
        placeholder="Тип значения"
        class="w-44"
      />
      <InputNumber
        v-if="bulkKind === 'SHIFT'"
        v-model="bulkHours"
        :min="1"
        :max="24"
        size="small"
        input-class="w-16"
      />
      <Select
        v-if="bulkKind === 'SHIFT'"
        v-model="bulkShiftType"
        :options="shiftTypes"
        option-label="label"
        option-value="value"
        size="small"
        class="w-32"
      />
      <Select
        v-else-if="bulkKind === 'STATUS'"
        v-model="bulkStatus"
        :options="statusOptions"
        option-label="label"
        option-value="value"
        size="small"
        class="w-40"
      />
      <Button
        label="Применить"
        size="small"
        :disabled="!bulkKind || (bulkKind === 'STATUS' && !bulkStatus)"
        :loading="busy"
        @click="applyBulk"
      />
      <Button
        label="Очистить выбор"
        severity="secondary"
        variant="text"
        size="small"
        @click="selectedCells = []"
      />
    </div>

    <div class="overflow-x-auto">
      <DataTable
        :value="rows"
        size="small"
        scrollable
        show-gridlines
        row-hover
        class="schedule-table text-xs"
        :pt="tablePt"
      >
        <Column
          field="fullName"
          header="ФИО"
          frozen
          header-class="relative z-20 whitespace-nowrap"
          body-class="relative z-10 whitespace-nowrap"
          header-style="padding: 0.25rem 0.5rem"
          body-style="height: 29px; padding: 0 0.5rem"
        >
          <template #body="{ data }">
            <span class="whitespace-nowrap text-xs font-normal">
              {{ data.fullName }}
            </span>
          </template>
        </Column>
        <Column
          field="roleLabel"
          frozen
          header-class="relative z-20 whitespace-nowrap"
          body-class="relative z-10 whitespace-nowrap"
          header-style="padding: 0.25rem 0.5rem; text-align: center"
          body-style="height: 29px; padding: 0 0.5rem"
        >
          <template #header>
            <div class="flex w-full items-center justify-center">Должность</div>
          </template>
          <template #body="{ data }">
            <div class="flex h-full w-full items-center justify-center">
              <Tag :value="data.roleLabel" severity="secondary" :pt="compactTagPt" />
            </div>
          </template>
        </Column>
        <Column
          v-for="day in days"
          :key="day"
          :header-style="isWeekend(day) ? weekendBackgroundStyle : undefined"
          :body-style="dayBodyStyle(day)"
          style="min-width: 30px; width: 30px; max-width: 30px"
        >
          <template #header>
            <div class="flex flex-col items-center justify-center leading-tight">
              <span>{{ day }}</span>
              <span class="text-xs text-color-secondary">{{ weekday(day) }}</span>
            </div>
          </template>
          <template #body="{ data }">
            <div
              class="relative flex h-full min-h-[29px] w-full items-center justify-center"
              :class="{ 'opacity-30': !data.cells[day - 1]?.applicable }"
              @click="handleDayCellClick($event, data, day - 1)"
            >
              <span
                v-if="data.cells[day - 1]?.applicable"
                class="flex h-full w-full shrink-0 cursor-pointer items-center justify-center text-center text-xs font-normal leading-none text-black hover:bg-emphasis"
                :style="cellStyle(data.cells[day - 1].value, isCellSelected(data, day - 1))"
              >
                {{ cellLabel(data.cells[day - 1].value) }}
              </span>
              <span v-else class="text-color-secondary">—</span>
            </div>
          </template>
        </Column>
        <Column
          field="totalHours"
          header="Часы"
          body-style="height: 29px; padding: 0"
          style="min-width: 3rem; width: 3rem"
        >
          <template #body="{ data }">
            <div
              class="flex h-[29px] items-center justify-center text-center text-xs font-normal leading-none text-black"
            >
              {{ data.totalHours }}
            </div>
          </template>
        </Column>
        <Column
          field="totalShifts"
          header="Смены"
          body-style="height: 29px; padding: 0"
          style="min-width: 3rem; width: 3rem"
        >
          <template #body="{ data }">
            <div
              class="flex h-[29px] items-center justify-center text-center text-xs font-normal leading-none text-black"
            >
              {{ data.totalShifts }}
            </div>
          </template>
        </Column>
        <template #empty>
          <span class="text-color-secondary">В этом месяце нет сотрудников</span>
        </template>
      </DataTable>
    </div>

    <div
      class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-md border border-[var(--p-content-border-color)] p-2 text-xs text-color-secondary"
      aria-label="Обозначения графика"
    >
      <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span class="flex items-center gap-1.5">
          <i
            class="inline-block h-4 w-4 shrink-0 rounded border"
            style="
              background-color: var(--p-content-background);
              border-color: var(--p-content-border-color);
            "
          />
          Обычная смена
        </span>
        <span class="flex items-center gap-1.5">
          <i
            class="inline-block h-4 w-4 shrink-0 rounded border"
            style="
              background-color: var(--p-message-info-border-color);
              border-color: var(--p-content-border-color);
            "
          />
          Ночная смена
        </span>
        <span class="flex items-center gap-1.5">
          <i
            class="inline-block h-4 w-4 shrink-0 rounded border"
            style="
              background-color: var(--p-message-warn-border-color);
              border-color: var(--p-content-border-color);
            "
          />
          О — отпуск
        </span>
        <span class="flex items-center gap-1.5">
          <i
            class="inline-block h-4 w-4 shrink-0 rounded border"
            style="
              background-color: var(--p-message-warn-border-color);
              border-color: var(--p-content-border-color);
            "
          />
          Б — больничный
        </span>
        <span class="flex items-center gap-1.5">
          <i
            class="inline-block h-4 w-4 shrink-0 rounded border"
            style="
              background-color: var(--p-message-error-border-color);
              border-color: var(--p-content-border-color);
            "
          />
          Н — неявка
        </span>
      </div>
      <Divider layout="vertical" class="!mx-0 !my-0 self-stretch" />
      <div class="flex items-center gap-4">
        <span>Ctrl + клик — выбрать ячейки для массового редактирования</span>
      </div>
    </div>

    <Dialog v-model:visible="cellVisible" modal header="Ячейка графика" class="w-full max-w-lg">
      <div v-if="activeCell" class="space-y-4">
        <p class="text-sm text-color-secondary">
          {{ activeRow?.fullName }} · {{ activeCell.date }}
        </p>
        <section v-if="canEdit" class="space-y-3">
          <FloatLabel variant="on"
            ><Select
              v-model="editKind"
              input-id="schedule-value-kind"
              :options="valueKinds"
              option-label="label"
              option-value="value"
              size="small"
              class="w-full"
            /><label for="schedule-value-kind">Значение</label></FloatLabel
          >
          <div v-if="editKind === 'SHIFT'" class="flex gap-2">
            <InputNumber v-model="editHours" :min="1" :max="24" size="small" input-class="w-20" />
            <Select
              v-model="editShiftType"
              :options="shiftTypes"
              option-label="label"
              option-value="value"
              size="small"
              class="w-full"
            />
          </div>
          <Select
            v-else-if="editKind === 'STATUS'"
            v-model="editStatus"
            :options="statusOptions"
            option-label="label"
            option-value="value"
            size="small"
            class="w-full"
            placeholder="Статус"
          />
          <Button label="Сохранить значение" size="small" :loading="busy" @click="saveCell" />
        </section>
        <section class="space-y-2">
          <h2 class="text-sm font-medium">Комментарий</h2>
          <Textarea
            v-model="commentText"
            rows="3"
            maxlength="1000"
            class="w-full"
            :disabled="busy"
            placeholder="Комментарий к этому дню"
          />
          <p v-if="activeCell.comment" class="text-xs text-color-secondary">
            Обновил {{ activeCell.comment.updatedBy }} ·
            {{ formatDate(activeCell.comment.updatedAt) }}
          </p>
          <Button
            label="Сохранить комментарий"
            severity="secondary"
            variant="outlined"
            size="small"
            :loading="busy"
            :disabled="!commentText.trim()"
            @click="saveCellComment"
          />
          <ul
            v-if="activeCell.comment?.history.length"
            class="space-y-1 border-t border-surface pt-2 text-xs text-color-secondary"
          >
            <li
              v-for="(entry, index) in activeCell.comment.history"
              :key="`${entry.createdAt}-${index}`"
            >
              {{ entry.author }} · {{ formatDate(entry.createdAt) }}: {{ entry.text }}
            </li>
          </ul>
          <ul
            v-if="activeCell.history.length"
            class="max-h-36 space-y-1 overflow-auto border-t border-surface pt-2 text-xs text-color-secondary"
          >
            <li v-for="(entry, index) in activeCell.history" :key="`${entry.createdAt}-${index}`">
              {{ entry.author }} · {{ formatDate(entry.createdAt) }}:
              {{ cellLabel(entry.oldValue as ScheduleValue | null) }} →
              {{ cellLabel(entry.newValue as ScheduleValue | null) }}
            </li>
          </ul>
        </section>
      </div>
    </Dialog>

    <Dialog
      v-model:visible="generateVisible"
      modal
      header="Сформировать график"
      class="w-full max-w-3xl"
    >
      <div class="space-y-4">
        <p class="text-sm text-color-secondary">
          Выберите шаблон и дату привязки для каждого периода членства. Уже заполненные ячейки
          останутся без изменений.
        </p>
        <label class="flex items-center gap-2 text-sm"
          ><Checkbox v-model="overwriteExisting" binary size="small" />Заменить существующие
          значения (с подтверждением)</label
        >
        <DataTable :value="assignmentRows" size="small" scrollable>
          <Column field="fullName" header="Сотрудник" />
          <Column field="roleLabel" header="Должность" />
          <Column header="Шаблон">
            <template #body="{ data }">
              <Select
                v-model="data.templateId"
                :options="templates"
                option-label="name"
                option-value="id"
                size="small"
                class="w-full"
                placeholder="Шаблон"
                @update:model-value="setAssignmentVersion(data)"
              />
            </template>
          </Column>
          <Column header="Начало цикла">
            <template #body="{ data }">
              <DatePicker v-model="data.anchor" date-format="dd.mm.yy" size="small" />
            </template>
          </Column>
          <Column header="Заполнять с">
            <template #body="{ data }">
              <DatePicker v-model="data.applyFrom" date-format="dd.mm.yy" size="small" />
            </template>
          </Column>
        </DataTable>
        <div class="flex justify-end gap-2">
          <Button
            label="Отмена"
            severity="secondary"
            variant="text"
            size="small"
            @click="generateVisible = false"
          /><Button label="Сформировать" size="small" :loading="busy" @click="generateSchedule" />
        </div>
      </div>
    </Dialog>

    <Dialog v-model:visible="templateVisible" modal header="Шаблон смены" class="w-full max-w-md">
      <form class="space-y-4" @submit.prevent="saveTemplate">
        <Select
          v-model="selectedTemplateId"
          :options="customTemplates"
          option-label="name"
          option-value="id"
          size="small"
          class="w-full"
          show-clear
          placeholder="Новый шаблон или выберите для новой версии"
        />
        <FloatLabel variant="on"
          ><InputText
            v-model="templateForm.name"
            input-id="template-name"
            size="small"
            maxlength="80"
            class="w-full"
          /><label for="template-name">Название</label></FloatLabel
        >
        <div class="grid grid-cols-2 gap-3">
          <FloatLabel variant="on"
            ><InputNumber
              v-model="templateForm.workDays"
              input-id="template-work"
              size="small"
              :min="1"
              :max="31"
              class="w-full"
            /><label for="template-work">Рабочих дней</label></FloatLabel
          ><FloatLabel variant="on"
            ><InputNumber
              v-model="templateForm.offDays"
              input-id="template-off"
              size="small"
              :min="1"
              :max="31"
              class="w-full"
            /><label for="template-off">Выходных</label></FloatLabel
          >
        </div>
        <div class="flex gap-2">
          <FloatLabel variant="on" class="w-full"
            ><InputNumber
              v-model="templateForm.durationHours"
              input-id="template-hours"
              size="small"
              :min="1"
              :max="24"
              class="w-full"
            /><label for="template-hours">Часов в смене</label></FloatLabel
          ><Select
            v-model="templateForm.shiftType"
            :options="shiftTypes"
            option-label="label"
            option-value="value"
            size="small"
            class="w-full"
          />
        </div>
        <div class="flex justify-end gap-2">
          <Button
            label="Отмена"
            severity="secondary"
            variant="text"
            size="small"
            @click="templateVisible = false"
          /><Button
            type="submit"
            label="Сохранить шаблон"
            size="small"
            :loading="busy"
            :disabled="!templateForm.name.trim()"
          />
        </div>
      </form>
    </Dialog>

    <Dialog
      v-model:visible="settingsVisible"
      modal
      header="Настройки графика"
      class="w-full max-w-sm"
    >
      <form class="space-y-4" @submit.prevent="saveSettings">
        <FloatLabel variant="on"
          ><InputNumber
            v-model="standardHours"
            input-id="standard-hours"
            size="small"
            :min="1"
            :max="24"
            class="w-full"
          /><label for="standard-hours">Стандартная длительность смены, ч</label></FloatLabel
        >
        <div class="flex justify-end">
          <Button type="submit" label="Сохранить" size="small" :loading="busy" />
        </div>
      </form>
    </Dialog>
  </section>
</template>

<script setup lang="ts">
import type { Workspace } from "~/types/user-workspaces";
import {
  useSchedule,
  type ScheduleMonth,
  type ScheduleRow,
  type ScheduleValue,
} from "../composables/useSchedule";

const props = withDefaults(defineProps<{ workspace: Workspace; previewMode?: boolean }>(), {
  previewMode: false,
});
const previewMode = computed(() => props.previewMode && import.meta.dev);
const route = useRoute();
const now = new Date();
const year = ref(Number(route.query.year) || now.getFullYear());
const month = ref(Number(route.query.month) || now.getMonth() + 1);
const schedule = useSchedule(
  props.workspace.company.id,
  props.workspace.venue.id,
  year,
  month,
  computed(() => !previewMode.value),
);
const canManage = computed(() => props.workspace.permissions.includes("manage_schedule"));
const canEdit = computed(() => canManage.value && !previewMode.value);
const busy = ref(false);
const error = ref("");
const cellVisible = ref(false);
const generateVisible = ref(false);
const templateVisible = ref(false);
const settingsVisible = ref(false);
const activeRow = ref<ScheduleRow | null>(null);
const activeCellIndex = ref(-1);
const editKind = ref<"SHIFT" | "STATUS" | "EMPTY">("SHIFT");
const editHours = ref(12);
const editShiftType = ref<"NORMAL" | "NIGHT">("NORMAL");
const editStatus = ref<"VACATION" | "SICK_LEAVE" | "NO_SHOW" | null>(null);
const commentText = ref("");
const selectedCells = ref<string[]>([]);
const bulkKind = ref<"SHIFT" | "STATUS" | "EMPTY" | null>(null);
const bulkHours = ref(12);
const bulkShiftType = ref<"NORMAL" | "NIGHT">("NORMAL");
const bulkStatus = ref<"VACATION" | "SICK_LEAVE" | "NO_SHOW" | null>(null);
const exportFormat = ref<"xlsx" | "pdf">("xlsx");
const overwriteExisting = ref(false);
const selectedTemplateId = ref<string | null>(null);
const standardHours = ref(12);
const templateForm = reactive({
  name: "",
  workDays: 2,
  offDays: 2,
  durationHours: 12,
  shiftType: "NORMAL" as "NORMAL" | "NIGHT",
});
const assignmentRows = ref<
  Array<{
    membershipId: string;
    fullName: string;
    roleLabel: string;
    templateId: string;
    templateVersionId: string;
    anchor: Date;
    applyFrom: Date;
  }>
>([]);
const templates = computed(() => schedule.templatesQuery.data.value ?? []);
const customTemplates = computed(() => templates.value.filter((template) => !template.isSystem));
const monthResponse = computed(() => {
  if (previewMode.value) return createPreviewMonth(year.value, month.value);
  return schedule.monthQuery.data.value as unknown as
    import("../composables/useSchedule").ScheduleMonth | undefined;
});
const rows = computed(() => monthResponse.value?.rows ?? []);
const days = computed(() =>
  Array.from(
    { length: monthResponse.value?.daysInMonth ?? new Date(year.value, month.value, 0).getDate() },
    (_, index) => index + 1,
  ),
);
const activeCell = computed(() => activeRow.value?.cells[activeCellIndex.value] ?? null);
const monthLabel = computed(() =>
  new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" }).format(
    new Date(year.value, month.value - 1, 1),
  ),
);
const monthStart = new Date(now.getFullYear(), now.getMonth() - 12, 1);
const monthEnd = new Date(now.getFullYear(), now.getMonth() + 2, 1);
const valueKinds = [
  { label: "Смена", value: "SHIFT" },
  { label: "Статус", value: "STATUS" },
  { label: "Очистить", value: "EMPTY" },
];
const shiftTypes = [
  { label: "Обычная", value: "NORMAL" },
  { label: "Ночная", value: "NIGHT" },
];
const statusOptions = [
  { label: "Отпуск — О", value: "VACATION" },
  { label: "Больничный — Б", value: "SICK_LEAVE" },
  { label: "Неявка — Н", value: "NO_SHOW" },
];
const exportOptions = [
  { label: "Excel", value: "xlsx" },
  { label: "PDF", value: "pdf" },
];
const tablePt = {
  root: {
    style: {
      "--p-datatable-border-color": "var(--p-content-border-color)",
    },
  },
  headerCell: {
    class: "whitespace-nowrap px-1 py-1 text-xs",
    style: { borderColor: "var(--p-content-border-color)", fontWeight: "400" },
  },
  bodyCell: { class: "px-1 py-1 text-xs", style: { borderColor: "var(--p-content-border-color)" } },
};
const weekendBackgroundStyle = { backgroundColor: "var(--p-content-hover-background)" };
const compactTagPt = {
  root: {
    style: { fontSize: "0.75rem", padding: "0.125rem 0.375rem" },
  },
  label: { style: { fontWeight: "400" } },
};

function weekday(day: number): string {
  return new Intl.DateTimeFormat("ru-RU", { weekday: "short" })
    .format(new Date(year.value, month.value - 1, day))
    .replace(".", "");
}

function isWeekend(day: number): boolean {
  const weekdayIndex = new Date(year.value, month.value - 1, day).getDay();
  return weekdayIndex === 5 || weekdayIndex === 6;
}

function createPreviewMonth(selectedYear: number, selectedMonth: number): ScheduleMonth {
  const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
  const employees = [
    {
      name: "Демо-бар-менеджер",
      role: "BAR_MANAGER",
      label: "Бар-менеджер",
      work: 2,
      off: 2,
      start: 0,
      hours: 12,
      night: false,
    },
    {
      name: "Демо-старший бармен",
      role: "SENIOR_BARTENDER",
      label: "Старший бармен",
      work: 3,
      off: 3,
      start: 2,
      hours: 10,
      night: true,
    },
    {
      name: "Демо-бармен 1",
      role: "BARTENDER",
      label: "Бармен",
      work: 2,
      off: 2,
      start: 1,
      hours: 12,
      night: false,
    },
    {
      name: "Демо-бармен 2",
      role: "BARTENDER",
      label: "Бармен",
      work: 3,
      off: 3,
      start: 4,
      hours: 9,
      night: false,
    },
    {
      name: "Демо-бармен 3",
      role: "BARTENDER",
      label: "Бармен",
      work: 4,
      off: 2,
      start: 3,
      hours: 12,
      night: true,
    },
    {
      name: "Демо-бармен 4",
      role: "BARTENDER",
      label: "Бармен",
      work: 5,
      off: 1,
      start: 5,
      hours: 10,
      night: false,
    },
    {
      name: "Демо-бармен 5",
      role: "BARTENDER",
      label: "Бармен",
      work: 6,
      off: 1,
      start: 1,
      hours: 8,
      night: false,
    },
    {
      name: "Демо-бармен 6",
      role: "BARTENDER",
      label: "Бармен",
      work: 2,
      off: 2,
      start: 3,
      hours: 10,
      night: true,
    },
    {
      name: "Демо-барбек 1",
      role: "BARBACK",
      label: "Барбек",
      work: 4,
      off: 2,
      start: 0,
      hours: 8,
      night: false,
    },
    {
      name: "Демо-барбек 2",
      role: "BARBACK",
      label: "Барбек",
      work: 3,
      off: 3,
      start: 1,
      hours: 10,
      night: false,
    },
    {
      name: "Демо-стажёр",
      role: "TRAINEE",
      label: "Стажёр",
      work: 5,
      off: 1,
      start: 2,
      hours: 8,
      night: false,
    },
  ] as const;
  return {
    year: selectedYear,
    month: selectedMonth,
    daysInMonth,
    standardShiftDurationHours: 12,
    rows: employees.map((employee, index) => {
      const cells = Array.from({ length: daysInMonth }, (_, dayIndex) => {
        const date = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-${String(dayIndex + 1).padStart(2, "0")}`;
        const cyclePosition = (dayIndex + employee.start) % (employee.work + employee.off);
        const isScheduled = cyclePosition < employee.work;
        const statusRoll = (dayIndex * 7 + index * 11) % 23;
        const value: ScheduleValue | null = isScheduled
          ? statusRoll === 0
            ? { kind: "STATUS", status: "NO_SHOW" }
            : statusRoll === 1
              ? { kind: "STATUS", status: "VACATION" }
              : statusRoll === 2
                ? { kind: "STATUS", status: "SICK_LEAVE" }
                : {
                    kind: "SHIFT",
                    durationHours: employee.hours,
                    shiftType: employee.night && (dayIndex + index) % 3 !== 0 ? "NIGHT" : "NORMAL",
                  }
          : null;
        return { date, applicable: true, value, comment: null, history: [] };
      });
      return {
        membershipId: `demo-membership-${index + 1}`,
        rolePeriodId: `demo-role-period-${index + 1}`,
        fullName: employee.name,
        role: employee.role,
        roleLabel: employee.label,
        cells,
        totalHours: cells.reduce(
          (total, cell) => total + (cell.value?.kind === "SHIFT" ? cell.value.durationHours : 0),
          0,
        ),
        totalShifts: cells.filter((cell) => cell.value?.kind === "SHIFT").length,
      };
    }),
  };
}

watch(
  monthResponse,
  (value) => {
    if (value) standardHours.value = value.standardShiftDurationHours;
  },
  { immediate: true },
);
watch(selectedTemplateId, (templateId) => {
  const template = customTemplates.value.find((item) => item.id === templateId);
  if (!template) return;
  templateForm.name = template.name;
  templateForm.workDays = template.currentVersion.workDays;
  templateForm.offDays = template.currentVersion.offDays;
  templateForm.durationHours = template.currentVersion.durationHours;
  templateForm.shiftType = template.currentVersion.shiftType;
});
function canMove(offset: number): boolean {
  const target = new Date(year.value, month.value - 1 + offset, 1);
  return target >= monthStart && target <= monthEnd;
}
function moveMonth(offset: number): void {
  const target = new Date(year.value, month.value - 1 + offset, 1);
  year.value = target.getFullYear();
  month.value = target.getMonth() + 1;
  void navigateTo({ query: { ...route.query, year: year.value, month: month.value } });
}
function cellLabel(value: ScheduleValue | null | unknown): string {
  if (!value || typeof value !== "object" || !("kind" in value)) return "";
  const item = value as ScheduleValue;
  if (item.kind === "SHIFT") return String(item.durationHours);
  if (item.kind === "EMPTY") return "";
  return { VACATION: "О", SICK_LEAVE: "Б", NO_SHOW: "Н" }[item.status];
}
function cellStyle(
  value: ScheduleValue | null,
  selected: boolean,
): Record<string, string> | undefined {
  const style: Record<string, string> = {};
  if (value?.kind === "SHIFT" && value.shiftType === "NIGHT")
    style.backgroundColor = "var(--p-message-info-border-color)";
  if (value?.kind === "STATUS")
    style.backgroundColor =
      value.status === "NO_SHOW"
        ? "var(--p-message-error-border-color)"
        : "var(--p-message-warn-border-color)";
  if (selected) style.boxShadow = "inset 0 0 0 2px var(--p-primary-color)";
  return Object.keys(style).length ? style : undefined;
}
function dayBodyStyle(day: number): Record<string, string> {
  return {
    height: "29px",
    padding: "0",
    ...(isWeekend(day) ? weekendBackgroundStyle : {}),
  };
}
function isCellSelected(row: ScheduleRow, index: number): boolean {
  const cell = row.cells[index];
  return !!cell && selectedCells.value.includes(`${row.membershipId}:${cell.date}`);
}
function handleDayCellClick(event: MouseEvent, row: ScheduleRow, index: number): void {
  const cell = row.cells[index];
  if (!cell?.applicable || previewMode.value) return;

  if ((event.ctrlKey || event.metaKey) && canEdit.value) {
    const key = `${row.membershipId}:${cell.date}`;
    selectedCells.value = selectedCells.value.includes(key)
      ? selectedCells.value.filter((selectedKey) => selectedKey !== key)
      : [...selectedCells.value, key];
    return;
  }

  selectedCells.value = [];
  openCell(row, index);
}
function openCell(row: ScheduleRow, index: number): void {
  activeRow.value = row;
  activeCellIndex.value = index;
  const value = row.cells[index].value;
  editKind.value = value?.kind ?? "SHIFT";
  editHours.value =
    value?.kind === "SHIFT"
      ? value.durationHours
      : (monthResponse.value?.standardShiftDurationHours ?? 12);
  editShiftType.value = value?.kind === "SHIFT" ? value.shiftType : "NORMAL";
  editStatus.value = value?.kind === "STATUS" ? value.status : null;
  commentText.value = row.cells[index].comment?.text ?? "";
  error.value = "";
  cellVisible.value = true;
}
function valueFor(
  kind: "SHIFT" | "STATUS" | "EMPTY",
  hours = 12,
  shiftType: "NORMAL" | "NIGHT" = "NORMAL",
  status: typeof editStatus.value = null,
): ScheduleValue {
  if (kind === "SHIFT") return { kind, durationHours: hours, shiftType };
  if (kind === "STATUS") return { kind, status: status ?? "VACATION" };
  return { kind };
}
async function run(action: () => Promise<void>): Promise<void> {
  busy.value = true;
  error.value = "";
  try {
    await action();
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "Не удалось сохранить изменения";
  } finally {
    busy.value = false;
  }
}
function saveCell(): void {
  if (!activeRow.value || !activeCell.value) return;
  void run(async () => {
    await schedule.updateCell({
      membershipId: activeRow.value!.membershipId,
      date: activeCell.value!.date,
      value: valueFor(editKind.value, editHours.value, editShiftType.value, editStatus.value),
    });
    cellVisible.value = false;
  });
}
function saveCellComment(): void {
  if (!activeRow.value || !activeCell.value) return;
  void run(async () => {
    await schedule.saveComment(
      activeRow.value!.membershipId,
      activeCell.value!.date,
      commentText.value.trim(),
    );
    cellVisible.value = false;
  });
}
function applyBulk(): void {
  const cells = selectedCells.value.map((key) => {
    const [membershipId, date] = key.split(":");
    return {
      membershipId,
      date,
      value: valueFor(
        bulkKind.value ?? "EMPTY",
        bulkHours.value,
        bulkShiftType.value,
        bulkStatus.value,
      ),
    };
  });
  void run(async () => {
    await schedule.updateCells(cells);
    selectedCells.value = [];
  });
}
function openGenerate(): void {
  if (schedule.templatesQuery.isLoading.value) return;
  const unique = new Map<string, ScheduleRow>();
  for (const row of rows.value)
    if (!unique.has(row.membershipId)) unique.set(row.membershipId, row);
  assignmentRows.value = [...unique.values()].map((row) => ({
    membershipId: row.membershipId,
    fullName: row.fullName,
    roleLabel: row.roleLabel,
    templateId: "",
    templateVersionId: "",
    anchor: new Date(year.value, month.value - 1, 1),
    applyFrom: new Date(year.value, month.value - 1, 1),
  }));
  generateVisible.value = true;
}
function setAssignmentVersion(row: (typeof assignmentRows.value)[number]): void {
  row.templateVersionId =
    templates.value.find((item) => item.id === row.templateId)?.currentVersion.id ?? "";
}
function isoDate(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}
function generateSchedule(): void {
  const assignments = assignmentRows.value
    .filter((row) => row.templateId && row.templateVersionId)
    .map((row) => ({
      membershipId: row.membershipId,
      templateId: row.templateId,
      templateVersionId: row.templateVersionId,
      cycleAnchorDate: isoDate(row.anchor),
      applyFromDate: isoDate(row.applyFrom),
    }));
  if (!assignments.length) {
    error.value = "Выберите шаблон хотя бы для одного сотрудника";
    return;
  }
  if (
    overwriteExisting.value &&
    !confirm("Перезаписать существующие значения графика? История изменений сохранится.")
  )
    return;
  void run(async () => {
    await schedule.generate({
      year: year.value,
      month: month.value,
      assignments,
      overwrite: overwriteExisting.value,
    });
    generateVisible.value = false;
    overwriteExisting.value = false;
  });
}
function saveTemplate(): void {
  void run(async () => {
    await schedule.saveTemplate({ ...templateForm }, selectedTemplateId.value ?? undefined);
    templateVisible.value = false;
    templateForm.name = "";
    selectedTemplateId.value = null;
  });
}
function openTemplateEditor(): void {
  selectedTemplateId.value = null;
  templateForm.name = "";
  templateForm.workDays = 2;
  templateForm.offDays = 2;
  templateForm.durationHours = standardHours.value;
  templateForm.shiftType = "NORMAL";
  templateVisible.value = true;
}
function saveSettings(): void {
  void run(async () => {
    await schedule.updateSettings({ standardShiftDurationHours: standardHours.value });
    settingsVisible.value = false;
  });
}
function extendSchedule(): void {
  const next = new Date(year.value, month.value, 1);
  if (
    confirm(
      `Продолжить сохранённые циклы на ${new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" }).format(next)}?`,
    )
  )
    void run(() => schedule.extend(year.value, month.value));
}
function download(): void {
  void run(() => schedule.exportSchedule(exportFormat.value));
}
function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short" }).format(
    new Date(value),
  );
}
</script>

<style scoped>
.schedule-table :deep(.p-datatable-column-title) {
  font-weight: 400;
}

.schedule-table :deep(.p-datatable-thead > tr:first-child > th:first-child) {
  border-top-left-radius: var(--p-border-radius-md);
}

.schedule-table :deep(.p-datatable-thead > tr:first-child > th:last-child) {
  border-top-right-radius: var(--p-border-radius-md);
}

.schedule-table :deep(.p-datatable-tbody > tr:last-child > td:first-child) {
  border-bottom-left-radius: var(--p-border-radius-md);
}

.schedule-table :deep(.p-datatable-tbody > tr:last-child > td:last-child) {
  border-bottom-right-radius: var(--p-border-radius-md);
}
</style>
