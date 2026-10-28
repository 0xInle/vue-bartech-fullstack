<template>
  <section class="flex min-h-0 min-w-0 flex-1 flex-col gap-5">
    <header class="flex shrink-0 flex-wrap items-center gap-3">
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
      <div class="relative ml-auto flex flex-wrap items-center justify-end gap-2">
        <template v-if="canManage && selectedCells.length">
          <Divider layout="vertical" class="!mx-0 !my-0 self-stretch" />
          <span class="text-xs text-color-secondary"
            >Выбрано ячеек: {{ selectedCells.length }}</span
          >
          <Button label="Изменить" size="small" :disabled="busy" @click="openBulkEditor" />
          <Button
            label="Удалить"
            severity="danger"
            size="small"
            :loading="busy"
            @click="bulkDeleteVisible = true"
          />
          <Button
            label="Сбросить"
            severity="secondary"
            variant="text"
            size="small"
            :disabled="busy"
            @click="resetCellSelection"
          />
        </template>
        <template v-else>
          <Button v-if="canManage" label="Настройка смен" size="small" @click="openShiftSettings" />
          <Button v-if="canManage" label="Шаблоны" size="small" @click="openTemplates" />
          <Button v-if="canManage" label="Заполнить график" size="small" @click="openGenerate" />
          <Button v-if="canManage" label="Выгрузить" size="small" @click="openExport" />
        </template>
      </div>
    </header>

    <Message
      v-if="error"
      severity="error"
      :closable="false"
      :pt="compactMessagePt"
      class="shrink-0"
      >{{ error }}</Message
    >
    <Message
      v-if="!previewMode && schedule.monthQuery.isError.value"
      severity="error"
      :closable="false"
      :pt="compactMessagePt"
      class="shrink-0"
      >Не удалось загрузить график. Обновите страницу и попробуйте ещё раз.</Message
    >
    <div
      class="schedule-table-viewport relative min-h-0 min-w-0 flex-1"
      :aria-busy="(!previewMode && schedule.monthQuery.isFetching.value) || previewMonthLoading"
    >
      <DataTable
        :value="rows"
        :row-class="scheduleRowClass"
        size="small"
        scrollable
        scroll-height="flex"
        show-gridlines
        row-hover
        class="schedule-table h-full text-sm"
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
              class="block w-full whitespace-nowrap text-sm font-normal"
              :class="{ 'cursor-pointer': canEdit }"
              @click.stop="toggleEmployeeSelection($event, data)"
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
          :header-style="dayHeaderStyle(day)"
          :body-style="dayBodyStyle(day)"
          style="min-width: 34px; width: 34px; max-width: 34px"
        >
          <template #header>
            <button
              v-if="canManage"
              type="button"
              class="flex w-full cursor-pointer flex-col items-center justify-center rounded-sm leading-tight hover:bg-emphasis focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
              :disabled="busy"
              :aria-pressed="isInventoryMarked(day)"
              :aria-label="inventoryDayLabel(day)"
              @click="toggleInventoryMarker(day)"
            >
              <span>{{ day }}</span>
              <span class="text-sm text-color-secondary">{{ weekday(day) }}</span>
            </button>
            <div v-else class="flex flex-col items-center justify-center leading-tight">
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
                v-tooltip.top="
                  cellTooltip(data.cells[day - 1].value)
                    ? {
                        value: cellTooltip(data.cells[day - 1].value),
                        showDelay: 1000,
                        class: 'app-tooltip',
                      }
                    : undefined
                "
                class="flex h-[33px] min-h-[33px] w-full shrink-0 cursor-pointer items-center justify-center p-0 text-center text-xs font-normal leading-none hover:bg-emphasis"
                :style="cellStyle(data.cells[day - 1].value, isCellSelected(data, day - 1))"
              >
                {{ cellLabel(data.cells[day - 1].value) }}
              </span>
              <OverlayBadge
                v-if="data.cells[day - 1]?.applicable && data.cells[day - 1]?.comment?.text?.trim()"
                v-tooltip.top="{
                  value: commentPreview(data.cells[day - 1].comment?.text),
                  showDelay: 0,
                  class: 'app-tooltip',
                }"
                severity="success"
                size="small"
                class="!absolute !right-0 !top-0 z-10"
                :aria-label="commentPreview(data.cells[day - 1].comment?.text)"
                :pt="{
                  pcBadge: { root: { class: '!h-1.5 !min-w-1.5 !w-1.5 !p-0' } },
                }"
              />
              <span
                v-else-if="!data.cells[day - 1]?.applicable"
                class="flex h-[33px] min-h-[33px] w-full shrink-0 items-center justify-center p-0 text-center text-xs leading-none text-color-secondary"
                aria-hidden="true"
              />
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
          <span
            v-if="previewMode || schedule.monthQuery.isSuccess.value"
            class="text-color-secondary"
            >В этом месяце нет сотрудников</span
          >
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
      class="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-md border border-[var(--p-content-border-color)] p-2 text-xs text-color-secondary"
      aria-label="Обозначения графика"
    >
      <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span v-for="shift in allShiftTypes" :key="shift.value" class="flex items-center gap-1.5">
          <i
            class="inline-block h-4 w-4 shrink-0 rounded border"
            :style="shiftColorStyle(shift.value)"
          />
          {{ shiftLetter(shift.value) }} | {{ shiftLegendName(shift.value) }}
        </span>
        <span class="flex items-center gap-1.5">
          <i class="inline-block h-4 w-4 shrink-0 rounded border" :style="statusColorStyle" />
          О | Отпуск
        </span>
        <span class="flex items-center gap-1.5">
          <i class="inline-block h-4 w-4 shrink-0 rounded border" :style="statusColorStyle" />
          Б | Больничный
        </span>
        <span class="flex items-center gap-1.5">
          <i class="inline-block h-4 w-4 shrink-0 rounded border" :style="statusColorStyle" />
          Н | Неявка
        </span>
      </div>
      <Divider layout="vertical" class="!mx-0 !my-0 self-stretch" />
      <div class="flex items-center gap-4">
        <span>Ctrl + клик — выбрать ячейки для массового редактирования</span>
      </div>
    </div>

    <Drawer
      v-model:visible="shiftSettingsVisible"
      position="right"
      class="drawer-size-xs h-screen max-h-screen h-dvh max-h-dvh"
      :pt="{
        header: { class: '!items-center' },
        title: { style: { fontSize: '1rem', fontWeight: '600' } },
        pcCloseButton: { root: { class: '!rounded-md' } },
        content: { class: '!flex !min-h-0 !flex-col' },
      }"
    >
      <template #header="{ class: titleClass }">
        <span :class="[titleClass, 'leading-none']">Настройка смен</span>
      </template>
      <div class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pt-2">
        <Message
          v-if="error"
          severity="error"
          size="small"
          :closable="false"
          :pt="compactMessagePt"
        >
          {{ error }}
        </Message>
        <form class="space-y-4" @submit.prevent="saveShiftSetting">
          <FloatLabel variant="on">
            <Select
              v-model="draftShiftCode"
              input-id="schedule-shift-type"
              :options="allShiftTypes"
              option-label="label"
              option-value="value"
              size="small"
              class="w-full"
              :disabled="busy"
              @update:model-value="selectShiftDraft"
            />
            <label for="schedule-shift-type" class="text-xs">Смена</label>
          </FloatLabel>
          <FloatLabel variant="on">
            <InputNumber
              v-model="draftDurationHours"
              input-id="schedule-shift-duration"
              :min="1"
              :max="24"
              :step="1"
              show-buttons
              button-layout="stacked"
              size="small"
              class="w-full"
              :disabled="busy"
            />
            <label for="schedule-shift-duration" class="text-xs">Длительность смены</label>
          </FloatLabel>
          <div class="grid grid-cols-2 gap-3">
            <FloatLabel variant="on">
              <DatePicker
                v-model="draftStartTime"
                input-id="schedule-shift-start"
                time-only
                hour-format="24"
                :step-minute="5"
                :manual-input="true"
                size="small"
                class="w-full"
                :timepicker-button-props="timePickerButtonProps"
                :pt="timePickerInputPt"
                :disabled="busy"
                @show="initializeDraftTime"
              />
              <label for="schedule-shift-start" class="text-xs">Начало смены</label>
            </FloatLabel>
            <FloatLabel variant="on">
              <InputText
                id="schedule-shift-end"
                :model-value="draftEndTime"
                size="small"
                class="w-full"
                readonly
                tabindex="-1"
              />
              <label for="schedule-shift-end" class="text-xs">Конец смены</label>
            </FloatLabel>
          </div>
          <Button
            type="submit"
            :label="draftEditingId ? 'Сохранить смену' : 'Добавить смену'"
            size="small"
            class="w-full"
            :disabled="!draftShiftCode || !draftStartTime || !draftDurationHours || busy"
            :loading="busy"
          />
        </form>

        <Divider class="!my-0" />
        <section class="space-y-3">
          <h2 class="text-sm font-semibold">Настроенные смены</h2>
          <div v-if="shiftSettings.length" class="divide-y divide-[var(--p-content-border-color)]">
            <div
              v-for="setting in shiftSettings"
              :key="setting.id ?? setting.shiftCode"
              class="flex min-h-8 min-w-0 items-end gap-2 px-1 py-1"
            >
              <div class="min-w-0 flex-1">
                <span class="block text-sm font-medium">{{ shiftLabel(setting.shiftCode) }}</span>
                <span class="flex flex-wrap gap-1 pt-1 text-xs text-color-secondary">
                  <Tag
                    :value="formatShiftTime(setting.startTime, setting.defaultDurationHours)"
                    severity="secondary"
                    :pt="compactTagPt"
                  />
                  <Tag
                    :value="`${setting.defaultDurationHours} ч`"
                    severity="secondary"
                    :pt="compactTagPt"
                  />
                </span>
              </div>
              <div class="ml-auto flex shrink-0 items-center gap-1">
                <Button
                  icon="pi pi-pencil"
                  severity="secondary"
                  variant="text"
                  size="small"
                  class="!h-5 !min-h-5 !w-5 !p-0"
                  :aria-label="`Редактировать смену: ${shiftLabel(setting.shiftCode)}`"
                  :disabled="busy"
                  @click="editShiftSetting(setting.id)"
                />
                <Button
                  icon="pi pi-trash"
                  severity="danger"
                  variant="text"
                  size="small"
                  class="!h-5 !min-h-5 !w-5 !p-0"
                  :aria-label="`Удалить смену: ${shiftLabel(setting.shiftCode)}`"
                  :disabled="busy"
                  @click="removeShiftSetting(setting.id)"
                />
              </div>
            </div>
          </div>
          <div
            v-else
            class="rounded-lg border border-dashed border-[var(--p-divider-border-color)] p-4 text-center"
          >
            <p class="text-xs text-color-secondary">Нет настроенных смен</p>
          </div>
        </section>
      </div>
    </Drawer>

    <Dialog
      v-model:visible="cellVisible"
      modal
      dismissable-mask
      :header="bulkEditMode ? 'Массовое изменение' : activeRow?.fullName"
      class="dialog-size-sm"
      :pt="{
        root: { 'aria-labelledby': 'schedule-cell-dialog-title' },
        pcCloseButton: { root: { class: '!rounded-md' } },
      }"
    >
      <template #header="{ class: titleClass }">
        <div
          id="schedule-cell-dialog-title"
          :class="[titleClass, 'flex min-w-0 flex-1 items-center gap-2']"
        >
          <span v-if="bulkEditMode" class="min-w-0 truncate text-base font-semibold">
            Изменить выбранные ячейки
          </span>
          <span v-else class="min-w-0 truncate text-base font-semibold">{{
            activeRow?.fullName
          }}</span>
          <Tag
            v-if="activeCell && !bulkEditMode"
            :value="formatCellDayMonth(activeCell.date)"
            severity="secondary"
            :pt="compactTagPt"
            class="shrink-0"
          />
        </div>
      </template>
      <div v-if="activeCell || bulkEditMode" class="space-y-4">
        <Message
          v-if="error"
          severity="error"
          size="small"
          :closable="false"
          :pt="compactMessagePt"
          class="shrink-0"
        >
          {{ error }}
        </Message>
        <section v-if="canEdit" class="space-y-3 pt-2">
          <FloatLabel variant="on">
            <Select
              v-model="editOptionValue"
              input-id="schedule-cell-choice"
              :options="cellValueOptions"
              option-label="label"
              option-value="value"
              size="small"
              class="w-full"
              :disabled="busy"
              @update:model-value="selectEditChoice"
            />
            <label for="schedule-cell-choice" class="text-xs">Смена или статус</label>
          </FloatLabel>
          <div v-if="isEditingShift" class="space-y-3">
            <FloatLabel variant="on">
              <InputNumber
                v-model="editHours"
                input-id="schedule-cell-duration"
                :min="1"
                :max="24"
                :step="1"
                show-buttons
                button-layout="stacked"
                size="small"
                class="w-full"
                :disabled="busy"
              />
              <label for="schedule-cell-duration" class="text-xs">Длительность смены</label>
            </FloatLabel>
            <div class="grid grid-cols-2 gap-3">
              <FloatLabel variant="on">
                <DatePicker
                  v-model="editStartTime"
                  input-id="schedule-cell-start"
                  time-only
                  hour-format="24"
                  :step-minute="5"
                  :manual-input="true"
                  size="small"
                  class="w-full"
                  :timepicker-button-props="timePickerButtonProps"
                  :pt="timePickerInputPt"
                  :disabled="busy"
                  @show="initializeEditTime"
                />
                <label for="schedule-cell-start" class="text-xs">Начало смены</label>
              </FloatLabel>
              <FloatLabel variant="on">
                <InputText
                  id="schedule-cell-end"
                  :model-value="editEndTime"
                  size="small"
                  class="w-full"
                  readonly
                  tabindex="-1"
                />
                <label for="schedule-cell-end" class="text-xs">Конец смены</label>
              </FloatLabel>
            </div>
          </div>
        </section>
        <section v-if="activeCell && !bulkEditMode" class="space-y-2">
          <div class="space-y-0.5">
            <FloatLabel variant="on">
              <Textarea
                id="schedule-cell-comment"
                v-model="commentText"
                maxlength="250"
                size="small"
                fluid
                class="h-20 resize-none"
                :disabled="busy"
              />
              <label for="schedule-cell-comment" class="text-xs">Комментарий к смене</label>
            </FloatLabel>
            <p class="text-right text-xs text-color-secondary">
              Доступно символов: {{ remainingCommentCharacters }}
            </p>
          </div>
          <Divider v-if="activeCell?.comment && !bulkEditMode" class="!my-2" />
          <ul
            v-if="activeCell?.comment && !bulkEditMode"
            class="max-h-[calc(var(--spacing)*17)] space-y-2 overflow-y-auto text-xs text-color-secondary"
          >
            <li class="whitespace-pre-wrap">
              {{ activeCell.comment.updatedBy }} · {{ formatDate(activeCell.comment.updatedAt) }}:
              {{ activeCell.comment.text }}
            </li>
            <li
              v-for="(entry, index) in visibleCommentHistory"
              :key="`${entry.createdAt}-${index}`"
              class="whitespace-pre-wrap"
            >
              {{ entry.author }} · {{ formatDate(entry.createdAt) }}: {{ entry.text }}
            </li>
          </ul>
        </section>
        <div class="flex gap-2">
          <Button
            label="Сохранить"
            size="small"
            class="min-w-0 flex-1"
            :loading="busy"
            :disabled="!canSaveCellChanges"
            @click="bulkEditMode ? saveBulkEdit() : saveCellChanges()"
          />
          <Button
            v-if="canEdit && !bulkEditMode && hasCellValueToDelete"
            :label="activeCell?.value?.kind === 'STATUS' ? 'Удалить статус' : 'Удалить смену'"
            severity="danger"
            size="small"
            class="min-w-0 flex-1"
            :disabled="busy"
            @click="deleteCellValue"
          />
        </div>
      </div>
    </Dialog>

    <Dialog
      v-model:visible="bulkDeleteVisible"
      modal
      header="Очистить выбранные ячейки?"
      class="dialog-size-sm"
      :pt="{ pcCloseButton: { root: { class: '!rounded-md' } } }"
    >
      <p class="text-sm text-color-secondary">
        Смены и статусы в {{ selectedCells.length }} ячейках будут удалены. Комментарии и история
        сохранятся.
      </p>
      <template #footer>
        <Button
          label="Отмена"
          severity="secondary"
          variant="text"
          size="small"
          :disabled="busy"
          @click="bulkDeleteVisible = false"
        />
        <Button
          label="Удалить"
          severity="danger"
          size="small"
          :loading="busy"
          @click="confirmClearSelectedCells"
        />
      </template>
    </Dialog>

    <Drawer
      v-model:visible="generateVisible"
      position="right"
      class="drawer-size-lg h-screen max-h-screen h-dvh max-h-dvh"
      :pt="{
        header: { class: '!items-center' },
        title: { style: { fontSize: '1rem', fontWeight: '600' } },
        pcCloseButton: { root: { class: '!rounded-md' } },
        content: { class: '!flex !min-h-0 !flex-col !overflow-hidden' },
      }"
    >
      <template #header="{ class: titleClass }">
        <div class="flex min-w-0 flex-1 items-center gap-4 pr-4">
          <span :class="[titleClass, 'leading-none']">Заполнение графика</span>
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
      <div class="flex min-h-0 flex-1 flex-col gap-4">
        <div v-if="error" class="shrink-0 pt-2">
          <Message severity="error" size="small" :closable="false" :pt="compactMessagePt">
            {{ error }}
          </Message>
        </div>
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
            <label for="generation-period" class="text-xs">Целевой месяц</label>
          </FloatLabel>
          <FloatLabel v-if="generationMode === 'assign'" variant="on">
            <Select
              v-model="generationTemplateId"
              input-id="generation-template"
              :options="generationTemplateOptions"
              option-label="label"
              option-value="id"
              empty-message="Нет доступных шаблонов"
              :pt="{ emptyMessage: { class: 'text-sm' } }"
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
                      ? data.assignedTemplateName
                      : data.previousTemplateName
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
                    :value="generationAssignments[data.membershipId].templateName"
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
      class="drawer-size-xs h-screen max-h-screen h-dvh max-h-dvh"
      :pt="{
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
            <FloatLabel variant="on"
              ><InputText
                v-model="templateForm.name"
                input-id="template-name"
                maxlength="80"
                size="small"
                class="w-full"
              /><label for="template-name" class="text-xs">Название шаблона</label></FloatLabel
            >
            <Message
              v-if="templateDayOptions.length <= 1"
              severity="info"
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
              Сначала добавьте хотя бы одну смену через «Настройка смен».
            </Message>
            <div
              v-for="(day, index) in templateForm.days"
              :key="index"
              class="flex min-w-0 items-center gap-1"
            >
              <span
                class="flex h-8 w-6 shrink-0 items-center justify-center text-xs leading-none text-color-secondary"
                >{{ index + 1 }}</span
              >
              <FloatLabel variant="on" class="min-w-0 flex-1">
                <Select
                  v-model="templateForm.days[index]"
                  :input-id="`template-day-${index + 1}`"
                  :options="templateDayOptions"
                  option-label="label"
                  option-value="value"
                  size="small"
                  class="w-full"
                />
                <label :for="`template-day-${index + 1}`" class="text-xs">День цикла</label>
              </FloatLabel>
              <Button
                v-if="templateForm.days.length > 1"
                icon="pi pi-times"
                severity="secondary"
                variant="text"
                rounded
                size="small"
                :aria-label="`Удалить день ${index + 1}`"
                @click="removeTemplateDay(index)"
              />
            </div>
            <Button
              v-if="templateForm.days.length < 31"
              label="Добавить день цикла"
              severity="secondary"
              variant="outlined"
              size="small"
              :disabled="templateDayOptions.length <= 1"
              @click="appendTemplateDay"
            />
            <div class="flex w-full gap-2">
              <Button
                type="submit"
                :label="selectedTemplateId ? 'Сохранить шаблон' : 'Создать шаблон'"
                size="small"
                :loading="busy"
                :disabled="!templateFormValid || templateLoading || templateLoadFailed"
                class="flex-1"
              />
              <Button
                label="Отмена"
                severity="secondary"
                variant="outlined"
                size="small"
                :disabled="busy"
                @click="cancelTemplateEdit"
              />
            </div>
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
                  :value="template.name"
                  severity="secondary"
                  :pt="compactTagPt"
                  class="shrink-0"
                />
                <div class="flex min-w-0 flex-wrap items-center gap-1">
                  <span
                    v-for="day in template.currentVersion.days"
                    :key="day.position"
                    v-tooltip.top="{
                      value: templateDayTooltip(day.shiftSettingId),
                      class: 'app-tooltip',
                    }"
                    class="inline-flex h-4 w-4 items-center justify-center rounded border text-[8px] font-semibold leading-none"
                    :class="day.shiftSettingId ? '' : 'bg-[var(--p-content-background)]'"
                    :style="templateDayStyle(day.shiftSettingId)"
                  >
                    {{ templateDayLetter(day.shiftSettingId) }}
                  </span>
                </div>
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
              class="flex flex-col items-center gap-2 rounded-lg border border-dashed border-[var(--p-divider-border-color)] p-4 text-center"
            >
              <p class="text-xs text-color-secondary">Пока нет своих шаблонов</p>
              <p class="text-xs text-color-secondary">Можете их создать</p>
              <div
                class="flex flex-wrap items-center justify-center gap-2"
                aria-label="Пример цикла 4 на 2"
              >
                <Tag value="4|2" severity="secondary" :pt="compactTagPt" />
                <div class="flex items-center gap-1" aria-hidden="true">
                  <span
                    v-for="shift in allShiftTypes"
                    :key="shift.value"
                    v-tooltip.top="{ value: shift.label, class: 'app-tooltip' }"
                    class="inline-flex h-4 w-4 items-center justify-center rounded border text-[8px] font-semibold leading-none"
                    :style="shiftColorStyle(shift.value)"
                  >
                    {{ shiftLetter(shift.value) }}
                  </span>
                  <span
                    v-for="dayOff in 2"
                    :key="`example-day-off-${dayOff}`"
                    v-tooltip.top="{ value: 'Выходной', class: 'app-tooltip' }"
                    class="inline-flex h-4 w-4 items-center justify-center rounded border bg-[var(--p-content-background)]"
                    style="border-color: var(--p-content-border-color)"
                  />
                </div>
              </div>
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
  type ScheduleShiftSetting,
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
  { label: "Заполнить", value: "assign" },
  { label: "Продлить", value: "extend" },
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
const bulkDeleteVisible = ref(false);
const templateVisible = ref(false);
const duplicateWarningVisible = ref(false);
const templateDeleteVisible = ref(false);
const templateDeleteTarget = ref<(ScheduleTemplate & { assignmentCount: number }) | null>(null);
const activeRow = ref<ScheduleRow | null>(null);
const activeCellIndex = ref(-1);
const bulkEditMode = ref(false);
const bulkEditTargets = ref<string[]>([]);
type CellEditorChoice = ShiftCode | "VACATION" | "SICK_LEAVE" | "NO_SHOW" | "EMPTY";
type CellValueOption = { label: string; value: string; choice: CellEditorChoice };
const editChoice = ref<CellEditorChoice | null>(null);
const editOptionValue = ref<string | null>(null);
const editShiftSettingId = ref<string | null>(null);
const editHours = ref<number | null>(null);
const editStartTime = ref<Date | null>(null);
const commentText = ref("");
const savedValueSignature = ref<string | null>(null);
const remainingCommentCharacters = computed(() => Math.max(0, 250 - commentText.value.length));
const selectedCells = ref<string[]>([]);
const exportFormat = ref<"xlsx" | "pdf">("xlsx");
const exportVisible = ref(false);
const exportPeriod = ref("");
const exportBusy = ref(false);
const exportError = ref("");
const shiftSettingsVisible = ref(false);
const selectedTemplateId = ref<string | null>(null);
type ShiftCode = ScheduleShiftSetting["shiftCode"];
const shiftBackgrounds: Record<ShiftCode, string> = {
  MORNING:
    "color-mix(in srgb, var(--schedule-palette-yellow-300) 70%, var(--p-content-background))",
  DAY: "color-mix(in srgb, var(--schedule-palette-green-300) 70%, var(--p-content-background))",
  EVENING:
    "color-mix(in srgb, var(--schedule-palette-orange-300) 70%, var(--p-content-background))",
  NIGHT: "color-mix(in srgb, var(--schedule-palette-blue-300) 70%, var(--p-content-background))",
};
const statusBackground =
  "color-mix(in srgb, var(--schedule-palette-red-300) 70%, var(--p-content-background))";
