<template>
  <section class="space-y-5">
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
        <span class="min-w-36 text-center text-sm">{{ monthLabel }}</span>
        <Button
          icon="pi pi-chevron-right"
          severity="secondary"
          variant="outlined"
          size="small"
          aria-label="Следующий месяц"
          :disabled="!canMove(1)"
          @click="moveMonth(1)"
        />
      </div>
      <div class="ml-auto flex flex-wrap items-center justify-end gap-2">
        <Button v-if="canManage" label="Сформировать" size="small" @click="openGenerate" />
        <Button
          v-if="canManage"
          label="Шаблоны"
          severity="secondary"
          variant="outlined"
          size="small"
          @click="openTemplates"
        />
        <Button
          v-if="canManage"
          label="Выгрузить"
          severity="secondary"
          variant="outlined"
          size="small"
          @click="openExport"
        />
      </div>
    </header>

    <Message v-if="error" severity="error" :closable="false" :pt="compactMessagePt">{{
      error
    }}</Message>
    <Message
      v-if="!previewMode && schedule.monthQuery.isError.value"
      severity="error"
      :closable="false"
      :pt="compactMessagePt"
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

    <div
      class="schedule-table-viewport relative"
      :aria-busy="(!previewMode && schedule.monthQuery.isFetching.value) || previewMonthLoading"
    >
      <DataTable
        :value="rows"
        size="small"
        scrollable
        show-gridlines
        row-hover
        class="schedule-table text-sm"
        :pt="tablePt"
      >
        <Column
          field="fullName"
          frozen
          header-class="whitespace-nowrap !font-semibold"
          body-class="whitespace-nowrap"
          :header-style="{
            padding: '0.25rem 0.5rem',
          }"
          :body-style="{
            padding: '0.25rem 0.5rem',
          }"
        >
          <template #header>
            <span class="font-semibold">Сотрудник</span>
          </template>
          <template #body="{ data }">
            <span
              class="whitespace-nowrap text-sm font-normal"
              :class="{ 'cursor-pointer': canEdit && selectedCells.length > 0 }"
              @click.stop="toggleEmployeeSelection(data)"
            >
              {{ data.fullName }}
            </span>
          </template>
        </Column>
        <Column
          field="roleLabel"
          frozen
          header-class="whitespace-nowrap !font-semibold"
          body-class="whitespace-nowrap"
          :header-style="{
            padding: '0.25rem 0.5rem',
            textAlign: 'center',
          }"
          :body-style="{
            padding: '0.25rem 0.5rem',
          }"
        >
          <template #header>
            <div class="flex w-full items-center justify-center font-semibold">Должность</div>
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
          style="min-width: 33px; width: 33px; max-width: 33px"
        >
          <template #header>
            <div class="flex flex-col items-center justify-center leading-tight">
              <span>{{ day }}</span>
              <span class="text-sm text-color-secondary">{{ weekday(day) }}</span>
            </div>
          </template>
          <template #body="{ data }">
            <div
              class="relative flex w-full items-center justify-center"
              :class="{ 'opacity-30': !data.cells[day - 1]?.applicable }"
              @click="handleDayCellClick($event, data, day - 1)"
            >
              <span
                v-if="data.cells[day - 1]?.applicable"
                class="flex min-h-[33px] w-full shrink-0 cursor-pointer items-center justify-center py-2.5 text-center text-xs font-normal leading-none hover:bg-emphasis"
                :style="cellStyle(data.cells[day - 1].value, isCellSelected(data, day - 1))"
              >
                {{ cellLabel(data.cells[day - 1].value) }}
              </span>
              <span v-else class="py-2.5 text-color-secondary">—</span>
            </div>
          </template>
        </Column>
        <Column field="totalHours" body-style="padding: 0" style="min-width: 3rem; width: 3rem">
          <template #header>
            <span class="font-semibold">Часы</span>
          </template>
          <template #body="{ data }">
            <div
              class="flex items-center justify-center py-2.5 text-center text-xs font-normal leading-none"
            >
              {{ data.totalHours }}
            </div>
          </template>
        </Column>
        <Column field="totalShifts" body-style="padding: 0" style="min-width: 3rem; width: 3rem">
          <template #header>
            <span class="font-semibold">Смены</span>
          </template>
          <template #body="{ data }">
            <div
              class="flex items-center justify-center py-2.5 text-center text-xs font-normal leading-none"
            >
              {{ data.totalShifts }}
            </div>
          </template>
        </Column>
        <template #empty>
          <span class="text-color-secondary">В этом месяце нет сотрудников</span>
        </template>
      </DataTable>
      <div
        v-if="(!previewMode && schedule.monthQuery.isFetching.value) || previewMonthLoading"
        class="absolute inset-0 z-50 flex items-center justify-center bg-surface-0/60"
      >
        <LoadingIndicator class="w-auto" />
      </div>
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
          <h2 class="text-base font-medium">Комментарий</h2>
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

    <Drawer
      v-model:visible="generateVisible"
      position="right"
      class="h-screen max-h-screen h-dvh max-h-dvh w-full sm:!w-[42rem]"
      :pt="{
        header: { class: '!items-center' },
        title: { style: { fontSize: '1rem', fontWeight: '600' } },
        pcCloseButton: { root: { class: '!rounded-md' } },
        content: { class: '!flex !min-h-0 !flex-col !overflow-hidden' },
      }"
    >
      <template #header="{ class: titleClass }">
        <div class="flex min-w-0 flex-1 items-center gap-4 pr-4">
          <span :class="[titleClass, 'leading-none']">Формирование графика</span>
          <SelectButton
            :model-value="generationMode"
            :options="generationModeOptions"
            option-label="label"
            option-value="value"
            size="small"
            :allow-empty="false"
            aria-label="Режим графика"
            class="shrink-0"
            @update:model-value="setGenerationMode"
          />
        </div>
      </template>
      <div class="flex h-full min-h-0 flex-col gap-4">
        <Message
          v-if="error"
          severity="error"
          size="small"
          :closable="false"
          :pt="compactMessagePt"
          >{{ error }}</Message
        >
        <div
          class="grid grid-cols-1 gap-3 pt-2 sm:items-end"
          :class="
            generationMode === 'assign' ? 'sm:grid-cols-3' : 'sm:grid-cols-[minmax(0,1fr)_auto]'
          "
        >
          <FloatLabel variant="on">
            <Select
              v-model="generationPeriod"
              input-id="generation-period"
              :options="generationMonthOptions"
              option-label="label"
              option-value="value"
              size="small"
              class="w-full"
            />
            <label for="generation-period" class="text-xs">Месяц</label>
          </FloatLabel>
          <FloatLabel v-if="generationMode === 'assign'" variant="on">
            <Select
              v-model="generationTemplateId"
              input-id="generation-template"
              :options="generationTemplateOptions"
              option-label="label"
              option-value="id"
              size="small"
              class="w-full"
            />
            <label for="generation-template" class="text-xs">Шаблон смен</label>
          </FloatLabel>
          <FloatLabel v-if="generationMode === 'assign'" variant="on">
            <DatePicker
              v-model="generationStartDate"
              input-id="generation-start-date"
              date-format="dd.mm.yy"
              :manual-input="false"
              size="small"
              show-icon
              icon-display="input"
              show-clear
              class="w-full"
            />
            <label for="generation-start-date" class="text-xs">Стартовая дата</label>
          </FloatLabel>
          <Button
            v-if="generationMode === 'extend'"
            label="Применить"
            size="small"
            :disabled="
              !selectedMembershipIds.length ||
              busy ||
              generationPreviewLoading ||
              (!previewMode && generationSchedule.monthQuery.isFetching.value)
            "
            @click="prepareExtension"
          />
        </div>
        <div class="flex items-center justify-end gap-3 text-xs text-color-secondary">
          <span v-if="generationMode === 'assign'"
            >Назначено: {{ Object.keys(generationAssignments).length }}</span
          >
          <span v-else>С назначенным циклом: {{ extendableRows.length }}</span>
          <Divider layout="vertical" class="!mx-0 !my-0 self-stretch" />
          <span>Выделено: {{ selectedMembershipIds.length }}</span>
          <Divider
            v-if="generationMode === 'assign'"
            layout="vertical"
            class="!mx-0 !my-0 self-stretch"
          />
          <Button
            v-if="generationMode === 'assign'"
            label="Применить"
            size="small"
            :loading="busy"
            :disabled="
              !selectedMembershipIds.length ||
              (generationMode === 'assign' && !generationTemplateId) ||
              busy ||
              generationPreviewLoading ||
              (!previewMode && generationSchedule.monthQuery.isFetching.value)
            "
            @click="applyGenerationSettings"
          />
        </div>
        <Message
          v-if="!previewMode && generationSchedule.monthQuery.isError.value"
          severity="error"
          size="small"
          :closable="false"
          :pt="compactMessagePt"
        >
          Не удалось загрузить список сотрудников для выбранного месяца.
        </Message>
        <div
          class="relative min-h-0 flex-1 overflow-hidden"
          :aria-busy="
            (!previewMode && generationSchedule.monthQuery.isFetching.value) ||
            generationPreviewLoading
          "
        >
          <DataTable
            :value="generationRows"
            size="small"
            scrollable
            scroll-height="flex"
            row-hover
            class="generation-table h-full text-sm"
            :pt="generationTablePt"
            @row-click="toggleGenerationRowFromClick"
          >
            <Column field="fullName" header="Сотрудник" body-class="whitespace-nowrap">
              <template #body="{ data }">
                <span class="whitespace-nowrap text-sm font-normal">{{ data.fullName }}</span>
              </template>
            </Column>
            <Column header="Шаблон">
              <template #body="{ data }">
                <Tag
                  v-if="
                    generationMode === 'extend'
                      ? data.assignedTemplateName
                      : data.previousTemplateName
                  "
                  :value="
                    generationMode === 'extend'
                      ? formatCycleName(data.assignedTemplateName)
                      : formatCycleName(data.previousTemplateName)
                  "
                  severity="secondary"
                  :pt="compactTagPt"
                />
                <span v-else class="text-xs text-color-secondary">
                  {{ generationMode === "extend" ? "Нет назначения" : "—" }}
                </span>
              </template>
            </Column>
            <Column
              v-if="generationMode === 'assign'"
              header="Назначение"
              header-class="whitespace-nowrap text-right"
              body-class="whitespace-nowrap text-right"
              header-style="width: 1%; white-space: nowrap"
              body-style="width: 1%; white-space: nowrap"
            >
              <template #body="{ data }">
                <div
                  v-if="generationAssignments[data.membershipId]"
                  class="flex flex-nowrap justify-end gap-1.5"
                >
                  <Tag
                    :value="formatCycleName(generationAssignments[data.membershipId].templateName)"
                    severity="secondary"
                    :pt="compactTagPt"
                  />
                  <Tag
                    :value="formatShortDate(generationAssignments[data.membershipId].startDate)"
                    severity="secondary"
                    :pt="compactTagPt"
                  />
                </div>
                <span v-else class="text-xs text-color-secondary">—</span>
              </template>
            </Column>
            <Column
              header=""
              header-class="align-middle whitespace-nowrap"
              body-class="whitespace-nowrap"
              header-style="width: 1%; white-space: nowrap"
              body-style="width: 1%; white-space: nowrap"
            >
              <template #header>
                <div class="flex items-center justify-center">
                  <Checkbox
                    :model-value="allGenerationRowsSelected"
                    binary
                    size="small"
                    aria-label="Выбрать всех сотрудников"
                    @update:model-value="toggleAllGenerationRows"
                  />
                </div>
              </template>
              <template #body="{ data }">
                <div class="flex justify-center">
                  <Checkbox
                    :model-value="selectedMembershipIds.includes(data.membershipId)"
                    binary
                    size="small"
                    :aria-label="`Выбрать ${data.fullName}`"
                    @update:model-value="toggleGenerationRow(data.membershipId, $event)"
                  />
                </div>
              </template>
            </Column>
          </DataTable>
          <div
            v-if="
              (!previewMode && generationSchedule.monthQuery.isFetching.value) ||
              generationPreviewLoading
            "
            class="absolute inset-0 z-50 flex items-center justify-center bg-surface-0/60"
          >
            <LoadingIndicator class="w-auto" />
          </div>
        </div>
        <div class="mt-auto flex justify-end gap-2 pt-3">
          <Button
            label="Отмена"
            severity="secondary"
            variant="text"
            size="small"
            @click="closeGenerate"
          />
          <Button
            label="Сформировать"
            size="small"
            :loading="busy"
            :disabled="
              generationMode === 'assign'
                ? !Object.keys(generationAssignments).length
                : !isExtensionPrepared
            "
            @click="generationMode === 'assign' ? generateSchedule() : extendSelectedSchedule()"
          />
        </div>
      </div>
    </Drawer>

    <Drawer
      v-model:visible="templateVisible"
      position="right"
      class="h-screen max-h-screen h-dvh max-h-dvh"
      :pt="{
        root: { style: { width: 'calc(226.5px + 2.5rem)', maxWidth: 'calc(100vw - 1rem)' } },
        header: { class: '!items-center' },
        title: { style: { fontSize: '1rem', fontWeight: '600' } },
        pcCloseButton: { root: { class: '!rounded-md' } },
        content: { class: '!flex !min-h-0 !flex-col' },
      }"
    >
      <template #header="{ class: titleClass }">
        <span :class="[titleClass, 'leading-none']">Шаблоны смен</span>
      </template>
      <Message
        v-if="error"
        severity="error"
        size="small"
        :closable="false"
        :pt="compactMessagePt"
        >{{ error }}</Message
      >
      <div
        class="flex min-h-0 w-full max-w-full min-w-0 flex-1 flex-col gap-4 overflow-y-auto pt-1"
      >
        <form class="min-w-0 space-y-3 rounded-lg bg-surface-0" @submit.prevent="saveTemplate">
          <Message
            v-if="duplicateWarningVisible && duplicateTemplate"
            severity="warn"
            size="small"
            :closable="false"
            class="mx-px w-[calc(100%_-_2px)] min-w-0 max-w-full"
            :pt="{
              contentWrapper: { class: 'min-w-0 max-w-full' },
              content: { class: 'min-w-0 max-w-full' },
              text: {
                class: 'min-w-0 break-words',
                style: { fontSize: '0.75rem', fontWeight: '500', lineHeight: '1rem' },
              },
            }"
          >
            Цикл {{ formatCycleName(templateName) }} уже задан
          </Message>
          <div class="flex flex-col gap-3">
            <FloatLabel variant="on" class="min-w-0">
              <InputNumber
                v-model="templateForm.workDays"
                input-id="template-work"
                size="small"
                button-layout="horizontal"
                increment-button-icon="pi pi-plus"
                decrement-button-icon="pi pi-minus"
                show-buttons
                :step="1"
                :min="1"
                :max="31 - templateForm.offDays"
                :max-fraction-digits="0"
                class="w-full min-w-0"
                input-class="w-full min-w-0 border-0 text-center shadow-none"
              />
              <label for="template-work">Рабочих дней</label>
            </FloatLabel>
            <FloatLabel variant="on" class="min-w-0">
              <InputNumber
                v-model="templateForm.offDays"
                input-id="template-off"
                size="small"
                button-layout="horizontal"
                increment-button-icon="pi pi-plus"
                decrement-button-icon="pi pi-minus"
                show-buttons
                :step="1"
                :min="0"
                :max="31 - templateForm.workDays"
                :max-fraction-digits="0"
                class="w-full min-w-0"
                input-class="w-full min-w-0 border-0 text-center shadow-none"
              />
              <label for="template-off">Выходных дней</label>
            </FloatLabel>
            <Button
              type="submit"
              :label="selectedTemplateId ? 'Сохранить шаблон' : 'Создать шаблон'"
              size="small"
              :loading="busy"
              :disabled="!templateFormValid || templateLoading || templateLoadFailed"
              class="w-full"
            />
          </div>
          <div v-if="selectedTemplateId" class="flex items-center justify-between gap-2">
            <span class="text-xs text-color-secondary">Изменение создаст новую версию</span>
            <Button
              label="Отмена"
              severity="secondary"
              variant="text"
              size="small"
              :disabled="busy"
              @click="cancelTemplateEdit"
            />
          </div>
        </form>
        <div v-if="templateLoading" class="flex min-h-20 items-center justify-center">
          <LoadingIndicator class="w-auto" />
        </div>
        <Message
          v-else-if="templateLoadFailed"
          severity="error"
          size="small"
          :closable="false"
          :pt="compactMessagePt"
        >
          Не удалось загрузить шаблоны. Обновите страницу и попробуйте ещё раз.
        </Message>
        <template v-else>
          <section v-if="systemTemplates.length" class="space-y-3">
            <h2 class="text-sm font-semibold">Системные шаблоны</h2>
            <div class="max-w-full overflow-x-auto">
              <div class="flex w-max flex-nowrap gap-0.5">
                <div
                  v-for="template in systemTemplates"
                  :key="template.id"
                  class="flex min-h-8 shrink-0 items-center px-0.5 py-1"
                >
                  <Tag
                    :value="formatCycleName(template.name)"
                    severity="secondary"
                    :pt="{
                      root: { style: { fontSize: '0.75rem', padding: '0.0625rem 0.25rem' } },
                      label: { style: { fontWeight: '400' } },
                    }"
                  />
                </div>
              </div>
            </div>
          </section>
          <Divider class="!my-0" />
          <section
            class="space-y-3"
            style="
              --p-datatable-row-hover-background: color-mix(
                in srgb,
                var(--p-primary-100) 70%,
                var(--p-content-background)
              );
            "
          >
            <h2 class="text-sm font-semibold">Мои шаблоны</h2>
            <div
              v-if="customTemplates.length"
              class="divide-y divide-[var(--p-content-border-color)]"
            >
              <div
                v-for="template in customTemplates"
                :key="template.id"
                class="flex min-h-8 min-w-0 items-center gap-2 px-1 py-1 hover:bg-[var(--p-datatable-row-hover-background)]"
              >
                <Tag
                  :value="formatCycleName(template.name)"
                  severity="secondary"
                  :pt="compactTagPt"
                  class="shrink-0"
                />
                <div class="ml-auto flex shrink-0 items-center gap-1">
                  <Button
                    icon="pi pi-pencil"
                    severity="secondary"
                    variant="text"
                    size="small"
                    class="!h-5 !min-h-5 !w-5 !p-0"
                    aria-label="Редактировать шаблон"
                    :disabled="busy"
                    @click="editTemplate(template)"
                  />
                  <Button
                    icon="pi pi-trash"
                    severity="danger"
                    variant="text"
                    size="small"
                    class="!h-5 !min-h-5 !w-5 !p-0"
                    aria-label="Удалить шаблон"
                    :disabled="busy"
                    @click="confirmDeleteTemplate(template)"
                  />
                </div>
              </div>
            </div>
            <div
              v-else
              class="rounded-lg border border-dashed border-[var(--p-divider-border-color)] p-4 text-center"
            >
              <p class="text-xs text-color-secondary">Пока нет своих шаблонов</p>
            </div>
          </section>
        </template>
      </div>
    </Drawer>

    <Dialog
      v-model:visible="templateDeleteVisible"
      modal
      header="Удалить шаблон?"
      class="w-full max-w-md"
      :pt="{ pcCloseButton: { root: { class: '!rounded-md' } } }"
    >
      <p class="mb-4 text-sm text-color-secondary">
        <template v-if="templateDeleteTarget?.assignmentCount">
          Шаблон «{{ formatCycleName(templateDeleteTarget.name) }}» назначен сотрудникам. Их
          назначения и возможность продолжать цикл будут удалены. Уже заполненные дни графика и
          история изменений сохранятся.
        </template>
        <template v-else>
          Шаблон «{{ formatCycleName(templateDeleteTarget?.name) }}» будет удалён. Уже заполненные
          дни графика и история изменений сохранятся.
        </template>
      </p>
      <div class="flex justify-end gap-2">
        <Button
          label="Отмена"
          severity="secondary"
          variant="text"
          size="small"
          :disabled="busy"
          @click="templateDeleteVisible = false"
        />
        <Button
          label="Удалить"
          severity="danger"
          size="small"
          :loading="busy"
          @click="deleteTemplate"
        />
      </div>
    </Dialog>

    <Dialog
      v-model:visible="exportVisible"
      modal
      dismissable-mask
      header="Выгрузка графика"
      class="w-full max-w-md"
      :pt="{ pcCloseButton: { root: { class: '!rounded-md' } } }"
    >
      <div class="space-y-4">
        <Message v-if="exportError" severity="error" :closable="false" :pt="compactMessagePt">{{
          exportError
        }}</Message>
        <div class="space-y-2">
          <label for="schedule-export-period" class="text-sm">Месяц</label>
          <Select
            v-model="exportPeriod"
            input-id="schedule-export-period"
            :options="exportMonthOptions"
            option-label="label"
            option-value="value"
            size="small"
            class="w-full"
            :disabled="exportBusy"
          />
        </div>
        <div class="flex items-center gap-5">
          <label
            v-for="option in exportOptions"
            :key="option.value"
            class="flex items-center gap-2"
          >
            <RadioButton
              v-model="exportFormat"
              :input-id="`schedule-export-${option.value}`"
              name="schedule-export-format"
              :value="option.value"
              size="small"
              :disabled="exportBusy"
            />
            <span class="text-sm">{{ option.label }}</span>
          </label>
        </div>
        <div class="flex justify-end">
          <Button
            label="Выгрузить"
            size="small"
            :loading="exportBusy"
            :disabled="!exportPeriod"
            @click="download"
          />
        </div>
      </div>
    </Dialog>
  </section>
