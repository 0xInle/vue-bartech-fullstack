import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Job, Queue, Worker } from "bullmq";
import { Redis } from "ioredis";
import { ExportCleanupService } from "./export-cleanup.service.js";
import { ExportProcessor } from "./export.processor.js";
import { ExportRepository } from "./export.repository.js";

type ProductExportJob = { requestId: string };

@Injectable()
export class ExportWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ExportWorker.name);
  private readonly connection: Redis;
  private readonly queue: Queue<ProductExportJob>;
  private worker?: Worker<ProductExportJob>;
  private dispatchTimer?: NodeJS.Timeout;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(
    config: ConfigService,
    private readonly repository: ExportRepository,
    private readonly processor: ExportProcessor,
    private readonly cleanup: ExportCleanupService,
  ) {
    this.connection = new Redis(config.getOrThrow<string>("REDIS_URL"), {
      maxRetriesPerRequest: null,
    });
    this.queue = new Queue("bartech-product-exports", { connection: this.connection });
  }

  onModuleInit() {
    this.worker = new Worker<ProductExportJob>(
      "bartech-product-exports",
      (job: Job<ProductExportJob>) => this.processor.process(job.data.requestId),
      { connection: this.connection, concurrency: 2 },
    );
    this.worker.on("failed", (job) => {
      this.logger.warn(
        { requestId: job?.data.requestId },
        "Повтор обработки выгрузки завершился ошибкой",
      );
    });
    this.dispatchTimer = setInterval(() => void this.dispatch(), 3_000);
    this.cleanupTimer = setInterval(() => void this.runCleanup(), 24 * 60 * 60_000);
    void this.dispatch();
    void this.runCleanup();
  }

  async onModuleDestroy() {
    if (this.dispatchTimer) clearInterval(this.dispatchTimer);
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    await this.worker?.close();
    await this.queue.close();
    await this.connection.quit();
  }

  private async dispatch() {
    try {
      const outbox = await this.repository.listOutbox(50);
      for (const message of outbox) {
        await this.enqueue(message.requestId);
        await this.repository.markOutboxDelivered(message.id);
      }
      const requests = await this.repository.listDispatchable(50);
      for (const request of requests) await this.enqueue(request.id);
    } catch (error) {
      this.logger.error(
        { errorType: error instanceof Error ? error.constructor.name : "UnknownError" },
        "Не удалось передать выгрузки в очередь",
      );
    }
  }

  private enqueue(requestId: string) {
    return this.queue.add(
      "prepare-export",
      { requestId },
      {
        jobId: requestId,
        attempts: this.repository.maxAttempts,
        backoff: { type: "exponential", delay: 30_000 },
        removeOnComplete: true,
        removeOnFail: true,
      },
    );
  }

  private async runCleanup() {
    try {
      await this.cleanup.cleanup();
    } catch (error) {
      this.logger.error(
        { errorType: error instanceof Error ? error.constructor.name : "UnknownError" },
        "Не удалось очистить временные выгрузки",
      );
    }
  }
}
