import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DATABASE_CLIENT, type Prisma, type PrismaClient } from "@bartech/database";
import { EmailOutboxService } from "@bartech/backend-identity";
import { ExportRepository, ExportService } from "@bartech/backend-exports";
import { OrganizationsService } from "@bartech/backend-organizations";
import type { ExportKind, ExportParameters } from "@bartech/backend-exports";
import { SupportAccessService } from "@bartech/backend-support";

const COMPANY_CLOSURE_MS = 168 * 60 * 60_000;

@Injectable()
export class OrganizationLifecycleService {
  constructor(
    @Inject(DATABASE_CLIENT) private readonly database: PrismaClient,
    private readonly outbox: EmailOutboxService,
    private readonly exports: ExportRepository,
    private readonly exportService: ExportService,
    private readonly organizations: OrganizationsService,
    private readonly config: ConfigService,
    private readonly supportAccess: SupportAccessService,
  ) {}

  async getCompanyClosure(userId: string, companyId: string) {
    const company = await this.database.company.findUnique({
      where: { id: companyId },
      include: {
        memberships: { select: { userId: true, companyRole: true } },
        productExportClosures: {
          where: { status: "PENDING_CLOSURE", createdByUserId: userId },
          select: { id: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        venues: {
          where: { status: "ACTIVE" },
          include: { memberships: { select: { userId: true, role: true } } },
        },
      },
    });
    if (!company || !company.memberships.some(({ userId: memberId }) => memberId === userId)) {
      throw new NotFoundException("Состояние компании недоступно");
    }
    if (
      company.status === "PENDING_CLOSURE" &&
      (!company.closureDeadline || company.closureDeadline <= new Date())
    ) {
      throw new NotFoundException("Состояние компании недоступно");
    }
    const canCancel =
      company.memberships.some(
        ({ userId: memberId, companyRole }) =>
          memberId === userId && companyRole === "CHEF_BARTENDER",
      ) ||
      company.venues.some((venue) =>
        venue.memberships.some(
          ({ userId: memberId, role }) => memberId === userId && role === "BAR_MANAGER",
        ),
      );
    return {
      status: company.status,
      closureDeadline: company.closureDeadline,
      canCancel: company.status === "PENDING_CLOSURE" && canCancel,
      operationId: company.productExportClosures[0]?.id ?? null,
    };
  }

  async prepareClosure(userId: string, companyId: string, venueId?: string) {
    if (!venueId) {
      const company = await this.database.company.findUnique({
        where: { id: companyId },
        include: { memberships: true, venues: { include: { memberships: true } } },
      });
      const membership = company?.memberships.find(({ userId: memberId }) => memberId === userId);
      if (
        !company ||
        company.status !== "ACTIVE" ||
        membership?.companyRole !== "CHEF_BARTENDER" ||
        company.venues.some((venue) => venue.memberships.some(({ userId: id }) => id === userId))
      ) {
        throw new NotFoundException("Компания недоступна для закрытия");
      }
      const existing = await this.database.productExportClosureOperation.findFirst({
        where: {
          createdByUserId: userId,
          originalCompanyId: companyId,
          type: "COMPANY",
          status: "PREPARING",
        },
        orderBy: { createdAt: "desc" },
        select: { id: true, type: true, status: true },
      });
      if (existing) return existing;
      return this.database.productExportClosureOperation.create({
        data: {
          createdByUserId: userId,
          type: "COMPANY",
          companyId,
          originalCompanyId: companyId,
          originalCompanyName: company.name,
        },
        select: { id: true, type: true, status: true },
      });
    }

    const workspace = await this.organizations.findWorkspaceForUser(userId, companyId, venueId);
    const venue = await this.database.venue.findFirst({
      where: { id: venueId, companyId, status: "ACTIVE", company: { status: "ACTIVE" } },
      include: {
        memberships: {
          select: {
            userId: true,
            role: true,
            temporaryResponsibility: { select: { id: true } },
          },
        },
        company: {
          select: {
            id: true,
            name: true,
            memberships: { select: { userId: true, companyRole: true } },
          },
        },
      },
    });
    const actorMember = venue?.memberships.find(({ userId: id }) => id === userId);
    const hasManager = venue?.memberships.some(({ role }) => role === "BAR_MANAGER") ?? false;
    const hasChef =
      venue?.company.memberships.some(({ companyRole }) => companyRole === "CHEF_BARTENDER") ??
      false;
    const actorHasCompanyRole =
      venue?.company.memberships.some(({ userId: id }) => id === userId) ?? false;
    const isLastLocalEmployee = Boolean(
      venue?.memberships.length === 1 &&
      actorMember?.userId === userId &&
      (actorMember.role === "BARTENDER" || actorMember.role === "SENIOR_BARTENDER") &&
      !actorHasCompanyRole,
    );
    const isAuthorized = Boolean(
      workspace &&
      venue &&
      (actorMember?.role === "BAR_MANAGER" ||
        workspace.role === "chef_bartender" ||
        (actorMember?.temporaryResponsibility &&
          (actorMember.role === "BARTENDER" || actorMember.role === "SENIOR_BARTENDER") &&
          !hasManager &&
          !hasChef) ||
        isLastLocalEmployee),
    );
    if (!isAuthorized || !venue || !workspace) {
      throw new NotFoundException("Заведение недоступно для закрытия");
    }
    const existing = await this.database.productExportClosureOperation.findFirst({
      where: {
        createdByUserId: userId,
        originalCompanyId: companyId,
        originalVenueId: venueId,
        type: "VENUE",
        status: "PREPARING",
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, type: true, status: true },
    });
    if (existing) return existing;
    return this.database.productExportClosureOperation.create({
      data: {
        createdByUserId: userId,
        type: "VENUE",
        companyId,
        venueId,
        originalCompanyId: companyId,
        originalVenueId: venueId,
        originalCompanyName: venue.company.name,
        originalVenueName: venue.name,
      },
      select: { id: true, type: true, status: true },
    });
  }

  async createClosureExport(
    userId: string,
    companyId: string,
    operationId: string,
    type: ExportKind,
    parameters: ExportParameters,
  ) {
    const operation = await this.database.productExportClosureOperation.findFirst({
      where: { id: operationId, createdByUserId: userId, originalCompanyId: companyId },
    });
    if (!operation || !["PREPARING", "PENDING_CLOSURE"].includes(operation.status)) {
      throw new NotFoundException("Операция закрытия недоступна");
    }
    if (operation.type === "COMPANY") {
      if (type !== "COMPANY_CLOSURE_BACKUP_ZIP") {
        throw new ConflictException("Для закрытия компании доступна резервная выгрузка компании");
      }
      const company = await this.database.company.findUnique({
        where: { id: companyId },
        include: { memberships: true, venues: { where: { status: "ACTIVE" } } },
      });
      const isChef = company?.memberships.some(
        ({ userId: memberId, companyRole }) =>
          memberId === userId && companyRole === "CHEF_BARTENDER",
      );
      if (!company || !["ACTIVE", "PENDING_CLOSURE"].includes(company.status) || !isChef) {
        throw new NotFoundException("Компания недоступна для выгрузки");
      }
      const workspaces = await Promise.all(
        company.venues.map((venue) =>
          this.organizations.findWorkspaceForUser(userId, companyId, venue.id),
        ),
      );
      if (
        workspaces.some(
          (workspace) =>
            !workspace?.permissions.includes("export_data") ||
            !workspace.permissions.includes("view_archive"),
        )
      ) {
        throw new NotFoundException("Компания недоступна для выгрузки");
      }
      return this.exportService.createClosureExport({
        context: { userId, companyId, venueId: null },
        operationId,
        type,
        parameters: {
          venueIds: company.venues.map(({ id }) => id),
          companyName: company.name,
        },
      });
    }
    const venueId = operation.venueId;
    if (!venueId || type === "COMPANY_CLOSURE_BACKUP_ZIP") {
      throw new NotFoundException("Операция закрытия недоступна");
    }
    const workspace = await this.organizations.findWorkspaceForUser(userId, companyId, venueId);
    const company = await this.database.company.findUnique({
      where: { id: companyId },
      select: { status: true },
    });
    if (!workspace?.permissions.includes("export_data") || company?.status !== "ACTIVE") {
      throw new NotFoundException("Заведение недоступно для выгрузки");
    }
    return this.exportService.createClosureExport({
      context: { userId, companyId, venueId },
      operationId,
      type,
      parameters,
    });
  }

  async getClosureOperation(userId: string, operationId: string) {
    const operation = await this.database.productExportClosureOperation.findUnique({
      where: { id: operationId },
      include: { exportRequest: true },
    });
    if (!operation || operation.createdByUserId !== userId) {
      throw new NotFoundException("Операция закрытия недоступна");
    }
    if (operation.status !== "CLOSED") {
      const company = await this.database.company.findUnique({
        where: { id: operation.companyId ?? "" },
        include: { venues: { where: { status: "ACTIVE" } } },
      });
      const workspace = operation.venueId
        ? await this.organizations.findWorkspaceForUser(
            userId,
            operation.originalCompanyId,
            operation.venueId,
          )
        : null;
      const companyMember = await this.database.companyMembership.findFirst({
        where: {
          userId,
          companyId: operation.originalCompanyId,
          companyRole: "CHEF_BARTENDER",
        },
      });
      if (
        !company ||
        (operation.type === "VENUE" && !workspace) ||
        (operation.type === "COMPANY" && !companyMember)
      ) {
        throw new NotFoundException("Операция закрытия недоступна");
      }
      if (
        operation.exportRequest &&
        operation.type === "VENUE" &&
        (!workspace?.permissions.includes("export_data") ||
          (operation.exportRequest.type === "VENUE_BACKUP_ZIP" &&
            !workspace.permissions.includes("view_archive")))
      ) {
        throw new NotFoundException("Операция закрытия недоступна");
      }
      if (operation.exportRequest && operation.type === "COMPANY") {
        const workspaces = await Promise.all(
          company.venues.map(({ id }) =>
            this.organizations.findWorkspaceForUser(userId, operation.originalCompanyId, id),
          ),
        );
        if (
          workspaces.some(
            (item) =>
              !item?.permissions.includes("export_data") ||
              !item.permissions.includes("view_archive"),
          )
        ) {
          throw new NotFoundException("Операция закрытия недоступна");
        }
      }
    }
    const request = operation.exportRequest;
    const visibleRequest =
      operation.status === "CLOSED" &&
      request &&
      (request.status !== "READY" || !request.expiresAt || request.expiresAt <= new Date())
        ? null
        : request;
    return {
      id: operation.id,
      type: operation.type,
      status: operation.status,
      originalCompanyName: operation.originalCompanyName,
      originalVenueName: operation.originalVenueName,
      closedAt: operation.closedAt?.toISOString() ?? null,
      export: visibleRequest
        ? {
            id: visibleRequest.id,
            type: visibleRequest.type,
            status:
              visibleRequest.status === "READY" &&
              visibleRequest.expiresAt &&
              visibleRequest.expiresAt <= new Date()
                ? "EXPIRED"
                : visibleRequest.status,
            createdAt: visibleRequest.createdAt.toISOString(),
            expiresAt: visibleRequest.expiresAt?.toISOString() ?? null,
            errorCode: visibleRequest.status === "FAILED" ? visibleRequest.errorCode : null,
          }
        : null,
    };
  }

  async getClosureOperationDownload(userId: string, operationId: string) {
    const operation = await this.database.productExportClosureOperation.findUnique({
      where: { id: operationId },
      select: {
        type: true,
        status: true,
        companyId: true,
        venueId: true,
        originalCompanyId: true,
      },
    });
    if (!operation) throw new NotFoundException("Операция закрытия недоступна");
    if (operation.status === "CLOSED") {
      return this.exportService.getClosureDownloadUrl(userId, operationId);
    }
    await this.getClosureOperation(userId, operationId);
    if (operation.type === "VENUE" && operation.venueId) {
      const workspace = await this.organizations.findWorkspaceForUser(
        userId,
        operation.originalCompanyId,
        operation.venueId,
      );
      if (!workspace?.permissions.includes("export_data")) {
        throw new NotFoundException("Выгрузка закрытия недоступна");
      }
    } else {
      const company = await this.database.company.findUnique({
        where: { id: operation.companyId ?? "" },
        include: { venues: { where: { status: "ACTIVE" } } },
      });
      if (!company) throw new NotFoundException("Выгрузка закрытия недоступна");
      const workspaces = await Promise.all(
        company.venues.map(({ id }) =>
          this.organizations.findWorkspaceForUser(userId, operation.originalCompanyId, id),
        ),
      );
      if (
        workspaces.some(
          (workspace) =>
            !workspace?.permissions.includes("export_data") ||
            !workspace.permissions.includes("view_archive"),
        )
      ) {
        throw new NotFoundException("Выгрузка закрытия недоступна");
      }
    }
    return this.exportService.getActiveClosureDownloadUrl(
      userId,
      operationId,
      operation.originalCompanyId,
    );
  }

  async closeVenue(
    actorId: string,
    companyId: string,
    venueId: string,
    expectedName: string,
    operationId: string,
    exportRequestId: string | undefined,
    withoutExport: boolean,
    asLastLocalEmployee = false,
  ) {
    return this.database.$transaction(async (transaction) => {
      const companies = await transaction.$queryRaw<Array<{ id: string; status: string }>>`
        SELECT "id", "status"
        FROM "companies"
        WHERE "id" = ${companyId}::uuid
        FOR UPDATE
      `;
      const company = companies[0];
      if (!company) throw new NotFoundException("Заведение недоступно");
      if (company.status !== "ACTIVE") {
        throw new ConflictException("Компания ожидает закрытия и доступна только для просмотра");
      }

      const venues = await transaction.$queryRaw<Array<{ id: string; name: string }>>`
        SELECT "id", "name"
        FROM "venues"
        WHERE "id" = ${venueId}::uuid
          AND "companyId" = ${companyId}::uuid
          AND "status" = 'ACTIVE'
        FOR UPDATE
      `;
      const venue = venues[0];
      if (!venue) throw new NotFoundException("Заведение недоступно");
      if (venue.name !== expectedName) {
        throw new ConflictException("Название заведения не совпадает");
      }

      const [companyMemberships, venueMemberships, venueCount] = await Promise.all([
        transaction.companyMembership.findMany({
          where: { companyId },
          select: { userId: true, companyRole: true },
        }),
        transaction.venueMembership.findMany({
          where: { companyId, venueId },
          include: {
            temporaryResponsibility: { select: { id: true } },
            delegatedPermissions: { select: { code: true } },
          },
        }),
        transaction.venue.count({ where: { companyId, status: "ACTIVE" } }),
      ]);
      const actorCompanyMembership = companyMemberships.find(({ userId }) => userId === actorId);
      const actorVenueMembership = venueMemberships.find(({ userId }) => userId === actorId);
      const isLastLocalEmployeeAction =
        venueMemberships.length === 1 &&
        actorVenueMembership?.userId === actorId &&
        (actorVenueMembership.role === "BARTENDER" ||
          actorVenueMembership.role === "SENIOR_BARTENDER") &&
        !actorCompanyMembership?.companyRole;
      const hasChef = companyMemberships.some(
        ({ companyRole }) => companyRole === "CHEF_BARTENDER",
      );
      const hasManager = venueMemberships.some(({ role }) => role === "BAR_MANAGER");
      const isChef = actorCompanyMembership?.companyRole === "CHEF_BARTENDER";
      const isManager = actorVenueMembership?.role === "BAR_MANAGER";
      const isTemporaryResponsible = Boolean(
        actorVenueMembership?.temporaryResponsibility &&
        (actorVenueMembership.role === "BARTENDER" ||
          actorVenueMembership.role === "SENIOR_BARTENDER") &&
        !hasChef &&
        !hasManager,
      );
      if (actorCompanyMembership?.companyRole && actorVenueMembership) {
        throw new ConflictException("У сотрудника обнаружены несовместимые полномочия");
      }
      const isAuthorized = asLastLocalEmployee
        ? isLastLocalEmployeeAction
        : isChef || isManager || isTemporaryResponsible;
      if (!isAuthorized) {
        throw new NotFoundException("Заведение недоступно");
      }

      const operation = await transaction.productExportClosureOperation.findFirst({
        where: {
          id: operationId,
          createdByUserId: actorId,
          type: "VENUE",
          status: "PREPARING",
          companyId,
          venueId,
        },
        include: { exportRequest: true },
      });
      if (!operation || withoutExport === Boolean(exportRequestId)) {
        throw new ConflictException("Выбор выгрузки для закрытия не совпадает");
      }
      const selectedExport = exportRequestId ? operation.exportRequest : null;
      const actorCanExport = Boolean(
        isChef ||
        isManager ||
        actorVenueMembership?.delegatedPermissions.some(({ code }) => code === "EXPORT_DATA"),
      );
      if (
        exportRequestId &&
        (!selectedExport ||
          !actorCanExport ||
          selectedExport.id !== exportRequestId ||
          selectedExport.userId !== actorId ||
          selectedExport.companyId !== companyId ||
          selectedExport.venueId !== venueId ||
          selectedExport.closureOperationId !== operation.id ||
          selectedExport.status !== "READY" ||
          !selectedExport.expiresAt ||
          selectedExport.expiresAt <= new Date())
      ) {
        throw new ConflictException("Выгрузка ещё не готова или недоступна");
      }
      const staleOperations = await transaction.productExportClosureOperation.findMany({
        where: {
          companyId,
          venueId,
          status: "PREPARING",
          id: { not: operation.id },
        },
        include: { exportRequest: { select: { id: true } } },
      });

      const willDeleteCompany = venueCount === 1 && !hasChef;
      await this.exports.markScopeForCleanup(
        transaction,
        willDeleteCompany ? { companyId } : { companyId, venueId },
        selectedExport?.id,
      );
      if (selectedExport) {
        await transaction.productExportRequest.update({
          where: { id: selectedExport.id },
          data: { companyId: null, venueId: null },
        });
      }
      const unfinishedInvitations = await transaction.invitation.findMany({
        where: { companyId, venueId, status: { in: ["ACTIVE", "IN_PROGRESS"] } },
        select: { id: true },
      });
      if (unfinishedInvitations.length) {
        const now = new Date();
        await transaction.invitation.updateMany({
          where: { id: { in: unfinishedInvitations.map(({ id }) => id) } },
          data: { status: "CLOSED", closedAt: now },
        });
        await transaction.invitationAcceptanceSession.deleteMany({
          where: { invitationId: { in: unfinishedInvitations.map(({ id }) => id) } },
        });
      }
      const affectedMembers = venueMemberships.map(({ userId }) => userId);
      await this.supportAccess.revokeForVenue(transaction, companyId, venueId);
      await transaction.auditEvent.create({
        data: {
          eventType: "venue.closed",
          actorType: "USER",
          actorId,
          companyId,
          venueId,
          entityType: "VENUE",
          entityId: venueId,
          metadata: {
            name: venue.name,
            closedAt: new Date().toISOString(),
            closureOperationId: operation.id,
            exportRequestId: selectedExport?.id ?? null,
          },
        },
      });
      await transaction.productExportClosureOperation.update({
        where: { id: operation.id },
        data: { status: "CLOSED", closedAt: new Date(), companyId: null, venueId: null },
      });
      for (const stale of staleOperations) {
        if (stale.exportRequest) {
          await transaction.productExportClosureOperation.update({
            where: { id: stale.id },
            data: { status: "CANCELLED", cancelledAt: new Date(), companyId: null, venueId: null },
          });
        } else {
          await transaction.productExportClosureOperation.delete({ where: { id: stale.id } });
        }
      }
      await transaction.venue.delete({ where: { id: venueId } });

      for (const userId of affectedMembers) {
        const companyMembership = companyMemberships.find(
          (membership) => membership.userId === userId,
        );
        if (companyMembership?.companyRole === "CHEF_BARTENDER") continue;
        const otherVenueMembership = await transaction.venueMembership.findFirst({
          where: { companyId, userId },
          select: { id: true },
        });
        if (!otherVenueMembership) {
          await transaction.companyMembership.deleteMany({ where: { companyId, userId } });
        }
      }

      if (willDeleteCompany) {
        await this.closeCompanyInvitations(transaction, companyId, actorId);
        await transaction.company.delete({ where: { id: companyId } });
      }
      return { accepted: true as const, companyDeleted: willDeleteCompany, operationId };
    });
  }

  async canLeaveAndCloseVenue(userId: string, companyId: string, venueId: string) {
    const venue = await this.database.venue.findFirst({
      where: {
        id: venueId,
        companyId,
        status: "ACTIVE",
        company: { status: "ACTIVE", memberships: { some: { userId } } },
      },
      select: {
        memberships: {
          select: {
            userId: true,
            role: true,
            companyMembership: { select: { companyRole: true } },
          },
        },
      },
    });
    return Boolean(
      venue?.memberships.length === 1 &&
      venue.memberships[0].userId === userId &&
      (venue.memberships[0].role === "BARTENDER" ||
        venue.memberships[0].role === "SENIOR_BARTENDER") &&
      !venue.memberships[0].companyMembership.companyRole,
    );
  }

  async beginCompanyClosure(
    actorId: string,
    companyId: string,
    expectedName: string,
    operationId?: string,
    withoutExport = false,
  ) {
    return this.database.$transaction(async (transaction) => {
      const lockedCompanies = await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "companies" WHERE "id" = ${companyId}::uuid FOR UPDATE
      `;
      if (!lockedCompanies.length) throw new NotFoundException("Компания недоступна");
      const company = await transaction.company.findUnique({
        where: { id: companyId },
        include: {
          memberships: { include: { user: { select: { id: true, email: true } } } },
          venues: { include: { memberships: true } },
        },
      });
      if (!company) throw new NotFoundException("Компания недоступна");
      if (company.name !== expectedName)
        throw new ConflictException("Название компании не совпадает");
      if (company.status !== "ACTIVE") {
        throw new ConflictException("Закрытие компании уже запущено");
      }
      const actorIsChef = company.memberships.some(
        ({ userId, companyRole }) => userId === actorId && companyRole === "CHEF_BARTENDER",
      );
      const actorHasVenueMembership = company.venues.some((venue) =>
        venue.memberships.some(({ userId }) => userId === actorId),
      );
      if (actorIsChef && actorHasVenueMembership) {
        throw new ConflictException("У сотрудника обнаружены несовместимые полномочия");
      }
      if (!actorIsChef) {
        throw new NotFoundException("Компания недоступна");
      }
      await this.supportAccess.revokeForCompany(transaction, companyId);
      let operation = operationId
        ? await transaction.productExportClosureOperation.findFirst({
            where: {
              id: operationId,
              createdByUserId: actorId,
              originalCompanyId: companyId,
              type: "COMPANY",
              status: "PREPARING",
            },
            include: { exportRequest: true },
          })
        : null;
      if (operationId && !operation) {
        throw new ConflictException("Операция закрытия компании недоступна");
      }
      if (!operation) {
        operation = await transaction.productExportClosureOperation.create({
          data: {
            createdByUserId: actorId,
            type: "COMPANY",
            companyId,
            originalCompanyId: companyId,
            originalCompanyName: company.name,
          },
          include: { exportRequest: true },
        });
      }
      if (withoutExport && operation.exportRequest) {
        await transaction.productExportRequest.update({
          where: { id: operation.exportRequest.id },
          data: { closureOperationId: null },
        });
      }
      const deadline = new Date(Date.now() + COMPANY_CLOSURE_MS);
      await transaction.company.update({
        where: { id: companyId },
        data: { status: "PENDING_CLOSURE", closureDeadline: deadline },
      });
      await transaction.auditEvent.create({
        data: {
          eventType: "company.closure_started",
          actorType: "USER",
          actorId,
          companyId,
          entityType: "COMPANY",
          entityId: companyId,
          metadata: {
            name: company.name,
            closureDeadline: deadline.toISOString(),
            closureOperationId: operation.id,
            exportRequestId: withoutExport ? null : (operation.exportRequest?.id ?? null),
          },
        },
      });
      await transaction.productExportClosureOperation.update({
        where: { id: operation.id },
        data: { status: "PENDING_CLOSURE" },
      });

      const recipients = new Map<string, string>();
      for (const membership of company.memberships) {
        if (membership.companyRole === "CHEF_BARTENDER") {
          recipients.set(membership.user.id, membership.user.email);
        }
      }
      for (const venue of company.venues) {
        for (const membership of venue.memberships) {
          if (membership.role === "BAR_MANAGER") {
            const user = await transaction.user.findUnique({
              where: { id: membership.userId },
              select: { id: true, email: true },
            });
            if (user) recipients.set(user.id, user.email);
          }
        }
      }
      const deadlineText = new Intl.DateTimeFormat("ru-RU", {
        dateStyle: "long",
        timeStyle: "short",
        timeZone: "Europe/Moscow",
      }).format(deadline);
      const appOrigin = this.config.getOrThrow<string>("APP_ORIGIN");
      for (const email of recipients.values()) {
        await this.outbox.enqueue(transaction, "organization.company_closure", {
          to: email,
          subject: `Закрытие компании «${company.name}»`,
          text: `Компания «${company.name}» запланирована к окончательному закрытию ${deadlineText} по московскому времени. До этого момента закрытие можно отменить в приложении: ${appOrigin}`,
        });
      }
      return {
        status: "PENDING_CLOSURE" as const,
        closureDeadline: deadline,
        operationId: operation.id,
      };
    });
  }

  async cancelCompanyClosure(actorId: string, companyId: string) {
    return this.database.$transaction(async (transaction) => {
      const lockedCompanies = await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "companies" WHERE "id" = ${companyId}::uuid FOR UPDATE
      `;
      if (!lockedCompanies.length) throw new NotFoundException("Компания недоступна");
      const company = await transaction.company.findUnique({
        where: { id: companyId },
        include: {
          memberships: true,
          venues: { where: { status: "ACTIVE" }, include: { memberships: true } },
        },
      });
      const now = new Date();
      if (
        !company ||
        company.status !== "PENDING_CLOSURE" ||
        !company.closureDeadline ||
        company.closureDeadline <= now
      ) {
        throw new ConflictException("Срок отмены закрытия завершён");
      }
      const isChef = company.memberships.some(
        ({ userId, companyRole }) => userId === actorId && companyRole === "CHEF_BARTENDER",
      );
      const isManager = company.venues.some((venue) =>
        venue.memberships.some(({ userId, role }) => userId === actorId && role === "BAR_MANAGER"),
      );
      if (!isChef && !isManager) throw new NotFoundException("Компания недоступна");
      await transaction.company.update({
        where: { id: companyId },
        data: { status: "ACTIVE", closureDeadline: null },
      });
      await transaction.productExportClosureOperation.updateMany({
        where: {
          originalCompanyId: companyId,
          status: "PENDING_CLOSURE",
        },
        data: { status: "CANCELLED", cancelledAt: now },
      });
      await transaction.auditEvent.create({
        data: {
          eventType: "company.closure_cancelled",
          actorType: "USER",
          actorId,
          companyId,
          entityType: "COMPANY",
          entityId: companyId,
        },
      });
      return { accepted: true as const };
    });
  }

  async deleteExpiredCompanies() {
    const now = new Date();
    const expired = await this.database.company.findMany({
      where: { status: "PENDING_CLOSURE", closureDeadline: { lte: now } },
      select: { id: true },
      take: 100,
      orderBy: { closureDeadline: "asc" },
    });
    for (const { id } of expired) {
      await this.database.$transaction(async (transaction) => {
        const companies = await transaction.$queryRaw<Array<{ id: string; name: string }>>`
          SELECT "id", "name"
          FROM "companies"
          WHERE "id" = ${id}::uuid
            AND "status" = 'PENDING_CLOSURE'
            AND "closureDeadline" <= NOW()
          FOR UPDATE
        `;
        const company = companies[0];
        if (!company) return;
        const operations = await transaction.productExportClosureOperation.findMany({
          where: {
            companyId: id,
            status: { in: ["PREPARING", "PENDING_CLOSURE", "CANCELLED"] },
          },
          include: { exportRequest: true },
          orderBy: { createdAt: "desc" },
        });
        const operation = operations.find(({ status }) => status === "PENDING_CLOSURE");
        const now = new Date();
        const retainedRequest =
          operation?.exportRequest?.status === "READY" &&
          operation.exportRequest.expiresAt &&
          operation.exportRequest.expiresAt > now
            ? operation.exportRequest
            : null;
        await this.exports.markScopeForCleanup(transaction, { companyId: id }, retainedRequest?.id);
        if (retainedRequest) {
          await transaction.productExportRequest.update({
            where: { id: retainedRequest.id },
            data: { companyId: null, venueId: null },
          });
        }
        for (const item of operations) {
          if (item.id === operation?.id) {
            await transaction.productExportClosureOperation.update({
              where: { id: item.id },
              data: { status: "CLOSED", closedAt: now, companyId: null, venueId: null },
            });
          } else if (item.exportRequest) {
            await transaction.productExportClosureOperation.update({
              where: { id: item.id },
              data: { status: "CANCELLED", cancelledAt: now, companyId: null, venueId: null },
            });
          } else {
            await transaction.productExportClosureOperation.delete({ where: { id: item.id } });
          }
        }
        await this.closeCompanyInvitations(transaction, id, null);
        await transaction.auditEvent.create({
          data: {
            eventType: "company.closed",
            actorType: "SYSTEM",
            companyId: id,
            entityType: "COMPANY",
            entityId: id,
            metadata: {
              name: company.name,
              closedAt: now.toISOString(),
              closureOperationId: operation?.id ?? null,
              exportRequestId: retainedRequest?.id ?? null,
            },
          },
        });
        await transaction.company.delete({ where: { id } });
      });
    }
    return expired.length;
  }

  private async closeCompanyInvitations(
    transaction: Prisma.TransactionClient,
    companyId: string,
    actorId: string | null,
  ) {
    const invitations = await transaction.invitation.findMany({
      where: { companyId, status: { in: ["ACTIVE", "IN_PROGRESS"] } },
      select: { id: true },
    });
    if (!invitations.length) return;
    const ids = invitations.map(({ id }) => id);
    await transaction.invitation.updateMany({
      where: { id: { in: ids } },
      data: { status: "CLOSED", closedAt: new Date() },
    });
    await transaction.invitationAcceptanceSession.deleteMany({
      where: { invitationId: { in: ids } },
    });
    if (actorId) {
      await transaction.auditEvent.createMany({
        data: ids.map((id) => ({
          eventType: "invitation.revoked",
          actorType: "USER" as const,
          actorId,
          companyId,
          entityType: "INVITATION",
          entityId: id,
          metadata: { reason: "company_closed" },
        })),
      });
    }
  }
}
