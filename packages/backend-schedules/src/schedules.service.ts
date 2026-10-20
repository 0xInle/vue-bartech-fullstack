import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { DATABASE_CLIENT, Prisma, PrismaClient } from "@bartech/database";

export type ScheduleValue =
  | { kind: "SHIFT"; durationHours: number; shiftType: "NORMAL" | "NIGHT" }
  | { kind: "STATUS"; status: "VACATION" | "SICK_LEAVE" | "NO_SHOW" }
  | { kind: "EMPTY" };

export type ScheduleCellInput = { membershipId: string; date: string; value: ScheduleValue };
export type ScheduleTemplateInput = {
  name: string;
  workDays: number;
  offDays: number;
  durationHours: number;
  shiftType: "NORMAL" | "NIGHT";
};

const DAY_MS = 86_400_000;

@Injectable()
export class SchedulesService {
  constructor(@Inject(DATABASE_CLIENT) private readonly database: PrismaClient) {}

  async getMonth(companyId: string, venueId: string, year: number, month: number) {
    assertMonth(year, month);
    assertAvailableMonth(year, month);
    const { start, end, daysInMonth } = monthRange(year, month);
    const schedule = await this.database.schedule.findUnique({
      where: { venueId_year_month: { venueId, year, month } },
      include: {
        days: {
          include: {
            comment: {
              include: {
                updatedBy: { include: { profile: true } },
                history: {
                  include: { changedBy: { include: { profile: true } } },
                  orderBy: { createdAt: "desc" },
                },
              },
            },
            changes: {
              include: { changedBy: { include: { profile: true } } },
              orderBy: { createdAt: "desc" },
            },
          },
        },
      },
    });
    const memberships = await this.database.venueMembership.findMany({
      where: {
        companyId,
        venueId,
        startedOn: { lte: end },
        OR: [{ endedOn: null }, { endedOn: { gte: start } }],
        rolePeriods: {
          some: {
            startedOn: { lte: end },
            OR: [{ endedOn: null }, { endedOn: { gte: start } }],
          },
        },
      },
      include: {
        user: { include: { profile: true } },
        scheduleAssignment: { include: { template: true } },
        rolePeriods: {
          where: {
            startedOn: { lte: end },
            OR: [{ endedOn: null }, { endedOn: { gte: start } }],
          },
          orderBy: { startedOn: "asc" },
        },
      },
      orderBy: [{ startedOn: "asc" }, { createdAt: "asc" }],
    });
    const scheduleSnapshot =
      schedule ??
      (await this.database.schedule.upsert({
        where: { venueId_year_month: { venueId, year, month } },
        create: { venueId, year, month },
        update: {},
      }));
    await this.database.scheduleMemberSnapshot.createMany({
      data: memberships.map((membership) => ({
        scheduleId: scheduleSnapshot.id,
        venueMembershipId: membership.id,
        fullName: membership.user.profile?.fullName ?? "",
      })),
      skipDuplicates: true,
    });
    const nameSnapshots = await this.database.scheduleMemberSnapshot.findMany({
      where: { scheduleId: scheduleSnapshot.id },
      select: { venueMembershipId: true, fullName: true },
    });
    const namesByMembership = new Map(
      nameSnapshots.map((snapshot) => [snapshot.venueMembershipId, snapshot.fullName]),
    );
    const daysByMembership = new Map<
      string,
      typeof schedule extends null ? never : NonNullable<typeof schedule>["days"][number]
    >();
    for (const day of schedule?.days ?? []) {
      daysByMembership.set(day.venueMembershipId + ":" + dateKey(day.date), day);
    }
    const rows = memberships.flatMap((membership) =>
      membership.rolePeriods.map((rolePeriod) => {
        const roleStart = maxDate(start, membership.startedOn, rolePeriod.startedOn);
        const roleEnd = minDate(end, membership.endedOn, rolePeriod.endedOn);
        const cells = Array.from({ length: daysInMonth }, (_, index) => {
          const date = new Date(start.getTime() + index * DAY_MS);
          const applicable = date >= roleStart && (!roleEnd || date <= roleEnd);
          const day = daysByMembership.get(membership.id + ":" + dateKey(date));
          const value = day && !isEmpty(day) ? toValue(day) : null;
          return {
            date: dateKey(date),
            applicable,
            value: applicable ? value : null,
            comment:
              applicable && day?.comment
                ? {
                    text: day.comment.text,
                    updatedAt: day.comment.updatedAt,
                    updatedBy: day.comment.updatedBy.profile?.fullName ?? "",
                    history: day.comment.history.map((entry) => ({
                      text: entry.text,
                      createdAt: entry.createdAt,
                      author: entry.changedBy.profile?.fullName ?? "",
                    })),
                  }
                : null,
            history: applicable
              ? (day?.changes ?? [])
                  .map((entry) => ({
                    oldValue: visibleHistoryValue(entry.oldValue),
                    newValue: visibleHistoryValue(entry.newValue),
                    createdAt: entry.createdAt,
                    author: entry.changedBy.profile?.fullName ?? "",
                  }))
                  .filter((entry) => entry.oldValue !== null || entry.newValue !== null)
              : [],
          };
        });
        const shifts = cells.flatMap(({ value }) =>
          value?.kind === "SHIFT" ? [value.durationHours] : [],
        );
        return {
          membershipId: membership.id,
          rolePeriodId: rolePeriod.id,
          fullName: namesByMembership.get(membership.id) ?? "",
          role: rolePeriod.role,
          roleLabel: roleLabel(rolePeriod.role),
          previousTemplateName:
            membership.scheduleAssignment &&
            membership.scheduleAssignment.applyFromDate <= new Date(start.getTime() - DAY_MS)
              ? membership.scheduleAssignment.template.name
              : null,
          assignedTemplateName: membership.scheduleAssignment?.template.name ?? null,
          hasScheduleAssignment: Boolean(membership.scheduleAssignment),
          roleStartedOn: dateKey(rolePeriod.startedOn),
          roleEndedOn: rolePeriod.endedOn ? dateKey(rolePeriod.endedOn) : null,
          cells,
          totalHours: shifts.reduce((sum, hours) => sum + hours, 0),
          totalShifts: shifts.length,
        };
      }),
    );
    return {
      year,
      month,
      daysInMonth,
      rows,
    };
  }

