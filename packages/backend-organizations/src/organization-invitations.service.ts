import {
  ForbiddenException,
  NotFoundException,
  ConflictException,
  Inject,
  Injectable,
} from "@nestjs/common";
import { DATABASE_CLIENT, Prisma, PrismaClient } from "@bartech/database";
import { PermissionService, type WorkspaceRole } from "./permissions/permission.service.js";
import {
  normalizeName,
  normalizeVenueName,
  type VenueInviteRole,
} from "./organizations.service.js";

@Injectable()
export class OrganizationInvitationsService {
  constructor(
    @Inject(DATABASE_CLIENT) private readonly database: PrismaClient,
    private readonly permissions: PermissionService,
  ) {}

  async revokeChefInvitation(
    actorId: string,
    companyId: string,
    invitationId: string,
  ): Promise<void> {
    await this.database.$transaction((transaction) =>
      this.revokeChefInvitationInTransaction(transaction, { actorId, companyId, invitationId }),
    );
  }

  async revokeVenueManagerInvitation(
    actorId: string,
    companyId: string,
    invitationId: string,
  ): Promise<void> {
    await this.database.$transaction((transaction) =>
      this.revokeVenueManagerInvitationInTransaction(transaction, {
        actorId,
        companyId,
        invitationId,
      }),
    );
  }

  async revokeInvitation(
    actorId: string,
    companyId: string,
    venueId: string,
    invitationId: string,
  ): Promise<void> {
    await this.database.$transaction((transaction) =>
      this.revokeInvitationInTransaction(transaction, {
        actorId,
        companyId,
        venueId,
        invitationId,
      }),
    );
  }

  async getCompanyVenueInvitations(
    userId: string,
    companyId: string,
  ): Promise<{
    invitations: Array<{
      id: string;
      email: string;
      purpose: "CREATE_VENUE_AS_BAR_MANAGER";
      role: "BAR_MANAGER";
      status: "ACTIVE" | "IN_PROGRESS";
      createdAt: Date;
      expiresAt: Date;
      canRevoke: boolean;
    }>;
  }> {
    const company = await this.database.company.findUnique({
      where: { id: companyId },
      include: {
        memberships: true,
        venues: {
          where: { status: "ACTIVE" },
          include: {
            memberships: {
              where: { OR: [{ endedOn: null }, { endedOn: { gte: currentDate() } }] },
            },
          },
        },
      },
    });
    if (!company) throw new NotFoundException("Компания не найдена");
    this.assertCompanyInvitationManager(company, userId, true);
    const now = new Date();
    const invitations = await this.database.invitation.findMany({
      where: {
        companyId,
        purpose: "CREATE_VENUE_AS_BAR_MANAGER",
        OR: [
          { status: "ACTIVE", expiresAt: { gt: now } },
          { status: "IN_PROGRESS", acceptanceSession: { is: { expiresAt: { gt: now } } } },
        ],
      },
      include: { acceptanceSession: true },
      orderBy: { createdAt: "desc" },
    });
    return {
      invitations: invitations.map((invitation) => ({
        id: invitation.id,
        email: invitation.email,
        purpose: "CREATE_VENUE_AS_BAR_MANAGER" as const,
        role: "BAR_MANAGER" as const,
        status: invitation.status as "ACTIVE" | "IN_PROGRESS",
        createdAt: invitation.createdAt,
        expiresAt:
          invitation.status === "IN_PROGRESS" && invitation.acceptanceSession
            ? invitation.acceptanceSession.expiresAt
            : invitation.expiresAt,
        canRevoke: true,
      })),
    };
  }

