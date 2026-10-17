import { ConflictException, Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  DATABASE_CLIENT,
  type Prisma,
  type PrismaClient,
  type ProductExportStatus,
} from "@bartech/database";
import type { ExportKind, ExportParameters } from "./export.dto.js";

@Injectable()
export class ExportRepository {
  readonly maxAttempts: number;
  private readonly deadlineMs: number;

  constructor(
    @Inject(DATABASE_CLIENT) private readonly database: PrismaClient,
    config: ConfigService,
  ) {
    this.maxAttempts = config.get<number>("PRODUCT_EXPORT_MAX_ATTEMPTS", 5);
    this.deadlineMs = config.get<number>("PRODUCT_EXPORT_DEADLINE_MINUTES", 30) * 60_000;
  }

  create(input: {
    userId: string;
    companyId: string | null;
    venueId: string | null;
    closureOperationId?: string;
    type: ExportKind;
    parameters: ExportParameters;
  }) {
    return this.database.$transaction(async (transaction) => {
      const request = await transaction.productExportRequest.create({
        data: { ...input, parameters: input.parameters as Prisma.InputJsonValue },
      });
      await transaction.productExportOutbox.create({ data: { requestId: request.id } });
      await transaction.auditEvent.create({
        data: {
          eventType: "export.requested",
          actorType: "USER",
          actorId: input.userId,
          companyId: input.companyId,
          venueId: input.venueId,
          entityType: "EXPORT_REQUEST",
          entityId: request.id,
          metadata: { exportType: input.type },
        },
      });
      return request;
    });
  }