  async listTemplates(venueId: string) {
    return this.database.scheduleTemplate.findMany({
      where: { OR: [{ isSystem: true }, { venueId, isSystem: false }] },
      include: { currentVersion: true, _count: { select: { assignments: true } } },
      orderBy: [{ isSystem: "desc" }, { name: "asc" }],
    });
  }

  async saveTemplate(
    venueId: string,
    userId: string,
    input: ScheduleTemplateInput,
    templateId?: string,
  ) {
    validateTemplate(input);
    const name = input.name.trim();
    if (!name || name.length > 80)
      throw new ConflictException("Укажите название шаблона до 80 символов");
    return this.database.$transaction(async (tx) => {
      if (!templateId) {
        const template = await tx.scheduleTemplate.create({
          data: { venueId, name, createdByUserId: userId },
        });
        const version = await tx.scheduleTemplateVersion.create({
          data: {
            templateId: template.id,
            version: 1,
            ...versionInput(input),
            createdByUserId: userId,
          },
        });
        return tx.scheduleTemplate.update({
          where: { id: template.id },
          data: { currentVersionId: version.id },
          include: { currentVersion: true },
        });
      }
      const template = await tx.scheduleTemplate.findFirst({
        where: { id: templateId, venueId, isSystem: false },
        include: { versions: { orderBy: { version: "desc" }, take: 1 } },
      });
      if (!template) throw new NotFoundException("Шаблон заведения не найден");
      const latestVersion = template.versions[0];
      if (
        latestVersion &&
        latestVersion.workDays === input.workDays &&
        latestVersion.offDays === input.offDays &&
        latestVersion.durationHours === input.durationHours &&
        latestVersion.shiftType === input.shiftType
      ) {
        return tx.scheduleTemplate.update({
          where: { id: templateId },
          data: { name },
          include: { currentVersion: true },
        });
      }
      const version = await tx.scheduleTemplateVersion.create({
        data: {
          templateId,
          version: (latestVersion?.version ?? 0) + 1,
          ...versionInput(input),
          createdByUserId: userId,
        },
      });
      return tx.scheduleTemplate.update({
        where: { id: templateId },
        data: { name, currentVersionId: version.id },
        include: { currentVersion: true },
      });
    });
  }

