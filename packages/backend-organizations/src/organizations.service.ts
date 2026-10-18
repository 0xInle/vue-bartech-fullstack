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
  PermissionService,
  type PermissionCode,
  type WorkspaceRole,
} from "./permissions/permission.service.js";

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
          companyRole: "CHEF_BARTENDER",
          company: companyOperationalOrInClosure,
        },
        include: {
          company: {
            include: {
              venues: {
                where: { status: "ACTIVE" },
                include: { memberships: { select: { role: true } } },
              },
            },
          },
        },
      }),
      this.database.venueMembership.findMany({
        where: {
          userId,
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
                  memberships: { select: { companyRole: true } },
                },
              },
            },
          },
          venue: { include: { memberships: { select: { role: true } } } },
          delegatedPermissions: { select: { code: true } },
          temporaryResponsibility: { select: { id: true } },
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
      const delegatedPermissions = membership.delegatedPermissions.map(({ code }) =>
        code.toLowerCase(),
      );
      const permissions = restrictCompanyPermissions(
        this.permissions.evaluate({
          role,
          delegatedPermissions,
          temporaryResponsibility:
            !hasBarManager &&
            !hasChefBartender &&
            Boolean(membership.temporaryResponsibility) &&
            (membership.role === "BARTENDER" || membership.role === "SENIOR_BARTENDER"),
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

  async createVenueForUser(userId: string, companyId: string, venueNameInput: string) {
    const venueName = normalizeName(venueNameInput);
    if (!venueName) throw new ConflictException("Укажите название заведения");

    const workspaces = await this.listWorkspacesForUser(userId);
    const canCreateVenue = workspaces.some(
      (workspace) =>
        workspace.company.id === companyId && workspace.permissions.includes("create_venues"),
    );
    if (!canCreateVenue) throw new NotFoundException("Компания недоступна");

    try {
      return await this.database.$transaction(async (transaction) => {
        const lockedCompanies = await transaction.$queryRaw<Array<{ id: string }>>`
          SELECT "id" FROM "companies" WHERE "id" = ${companyId}::uuid FOR UPDATE
        `;
        if (!lockedCompanies.length) throw new NotFoundException("Компания недоступна");
        const company = await transaction.company.findUnique({ where: { id: companyId } });
        if (!company || company.status !== "ACTIVE") {
          throw new NotFoundException("Компания недоступна");
        }

        const venue = await transaction.venue.create({
          data: {
            companyId,
            name: venueName,
            nameNormalized: normalizeVenueName(venueName),
          },
        });

        await transaction.venueMembership.create({
          data: { userId, companyId, venueId: venue.id, role: "BAR_MANAGER" },
        });

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
        data: { userId, companyId: company.id, venueId: venue.id, role: initialRole },
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
      delegatedPermissions: string[];
      availableRoles: VenueInviteRole[];
      availableDelegatedPermissions: string[];
      canManageDelegatedPermissions: boolean;
    }>;
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
    const [members, invitations] = await Promise.all([
      this.database.venueMembership.findMany({
        where: { companyId, venueId },
        include: { user: { include: { profile: true } }, delegatedPermissions: true },
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
    ]);

    return {
      members: members.map((member) => {
        const actorMembership = members.find(({ userId: memberUserId }) => memberUserId === userId);
        const canManageTeam =
          member.userId !== userId && workspace.permissions.includes("manage_team");
        const canManageAllLocalRoles =
          workspace.role === "bar_manager" || workspace.role === "chef_bartender";
        const canManageAsTemporaryResponsible =
          (actorMembership?.role === "BARTENDER" || actorMembership?.role === "SENIOR_BARTENDER") &&
          workspace.permissions.includes("manage_team");
        const canChangeRole =
          canManageTeam &&
          !(
            canManageAsTemporaryResponsible &&
            member.delegatedPermissions.some(({ code }) => code === "DELETE_PRODUCTS_PERMANENTLY")
          ) &&
          (canManageAllLocalRoles ||
            (canManageAsTemporaryResponsible && member.role !== "BAR_MANAGER"));

        const canManageDelegatedPermissions =
          canManageTeam &&
          member.role !== "BAR_MANAGER" &&
          workspace.permissions.includes("manage_delegated_permissions");
        const actorIsTemporaryResponsible =
          (workspace.role === "bartender" || workspace.role === "senior_bartender") &&
          workspace.permissions.includes("manage_team");
        const delegatedPermissions = member.delegatedPermissions.map(({ code }) =>
          code.toLowerCase(),
        );

        return {
          id: member.id,
          fullName: member.user.profile?.fullName ?? "",
          email: member.user.email,
          role: member.role,
          delegatedPermissions,
          availableRoles: canChangeRole
            ? ["BARTENDER", "SENIOR_BARTENDER", "BARBACK", "TRAINEE", "BAR_MANAGER"]
            : [],
          availableDelegatedPermissions: canManageDelegatedPermissions
            ? DELEGATABLE_PERMISSION_CODES.filter(
                (code) =>
                  (workspace.permissions.includes(code) || delegatedPermissions.includes(code)) &&
                  !(actorIsTemporaryResponsible && code === "delete_products_permanently"),
              )
            : [],
          canManageDelegatedPermissions,
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