  async createVenueManagerInvitationInTransaction(
    transaction: Prisma.TransactionClient,
    input: {
      actorId: string;
      companyId: string;
      email: string;
      emailNormalized: string;
      tokenHash: string;
      expiresAt: Date;
    },
  ): Promise<{
    invitation: {
      id: string;
      email: string;
      purpose: "CREATE_VENUE_AS_BAR_MANAGER";
      role: "BAR_MANAGER";
      status: "ACTIVE";
      expiresAt: Date;
    };
    companyName: string;
  }> {
    await this.lockInvitationTargetInTransaction(
      transaction,
      input.emailNormalized,
      input.companyId,
    );
    await this.closeExpiredTargetInvitationsInTransaction(
      transaction,
      input.emailNormalized,
      input.companyId,
    );
    const company = await transaction.company.findUnique({
      where: { id: input.companyId },
      include: {
        memberships: true,
        venues: {
          where: { status: "ACTIVE" },
          include: {
            memberships: {
              where: { OR: [{ endedOn: null }, { endedOn: { gte: currentDate() } }] },
            },
          },
        },
      },
    });
    if (!company) throw new NotFoundException("Компания не найдена");
    this.assertCompanyInvitationManager(company, input.actorId);

    const existingUser = await transaction.user.findUnique({
      where: { emailNormalized: input.emailNormalized },
      select: { id: true },
    });
    if (existingUser) {
      const companyMembership = await transaction.companyMembership.findUnique({
        where: { userId_companyId: { userId: existingUser.id, companyId: input.companyId } },
        select: { companyRole: true },
      });
      if (companyMembership?.companyRole === "CHEF_BARTENDER") {
        throw new ConflictException("Этот человек уже является шеф-барменом компании");
      }
    }
    const chefInvitation = await transaction.invitation.findFirst({
      where: {
        companyId: input.companyId,
        purpose: "JOIN_COMPANY_AS_CHEF",
        emailNormalized: input.emailNormalized,
        status: { in: ["ACTIVE", "IN_PROGRESS"] },
      },
      select: { id: true },
    });
    if (chefInvitation) {
      throw new ConflictException(
        "Для этого адреса уже есть приглашение шеф-бармена в компанию. Сначала завершите или отзовите его.",
      );
    }

    const replaced = await transaction.invitation.findMany({
      where: {
        companyId: input.companyId,
        purpose: "CREATE_VENUE_AS_BAR_MANAGER",
        emailNormalized: input.emailNormalized,
        status: { in: ["ACTIVE", "IN_PROGRESS"] },
      },
      select: { id: true },
    });
    if (replaced.length) {
      const now = new Date();
      await transaction.invitation.updateMany({
        where: {
          id: { in: replaced.map(({ id }) => id) },
          status: { in: ["ACTIVE", "IN_PROGRESS"] },
        },
        data: { status: "CLOSED", closedAt: now },
      });
      await transaction.auditEvent.createMany({
        data: replaced.map(({ id }) => ({
          eventType: "invitation.revoked",
          actorType: "USER",
          actorId: input.actorId,
          companyId: input.companyId,
          entityType: "invitation",
          entityId: id,
          metadata: { reason: "replaced" },
        })),
      });
      await transaction.invitationAcceptanceSession.deleteMany({
        where: { invitationId: { in: replaced.map(({ id }) => id) } },
      });
    }

    const invitation = await transaction.invitation.create({
      data: {
        purpose: "CREATE_VENUE_AS_BAR_MANAGER",
        companyId: input.companyId,
        email: input.email,
        emailNormalized: input.emailNormalized,
        role: "BAR_MANAGER",
        tokenHash: input.tokenHash,
        createdByUserId: input.actorId,
        expiresAt: input.expiresAt,
      },
    });
    await transaction.auditEvent.create({
      data: {
        eventType: "invitation.created",
        actorType: "USER",
        actorId: input.actorId,
        companyId: input.companyId,
        entityType: "invitation",
        entityId: invitation.id,
        metadata: { purpose: invitation.purpose, role: "BAR_MANAGER" },
      },
    });
    return {
      invitation: {
        id: invitation.id,
        email: invitation.email,
        purpose: "CREATE_VENUE_AS_BAR_MANAGER",
        role: "BAR_MANAGER",
        status: "ACTIVE",
        expiresAt: invitation.expiresAt,
      },
      companyName: company.name,
    };
  }

  async revokeVenueManagerInvitationInTransaction(
    transaction: Prisma.TransactionClient,
    input: { actorId: string; companyId: string; invitationId: string },
  ): Promise<void> {
    await this.lockCompanyForMutation(transaction, input.companyId);
    const invitation = await transaction.invitation.findFirst({
      where: {
        id: input.invitationId,
        companyId: input.companyId,
        purpose: "CREATE_VENUE_AS_BAR_MANAGER",
        status: { in: ["ACTIVE", "IN_PROGRESS"] },
      },
      select: { id: true, createdByUserId: true },
    });
    if (!invitation) throw new NotFoundException("Приглашение не найдено");
    const company = await transaction.company.findUnique({
      where: { id: input.companyId },
      include: {
        memberships: true,
        venues: {
          where: { status: "ACTIVE" },
          include: {
            memberships: {
              where: { OR: [{ endedOn: null }, { endedOn: { gte: currentDate() } }] },
            },
          },
        },
      },
    });
    if (!company) throw new NotFoundException("Приглашение не найдено");
    if (invitation.createdByUserId !== input.actorId) {
      this.assertCompanyInvitationManager(company, input.actorId);
    }
    const now = new Date();
    const revoked = await transaction.invitation.updateMany({
      where: { id: invitation.id, status: { in: ["ACTIVE", "IN_PROGRESS"] } },
      data: { status: "CLOSED", closedAt: now },
    });
    if (revoked.count !== 1) throw new ConflictException("Приглашение уже закрыто");
    await transaction.invitationAcceptanceSession.deleteMany({
      where: { invitationId: invitation.id },
    });
    await transaction.auditEvent.create({
      data: {
        eventType: "invitation.revoked",
        actorType: "USER",
        actorId: input.actorId,
        companyId: input.companyId,
        entityType: "invitation",
        entityId: invitation.id,
      },
    });
  }

  async createInvitedVenueInTransaction(
    transaction: Prisma.TransactionClient,
    input: { companyId: string; userId: string; name: string },
  ): Promise<{ id: string }> {
    const name = normalizeName(input.name);
    if (!name || name.length > 120)
      throw new ConflictException("Укажите корректное название заведения");
    const nameNormalized = normalizeVenueName(name);
    const company = await transaction.company.findUnique({
      where: { id: input.companyId },
      select: { id: true, status: true },
    });
    if (!company) throw new ConflictException("Компания больше недоступна");
    if (company.status !== "ACTIVE") {
      throw new ConflictException("Компания ожидает закрытия и доступна только для просмотра");
    }
    const existingVenue = await transaction.venue.findFirst({
      where: { companyId: input.companyId, nameNormalized },
      select: { id: true },
    });
    if (existingVenue) {
      throw new ConflictException("В компании уже есть заведение с таким названием");
    }
    const venue = await transaction.venue.create({
      data: { companyId: input.companyId, name, nameNormalized },
    });
    await transaction.venueMembership.create({
      data: {
        companyId: input.companyId,
        venueId: venue.id,
        userId: input.userId,
        role: "BAR_MANAGER",
        startedOn: currentDate(),
        rolePeriods: { create: { role: "BAR_MANAGER", startedOn: currentDate() } },
      },
    });
    await transaction.auditEvent.create({
      data: {
        eventType: "venue.created",
        actorType: "USER",
        actorId: input.userId,
        companyId: input.companyId,
        venueId: venue.id,
        entityType: "venue",
        entityId: venue.id,
        metadata: { source: "invitation", initialRole: "BAR_MANAGER" },
      },
    });
    return { id: venue.id };
  }

