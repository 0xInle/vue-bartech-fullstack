import { useQuery, useQueryClient } from "@tanstack/vue-query";
import {
  schedulesControllerDeleteTemplate,
  schedulesControllerExtend,
  schedulesControllerGenerate,
  schedulesControllerGetMonth,
  schedulesControllerGetShiftSettings,
  schedulesControllerListTemplates,
  schedulesControllerSaveShiftSettings,
  schedulesControllerSaveComment,
  schedulesControllerSetInventoryMarker,
  schedulesControllerDeleteInventoryMarker,
  schedulesControllerUpdateCell,
  schedulesControllerUpdateCells,
} from "@bartech/api-client";
import { useIdentityFlow } from "~/features/identity/composables/useIdentityFlow";
import { requestApi } from "~/utils/api-response";

type ApiResponse = { data: unknown; status: number };

export type ScheduleValue =
  | {
      kind: "SHIFT";
      durationHours: number;
      shiftCode: "MORNING" | "DAY" | "EVENING" | "NIGHT";
      startMinute: number;
      shiftSettingId?: string | null;
    }
  | { kind: "STATUS"; status: "VACATION" | "SICK_LEAVE" | "NO_SHOW" }
  | { kind: "EMPTY" };
export type ScheduleCell = {
  date: string;
  applicable: boolean;
  value: ScheduleValue | null;
  comment: null | {
    text: string;
    updatedAt: string;
    updatedBy: string;
    history: Array<{ text: string; createdAt: string; author: string }>;
  };
  history: Array<{ oldValue: unknown; newValue: unknown; createdAt: string; author: string }>;
};
export type ScheduleRow = {
  membershipId: string;
  rolePeriodId: string;
  fullName: string;
  role: string;
  roleLabel: string;
  previousTemplateName?: string | null;
  assignedTemplateName?: string | null;
  hasScheduleAssignment?: boolean;
  cells: ScheduleCell[];
  totalHours: number;
  totalShifts: number;
};
export type ScheduleMonth = {
  year: number;
  month: number;
  daysInMonth: number;
  dateMarkers: ScheduleDateMarker[];
  rows: ScheduleRow[];
};
export type ScheduleDateMarker = { date: string; type: "INVENTORY" };
export type ScheduleTemplate = {
  id: string;
  name: string;
  isSystem: boolean;
  currentVersionId: string;
  currentVersion: {
    id: string;
    version: number;
    days: Array<{ position: number; shiftSettingId: string | null }>;
  };
  _count?: { assignments: number };
};
export type ScheduleShiftSetting = {
  id: string;
  shiftCode: "MORNING" | "DAY" | "EVENING" | "NIGHT";
  startMinute: number;
  defaultDurationHours: number;
};

function parseShiftSettings(value: unknown): ScheduleShiftSetting[] {
  const isShiftSetting = (item: unknown): item is ScheduleShiftSetting => {
    if (!item || typeof item !== "object") return false;
    const setting = item as Partial<ScheduleShiftSetting>;
    return (
      typeof setting.id === "string" &&
      ["MORNING", "DAY", "EVENING", "NIGHT"].includes(setting.shiftCode ?? "") &&
      Number.isInteger(setting.startMinute) &&
      Number.isInteger(setting.defaultDurationHours)
    );
  };

  if (!Array.isArray(value) || !value.every(isShiftSetting)) {
    throw new Error("Сервер вернул некорректный список настроек смен. Обновите страницу.");
  }
  return value;
}

