import {
  NotFoundException,
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
} from "@nestjs/common";
import { DATABASE_CLIENT, Prisma, PrismaClient } from "@bartech/database";
import {
  PermissionService,
  type PermissionCode,
  type WorkspaceRole,
} from "./permissions/permission.service.js";

export type WorkspaceInput = {
  companyName: string;
  venueName: string;
};

export type CompanySummary = { id: string; name: string };

export type VenueInviteRole = "BARTENDER" | "SENIOR_BARTENDER" | "BAR_MANAGER";

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
    const [companyMemberships, venueMemberships] = await Promise.all([
      this.database.companyMembership.findMany({
        where: { userId, companyRole: "CHEF_BARTENDER" },
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
        where: { userId, venue: { status: "ACTIVE" } },
        include: {
          companyMembership: {
            select: {
              companyRole: true,
              company: {
                select: {
                  id: true,
                  name: true,
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
      const permissions = this.permissions.evaluate({
        role,
        delegatedPermissions,
        temporaryResponsibility:
          !hasBarManager &&
          !hasChefBartender &&
          Boolean(membership.temporaryResponsibility) &&
          (role === "bartender" || role === "senior_bartender"),
        hasBarManager,
        hasChefBartender,
      });
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
        const permissions = this.permissions.evaluate({
          role: "chef_bartender",
          hasBarManager,
          hasChefBartender: true,
        });
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
    const memberships = await this.database.companyMembership.findMany({
      where: {
        userId,
        companyRole: "CHEF_BARTENDER",
        company: { venues: { none: {} } },
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

    await transaction.companyMembership.create({
      data: {
        userId,
        companyId: company.id,
      },
    });

    await transaction.venueMembership.create({
      data: {
        userId,
        companyId: company.id,
        venueId: venue.id,
        role: "BAR_MANAGER",
      },
    });

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
      members: members.map((member) => ({
        id: member.id,
        fullName: member.user.profile?.fullName ?? "",
        email: member.user.email,
        role: member.role,
        delegatedPermissions: member.delegatedPermissions.map(({ code }) => code.toLowerCase()),
      })),
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

function toWorkspaceRole(role: "BARTENDER" | "SENIOR_BARTENDER" | "BAR_MANAGER"): WorkspaceRole {
  switch (role) {
    case "BARTENDER":
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
