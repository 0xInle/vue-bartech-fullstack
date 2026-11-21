import { computed, onBeforeUnmount, onMounted, ref, type MaybeRefOrGetter } from "vue";
import { useScheduleMonthQuery } from "~/features/schedule/composables/useSchedule";

const shiftNames = { MORNING: "Утро", DAY: "День", EVENING: "Вечер", NIGHT: "Ночь" } as const;
function formatTime(minutes: number): string {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`;
}

export function useTodayShiftRoster(
  companyId: MaybeRefOrGetter<string>,
  venueId: MaybeRefOrGetter<string>,
) {
  const today = ref(startOfDay(new Date()));
  const selectedDate = ref(new Date(today.value));
  const year = computed(() => selectedDate.value.getFullYear());
  const month = computed(() => selectedDate.value.getMonth() + 1);
  const date = computed(() => formatDateKey(selectedDate.value));
  const isToday = computed(() => date.value === formatDateKey(today.value));
  const isYesterday = computed(
    () => date.value === formatDateKey(shiftCalendarDate(today.value, -1)),
  );
  const isTomorrow = computed(
    () => date.value === formatDateKey(shiftCalendarDate(today.value, 1)),
  );
  const title = computed(() => {
    if (isYesterday.value) return "Вчера на смене";
    if (isTomorrow.value) return "Завтра на смене";
    return "Сегодня на смене";
  });
  const canGoPrevious = computed(() => !isYesterday.value);
  const canGoNext = computed(() => !isTomorrow.value);
  const monthQuery = useScheduleMonthQuery(companyId, venueId, year, month, ref(true), {
    keepPreviousData: false,
  });
  const shifts = computed(() => {
    return (monthQuery.data.value?.rows ?? [])
      .flatMap((row) => {
        const cell = row.cells.find((item) => item.date === date.value && item.applicable);
        const value = cell?.value;
        if (value?.kind !== "SHIFT") return [];
        const endMinute = value.startMinute + value.durationHours * 60;
        return [
          {
            membershipId: row.membershipId,
            fullName: row.fullName,
            roleLabel: row.roleLabel,
            shiftCode: value.shiftCode,
            shiftName: shiftNames[value.shiftCode],
            startMinute: value.startMinute,
            time: `${formatTime(value.startMinute)}–${formatTime(endMinute)}`,
          },
        ];
      })
      .sort((a, b) => a.startMinute - b.startMinute);
  });

  function shiftDate(days: number) {
    const nextDate = new Date(selectedDate.value);
    nextDate.setDate(nextDate.getDate() + days);
    const minimumDate = shiftCalendarDate(today.value, -1);
    const maximumDate = shiftCalendarDate(today.value, 1);
    if (nextDate < minimumDate || nextDate > maximumDate) return;
    selectedDate.value = nextDate;
  }

  let midnightTimer: ReturnType<typeof setTimeout> | undefined;

  function scheduleMidnightReset() {
    const now = new Date();
    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    midnightTimer = setTimeout(() => {
      today.value = startOfDay(new Date());
      selectedDate.value = new Date(today.value);
      scheduleMidnightReset();
    }, nextMidnight.getTime() - now.getTime());
  }

  onMounted(scheduleMidnightReset);
  onBeforeUnmount(() => {
    if (midnightTimer) clearTimeout(midnightTimer);
  });

  return {
    date,
    isToday,
    title,
    canGoPrevious,
    canGoNext,
    monthQuery,
    nextDay: () => shiftDate(1),
    previousDay: () => shiftDate(-1),
    shifts,
  };
}

function formatDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function shiftCalendarDate(date: Date, days: number): Date {
  const shifted = new Date(date);
  shifted.setDate(shifted.getDate() + days);
  return shifted;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