export function useSchedule(
  companyId: string,
  venueId: string,
  year: Readonly<Ref<number>>,
  month: Readonly<Ref<number>>,
  enabled: Ref<boolean> = ref(true),
) {
  const identity = useIdentityFlow();
  const queryClient = useQueryClient();
  const queryKey = computed(() => ["schedule", companyId, venueId, year.value, month.value]);
  const monthQuery = useQuery({
    queryKey,
    enabled,
    retry: false,
    placeholderData: (previousMonth) => previousMonth,
    queryFn: async ({ signal }) => {
      const response = await schedulesControllerGetMonth(
        companyId,
        venueId,
        { year: year.value, month: month.value },
        { credentials: "include", signal },
        identity.apiFetch,
      );
      return requestApi<ScheduleMonth>(Promise.resolve(response));
    },
  });
  const templatesQuery = useQuery({
    queryKey: ["schedule-templates", companyId, venueId],
    enabled,
    retry: false,
    queryFn: async () => {
      const response = await schedulesControllerListTemplates(
        companyId,
        venueId,
        { credentials: "include" },
        identity.apiFetch,
      );
      return requestApi<ScheduleTemplate[]>(Promise.resolve(response));
    },
  });
  const shiftSettingsQuery = useQuery({
    queryKey: ["schedule-shift-settings", companyId, venueId],
    enabled,
    retry: false,
    queryFn: async () => {
      const response = await schedulesControllerGetShiftSettings(
        companyId,
        venueId,
        { credentials: "include" },
        identity.apiFetch,
      );
      return parseShiftSettings(await requestApi<unknown>(Promise.resolve(response)));
    },
  });

  async function mutate<T>(operation: () => Promise<ApiResponse>): Promise<T> {
    await identity.refreshCsrf();
    const result = await requestApi<T>(Promise.resolve(await operation()));
    await queryClient.invalidateQueries({ queryKey: ["schedule", companyId, venueId] });
    await queryClient.invalidateQueries({ queryKey: ["schedule-templates", companyId, venueId] });
    await queryClient.invalidateQueries({
      queryKey: ["schedule-shift-settings", companyId, venueId],
    });
    return result;
  }
  const options = () => ({
    credentials: "include" as const,
    headers: { "x-csrf-token": identity.csrfToken.value },
  });
  const updateCell = (cell: { membershipId: string; date: string; value: ScheduleValue }) =>
    mutate(() =>
      schedulesControllerUpdateCell(
        companyId,
        venueId,
        cell as never,
        options(),
        identity.apiFetch,
      ),
    );
  const updateCells = (
    cells: Array<{ membershipId: string; date: string; value: ScheduleValue }>,
  ) =>
    mutate(() =>
      schedulesControllerUpdateCells(
        companyId,
        venueId,
        { cells } as never,
        options(),
        identity.apiFetch,
      ),
    );
  const saveComment = (membershipId: string, date: string, text: string) =>
    mutate(() =>
      schedulesControllerSaveComment(
        companyId,
        venueId,
        membershipId,
        date,
        { text },
        options(),
        identity.apiFetch,
      ),
    );
  const setInventoryMarker = (date: string) =>
    mutate(() =>
      schedulesControllerSetInventoryMarker(companyId, venueId, date, options(), identity.apiFetch),
    );
  const deleteInventoryMarker = (date: string) =>
    mutate(() =>
      schedulesControllerDeleteInventoryMarker(
        companyId,
        venueId,
        date,
        options(),
        identity.apiFetch,
      ),
    );
  const generate = (body: Record<string, unknown>) =>
    mutate(() =>
      schedulesControllerGenerate(companyId, venueId, body as never, options(), identity.apiFetch),
    );
  const extend = (targetYear: number, targetMonth: number, membershipIds: string[]) =>
    mutate(() =>
      schedulesControllerExtend(
        companyId,
        venueId,
        { year: targetYear, month: targetMonth, membershipIds },
        options(),
        identity.apiFetch,
      ),
    );
  const saveTemplate = (body: { name: string; days: Array<string | null> }, id?: string) =>
    mutate(async () => {
      const response = await identity.apiFetch(
        `/api/v1/organizations/companies/${companyId}/venues/${venueId}/schedule/templates${id ? `/${id}` : ""}`,
        {
          method: id ? "PUT" : "POST",
          credentials: "include",
          headers: { ...options().headers, "content-type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      return response;
    });
  const saveShiftSettings = (settings: Array<Omit<ScheduleShiftSetting, "id"> & { id?: string }>) =>
    mutate<unknown>(() =>
      schedulesControllerSaveShiftSettings(
        companyId,
        venueId,
        { settings },
        options(),
        identity.apiFetch,
      ),
    ).then(parseShiftSettings);
  const deleteTemplate = (id: string) =>
    mutate(() =>
      schedulesControllerDeleteTemplate(companyId, venueId, id, options(), identity.apiFetch),
    );
  async function exportSchedule(
    format: "xlsx" | "pdf",
    exportYear = year.value,
    exportMonth = month.value,
  ): Promise<void> {
    const response = await identity.apiFetch(
      `/api/v1/organizations/companies/${companyId}/venues/${venueId}/schedule/export?year=${exportYear}&month=${exportMonth}&format=${format}`,
      { credentials: "include" },
    );
    if (!response.ok) throw new Error("Не удалось выгрузить график");
    const file = URL.createObjectURL(await response.blob());
    const link = document.createElement("a");
    link.href = file;
    link.download = `schedule-${exportYear}-${String(exportMonth).padStart(2, "0")}.${format}`;
    link.click();
    URL.revokeObjectURL(file);
  }
  return {
    monthQuery,
    templatesQuery,
    shiftSettingsQuery,
    updateCell,
    updateCells,
    saveComment,
    setInventoryMarker,
    deleteInventoryMarker,
    generate,
    extend,
    saveTemplate,
    saveShiftSettings,
    deleteTemplate,
    exportSchedule,
  };
}
