import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Job, Queue, Worker } from "bullmq";
import { Redis } from "ioredis";
import { ProductAnalyticsService } from "./product-analytics.service.js";
import type { ProductAnalyticsJob } from "./analytics.types.js";

type AnalyticsMaintenanceJob = { kind: "delete-expired" };

@Injectable()
export class ProductAnalyticsWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ProductAnalyticsWorker.name);
  private readonly connection: Redis;
  private readonly queue: Queue<ProductAnalyticsJob | AnalyticsMaintenanceJob>;
  private worker?: Worker<ProductAnalyticsJob | AnalyticsMaintenanceJob>;

  constructor(
    config: ConfigService,
    private readonly analytics: ProductAnalyticsService,
  ) {
    this.connection = new Redis(config.getOrThrow<string>("REDIS_URL"), {
      maxRetriesPerRequest: null,
    });
    this.queue = new Queue("bartech-product-analytics", { connection: this.connection });
  }

  async onModuleInit() {
    this.worker = new Worker(
      "bartech-product-analytics",
      async (job: Job<ProductAnalyticsJob | AnalyticsMaintenanceJob>) => {
        if ("kind" in job.data && job.data.kind === "delete-expired") {
          await this.analytics.deleteExpired();
        } else if ("eventType" in job.data) {
          await this.analytics.record(job.data);
        }
      },
      { connection: this.connection, concurrency: 4 },
    );
    this.worker.on("failed", (job, error) => {
      this.logger.warn(
        { jobId: job?.id, errorType: error.constructor.name },
        "Не удалось обработать продуктовое событие",
      );
    });
    await this.queue.upsertJobScheduler(
      "product-analytics-daily-cleanup",
      { pattern: "0 0 4 * * *", tz: "Europe/Moscow" },
      {
        name: "delete-expired-analytics-events",
        data: { kind: "delete-expired" },
        opts: {
          attempts: 3,
          backoff: { type: "exponential", delay: 60_000 },
          removeOnComplete: { count: 100 },
          removeOnFail: { age: 7 * 24 * 60 * 60 },
        },
      },
    );
    await this.queue.add(
      "delete-expired-analytics-events",
      { kind: "delete-expired" },
      {
        jobId: `startup-cleanup-${Date.now()}`,
        attempts: 3,
        removeOnComplete: true,
        removeOnFail: true,
      },
    );
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue.close();
    await this.connection.quit();
  }
}