  async deleteTemplate(venueId: string, templateId: string) {
    return this.database.$transaction(async (tx) => {
      const template = await tx.scheduleTemplate.findFirst({
        where: { id: templateId, venueId, isSystem: false },
        select: { id: true },
      });
      if (!template) throw new NotFoundException("Пользовательский шаблон не найден");
      const assignments = await tx.scheduleAssignment.deleteMany({ where: { templateId } });
      await tx.scheduleTemplate.update({
        where: { id: templateId },
        data: { currentVersionId: null },
      });
      await tx.scheduleTemplate.delete({ where: { id: templateId } });
      return { deleted: true, removedAssignments: assignments.count };
    });
  }

  async setCell(venueId: string, userId: string, input: ScheduleCellInput) {
    return this.database.$transaction((tx) => this.writeCell(tx, venueId, userId, input));
  }

  async setCells(venueId: string, userId: string, cells: ScheduleCellInput[]) {
    if (!cells.length || cells.length > 500)
      throw new ConflictException("Выберите от 1 до 500 ячеек");
    return this.database.$transaction(async (tx) => {
      for (const cell of cells) await this.writeCell(tx, venueId, userId, cell);
      return { updated: cells.length };
    });
  }

  async assignAndGenerate(
    companyId: string,
    venueId: string,
    userId: string,
    year: number,
    month: number,
    assignments: Array<{
      membershipId: string;
      templateId: string;
      templateVersionId: string;
      cycleAnchorDate: string;
      applyFromDate: string;
    }>,
    overwrite = false,
    persistAssignments = true,
  ) {
    assertMonth(year, month);
    assertAvailableMonth(year, month);
    const { start, daysInMonth } = monthRange(year, month);
    const schedule = await this.database.schedule.upsert({
      where: { venueId_year_month: { venueId, year, month } },
      create: { venueId, year, month },
      update: {},
    });
    return this.database.$transaction(async (tx) => {
      let written = 0;
      let skipped = 0;
      for (const assignmentInput of assignments) {
        const membership = await tx.venueMembership.findFirst({
          where: { id: assignmentInput.membershipId, companyId, venueId },
          include: { rolePeriods: true },
        });
        if (!membership) throw new NotFoundException("Сотрудник не найден в этом заведении");
        const version = await tx.scheduleTemplateVersion.findFirst({
          where: {
            id: assignmentInput.templateVersionId,
            templateId: assignmentInput.templateId,
            template: { OR: [{ isSystem: true }, { venueId, isSystem: false }] },
          },
        });
        if (!version) throw new NotFoundException("Версия шаблона недоступна в этом заведении");
        const anchor = parseDate(assignmentInput.cycleAnchorDate);
        const applyFrom = parseDate(assignmentInput.applyFromDate);
        if (persistAssignments) {
          await tx.scheduleAssignment.upsert({
            where: { venueMembershipId: membership.id },
            create: {
              venueMembershipId: membership.id,
              templateId: assignmentInput.templateId,
              templateVersionId: version.id,
              cycleAnchorDate: anchor,
              applyFromDate: applyFrom,
              assignedByUserId: userId,
            },
            update: {
              templateId: assignmentInput.templateId,
              templateVersionId: version.id,
              cycleAnchorDate: anchor,
              applyFromDate: applyFrom,
              assignedByUserId: userId,
            },
          });
        }
        for (let index = 0; index < daysInMonth; index += 1) {
          const date = new Date(start.getTime() + index * DAY_MS);
          if (date < applyFrom || !membershipCovers(membership, date)) continue;
          if (
            !membership.rolePeriods.some(
              (role) => date >= role.startedOn && (!role.endedOn || date <= role.endedOn),
            )
          )
            continue;
          const offset = Math.floor((date.getTime() - anchor.getTime()) / DAY_MS);
          const cycle = version.workDays + version.offDays;
          const cycleDay = ((offset % cycle) + cycle) % cycle;
          const value: ScheduleValue | null =
            cycleDay < version.workDays
              ? {
                  kind: "SHIFT",
                  durationHours: version.durationHours,
                  shiftType: version.shiftType,
                }
              : null;
          const existing = await tx.scheduleDay.findUnique({
            where: { venueMembershipId_date: { venueMembershipId: membership.id, date } },
          });
          if (!value) {
            if (existing && !isEmpty(existing) && overwrite) {
              await this.writeCell(
                tx,
                venueId,
                userId,
                { membershipId: membership.id, date: dateKey(date), value: { kind: "EMPTY" } },
                schedule.id,
              );
              written += 1;
            } else if (existing && !isEmpty(existing)) {
              skipped += 1;
            }
            continue;
          }
          if (existing && !isEmpty(existing) && !overwrite) {
            skipped += 1;
            continue;
          }
          await this.writeCell(
            tx,
            venueId,
            userId,
            {
              membershipId: membership.id,
              date: dateKey(date),
              value,
            },
            schedule.id,
          );
          written += 1;
        }
      }
      return { written, skipped };
    });
  }

