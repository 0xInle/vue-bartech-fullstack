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
  BAR_MANAGER_PERMISSIONS,
  DELEGATABLE_PERMISSION_CODES,
  VENUE_PERMISSION_CODES,
  PermissionService,
  isVenuePermission,
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
  hasFullManagementPackage?: boolean;
};
export type AddExistingMemberInput = {
  userId: string;
  role: "BAR_MANAGER" | "SENIOR_BARTENDER" | "BARTENDER";
};

@Injectable()
export class TeamService {
  constructor(
    @Inject(DATABASE_CLIENT) private readonly database: PrismaClient,
    private readonly permissions: PermissionService,
  ) {}

  async addExistingMember(
    actorId: string,
    companyId: string,
    venueId: string,
    input: AddExistingMemberInput,
  ): Promise<{ accepted: true }> {
    await this.database.$transaction(async (transaction) => {
      const lockedCompany = await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "companies" WHERE "id" = ${companyId}::uuid AND "status" = 'ACTIVE' FOR UPDATE
      `;
      if (!lockedCompany.length) throw new NotFoundException("Заведение недоступно");
      const lockedVenue = await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "venues" WHERE "id" = ${venueId}::uuid AND "companyId" = ${companyId}::uuid AND "status" = 'ACTIVE' FOR UPDATE
      `;
      if (!lockedVenue.length) throw new NotFoundException("Заведение недоступно");
      const [actorCompany, actorVenue, targetCompany, existingVenue] = await Promise.all([
        transaction.companyMembership.findFirst({
          where: {
            userId: actorId,
            companyId,
            OR: [{ endedOn: null }, { endedOn: { gt: currentDate() } }],
          },
        }),
        transaction.venueMembership.findFirst({
          where: { companyId, venueId, userId: actorId, endedOn: null },
        }),
        transaction.companyMembership.findFirst({
          where: {
            userId: input.userId,
            companyId,
            OR: [{ endedOn: null }, { endedOn: { gt: currentDate() } }],
          },
        }),
        transaction.venueMembership.findFirst({
          where: {
            companyId,
            venueId,
            userId: input.userId,
            OR: [{ endedOn: null }, { endedOn: { gt: currentDate() } }],
          },
        }),
      ]);
      if (!targetCompany || targetCompany.companyRole) {
        throw new NotFoundException("Сотрудник компании не найден");
      }
      if (existingVenue) throw new ConflictException("Сотрудник уже добавлен в это заведение");
      const isChef = actorCompany?.companyRole === "CHEF_BARTENDER";
      const canManage = Boolean(
        isChef || actorVenue?.role === "BAR_MANAGER" || actorVenue?.hasFullManagementPackage,
      );
      if (!canManage) throw new ForbiddenException("У вас нет доступа к управлению заведением");
      const today = currentDate();
      const membership = await transaction.venueMembership.create({
        data: {
          companyId,
          venueId,
          userId: input.userId,
          role: input.role,
          hasFullManagementPackage: input.role === "BAR_MANAGER",
          ...(input.role === "BAR_MANAGER"
            ? { fullManagementChangedAt: new Date(), fullManagementChangedByUserId: actorId }
            : {}),
          startedOn: today,
        },
      });
      await transaction.venueRolePeriod.create({
        data: {
          venueMembershipId: membership.id,
          role: input.role,
          startedOn: today,
          changedByUserId: actorId,
          reason: "DIRECT_COMPANY_MEMBER_ADD",
        },
      });
      if (input.role === "BAR_MANAGER") {
        await transaction.company.update({
          where: { id: companyId },
          data: { managementRoleEverPresent: true },
        });
      }
      await transaction.auditEvent.create({
        data: {
          eventType: "membership.added_from_company",
          actorType: "USER",
          actorId,
          companyId,
          venueId,
          entityType: "venue_membership",
          entityId: membership.id,
          metadata: { subjectUserId: input.userId, role: input.role },
        },
      });
    });
    return { accepted: true };
  }

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
              include: {
                permissionOverrides: true,
                user: { include: { profile: true } },
              },
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
          include: {
            permissionOverrides: true,
            user: { include: { profile: true } },
          },
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
      const actorHasFullPackage = Boolean(actorMembership?.hasFullManagementPackage);
      if (!actorMembership && !actorIsChef) throw new NotFoundException("Команда не найдена");
      if (actorMembership && actorIsChef) {
        throw new ConflictException("У сотрудника обнаружены несовместимые полномочия");
      }
      const actorIsBarManager = actorMembership?.role === "BAR_MANAGER";
      if (!actorIsBarManager && !actorIsChef && !actorHasFullPackage) {
        throw new ForbiddenException("У вас нет доступа к управлению этой командой");
      }