const statusColorStyle = {
  backgroundColor: statusBackground,
  borderColor: "var(--p-content-border-color)",
};
type ShiftSettingView = Omit<ScheduleShiftSetting, "id"> & { id?: string; startTime: Date };
const draftShiftCode = ref<ShiftCode | null>(null);
const draftEditingId = ref<string | null>(null);
const draftStartTime = ref<Date | null>(null);
const draftDurationHours = ref<number | null>(null);
const draftEndTime = computed(() =>
  draftStartTime.value && draftDurationHours.value
    ? formatTimeOfDay(
        (timeToMinute(draftStartTime.value) + draftDurationHours.value * 60) % (24 * 60),
      )
    : "",
);
const templateDayOffValue = "__DAY_OFF__";
const templateForm = reactive({ name: "", days: [] as Array<string | null | undefined> });
const allShiftTypes = [
  { label: "Утро", value: "MORNING" },
  { label: "День", value: "DAY" },
  { label: "Вечер", value: "EVENING" },
  { label: "Ночь", value: "NIGHT" },
] as const;
const timePickerButtonProps = {
  severity: "secondary" as const,
  text: true,
  rounded: true,
  size: "small" as const,
};
const timePickerInputPt = { pcInputText: { root: { inputmode: "text" } } };
const shiftSettings = ref<ShiftSettingView[]>([]);
if (previewMode.value) {
  shiftSettings.value = [
    {
      id: "demo-morning-09",
      shiftCode: "MORNING",
      startMinute: 540,
      defaultDurationHours: 8,
      startTime: minuteToTime(540),
    },
    {
      id: "demo-morning-10",
      shiftCode: "MORNING",
      startMinute: 600,
      defaultDurationHours: 6,
      startTime: minuteToTime(600),
    },
    {
      id: "demo-day-12",
      shiftCode: "DAY",
      startMinute: 720,
      defaultDurationHours: 8,
      startTime: minuteToTime(720),
    },
    {
      id: "demo-evening-18",
      shiftCode: "EVENING",
      startMinute: 1080,
      defaultDurationHours: 8,
      startTime: minuteToTime(1080),
    },
    {
      id: "demo-night-22",
      shiftCode: "NIGHT",
      startMinute: 1320,
      defaultDurationHours: 8,
      startTime: minuteToTime(1320),
    },
  ];
}
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
for (const [index, template] of previewTemplates.value.entries()) {
  const anchor = isoDate(new Date(now.getFullYear(), 0, 1 - index));
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
const customTemplates = computed(() => templates.value.filter((template) => !template.isSystem));
const generationTemplateOptions = computed(() =>
  templates.value.map((template) => ({ ...template, label: template.name })),
);
const templateDayOptions = computed(() => [
  { label: "Выходной", value: templateDayOffValue },
  ...shiftSettings.value.flatMap((setting) =>
    setting.id
      ? [
          {
            label: `${shiftLabel(setting.shiftCode)} · ${formatShiftTime(setting.startTime, setting.defaultDurationHours)} · ${setting.defaultDurationHours} ч`,
            value: setting.id,
          },
        ]
      : [],
  ),
]);
const templateName = computed(() => templateForm.name.trim());
const duplicateTemplate = computed(
  () =>
    templates.value.find(
      (template) =>
        template.id !== selectedTemplateId.value &&
        template.name.toLocaleLowerCase() === templateName.value.toLocaleLowerCase(),
    ) ?? null,
);
const templateFormValid = computed(
  () =>
    Boolean(templateName.value) &&
    templateForm.days.length >= 1 &&
    templateForm.days.length <= 31 &&
    templateForm.days.every(
      (settingId) => settingId === templateDayOffValue || settingId !== undefined,
    ) &&
    templateForm.days.every(
      (settingId) =>
        settingId === templateDayOffValue ||
        (settingId !== null && shiftSettings.value.some((setting) => setting.id === settingId)),
    ) &&
    templateForm.days.some(
      (settingId) =>
        settingId !== templateDayOffValue &&
        settingId !== null &&
        settingId !== undefined &&
        shiftSettings.value.some((setting) => setting.id === settingId),
    ),
);
watch([() => templateForm.name, () => templateForm.days], () => {
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
watch(
  () => schedule.shiftSettingsQuery.data.value,
  (settings) => {
    if (previewMode.value) return;
    if (!settings) return;
    shiftSettings.value = settings.map((setting) => ({
      ...setting,
      startTime: minuteToTime(setting.startMinute),
    }));
    if (
      cellVisible.value &&
      editShiftSettingId.value &&
      editOptionValue.value?.startsWith("SHIFT_TYPE:")
    ) {
      const setting = shiftSettings.value.find((item) => item.id === editShiftSettingId.value);
      if (setting) editOptionValue.value = shiftSettingOptionValue(setting);
    }
  },
  { immediate: true },
);
const days = computed(() =>
  Array.from(
    { length: monthResponse.value?.daysInMonth ?? new Date(year.value, month.value, 0).getDate() },
    (_, index) => index + 1,
  ),
);
const activeCell = computed(() => activeRow.value?.cells[activeCellIndex.value] ?? null);
const hasCellValueToDelete = computed(
  () => activeCell.value?.value?.kind === "SHIFT" || activeCell.value?.value?.kind === "STATUS",
);
const visibleCommentHistory = computed(() => {
  const comment = activeCell.value?.comment;
  if (!comment) return [];
  return comment.history.filter((entry, index, history) => {
    const matchesCurrent = entry.text === comment.text && entry.author === comment.updatedBy;
    const currentTimestamp = Date.parse(comment.updatedAt);
    const entryTimestamp = Date.parse(entry.createdAt);
    if (matchesCurrent && Math.abs(entryTimestamp - currentTimestamp) <= 1000) return false;

    const previous = history[index - 1];
    if (!previous || previous.text !== entry.text || previous.author !== entry.author) return true;
    return Math.abs(Date.parse(previous.createdAt) - entryTimestamp) > 1000;
  });
});
const bulkEditCells = computed(() =>
  bulkEditTargets.value.flatMap((key) => {
    const [membershipId, date] = key.split(":");
    const row = rows.value.find((item) => item.membershipId === membershipId);
    const cell = row?.cells.find((item) => item.date === date);
    return row && cell ? [{ row, cell }] : [];
  }),
);
const bulkCellsHaveSameShift = computed(
  () =>
    bulkEditCells.value.length > 0 &&
    bulkEditCells.value.every(({ cell }) => cell.value?.kind === "SHIFT"),
);
const isEditingShift = computed(() =>
  allShiftTypes.some((shift) => shift.value === editChoice.value),
);
const editValueSignature = computed(() => {
  if (!canSaveScheduleValue.value || !editChoice.value) return null;
  return JSON.stringify([
    editChoice.value,
    isEditingShift.value ? editHours.value : null,
    isEditingShift.value && editStartTime.value ? timeToMinute(editStartTime.value) : null,
    isEditingShift.value ? editShiftSettingId.value : null,
  ]);
});
const hasUnsavedScheduleValue = computed(
  () => editValueSignature.value !== null && editValueSignature.value !== savedValueSignature.value,
);
const hasCommentDraft = computed(() => !!commentText.value.trim());
const canSaveScheduleValue = computed(
  () =>
    canEdit.value &&
    !!editChoice.value &&
    (!isEditingShift.value || (editHours.value !== null && !!editStartTime.value)),
);
const canSaveCellChanges = computed(() => hasUnsavedScheduleValue.value || hasCommentDraft.value);
const cellValueOptions = computed<CellValueOption[]>(() => [
  ...shiftSettings.value.map((setting) => ({
    label: `${shiftLabel(setting.shiftCode)} · ${formatShiftTime(setting.startTime, setting.defaultDurationHours)} · ${setting.defaultDurationHours} ч`,
    value: shiftSettingOptionValue(setting),
    choice: setting.shiftCode,
  })),
  ...allShiftTypes.map((shift) => ({
    label: shift.label,
    value: shiftTypeOptionValue(shift.value),
    choice: shift.value,
  })),
  { label: "Отпуск", value: "VACATION", choice: "VACATION" },
  { label: "Больничный", value: "SICK_LEAVE", choice: "SICK_LEAVE" },
  { label: "Неявка", value: "NO_SHOW", choice: "NO_SHOW" },
  ...(activeCell.value?.value?.kind === "SHIFT" ||
  (bulkEditMode.value && bulkCellsHaveSameShift.value)
    ? [{ label: "Выходной", value: "EMPTY", choice: "EMPTY" as const }]
    : []),
]);
const editEndTime = computed(() =>
  editStartTime.value && editHours.value
    ? formatTimeOfDay((timeToMinute(editStartTime.value) + editHours.value * 60) % (24 * 60))
    : "",
);
const monthLabel = computed(() =>
  new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" }).format(
    new Date(year.value, month.value - 1, 1),
  ),
);
const monthStart = new Date(now.getFullYear(), now.getMonth() - 12, 1);
const monthEnd = new Date(now.getFullYear(), now.getMonth() + 2, 1);
const exportOptions = [
  { label: previewMode.value ? "CSV" : "XLSX", value: "xlsx" },
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

function isInventoryMarked(day: number): boolean {
  const date = isoDate(new Date(year.value, month.value - 1, day));
  return (monthResponse.value?.dateMarkers ?? []).some(
    (marker) => marker.date === date && marker.type === "INVENTORY",
  );
}

function dayHeaderStyle(day: number): Record<string, string> | undefined {
  if (isInventoryMarked(day)) {
    return {
      backgroundColor: "var(--p-primary-color)",
      color: "var(--p-primary-contrast-color)",
    };
  }
  return isWeekend(day) ? weekendBackgroundStyle : undefined;
}

function inventoryDayLabel(day: number): string {
  const date = isoDate(new Date(year.value, month.value - 1, day));
  return isInventoryMarked(day)
    ? `Снять отметку «Инвентаризация»: ${formatCellDayMonth(date)}`
    : `Отметить инвентаризацию: ${formatCellDayMonth(date)}`;
}

async function toggleInventoryMarker(day: number): Promise<void> {
  if (busy.value) return;
  const date = isoDate(new Date(year.value, month.value - 1, day));
  error.value = "";

  if (previewMode.value) {
    const markers = monthResponse.value?.dateMarkers ?? [];
    previewMonth.value.dateMarkers = isInventoryMarked(day)
      ? markers.filter((marker) => marker.date !== date)
      : [...markers, { date, type: "INVENTORY" }];
    return;
  }

  busy.value = true;
  try {
    if (isInventoryMarked(day)) await schedule.deleteInventoryMarker(date);
    else await schedule.setInventoryMarker(date);
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : "Не удалось изменить отметку инвентаризации";
  } finally {
    busy.value = false;
  }
}

function createPreviewMonth(selectedYear: number, selectedMonth: number): ScheduleMonth {
  const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
  const employees = PREVIEW_TEAM_ROSTER;
  return {
    year: selectedYear,
    month: selectedMonth,
    daysInMonth,
    dateMarkers: [],
    rows: employees.map((employee, index) => {
      const cells = Array.from({ length: daysInMonth }, (_, dayIndex) => {
        const date = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-${String(dayIndex + 1).padStart(2, "0")}`;
        const sequence: Array<"MORNING" | "DAY" | "EVENING" | "NIGHT" | null> = [
          "MORNING",
          "EVENING",
          "EVENING",
          "NIGHT",
          "MORNING",
          null,
        ];
        const code = sequence[(dayIndex + employee.start) % sequence.length];
        const statusRoll = (dayIndex * 7 + index * 11) % 23;
        const value: ScheduleValue | null =
          code !== null
            ? statusRoll === 0
              ? { kind: "STATUS", status: "NO_SHOW" }
              : statusRoll === 1
                ? { kind: "STATUS", status: "VACATION" }
                : statusRoll === 2
                  ? { kind: "STATUS", status: "SICK_LEAVE" }
                  : {
                      kind: "SHIFT",
                      durationHours: employee.hours,
                      shiftCode: code,
                      startMinute: { MORNING: 540, DAY: 720, EVENING: 1020, NIGHT: 1320 }[code],
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
    ["Утро и вечер", ["demo-morning-09", "demo-evening-18", "demo-evening-18", null]],
    ["Смешанный цикл", ["demo-morning-10", "demo-evening-18", "demo-night-22", null]],
  ].map(([name, days], index) => {
    const versionId = `demo-system-template-version-${index + 1}`;
    return {
      id: `demo-template-${index + 1}`,
      name: String(name),
      isSystem: false,
      currentVersionId: versionId,
      currentVersion: {
        id: versionId,
        version: 1,
        days: (days as Array<string | null>).map((shiftSettingId, position) => ({
          position,
          shiftSettingId,
        })),
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
  if (item.kind === "SHIFT") return shiftLetter(item.shiftCode);
  if (item.kind === "EMPTY") return "";
  return { VACATION: "О", SICK_LEAVE: "Б", NO_SHOW: "Н" }[item.status];
}
function commentPreview(comment: string | undefined): string {
  const text = comment?.trim().replace(/\s+/g, " ");
  if (!text) return "";
  return text.length > 80 ? `${text.slice(0, 77)}…` : text;
}
function shiftLetter(code: ShiftCode): string {
  return { MORNING: "У", DAY: "Д", EVENING: "В", NIGHT: "Н" }[code];
}
function openShiftSettings(): void {
  resetShiftDraft();
  shiftSettingsVisible.value = true;
}
function selectShiftDraft(code: ShiftCode | null): void {
  draftShiftCode.value = code;
  draftEditingId.value = null;
  draftStartTime.value = null;
  draftDurationHours.value = null;
}
function shiftSettingOptionValue(setting: ShiftSettingView): string {
  return (
    setting.id ??
    `SETTING:${setting.shiftCode}:${setting.startMinute}:${setting.defaultDurationHours}`
  );
}
function initializeStartTime(target: Ref<Date | null>): void {
  if (target.value) return;
  const now = new Date();
  now.setMinutes(Math.floor(now.getMinutes() / 5) * 5, 0, 0);
  target.value = now;
}
function initializeEditTime(): void {
  initializeStartTime(editStartTime);
}
function initializeDraftTime(): void {
  initializeStartTime(draftStartTime);
}
function shiftTypeOptionValue(code: ShiftCode): string {
  return `SHIFT_TYPE:${code}`;
}
function initializeCellEditor(value: ScheduleValue | null): void {
  if (!value) {
    editChoice.value = null;
    editOptionValue.value = null;
    editShiftSettingId.value = null;
    editHours.value = null;
    editStartTime.value = null;
    return;
  }
  if (value.kind === "STATUS") {
    editChoice.value = value.status;
    editOptionValue.value = value.status;
    editShiftSettingId.value = null;
    editHours.value = null;
    editStartTime.value = null;
    return;
  }
  if (value.kind === "EMPTY") {
    editChoice.value = "EMPTY";
    editOptionValue.value = "EMPTY";
    editShiftSettingId.value = null;
    editHours.value = null;
    editStartTime.value = null;
    return;
  }

  editChoice.value = value.shiftCode;
  editHours.value = value.durationHours;
  editStartTime.value = minuteToTime(value.startMinute);
  const setting = shiftSettings.value.find((item) => item.id === value.shiftSettingId);
  editShiftSettingId.value = setting?.id ?? value.shiftSettingId ?? null;
  editOptionValue.value = setting
    ? shiftSettingOptionValue(setting)
    : shiftTypeOptionValue(value.shiftCode);
}
function selectEditChoice(optionValue: string | null): void {
  editOptionValue.value = optionValue;
  if (!optionValue) {
    initializeCellEditor(null);
    return;
  }

  const setting = shiftSettings.value.find((item) => shiftSettingOptionValue(item) === optionValue);
  if (setting) {
    editChoice.value = setting.shiftCode;
    editShiftSettingId.value = setting.id ?? null;
    editHours.value = setting.defaultDurationHours;
    editStartTime.value = new Date(setting.startTime);
    return;
  }

  const shiftType = allShiftTypes.find(
    (shift) => shiftTypeOptionValue(shift.value) === optionValue,
  );
  if (shiftType) {
    editChoice.value = shiftType.value;
    editShiftSettingId.value = null;
    editHours.value = null;
    editStartTime.value = null;
    return;
  }

  const choice = optionValue as CellEditorChoice;
  editChoice.value = choice;
  editShiftSettingId.value = null;
  editHours.value = null;
  editStartTime.value = null;
}
function editShiftSetting(id: string | undefined): void {
  if (!id) return;
  const existing = shiftSettings.value.find((setting) => setting.id === id);
  if (!existing) return;
  draftShiftCode.value = existing.shiftCode;
  draftEditingId.value = existing.id ?? null;
  draftStartTime.value = new Date(existing.startTime);
  draftDurationHours.value = existing.defaultDurationHours;
}
function resetShiftDraft(): void {
  draftShiftCode.value = null;
  draftEditingId.value = null;
  draftStartTime.value = null;
  draftDurationHours.value = null;
}
async function saveShiftSetting(): Promise<void> {
  const code = draftShiftCode.value as ShiftCode | null;
  if (!code || !draftStartTime.value || !draftDurationHours.value) return;
  error.value = "";
  const previous = shiftSettings.value.map((setting) => ({ ...setting }));
  const startTime = new Date(draftStartTime.value);
  const nextSetting = {
    ...(draftEditingId.value
      ? { id: draftEditingId.value }
      : previewMode.value
        ? { id: crypto.randomUUID() }
        : {}),
    shiftCode: code,
    startMinute: timeToMinute(startTime),
    defaultDurationHours: draftDurationHours.value,
    startTime,
  };
  const index = shiftSettings.value.findIndex((setting) => setting.id === draftEditingId.value);
  if (index >= 0) shiftSettings.value[index] = nextSetting;
  else shiftSettings.value.push(nextSetting);
  await persistShiftSettings();
  if (error.value) shiftSettings.value = previous;
  else resetShiftDraft();
}
function removeShiftSetting(id: string | undefined): void {
  if (!id) return;
  error.value = "";
  if (draftEditingId.value === id) resetShiftDraft();
  const previous = [...shiftSettings.value];
  shiftSettings.value = shiftSettings.value.filter((setting) => setting.id !== id);
  void (async () => {
    await persistShiftSettings();
    if (error.value) shiftSettings.value = previous;
  })();
}
function persistShiftSettings(): Promise<void> {
  if (previewMode.value) return Promise.resolve();
  return run(async () => {
    const saved = await schedule.saveShiftSettings(
      shiftSettings.value.map(({ id, ...setting }) => ({
        ...(id ? { id } : {}),
        shiftCode: setting.shiftCode,
        startMinute: timeToMinute(setting.startTime),
        defaultDurationHours: setting.defaultDurationHours,
      })),
    );
    shiftSettings.value = saved.map((setting) => ({
      ...setting,
      startTime: minuteToTime(setting.startMinute),
    }));
  });
}
function shiftLabel(code: string): string {
  return (
    { MORNING: "Утро", DAY: "День", EVENING: "Вечер", NIGHT: "Ночь" }[
      code as "MORNING" | "DAY" | "EVENING" | "NIGHT"
    ] ?? code
  );
}
function templateDaySetting(id: string | null): ShiftSettingView | undefined {
  return id ? shiftSettings.value.find((setting) => setting.id === id) : undefined;
}
function templateDayLetter(id: string | null): string {
  const setting = templateDaySetting(id);
  return setting ? shiftLetter(setting.shiftCode) : "";
}
function templateDayStyle(id: string | null): Record<string, string> {
  const setting = templateDaySetting(id);
  return setting
    ? shiftColorStyle(setting.shiftCode)
    : { borderColor: "var(--p-content-border-color)" };
}
function templateDayTooltip(id: string | null): string {
  const setting = templateDaySetting(id);
  return setting ? formatShiftTime(setting.startTime, setting.defaultDurationHours) : "Выходной";
}
function shiftLegendName(code: ShiftCode): string {
  return { MORNING: "Утро", DAY: "День", EVENING: "Вечер", NIGHT: "Ночь" }[code];
}
function formatCycleName(name: string | null | undefined): string {
  return name ?? "";
}
function minuteToTime(minutes: number): Date {
  return new Date(0, 0, 0, Math.floor(minutes / 60), minutes % 60);
}
function timeToMinute(value: Date): number {
  return value.getHours() * 60 + value.getMinutes();
}
function formatTimeOfDay(minutes: number): string {
  const time = minuteToTime(minutes);
  return `${String(time.getHours()).padStart(2, "0")}:${String(time.getMinutes()).padStart(2, "0")}`;
}
function formatShiftTime(startTime: Date, durationHours: number): string {
  const start = timeToMinute(startTime);
  const end = (start + durationHours * 60) % (24 * 60);
  return `${formatTimeOfDay(start)}–${formatTimeOfDay(end)}`;
}
function cellTooltip(value: ScheduleValue | null): string | undefined {
  if (value?.kind !== "SHIFT") return undefined;
  return formatShiftTime(minuteToTime(value.startMinute), value.durationHours);
}
function appendTemplateDay(): void {
  if (templateForm.days.length >= 31 || templateDayOptions.value.length <= 1) return;
  templateForm.days.push(undefined);
}
function removeTemplateDay(index: number): void {
  templateForm.days.splice(index, 1);
}
function cellStyle(
  value: ScheduleValue | null,
  selected: boolean,
): Record<string, string> | undefined {
  const style: Record<string, string> = {};
  if (value?.kind === "SHIFT") {
    style.backgroundColor = shiftBackgrounds[value.shiftCode];
    style.color = "var(--p-text-color)";
  }
  if (value?.kind === "STATUS") {
    style.backgroundColor = statusBackground;
    style.color = "var(--p-text-color)";
  }
  if (selected) style.boxShadow = "inset 0 0 0 2px var(--p-primary-color)";
  return Object.keys(style).length ? style : undefined;
}
function shiftColorStyle(code: ScheduleShiftSetting["shiftCode"]): Record<string, string> {
  return { backgroundColor: shiftBackgrounds[code], borderColor: "var(--p-content-border-color)" };
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
function scheduleRowClass(row: ScheduleRow): string | undefined {
  const applicableCells = row.cells.filter((cell) => cell.applicable);
  if (
    applicableCells.length &&
    applicableCells.every((cell) =>
      selectedCells.value.includes(`${row.membershipId}:${cell.date}`),
    )
  ) {
    return "schedule-row-selected";
  }
  return undefined;
}
function toggleEmployeeSelection(event: MouseEvent, row: ScheduleRow): void {
  if (!canEdit.value || (!event.ctrlKey && !event.metaKey)) return;
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
  bulkEditMode.value = false;
  activeRow.value = row;
  activeCellIndex.value = index;
  const value = row.cells[index].value;
  initializeCellEditor(value);
  savedValueSignature.value = value ? editValueSignature.value : null;
  commentText.value = "";
  error.value = "";
  cellVisible.value = true;
}
function sameScheduleValue(left: ScheduleValue | null, right: ScheduleValue | null): boolean {
  if (left === null || right === null) return left === right;
  if (left.kind !== right.kind) return false;
  if (left.kind === "SHIFT" && right.kind === "SHIFT") {
    return (
      left.shiftCode === right.shiftCode &&
      left.durationHours === right.durationHours &&
      left.startMinute === right.startMinute
    );
  }
  if (left.kind === "STATUS" && right.kind === "STATUS") return left.status === right.status;
  return left.kind === "EMPTY" && right.kind === "EMPTY";
}
function openBulkEditor(): void {
  const targets = [...selectedCells.value];
  if (!targets.length) return;
  bulkEditMode.value = true;
  bulkEditTargets.value = targets;
  activeRow.value = null;
  activeCellIndex.value = -1;
  savedValueSignature.value = null;
  commentText.value = "";
  const values = bulkEditCells.value.map(({ cell }) => cell.value);
  const firstValue = values[0] ?? null;
  const areValuesEqual =
    values.length === targets.length &&
    values.every((value) => sameScheduleValue(firstValue, value));
  initializeCellEditor(areValuesEqual ? firstValue : null);
  error.value = "";
  cellVisible.value = true;
}
function resetCellSelection(): void {
  selectedCells.value = [];
}
function valueFor(
  kind: "SHIFT" | "STATUS" | "EMPTY",
  hours = 8,
  shiftCode: "MORNING" | "DAY" | "EVENING" | "NIGHT" = "MORNING",
  startMinute = 540,
  status: "VACATION" | "SICK_LEAVE" | "NO_SHOW" | null = null,
  shiftSettingId: string | null = null,
): ScheduleValue {
  if (kind === "SHIFT") {
    return { kind, durationHours: hours, shiftCode, startMinute, shiftSettingId };
  }
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
    const cycleLength = version.days.length;
    const anchor = new Date(`${item.anchor}T00:00:00`);
    const applyFrom = new Date(`${item.applyFrom}T00:00:00`);
    for (const cell of row.cells) {
      const date = new Date(`${cell.date}T00:00:00`);
      if (!cell.applicable || date < applyFrom) continue;
      const offset = Math.floor((date.getTime() - anchor.getTime()) / 86_400_000);
      const cycleDay = ((offset % cycleLength) + cycleLength) % cycleLength;
      const settingId = version.days[cycleDay]?.shiftSettingId;
      const setting = shiftSettings.value.find((item) => item.id === settingId);
      const nextValue: ScheduleValue = setting
        ? {
            kind: "SHIFT",
            durationHours: setting.defaultDurationHours,
            shiftCode: setting.shiftCode,
            startMinute: setting.startMinute,
            shiftSettingId: setting.id,
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
function saveCellChanges(): void {
  if (!activeRow.value || !activeCell.value) return;
  const shouldSaveValue = hasUnsavedScheduleValue.value;
  const shouldSaveComment = hasCommentDraft.value;
  if (!shouldSaveValue && !shouldSaveComment) return;
  const choice = editChoice.value;
  const text = commentText.value.trim();
  const isShift = !!choice && allShiftTypes.some((shift) => shift.value === choice);
  void run(async () => {
    let valueSaveError: string | null = null;
    let commentSaveError: string | null = null;
    if (shouldSaveValue && choice) {
      const status =
        choice === "VACATION" || choice === "SICK_LEAVE" || choice === "NO_SHOW" ? choice : null;
      const cell = {
        membershipId: activeRow.value!.membershipId,
        date: activeCell.value!.date,
        value: valueFor(
          status ? "STATUS" : isShift ? "SHIFT" : "EMPTY",
          editHours.value ?? 8,
          isShift ? (choice as ShiftCode) : "MORNING",
          editStartTime.value ? timeToMinute(editStartTime.value) : 540,
          status,
          editShiftSettingId.value,
        ),
      };
      try {
        if (previewMode.value) previewSetCell(cell.membershipId, cell.date, cell.value);
        else await schedule.updateCell(cell);
        savedValueSignature.value = editValueSignature.value;
      } catch (cause) {
        valueSaveError =
          cause instanceof Error ? cause.message : "не удалось сохранить значение дня";
      }
    }

    if (shouldSaveComment) {
      try {
        if (previewMode.value) {
          const comment = activeCell.value!.comment;
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
          await schedule.saveComment(activeRow.value!.membershipId, activeCell.value!.date, text);
        }
        commentText.value = "";
      } catch (cause) {
        commentSaveError =
          cause instanceof Error ? cause.message : "не удалось сохранить комментарий";
      }
    }

    if (valueSaveError || commentSaveError) {
      const savedItems: string[] = [];
      const failedItems: string[] = [];
      if (shouldSaveValue && !valueSaveError) {
        savedItems.push(isShift ? "Смена сохранена" : "Значение дня сохранено");
      }
      if (shouldSaveComment && !commentSaveError) savedItems.push("Комментарий сохранён");
      if (valueSaveError) failedItems.push(`Не удалось сохранить значение дня: ${valueSaveError}`);
      if (commentSaveError)
        failedItems.push(`Не удалось сохранить комментарий: ${commentSaveError}`);
      error.value = [...savedItems, ...failedItems, "Повторите сохранение."].join(". ");
      return;
    }

    cellVisible.value = false;
  });
}
function deleteCellValue(): void {
  if (!activeRow.value || !activeCell.value || !hasCellValueToDelete.value) return;
  void run(async () => {
    const cell = {
      membershipId: activeRow.value!.membershipId,
      date: activeCell.value!.date,
      value: valueFor("EMPTY"),
    };
    if (previewMode.value) previewSetCell(cell.membershipId, cell.date, cell.value);
    else await schedule.updateCell(cell);
    cellVisible.value = false;
  });
}
function saveBulkEdit(): void {
  if (!bulkEditMode.value || !canSaveScheduleValue.value) return;
  const choice = editChoice.value;
  if (!choice) return;
  const status =
    choice === "VACATION" || choice === "SICK_LEAVE" || choice === "NO_SHOW" ? choice : null;
  const isShift = allShiftTypes.some((shift) => shift.value === choice);
  const cells = bulkEditTargets.value.map((key) => {
    const [membershipId, date] = key.split(":");
    return {
      membershipId,
      date,
      value: valueFor(
        status ? "STATUS" : isShift ? "SHIFT" : "EMPTY",
        editHours.value ?? 8,
        isShift ? (choice as ShiftCode) : "MORNING",
        editStartTime.value ? timeToMinute(editStartTime.value) : 540,
        status,
        editShiftSettingId.value,
      ),
    };
  });
  void run(async () => {
    if (previewMode.value) {
      for (const cell of cells) previewSetCell(cell.membershipId, cell.date, cell.value);
    } else await schedule.updateCells(cells);
    selectedCells.value = [];
    cellVisible.value = false;
    bulkEditMode.value = false;
  });
}
function clearSelectedCells(): void {
  const cells = selectedCells.value.map((key) => {
    const [membershipId, date] = key.split(":");
    return { membershipId, date, value: valueFor("EMPTY") };
  });
  if (!cells.length) return;
  void run(async () => {
    if (previewMode.value) {
      for (const cell of cells) previewSetCell(cell.membershipId, cell.date, cell.value);
    } else await schedule.updateCells(cells);
    selectedCells.value = [];
    bulkDeleteVisible.value = false;
  });
}
function confirmClearSelectedCells(): void {
  if (busy.value || !selectedCells.value.length) return;
  clearSelectedCells();
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
    error.value = "Укажите название и последовательность длиной до 31 дня с хотя бы одной сменой";
    return;
  }
  if (duplicateTemplate.value) {
    error.value = "";
    duplicateWarningVisible.value = true;
    return;
  }
  const input = {
    name: templateName.value,
    days: templateForm.days.map((settingId) =>
      settingId === templateDayOffValue ? null : (settingId ?? null),
    ),
  };
  void run(async () => {
    const editingId = selectedTemplateId.value;
    if (previewMode.value) {
      const existing = previewTemplates.value.find((item) => item.id === selectedTemplateId.value);
      const versionChanged =
        !existing ||
        JSON.stringify(existing.currentVersion.days.map(({ shiftSettingId }) => shiftSettingId)) !==
          JSON.stringify(input.days);
      const version = versionChanged
        ? {
            id: `demo-template-version-${Date.now()}`,
            version: (existing?.currentVersion.version ?? 0) + 1,
            days: input.days.map((shiftSettingId, position) => ({ position, shiftSettingId })),
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
          days: input.days.map((shiftSettingId, position) => ({ position, shiftSettingId })),
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
  templateForm.name = template.name;
  templateForm.days = template.currentVersion.days.map(
    ({ shiftSettingId }) => shiftSettingId ?? templateDayOffValue,
  );
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
  templateForm.name = "";
  templateForm.days = [];
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
function formatCellDayMonth(value: string): string {
  const [yearValue, monthValue, dayValue] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" }).format(
    new Date(yearValue, monthValue - 1, dayValue),
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
