import { randomUUID } from "node:crypto";
import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { DATABASE_CLIENT, type Prisma, type PrismaClient } from "@bartech/database";
import { INTERNAL_SESSION_ABSOLUTE_MS, INTERNAL_SESSION_IDLE_MS } from "@bartech/backend-identity";
import type { CreateSupportAccessGrantDto } from "../support.dto.js";

const GRANT_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class SupportAccessService {
  constructor(@Inject(DATABASE_CLIENT) private readonly database: PrismaClient) {}

  async createGrant(userId: string, input: CreateSupportAccessGrantDto) {
    const now = new Date();
    return this.database.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT "id" FROM "companies" WHERE "id" = ${input.companyId}::uuid FOR UPDATE`;
      const company = await transaction.company.findFirst({
        where: { id: input.companyId, status: "ACTIVE" },
        select: { id: true },
      });
      if (!company) throw new NotFoundException("Область временного доступа недоступна");
      let scopeType: "COMPANY" | "VENUE";
      let venueId: string | null = null;
      if (input.venueId) {
        const [membership, companyMembership] = await Promise.all([
          transaction.venueMembership.findFirst({
            where: {
              userId,
              companyId: input.companyId,
              venueId: input.venueId,
              OR: [
                { endedOn: null },
                {
                  endedOn: {
                    gte: new Date(
                      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
                    ),
                  },
                },
              ],
              role: "BAR_MANAGER",
              venue: { status: "ACTIVE" },
            },
            select: { venueId: true },
          }),
          transaction.companyMembership.findFirst({
            where: { userId, companyId: input.companyId, companyRole: "CHEF_BARTENDER" },
            select: { userId: true },
          }),
        ]);
        if (!membership || companyMembership) {
          throw new NotFoundException("Область временного доступа недоступна");
        }
        scopeType = "VENUE";
        venueId = membership.venueId;
      } else {
        const [membership, venueMembership] = await Promise.all([
          transaction.companyMembership.findFirst({
            where: { userId, companyId: input.companyId, companyRole: "CHEF_BARTENDER" },
            select: { userId: true },
          }),
          transaction.venueMembership.findFirst({
            where: {
              userId,
              companyId: input.companyId,
              OR: [
                { endedOn: null },
                {
                  endedOn: {
                    gte: new Date(
                      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
                    ),
                  },
                },
              ],
            },
          }),
        ]);
        if (!membership || venueMembership) {
          throw new NotFoundException("Область временного доступа недоступна");
        }
        scopeType = "COMPANY";
      }
      if (input.requestId) {
        const request = await transaction.supportRequest.findFirst({
          where: {
            id: input.requestId,
            authorUserId: userId,
            companyId: input.companyId,
            ...(venueId ? { venueId } : {}),
          },
          select: { id: true },
        });
        if (!request) throw new NotFoundException("Обращение недоступно");
      }
      const grant = await transaction.supportAccessGrant.create({
        data: {
          id: randomUUID(),
          authorUserId: userId,
          companyId: input.companyId,
          venueId,
          scopeType,
          requestId: input.requestId,
          expiresAt: new Date(now.getTime() + GRANT_LIFETIME_MS),
        },
      });
      await transaction.auditEvent.create({
        data: {
          eventType: "support.access_granted",
          actorType: "USER",
          actorId: userId,
          companyId: input.companyId,
          venueId,
          entityType: "SUPPORT_ACCESS_GRANT",
          entityId: grant.id,
          metadata: { scopeType },
        },
      });
      await transaction.internalAuditEvent.create({
        data: {
          eventType: "service_access.grant_created",
          actorType: "SYSTEM",
          companyId: input.companyId,
          venueId,
          metadata: { grantId: grant.id, actorId: userId, scopeType },
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