      const actorRole = actorIsChef ? "chef_bartender" : toWorkspaceRole(actorMembership!.role);
      const actorPermissions = this.permissions.evaluate({
        role: actorRole,
        permissionOverrides: actorMembership?.permissionOverrides.map(({ code, enabled }) => ({
          code: code.toLowerCase(),
          enabled,
        })),
        hasBarManager,
        hasChefBartender,
        fullVenueManagement: actorHasFullPackage,
      });
      if (!actorPermissions.includes("manage_team")) {
        throw new ForbiddenException("У вас нет доступа к управлению этой командой");
      }

      const targetIsBarManager = target.role === "BAR_MANAGER";
      const hadPermissionOverrides = target.permissionOverrides.length > 0;
      const roleChanged = target.role !== input.role;
      if (new Set(input.permissions).size !== input.permissions.length) {
        throw new ConflictException("Разрешения не должны повторяться");
      }
      if (input.permissions.some((code) => !Object.hasOwn(permissionCatalog, code))) {
        throw new ConflictException("Выбрано недопустимое разрешение");
      }
      if (input.permissions.some((code) => !isVenuePermission(code))) {
        throw new ConflictException(
          "Через локальные настройки можно назначить только права заведения",
        );
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
          hasBarManager,
          hasChefBartender,
        }),
      );
      const changedPermissionCodes = roleChanged
        ? []
        : VENUE_PERMISSION_CODES.filter(
            (code) => currentTargetPermissions.has(code) !== input.permissions.includes(code),
          );
      const permissionsChanged = changedPermissionCodes.length > 0;
      const packageChanged =
        input.hasFullManagementPackage !== undefined &&
        input.hasFullManagementPackage !== target.hasFullManagementPackage;
      if (packageChanged && !actorPermissions.includes("manage_delegated_permissions")) {
        throw new ForbiddenException("У вас нет доступа к передаче полного набора прав");
      }
      if (packageChanged && !actorIsBarManager && !actorIsChef && !actorHasFullPackage) {
        throw new ForbiddenException("Полный набор прав может передавать только управляющий");
      }
      if (packageChanged && !input.hasFullManagementPackage) {
        if (target.role === "BAR_MANAGER") {
          throw new ConflictException("Права бар-менеджера нельзя отозвать без смены должности");
        }
        const anotherHolder = venue.memberships.some(
          (member) =>
            member.id !== target.id &&
            (member.role === "BAR_MANAGER" || member.hasFullManagementPackage),
        );
        if (!anotherHolder && !actorIsChef) {
          throw new ConflictException(
            "Перед отзывом полного набора прав назначьте другого управляющего",
          );
        }
      }
      if (permissionsChanged && !actorIsBarManager && !actorIsChef && !actorHasFullPackage) {
        throw new ForbiddenException("Персональные разрешения может менять только управляющий");
      }
      if (
        !roleChanged &&
        !actorPermissions.includes("manage_delegated_permissions") &&
        permissionsChanged
      ) {
        throw new ForbiddenException("У вас нет доступа к изменению разрешений сотрудников");
      }

      const finalManagerCount =
        venue.memberships.filter(({ role }) => role === "BAR_MANAGER").length -
        Number(targetIsBarManager) +
        Number(input.role === "BAR_MANAGER");
      if (finalManagerCount === 0 && !hasChefBartender) {
        const anotherHolder = venue.memberships.some(
          (member) =>
            member.id !== target.id &&
            (member.role === "BAR_MANAGER" || member.hasFullManagementPackage),
        );
        if (
          !anotherHolder &&
          !target.hasFullManagementPackage &&
          input.hasFullManagementPackage !== true
        ) {
          throw new ConflictException(
            "Сначала назначьте другого управляющего или передайте полный набор прав",
          );
        }
      }

      const targetRoleDefaults = new Set(
        this.permissions.evaluate({
          role: toWorkspaceRole(input.role),
          hasBarManager: input.role === "BAR_MANAGER" || hasBarManager,
          hasChefBartender,
        }),
      );
      const nextTargetPermissions = roleChanged ? targetRoleDefaults : new Set(input.permissions);
      const auditedPermissionChanges = VENUE_PERMISSION_CODES.filter(
        (code) => currentTargetPermissions.has(code) !== nextTargetPermissions.has(code),
      );
      const editablePermissions = new Set<PermissionCode>([
        ...(actorIsBarManager || actorIsChef || actorHasFullPackage
          ? VENUE_PERMISSION_CODES
          : [...targetRoleDefaults].filter(isVenuePermission)),
      ]);
      const permissionsManagedByActor =
        actorIsBarManager || actorIsChef || actorHasFullPackage ? VENUE_PERMISSION_CODES : [];
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
          data: {
            role: input.role,
            ...(input.role === "BAR_MANAGER"
              ? {
                  hasFullManagementPackage: true,
                  fullManagementChangedAt: new Date(),
                  fullManagementChangedByUserId: actorId,
                }
              : {}),
          },
        });
        if (input.role === "BAR_MANAGER") {
          await transaction.company.update({
            where: { id: companyId },
            data: { managementRoleEverPresent: true },
          });
        }
      }

      if (packageChanged) {
        await transaction.venueMembership.update({
          where: { id: target.id },
          data: {
            hasFullManagementPackage: input.hasFullManagementPackage,
            fullManagementChangedAt: new Date(),
            fullManagementChangedByUserId: actorId,
          },
        });
        if (input.hasFullManagementPackage) {
          await transaction.company.update({
            where: { id: companyId },
            data: { authorityTransferredEver: true },
          });
        }
        await transaction.auditEvent.create({
          data: {
            eventType: input.hasFullManagementPackage
              ? "membership.full_management_granted"
              : "membership.full_management_revoked",
            actorType: "USER",
            actorId,
            companyId,
            venueId,
            entityType: "venue_membership",
            entityId: target.id,
            metadata: { subjectUserId: target.userId, subjectName: target.user.profile?.fullName },
          },
        });
      }

      const permissionOverrides = roleChanged
        ? []
        : permissionsManagedByActor.length
          ? [...permissionsManagedByActor]
              .map((code) => ({ code, enabled: input.permissions.includes(code) }))
              .filter(({ code, enabled }) => enabled !== targetRoleDefaults.has(code))
          : [];
      if (
        roleChanged ||
        ((actorIsBarManager || actorIsChef || actorHasFullPackage) &&
          (hadPermissionOverrides || permissionOverrides.length))
      ) {
        await transaction.venuePermissionOverride.deleteMany({
          where: { venueMembershipId: target.id },
        });
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
              subjectName: target.user.profile?.fullName,
            },
          },
        });
      }

      if (
        roleChanged ||
        ((actorIsBarManager || actorIsChef || actorHasFullPackage) &&
          (hadPermissionOverrides || permissionOverrides.length))
      ) {
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
              granted: auditedPermissionChanges.filter((code) => nextTargetPermissions.has(code)),
              revoked: auditedPermissionChanges.filter((code) => !nextTargetPermissions.has(code)),
              subjectUserId: target.userId,
              subjectName: target.user.profile?.fullName,
            },
          },
        });
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
              rolePeriods: true,
            },
          },
          company: {
            select: {
              memberships: {
                where: { companyRole: "CHEF_BARTENDER" },
                select: { userId: true, companyRole: true },
              },
            },
          },
        },
      });
      const target = await transaction.venueMembership.findFirst({
        where: {
          id: membershipId,
          companyId,
          venueId,
          OR: [{ endedOn: null }, { endedOn: { gt: currentDate() } }],
        },
        include: {
          rolePeriods: { orderBy: { startedOn: "asc" } },
          user: { include: { profile: true } },
        },
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
      const hasChefBartender = venue.company.memberships.length > 0;
      const actorIsChef = Boolean(actorCompanyMembership);
      if (!actorMembership && !actorIsChef) throw new NotFoundException("Команда не найдена");
      if (actorMembership && actorIsChef) {
        throw new ConflictException("У сотрудника обнаружены несовместимые полномочия");
      }
      const actorIsBarManager = actorMembership?.role === "BAR_MANAGER";
      const actorHasFullPackage = Boolean(actorMembership?.hasFullManagementPackage);
      if (!actorIsBarManager && !actorIsChef && !actorHasFullPackage) {
        throw new ForbiddenException("У вас нет доступа к управлению этой командой");
      }
      const actorPermissions = this.permissions.evaluate({
        role: actorIsChef ? "chef_bartender" : toWorkspaceRole(actorMembership!.role),
        permissionOverrides: actorMembership?.permissionOverrides.map(({ code, enabled }) => ({
          code: code.toLowerCase(),
          enabled,
        })),
        hasChefBartender,
        fullVenueManagement: actorHasFullPackage,
      });
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
              shiftCode: day.shiftCode,
              startMinute: day.shiftStartMinute,
            }
          : day.status
            ? { kind: "STATUS", status: day.status }
            : null;
        await transaction.scheduleDay.update({
          where: { id: day.id },
          data: {
            shiftDurationHours: null,
            shiftCode: null,
            shiftStartMinute: null,
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
          metadata: {
            subjectUserId: target.userId,
            subjectName: target.user.profile?.fullName,
            subjectRole: target.role,
            terminationDate: terminationDateInput,
          },
        },
      });
    });
    return { accepted: true };
  }

  async leaveVenue(
    userId: string,
    companyId: string,
    venueId: string,
    confirmationName: string,
  ): Promise<{ accepted: true }> {
    const leaveDate = currentDate();
    await this.database.$transaction(async (transaction) => {
      const lockedVenues = await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "venues"
        WHERE "id" = ${venueId}::uuid AND "companyId" = ${companyId}::uuid AND "status" = 'ACTIVE'
        FOR UPDATE
      `;
      if (!lockedVenues.length) throw new NotFoundException("Заведение недоступно");
      const venue = await transaction.venue.findFirst({
        where: { id: venueId, companyId, status: "ACTIVE", company: { status: "ACTIVE" } },
        include: {
          memberships: {
            where: { OR: [{ endedOn: null }, { endedOn: { gt: leaveDate } }] },
            include: {
              permissionOverrides: true,
              rolePeriods: true,
              user: { include: { profile: true } },
            },
          },
          company: {
            select: {
              memberships: {
                where: { companyRole: "CHEF_BARTENDER" },
                select: { userId: true, companyRole: true },
              },
            },
          },
        },
      });
      if (!venue) throw new NotFoundException("Заведение недоступно");
      if (venue.name !== confirmationName) {
        throw new ConflictException("Название заведения не совпадает");
      }

      const membership = venue.memberships.find(({ userId: memberId }) => memberId === userId);
      if (!membership) throw new NotFoundException("Вы не состоите в этом заведении");
      if (venue.company.memberships.some(({ userId: memberId }) => memberId === userId)) {
        throw new ConflictException("У сотрудника обнаружены несовместимые полномочия");
      }
      if (
        membership.role !== "BAR_MANAGER" &&
        membership.role !== "BARTENDER" &&
        membership.role !== "SENIOR_BARTENDER"
      ) {
        throw new ForbiddenException("Вы не можете самостоятельно покинуть это заведение");
      }
      if (venue.memberships.length === 1) {
        throw new ConflictException(
          "Вы последний сотрудник. Используйте действие «Покинуть и закрыть заведение»",
        );
      }
      if (membership.rolePeriods.some(({ startedOn }) => startedOn > leaveDate)) {
        throw new ConflictException(
          "Нельзя покинуть заведение до начала сохранённого периода должности",
        );
      }

      if (membership.role === "BAR_MANAGER" || membership.hasFullManagementPackage) {
        this.assertManagementContinuity(venue, membership.id, leaveDate);
      }

      await transaction.$queryRaw`SELECT "id" FROM "venue_memberships" WHERE "id" = ${membership.id}::uuid FOR UPDATE`;
      await transaction.venueMembership.update({
        where: { id: membership.id },
        data: { endedOn: leaveDate },
      });
      await transaction.venueRolePeriod.updateMany({
        where: {
          venueMembershipId: membership.id,
          startedOn: { lte: leaveDate },
          OR: [{ endedOn: null }, { endedOn: { gte: leaveDate } }],
        },
        data: { endedOn: leaveDate, changedByUserId: userId },
      });

      const futureScheduleDays = await transaction.scheduleDay.findMany({
        where: {
          venueMembershipId: membership.id,
          date: { gte: leaveDate },
          OR: [{ shiftDurationHours: { not: null } }, { status: { not: null } }],
        },
      });
      for (const day of futureScheduleDays) {
        const oldValue = day.shiftDurationHours
          ? {
              kind: "SHIFT",
              durationHours: day.shiftDurationHours,
              shiftCode: day.shiftCode,
              startMinute: day.shiftStartMinute,
            }
          : day.status
            ? { kind: "STATUS", status: day.status }
            : null;
        await transaction.scheduleDay.update({
          where: { id: day.id },
          data: {
            shiftDurationHours: null,
            shiftCode: null,
            shiftStartMinute: null,
            status: null,
            updatedByUserId: userId,
          },
        });
        await transaction.scheduleDayChange.create({
          data: {
            scheduleDayId: day.id,
            oldValue: oldValue as Prisma.InputJsonValue,
            newValue: Prisma.JsonNull,
            changedByUserId: userId,
          },
        });
      }

      await transaction.auditEvent.create({
        data: {
          eventType: "membership.ended",
          actorType: "USER",
          actorId: userId,
          companyId,
          venueId,
          entityType: "venue_membership",
          entityId: membership.id,
          metadata: {
            subjectUserId: userId,
            subjectName: membership.user.profile?.fullName,
            subjectRole: membership.role,
            terminationDate: dateKey(leaveDate),
            reason: "SELF_LEAVE",
          },
        },
      });
    });
    return { accepted: true };
  }

  async leaveCompany(
    userId: string,
    companyId: string,
    confirmationName: string,
  ): Promise<{ accepted: true }> {
    const leaveDate = currentDate();
    await this.database.$transaction(async (transaction) => {
      const lockedCompanies = await transaction.$queryRaw<Array<{ id: string; status: string }>>`
        SELECT "id", "status" FROM "companies" WHERE "id" = ${companyId}::uuid FOR UPDATE
      `;
      const lockedCompany = lockedCompanies[0];
      if (!lockedCompany) throw new NotFoundException("Компания недоступна");
      if (lockedCompany.status !== "ACTIVE") {
        throw new ConflictException("Нельзя покинуть компанию, ожидающую закрытия");
      }
      await transaction.$queryRaw`SELECT "id" FROM "venues" WHERE "companyId" = ${companyId}::uuid AND "status" = 'ACTIVE' FOR UPDATE`;

      const company = await transaction.company.findUnique({
        where: { id: companyId },
        include: {
          memberships: {
            where: { OR: [{ endedOn: null }, { endedOn: { gt: leaveDate } }] },
            select: { id: true, userId: true, companyRole: true },
          },
          venues: {
            where: { status: "ACTIVE" },
            include: {
              memberships: {
                where: { OR: [{ endedOn: null }, { endedOn: { gt: leaveDate } }] },
                include: {
                  permissionOverrides: true,
                  rolePeriods: true,
                  user: { include: { profile: true } },
                },
              },
            },
          },
        },
      });
      if (
        !company ||
        company.name.trim().toLocaleLowerCase("ru-RU") !==
          confirmationName.trim().toLocaleLowerCase("ru-RU")
      ) {
        throw new ConflictException("Название компании не совпадает");
      }
      const companyMembership = company.memberships.find(
        ({ userId: memberId }) => memberId === userId,
      );
      if (!companyMembership) throw new NotFoundException("Вы не состоите в этой компании");
      const isChef = companyMembership.companyRole === "CHEF_BARTENDER";
      const remainingChefs = company.memberships.filter(
        ({ userId: memberId, companyRole }) =>
          memberId !== userId && companyRole === "CHEF_BARTENDER",
      );
      const affectedMemberships = company.venues.flatMap((venue) => {
        const membership = venue.memberships.find(({ userId: memberId }) => memberId === userId);
        return membership ? [{ venue, membership }] : [];
      });
      if (!isChef && !affectedMemberships.length) {
        throw new NotFoundException("В компании нет доступного вам рабочего пространства");
      }
      if (isChef && affectedMemberships.length) {
        throw new ConflictException("У сотрудника обнаружены несовместимые полномочия");
      }

      for (const { venue, membership } of affectedMemberships) {
        this.assertLocalTeamRemains(venue, membership.id, leaveDate);
        if (membership.rolePeriods.some(({ startedOn }) => startedOn > leaveDate)) {
          throw new ConflictException(
            `Нельзя покинуть компанию до начала сохранённого периода должности в заведении «${venue.name}»`,
          );
        }
        this.assertManagementContinuity(
          { ...venue, company: { memberships: company.memberships } },
          membership.id,
          leaveDate,
        );
      }

      if (isChef && !remainingChefs.length) {
        for (const venue of company.venues)
          this.assertManagementAfterLastChefLeaves(venue, leaveDate);
      }

      for (const { venue, membership } of affectedMemberships) {
        await transaction.$queryRaw`SELECT "id" FROM "venue_memberships" WHERE "id" = ${membership.id}::uuid FOR UPDATE`;
        await transaction.venueMembership.update({
          where: { id: membership.id },
          data: { endedOn: leaveDate },
        });
        await transaction.venueRolePeriod.updateMany({
          where: {
            venueMembershipId: membership.id,
            startedOn: { lte: leaveDate },
            OR: [{ endedOn: null }, { endedOn: { gte: leaveDate } }],
          },
          data: { endedOn: leaveDate, changedByUserId: userId },
        });
        await this.clearFutureSchedule(transaction, userId, venue.id, membership.id, leaveDate);
        await transaction.auditEvent.create({
          data: {
            eventType: "membership.ended",
            actorType: "USER",
            actorId: userId,
            companyId,
            venueId: venue.id,
            entityType: "venue_membership",
            entityId: membership.id,
            metadata: {
              subjectUserId: userId,
              subjectName: membership.user.profile?.fullName,
              subjectRole: membership.role,
              terminationDate: dateKey(leaveDate),
              reason: "COMPANY_SELF_EXIT",
            },
          },
        });
      }
      await transaction.companyMembership.update({
        where: { id: companyMembership.id },
        data: { companyRole: null, endedOn: leaveDate },
      });
      await transaction.auditEvent.create({
        data: {
          eventType: "company_membership.ended",
          actorType: "USER",
          actorId: userId,
          companyId,
          entityType: "company_membership",
          entityId: companyMembership.id,
          metadata: {
            subjectUserId: userId,
            previousCompanyRole: companyMembership.companyRole,
            terminationDate: dateKey(leaveDate),
          },
        },
      });
    });
    return { accepted: true };
  }

  private assertLocalTeamRemains(
    venue: {
      name: string;
      memberships: Array<{
        id: string;
        startedOn: Date;
        endedOn: Date | null;
        rolePeriods: Array<{ startedOn: Date; endedOn: Date | null }>;
      }>;
    },
    targetId: string,
    leaveDate: Date,
  ): void {
    const departures = new Map<string, Date>();
    for (const member of venue.memberships)
      if (member.endedOn) departures.set(member.id, member.endedOn);
    departures.set(targetId, leaveDate);
    const dates = new Map<string, Date>([[dateKey(leaveDate), leaveDate]]);
    for (const member of venue.memberships) {
      if (member.startedOn >= leaveDate) dates.set(dateKey(member.startedOn), member.startedOn);
      const departure = departures.get(member.id);
      if (departure && departure > leaveDate) dates.set(dateKey(departure), departure);
      for (const period of member.rolePeriods) {
        if (period.startedOn >= leaveDate) dates.set(dateKey(period.startedOn), period.startedOn);
        if (period.endedOn && period.endedOn > leaveDate) {
          dates.set(dateKey(period.endedOn), period.endedOn);
        }
      }
    }
    for (const date of dates.values()) {
      const remaining = venue.memberships.some((member) => {
        if (member.id === targetId) return false;
        const departure = departures.get(member.id);
        return member.startedOn <= date && (!departure || departure > date);
      });
      if (!remaining) {
        throw new ConflictException(
          `Заведение «${venue.name}» останется без локальной команды. Сначала добавьте сотрудника или закройте заведение отдельно`,
        );
      }
    }
  }

  private assertManagementAfterLastChefLeaves(
    venue: {
      name: string;
      memberships: Array<{
        id: string;
        role: ManagedVenueRole;
        startedOn: Date;
        endedOn: Date | null;
        hasFullManagementPackage: boolean;
        permissionOverrides: Array<{ code: string; enabled: boolean }>;
        rolePeriods: Array<{ role: ManagedVenueRole; startedOn: Date; endedOn: Date | null }>;
      }>;
    },
    leaveDate: Date,
  ): void {
    this.assertLocalTeamRemains(venue, "", leaveDate);
    const departures = new Map<string, Date>();
    for (const member of venue.memberships)
      if (member.endedOn) departures.set(member.id, member.endedOn);
    const dates = new Map<string, Date>([[dateKey(leaveDate), leaveDate]]);
    for (const member of venue.memberships) {
      if (member.startedOn >= leaveDate) dates.set(dateKey(member.startedOn), member.startedOn);
      const departure = departures.get(member.id);
      if (departure && departure > leaveDate) dates.set(dateKey(departure), departure);
      for (const period of member.rolePeriods) {
        if (period.startedOn >= leaveDate) dates.set(dateKey(period.startedOn), period.startedOn);
        if (period.endedOn && period.endedOn > leaveDate) {
          dates.set(dateKey(period.endedOn), period.endedOn);
        }
      }
    }
    for (const date of dates.values()) {
      const remaining = venue.memberships.filter((member) => {
        const departure = departures.get(member.id);
        return member.startedOn <= date && (!departure || departure > date);
      });
      const roleAtDate = (member: (typeof remaining)[number]) =>
        member.rolePeriods.find(
          ({ startedOn, endedOn }) => startedOn <= date && (!endedOn || endedOn > date),
        )?.role;
      const hasManager = remaining.some((member) => roleAtDate(member) === "BAR_MANAGER");
      const hasEquivalentManager = remaining.some((member) => {
        if (member.role === "BAR_MANAGER" || member.hasFullManagementPackage) return true;
        const role = roleAtDate(member);
        if (!role) return false;
        const permissions = this.permissions.evaluate({
          role: toWorkspaceRole(role),
          fullVenueManagement: member.hasFullManagementPackage,
          permissionOverrides: member.permissionOverrides.map(({ code, enabled }) => ({
            code: code.toLowerCase(),
            enabled,
          })),
          hasBarManager: hasManager,
          hasChefBartender: false,
        });
        return BAR_MANAGER_PERMISSIONS.every((permission) => permissions.includes(permission));
      });
      if (!hasManager && !hasEquivalentManager) {
        throw new ConflictException(
          `Сначала обеспечьте непрерывность управления в заведении «${venue.name}»`,
        );
      }
    }
  }

  private async clearFutureSchedule(
    transaction: Prisma.TransactionClient,
    userId: string,
    venueId: string,
    membershipId: string,
    leaveDate: Date,
  ): Promise<void> {
    const days = await transaction.scheduleDay.findMany({
      where: {
        venueMembershipId: membershipId,
        date: { gte: leaveDate },
        OR: [{ shiftDurationHours: { not: null } }, { status: { not: null } }],
      },
    });
    for (const day of days) {
      const oldValue = day.shiftDurationHours
        ? {
            kind: "SHIFT",
            durationHours: day.shiftDurationHours,
            shiftCode: day.shiftCode,
            startMinute: day.shiftStartMinute,
          }
        : day.status
          ? { kind: "STATUS", status: day.status }
          : null;
      await transaction.scheduleDay.update({
        where: { id: day.id },
        data: {
          shiftDurationHours: null,
          shiftCode: null,
          shiftStartMinute: null,
          status: null,
          updatedByUserId: userId,
        },
      });
      await transaction.scheduleDayChange.create({
        data: {
          scheduleDayId: day.id,
          oldValue: oldValue as Prisma.InputJsonValue,
          newValue: Prisma.JsonNull,
          changedByUserId: userId,
        },
      });
    }
  }

  private assertManagementContinuity(
    venue: {
      name: string;
      memberships: Array<{
        id: string;
        role: ManagedVenueRole;
        startedOn: Date;
        endedOn: Date | null;
        hasFullManagementPackage: boolean;
        permissionOverrides: Array<{ code: string; enabled: boolean }>;
        rolePeriods: Array<{ role: ManagedVenueRole; startedOn: Date; endedOn: Date | null }>;
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
    const uniqueDates = new Map<string, Date>([[dateKey(terminationDate), terminationDate]]);
    for (const date of departures.values()) uniqueDates.set(dateKey(date), date);
    for (const member of venue.memberships) {
      for (const period of member.rolePeriods) {
        if (period.startedOn >= currentDate()) {
          uniqueDates.set(dateKey(period.startedOn), period.startedOn);
        }
        if (period.endedOn && period.endedOn >= currentDate()) {
          uniqueDates.set(dateKey(period.endedOn), period.endedOn);
        }
      }
    }
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
      const roleAtDate = (member: (typeof remaining)[number]) =>
        member.rolePeriods.find(
          ({ startedOn, endedOn }) => startedOn <= date && (!endedOn || endedOn > date),
        )?.role;
      const hasManager = remaining.some((member) => roleAtDate(member) === "BAR_MANAGER");
      const hasEquivalentManager = remaining.some((member) => {
        if (member.role === "BAR_MANAGER" || member.hasFullManagementPackage) return true;
        const role = roleAtDate(member);
        if (!role) return false;
        const permissions = this.permissions.evaluate({
          role: toWorkspaceRole(role),
          fullVenueManagement: member.hasFullManagementPackage,
          permissionOverrides: member.permissionOverrides.map(({ code, enabled }) => ({
            code: code.toLowerCase(),
            enabled,
          })),
          hasBarManager: hasManager,
          hasChefBartender: hasChef,
        });
        return BAR_MANAGER_PERMISSIONS.every((permission) => permissions.includes(permission));
      });
      if (!remaining.length || (!hasManager && !hasEquivalentManager && !hasChef)) {
        throw new ConflictException(
          `Сначала назначьте управляющего в заведении «${venue.name}» на весь период выхода`,
        );
      }
    }
  }
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