  private assertCompanyInvitationManager(
    company: {
      status: string;
      memberships: Array<{ userId: string; companyRole: string | null }>;
      venues: Array<{ memberships: Array<{ userId: string; role: string }> }>;
    },
    userId: string,
    allowPendingClosure = false,
  ): void {
    if (company.status !== "ACTIVE" && !allowPendingClosure) {
      throw new ConflictException("Компания ожидает закрытия и доступна только для просмотра");
    }
    const isChef = company.memberships.some(
      (membership) => membership.userId === userId && membership.companyRole === "CHEF_BARTENDER",
    );
    const isBarManager = company.venues.some((venue) =>
      venue.memberships.some(
        (membership) => membership.userId === userId && membership.role === "BAR_MANAGER",
      ),
    );
    if (!isChef && !isBarManager) {
      throw new NotFoundException("Управление приглашениями компании недоступно");
    }
  }

  async cleanupExpiredInTransaction(
    transaction: Prisma.TransactionClient,
    now: Date,
  ): Promise<void> {
    const expiredInvitations = await transaction.invitation.findMany({
      where: { status: "ACTIVE", expiresAt: { lte: now } },
      select: { id: true, companyId: true, venueId: true },
    });
    for (const invitation of expiredInvitations) {
      const updated = await transaction.invitation.updateMany({
        where: { id: invitation.id, status: "ACTIVE", expiresAt: { lte: now } },
        data: { status: "CLOSED", closedAt: now },
      });
      if (updated.count === 1) {
        await transaction.auditEvent.create({
          data: {
            eventType: "invitation.expired",
            actorType: "SYSTEM",
            companyId: invitation.companyId,
            venueId: invitation.venueId,
            entityType: "invitation",
            entityId: invitation.id,
          },
        });
      }
    }

    const expiredAcceptanceSessions = await transaction.invitation.findMany({
      where: {
        status: "IN_PROGRESS",
        OR: [
          { acceptanceSession: { is: null } },
          { acceptanceSession: { is: { expiresAt: { lte: now } } } },
        ],
      },
      select: { id: true, companyId: true, venueId: true },
    });
    for (const invitation of expiredAcceptanceSessions) {
      const updated = await transaction.invitation.updateMany({
        where: {
          id: invitation.id,
          status: "IN_PROGRESS",
          OR: [
            { acceptanceSession: { is: null } },
            { acceptanceSession: { is: { expiresAt: { lte: now } } } },
          ],
        },
        data: { status: "CLOSED", closedAt: now },
      });
      if (updated.count === 1) {
        await transaction.auditEvent.create({
          data: {
            eventType: "invitation.expired",
            actorType: "SYSTEM",
            companyId: invitation.companyId,
            venueId: invitation.venueId,
            entityType: "invitation",
            entityId: invitation.id,
          },
        });
      }
    }

    await transaction.invitationAcceptanceSession.deleteMany({
      where: { expiresAt: { lte: now } },
    });
  }

