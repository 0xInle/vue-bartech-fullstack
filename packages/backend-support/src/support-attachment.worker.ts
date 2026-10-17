import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Job, Queue, Worker } from "bullmq";
import { Redis } from "ioredis";
import { SupportAttachmentProcessor } from "./support-attachment.processor.js";
import { SupportAttachmentRepository } from "./support-attachment.repository.js";
import { SupportService } from "./support.service.js";

type SupportAttachmentJob = { attachmentId: string };

@Injectable()
export class SupportAttachmentWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SupportAttachmentWorker.name);
  private readonly connection: Redis;
  private readonly queue: Queue<SupportAttachmentJob>;
  private worker?: Worker<SupportAttachmentJob>;
  private dispatchTimer?: NodeJS.Timeout;

  constructor(
    config: ConfigService,
    private readonly repository: SupportAttachmentRepository,
    private readonly processor: SupportAttachmentProcessor,
    private readonly support: SupportService,
  ) {
    this.connection = new Redis(config.getOrThrow<string>("REDIS_URL"), {
      maxRetriesPerRequest: null,
    });
    this.queue = new Queue("bartech-support-attachments", { connection: this.connection });
  }

  onModuleInit() {
    this.worker = new Worker<SupportAttachmentJob>(
      "bartech-support-attachments",
      (job: Job<SupportAttachmentJob>) => this.processor.process(job.data.attachmentId),
      { connection: this.connection, concurrency: 2, autorun: true },
    );
    this.worker.on("failed", (job, error) => {
      this.logger.warn(
        { attachmentId: job?.data.attachmentId, errorType: error.constructor.name },
        "Повтор проверки вложения завершился ошибкой",
      );
      if (job && job.attemptsMade >= (job.opts.attempts ?? 5)) {
        void this.support.rejectPending(job.data.attachmentId).catch(() => undefined);
      }
    });
    this.dispatchTimer = setInterval(() => void this.dispatch(), 3_000);
    void this.dispatch();
  }

  async onModuleDestroy() {
    if (this.dispatchTimer) clearInterval(this.dispatchTimer);
    await this.worker?.close();
    await this.queue.close();
    await this.connection.quit();
  }

  private async dispatch() {
    try {
      const outbox = await this.repository.listOutbox(50);
      for (const message of outbox) {
        await this.enqueue(message.attachmentId);
        await this.repository.markOutboxDelivered(message.id);
      }
      const pending = await this.repository.listPending(50);
      for (const attachment of pending) await this.enqueue(attachment.id);
    } catch (error) {
      this.logger.error(
        { errorType: error instanceof Error ? error.constructor.name : "UnknownError" },
        "Не удалось передать вложения поддержки в очередь",
      );
    }
  }

  private enqueue(attachmentId: string) {
    return this.queue.add(
      "scan-support-attachment",
      { attachmentId },
      {
        jobId: attachmentId,
        attempts: 5,
        backoff: { type: "exponential", delay: 15_000 },
        removeOnComplete: true,
        removeOnFail: true,
      },
    );
  }
}