  async extend(
    companyId: string,
    venueId: string,
    userId: string,
    year: number,
    month: number,
    membershipIds: string[],
  ) {
    assertMonth(year, month);
    assertAvailableMonth(year, month);
    const uniqueMembershipIds = [...new Set(membershipIds)];
    const assignments = await this.database.scheduleAssignment.findMany({
      where: {
        venueMembershipId: { in: uniqueMembershipIds },
        membership: { companyId, venueId },
      },
      include: { membership: { include: { rolePeriods: true } } },
    });
    if (assignments.length !== uniqueMembershipIds.length) {
      throw new ConflictException(
        "Нельзя продлить график: у одного или нескольких выбранных сотрудников нет назначенного цикла. Для выбранных сотрудников график не изменён.",
      );
    }
    const values: Array<{
      membershipId: string;
      templateId: string;
      templateVersionId: string;
      cycleAnchorDate: string;
      applyFromDate: string;
    }> = [];
    const { start, daysInMonth } = monthRange(year, month);
    for (const assignment of assignments) {
      const anyInScope = Array.from(
        { length: daysInMonth },
        (_, index) => new Date(start.getTime() + index * DAY_MS),
      ).some((date) => membershipCovers(assignment.membership, date));
      if (!anyInScope) continue;
      values.push({
        membershipId: assignment.venueMembershipId,
        templateId: assignment.templateId,
        templateVersionId: assignment.templateVersionId,
        cycleAnchorDate: dateKey(assignment.cycleAnchorDate),
        applyFromDate: dateKey(assignment.applyFromDate),
      });
    }
    return this.assignAndGenerate(companyId, venueId, userId, year, month, values, false, false);
  }

  async saveComment(
    venueId: string,
    userId: string,
    membershipId: string,
    dateInput: string,
    text: string,
  ) {
    const date = parseDate(dateInput);
    assertAvailableMonth(date.getUTCFullYear(), date.getUTCMonth() + 1);
    const cleanText = text.trim();
    if (cleanText.length > 1000)
      throw new ConflictException("Комментарий не должен превышать 1000 символов");
    const [membership, actorMembership, actorChefMembership] = await Promise.all([
      this.database.venueMembership.findFirst({
        where: { id: membershipId, venueId },
        include: { rolePeriods: true, user: { include: { profile: true } } },
      }),
      this.database.venueMembership.findFirst({
        where: { userId, venueId, OR: [{ endedOn: null }, { endedOn: { gte: currentDate() } }] },
        select: { id: true },
      }),
      this.database.companyMembership.findFirst({
        where: {
          userId,
          company: { venues: { some: { id: venueId } } },
          companyRole: "CHEF_BARTENDER",
        },
        select: { id: true },
      }),
    ]);
    if (!membership || !membershipCovers(membership, date)) {
      throw new NotFoundException("Сотрудник не найден в этом заведении");
    }
    if (
      !membership.rolePeriods.some(
        (period) => date >= period.startedOn && (!period.endedOn || date <= period.endedOn),
      )
    ) {
      throw new ConflictException("День находится вне периода должности сотрудника");
    }
    if (!actorMembership && !actorChefMembership) {
      throw new NotFoundException("Пользователь не состоит в этой команде");
    }
    const schedule = await this.database.schedule.upsert({
      where: {
        venueId_year_month: { venueId, year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 },
      },
      create: { venueId, year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 },
      update: {},
    });
    return this.database.$transaction(async (tx) => {
      await tx.scheduleMemberSnapshot.createMany({
        data: [
          {
            scheduleId: schedule.id,
            venueMembershipId: membership.id,
            fullName: membership.user.profile?.fullName ?? "",
          },
        ],
        skipDuplicates: true,
      });
      await tx.$queryRaw`SELECT "id" FROM "venue_memberships" WHERE "id" = ${membershipId}::uuid FOR UPDATE`;
      const day = await tx.scheduleDay.upsert({
        where: { venueMembershipId_date: { venueMembershipId: membershipId, date } },
        create: {
          scheduleId: schedule.id,
          venueMembershipId: membershipId,
          date,
          updatedByUserId: userId,
        },
        update: { updatedByUserId: userId },
      });
      const comment = await tx.scheduleDayComment.upsert({
        where: { scheduleDayId: day.id },
        create: { scheduleDayId: day.id, text: cleanText, updatedByUserId: userId },
        update: { text: cleanText, updatedByUserId: userId },
      });
      await tx.scheduleDayCommentVersion.create({
        data: { scheduleDayId: day.id, text: cleanText, changedByUserId: userId },
      });
      return comment;
    });
  }

