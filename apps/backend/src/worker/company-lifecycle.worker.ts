import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Job, Queue, Worker } from "bullmq";
import { Redis } from "ioredis";
import { OrganizationLifecycleService } from "../organizations/organization-lifecycle.service.js";

type CompanyLifecycleJob = { kind: "delete-expired-companies" };

@Injectable()
export class CompanyLifecycleWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CompanyLifecycleWorker.name);
  private readonly connection: Redis;
  private readonly queue: Queue<CompanyLifecycleJob>;
  private worker?: Worker<CompanyLifecycleJob>;

  constructor(
    config: ConfigService,
    private readonly lifecycle: OrganizationLifecycleService,
  ) {
    this.connection = new Redis(config.getOrThrow<string>("REDIS_URL"), {
      maxRetriesPerRequest: null,
    });
    this.queue = new Queue("bartech-company-lifecycle", { connection: this.connection });
  }

  async onModuleInit() {
    this.worker = new Worker<CompanyLifecycleJob>(
      "bartech-company-lifecycle",
      async (job: Job<CompanyLifecycleJob>) => {
        if (job.data.kind === "delete-expired-companies") {
          await this.lifecycle.deleteExpiredCompanies();
        }
      },
      { connection: this.connection, concurrency: 1 },
    );
    this.worker.on("failed", (job, error) => {
      this.logger.error(
        { jobId: job?.id, errorType: error.constructor.name },
        "Не удалось завершить закрытие компаний",
      );
    });
    await this.queue.upsertJobScheduler(
      "delete-expired-companies",
      { pattern: "0 * * * * *", tz: "Europe/Moscow" },
      {
        name: "delete-expired-companies",
        data: { kind: "delete-expired-companies" },
        opts: {
          attempts: 3,
          backoff: { type: "exponential", delay: 60_000 },
          removeOnComplete: { count: 100 },
          removeOnFail: { age: 7 * 24 * 60 * 60 },
        },
      },
    );
    await this.queue.add(
      "delete-expired-companies",
      { kind: "delete-expired-companies" },
      { jobId: `startup-${Date.now()}`, attempts: 3, removeOnComplete: true, removeOnFail: true },
    );
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue.close();
    await this.connection.quit();
  }
}
