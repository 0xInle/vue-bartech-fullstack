import { Inject, Injectable, Logger } from "@nestjs/common";
import { createReadStream } from "node:fs";
import { FILE_STORAGE, type FileStorage } from "@bartech/backend-files";
import { ExportRepository } from "./export.repository.js";
import { ExportRendererService } from "./export-renderer.service.js";

@Injectable()
export class ExportProcessor {
  private readonly logger = new Logger(ExportProcessor.name);

  constructor(
    private readonly repository: ExportRepository,
    private readonly renderer: ExportRendererService,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
  ) {}

  async process(requestId: string) {
    const request = await this.repository.claim(requestId);
    if (!request) return;
    // Monotonic attemptCount fences reclaimed leases and isolates their files.
    const attemptCount = request.attemptCount;
    const objectKey = `product-exports/${request.id}/${attemptCount}/result`;
    let rendered: Awaited<ReturnType<ExportRendererService["render"]>> | undefined;
    const leaseTimer = setInterval(() => {
      void this.repository.extendLease(request.id, attemptCount).then((extended) => {
        if (!extended) clearInterval(leaseTimer);
      });
    }, 30_000);
    try {
      rendered = await this.renderer.render(request);
      if (!(await this.repository.canUpload(request.id, attemptCount))) return;
      await this.storage.put({
        key: objectKey,
        body: createReadStream(rendered.path),
        contentType: rendered.contentType,
        fileName: rendered.fileName,
      });
      const completed = await this.repository.complete(request.id, {
        attemptCount,
        objectKey,
        fileName: rendered.fileName,
        contentType: rendered.contentType,
        fileSizeBytes: rendered.size,
      });
      if (!completed) await this.deleteOrScheduleCleanup(request.id, attemptCount, objectKey);
    } catch (error) {
      const errorCode = "EXPORT_PROCESSING_FAILED";
      this.logger.error(
        { requestId: request.id, exportType: request.type, errorCode },
        "Не удалось подготовить выгрузку",
      );
      await this.deleteOrScheduleCleanup(request.id, attemptCount, objectKey);
      await this.repository.recordFailure(
        request.id,
        attemptCount,
        errorCode,
        request.attemptCount < this.repository.maxAttempts,
      );
      if (request.attemptCount < this.repository.maxAttempts) throw error;
    } finally {
      clearInterval(leaseTimer);
      await rendered?.cleanup();
    }
  }

  private async deleteOrScheduleCleanup(
    requestId: string,
    attemptCount: number,
    objectKey: string,
  ) {
    try {
      await this.storage.delete(objectKey);
    } catch {
      await this.repository.scheduleCleanup(requestId, attemptCount);
    }
  }
}
