import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { DATABASE_CLIENT, type Prisma, type PrismaClient } from "@bartech/database";
import { INTERNAL_SESSION_ABSOLUTE_MS, INTERNAL_SESSION_IDLE_MS } from "@bartech/backend-identity";

const GRANT_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class SupportAccessService {
  constructor(@Inject(DATABASE_CLIENT) private readonly database: PrismaClient) {}

  async assertCanRequestAccess(transaction: Prisma.TransactionClient, requestId: string) {
    const request = await transaction.supportRequest.findFirst({
      where: {
        id: requestId,
        reason: "DATA_MIGRATION",
        companyId: { not: null },
        status: { not: "CLOSED" },
      },
      select: { companyId: true, venueId: true, authorUserId: true },
    });
    if (!request?.companyId || !request.authorUserId) {
      throw new BadRequestException("Для этого обращения нельзя запросить временный доступ");
    }
    const activeGrant = await transaction.supportAccessGrant.findFirst({
      where: { requestId, revokedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true },
    });
    if (activeGrant) {
      throw new BadRequestException("Для обращения уже предоставлен временный доступ");
    }
    await this.resolveRequestScope(
      transaction,
      request.authorUserId,
      request.companyId,
      request.venueId,
    );
  }

  async grantFromAccessRequest(userId: string, requestId: string, messageId: string) {
    return this.database.$transaction(async (transaction) => {
      const snapshot = await transaction.supportRequest.findFirst({
        where: { id: requestId, authorUserId: userId },
        select: { id: true, companyId: true },
      });
      if (!snapshot?.companyId) throw new NotFoundException("Обращение недоступно");
      await transaction.$queryRaw`SELECT "id" FROM "support_requests" WHERE "id" = ${requestId}::uuid FOR UPDATE`;
      await transaction.$queryRaw`SELECT "id" FROM "companies" WHERE "id" = ${snapshot.companyId}::uuid FOR UPDATE`;
      const request = await transaction.supportRequest.findFirst({
        where: {
          id: requestId,
          authorUserId: userId,
          reason: "DATA_MIGRATION",
          status: { not: "CLOSED" },
          company: { status: "ACTIVE" },
        },
        select: { id: true, companyId: true, venueId: true },
      });
      const message = await transaction.supportMessage.findFirst({
        where: { id: messageId, requestId, authorType: "INTERNAL", kind: "ACCESS_REQUEST" },
        select: { id: true },
      });
      if (!request?.companyId || !message) throw new NotFoundException("Запрос доступа недоступен");

      const existing = await transaction.supportAccessGrant.findUnique({
        where: { accessRequestMessageId: messageId },
      });
      if (existing) return serializeGrant(existing);
      const activeGrant = await transaction.supportAccessGrant.findFirst({
        where: { requestId, revokedAt: null, expiresAt: { gt: new Date() } },
      });
      if (activeGrant) throw new BadRequestException("Для обращения уже предоставлен доступ");

      const scope = await this.resolveRequestScope(
        transaction,
        userId,
        request.companyId,
        request.venueId,
      );
      const now = new Date();
      const grant = await transaction.supportAccessGrant.create({
        data: {
          id: randomUUID(),
          authorUserId: userId,
          companyId: request.companyId,
          venueId: scope.venueId,
          scopeType: scope.scopeType,
          requestId,
          accessRequestMessageId: messageId,
          expiresAt: new Date(now.getTime() + GRANT_LIFETIME_MS),
        },
      });
      await transaction.supportRequest.update({
        where: { id: requestId },
        data: { status: "IN_PROGRESS", updatedAt: now },
      });
      await transaction.auditEvent.create({
        data: {
          eventType: "support.access_granted",
          actorType: "USER",
          actorId: userId,
          companyId: request.companyId,
          venueId: scope.venueId,
          entityType: "SUPPORT_ACCESS_GRANT",
          entityId: grant.id,
          metadata: { scopeType: scope.scopeType, requestId },
        },
      });
      await transaction.internalAuditEvent.create({
        data: {
          eventType: "service_access.grant_created",
          actorType: "SYSTEM",
          companyId: request.companyId,
          venueId: scope.venueId,
          metadata: { grantId: grant.id, actorId: userId, scopeType: scope.scopeType, requestId },
        },
      });
      return serializeGrant(grant);
    });
  }

  async listMine(userId: string) {
    const grants = await this.database.supportAccessGrant.findMany({
      where: { authorUserId: userId },
      orderBy: { createdAt: "desc" },
      include: { company: { select: { name: true } }, venue: { select: { name: true } } },
    });
    return grants.map((grant) => ({
      ...serializeGrant(grant),
      companyName: grant.company.name,
      venueName: grant.venue?.name ?? null,
      active: !grant.revokedAt && grant.expiresAt > new Date(),
    }));
  }

  async revokeGrant(userId: string, grantId: string) {
    return this.database.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT "id" FROM "support_access_grants" WHERE "id" = ${grantId}::uuid FOR UPDATE`;
      const grant = await transaction.supportAccessGrant.findFirst({
        where: { id: grantId, authorUserId: userId },
      });
      if (!grant) throw new NotFoundException("Временный доступ не найден");
      const now = new Date();
      if (!grant.revokedAt) {
        await transaction.supportAccessGrant.update({
          where: { id: grant.id },
          data: { revokedAt: now, revokedByUserId: userId, revocationReason: "author_revoked" },
        });
        await this.endGrantSessions(transaction, grant, now, "grant_revoked");
        await transaction.auditEvent.create({
          data: {
            eventType: "support.access_revoked",
            actorType: "USER",
            actorId: userId,
            companyId: grant.companyId,
            venueId: grant.venueId,
            entityType: "SUPPORT_ACCESS_GRANT",
            entityId: grant.id,
            metadata: { scopeType: grant.scopeType },
          },
        });
        await transaction.internalAuditEvent.create({
          data: {
            eventType: "service_access.grant_revoked",
            actorType: "SYSTEM",
            companyId: grant.companyId,
            venueId: grant.venueId,
            metadata: { grantId: grant.id, actorId: userId, reason: "author_revoked" },
          },
        });
      }
      return { id: grant.id, revokedAt: grant.revokedAt ?? now };
    });
  }

  async revokeGrantByInternalSupport(internalUserId: string, requestId: string, grantId: string) {
    return this.database.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT "id" FROM "support_requests" WHERE "id" = ${requestId}::uuid FOR UPDATE`;
      const request = await transaction.supportRequest.findUnique({
        where: { id: requestId },
        select: { id: true },
      });
      if (!request) throw new NotFoundException("Обращение не найдено");

      await transaction.$queryRaw`SELECT "id" FROM "support_access_grants" WHERE "id" = ${grantId}::uuid AND "requestId" = ${requestId}::uuid FOR UPDATE`;
      const grant = await transaction.supportAccessGrant.findFirst({
        where: { id: grantId, requestId },
      });
      if (!grant) throw new NotFoundException("Временный доступ не найден");

      const now = new Date();
      if (!grant.revokedAt && grant.expiresAt > now) {
        await transaction.supportAccessGrant.update({
          where: { id: grant.id },
          data: { revokedAt: now, revocationReason: "support_revoked" },
        });
        await this.endGrantSessions(transaction, grant, now, "grant_revoked");
        await transaction.auditEvent.create({
          data: {
            eventType: "support.access_revoked",
            actorType: "INTERNAL_USER",
            internalUserId,
            companyId: grant.companyId,
            venueId: grant.venueId,
            entityType: "SUPPORT_ACCESS_GRANT",
            entityId: grant.id,
            metadata: { scopeType: grant.scopeType, reason: "support_revoked", requestId },
          },
        });
        await transaction.internalAuditEvent.create({
          data: {
            eventType: "service_access.grant_revoked",
            actorType: "INTERNAL_USER",
            actorId: internalUserId,
            internalUserId,
            companyId: grant.companyId,
            venueId: grant.venueId,
            metadata: { grantId: grant.id, requestId, reason: "support_revoked" },
          },
        });
      }

      return {
        id: grant.id,
        active: false,
        revokedAt: grant.revokedAt ?? (grant.expiresAt > now ? now : null),
        expiresAt: grant.expiresAt,
      };
    });
  }

  async listAvailableGrants(internalUserId: string, internalSessionId: string) {
    return this.database.supportAccessGrant.findMany({
      where: {
        revokedAt: null,
        expiresAt: { gt: new Date() },
        company: { status: "ACTIVE" },
        OR: [{ scopeType: "COMPANY" }, { scopeType: "VENUE", venue: { status: "ACTIVE" } }],
      },
      orderBy: { createdAt: "asc" },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            venues: { where: { status: "ACTIVE" }, select: { id: true, name: true } },
          },
        },
        venue: { select: { id: true, name: true } },
        author: { select: { profile: { select: { fullName: true } } } },
        request: { select: { id: true, reason: true } },
        sessions: {
          where: {
            internalUserId,
            internalSessionId,
            endedAt: null,
            expiresAt: { gt: new Date() },
          },
          select: { id: true, expiresAt: true },
        },
      },
    });
  }

  async startSession(internalUserId: string, internalSessionId: string, grantId: string) {
    return this.database.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT "id" FROM "internal_sessions" WHERE "id" = ${internalSessionId}::uuid AND "internalUserId" = ${internalUserId}::uuid FOR UPDATE`;
      await transaction.$queryRaw`SELECT "id" FROM "support_access_grants" WHERE "id" = ${grantId}::uuid FOR UPDATE`;
      const checkedAt = new Date();
      const authSession = await transaction.internalSession.findFirst({
        where: {
          id: internalSessionId,
          internalUserId,
          revokedAt: null,
          expiresAt: { gt: checkedAt },
          internalUser: { status: "ACTIVE", permissions: { has: "service_access" } },
        },
        select: { id: true, createdAt: true, lastActivityAt: true },
      });
      if (
        !authSession ||
        authSession.createdAt.getTime() + INTERNAL_SESSION_ABSOLUTE_MS <= checkedAt.getTime() ||
        authSession.lastActivityAt.getTime() + INTERNAL_SESSION_IDLE_MS <= checkedAt.getTime()
      ) {
        throw new UnauthorizedException("Внутренняя сессия завершена");
      }
      const grant = await transaction.supportAccessGrant.findFirst({
        where: {
          id: grantId,
          revokedAt: null,
          expiresAt: { gt: checkedAt },
          company: { status: "ACTIVE" },
          OR: [{ scopeType: "COMPANY" }, { scopeType: "VENUE", venue: { status: "ACTIVE" } }],
        },
      });
      if (!grant) throw new NotFoundException("Действующий временный доступ не найден");
      const user = await transaction.internalUser.findFirst({
        where: { id: internalUserId, status: "ACTIVE", permissions: { has: "service_access" } },
        select: { id: true },
      });
      if (!user) throw new ForbiddenException("Нет доступа к служебной работе");
      const current = await transaction.serviceSession.findFirst({
        where: {
          grantId,
          internalUserId,
          internalSessionId,
          endedAt: null,
          expiresAt: { gt: checkedAt },
        },
      });
      if (current)
        return serializeServiceSession({
          ...current,
          companyId: grant.companyId,
          venueId: grant.venueId,
        });
      const expiredSessions = await transaction.serviceSession.findMany({
        where: { grantId, internalUserId, endedAt: null, expiresAt: { lte: checkedAt } },
        include: { grant: true },
      });
      for (const expiredSession of expiredSessions) {
        const ended = await transaction.serviceSession.updateMany({
          where: { id: expiredSession.id, endedAt: null, expiresAt: { lte: checkedAt } },
          data: { endedAt: checkedAt, endReason: "expired" },
        });
        if (ended.count === 1) {
          await createServiceAudit(
            transaction,
            expiredSession.grant,
            internalUserId,
            expiredSession.id,
            "service_access.ended",
            "SYSTEM",
            { reason: "expired" },
          );
        }
      }
      const session = await transaction.serviceSession.create({
        data: {
          id: randomUUID(),
          grantId,
          internalUserId,
          internalSessionId,
          expiresAt: grant.expiresAt,
        },
      });
      await createServiceAudit(
        transaction,
        grant,
        internalUserId,
        session.id,
        "service_access.started",
      );
      return serializeServiceSession({
        ...session,
        companyId: grant.companyId,
        venueId: grant.venueId,
      });
    });
  }

  async endSession(internalUserId: string, internalSessionId: string, sessionId: string) {
    return this.database.$transaction(async (transaction) => {
      const serviceSession = await transaction.serviceSession.findFirst({
        where: { id: sessionId, internalUserId, internalSessionId },
        select: { grantId: true },
      });
      if (serviceSession) {
        await transaction.$queryRaw`SELECT "id" FROM "support_access_grants" WHERE "id" = ${serviceSession.grantId}::uuid FOR UPDATE`;
      }
      await transaction.$queryRaw`SELECT "id" FROM "service_sessions" WHERE "id" = ${sessionId}::uuid FOR UPDATE`;
      const session = await transaction.serviceSession.findFirst({
        where: { id: sessionId, internalUserId, internalSessionId },
        include: { grant: true },
      });
      if (!session) throw new NotFoundException("Служебная сессия не найдена");
      const now = new Date();
      if (!session.endedAt) {
        const reason = session.expiresAt <= now ? "expired" : "internal_user_ended";
        await transaction.serviceSession.update({
          where: { id: sessionId },
          data: { endedAt: now, endReason: reason },
        });
        await createServiceAudit(
          transaction,
          session.grant,
          internalUserId,
          sessionId,
          "service_access.ended",
          reason === "expired" ? "SYSTEM" : "INTERNAL_USER",
          { reason },
        );
      }
      return { id: session.id, endedAt: session.endedAt ?? now };
    });
  }

  async assertActiveSession(
    sessionId: string,
    internalUserId: string,
    internalSessionId: string,
    companyId: string,
    venueId: string,
    transaction?: Prisma.TransactionClient,
  ) {
    const client = transaction ?? this.database;
    if (transaction) {
      const grantId = await transaction.serviceSession.findFirst({
        where: { id: sessionId, internalUserId, internalSessionId },
        select: { grantId: true },
      });
      if (grantId) {
        await transaction.$queryRaw`SELECT "id" FROM "support_access_grants" WHERE "id" = ${grantId.grantId}::uuid FOR SHARE`;
      }
    }
    const session = await client.serviceSession.findFirst({
      where: {
        id: sessionId,
        internalUserId,
        internalSessionId,
        endedAt: null,
        expiresAt: { gt: new Date() },
        grant: {
          revokedAt: null,
          expiresAt: { gt: new Date() },
          companyId,
          company: {
            status: "ACTIVE",
            venues: { some: { id: venueId, status: "ACTIVE" } },
          },
          OR: [
            { scopeType: "COMPANY" },
            { scopeType: "VENUE", venueId, venue: { status: "ACTIVE" } },
          ],
        },
        internalUser: { status: "ACTIVE", permissions: { has: "service_access" } },
      },
      select: { id: true, grantId: true },
    });
    if (!session) throw new NotFoundException("Служебная сессия недоступна для этой области");
    return session;
  }

  async revokeForVenue(transaction: Prisma.TransactionClient, companyId: string, venueId: string) {
    await this.revokeMatching(
      transaction,
      { companyId, scopeType: "VENUE", venueId },
      "venue_closed",
    );
  }

  async revokeForCompany(transaction: Prisma.TransactionClient, companyId: string) {
    await this.revokeMatching(transaction, { companyId }, "company_closure");
  }

  private async revokeMatching(
    transaction: Prisma.TransactionClient,
    where: Prisma.SupportAccessGrantWhereInput,
    reason: string,
  ) {
    const candidates = await transaction.supportAccessGrant.findMany({
      where: { ...where, revokedAt: null },
      orderBy: { id: "asc" },
    });
    for (const grant of candidates) {
      await transaction.$queryRaw`SELECT "id" FROM "support_access_grants" WHERE "id" = ${grant.id}::uuid FOR UPDATE`;
    }
    const grants = await transaction.supportAccessGrant.findMany({
      where: { id: { in: candidates.map(({ id }) => id) }, revokedAt: null },
      orderBy: { id: "asc" },
    });
    const now = new Date();
    for (const grant of grants) {
      await transaction.supportAccessGrant.update({
        where: { id: grant.id },
        data: { revokedAt: now, revocationReason: reason },
      });
      await this.endGrantSessions(transaction, grant, now, reason);
      await transaction.auditEvent.create({
        data: {
          eventType: "support.access_revoked",
          actorType: "SYSTEM",
          companyId: grant.companyId,
          venueId: grant.venueId,
          entityType: "SUPPORT_ACCESS_GRANT",
          entityId: grant.id,
          metadata: { scopeType: grant.scopeType, reason },
        },
      });
      await transaction.internalAuditEvent.create({
        data: {
          eventType: "service_access.grant_revoked",
          actorType: "SYSTEM",
          companyId: grant.companyId,
          venueId: grant.venueId,
          metadata: { grantId: grant.id, reason },
        },
      });
    }
  }

  private async resolveRequestScope(
    transaction: Prisma.TransactionClient,
    userId: string,
    companyId: string,
    venueId: string | null,
  ): Promise<{ scopeType: "COMPANY" | "VENUE"; venueId: string | null }> {
    const company = await transaction.company.findFirst({
      where: { id: companyId, status: "ACTIVE" },
      select: { id: true },
    });
    if (!company) throw new NotFoundException("Область временного доступа недоступна");

    const companyMembership = await transaction.companyMembership.findFirst({
      where: { userId, companyId, endedOn: null, companyRole: "CHEF_BARTENDER" },
      select: { userId: true },
    });
    if (companyMembership) return { scopeType: "COMPANY", venueId: null };

    if (venueId) {
      const now = new Date();
      const venueMembership = await transaction.venueMembership.findFirst({
        where: {
          userId,
          companyId,
          venueId,
          OR: [
            { endedOn: null },
            {
              endedOn: {
                gt: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())),
              },
            },
          ],
          role: "BAR_MANAGER",
          venue: { status: "ACTIVE" },
        },
        select: { venueId: true },
      });
      if (venueMembership) return { scopeType: "VENUE", venueId: venueMembership.venueId };
    }
    throw new ForbiddenException("Текущая роль не может предоставить временный доступ");
  }

  private async endGrantSessions(
    transaction: Prisma.TransactionClient,
    grant: {
      id: string;
      companyId: string;
      venueId: string | null;
      scopeType: "COMPANY" | "VENUE";
    },
    endedAt: Date,
    reason: string,
  ) {
    const sessions = await transaction.serviceSession.findMany({
      where: { grantId: grant.id, endedAt: null },
      orderBy: { id: "asc" },
    });
    for (const session of sessions) {
      const endReason = session.expiresAt <= endedAt ? "expired" : reason;
      const ended = await transaction.serviceSession.updateMany({
        where: { id: session.id, endedAt: null },
        data: { endedAt, endReason },
      });
      if (ended.count === 1) {
        await createServiceAudit(
          transaction,
          grant,
          session.internalUserId,
          session.id,
          "service_access.ended",
          "SYSTEM",
          { reason: endReason },
        );
      }
    }
  }
}

function serializeGrant(grant: {
  id: string;
  companyId: string;
  venueId: string | null;
  scopeType: "COMPANY" | "VENUE";
  requestId: string | null;
  createdAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
}) {
  return {
    id: grant.id,
    companyId: grant.companyId,
    venueId: grant.venueId,
    scopeType: grant.scopeType,
    requestId: grant.requestId,
    createdAt: grant.createdAt.toISOString(),
    expiresAt: grant.expiresAt.toISOString(),
    revokedAt: grant.revokedAt?.toISOString() ?? null,
  };
}

function serializeServiceSession(session: {
  id: string;
  grantId: string;
  internalUserId: string;
  internalSessionId?: string | null;
  startedAt: Date;
  expiresAt: Date;
  endedAt: Date | null;
  endReason: string | null;
  companyId: string;
  venueId: string | null;
}) {
  return {
    id: session.id,
    grantId: session.grantId,
    internalUserId: session.internalUserId,
    startedAt: session.startedAt,
    expiresAt: session.expiresAt,
    endedAt: session.endedAt,
    endReason: session.endReason,
    companyId: session.companyId,
    venueId: session.venueId,
  };
}

async function createServiceAudit(
  transaction: Prisma.TransactionClient,
  grant: { id: string; companyId: string; venueId: string | null; scopeType: "COMPANY" | "VENUE" },
  internalUserId: string,
  sessionId: string,
  eventType: string,
  actorType: "INTERNAL_USER" | "SYSTEM" = "INTERNAL_USER",
  metadata: Record<string, string> = { scopeType: grant.scopeType },
) {
  await transaction.auditEvent.create({
    data: {
      eventType,
      actorType,
      ...(actorType === "INTERNAL_USER" ? { internalUserId } : {}),
      serviceSessionId: sessionId,
      companyId: grant.companyId,
      venueId: grant.venueId,
      entityType: "SUPPORT_ACCESS_GRANT",
      entityId: grant.id,
      metadata,
    },
  });
  await transaction.internalAuditEvent.create({
    data: {
      eventType,
      actorType,
      ...(actorType === "INTERNAL_USER" ? { internalUserId } : {}),
      companyId: grant.companyId,
      venueId: grant.venueId,
      serviceSessionId: sessionId,
      metadata: {
        grantId: grant.id,
        serviceSessionId: sessionId,
        ...(actorType === "INTERNAL_USER" ? { actorId: internalUserId } : {}),
        ...metadata,
      },
    },
  });
}