  private async writeCell(
    tx: Prisma.TransactionClient,
    venueId: string,
    userId: string,
    input: ScheduleCellInput,
    scheduleId?: string,
  ) {
    const date = parseDate(input.date);
    assertAvailableMonth(date.getUTCFullYear(), date.getUTCMonth() + 1);
    validateValue(input.value);
    await tx.$queryRaw`SELECT "id" FROM "venue_memberships" WHERE "id" = ${input.membershipId}::uuid FOR UPDATE`;
    const membership = await tx.venueMembership.findFirst({
      where: { id: input.membershipId, venueId },
      include: { rolePeriods: true, user: { include: { profile: true } } },
    });
    if (!membership || !membershipCovers(membership, date)) {
      throw new ConflictException("День находится за пределами периода работы сотрудника");
    }
    if (
      !membership.rolePeriods.some(
        (role) => date >= role.startedOn && (!role.endedOn || date <= role.endedOn),
      )
    ) {
      throw new ConflictException("День находится вне интервала должности сотрудника");
    }
    const month = date.getUTCMonth() + 1;
    const schedule = scheduleId
      ? await tx.schedule.findUniqueOrThrow({ where: { id: scheduleId } })
      : await tx.schedule.upsert({
          where: { venueId_year_month: { venueId, year: date.getUTCFullYear(), month } },
          create: { venueId, year: date.getUTCFullYear(), month },
          update: {},
        });
    await tx.scheduleMemberSnapshot.createMany({
      data: [
        {
          scheduleId: schedule.id,
          venueMembershipId: membership.id,
          fullName: membership.user.profile?.fullName ?? "",
        },
      ],
      skipDuplicates: true,
    });
    const key = { venueMembershipId: membership.id, date };
    const old = await tx.scheduleDay.findUnique({ where: { venueMembershipId_date: key } });
    const oldValue = old && !isEmpty(old) ? toValue(old) : null;
    const newValue = input.value.kind === "EMPTY" ? null : input.value;
    if (JSON.stringify(oldValue) === JSON.stringify(newValue) && old) return old;
    const day = await tx.scheduleDay.upsert({
      where: { venueMembershipId_date: key },
      create: {
        scheduleId: schedule.id,
        venueMembershipId: membership.id,
        date,
        updatedByUserId: userId,
        ...valueColumns(input.value),
      },
      update: { updatedByUserId: userId, ...valueColumns(input.value) },
    });
    await tx.scheduleDayChange.create({
      data: {
        scheduleDayId: day.id,
        oldValue: oldValue ? (oldValue as Prisma.InputJsonValue) : Prisma.JsonNull,
        newValue: newValue ? (newValue as Prisma.InputJsonValue) : Prisma.JsonNull,
        changedByUserId: userId,
      },
    });
    return day;
  }
}

function versionInput(input: ScheduleTemplateInput) {
  return {
    workDays: input.workDays,
    offDays: input.offDays,
    durationHours: input.durationHours,
    shiftType: input.shiftType,
  };
}

