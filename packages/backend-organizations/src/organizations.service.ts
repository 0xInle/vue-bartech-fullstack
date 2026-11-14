import {
  NotFoundException,
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
} from "@nestjs/common";
import { DATABASE_CLIENT, Prisma, PrismaClient } from "@bartech/database";
import {
  DELEGATABLE_PERMISSION_CODES,
  VENUE_PERMISSION_CODES,
  PermissionService,
  isVenuePermission,
  type PermissionCode,
  type WorkspaceRole,
} from "./permissions/permission.service.js";
import { canOpenAdditionalVenue } from "./venue-opening-authority.js";

export type WorkspaceInput = {
  companyName: string;
  venueName: string;
  initialRole?: "CHEF_BARTENDER" | "BAR_MANAGER" | "SENIOR_BARTENDER" | "BARTENDER";
};

export type CompanySummary = { id: string; name: string };

export type VenueInviteRole =
  "BARTENDER" | "SENIOR_BARTENDER" | "BARBACK" | "TRAINEE" | "BAR_MANAGER";

export function normalizeName(value: string): string {
  return value.trim().replace(/\s+/gu, " ");
}

export function normalizeVenueName(value: string): string {
  return normalizeName(value).toLocaleLowerCase("ru-RU").replaceAll("ё", "е");
}

@Injectable()
export class OrganizationsService {
  constructor(
    @Inject(DATABASE_CLIENT) private readonly database: PrismaClient,
    private readonly permissions: PermissionService,
  ) {}