  createClosure(input: {
    userId: string;
    companyId: string;
    venueId: string | null;
    closureOperationId: string;
    type: ExportKind;
    parameters: ExportParameters;
  }) {
    return this.database.$transaction(async (transaction) => {
      const initial = await transaction.productExportClosureOperation.findUnique({
        where: { id: input.closureOperationId },
        select: { companyId: true },
      });
      if (initial?.companyId) {
        await transaction.$queryRaw<Array<{ id: string }>>`
          SELECT "id" FROM "companies" WHERE "id" = ${initial.companyId}::uuid FOR UPDATE
        `;
      }
      const locked = await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "product_export_closure_operations"
        WHERE "id" = ${input.closureOperationId}::uuid
          AND "createdByUserId" = ${input.userId}::uuid
          AND "companyId" = ${input.companyId}::uuid
          AND "status" IN ('PREPARING', 'PENDING_CLOSURE')
        FOR UPDATE
      `;
      if (!locked.length) throw new ConflictException("Операция закрытия недоступна");
      const previous = await transaction.productExportRequest.findUnique({
        where: { closureOperationId: input.closureOperationId },
        select: { id: true, status: true },
      });
      if (previous) {
        if (previous.status === "QUEUED" || previous.status === "PROCESSING") {
          throw new ConflictException("Выгрузка ещё формируется");
        }
        await transaction.productExportRequest.update({
          where: { id: previous.id },
          data: { closureOperationId: null },
        });
      }
      const request = await transaction.productExportRequest.create({
        data: {
          ...input,
          parameters: input.parameters as Prisma.InputJsonValue,
        },
      });
      await transaction.productExportOutbox.create({ data: { requestId: request.id } });
      await transaction.auditEvent.create({
        data: {
          eventType: "export.requested",
          actorType: "USER",
          actorId: input.userId,
          companyId: input.companyId,
          venueId: input.venueId,
          entityType: "EXPORT_REQUEST",
          entityId: request.id,
          metadata: { exportType: input.type, closureOperationId: input.closureOperationId },
        },
      });
      return request;
    });
  }

  findById(id: string) {
    return this.database.productExportRequest.findUnique({ where: { id } });
  }

  findClosureOperation(id: string) {
    return this.database.productExportClosureOperation.findUnique({
      where: { id },
      include: { exportRequest: true },
    });
  }

  listOutbox(limit: number) {
    return this.database.productExportOutbox.findMany({
      where: { deliveredAt: null, nextAttemptAt: { lte: new Date() } },
      orderBy: { createdAt: "asc" },
      take: limit,
      select: { id: true, requestId: true },
    });
  }

  markOutboxDelivered(id: string) {
    return this.database.productExportOutbox.updateMany({
      where: { id, deliveredAt: null },
      data: { deliveredAt: new Date() },
    });
  }

  listDispatchable(limit: number) {
    const now = new Date();
    return this.database.productExportRequest.findMany({
      where: {
        createdAt: { gt: new Date(now.getTime() - this.deadlineMs) },
        OR: [{ status: "QUEUED" }, { status: "PROCESSING", leaseUntil: { lt: now } }],
      },
      select: { id: true },
      orderBy: { createdAt: "asc" },
      take: limit,
    });
  }

  async claim(id: string) {
    const now = new Date();
    const claim = await this.database.$queryRaw<Array<{ id: string }>>`
      UPDATE "product_export_requests"
      SET "status" = 'PROCESSING',
          "startedAt" = ${now},
          "leaseUntil" = ${new Date(now.getTime() + 2 * 60_000)},
          "attemptCount" = "attemptCount" + 1
      WHERE "id" = ${id}::uuid
        AND "createdAt" > ${new Date(now.getTime() - this.deadlineMs)}
        AND "attemptCount" < ${this.maxAttempts}
        AND (
          "status" = 'QUEUED'
          OR ("status" = 'PROCESSING' AND "leaseUntil" < ${now})
        )
        AND NOT EXISTS (
          SELECT 1 FROM "product_export_cleanups"
          WHERE "requestId" = ${id}::uuid AND "isScopePurge" = TRUE
        )
      RETURNING "id"
    `;
    if (!claim.length) return null;
    return this.findById(id);
  }

  extendLease(id: string, attemptCount: number) {
    const now = new Date();
    return this.database.$executeRaw`
      UPDATE "product_export_requests"
      SET "leaseUntil" = ${new Date(now.getTime() + 2 * 60_000)}
      WHERE "id" = ${id}::uuid
        AND "status" = 'PROCESSING'
        AND "attemptCount" = ${attemptCount}
        AND "leaseUntil" > ${now}
        AND NOT EXISTS (
          SELECT 1 FROM "product_export_cleanups"
          WHERE "requestId" = ${id}::uuid AND "isScopePurge" = TRUE
        )
    `;
  }

  async canUpload(id: string, attemptCount: number) {
    const active = await this.database.$queryRaw<Array<{ active: boolean }>>`
      SELECT EXISTS (
        SELECT 1
        FROM "product_export_requests" request
        WHERE request."id" = ${id}::uuid
          AND request."status" = 'PROCESSING'
          AND request."attemptCount" = ${attemptCount}
          AND request."leaseUntil" > NOW()
          AND NOT EXISTS (
            SELECT 1 FROM "product_export_cleanups" cleanup
            WHERE cleanup."requestId" = request."id" AND cleanup."isScopePurge" = TRUE
          )
      ) AS "active"
    `;
    return active[0]?.active ?? false;
  }

  async complete(
    id: string,
    input: {
      attemptCount: number;
      objectKey: string;
      fileName: string;
      contentType: string;
      fileSizeBytes: bigint;
    },
  ) {
    const now = new Date();
    return this.database.$transaction(async (transaction) => {
      const request = await transaction.productExportRequest.findUnique({ where: { id } });
      if (
        !request ||
        request.status !== "PROCESSING" ||
        request.attemptCount !== input.attemptCount
      ) {
        return false;
      }
      const cleanup = await transaction.productExportCleanup.findUnique({
        where: { requestId: id },
      });
      if (cleanup?.isScopePurge) {
        return false;
      }
      if (request.createdAt.getTime() + this.deadlineMs <= now.getTime()) {
        await this.failInTransaction(transaction, request, "DEADLINE_EXCEEDED");
        return false;
      }
      const result = await transaction.productExportRequest.updateMany({
        where: {
          id,
          status: "PROCESSING",
          attemptCount: input.attemptCount,
          leaseUntil: { gt: now },
        },
        data: {
          ...input,
          status: "READY",
          completedAt: now,
          expiresAt: new Date(now.getTime() + 24 * 60 * 60_000),
          leaseUntil: null,
          errorCode: null,
        },
      });
      if (!result.count) return false;
      await transaction.auditEvent.create({
        data: {
          eventType: "export.completed",
          actorType: "USER",
          actorId: request.userId,
          companyId: request.companyId,
          venueId: request.venueId,
          entityType: "EXPORT_REQUEST",
          entityId: request.id,
          metadata: {
            exportType: request.type,
            closureOperationId: request.closureOperationId,
          },
        },
      });
      return true;
    });
  }

  async recordFailure(id: string, attemptCount: number, errorCode: string, retryable: boolean) {
    const request = await this.findById(id);
    if (!request || request.status !== "PROCESSING" || request.attemptCount !== attemptCount) {
      return;
    }
    const deadlineReached = request.createdAt.getTime() + this.deadlineMs <= Date.now();
    if (retryable && request.attemptCount < this.maxAttempts && !deadlineReached) {
      await this.database.productExportRequest.updateMany({
        where: { id, status: "PROCESSING", attemptCount },
        data: { status: "QUEUED", leaseUntil: null, errorCode },
      });
      return;
    }
    await this.database.$transaction((transaction) =>
      this.failInTransaction(transaction, request, errorCode),
    );
  }

  async listExpiredReady(limit: number) {
    const now = new Date();
    return this.database.$queryRaw<
      Array<{ id: string; objectKey: string | null; attemptCount: number }>
    >`
      SELECT request."id", request."objectKey", request."attemptCount"
      FROM "product_export_requests" request
      WHERE request."status" = 'READY'
        AND request."expiresAt" <= ${now}
        AND NOT EXISTS (
          SELECT 1 FROM "product_export_cleanups" cleanup
          WHERE cleanup."requestId" = request."id" AND cleanup."isScopePurge" = TRUE
        )
      ORDER BY request."expiresAt" ASC
      LIMIT ${limit}
    `;
  }

  deleteRequest(id: string) {
    return this.database.$transaction(async (transaction) => {
      const request = await transaction.productExportRequest.findUnique({
        where: { id },
        select: { closureOperationId: true },
      });
      const deleted = await transaction.productExportRequest.deleteMany({
        where: { id, status: "READY", expiresAt: { lte: new Date() } },
      });
      if (deleted.count && request?.closureOperationId) {
        await transaction.productExportClosureOperation.deleteMany({
          where: {
            id: request.closureOperationId,
            status: { in: ["CLOSED", "CANCELLED"] },
            exportRequest: { is: null },
          },
        });
      }
      return deleted;
    });
  }

  listOldFailures(before: Date, limit: number) {
    return this.database.productExportRequest.findMany({
      where: { status: "FAILED", createdAt: { lte: before } },
      select: { id: true, attemptCount: true },
      take: limit,
    });
  }

  deleteOldFailure(id: string, before: Date) {
    return this.database.productExportRequest.deleteMany({
      where: { id, status: "FAILED", createdAt: { lte: before } },
    });
  }

  async markScopeForCleanup(
    transaction: Prisma.TransactionClient,
    scope: { companyId: string; venueId?: string },
    preserveRequestId?: string,
  ): Promise<void> {
    const requests = scope.venueId
      ? await transaction.$queryRaw<Array<{ id: string; attemptCount: number }>>`
          SELECT "id", "attemptCount"
          FROM "product_export_requests"
          WHERE "companyId" = ${scope.companyId}::uuid AND "venueId" = ${scope.venueId}::uuid
            AND (${preserveRequestId ?? null}::uuid IS NULL OR "id" <> ${preserveRequestId ?? null}::uuid)
          FOR UPDATE
        `
      : await transaction.$queryRaw<Array<{ id: string; attemptCount: number }>>`
          SELECT "id", "attemptCount"
          FROM "product_export_requests"
          WHERE "companyId" = ${scope.companyId}::uuid
            AND (${preserveRequestId ?? null}::uuid IS NULL OR "id" <> ${preserveRequestId ?? null}::uuid)
          FOR UPDATE
        `;
    for (const request of requests) {
      await transaction.$executeRaw`
        INSERT INTO "product_export_cleanups" ("requestId", "attemptCount", "isScopePurge")
        VALUES (${request.id}::uuid, ${request.attemptCount}, TRUE)
        ON CONFLICT ("requestId") DO UPDATE
        SET "attemptCount" = GREATEST(
          "product_export_cleanups"."attemptCount",
          EXCLUDED."attemptCount"
        ), "isScopePurge" = TRUE
      `;
    }
  }

  async scheduleScopeCleanup(requestId: string, attemptCount: number) {
    await this.database.$executeRaw`
      INSERT INTO "product_export_cleanups" ("requestId", "attemptCount", "isScopePurge")
      VALUES (${requestId}::uuid, ${attemptCount}, TRUE)
      ON CONFLICT ("requestId") DO UPDATE
      SET "attemptCount" = GREATEST(
        "product_export_cleanups"."attemptCount",
        EXCLUDED."attemptCount"
      ), "isScopePurge" = TRUE
    `;
  }

  listScopeCleanups(limit: number) {
    return this.database.productExportCleanup.findMany({
      where: { isScopePurge: true },
      orderBy: [{ lastAttemptAt: "asc" }, { createdAt: "asc" }],
      take: limit,
      select: { requestId: true, attemptCount: true, isScopePurge: true },
    });
  }

  recordScopeCleanupAttempt(requestId: string, attemptCount: number) {
    return this.database.productExportCleanup.updateMany({
      where: { requestId, attemptCount, isScopePurge: true },
      data: { lastAttemptAt: new Date() },
    });
  }

  async completeScopeCleanup(requestId: string, attemptCount: number) {
    return this.database.$transaction(async (transaction) => {
      const request = await transaction.productExportRequest.findUnique({
        where: { id: requestId },
        select: { closureOperationId: true },
      });
      await transaction.productExportRequest.deleteMany({ where: { id: requestId } });
      if (request?.closureOperationId) {
        await transaction.productExportClosureOperation.deleteMany({
          where: {
            id: request.closureOperationId,
            status: { in: ["CLOSED", "CANCELLED"] },
            exportRequest: { is: null },
          },
        });
      }
      return transaction.productExportCleanup.updateMany({
        where: { requestId, attemptCount, isScopePurge: true },
        data: { lastAttemptAt: new Date() },
      });
    });
  }

  listAttemptCleanups(limit: number) {
    return this.database.productExportCleanup.findMany({
      where: { isScopePurge: false },
      orderBy: [{ lastAttemptAt: "asc" }, { createdAt: "asc" }],
      take: limit,
      select: { requestId: true, attemptCount: true },
    });
  }

  completeAttemptCleanup(requestId: string, attemptCount: number) {
    return this.database.productExportCleanup.deleteMany({
      where: { requestId, attemptCount, isScopePurge: false },
    });
  }

  recordAttemptCleanupFailure(requestId: string, attemptCount: number) {
    return this.database.productExportCleanup.updateMany({
      where: { requestId, attemptCount, isScopePurge: false },
      data: { lastAttemptAt: new Date() },
    });
  }

  async scheduleCleanup(requestId: string, attemptCount: number) {
    await this.database.$executeRaw`
      INSERT INTO "product_export_cleanups" ("requestId", "attemptCount", "isScopePurge")
      VALUES (${requestId}::uuid, ${attemptCount}, FALSE)
      ON CONFLICT ("requestId") DO UPDATE
      SET "attemptCount" = GREATEST(
        "product_export_cleanups"."attemptCount",
        EXCLUDED."attemptCount"
      )
    `;
  }

  private async failInTransaction(
    transaction: Prisma.TransactionClient,
    request: {
      id: string;
      userId: string;
      companyId: string | null;
      venueId: string | null;
      closureOperationId: string | null;
      type: ExportKind;
      status: ProductExportStatus;
      attemptCount: number;
    },
    errorCode: string,
  ) {
    const updated = await transaction.productExportRequest.updateMany({
      where: {
        id: request.id,
        status: { in: ["QUEUED", "PROCESSING"] },
        attemptCount: request.attemptCount,
      },
      data: {
        status: "FAILED",
        leaseUntil: null,
        errorCode,
        objectKey: null,
        fileName: null,
        contentType: null,
        fileSizeBytes: null,
      },
    });
    if (!updated.count) return;
    await transaction.auditEvent.create({
      data: {
        eventType: "export.failed",
        actorType: "USER",
        actorId: request.userId,
        companyId: request.companyId,
        venueId: request.venueId,
        entityType: "EXPORT_REQUEST",
        entityId: request.id,
        metadata: {
          exportType: request.type,
          errorCode,
          closureOperationId: request.closureOperationId,
        },
      },
    });
  }
}