function validateTemplate(input: ScheduleTemplateInput): void {
  if (
    !Number.isInteger(input.workDays) ||
    input.workDays < 1 ||
    input.workDays > 31 ||
    !Number.isInteger(input.offDays) ||
    input.offDays < 1 ||
    input.offDays > 31 ||
    !Number.isInteger(input.durationHours) ||
    input.durationHours < 1 ||
    input.durationHours > 24 ||
    !["NORMAL", "NIGHT"].includes(input.shiftType)
  ) {
    throw new ConflictException("Проверьте параметры шаблона смен");
  }
}

function validateValue(value: ScheduleValue): void {
  if (
    value.kind === "SHIFT" &&
    (!Number.isInteger(value.durationHours) ||
      value.durationHours < 1 ||
      value.durationHours > 24 ||
      !["NORMAL", "NIGHT"].includes(value.shiftType))
  ) {
    throw new ConflictException("Проверьте длительность и тип смены");
  }
  if (value.kind === "STATUS" && !["VACATION", "SICK_LEAVE", "NO_SHOW"].includes(value.status)) {
    throw new ConflictException("Выберите допустимое обозначение дня");
  }
}

function valueColumns(value: ScheduleValue) {
  if (value.kind === "SHIFT") {
    return { shiftDurationHours: value.durationHours, shiftType: value.shiftType, status: null };
  }
  if (value.kind === "STATUS") {
    return { shiftDurationHours: null, shiftType: null, status: value.status };
  }
  return { shiftDurationHours: null, shiftType: null, status: null };
}

function toValue(day: {
  shiftDurationHours: number | null;
  shiftType: "NORMAL" | "NIGHT" | null;
  status: string | null;
}): ScheduleValue {
  if (day.shiftDurationHours !== null && day.shiftType) {
    return { kind: "SHIFT", durationHours: day.shiftDurationHours, shiftType: day.shiftType };
  }
  if (day.status) {
    if (day.status === "DAY_OFF") return { kind: "EMPTY" };
    return {
      kind: "STATUS",
      status: day.status as "VACATION" | "SICK_LEAVE" | "NO_SHOW",
    };
  }
  return { kind: "EMPTY" };
}

function isEmpty(day: { shiftDurationHours: number | null; status: string | null }): boolean {
  return day.shiftDurationHours === null && (day.status === null || day.status === "DAY_OFF");
}

function visibleHistoryValue(value: Prisma.JsonValue | null): Prisma.JsonValue | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  if (value.kind === "STATUS" && value.status === "DAY_OFF") return null;
  return value;
}

function parseDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
    throw new ConflictException("Укажите дату в формате ГГГГ-ММ-ДД");
  }
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (dateKey(date) !== value) throw new ConflictException("Указана некорректная дата");
  return date;
}

function dateKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function currentDate(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function monthRange(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { start, end: new Date(Date.UTC(year, month - 1, daysInMonth)), daysInMonth };
}

function assertMonth(year: number, month: number): void {
  if (
    !Number.isInteger(year) ||
    year < 2000 ||
    year > 2200 ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    throw new ConflictException("Укажите корректный месяц графика");
  }
}

function assertAvailableMonth(year: number, month: number): void {
  const now = new Date();
  const months = (year - now.getUTCFullYear()) * 12 + (month - 1 - now.getUTCMonth());
  if (months < -12 || months > 2) {
    throw new ConflictException("Месяц находится вне доступного диапазона графика");
  }
}

function membershipCovers(
  membership: { startedOn: Date; endedOn: Date | null },
  date: Date,
): boolean {
  return date >= membership.startedOn && (!membership.endedOn || date <= membership.endedOn);
}

function maxDate(...dates: Date[]): Date {
  return new Date(Math.max(...dates.map((date) => date.getTime())));
}

function minDate(defaultDate: Date, ...dates: (Date | null)[]): Date | null {
  const values = dates.filter((date): date is Date => date !== null);
  return values.length
    ? new Date(Math.min(defaultDate.getTime(), ...values.map((date) => date.getTime())))
    : null;
}

function roleLabel(role: string): string {
  return (
    {
      BAR_MANAGER: "Бар-менеджер",
      SENIOR_BARTENDER: "Старший бармен",
      BARTENDER: "Бармен",
      BARBACK: "Барбек",
      TRAINEE: "Стажёр",
    }[role] ?? role
  );
}
