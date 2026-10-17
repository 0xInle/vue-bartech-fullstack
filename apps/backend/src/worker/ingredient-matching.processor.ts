import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { IngredientMatchingService } from "@bartech/backend-products";
import { Job, Queue, Worker } from "bullmq";
import { Redis } from "ioredis";

type IngredientMatchingJob = { kind: "daily-catalog-match" };

@Injectable()
export class IngredientMatchingProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IngredientMatchingProcessor.name);
  private readonly connection: Redis;
  private readonly queue: Queue<IngredientMatchingJob>;
  private worker?: Worker<IngredientMatchingJob>;

  constructor(
    config: ConfigService,
    private readonly matching: IngredientMatchingService,
  ) {
    this.connection = new Redis(config.getOrThrow<string>("REDIS_URL"), {
      maxRetriesPerRequest: null,
    });
    this.queue = new Queue("indiebar-ingredient-matching", { connection: this.connection });
  }

  async onModuleInit(): Promise<void> {
    this.worker = new Worker<IngredientMatchingJob>(
      "indiebar-ingredient-matching",
      async (job: Job<IngredientMatchingJob>) => {
        if (job.data.kind === "daily-catalog-match") await this.matching.matchAllLocalIngredients();
      },
      { connection: this.connection, concurrency: 1 },
    );
    this.worker.on("failed", (job, error) => {
      this.logger.error(
        { jobId: job?.id, errorType: error.constructor.name },
        "Не удалось обработать локальные ингредиенты",
      );
    });
    await this.queue.upsertJobScheduler(
      "daily-local-ingredient-match",
      { pattern: "0 0 6 * * *", tz: "Europe/Moscow" },
      {
        name: "match-local-ingredients",
        data: { kind: "daily-catalog-match" },
        opts: {
          attempts: 3,
          backoff: { type: "exponential", delay: 60_000 },
          removeOnComplete: { count: 100 },
          removeOnFail: { age: 7 * 24 * 60 * 60 },
        },
      },
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue.close();
    await this.connection.quit();
  }
}