  async createInvitationInTransaction(
    transaction: Prisma.TransactionClient,
    input: {
      actorId: string;
      companyId: string;
      venueId: string;
      email: string;
      emailNormalized: string;
      role: VenueInviteRole;
      tokenHash: string;
      expiresAt: Date;
    },
  ): Promise<{
    invitation: {
      id: string;
      email: string;
      role: VenueInviteRole;
      status: "ACTIVE";
      expiresAt: Date;
    };
    companyName: string;
    venueName: string;
  }> {
    const venue = await transaction.venue.findFirst({
      where: { id: input.venueId, companyId: input.companyId, status: "ACTIVE" },
      include: {
        memberships: {
          where: { OR: [{ endedOn: null }, { endedOn: { gte: currentDate() } }] },
          include: { delegatedPermissions: true, temporaryResponsibility: true },
        },
        company: { include: { memberships: true } },
      },
    });
    if (!venue) throw new NotFoundException("Заведение не найдено");
    if (venue.company.status !== "ACTIVE") {
      throw new ConflictException("Компания ожидает закрытия и доступна только для просмотра");
    }

    const companyMembership = venue.company.memberships.find(
      ({ userId }) => userId === input.actorId,
    );
    const localMembership = venue.memberships.find(({ userId }) => userId === input.actorId);
    const hasBarManager = venue.memberships.some(({ role }) => role === "BAR_MANAGER");
    const hasChefBartender = venue.company.memberships.some(
      ({ companyRole }) => companyRole === "CHEF_BARTENDER",
    );
    const role = companyMembership?.companyRole
      ? "chef_bartender"
      : localMembership
        ? toWorkspaceRole(localMembership.role)
        : null;
    if (!role) throw new NotFoundException("Заведение не найдено");

    const permissions = this.permissions.evaluate({
      role,
      delegatedPermissions: localMembership?.delegatedPermissions.map(({ code }) =>
        code.toLowerCase(),
      ),
      temporaryResponsibility: Boolean(
        localMembership?.temporaryResponsibility &&
        (localMembership.role === "BARTENDER" || localMembership.role === "SENIOR_BARTENDER"),
      ),
      hasBarManager,
      hasChefBartender,
    });
    if (!permissions.includes("invite_employees")) {
      throw new ForbiddenException("У вас нет права приглашать сотрудников в это заведение");
    }
    if (input.role === "BAR_MANAGER" && !permissions.includes("invite_bar_manager")) {
      throw new ForbiddenException("У вас нет права приглашать бар-менеджера");
    }

    await this.lockInvitationTargetInTransaction(
      transaction,
      input.emailNormalized,
      input.companyId,
    );
    await this.closeExpiredTargetInvitationsInTransaction(
      transaction,
      input.emailNormalized,
      input.companyId,
    );

    const existingUser = await transaction.user.findUnique({
      where: { emailNormalized: input.emailNormalized },
      select: { id: true },
    });
    if (
      existingUser &&
      (await transaction.venueMembership.findFirst({
        where: {
          userId: existingUser.id,
          venueId: input.venueId,
          OR: [{ endedOn: null }, { endedOn: { gte: currentDate() } }],
        },
      }))
    ) {
      throw new ConflictException(
        "Этот человек уже состоит в команде выбранного заведения — повторное приглашение не отправлено. Изменение должности выполняется в управлении командой.",
      );
    }
    if (existingUser) {
      const companyMembership = await transaction.companyMembership.findUnique({
        where: { userId_companyId: { userId: existingUser.id, companyId: input.companyId } },
        select: { companyRole: true },
      });
      if (companyMembership?.companyRole === "CHEF_BARTENDER") {
        throw new ConflictException("Этот человек уже является шеф-барменом компании");
      }
    }
    const chefInvitation = await transaction.invitation.findFirst({
      where: {
        companyId: input.companyId,
        purpose: "JOIN_COMPANY_AS_CHEF",
        emailNormalized: input.emailNormalized,
        status: { in: ["ACTIVE", "IN_PROGRESS"] },
      },
      select: { id: true },
    });
    if (chefInvitation) {
      throw new ConflictException(
        "Для этого адреса уже есть приглашение шеф-бармена в компанию. Сначала отзовите его или дождитесь завершения.",
      );
    }

    const replacedInvitations = await transaction.invitation.findMany({
      where: {
        emailNormalized: input.emailNormalized,
        venueId: input.venueId,
        status: { in: ["ACTIVE", "IN_PROGRESS"] },
      },
      select: { id: true },
    });
    await transaction.invitation.updateMany({
      where: {
        emailNormalized: input.emailNormalized,
        venueId: input.venueId,
        status: { in: ["ACTIVE", "IN_PROGRESS"] },
      },
      data: { status: "CLOSED", closedAt: new Date() },
    });
    if (replacedInvitations.length) {
      await transaction.auditEvent.createMany({
        data: replacedInvitations.map(({ id }) => ({
          eventType: "invitation.revoked",
          actorType: "USER",
          actorId: input.actorId,
          companyId: input.companyId,
          venueId: input.venueId,
          entityType: "invitation",
          entityId: id,
          metadata: { reason: "replaced" },
        })),
      });
    }
    await transaction.invitationAcceptanceSession.deleteMany({
      where: {
        invitation: { emailNormalized: input.emailNormalized, venueId: input.venueId },
      },
    });
    const invitation = await transaction.invitation.create({
      data: {
        companyId: input.companyId,
        venueId: input.venueId,
        email: input.email,
        emailNormalized: input.emailNormalized,
        role: input.role,
        tokenHash: input.tokenHash,
        createdByUserId: input.actorId,
        expiresAt: input.expiresAt,
      },
    });
    await transaction.auditEvent.create({
      data: {
        eventType: "invitation.created",
        actorType: "USER",
        actorId: input.actorId,
        companyId: input.companyId,
        venueId: input.venueId,
        entityType: "invitation",
        entityId: invitation.id,
        metadata: { role: input.role },
      },
    });
    return {
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: input.role,
        status: "ACTIVE",
        expiresAt: invitation.expiresAt,
      },
      companyName: venue.company.name,
      venueName: venue.name,
    };
  }

  async lockInvitationTargetInTransaction(
    transaction: Prisma.TransactionClient,
    emailNormalized: string,
    companyId: string,
  ): Promise<void> {
    await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${emailNormalized + ":" + companyId}, 721804))`;
    await this.lockCompanyForMutation(transaction, companyId);
  }

  private async lockCompanyForMutation(
    transaction: Prisma.TransactionClient,
    companyId: string,
  ): Promise<void> {
    const companies = await transaction.$queryRaw<Array<{ status: string }>>`
      SELECT "status" FROM "companies" WHERE "id" = ${companyId}::uuid FOR UPDATE
    `;
    if (!companies.length) throw new NotFoundException("Компания не найдена");
    if (companies[0].status !== "ACTIVE") {
      throw new ConflictException("Компания ожидает закрытия и доступна только для просмотра");
    }
  }

  private async closeExpiredTargetInvitationsInTransaction(
    transaction: Prisma.TransactionClient,
    emailNormalized: string,
    companyId: string,
  ): Promise<void> {
    const now = new Date();
    const expiredInvitations = await transaction.invitation.findMany({
      where: {
        emailNormalized,
        companyId,
        OR: [
          { status: "ACTIVE", expiresAt: { lte: now } },
          {
            status: "IN_PROGRESS",
            OR: [
              { acceptanceSession: { is: null } },
              { acceptanceSession: { is: { expiresAt: { lte: now } } } },
            ],
          },
        ],
      },
      select: { id: true, companyId: true, venueId: true },
    });
    const closedInvitationIds: string[] = [];

    for (const invitation of expiredInvitations) {
      const closed = await transaction.invitation.updateMany({
        where: {
          id: invitation.id,
          emailNormalized,
          companyId,
          OR: [
            { status: "ACTIVE", expiresAt: { lte: now } },
            {
              status: "IN_PROGRESS",
              OR: [
                { acceptanceSession: { is: null } },
                { acceptanceSession: { is: { expiresAt: { lte: now } } } },
              ],
            },
          ],
        },
        data: { status: "CLOSED", closedAt: now },
      });
      if (closed.count !== 1) continue;

      closedInvitationIds.push(invitation.id);
      await transaction.auditEvent.create({
        data: {
          eventType: "invitation.expired",
          actorType: "SYSTEM",
          companyId: invitation.companyId,
          venueId: invitation.venueId,
          entityType: "invitation",
          entityId: invitation.id,
        },
      });
    }

    if (closedInvitationIds.length) {
      await transaction.invitationAcceptanceSession.deleteMany({
        where: { invitationId: { in: closedInvitationIds } },
      });
    }
  }

  async getCompanyChefTeam(
    userId: string,
    companyId: string,
  ): Promise<{
    members: Array<{ id: string; fullName: string; email: string }>;
    invitations: Array<{
      id: string;
      email: string;
      status: "ACTIVE" | "IN_PROGRESS";
      createdAt: Date;
      expiresAt: Date;
    }>;
  }> {
    const company = await this.database.company.findUnique({
      where: { id: companyId },
      include: {
        memberships: { include: { user: { include: { profile: true } } } },
        venues: {
          where: { status: "ACTIVE" },
          include: {
            memberships: {
              where: { OR: [{ endedOn: null }, { endedOn: { gte: currentDate() } }] },
              include: { delegatedPermissions: true, temporaryResponsibility: true },
            },
          },
        },
      },
    });
    if (!company) throw new NotFoundException("Компания не найдена");
    const companyMembership = company.memberships.find(
      ({ userId: memberId }) => memberId === userId,
    );
    const venueMemberships = company.venues.flatMap((venue) =>
      venue.memberships
        .filter(({ userId: memberId }) => memberId === userId)
        .map((membership) => ({ venue, membership })),
    );
    const hasChefBartender = company.memberships.some(
      ({ companyRole }) => companyRole === "CHEF_BARTENDER",
    );
    const hasBarManager = company.venues.some((venue) =>
      venue.memberships.some(({ role }) => role === "BAR_MANAGER"),
    );
    const allowed =
      (companyMembership?.companyRole === "CHEF_BARTENDER" &&
        this.permissions
          .evaluate({ role: "chef_bartender", hasChefBartender, hasBarManager })
          .includes("invite_chef_bartender")) ||
      venueMemberships.some(
        ({ venue, membership }) =>
          membership.role === "BAR_MANAGER" &&
          this.permissions
            .evaluate({
              role: "bar_manager",
              hasChefBartender,
              hasBarManager: venue.memberships.some(({ role }) => role === "BAR_MANAGER"),
            })
            .includes("invite_chef_bartender"),
      );
    if (!allowed) throw new NotFoundException("Управление шеф-барменами недоступно");

    const now = new Date();
    const invitations = await this.database.invitation.findMany({
      where: {
        companyId,
        purpose: "JOIN_COMPANY_AS_CHEF",
        OR: [
          { status: "ACTIVE", expiresAt: { gt: now } },
          { status: "IN_PROGRESS", acceptanceSession: { is: { expiresAt: { gt: now } } } },
        ],
      },
      include: { acceptanceSession: true },
      orderBy: { createdAt: "desc" },
    });
    return {
      members: company.memberships
        .filter(({ companyRole }) => companyRole === "CHEF_BARTENDER")
        .map(({ user }) => ({
          id: user.id,
          fullName: user.profile?.fullName ?? "",
          email: user.email,
        })),
      invitations: invitations.map((invitation) => ({
        id: invitation.id,
        email: invitation.email,
        status: invitation.status as "ACTIVE" | "IN_PROGRESS",
        createdAt: invitation.createdAt,
        expiresAt:
          invitation.status === "IN_PROGRESS" && invitation.acceptanceSession
            ? invitation.acceptanceSession.expiresAt
            : invitation.expiresAt,
      })),
    };
  }

  async createChefInvitationInTransaction(
    transaction: Prisma.TransactionClient,
    input: {
      actorId: string;
      companyId: string;
      email: string;
      emailNormalized: string;
      tokenHash: string;
      expiresAt: Date;
    },
  ): Promise<{
    invitation: {
      id: string;
      email: string;
      purpose: "JOIN_COMPANY_AS_CHEF";
      status: "ACTIVE";
      expiresAt: Date;
    };
    companyName: string;
  }> {
    await this.lockInvitationTargetInTransaction(
      transaction,
      input.emailNormalized,
      input.companyId,
    );
    await this.closeExpiredTargetInvitationsInTransaction(
      transaction,
      input.emailNormalized,
      input.companyId,
    );
    const company = await transaction.company.findUnique({
      where: { id: input.companyId },
      include: {
        memberships: true,
        venues: {
          where: { status: "ACTIVE" },
          include: {
            memberships: {
              where: { OR: [{ endedOn: null }, { endedOn: { gte: currentDate() } }] },
              include: { delegatedPermissions: true, temporaryResponsibility: true },
            },
          },
        },
      },
    });
    if (!company) throw new NotFoundException("Компания не найдена");
    if (company.status !== "ACTIVE") {
      throw new ConflictException("Компания ожидает закрытия и доступна только для просмотра");
    }
    const actorCompanyMembership = company.memberships.find(
      ({ userId }) => userId === input.actorId,
    );
    const actorVenueMemberships = company.venues.flatMap((venue) =>
      venue.memberships
        .filter(({ userId }) => userId === input.actorId)
        .map((membership) => ({ venue, membership })),
    );
    const hasChefBartender = company.memberships.some(
      ({ companyRole }) => companyRole === "CHEF_BARTENDER",
    );
    const canInvite =
      (actorCompanyMembership?.companyRole === "CHEF_BARTENDER" &&
        this.permissions
          .evaluate({
            role: "chef_bartender",
            hasChefBartender,
            hasBarManager: company.venues.some((venue) =>
              venue.memberships.some(({ role }) => role === "BAR_MANAGER"),
            ),
          })
          .includes("invite_chef_bartender")) ||
      actorVenueMemberships.some(
        ({ venue, membership }) =>
          membership.role === "BAR_MANAGER" &&
          this.permissions
            .evaluate({
              role: "bar_manager",
              hasChefBartender,
              hasBarManager: venue.memberships.some(({ role }) => role === "BAR_MANAGER"),
            })
            .includes("invite_chef_bartender"),
      );
    if (!canInvite) throw new ForbiddenException("У вас нет права приглашать шеф-бармена");

    const existingUser = await transaction.user.findUnique({
      where: { emailNormalized: input.emailNormalized },
      select: { id: true },
    });
    if (existingUser) {
      const [membership, localMembership] = await Promise.all([
        transaction.companyMembership.findUnique({
          where: { userId_companyId: { userId: existingUser.id, companyId: input.companyId } },
          select: { companyRole: true },
        }),
        transaction.venueMembership.findFirst({
          where: { userId: existingUser.id, companyId: input.companyId },
          select: { id: true },
        }),
      ]);
      if (membership?.companyRole === "CHEF_BARTENDER") {
        throw new ConflictException("Этот человек уже является шеф-барменом компании");
      }
      if (localMembership) {
        throw new ConflictException(
          "Этот человек уже работает в заведении компании. Сначала измените его роль в управлении командой.",
        );
      }
    }
    const localInvitation = await transaction.invitation.findFirst({
      where: {
        companyId: input.companyId,
        purpose: { in: ["JOIN_EXISTING_VENUE", "CREATE_VENUE_AS_BAR_MANAGER"] },
        emailNormalized: input.emailNormalized,
        status: { in: ["ACTIVE", "IN_PROGRESS"] },
      },
      select: { id: true },
    });
    if (localInvitation) {
      throw new ConflictException(
        "Для этого адреса уже есть несовместимое приглашение в этой компании. Сначала завершите его или отзовите.",
      );
    }

    const replaced = await transaction.invitation.findMany({
      where: {
        companyId: input.companyId,
        purpose: "JOIN_COMPANY_AS_CHEF",
        emailNormalized: input.emailNormalized,
        status: { in: ["ACTIVE", "IN_PROGRESS"] },
      },
      select: { id: true },
    });
    await transaction.invitation.updateMany({
      where: {
        companyId: input.companyId,
        purpose: "JOIN_COMPANY_AS_CHEF",
        emailNormalized: input.emailNormalized,
        status: { in: ["ACTIVE", "IN_PROGRESS"] },
      },
      data: { status: "CLOSED", closedAt: new Date() },
    });
    if (replaced.length) {
      await transaction.auditEvent.createMany({
        data: replaced.map(({ id }) => ({
          eventType: "invitation.revoked",
          actorType: "USER",
          actorId: input.actorId,
          companyId: input.companyId,
          entityType: "invitation",
          entityId: id,
          metadata: { reason: "replaced" },
        })),
      });
      await transaction.invitationAcceptanceSession.deleteMany({
        where: { invitationId: { in: replaced.map(({ id }) => id) } },
      });
    }
    const invitation = await transaction.invitation.create({
      data: {
        companyId: input.companyId,
        purpose: "JOIN_COMPANY_AS_CHEF",
        email: input.email,
        emailNormalized: input.emailNormalized,
        tokenHash: input.tokenHash,
        createdByUserId: input.actorId,
        expiresAt: input.expiresAt,
      },
    });
    await transaction.auditEvent.create({
      data: {
        eventType: "invitation.created",
        actorType: "USER",
        actorId: input.actorId,
        companyId: input.companyId,
        entityType: "invitation",
        entityId: invitation.id,
        metadata: { purpose: "JOIN_COMPANY_AS_CHEF", role: "CHEF_BARTENDER" },
      },
    });
    return {
      invitation: {
        id: invitation.id,
        email: invitation.email,
        purpose: "JOIN_COMPANY_AS_CHEF",
        status: "ACTIVE",
        expiresAt: invitation.expiresAt,
      },
      companyName: company.name,
    };
  }

  async revokeChefInvitationInTransaction(
    transaction: Prisma.TransactionClient,
    input: { actorId: string; companyId: string; invitationId: string },
  ): Promise<void> {
    await this.lockCompanyForMutation(transaction, input.companyId);
    const invitation = await transaction.invitation.findFirst({
      where: {
        id: input.invitationId,
        companyId: input.companyId,
        purpose: "JOIN_COMPANY_AS_CHEF",
        status: { in: ["ACTIVE", "IN_PROGRESS"] },
      },
      select: { id: true },
    });
    if (!invitation) throw new NotFoundException("Приглашение не найдено");
    const company = await transaction.company.findUnique({
      where: { id: input.companyId },
      include: {
        memberships: true,
        venues: {
          include: {
            memberships: {
              where: { OR: [{ endedOn: null }, { endedOn: { gte: currentDate() } }] },
            },
          },
        },
      },
    });
    if (!company) throw new NotFoundException("Компания не найдена");
    if (company.status !== "ACTIVE") {
      throw new ConflictException("Компания ожидает закрытия и доступна только для просмотра");
    }
    const isCompanyChef = company.memberships.some(
      ({ userId, companyRole }) => userId === input.actorId && companyRole === "CHEF_BARTENDER",
    );
    const isCompanyManager = company.venues.some((venue) =>
      venue.memberships.some(
        ({ userId, role }) => userId === input.actorId && role === "BAR_MANAGER",
      ),
    );
    const isCreator = await transaction.invitation.findFirst({
      where: { id: invitation.id, createdByUserId: input.actorId },
      select: { id: true },
    });
    if (!isCreator && !isCompanyChef && !isCompanyManager) {
      throw new ForbiddenException("У вас нет права отзывать это приглашение");
    }
    const now = new Date();
    const closed = await transaction.invitation.updateMany({
      where: { id: invitation.id, status: { in: ["ACTIVE", "IN_PROGRESS"] } },
      data: { status: "CLOSED", closedAt: now },
    });
    if (closed.count !== 1) throw new ConflictException("Приглашение уже закрыто");
    await transaction.auditEvent.create({
      data: {
        eventType: "invitation.revoked",
        actorType: "USER",
        actorId: input.actorId,
        companyId: input.companyId,
        entityType: "invitation",
        entityId: invitation.id,
      },
    });
    await transaction.invitationAcceptanceSession.deleteMany({
      where: { invitationId: invitation.id },
    });
  }

  async closeConflictingInvitationsInTransaction(
    transaction: Prisma.TransactionClient,
    input: {
      companyId: string;
      emailNormalized: string;
      completedInvitationId: string;
      actorId: string;
    },
  ): Promise<void> {
    const company = await transaction.company.findUnique({
      where: { id: input.companyId },
      select: { status: true },
    });
    if (!company || company.status !== "ACTIVE") {
      throw new ConflictException("Компания ожидает закрытия и доступна только для просмотра");
    }
    const conflicts = await transaction.invitation.findMany({
      where: {
        companyId: input.companyId,
        emailNormalized: input.emailNormalized,
        purpose: { in: ["JOIN_EXISTING_VENUE", "CREATE_VENUE_AS_BAR_MANAGER"] },
        status: { in: ["ACTIVE", "IN_PROGRESS"] },
        id: { not: input.completedInvitationId },
      },
      select: { id: true, venueId: true },
    });
    if (!conflicts.length) return;
    const now = new Date();
    const closed = await transaction.invitation.updateMany({
      where: {
        id: { in: conflicts.map(({ id }) => id) },
        status: { in: ["ACTIVE", "IN_PROGRESS"] },
      },
      data: { status: "CLOSED", closedAt: now },
    });
    if (!closed.count) return;
    const stillOpen = await transaction.invitation.findMany({
      where: {
        id: { in: conflicts.map(({ id }) => id) },
        status: "CLOSED",
        closedAt: now,
      },
      select: { id: true, venueId: true },
    });
    await transaction.auditEvent.createMany({
      data: stillOpen.map(({ id, venueId }) => ({
        eventType: "invitation.revoked",
        actorType: "USER",
        actorId: input.actorId,
        companyId: input.companyId,
        venueId,
        entityType: "invitation",
        entityId: id,
        metadata: {
          reason: "chef_role_assigned",
          replacedByInvitationId: input.completedInvitationId,
        },
      })),
    });
    await transaction.invitationAcceptanceSession.deleteMany({
      where: { invitationId: { in: stillOpen.map(({ id }) => id) } },
    });
  }

  async revokeInvitationInTransaction(
    transaction: Prisma.TransactionClient,
    input: { actorId: string; companyId: string; venueId: string; invitationId: string },
  ): Promise<void> {
    await this.lockCompanyForMutation(transaction, input.companyId);
    const invitation = await transaction.invitation.findFirst({
      where: {
        id: input.invitationId,
        companyId: input.companyId,
        venueId: input.venueId,
        status: { in: ["ACTIVE", "IN_PROGRESS"] },
      },
      include: {
        venue: {
          include: {
            memberships: {
              where: { OR: [{ endedOn: null }, { endedOn: { gte: currentDate() } }] },
              include: { delegatedPermissions: true, temporaryResponsibility: true },
            },
            company: { include: { memberships: true } },
          },
        },
      },
    });
    if (!invitation || !invitation.venue) throw new NotFoundException("Приглашение не найдено");
    if (invitation.venue.company.status !== "ACTIVE") {
      throw new ConflictException("Компания ожидает закрытия и доступна только для просмотра");
    }

    const companyMembership = invitation.venue.company.memberships.find(
      ({ userId }) => userId === input.actorId,
    );
    const localMembership = invitation.venue.memberships.find(
      ({ userId }) => userId === input.actorId,
    );
    const role = companyMembership?.companyRole
      ? "chef_bartender"
      : localMembership
        ? toWorkspaceRole(localMembership.role)
        : null;
    const permissions = role
      ? this.permissions.evaluate({
          role,
          delegatedPermissions: localMembership?.delegatedPermissions.map(({ code }) =>
            code.toLowerCase(),
          ),
          temporaryResponsibility: Boolean(
            localMembership?.temporaryResponsibility &&
            (localMembership.role === "BARTENDER" || localMembership.role === "SENIOR_BARTENDER"),
          ),
          hasBarManager: invitation.venue.memberships.some(({ role }) => role === "BAR_MANAGER"),
          hasChefBartender: invitation.venue.company.memberships.some(
            ({ companyRole }) => companyRole === "CHEF_BARTENDER",
          ),
        })
      : [];
    const isCreator = invitation.createdByUserId === input.actorId;
    if (!isCreator && !permissions.includes("manage_team")) {
      throw new ForbiddenException("У вас нет права отзывать это приглашение");
    }

    const now = new Date();
    await transaction.invitation.update({
      where: { id: invitation.id },
      data: { status: "CLOSED", closedAt: now },
    });
    await transaction.auditEvent.create({
      data: {
        eventType: "invitation.revoked",
        actorType: "USER",
        actorId: input.actorId,
        companyId: input.companyId,
        venueId: input.venueId,
        entityType: "invitation",
        entityId: invitation.id,
      },
    });
    await transaction.invitationAcceptanceSession.deleteMany({
      where: { invitationId: invitation.id },
    });
  }

  async findInvitationByToken(tokenHash: string): Promise<{
    purpose: "JOIN_EXISTING_VENUE" | "JOIN_COMPANY_AS_CHEF" | "CREATE_VENUE_AS_BAR_MANAGER";
    company: { name: string };
    venue: { name: string } | null;
    role: VenueInviteRole | null;
    roleLabel: string;
    accessDescription: string | null;
    email: string;
    expiresAt: Date;
  } | null> {
    const now = new Date();
    const invitation = await this.database.invitation.findFirst({
      where: {
        tokenHash,
        OR: [
          { status: "ACTIVE", expiresAt: { gt: now } },
          {
            status: "IN_PROGRESS",
            acceptanceSession: { is: { expiresAt: { gt: now } } },
          },
        ],
      },
      include: { company: true, venue: true, acceptanceSession: true },
    });
    if (!invitation) {
      const expired = await this.database.invitation.findFirst({
        where: {
          tokenHash,
          OR: [
            { status: "ACTIVE", expiresAt: { lte: now } },
            {
              status: "IN_PROGRESS",
              OR: [
                { acceptanceSession: { is: null } },
                { acceptanceSession: { is: { expiresAt: { lte: now } } } },
              ],
            },
          ],
        },
        select: { id: true, companyId: true, venueId: true },
      });
      if (expired) {
        await this.database.$transaction(async (transaction) => {
          const closed = await transaction.invitation.updateMany({
            where: {
              id: expired.id,
              OR: [
                { status: "ACTIVE", expiresAt: { lte: now } },
                {
                  status: "IN_PROGRESS",
                  OR: [
                    { acceptanceSession: { is: null } },
                    { acceptanceSession: { is: { expiresAt: { lte: now } } } },
                  ],
                },
              ],
            },
            data: { status: "CLOSED", closedAt: now },
          });
          if (closed.count === 1) {
            await transaction.auditEvent.create({
              data: {
                eventType: "invitation.expired",
                actorType: "SYSTEM",
                companyId: expired.companyId,
                venueId: expired.venueId,
                entityType: "invitation",
                entityId: expired.id,
              },
            });
            await transaction.invitationAcceptanceSession.deleteMany({
              where: { invitationId: expired.id },
            });
          }
        });
      }
      return null;
    }
    const roleLabel =
      invitation.purpose === "JOIN_COMPANY_AS_CHEF"
        ? "Шеф-бармен"
        : {
            BARTENDER: "Бармен",
            SENIOR_BARTENDER: "Старший бармен",
            BARBACK: "Барбек",
            TRAINEE: "Стажёр",
            BAR_MANAGER: "Бар-менеджер",
          }[invitation.role!];
    return {
      purpose: invitation.purpose,
      company: { name: invitation.company.name },
      venue: invitation.venue ? { name: invitation.venue.name } : null,
      role: invitation.role,
      roleLabel,
      accessDescription:
        invitation.purpose === "JOIN_COMPANY_AS_CHEF" ? "Доступ ко всем заведениям компании" : null,
      email: invitation.email,
      expiresAt: invitation.expiresAt,
    };
  }
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

function currentDate(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}