  async listWorkspacesForUser(userId: string): Promise<WorkspaceSummary[]> {
    const now = new Date();
    const companyOperationalOrInClosure = {
      OR: [
        { status: "ACTIVE" as const },
        { status: "PENDING_CLOSURE" as const, closureDeadline: { gt: now } },
      ],
    };
    const [companyMemberships, venueMemberships] = await Promise.all([
      this.database.companyMembership.findMany({
        where: {
          userId,
          OR: [{ endedOn: null }, { endedOn: { gt: currentDate() } }],
          companyRole: "CHEF_BARTENDER",
          company: companyOperationalOrInClosure,
        },
        include: {
          company: {
            include: {
              venues: {
                where: { status: "ACTIVE" },
                include: {
                  memberships: {
                    where: { OR: [{ endedOn: null }, { endedOn: { gt: currentDate() } }] },
                    select: { role: true },
                  },
                },
              },
            },
          },
        },
      }),
      this.database.venueMembership.findMany({
        where: {
          userId,
          OR: [{ endedOn: null }, { endedOn: { gt: currentDate() } }],
          companyMembership: {
            is: { OR: [{ endedOn: null }, { endedOn: { gt: currentDate() } }] },
          },
          venue: { status: "ACTIVE", company: companyOperationalOrInClosure },
        },
        include: {
          companyMembership: {
            select: {
              companyRole: true,
              company: {
                select: {
                  id: true,
                  name: true,
                  status: true,
                  closureDeadline: true,
                  memberships: {
                    where: { OR: [{ endedOn: null }, { endedOn: { gt: currentDate() } }] },
                    select: { companyRole: true },
                  },
                },
              },
            },
          },
          venue: {
            include: {
              memberships: {
                where: { OR: [{ endedOn: null }, { endedOn: { gt: currentDate() } }] },
                select: { role: true },
              },
            },
          },
          permissionOverrides: { select: { code: true, enabled: true } },
        },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    const chefCompanyIds = new Set(companyMemberships.map(({ companyId }) => companyId));
    if (venueMemberships.some(({ companyId }) => chefCompanyIds.has(companyId))) {
      throw new InternalServerErrorException("Обнаружено несовместимое членство пользователя");
    }

    const workspaces = new Map<string, WorkspaceSummary>();
    for (const membership of venueMemberships) {
      const role = toWorkspaceRole(membership.role);
      const hasBarManager = membership.venue.memberships.some(
        (item) => item.role === "BAR_MANAGER",
      );
      const hasChefBartender = membership.companyMembership.company.memberships.some(
        (item) => item.companyRole === "CHEF_BARTENDER",
      );
      const permissionOverrides = membership.permissionOverrides.map(({ code, enabled }) => ({
        code: code.toLowerCase(),
        enabled,
      }));
      const permissions = restrictCompanyPermissions(
        this.permissions.evaluate({
          role,
          permissionOverrides,
          fullVenueManagement: membership.hasFullManagementPackage,
          hasBarManager,
          hasChefBartender,
        }),
        membership.companyMembership.company.status,
      );
      const workspace = toWorkspaceSummary(
        membership.companyMembership.company,
        membership.venue,
        role,
        "venue",
        permissions,
      );
      workspaces.set(`${workspace.company.id}:${workspace.venue.id}`, workspace);
    }

    for (const membership of companyMemberships) {
      for (const venue of membership.company.venues) {
        const hasBarManager = venue.memberships.some((item) => item.role === "BAR_MANAGER");
        const permissions = restrictCompanyPermissions(
          this.permissions.evaluate({
            role: "chef_bartender",
            hasBarManager,
            hasChefBartender: true,
          }),
          membership.company.status,
        );
        const workspace = toWorkspaceSummary(
          membership.company,
          venue,
          "chef_bartender",
          "company",
          permissions,
        );
        workspaces.set(`${workspace.company.id}:${workspace.venue.id}`, workspace);
      }
    }

    return [...workspaces.values()].sort(
      (first, second) =>
        first.company.name.localeCompare(second.company.name, "ru-RU") ||
        first.venue.name.localeCompare(second.venue.name, "ru-RU"),
    );
  }

  async listEmptyCompaniesForUser(userId: string): Promise<CompanySummary[]> {
    const now = new Date();
    const memberships = await this.database.companyMembership.findMany({
      where: {
        userId,
        OR: [{ endedOn: null }, { endedOn: { gt: currentDate() } }],
        companyRole: "CHEF_BARTENDER",
        company: {
          OR: [{ status: "ACTIVE" }, { status: "PENDING_CLOSURE", closureDeadline: { gt: now } }],
          venues: { none: {} },
        },
      },
      select: { company: { select: { id: true, name: true } } },
    });

    return memberships
      .map(({ company }) => company)
      .sort((first, second) => first.name.localeCompare(second.name, "ru-RU"));
  }

  async findWorkspaceForUser(
    userId: string,
    companyId: string,
    venueId: string,
  ): Promise<WorkspaceSummary | null> {
    const workspaces = await this.listWorkspacesForUser(userId);
    return (
      workspaces.find(({ company, venue }) => company.id === companyId && venue.id === venueId) ??
      null
    );
  }

  async assertChefBartenderInCompany(userId: string, companyId: string): Promise<void> {
    const now = new Date();
    const membership = await this.database.companyMembership.findFirst({
      where: {
        userId,
        companyId,
        OR: [{ endedOn: null }, { endedOn: { gt: currentDate() } }],
        companyRole: "CHEF_BARTENDER",
        company: {
          OR: [{ status: "ACTIVE" }, { status: "PENDING_CLOSURE", closureDeadline: { gt: now } }],
        },
      },
      select: { userId: true },
    });
    if (!membership) throw new NotFoundException("Компания недоступна");
  }

  async createForUser(userId: string, input: WorkspaceInput) {
    try {
      return await this.database.$transaction((transaction) =>
        this.createInTransaction(transaction, userId, input),
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("В этой компании уже есть заведение с таким названием");
      }
      throw error;
    }
  }

  async createVenueForUser(
    userId: string,
    companyId: string,
    venueNameInput: string,
    initialRole?: "BAR_MANAGER" | "SENIOR_BARTENDER" | "BARTENDER",
  ) {
    const venueName = normalizeName(venueNameInput);
    if (!venueName) throw new ConflictException("Укажите название заведения");

    try {
      return await this.database.$transaction(async (transaction) => {
        const lockedCompanies = await transaction.$queryRaw<Array<{ id: string }>>`
          SELECT "id" FROM "companies" WHERE "id" = ${companyId}::uuid FOR UPDATE
        `;
        if (!lockedCompanies.length) throw new NotFoundException("Компания недоступна");
        const company = await transaction.company.findUnique({
          where: { id: companyId },
          include: {
            memberships: {
              where: { OR: [{ endedOn: null }, { endedOn: { gt: currentDate() } }] },
              select: { id: true, userId: true, companyRole: true },
            },
            venues: {
              where: { status: "ACTIVE" },
              include: {
                memberships: {
                  where: { OR: [{ endedOn: null }, { endedOn: { gt: currentDate() } }] },
                  select: { userId: true, role: true, hasFullManagementPackage: true },
                },
              },
            },
          },
        });
        if (!company) throw new NotFoundException("Компания недоступна");
        const companyMembership = company.memberships.find(
          ({ userId: memberId }) => memberId === userId,
        );
        if (!companyMembership) throw new NotFoundException("Компания недоступна");
        const isChef = companyMembership.companyRole === "CHEF_BARTENDER";
        const isPendingEmptyCompany =
          company.status === "PENDING_CLOSURE" &&
          Boolean(company.closureDeadline && company.closureDeadline > new Date()) &&
          company.venues.length === 0;
        if (company.status !== "ACTIVE" && !(isChef && isPendingEmptyCompany)) {
          throw new NotFoundException("Компания недоступна");
        }
        if (isChef && initialRole) {
          throw new ConflictException("Шеф-бармен создаёт заведение без локальной должности");
        }
        if (!isChef && !initialRole) {
          throw new ConflictException("Выберите должность для нового заведения");
        }
        if (!canOpenAdditionalVenue({ userId, company })) {
          throw new NotFoundException("Компания недоступна");
        }

        const venue = await transaction.venue.create({
          data: {
            companyId,
            name: venueName,
            nameNormalized: normalizeVenueName(venueName),
          },
        });

        if (initialRole) {
          const role = initialRole;
          const startedOn = currentDate();
          await transaction.venueMembership.create({
            data: {
              userId,
              companyId,
              venueId: venue.id,
              role,
              hasFullManagementPackage: true,
              fullManagementChangedAt: new Date(),
              fullManagementChangedByUserId: userId,
              startedOn,
              rolePeriods: { create: { role, startedOn } },
            },
          });
          if (role === "BAR_MANAGER") {
            await transaction.company.update({
              where: { id: companyId },
              data: { managementRoleEverPresent: true },
            });
          }
        }
        if (isPendingEmptyCompany) {
          const now = new Date();
          await transaction.company.update({
            where: { id: companyId },
            data: { status: "ACTIVE", closureDeadline: null },
          });
          await transaction.productExportClosureOperation.updateMany({
            where: { originalCompanyId: companyId, status: "PENDING_CLOSURE" },
            data: { status: "CANCELLED", cancelledAt: now },
          });
        }
        return { company, venue };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("В этой компании уже есть заведение с таким названием");
      }
      throw error;
    }
  }

  async createInTransaction(
    transaction: Prisma.TransactionClient,
    userId: string,
    input: WorkspaceInput,
  ) {
    const companyName = normalizeName(input.companyName);
    const venueName = normalizeName(input.venueName);

    if (!companyName || !venueName) {
      throw new ConflictException("Укажите название компании и заведения");
    }

    const company = await transaction.company.create({
      data: {
        name: companyName,
        nameNormalized: companyName.toLocaleLowerCase("ru-RU"),
        initialCreatorUserId: userId,
        authorityHistoryKnown: true,
        managementRoleEverPresent:
          (input.initialRole ?? "BAR_MANAGER") === "CHEF_BARTENDER" ||
          (input.initialRole ?? "BAR_MANAGER") === "BAR_MANAGER",
        authorityTransferredEver: false,
      },
    });

    const venue = await transaction.venue.create({
      data: {
        companyId: company.id,
        name: venueName,
        nameNormalized: normalizeVenueName(venueName),
      },
    });

    const initialRole = input.initialRole ?? "BAR_MANAGER";
    if (initialRole === "CHEF_BARTENDER") {
      await transaction.companyMembership.create({
        data: { userId, companyId: company.id, companyRole: "CHEF_BARTENDER" },
      });
    } else {
      await transaction.companyMembership.create({ data: { userId, companyId: company.id } });
      await transaction.venueMembership.create({
        data: {
          userId,
          companyId: company.id,
          venueId: venue.id,
          role: initialRole,
          hasFullManagementPackage: true,
          fullManagementChangedAt: new Date(),
          fullManagementChangedByUserId: userId,
          startedOn: currentDate(),
          rolePeriods: {
            create: { role: initialRole, startedOn: currentDate() },
          },
        },
      });
    }

    return { company, venue };
  }

  async getVenueTeam(
    userId: string,
    companyId: string,
    venueId: string,
  ): Promise<{
    members: Array<{
      id: string;
      fullName: string;
      email: string;
      role: VenueInviteRole;
      terminationDate: string | null;
      permissions: string[];
      availablePermissions: string[];
      availableRoles: VenueInviteRole[];
      canManagePermissionOverrides: boolean;
      hasFullManagementPackage: boolean;
      canManageFullManagementPackage: boolean;
    }>;
    availableCompanyMembers: Array<{ id: string; fullName: string; email: string }>;
    invitations: Array<{
      id: string;
      email: string;
      role: VenueInviteRole;
      status: "ACTIVE" | "IN_PROGRESS";
      createdAt: Date;
      expiresAt: Date;
      canRevoke: boolean;
    }>;
  }> {
    const workspace = await this.findWorkspaceForUser(userId, companyId, venueId);
    if (!workspace || !workspace.permissions.includes("view_team")) {
      throw new NotFoundException("Команда не найдена");
    }

    const now = new Date();
    const [members, invitations, hasChefBartender, companyMemberships] = await Promise.all([
      this.database.venueMembership.findMany({
        where: { companyId, venueId, OR: [{ endedOn: null }, { endedOn: { gt: currentDate() } }] },
        include: {
          user: { include: { profile: true } },
          permissionOverrides: true,
        },
        orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      }),
      this.database.invitation.findMany({
        where: {
          companyId,
          venueId,
          purpose: "JOIN_EXISTING_VENUE",
          role: { not: null },
          OR: [
            { status: "ACTIVE", expiresAt: { gt: now } },
            {
              status: "IN_PROGRESS",
              acceptanceSession: { is: { expiresAt: { gt: now } } },
            },
          ],
        },
        include: { acceptanceSession: true },
        orderBy: { createdAt: "desc" },
      }),
      this.database.companyMembership
        .count({
          where: {
            companyId,
            OR: [{ endedOn: null }, { endedOn: { gt: currentDate() } }],
            companyRole: "CHEF_BARTENDER",
          },
        })
        .then((count) => count > 0),
      workspace.permissions.includes("manage_team")
        ? this.database.companyMembership.findMany({
            where: {
              companyId,
              OR: [{ endedOn: null }, { endedOn: { gt: currentDate() } }],
              companyRole: null,
            },
            include: {
              user: { include: { profile: true } },
              venueMemberships: {
                where: {
                  venueId,
                  OR: [{ endedOn: null }, { endedOn: { gt: currentDate() } }],
                },
                select: { id: true },
              },
            },
          })
        : Promise.resolve([]),
    ]);

    return {
      members: members.map((member) => {
        const canManageTeam =
          member.userId !== userId && workspace.permissions.includes("manage_team");
        const canManageAllLocalRoles = workspace.permissions.includes(
          "manage_delegated_permissions",
        );
        const actorIsFullManager = workspace.permissions.includes("create_venues");
        const canChangeRole = canManageTeam && canManageAllLocalRoles;

        const canManagePermissionOverrides =
          (canManageTeam ||
            (member.userId === userId &&
              actorIsFullManager &&
              workspace.permissions.includes("manage_team"))) &&
          workspace.permissions.includes("manage_delegated_permissions");
        const hasFullManagementPackage =
          member.role === "BAR_MANAGER" || member.hasFullManagementPackage;
        const canManageFullManagementPackage =
          canManageTeam && actorIsFullManager && member.role !== "BAR_MANAGER";
        const permissionOverrides = member.permissionOverrides.map(({ code, enabled }) => ({
          code: code.toLowerCase(),
          enabled,
        }));
        const role = toWorkspaceRole(member.role);
        const permissions = this.permissions.evaluate({
          role,
          permissionOverrides,
          fullVenueManagement: member.hasFullManagementPackage,
          hasBarManager:
            member.role === "BAR_MANAGER" || members.some(({ role }) => role === "BAR_MANAGER"),
          hasChefBartender,
        });
        const defaults = this.permissions.evaluate({
          role,
          fullVenueManagement: member.hasFullManagementPackage,
          hasBarManager:
            member.role === "BAR_MANAGER" || members.some(({ role }) => role === "BAR_MANAGER"),
          hasChefBartender,
        });
        const availablePermissions = canManagePermissionOverrides
          ? actorIsFullManager
            ? [...VENUE_PERMISSION_CODES]
            : [
                ...new Set([
                  ...defaults.filter(isVenuePermission),
                  ...DELEGATABLE_PERMISSION_CODES.filter(
                    (code) => workspace.permissions.includes(code) || permissions.includes(code),
                  ),
                ]),
              ]
          : permissions;

        return {
          id: member.id,
          fullName: member.user.profile?.fullName ?? "",
          email: member.user.email,
          role: member.role,
          terminationDate: member.endedOn ? dateKey(member.endedOn) : null,
          permissions,
          availablePermissions,
          availableRoles: canChangeRole
            ? ["BARTENDER", "SENIOR_BARTENDER", "BARBACK", "TRAINEE", "BAR_MANAGER"]
            : [],
          canManagePermissionOverrides,
          hasFullManagementPackage,
          canManageFullManagementPackage,
          isCurrentUser: member.userId === userId,
        };
      }),
      invitations: invitations.map((invitation) => ({
        id: invitation.id,
        email: invitation.email,
        role: invitation.role!,
        status: invitation.status as "ACTIVE" | "IN_PROGRESS",
        createdAt: invitation.createdAt,
        expiresAt:
          invitation.status === "IN_PROGRESS" && invitation.acceptanceSession
            ? invitation.acceptanceSession.expiresAt
            : invitation.expiresAt,
        canRevoke:
          invitation.createdByUserId === userId || workspace.permissions.includes("manage_team"),
      })),
      availableCompanyMembers: companyMemberships
        .filter(
          ({ userId: memberUserId, venueMemberships: localMemberships }) =>
            memberUserId !== userId && localMemberships.length === 0,
        )
        .map(({ userId: memberUserId, user }) => ({
          id: memberUserId,
          fullName: user.profile?.fullName ?? "",
          email: user.email,
        })),
    };
  }
}

export type WorkspaceSummary = {
  company: { id: string; name: string };
  venue: { id: string; name: string };
  role: WorkspaceRole;
  roleLabel: string;
  scope: "company" | "venue";
  permissions: PermissionCode[];
};

const readOnlyCompanyPermissions = new Set<PermissionCode>([
  "view_products",
  "view_archive",
  "view_team",
  "view_schedule",
  "export_data",
  "view_history",
]);

function restrictCompanyPermissions(
  permissions: PermissionCode[],
  companyStatus: "ACTIVE" | "PENDING_CLOSURE",
): PermissionCode[] {
  if (companyStatus === "ACTIVE") return permissions;
  return permissions.filter((permission) => readOnlyCompanyPermissions.has(permission));
}

function currentDate(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toWorkspaceRole(role: VenueInviteRole): WorkspaceRole {
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

function toWorkspaceSummary(
  company: { id: string; name: string },
  venue: { id: string; name: string },
  role: WorkspaceRole,
  scope: "company" | "venue",
  permissions: PermissionCode[],
): WorkspaceSummary {
  const roleLabels: Record<WorkspaceRole, string> = {
    bartender: "Бармен",
    senior_bartender: "Старший бармен",
    bar_manager: "Бар-менеджер",
    chef_bartender: "Шеф-бармен",
  };

  return {
    company: { id: company.id, name: company.name },
    venue: { id: venue.id, name: venue.name },
    role,
    roleLabel: roleLabels[role],
    scope,
    permissions,
  };
}
