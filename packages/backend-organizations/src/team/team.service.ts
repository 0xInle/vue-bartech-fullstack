import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { DATABASE_CLIENT, PrismaClient } from "@bartech/database";
import {
  DELEGATABLE_PERMISSION_CODES,
  PermissionService,
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

const delegatedPermissionToDatabaseCode = {
  manage_products: "MANAGE_PRODUCTS",
  manage_product_archive: "MANAGE_PRODUCT_ARCHIVE",
  delete_products_permanently: "DELETE_PRODUCTS_PERMANENTLY",
  export_data: "EXPORT_DATA",
  invite_employees: "INVITE_EMPLOYEES",
  manage_schedule: "MANAGE_SCHEDULE",
} as const;

export type UpdateTeamMemberInput = {
  role: ManagedVenueRole;
  delegatedPermissions: DelegatedPermissionCode[];
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
    if (input.delegatedPermissions.some((code) => !delegatedPermissionCodes.includes(code))) {
      throw new ConflictException("Выбрано недопустимое дополнительное право");
    }
    if (
      input.delegatedPermissions.includes("manage_schedule") &&
      input.role !== "SENIOR_BARTENDER"
    ) {
      throw new ConflictException("Управление графиком можно делегировать только старшему бармену");
    }

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
              where: { OR: [{ endedOn: null }, { endedOn: { gte: currentDate() } }] },
              include: { delegatedPermissions: true, temporaryResponsibility: true },
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
            OR: [{ endedOn: null }, { endedOn: { gte: currentDate() } }],
          },
          include: { delegatedPermissions: true },
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
        delegatedPermissions: actorMembership?.delegatedPermissions.map(({ code }) =>
          code.toLowerCase(),
        ),
        temporaryResponsibility: actorIsTemporaryResponsible,
        hasBarManager,
        hasChefBartender,
      });
      if (!actorPermissions.includes("manage_team")) {
        throw new ForbiddenException("У вас нет доступа к управлению этой командой");
      }

      const actorIsBarManager = actorMembership?.role === "BAR_MANAGER";
      const targetIsBarManager = target.role === "BAR_MANAGER";
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
      const existingPermissions = target.delegatedPermissions.map(
        ({ code }) => code.toLowerCase() as DelegatedPermissionCode,
      );
      if (
        actorIsTemporaryResponsible &&
        existingPermissions.includes("delete_products_permanently") !==
          input.delegatedPermissions.includes("delete_products_permanently")
      ) {
        throw new ForbiddenException(
          "Временный ответственный не может менять право безвозвратного удаления",
        );
      }
      if (!roleChanged && targetIsBarManager && input.delegatedPermissions.length > 0) {
        throw new ConflictException("Бар-менеджеру нельзя назначить дополнительные права");
      }
      if (
        !roleChanged &&
        !actorPermissions.includes("manage_delegated_permissions") &&
        !samePermissions(existingPermissions, input.delegatedPermissions)
      ) {
        throw new ForbiddenException("У вас нет доступа к изменению дополнительных прав");
      }
      if (roleChanged && input.delegatedPermissions.length > 0) {
        throw new ConflictException("При изменении должности дополнительные права сбрасываются");
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

      const permissionsToRevoke = roleChanged
        ? existingPermissions
        : existingPermissions.filter((code) => !input.delegatedPermissions.includes(code));
      const permissionsToGrant = roleChanged
        ? []
        : input.delegatedPermissions.filter((code) => !existingPermissions.includes(code));

      if (permissionsToGrant.some((code) => !actorPermissions.includes(code))) {
        throw new ForbiddenException("Нельзя выдать право, которого нет у вас");
      }

      if (roleChanged) {
        const today = currentDate();
        const activeRolePeriod = await transaction.venueRolePeriod.findFirst({
          where: { venueMembershipId: target.id, endedOn: null },
          orderBy: { startedOn: "desc" },
        });
        if (!activeRolePeriod)
          throw new ConflictException("Не найдена история должности сотрудника");
        if (activeRolePeriod.startedOn >= today) {
          await transaction.venueRolePeriod.update({
            where: { id: activeRolePeriod.id },
            data: { role: input.role, changedByUserId: actorId },
          });
        } else {
          await transaction.venueRolePeriod.update({
            where: { id: activeRolePeriod.id },
            data: { endedOn: previousDate(today) },
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

      if (permissionsToRevoke.length) {
        await transaction.delegatedPermission.deleteMany({
          where: {
            venueMembershipId: target.id,
            code: {
              in: permissionsToRevoke.map((code) => delegatedPermissionToDatabaseCode[code]),
            },
          },
        });
      }

      if (permissionsToGrant.length) {
        await transaction.delegatedPermission.createMany({
          data: permissionsToGrant.map((code) => ({
            venueMembershipId: target.id,
            code: delegatedPermissionToDatabaseCode[code],
            grantedByUserId: actorId,
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

      if (permissionsToGrant.length || permissionsToRevoke.length) {
        await transaction.auditEvent.create({
          data: {
            eventType: "membership.delegated_permissions_changed",
            actorType: "USER",
            actorId,
            companyId,
            venueId,
            entityType: "venue_membership",
            entityId: target.id,
            metadata: {
              granted: permissionsToGrant,
              revoked: permissionsToRevoke,
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
    lastWorkingDayInput: string,
  ): Promise<{ accepted: true }> {
    const lastWorkingDay = parseDate(lastWorkingDayInput);
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
            where: { OR: [{ endedOn: null }, { endedOn: { gte: currentDate() } }] },
            include: { delegatedPermissions: true, temporaryResponsibility: true },
          },
          company: { select: { memberships: { select: { userId: true, companyRole: true } } } },
        },
      });
      const target = await transaction.venueMembership.findFirst({
        where: {
          id: membershipId,
          companyId,
          venueId,
          OR: [{ endedOn: null }, { endedOn: { gte: currentDate() } }],
        },
        include: { rolePeriods: { orderBy: { startedOn: "asc" } } },
      });
      if (!venue || !target) throw new NotFoundException("Сотрудник не найден в этом заведении");
      if (target.userId === actorId) {
        throw new ForbiddenException(
          "Нельзя завершить собственный период через управление командой",
        );
      }
      if (lastWorkingDay < target.startedOn) {
        throw new ConflictException("Последний рабочий день не может быть раньше начала членства");
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
            delegatedPermissions: actorMembership?.delegatedPermissions.map(({ code }) =>
              code.toLowerCase(),
            ),
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
          period.startedOn <= lastWorkingDay &&
          (!period.endedOn || period.endedOn >= lastWorkingDay),
      );
      if (!rolePeriod) {
        throw new ConflictException("Последний рабочий день должен попадать в период должности");
      }
      if (target.rolePeriods.some((period) => period.startedOn > lastWorkingDay)) {
        throw new ConflictException(
          "Нельзя завершить членство до начала сохранённого периода должности: история должностей должна остаться неизменной",
        );
      }
      if (
        rolePeriod.role === "BAR_MANAGER" &&
        lastWorkingDay >= currentDate() &&
        !venue.memberships.some(({ id, role }) => id !== target.id && role === "BAR_MANAGER") &&
        !venue.company.memberships.some(({ companyRole }) => companyRole === "CHEF_BARTENDER")
      ) {
        throw new ConflictException(
          "Сначала назначьте другого бар-менеджера или обеспечьте управление заведением",
        );
      }
      await transaction.venueMembership.update({
        where: { id: target.id },
        data: { endedOn: lastWorkingDay },
      });
      await transaction.venueRolePeriod.update({
        where: { id: rolePeriod.id },
        data: { endedOn: lastWorkingDay, changedByUserId: actorId },
      });
      await transaction.delegatedPermission.deleteMany({ where: { venueMembershipId: target.id } });
      await transaction.temporaryResponsibility.deleteMany({
        where: { venueMembershipId: target.id },
      });
      await transaction.auditEvent.create({
        data: {
          eventType: "membership.ended",
          actorType: "USER",
          actorId,
          companyId,
          venueId,
          entityType: "venue_membership",
          entityId: target.id,
          metadata: { subjectUserId: target.userId, lastWorkingDay: lastWorkingDayInput },
        },
      });
    });
    return { accepted: true };
  }
}

function samePermissions(first: readonly string[], second: readonly string[]): boolean {
  return first.length === second.length && first.every((code) => second.includes(code));
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

function previousDate(date: Date): Date {
  return new Date(date.getTime() - 86_400_000);
}

function parseDate(value: string): Date {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw new ConflictException("Укажите корректный последний рабочий день");
  }
  return date;
}
