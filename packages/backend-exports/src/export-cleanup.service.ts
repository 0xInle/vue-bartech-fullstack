import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DATABASE_CLIENT, type PrismaClient } from "@bartech/database";
import { FILE_STORAGE, type FileStorage } from "@bartech/backend-files";
import { ExportRepository } from "./export.repository.js";

@Injectable()
export class ExportCleanupService {
  private readonly logger = new Logger(ExportCleanupService.name);

  constructor(
    private readonly repository: ExportRepository,
    @Inject(DATABASE_CLIENT) private readonly database: PrismaClient,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
    private readonly config: ConfigService,
  ) {}

  async cleanup() {
    await this.cleanupDeletedScopes();
    await this.cleanupFailedDeletes();
    const expired = await this.repository.listExpiredReady(100);
    for (const request of expired) {
      try {
        await this.repository.scheduleScopeCleanup(request.id, request.attemptCount);
        if (request.objectKey) await this.storage.delete(request.objectKey);
        await this.deleteAttemptFiles(request.id, request.attemptCount);
        await this.repository.deleteRequest(request.id);
      } catch (error) {
        this.logRecordFailure(request.id, "ready", error);
      }
    }
    const failureRetentionDays = this.config.get<number>(
      "PRODUCT_EXPORT_FAILURE_RETENTION_DAYS",
      7,
    );
    const failureRetentionBefore = new Date(Date.now() - failureRetentionDays * 24 * 60 * 60_000);
    const oldFailures = await this.repository.listOldFailures(failureRetentionBefore, 100);
    for (const request of oldFailures) {
      try {
        await this.deleteAttemptFiles(request.id, request.attemptCount);
        await this.repository.deleteOldFailure(request.id, failureRetentionBefore);
      } catch (error) {
        this.logRecordFailure(request.id, "failed", error);
      }
    }
    const expiredRequests = await this.database.productExportRequest.findMany({
      where: {
        status: { in: ["QUEUED", "PROCESSING"] },
        createdAt: {
          lte: new Date(
            Date.now() - this.config.get<number>("PRODUCT_EXPORT_DEADLINE_MINUTES", 30) * 60_000,
          ),
        },
      },
      select: { id: true, attemptCount: true },
      take: 100,
    });
    for (const { id, attemptCount } of expiredRequests) {
      try {
        await this.repository.recordFailure(id, attemptCount, "DEADLINE_EXCEEDED", false);
        const request = await this.repository.findById(id);
        if (request?.status === "FAILED") await this.deleteAttemptFiles(id, attemptCount);
      } catch (error) {
        this.logRecordFailure(id, "deadline", error);
      }
    }
  }

  private async cleanupDeletedScopes() {
    const cleanups = await this.repository.listScopeCleanups(100);
    for (const cleanup of cleanups) {
      let failed = false;
      for (let attempt = 1; attempt <= cleanup.attemptCount; attempt += 1) {
        try {
          await this.storage.delete(`product-exports/${cleanup.requestId}/${attempt}/result`);
        } catch (error) {
          failed = true;
          this.logRecordFailure(cleanup.requestId, "scope-deletion", error);
        }
      }
      if (!failed)
        await this.repository.completeScopeCleanup(cleanup.requestId, cleanup.attemptCount);
      await this.repository.recordScopeCleanupAttempt(cleanup.requestId, cleanup.attemptCount);
    }
  }

  private async cleanupFailedDeletes() {
    const cleanups = await this.repository.listAttemptCleanups(100);
    for (const cleanup of cleanups) {
      try {
        await this.deleteAttemptFiles(cleanup.requestId, cleanup.attemptCount);
        await this.repository.completeAttemptCleanup(cleanup.requestId, cleanup.attemptCount);
      } catch (error) {
        await this.repository.recordAttemptCleanupFailure(cleanup.requestId, cleanup.attemptCount);
        this.logRecordFailure(cleanup.requestId, "attempt-deletion", error);
      }
    }
  }

  private async deleteAttemptFiles(requestId: string, attemptCount: number) {
    const failedAttempts: number[] = [];
    for (let attempt = 1; attempt <= attemptCount; attempt += 1) {
      try {
        await this.storage.delete(`product-exports/${requestId}/${attempt}/result`);
      } catch {
        failedAttempts.push(attempt);
      }
    }
    if (failedAttempts.length) throw new Error("Не удалось удалить файлы попыток выгрузки");
  }

  private logRecordFailure(requestId: string, phase: string, error: unknown) {
    this.logger.error(
      {
        requestId,
        phase,
        errorType: error instanceof Error ? error.constructor.name : "UnknownError",
      },
      "Не удалось очистить файлы выгрузки; запись будет обработана повторно",
    );
  }
}
