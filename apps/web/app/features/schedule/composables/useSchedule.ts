import { useQuery, useQueryClient } from "@tanstack/vue-query";
import {
  schedulesControllerCreateTemplate,
  schedulesControllerExtend,
  schedulesControllerGenerate,
  schedulesControllerGetMonth,
  schedulesControllerListTemplates,
  schedulesControllerSaveComment,
  schedulesControllerUpdateCell,
  schedulesControllerUpdateCells,
  schedulesControllerUpdateSettings,
  schedulesControllerUpdateTemplate,
} from "@bartech/api-client";
import type {
  ScheduleCellDto,
  ScheduleGenerateDto,
  ScheduleSettingsDto,
  ScheduleTemplateDto,
} from "@bartech/api-client";
import { useIdentityFlow } from "~/features/identity/composables/useIdentityFlow";
import { requestApi } from "~/utils/api-response";

export type ScheduleValue =
  | { kind: "SHIFT"; durationHours: number; shiftType: "NORMAL" | "NIGHT" }
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
  cells: ScheduleCell[];
  totalHours: number;
  totalShifts: number;
};
export type ScheduleMonth = {
  year: number;
  month: number;
  daysInMonth: number;
  standardShiftDurationHours: number;
  rows: ScheduleRow[];
};
export type ScheduleTemplate = {
  id: string;
  name: string;
  isSystem: boolean;
  currentVersionId: string;
  currentVersion: {
    id: string;
    version: number;
    workDays: number;
    offDays: number;
    durationHours: number;
    shiftType: "NORMAL" | "NIGHT";
  };
};

export function useSchedule(
  companyId: string,
  venueId: string,
  year: Ref<number>,
  month: Ref<number>,
  enabled: Ref<boolean> = ref(true),
) {
  const identity = useIdentityFlow();
  const queryClient = useQueryClient();
  const queryKey = computed(() => ["schedule", companyId, venueId, year.value, month.value]);
  const monthQuery = useQuery({
    queryKey,
    enabled,
    retry: false,
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

  async function mutate<T>(operation: () => Promise<T>): Promise<void> {
    await identity.refreshCsrf();
    await requestApi(Promise.resolve(await operation()));
    await queryClient.invalidateQueries({ queryKey: ["schedule", companyId, venueId] });
    await queryClient.invalidateQueries({ queryKey: ["schedule-templates", companyId, venueId] });
  }
  const options = () => ({
    credentials: "include" as const,
    headers: { "x-csrf-token": identity.csrfToken.value },
  });
  const updateCell = (cell: ScheduleCellDto) =>
    mutate(() =>
      schedulesControllerUpdateCell(companyId, venueId, cell, options(), identity.apiFetch),
    );
  const updateCells = (cells: ScheduleCellDto[]) =>
    mutate(() =>
      schedulesControllerUpdateCells(companyId, venueId, { cells }, options(), identity.apiFetch),
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
  const updateSettings = (body: ScheduleSettingsDto) =>
    mutate(() =>
      schedulesControllerUpdateSettings(companyId, venueId, body, options(), identity.apiFetch),
    );
  const generate = (body: ScheduleGenerateDto) =>
    mutate(() =>
      schedulesControllerGenerate(companyId, venueId, body, options(), identity.apiFetch),
    );
  const extend = (targetYear: number, targetMonth: number) =>
    mutate(() =>
      schedulesControllerExtend(
        companyId,
        venueId,
        { year: targetYear, month: targetMonth },
        options(),
        identity.apiFetch,
      ),
    );
  const saveTemplate = (body: ScheduleTemplateDto, id?: string) =>
    mutate(() =>
      id
        ? schedulesControllerUpdateTemplate(
            companyId,
            venueId,
            id,
            body,
            options(),
            identity.apiFetch,
          )
        : schedulesControllerCreateTemplate(companyId, venueId, body, options(), identity.apiFetch),
    );
  async function exportSchedule(format: "xlsx" | "pdf"): Promise<void> {
    const response = await identity.apiFetch(
      `/api/v1/organizations/companies/${companyId}/venues/${venueId}/schedule/export?year=${year.value}&month=${month.value}&format=${format}`,
      { credentials: "include" },
    );
    if (!response.ok) throw new Error("Не удалось выгрузить график");
    const file = URL.createObjectURL(await response.blob());
    const link = document.createElement("a");
    link.href = file;
    link.download = `schedule-${year.value}-${String(month.value).padStart(2, "0")}.${format}`;
    link.click();
    URL.revokeObjectURL(file);
  }
  return {
    monthQuery,
    templatesQuery,
    updateCell,
    updateCells,
    saveComment,
    updateSettings,
    generate,
    extend,
    saveTemplate,
    exportSchedule,
  };
}