</template>

<script setup lang="ts">
import { PREVIEW_TEAM_ROSTER } from "~/utils/preview-team-roster";
import { compactMessagePt } from "~/utils/primevue-message";
import type { Workspace } from "~/types/user-workspaces";
import {
  useSchedule,
  type ScheduleMonth,
  type ScheduleRow,
  type ScheduleTemplate,
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
const generationPeriod = ref(monthKey(now.getFullYear(), now.getMonth() + 1));
const generationMode = ref<"assign" | "extend">("assign");
const generationModeOptions = [
  { label: "Формирование", value: "assign" },
  { label: "Продление", value: "extend" },
];
const generationTemplateId = ref<string | null>(null);
const generationStartDate = ref<Date | null>(null);
const generateVisible = ref(false);
const generationYear = computed(() => Number(generationPeriod.value.slice(0, 4)));
const generationMonth = computed(() => Number(generationPeriod.value.slice(5, 7)));
const schedule = useSchedule(
  props.workspace.company.id,
  props.workspace.venue.id,
  year,
  month,
  computed(() => !previewMode.value),
);
const generationSchedule = useSchedule(
  props.workspace.company.id,
  props.workspace.venue.id,
  generationYear,
  generationMonth,
  computed(() => generateVisible.value && !previewMode.value),
);
const canManage = computed(() => props.workspace.permissions.includes("manage_schedule"));
const canEdit = computed(() => canManage.value);
const busy = ref(false);
const previewMonthLoading = ref(false);
const generationPreviewLoading = ref(false);
const error = ref("");
const cellVisible = ref(false);
const templateVisible = ref(false);
const duplicateWarningVisible = ref(false);
const templateDeleteVisible = ref(false);
const templateDeleteTarget = ref<(ScheduleTemplate & { assignmentCount: number }) | null>(null);
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
const exportVisible = ref(false);
const exportPeriod = ref("");
const exportBusy = ref(false);
const exportError = ref("");
const selectedTemplateId = ref<string | null>(null);
const templateForm = reactive({
  workDays: 1,
  offDays: 1,
});
const selectedMembershipIds = ref<string[]>([]);
const preparedExtension = ref<{ period: string; membershipIds: string[] } | null>(null);
const isExtensionPrepared = computed(() => {
  const prepared = preparedExtension.value;
  if (!prepared || prepared.period !== generationPeriod.value) return false;
  return (
    prepared.membershipIds.length === selectedMembershipIds.value.length &&
    prepared.membershipIds.every((id) => selectedMembershipIds.value.includes(id))
  );
});
const generationAssignments = ref<
  Record<
    string,
    { templateId: string; templateVersionId: string; templateName: string; startDate: string }
  >
>({});
const previewTemplates = ref<ScheduleTemplate[]>(createPreviewTemplates());
const previewMonths = new Map<string, ScheduleMonth>();
const previewAssignments = reactive(
  new Map<
    string,
    {
      templateId: string;
      version: ScheduleTemplate["currentVersion"];
      anchor: string;
      applyFrom: string;
    }
  >(),
);
const previewCycleSeeds = [
  [2, 2, 0],
  [3, 3, 2],
  [2, 2, 1],
  [3, 3, 4],
  [4, 2, 3],
  [5, 1, 5],
  [6, 1, 1],
  [2, 2, 3],
  [4, 2, 0],
  [3, 3, 1],
  [5, 1, 2],
] as const;
for (const [index, [workDays, offDays, phaseOffset]] of previewCycleSeeds.slice(0, -1).entries()) {
  const template = previewTemplates.value.find(
    (candidate) =>
      candidate.currentVersion.workDays === workDays &&
      candidate.currentVersion.offDays === offDays,
  );
  if (!template) continue;
  const anchor = isoDate(new Date(now.getFullYear(), 0, 1 - phaseOffset));
  previewAssignments.set(`demo-membership-${index + 1}`, {
    templateId: template.id,
    version: template.currentVersion,
    anchor,
    applyFrom: `${now.getFullYear()}-01-01`,
  });
}
const previewMonth = ref(createPreviewMonth(year.value, month.value));
previewMonths.set(monthKey(year.value, month.value), previewMonth.value);
const templates = computed(() =>
  previewMode.value ? previewTemplates.value : (schedule.templatesQuery.data.value ?? []),
);
const systemTemplates = computed(() => templates.value.filter((template) => template.isSystem));
const customTemplates = computed(() => templates.value.filter((template) => !template.isSystem));
const generationTemplateOptions = computed(() =>
  templates.value.map((template) => ({ ...template, label: formatCycleName(template.name) })),
);
const templateName = computed(() => `${templateForm.workDays}/${templateForm.offDays}`);
const duplicateTemplate = computed(
  () =>
    templates.value.find(
      (template) =>
        template.id !== selectedTemplateId.value &&
        template.currentVersion.workDays === templateForm.workDays &&
        template.currentVersion.offDays === templateForm.offDays,
    ) ?? null,
);
const templateFormValid = computed(
  () =>
    Number.isInteger(templateForm.workDays) &&
    templateForm.workDays >= 1 &&
    templateForm.workDays <= 31 &&
    Number.isInteger(templateForm.offDays) &&
    templateForm.offDays >= 0 &&
    templateForm.offDays <= 30 &&
    templateForm.workDays + templateForm.offDays <= 31,
);
watch([() => templateForm.workDays, () => templateForm.offDays], () => {
  duplicateWarningVisible.value = false;
});
watch(templateVisible, (visible) => {
  if (!visible) duplicateWarningVisible.value = false;
});
const templateLoading = computed(
  () => !previewMode.value && schedule.templatesQuery.isLoading.value,
);
const templateLoadFailed = computed(
  () => !previewMode.value && schedule.templatesQuery.isError.value,
);
const generationMonthOptions = computed(() =>
  Array.from({ length: 3 }, (_, offset) => {
    const date = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const value = monthKey(date.getFullYear(), date.getMonth() + 1);
    return {
      value,
      label: new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" }).format(date),
    };
  }),
);
const generationRows = computed(() => {
  const monthData = previewMode.value
    ? createPreviewMonth(generationYear.value, generationMonth.value)
    : generationSchedule.monthQuery.data.value;
  const unique = new Map<string, ScheduleRow>();
  const previousMonthEnd = new Date(generationYear.value, generationMonth.value - 1, 0);
  for (const row of monthData?.rows ?? []) {
    if (unique.has(row.membershipId)) continue;
    if (previewMode.value) {
      const assignment = previewAssignments.get(row.membershipId);
      const applied = assignment ? new Date(`${assignment.applyFrom}T00:00:00`) : null;
      row.previousTemplateName =
        assignment && applied && applied <= previousMonthEnd
          ? (previewTemplates.value.find((template) => template.id === assignment.templateId)
              ?.name ?? null)
          : null;
      row.assignedTemplateName = assignment
        ? (previewTemplates.value.find((template) => template.id === assignment.templateId)?.name ??
          null)
        : null;
      row.hasScheduleAssignment = Boolean(assignment);
    }
    unique.set(row.membershipId, row);
  }
  return [...unique.values()];
});
const extendableRows = computed(() =>
  generationRows.value.filter((row) => row.hasScheduleAssignment),
);
const selectableGenerationRows = computed(() => generationRows.value);
const allGenerationRowsSelected = computed(
  () =>
    selectableGenerationRows.value.length > 0 &&
    selectableGenerationRows.value.every((row) =>
      selectedMembershipIds.value.includes(row.membershipId),
    ),
);
const monthResponse = computed(() => {
  if (previewMode.value) return previewMonth.value;
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
  { label: previewMode.value ? "CSV" : "Excel (.xlsx)", value: "xlsx" },
  { label: "PDF", value: "pdf" },
];
const exportMonthOptions = computed(() =>
  Array.from({ length: 15 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 12 + index, 1);
    return {
      value: monthKey(date.getFullYear(), date.getMonth() + 1),
      label: new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" }).format(date),
    };
  }),
);
const tablePt = {
  root: {
    style: {
      "--p-datatable-border-color": "var(--p-content-border-color)",
      "--p-datatable-header-cell-border-color": "var(--p-datatable-border-color)",
      "--p-datatable-body-cell-border-color": "var(--p-datatable-border-color)",
    },
  },
  headerCell: {
    class: "whitespace-nowrap px-1 py-1 text-sm",
    style: { fontWeight: "400" },
  },
  bodyCell: { class: "px-1 py-1 text-sm" },
};
const generationTablePt = {
  root: {
    style: {
      "--p-datatable-row-hover-background":
        "color-mix(in srgb, var(--p-primary-100) 70%, var(--p-content-background))",
      "--p-datatable-border-color": "var(--p-content-border-color)",
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
const weekendBackgroundStyle = { backgroundColor: "var(--p-highlight-background)" };
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
  const employees = PREVIEW_TEAM_ROSTER;
  return {
    year: selectedYear,
    month: selectedMonth,
    daysInMonth,
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

function createPreviewTemplates(): ScheduleTemplate[] {
  return [
    ["2/2", 2, 2],
    ["3/3", 3, 3],
    ["4/2", 4, 2],
    ["5/2", 5, 2],
    ["5/1", 5, 1],
    ["6/1", 6, 1],
  ].map(([name, workDays, offDays], index) => {
    const versionId = `demo-system-template-version-${index + 1}`;
    return {
      id: `demo-system-template-${index + 1}`,
      name: String(name),
      isSystem: true,
      currentVersionId: versionId,
      currentVersion: {
        id: versionId,
        version: 1,
        workDays: Number(workDays),
        offDays: Number(offDays),
        durationHours: 12,
        shiftType: "NORMAL",
      },
    };
  });
}

function monthKey(selectedYear: number, selectedMonth: number): string {
  return `${selectedYear}-${String(selectedMonth).padStart(2, "0")}`;
}

let previewMonthRequest = 0;
watch(
  [year, month],
  async ([selectedYear, selectedMonth]) => {
    if (!previewMode.value) return;
    const requestId = ++previewMonthRequest;
    previewMonthLoading.value = true;
    await waitForPreviewResponse();
    if (requestId !== previewMonthRequest) return;
    const key = monthKey(selectedYear, selectedMonth);
    let target = previewMonths.get(key);
    if (!target) {
      target = createPreviewMonth(selectedYear, selectedMonth);
      previewMonths.set(key, target);
    }
    previewMonth.value = target;
    previewMonthLoading.value = false;
  },
  { immediate: true },
);

watch(generationMode, () => {
  selectedMembershipIds.value = [];
  preparedExtension.value = null;
  generationTemplateId.value = null;
  generationStartDate.value = null;
});

let generationPreviewRequest = 0;
watch([generationPeriod, generateVisible], async ([, isVisible]) => {
  selectedMembershipIds.value = [];
  preparedExtension.value = null;
  generationAssignments.value = {};
  generationTemplateId.value = null;
  generationStartDate.value = null;
  if (!previewMode.value || !isVisible) {
    generationPreviewLoading.value = false;
    generationPreviewRequest += 1;
    return;
  }
  const requestId = ++generationPreviewRequest;
  generationPreviewLoading.value = true;
  await waitForPreviewResponse();
  if (requestId === generationPreviewRequest) generationPreviewLoading.value = false;
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
function formatCycleName(name: string | null | undefined): string {
  if (!name) return "";
  const match = /^(\d+)\/(\d+)$/.exec(name);
  return match ? `${match[1]} | ${match[2]}` : name;
}
function cellStyle(
  value: ScheduleValue | null,
  selected: boolean,
): Record<string, string> | undefined {
  const style: Record<string, string> = {};
  if (value?.kind === "SHIFT" && value.shiftType === "NIGHT") {
    style.backgroundColor = "var(--p-message-info-border-color)";
    style.color = "var(--p-surface-950)";
  }
  if (value?.kind === "STATUS") {
    style.backgroundColor =
      value.status === "NO_SHOW"
        ? "var(--p-message-error-border-color)"
        : "var(--p-message-warn-border-color)";
    style.color = "var(--p-surface-950)";
  }
  if (selected) style.boxShadow = "inset 0 0 0 2px var(--p-primary-color)";
  return Object.keys(style).length ? style : undefined;
}
function dayBodyStyle(day: number): Record<string, string> {
  return {
    padding: "0",
    ...(isWeekend(day) ? weekendBackgroundStyle : {}),
  };
}
function isCellSelected(row: ScheduleRow, index: number): boolean {
  const cell = row.cells[index];
  return !!cell && selectedCells.value.includes(`${row.membershipId}:${cell.date}`);
}
function toggleEmployeeSelection(row: ScheduleRow): void {
  if (!canEdit.value || !selectedCells.value.length) return;
  const keys = row.cells
    .filter((cell) => cell.applicable)
    .map((cell) => `${row.membershipId}:${cell.date}`);
  const selected = new Set(selectedCells.value);
  if (keys.every((key) => selected.has(key))) {
    selectedCells.value = selectedCells.value.filter((key) => !keys.includes(key));
    return;
  }
  selectedCells.value = [...new Set([...selectedCells.value, ...keys])];
}
function handleDayCellClick(event: MouseEvent, row: ScheduleRow, index: number): void {
  const cell = row.cells[index];
  if (!cell?.applicable) return;

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
  editHours.value = value?.kind === "SHIFT" ? value.durationHours : 12;
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

function previewSetCell(
  membershipId: string,
  date: string,
  value: ScheduleValue,
  target = previewMonth.value,
): void {
  const row = target.rows.find((item) => item.membershipId === membershipId);
  const cell = row?.cells.find((item) => item.date === date);
  if (!row || !cell || !cell.applicable) return;
  if (JSON.stringify(cell.value) !== JSON.stringify(value)) {
    cell.history.unshift({
      oldValue: cell.value,
      newValue: value.kind === "EMPTY" ? null : value,
      createdAt: new Date().toISOString(),
      author: "Вы",
    });
  }
  cell.value = value.kind === "EMPTY" ? null : value;
  refreshPreviewTotals(row);
}

function refreshPreviewTotals(row: ScheduleRow): void {
  row.totalHours = row.cells.reduce(
    (total, cell) => total + (cell.value?.kind === "SHIFT" ? cell.value.durationHours : 0),
    0,
  );
  row.totalShifts = row.cells.filter((cell) => cell.value?.kind === "SHIFT").length;
}

function previewApplySchedule(
  target: ScheduleMonth,
  assignments: Array<{
    membershipId: string;
    templateId: string;
    versionId: string;
    anchor: string;
    applyFrom: string;
    version?: ScheduleTemplate["currentVersion"];
  }>,
  overwrite: boolean,
): void {
  for (const item of assignments) {
    const template = previewTemplates.value.find((candidate) => candidate.id === item.templateId);
    const row = target.rows.find((candidate) => candidate.membershipId === item.membershipId);
    if (!template || !row) continue;
    const version = item.version ?? template.currentVersion;
    previewAssignments.set(item.membershipId, {
      templateId: item.templateId,
      version: { ...version },
      anchor: item.anchor,
      applyFrom: item.applyFrom,
    });
    const cycleLength = version.workDays + version.offDays;
    const anchor = new Date(`${item.anchor}T00:00:00`);
    const applyFrom = new Date(`${item.applyFrom}T00:00:00`);
    for (const cell of row.cells) {
      const date = new Date(`${cell.date}T00:00:00`);
      if (!cell.applicable || date < applyFrom) continue;
      const offset = Math.floor((date.getTime() - anchor.getTime()) / 86_400_000);
      const cycleDay = ((offset % cycleLength) + cycleLength) % cycleLength;
      const nextValue: ScheduleValue =
        cycleDay < version.workDays
          ? {
              kind: "SHIFT",
              durationHours: version.durationHours,
              shiftType: version.shiftType,
            }
          : { kind: "EMPTY" };
      if (!overwrite && cell.value) continue;
      if (nextValue.kind !== "EMPTY" || overwrite)
        previewSetCell(row.membershipId, cell.date, nextValue, target);
    }
    refreshPreviewTotals(row);
  }
}
async function run(action: () => Promise<void>): Promise<void> {
  busy.value = true;
  error.value = "";
  try {
    if (previewMode.value) await waitForPreviewResponse();
    await action();
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "Не удалось сохранить изменения";
  } finally {
    busy.value = false;
  }
}
function waitForPreviewResponse(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 450));
}
function saveCell(): void {
  if (!activeRow.value || !activeCell.value) return;
  void run(async () => {
    const cell = {
      membershipId: activeRow.value!.membershipId,
      date: activeCell.value!.date,
      value: valueFor(editKind.value, editHours.value, editShiftType.value, editStatus.value),
    };
    if (previewMode.value) previewSetCell(cell.membershipId, cell.date, cell.value);
    else await schedule.updateCell(cell);
    cellVisible.value = false;
  });
}
function saveCellComment(): void {
  if (!activeRow.value || !activeCell.value) return;
  void run(async () => {
    if (previewMode.value) {
      const comment = activeCell.value!.comment;
      const text = commentText.value.trim();
      const now = new Date().toISOString();
      if (comment && comment.text !== text) {
        comment.history.unshift({
          text: comment.text,
          createdAt: comment.updatedAt,
          author: comment.updatedBy,
        });
      }
      activeCell.value!.comment = {
        text,
        updatedAt: now,
        updatedBy: "Вы",
        history: comment?.history ?? [],
      };
    } else {
      await schedule.saveComment(
        activeRow.value!.membershipId,
        activeCell.value!.date,
        commentText.value.trim(),
      );
    }
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
    if (previewMode.value) {
      for (const cell of cells) previewSetCell(cell.membershipId, cell.date, cell.value);
    } else await schedule.updateCells(cells);
    selectedCells.value = [];
  });
}
function openGenerate(): void {
  if (!previewMode.value && schedule.templatesQuery.isLoading.value) return;
  generationMode.value = "assign";
  const defaultPeriod = monthKey(now.getFullYear(), now.getMonth() + 1);
  generationPeriod.value = generationMonthOptions.value.some(({ value }) => value === defaultPeriod)
    ? defaultPeriod
    : monthKey(now.getFullYear(), now.getMonth() + 1);
  generationTemplateId.value = null;
  generationStartDate.value = null;
  selectedMembershipIds.value = [];
  preparedExtension.value = null;
  generationAssignments.value = {};
  generateVisible.value = true;
}
function setGenerationMode(mode: "assign" | "extend"): void {
  generationMode.value = mode;
  if (mode !== "extend") return;
  const nextMonth = monthKey(year.value, month.value + 1);
  if (generationMonthOptions.value.some(({ value }) => value === nextMonth))
    generationPeriod.value = nextMonth;
}
function closeGenerate(): void {
  generateVisible.value = false;
  selectedMembershipIds.value = [];
  preparedExtension.value = null;
  generationAssignments.value = {};
  generationTemplateId.value = null;
  generationStartDate.value = null;
}
function toggleGenerationRow(membershipId: string, selected: boolean | undefined): void {
  preparedExtension.value = null;
  selectedMembershipIds.value = selected
    ? [...new Set([...selectedMembershipIds.value, membershipId])]
    : selectedMembershipIds.value.filter((id) => id !== membershipId);
}
function toggleGenerationRowFromClick(event: { data: ScheduleRow; originalEvent: Event }): void {
  const target = event.originalEvent.target;
  if (target instanceof Element && target.closest("button, input, [role='checkbox'], .p-checkbox"))
    return;

  const membershipId = event.data.membershipId;
  toggleGenerationRow(membershipId, !selectedMembershipIds.value.includes(membershipId));
}
function toggleAllGenerationRows(selected: boolean | undefined): void {
  preparedExtension.value = null;
  selectedMembershipIds.value = selected
    ? selectableGenerationRows.value.map((row) => row.membershipId)
    : [];
}
function effectiveGenerationStartDate(): Date {
  if (generationStartDate.value) return generationStartDate.value;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetStart = new Date(generationYear.value, generationMonth.value - 1, 1);
  return generationYear.value === now.getFullYear() && generationMonth.value === now.getMonth() + 1
    ? today
    : targetStart;
}
function applyGenerationSettings(): void {
  const template = templates.value.find((item) => item.id === generationTemplateId.value);
  if (!template) return;
  const startDate = isoDate(effectiveGenerationStartDate());
  for (const membershipId of selectedMembershipIds.value) {
    generationAssignments.value[membershipId] = {
      templateId: template.id,
      templateVersionId: template.currentVersion.id,
      templateName: template.name,
      startDate,
    };
  }
  selectedMembershipIds.value = [];
  generationTemplateId.value = null;
  generationStartDate.value = null;
}
function isoDate(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}
function formatShortDate(value: string): string {
  const [, monthValue, dayValue] = value.split("-");
  return `с ${dayValue}.${monthValue}`;
}
function generateSchedule(): void {
  const assignments = Object.entries(generationAssignments.value).map(([membershipId, item]) => ({
    membershipId,
    templateId: item.templateId,
    templateVersionId: item.templateVersionId,
    cycleAnchorDate: item.startDate,
    applyFromDate: item.startDate,
  }));
  if (!assignments.length) {
    error.value = "Выберите сотрудников и назначьте им шаблон смен";
    return;
  }
  void run(async () => {
    const body = {
      year: generationYear.value,
      month: generationMonth.value,
      assignments,
    };
    if (previewMode.value) {
      const assignments = membershipIds.flatMap((membershipId) => {
        const assignment = previewAssignments.get(membershipId);
        return assignment
          ? [
              {
                membershipId,
                templateId: assignment.templateId,
                versionId: assignment.version.id,
                anchor: assignment.anchor,
                applyFrom: assignment.applyFrom,
                version: assignment.version,
              },
            ]
          : [];
      });
      if (assignments.length !== membershipIds.length) {
        throw new Error(
          "Невозможно продлить график: у одного или нескольких выбранных сотрудников нет назначенного цикла.",
        );
      }
      const key = monthKey(generationYear.value, generationMonth.value);
      let target = previewMonths.get(key);
      if (!target) {
        target = createPreviewMonth(generationYear.value, generationMonth.value);
        previewMonths.set(key, target);
      }
      previewApplySchedule(
        target,
        assignments.map((item) => ({
          membershipId: item.membershipId,
          templateId: item.templateId,
          versionId: item.templateVersionId,
          anchor: item.cycleAnchorDate,
          applyFrom: item.applyFromDate,
        })),
        false,
      );
    } else await schedule.generate(body);
    closeGenerate();
  });
}
function saveTemplate(): void {
  if (!templateFormValid.value) {
    error.value = "Укажите от 1 до 31 рабочего, от 0 до 30 выходных дней и не более 31 дня в цикле";
    return;
  }
  if (duplicateTemplate.value) {
    error.value = "";
    duplicateWarningVisible.value = true;
    return;
  }
  const input = {
    name: templateName.value,
    workDays: templateForm.workDays,
    offDays: templateForm.offDays,
    durationHours: 12,
    shiftType: "NORMAL" as const,
  };
  void run(async () => {
    const editingId = selectedTemplateId.value;
    if (previewMode.value) {
      const existing = previewTemplates.value.find((item) => item.id === selectedTemplateId.value);
      const versionChanged =
        !existing ||
        existing.currentVersion.workDays !== input.workDays ||
        existing.currentVersion.offDays !== input.offDays ||
        existing.currentVersion.durationHours !== input.durationHours ||
        existing.currentVersion.shiftType !== input.shiftType;
      const version = versionChanged
        ? {
            id: `demo-template-version-${Date.now()}`,
            version: (existing?.currentVersion.version ?? 0) + 1,
            workDays: input.workDays,
            offDays: input.offDays,
            durationHours: input.durationHours,
            shiftType: input.shiftType,
          }
        : null;
      if (existing && !existing.isSystem) {
        existing.name = input.name;
        if (version) {
          existing.currentVersion = version;
          existing.currentVersionId = version.id;
        }
      } else {
        const firstVersion = {
          id: `demo-template-version-${Date.now()}`,
          version: 1,
          workDays: input.workDays,
          offDays: input.offDays,
          durationHours: input.durationHours,
          shiftType: input.shiftType,
        };
        previewTemplates.value.push({
          id: `demo-template-${Date.now()}`,
          name: input.name,
          isSystem: false,
          currentVersionId: firstVersion.id,
          currentVersion: firstVersion,
          _count: { assignments: 0 },
        });
      }
    } else await schedule.saveTemplate(input, editingId ?? undefined);
    duplicateWarningVisible.value = false;
    selectedTemplateId.value = null;
    resetTemplateForm();
  });
}
function editTemplate(template: ScheduleTemplate): void {
  if (template.isSystem) return;
  duplicateWarningVisible.value = false;
  selectedTemplateId.value = template.id;
  templateForm.workDays = template.currentVersion.workDays;
  templateForm.offDays = template.currentVersion.offDays;
  error.value = "";
}
function cancelTemplateEdit(): void {
  duplicateWarningVisible.value = false;
  selectedTemplateId.value = null;
  resetTemplateForm();
  error.value = "";
}
function confirmDeleteTemplate(template: ScheduleTemplate): void {
  if (template.isSystem) return;
  const assignmentCount = previewMode.value
    ? [...previewAssignments.values()].filter((assignment) => assignment.templateId === template.id)
        .length
    : (template._count?.assignments ?? 0);
  templateDeleteTarget.value = { ...template, assignmentCount };
  error.value = "";
  templateDeleteVisible.value = true;
}
function deleteTemplate(): void {
  const target = templateDeleteTarget.value;
  if (!target) return;
  void run(async () => {
    if (previewMode.value) {
      previewTemplates.value = previewTemplates.value.filter((item) => item.id !== target.id);
      for (const [membershipId, assignment] of previewAssignments) {
        if (assignment.templateId === target.id) previewAssignments.delete(membershipId);
      }
    } else await schedule.deleteTemplate(target.id);
    templateDeleteVisible.value = false;
    templateDeleteTarget.value = null;
  });
}
function resetTemplateForm(): void {
  templateForm.workDays = 1;
  templateForm.offDays = 1;
}
function openTemplates(): void {
  templateDeleteVisible.value = false;
  templateDeleteTarget.value = null;
  cancelTemplateEdit();
  error.value = "";
  templateVisible.value = true;
}
function prepareExtension(): void {
  if (!selectedMembershipIds.value.length) return;
  preparedExtension.value = {
    period: generationPeriod.value,
    membershipIds: [...selectedMembershipIds.value],
  };
}
function extendSelectedSchedule(): void {
  if (!isExtensionPrepared.value || !preparedExtension.value) return;
  const { period, membershipIds } = preparedExtension.value;
  const [targetYear, targetMonth] = period.split("-").map(Number);
  if (!membershipIds.length) return;
  void run(async () => {
    if (previewMode.value) {
      const key = monthKey(targetYear, targetMonth);
      let target = previewMonths.get(key);
      if (!target) {
        target = createPreviewMonth(targetYear, targetMonth);
        for (const row of target.rows) {
          for (const cell of row.cells) cell.value = null;
          refreshPreviewTotals(row);
        }
        previewMonths.set(key, target);
      }
      const assignments = membershipIds.flatMap((membershipId) => {
        const assignment = previewAssignments.get(membershipId);
        return assignment
          ? [
              {
                membershipId,
                templateId: assignment.templateId,
                versionId: assignment.version.id,
                anchor: assignment.anchor,
                applyFrom: assignment.applyFrom,
                version: assignment.version,
              },
            ]
          : [];
      });
      if (assignments.length !== membershipIds.length) {
        throw new Error(
          "Невозможно продлить график: у одного или нескольких выбранных сотрудников нет назначенного цикла.",
        );
      }
      previewApplySchedule(target, assignments, false);
    } else {
      await schedule.extend(targetYear, targetMonth, membershipIds);
    }
    year.value = targetYear;
    month.value = targetMonth;
    await navigateTo({
      query: { ...route.query, year: targetYear, month: targetMonth },
    });
    closeGenerate();
  });
}
function openExport(): void {
  exportPeriod.value = monthKey(year.value, month.value);
  exportError.value = "";
  exportVisible.value = true;
}
async function download(): Promise<void> {
  const [exportYear, exportMonth] = exportPeriod.value.split("-").map(Number);
  if (!exportYear || !exportMonth) return;
  exportBusy.value = true;
  exportError.value = "";
  try {
    if (previewMode.value) {
      await waitForPreviewResponse();
      const period = monthKey(exportYear, exportMonth);
      const selectedMonth =
        previewMonths.get(period) ?? createPreviewMonth(exportYear, exportMonth);
      previewMonths.set(period, selectedMonth);
      if (exportFormat.value === "pdf") {
        const previous = { year: year.value, month: month.value, previewMonth: previewMonth.value };
        try {
          year.value = exportYear;
          month.value = exportMonth;
          previewMonth.value = selectedMonth;
          await nextTick();
          window.print();
        } finally {
          year.value = previous.year;
          month.value = previous.month;
          previewMonth.value = previous.previewMonth;
        }
      } else {
        const header = [
          "ФИО",
          "Должность",
          ...Array.from({ length: selectedMonth.daysInMonth }, (_, index) => String(index + 1)),
          "Часы",
          "Смены",
        ];
        const lines = [
          header,
          ...selectedMonth.rows.map((row) => [
            row.fullName,
            row.roleLabel,
            ...row.cells.map((cell) => cellLabel(cell.value)),
            String(row.totalHours),
            String(row.totalShifts),
          ]),
        ];
        const csv =
          "\uFEFF" +
          lines
            .map((line) => line.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(";"))
            .join("\r\n");
        const file = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
        const link = document.createElement("a");
        link.href = file;
        link.download = `schedule-demo-${period}.csv`;
        link.click();
        URL.revokeObjectURL(file);
      }
    } else {
      await schedule.exportSchedule(exportFormat.value, exportYear, exportMonth);
    }
    exportVisible.value = false;
  } catch (cause) {
    exportError.value = cause instanceof Error ? cause.message : "Не удалось выгрузить график";
  } finally {
    exportBusy.value = false;
  }
}
function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short" }).format(
    new Date(value),
  );
}
</script>

<style scoped>
.schedule-table-viewport {
  overflow: clip;
  border-radius: var(--p-border-radius-md);
}

.schedule-table :deep(.p-datatable-frozen-column) {
  z-index: 20 !important;
  background: var(--p-content-background);
  background-clip: padding-box;
}

.schedule-table :deep(th.p-datatable-frozen-column:nth-child(1)),
.schedule-table :deep(td.p-datatable-frozen-column:nth-child(1)) {
  z-index: 22 !important;
}

.schedule-table :deep(th.p-datatable-frozen-column:nth-child(2)),
.schedule-table :deep(td.p-datatable-frozen-column:nth-child(2)) {
  z-index: 21 !important;
}

.schedule-table :deep(.p-datatable-column-title) {
  font-weight: 400;
}

.schedule-table :deep(th.p-datatable-frozen-column::after),
.schedule-table :deep(td.p-datatable-frozen-column::after) {
  position: absolute;
  top: 0;
  right: -1px;
  z-index: 1;
  box-sizing: border-box;
  width: 2px;
  height: 100%;
  background-color: var(--p-content-background);
  border-inline-end: 1px solid var(--p-datatable-border-color);
  content: "";
  pointer-events: none;
}

.schedule-table :deep(.p-datatable-tbody > tr:hover > .p-datatable-frozen-column::after) {
  background-color: var(--p-datatable-row-hover-background);
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

.generation-table :deep(.p-datatable-thead > tr:first-child > th:first-child) {
  border-top-left-radius: var(--p-border-radius-md);
}

.generation-table :deep(.p-datatable-thead > tr:first-child > th:last-child) {
  border-top-right-radius: var(--p-border-radius-md);
}

.generation-table :deep(.p-datatable-tbody > tr:last-child > td:first-child) {
  border-bottom-left-radius: var(--p-border-radius-md);
}

.generation-table :deep(.p-datatable-tbody > tr:last-child > td:last-child) {
  border-bottom-right-radius: var(--p-border-radius-md);
}

.generation-table :deep(.p-datatable-tbody > tr:last-child > td) {
  border-bottom: 0;
}

.generation-table :deep(.p-datatable-tbody > tr) {
  cursor: pointer;
}
</style>
