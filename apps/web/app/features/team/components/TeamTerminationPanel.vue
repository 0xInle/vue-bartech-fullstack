<template>
  <section class="space-y-4">
    <h2 class="text-base font-semibold">Увольнение сотрудника</h2>
    <FloatLabel variant="on">
      <Select
        v-model="selectedMemberId"
        input-id="team-page-termination-member"
        :options="employeeOptions"
        option-label="label"
        option-value="id"
        size="small"
        class="w-full"
        :disabled="busy || !employeeOptions.length"
      />
      <label for="team-page-termination-member" class="text-xs">Сотрудник</label>
    </FloatLabel>
    <div class="flex items-end gap-2">
      <FloatLabel variant="on" class="min-w-0 flex-1">
        <DatePicker
          v-model="terminationDate"
          input-id="team-page-termination-date"
          date-format="dd.mm.yy"
          size="small"
          :manual-input="false"
          show-icon
          icon-display="input"
          show-clear
          :min-date="today"
          class="w-full"
          :disabled="busy || !selectedMember"
        />
        <label for="team-page-termination-date" class="text-xs">Дата увольнения</label>
      </FloatLabel>
      <Button
        label="Уволить"
        severity="danger"
        variant="outlined"
        size="small"
        :disabled="busy || !selectedMember || !terminationDate"
        @click="requestTermination"
      />
    </div>
    <Message v-if="error" severity="error" :closable="false" :pt="compactMessagePt">{{
      error
    }}</Message>
    <Divider />
    <section class="space-y-3">
      <h3 class="text-sm font-semibold">Ожидают увольнения</h3>
      <p v-if="!scheduledDepartures.length" class="text-sm text-color-secondary">
        Нет запланированных увольнений
      </p>
      <ul v-else class="divide-y divide-surface overflow-hidden rounded-lg border border-surface">
        <li
          v-for="member in scheduledDepartures"
          :key="member.id"
          class="flex flex-wrap items-center gap-2 p-3 text-sm"
        >
          <span class="min-w-0 flex-1 font-medium">{{ member.fullName }}</span>
          <Tag :value="roleLabel(member.role)" severity="secondary" />
          <span class="w-full text-right text-color-secondary">
            {{ formatDate(member.terminationDate!) }}
          </span>
        </li>
      </ul>
    </section>
    <Dialog
      v-model:visible="confirmationVisible"
      modal
      header="Подтвердить увольнение"
      class="w-full max-w-md"
      :pt="{
        title: { style: { fontSize: '1rem', fontWeight: '600' } },
        pcCloseButton: { root: { class: '!rounded-md' } },
      }"
    >
      <div v-if="selectedMember && terminationDate" class="space-y-4">
        <p class="text-sm">
          {{ selectedMember.fullName }} потеряет доступ к заведению с
          {{ formatDate(toDateKey(terminationDate)).replace(/г\.$/, "года") }}. Смены и статусы с
          этой даты будут очищены; комментарии и история сохраняются.
        </p>
        <Message v-if="error" severity="error" :closable="false" :pt="compactMessagePt">{{
          error
        }}</Message>
        <div class="flex justify-end gap-2">
          <Button
            label="Отмена"
            severity="secondary"
            variant="text"
            size="small"
            :disabled="busy"
            @click="confirmationVisible = false"
          />
          <Button
            label="Уволить"
            severity="danger"
            size="small"
            :loading="busy"
            :disabled="busy"
            @click="confirmTermination"
          />
        </div>
      </div>
    </Dialog>
  </section>
</template>

<script setup lang="ts">
import type { TeamMember, VenueRole } from "../composables/useVenueTeam";
import { compactMessagePt } from "~/utils/primevue-message";

const props = defineProps<{
  members: TeamMember[];
  endMembership: (membershipId: string, terminationDate: string) => Promise<void>;
}>();
const selectedMemberId = ref<string | null>(null);
const terminationDate = ref<Date | null>(null);
const confirmationVisible = ref(false);
const busy = ref(false);
const error = ref("");
const today = new Date();
const employeeOptions = computed(() =>
  props.members
    .filter((member) => !member.isCurrentUser && !member.terminationDate)
    .map((member) => ({
      id: member.id,
      label: `${member.fullName} · ${roleLabel(member.role)}`,
    })),
);
const selectedMember = computed<TeamMember | null>(
  () => props.members.find(({ id }) => id === selectedMemberId.value) ?? null,
);
const scheduledDepartures = computed(() =>
  props.members.filter((member) => Boolean(member.terminationDate)),
);

function requestTermination(): void {
  if (!selectedMember.value || !terminationDate.value) return;
  error.value = "";
  confirmationVisible.value = true;
}

async function confirmTermination(): Promise<void> {
  if (!selectedMember.value || !terminationDate.value) return;
  busy.value = true;
  error.value = "";
  try {
    await props.endMembership(selectedMember.value.id, toDateKey(terminationDate.value));
    confirmationVisible.value = false;
    selectedMemberId.value = null;
    terminationDate.value = null;
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "Не удалось уволить сотрудника";
  } finally {
    busy.value = false;
  }
}

function roleLabel(role: VenueRole): string {
  return {
    BARTENDER: "Бармен",
    BARBACK: "Барбек",
    TRAINEE: "Стажёр",
    SENIOR_BARTENDER: "Старший бармен",
    BAR_MANAGER: "Бар-менеджер",
  }[role];
}

function toDateKey(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function formatDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "long" }).format(
    new Date(year, month - 1, day),
  );
}
</script>
