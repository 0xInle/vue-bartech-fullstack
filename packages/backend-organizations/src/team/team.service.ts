import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  DATABASE_CLIENT,
  PermissionCode as DatabasePermissionCode,
  Prisma,
  PrismaClient,
} from "@bartech/database";
import {
  DELEGATABLE_PERMISSION_CODES,
  PermissionService,
  permissionCatalog,
  type PermissionCode,
} from "../permissions/permission.service.js";

export const venueRoles = [
  "BARTENDER",
  "SENIOR_BARTENDER",
  "BARBACK",
  "TRAINEE",
  "BAR_MANAGER",
] as const;
export type ManagedVenueRole = (typeof venueRoles)[number];

export const delegatedPermissionCodes = DELEGATABLE_PERMISSION_CODES;
export type DelegatedPermissionCode = (typeof delegatedPermissionCodes)[number];

export type UpdateTeamMemberInput = {
  role: ManagedVenueRole;
  permissions: PermissionCode[];
};

@Injectable()
export class TeamService {
  constructor(
    @Inject(DATABASE_CLIENT) private readonly database: PrismaClient,
    private readonly permissions: PermissionService,
  ) {}

  async updateMember(
    actorId: string,
    companyId: string,
    venueId: string,
    membershipId: string,
    input: UpdateTeamMemberInput,
  ): Promise<{ accepted: true }> {
    await this.database.$transaction(async (transaction) => {
      const companies = await transaction.$queryRaw<Array<{ status: string }>>`
        SELECT "status" FROM "companies" WHERE "id" = ${companyId}::uuid FOR UPDATE
      `;
      if (!companies.length) throw new NotFoundException("Команда не найдена");
      if (companies[0].status !== "ACTIVE") {
        throw new ConflictException("Компания ожидает закрытия и доступна только для просмотра");
      }
      const lockedVenues = await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "venues"
        WHERE "id" = ${venueId}::uuid
          AND "companyId" = ${companyId}::uuid
          AND "status" = 'ACTIVE'
        FOR UPDATE
      `;
      if (!lockedVenues.length) throw new NotFoundException("Команда не найдена");

      const [venue, target] = await Promise.all([
        transaction.venue.findFirst({
          where: { id: venueId, companyId, status: "ACTIVE" },
          include: {
            memberships: {
              where: { OR: [{ endedOn: null }, { endedOn: { gt: currentDate() } }] },
              include: { permissionOverrides: true, temporaryResponsibility: true },
            },
            company: {
              select: {
                memberships: {
                  where: { companyRole: "CHEF_BARTENDER" },
                  select: { userId: true },
                },
              },
            },
          },
        }),
        transaction.venueMembership.findFirst({
          where: {
            id: membershipId,
            companyId,
            venueId,
            OR: [{ endedOn: null }, { endedOn: { gt: currentDate() } }],
          },
          include: { permissionOverrides: true, temporaryResponsibility: true },
        }),
      ]);
      if (!venue || !target) throw new NotFoundException("Сотрудник не найден в этом заведении");
      if (target.userId === actorId) {
        throw new ForbiddenException(
          "Свою должность и права нельзя изменить через карточку сотрудника",
        );
      }

      const actorMembership = venue.memberships.find(({ userId }) => userId === actorId);
      const actorIsChef = venue.company.memberships.some(({ userId }) => userId === actorId);
      const hasBarManager = venue.memberships.some(({ role }) => role === "BAR_MANAGER");
      const hasChefBartender = venue.company.memberships.length > 0;
      const actorIsTemporaryResponsible = Boolean(
        actorMembership &&
        (actorMembership.role === "BARTENDER" || actorMembership.role === "SENIOR_BARTENDER") &&
        actorMembership.temporaryResponsibility &&
        !hasBarManager &&
        !hasChefBartender,
      );

      if (!actorMembership && !actorIsChef) throw new NotFoundException("Команда не найдена");
      if (actorMembership && actorIsChef) {
        throw new ConflictException("У сотрудника обнаружены несовместимые полномочия");
      }

      const actorRole = actorIsChef ? "chef_bartender" : toWorkspaceRole(actorMembership!.role);
      const actorPermissions = this.permissions.evaluate({
        role: actorRole,
        permissionOverrides: actorMembership?.permissionOverrides.map(({ code, enabled }) => ({
          code: code.toLowerCase(),
          enabled,
        })),
        temporaryResponsibility: actorIsTemporaryResponsible,
        hasBarManager,
        hasChefBartender,
      });
      if (!actorPermissions.includes("manage_team")) {
        throw new ForbiddenException("У вас нет доступа к управлению этой командой");
      }

      const actorIsBarManager = actorMembership?.role === "BAR_MANAGER";
      const targetIsBarManager = target.role === "BAR_MANAGER";
      const hadPermissionOverrides = target.permissionOverrides.length > 0;
      if (
        !actorIsBarManager &&
        !actorIsChef &&
        (!actorIsTemporaryResponsible || targetIsBarManager)
      ) {
        throw new ForbiddenException(
          "Временный ответственный не может менять должность бар-менеджера",
        );
      }

      const roleChanged = target.role !== input.role;
      if (new Set(input.permissions).size !== input.permissions.length) {
        throw new ConflictException("Разрешения не должны повторяться");
      }
      if (input.permissions.some((code) => !Object.hasOwn(permissionCatalog, code))) {
        throw new ConflictException("Выбрано недопустимое разрешение");
      }
      if (roleChanged && input.permissions.length > 0) {
        throw new ConflictException("При изменении должности разрешения сбрасываются");
      }
      const currentTargetPermissions = new Set(
        this.permissions.evaluate({
          role: toWorkspaceRole(target.role),
          permissionOverrides: target.permissionOverrides.map(({ code, enabled }) => ({
            code: code.toLowerCase(),
            enabled,
          })),
          temporaryResponsibility: Boolean(target.temporaryResponsibility),
          hasBarManager,
          hasChefBartender,
        }),
      );
      if (
        !roleChanged &&
        !actorPermissions.includes("manage_delegated_permissions") &&
        !samePermissions([...currentTargetPermissions], input.permissions)
      ) {
        throw new ForbiddenException("У вас нет доступа к изменению разрешений сотрудников");
      }

      const finalManagerCount =
        venue.memberships.filter(({ role }) => role === "BAR_MANAGER").length -
        Number(targetIsBarManager) +
        Number(input.role === "BAR_MANAGER");
      if (finalManagerCount === 0 && !hasChefBartender) {
        throw new ConflictException(
          "Сначала назначьте другого бар-менеджера или обеспечьте управление заведением",
        );
      }

      const targetRoleDefaults = new Set(
        this.permissions.evaluate({
          role: toWorkspaceRole(input.role),
          hasBarManager: input.role === "BAR_MANAGER" || hasBarManager,
          hasChefBartender,
        }),
      );
      const editablePermissions = new Set<PermissionCode>([
        ...targetRoleDefaults,
        ...(input.role === "BAR_MANAGER"
          ? []
          : DELEGATABLE_PERMISSION_CODES.filter(
              (code) => code !== "manage_schedule" || input.role === "SENIOR_BARTENDER",
            )),
      ]);
      if (
        !roleChanged &&
        input.permissions.some(
          (code) => !editablePermissions.has(code) && !currentTargetPermissions.has(code),
        )
      ) {
        throw new ConflictException("Разрешение нельзя назначить этой должности");
      }
      const permissionsToGrant = input.permissions.filter(
        (code) => !targetRoleDefaults.has(code) && !currentTargetPermissions.has(code),
      );
      if (permissionsToGrant.some((code) => !actorPermissions.includes(code))) {
        throw new ForbiddenException("Нельзя выдать право, которого нет у вас");
      }
      if (!roleChanged && actorIsTemporaryResponsible) {
        const currentPermissions = this.permissions.evaluate({
          role: toWorkspaceRole(target.role),
          permissionOverrides: target.permissionOverrides.map(({ code, enabled }) => ({
            code: code.toLowerCase(),
            enabled,
          })),
          temporaryResponsibility: actorIsTemporaryResponsible,
          hasBarManager,
          hasChefBartender,
        });
        if (
          currentPermissions.includes("delete_products_permanently") !==
          input.permissions.includes("delete_products_permanently")
        ) {
          throw new ForbiddenException(
            "Временный ответственный не может менять право безвозвратного удаления",
          );
        }
      }

      if (roleChanged) {
        const today = currentDate();
        const activeRolePeriod = await transaction.venueRolePeriod.findFirst({
          where: { venueMembershipId: target.id, endedOn: null },
          orderBy: { startedOn: "desc" },
        });
        if (!activeRolePeriod)
          throw new ConflictException("Не найдена история должности сотрудника");
        if (activeRolePeriod.startedOn > today) {
          await transaction.venueRolePeriod.update({
            where: { id: activeRolePeriod.id },
            data: { role: input.role, changedByUserId: actorId },
          });
        } else {
          await transaction.venueRolePeriod.update({
            where: { id: activeRolePeriod.id },
            data: { endedOn: today },
          });
          await transaction.venueRolePeriod.create({
            data: {
              venueMembershipId: target.id,
              role: input.role,
              startedOn: today,
              changedByUserId: actorId,
            },
          });
        }
        await transaction.venueMembership.update({
          where: { id: target.id },
          data: { role: input.role },
        });
      }

      await transaction.venuePermissionOverride.deleteMany({
        where: { venueMembershipId: target.id },
      });
      const permissionOverrides = roleChanged
        ? []
        : [...editablePermissions]
            .map((code) => ({ code, enabled: input.permissions.includes(code) }))
            .filter(({ code, enabled }) => enabled !== targetRoleDefaults.has(code));
      if (permissionOverrides.length) {
        await transaction.venuePermissionOverride.createMany({
          data: permissionOverrides.map(({ code, enabled }) => ({
            venueMembershipId: target.id,
            code: code.toUpperCase() as DatabasePermissionCode,
            enabled,
            changedByUserId: actorId,
          })),
        });
      }

      if (roleChanged) {
        await transaction.auditEvent.create({
          data: {
            eventType: "membership.role_changed",
            actorType: "USER",
            actorId,
            companyId,
            venueId,
            entityType: "venue_membership",
            entityId: target.id,
            metadata: {
              previousRole: target.role,
              newRole: input.role,
              subjectUserId: target.userId,
            },
          },
        });
      }

      const targetVenueMembership = venue.memberships.find(({ id }) => id === target.id);
      if (
        roleChanged &&
        (input.role === "BARBACK" || input.role === "TRAINEE") &&
        targetVenueMembership?.temporaryResponsibility
      ) {
        await transaction.temporaryResponsibility.deleteMany({
          where: { venueMembershipId: target.id },
        });
        await transaction.auditEvent.create({
          data: {
            eventType: "temporary_responsibility.ended",
            actorType: "USER",
            actorId,
            companyId,
            venueId,
            entityType: "venue_membership",
            entityId: target.id,
            metadata: { subjectUserId: target.userId },
          },
        });
      }

      if (roleChanged || hadPermissionOverrides || permissionOverrides.length) {
        await transaction.auditEvent.create({
          data: {
            eventType: "membership.permission_overrides_changed",
            actorType: "USER",
            actorId,
            companyId,
            venueId,
            entityType: "venue_membership",
            entityId: target.id,
            metadata: {
              permissions: input.permissions,
              subjectUserId: target.userId,
            },
          },
        });
      }

      if (
        input.role === "BAR_MANAGER" &&
        roleChanged &&
        venue.memberships.some(({ temporaryResponsibility }) => temporaryResponsibility)
      ) {
        const temporaryMembership = venue.memberships.find(({ temporaryResponsibility }) =>
          Boolean(temporaryResponsibility),
        );
        await transaction.temporaryResponsibility.deleteMany({ where: { venueId } });
        if (temporaryMembership) {
          await transaction.auditEvent.create({
            data: {
              eventType: "temporary_responsibility.ended",
              actorType: "USER",
              actorId,
              companyId,
              venueId,
              entityType: "venue_membership",
              entityId: temporaryMembership.id,
              metadata: { subjectUserId: temporaryMembership.userId },
            },
          });
        }
      }
    });

    return { accepted: true };
  }

  async endMembership(
    actorId: string,
    companyId: string,
    venueId: string,
    membershipId: string,
    terminationDateInput: string,
  ): Promise<{ accepted: true }> {
    const terminationDate = parseDate(terminationDateInput);
    await this.database.$transaction(async (transaction) => {
      const lockedVenues = await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "venues"
        WHERE "id" = ${venueId}::uuid AND "companyId" = ${companyId}::uuid AND "status" = 'ACTIVE'
        FOR UPDATE
      `;
      if (!lockedVenues.length) throw new NotFoundException("Команда не найдена");
      const venue = await transaction.venue.findFirst({
        where: { id: venueId, companyId, status: "ACTIVE", company: { status: "ACTIVE" } },
        include: {
          memberships: {
            where: { OR: [{ endedOn: null }, { endedOn: { gt: currentDate() } }] },
            include: {
              permissionOverrides: true,
              temporaryResponsibility: true,
              rolePeriods: true,
            },
          },
          company: { select: { memberships: { select: { userId: true, companyRole: true } } } },
        },
      });
      const target = await transaction.venueMembership.findFirst({
        where: {
          id: membershipId,
          companyId,
          venueId,
          OR: [{ endedOn: null }, { endedOn: { gt: currentDate() } }],
        },
        include: { rolePeriods: { orderBy: { startedOn: "asc" } } },
      });
      if (!venue || !target) throw new NotFoundException("Сотрудник не найден в этом заведении");
      await transaction.$queryRaw`SELECT "id" FROM "venue_memberships" WHERE "id" = ${target.id}::uuid FOR UPDATE`;
      if (target.userId === actorId) {
        throw new ForbiddenException(
          "Нельзя завершить собственный период через управление командой",
        );
      }
      if (terminationDate < target.startedOn) {
        throw new ConflictException("Дата увольнения не может быть раньше начала членства");
      }
      if (terminationDate < currentDate()) {
        throw new ConflictException("Дата увольнения не может быть в прошлом");
      }
      const actorMembership = venue.memberships.find(({ userId }) => userId === actorId);
      const actorCompanyMembership = venue.company.memberships.find(
        ({ userId }) => userId === actorId,
      );
      const hasBarManager = venue.memberships.some(({ role }) => role === "BAR_MANAGER");
      const actorRole = actorCompanyMembership?.companyRole
        ? "chef_bartender"
        : actorMembership
          ? toWorkspaceRole(actorMembership.role)
          : null;
      const actorPermissions = actorRole
        ? this.permissions.evaluate({
            role: actorRole,
            permissionOverrides: actorMembership?.permissionOverrides.map(({ code, enabled }) => ({
              code: code.toLowerCase(),
              enabled,
            })),
            temporaryResponsibility: Boolean(actorMembership?.temporaryResponsibility),
            hasBarManager,
            hasChefBartender: venue.company.memberships.some(
              ({ companyRole }) => companyRole === "CHEF_BARTENDER",
            ),
          })
        : [];
      if (!actorPermissions.includes("manage_team")) {
        throw new ForbiddenException("У вас нет доступа к управлению этой командой");
      }
      const rolePeriod = target.rolePeriods.find(
        (period) =>
          period.startedOn <= terminationDate &&
          (!period.endedOn || period.endedOn >= terminationDate),
      );
      if (!rolePeriod) {
        throw new ConflictException("Дата увольнения должна попадать в период должности");
      }
      if (target.rolePeriods.some((period) => period.startedOn > terminationDate)) {
        throw new ConflictException(
          "Нельзя завершить членство до начала сохранённого периода должности: история должностей должна остаться неизменной",
        );
      }
      this.assertManagementContinuity(venue, target.id, terminationDate);
      await transaction.venueMembership.update({
        where: { id: target.id },
        data: { endedOn: terminationDate },
      });
      await transaction.venueRolePeriod.updateMany({
        where: {
          venueMembershipId: target.id,
          startedOn: { lte: terminationDate },
          OR: [{ endedOn: null }, { endedOn: { gte: terminationDate } }],
        },
        data: { endedOn: terminationDate, changedByUserId: actorId },
      });
      const futureScheduleDays = await transaction.scheduleDay.findMany({
        where: {
          venueMembershipId: target.id,
          date: { gte: terminationDate },
          OR: [{ shiftDurationHours: { not: null } }, { status: { not: null } }],
        },
      });
      for (const day of futureScheduleDays) {
        const oldValue = day.shiftDurationHours
          ? {
              kind: "SHIFT",
              durationHours: day.shiftDurationHours,
              shiftType: day.shiftType,
            }
          : day.status
            ? { kind: "STATUS", status: day.status }
            : null;
        await transaction.scheduleDay.update({
          where: { id: day.id },
          data: {
            shiftDurationHours: null,
            shiftType: null,
            status: null,
            updatedByUserId: actorId,
          },
        });
        await transaction.scheduleDayChange.create({
          data: {
            scheduleDayId: day.id,
            oldValue: oldValue as Prisma.InputJsonValue,
            newValue: Prisma.JsonNull,
            changedByUserId: actorId,
          },
        });
      }
      await transaction.auditEvent.create({
        data: {
          eventType: "membership.ended",
          actorType: "USER",
          actorId,
          companyId,
          venueId,
          entityType: "venue_membership",
          entityId: target.id,
          metadata: { subjectUserId: target.userId, terminationDate: terminationDateInput },
        },
      });
    });
    return { accepted: true };
  }

