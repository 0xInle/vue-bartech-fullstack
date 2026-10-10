import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DATABASE_CLIENT, PrismaClient } from "@bartech/database";
import { Job, Queue, Worker } from "bullmq";
import { Redis } from "ioredis";
import { EmailOutboxService } from "./email-outbox.service.js";
import { SmtpEmailService } from "./smtp-email.service.js";
import { ExpiredDataCleanupService } from "./expired-data-cleanup.service.js";

type OutboxJob = { outboxId: string };

@Injectable()
export class OutboxProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxProcessor.name);
  private readonly connection: Redis;
  private readonly queue: Queue<OutboxJob>;
  private worker?: Worker<OutboxJob>;
  private timer?: NodeJS.Timeout;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(
    config: ConfigService,
    @Inject(DATABASE_CLIENT) private readonly database: PrismaClient,
    private readonly outbox: EmailOutboxService,
    private readonly email: SmtpEmailService,
    private readonly cleanup: ExpiredDataCleanupService,
  ) {
    this.connection = new Redis(config.getOrThrow<string>("REDIS_URL"), {
      maxRetriesPerRequest: null,
    });
    this.queue = new Queue("bartech-outbox", { connection: this.connection });
  }

  onModuleInit(): void {
    this.worker = new Worker<OutboxJob>(
      "bartech-outbox",
      async (job: Job<OutboxJob>) =>
        this.outbox.deliver(job.data.outboxId, (message, messageId) =>
          this.email.send(message, messageId),
        ),
      { connection: this.connection, concurrency: 4 },
    );
    this.worker.on("failed", (job, error) => {
      this.logger.error(
        { outboxId: job?.data.outboxId, errorType: error.constructor.name },
        "Не удалось обработать письмо",
      );
    });
    this.timer = setInterval(() => void this.dispatchPending(), 3_000);
    void this.cleanupExpiredRecords();
    this.cleanupTimer = setInterval(() => void this.cleanupExpiredRecords(), 5 * 60_000);
    void this.dispatchPending();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    await this.worker?.close();
    await this.queue.close();
    await this.connection.quit();
  }

  private async dispatchPending(): Promise<void> {
    try {
      const messages = await this.database.outboxMessage.findMany({
        where: {
          status: "PENDING",
          nextAttemptAt: { lte: new Date() },
          payloadCiphertext: { not: null },
        },
        select: { id: true },
        orderBy: { createdAt: "asc" },
        take: 20,
      });
      if (!messages.length) return;

      await this.queue.addBulk(
        messages.map(({ id }) => ({
          name: "deliver-email",
          data: { outboxId: id },
          opts: { jobId: id, removeOnComplete: true, removeOnFail: true },
        })),
      );
    } catch (error) {
      this.logger.error(
        { errorType: error instanceof Error ? error.constructor.name : "UnknownError" },
        "Не удалось передать письма в очередь",
      );
    }
  }

  private async cleanupExpiredRecords(): Promise<void> {
    try {
      await this.cleanup.cleanupExpired();
    } catch (error) {
      this.logger.error(
        { errorType: error instanceof Error ? error.constructor.name : "UnknownError" },
        "Не удалось очистить временные данные идентификации",
      );
    }
  }
}