  private assertManagementContinuity(
    venue: {
      memberships: Array<{
        id: string;
        role: ManagedVenueRole;
        startedOn: Date;
        endedOn: Date | null;
        rolePeriods: Array<{ role: ManagedVenueRole; startedOn: Date; endedOn: Date | null }>;
        temporaryResponsibility: unknown;
      }>;
      company: { memberships: Array<{ companyRole: string | null }> };
    },
    targetId: string,
    terminationDate: Date,
  ): void {
    const departures = new Map<string, Date>();
    for (const member of venue.memberships) {
      if (member.endedOn) departures.set(member.id, member.endedOn);
    }
    departures.set(targetId, terminationDate);
    const uniqueDates = new Map<string, Date>();
    for (const date of departures.values()) uniqueDates.set(dateKey(date), date);
    const dates = [...uniqueDates.values()]
      .filter((date) => date >= currentDate())
      .sort((first, second) => first.getTime() - second.getTime());
    const hasChef = venue.company.memberships.some(
      ({ companyRole }) => companyRole === "CHEF_BARTENDER",
    );

    for (const date of dates) {
      const remaining = venue.memberships.filter((member) => {
        const departure = departures.get(member.id);
        return member.startedOn <= date && (!departure || departure > date);
      });
      const hasManager = remaining.some((member) =>
        member.rolePeriods.some(
          ({ role, startedOn, endedOn }) =>
            role === "BAR_MANAGER" && startedOn <= date && (!endedOn || endedOn > date),
        ),
      );
      const hasTemporaryResponsible = remaining.some((member) => member.temporaryResponsibility);
      if (!remaining.length || (!hasManager && !hasChef && !hasTemporaryResponsible)) {
        throw new ConflictException(
          "Сначала назначьте другого бар-менеджера, шеф-бармена или временно ответственного сотрудника на весь период",
        );
      }
    }
  }
}

function samePermissions(first: readonly string[], second: readonly string[]): boolean {
  return first.length === second.length && first.every((code) => second.includes(code));
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toWorkspaceRole(role: ManagedVenueRole): "bartender" | "senior_bartender" | "bar_manager" {
  switch (role) {
    case "BARTENDER":
    case "BARBACK":
    case "TRAINEE":
      return "bartender";
    case "SENIOR_BARTENDER":
      return "senior_bartender";
    case "BAR_MANAGER":
      return "bar_manager";
  }
}

function currentDate(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function parseDate(value: string): Date {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw new ConflictException("Укажите корректный первый нерабочий день");
  }
  return date;
}
