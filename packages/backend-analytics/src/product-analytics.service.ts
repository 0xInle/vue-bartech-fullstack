import { BadRequestException, Inject, Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { DATABASE_CLIENT, type PrismaClient } from "@bartech/database";
import { ANALYTICS_EVENT_TYPES, type ProductAnalyticsJob } from "./analytics.types.js";
import { ProductAnalyticsEventDto } from "./product-analytics.dto.js";

const PRODUCT_EVENTS = new Set([
  "PRODUCT_OPENED",
  "PRODUCT_CREATE_STARTED",
  "PRODUCT_CREATE_COMPLETED",
  "PRODUCT_ARCHIVED",
  "PRODUCT_RESTORED",
]);

@Injectable()
export class ProductAnalyticsService implements OnModuleDestroy {
  private readonly logger = new Logger(ProductAnalyticsService.name);
  private readonly connection: Redis;
  private readonly queue: Queue<ProductAnalyticsJob>;

  constructor(
    config: ConfigService,
    @Inject(DATABASE_CLIENT) private readonly database: PrismaClient,
  ) {
    this.connection = new Redis(config.getOrThrow<string>("REDIS_URL"), {
      maxRetriesPerRequest: null,
    });
    this.queue = new Queue("bartech-product-analytics", { connection: this.connection });
  }

  async onModuleDestroy() {
    await this.queue.close();
    await this.connection.quit();
  }

  async enqueue(input: ProductAnalyticsEventDto): Promise<boolean> {
    const event = this.toJob(input);
    try {
      await this.queue.add("record-product-event", event, {
        jobId: event.eventId,
        attempts: 3,
        backoff: { type: "exponential", delay: 1_000 },
        removeOnComplete: true,
        removeOnFail: { age: 7 * 24 * 60 * 60 },
      });
      return true;
    } catch (error) {
      this.logger.warn(
        {
          eventType: event.eventType,
          errorType: error instanceof Error ? error.constructor.name : "UnknownError",
        },
        "Не удалось поставить продуктовое событие в очередь",
      );
      return false;
    }
  }

  async aggregate(days: number) {
    const from = new Date(Date.now() - days * 24 * 60 * 60_000);
    const grouped = await this.database.productAnalyticsEvent.groupBy({
      by: ["eventType", "errorCategory"],
      where: { createdAt: { gte: from } },
      _count: { _all: true },
    });
    const counts = Object.fromEntries(
      ANALYTICS_EVENT_TYPES.map((eventType) => [eventType, 0]),
    ) as Record<(typeof ANALYTICS_EVENT_TYPES)[number], number>;
    const errors: Record<string, number> = {};
    for (const row of grouped) {
      counts[row.eventType] += row._count._all;
      if (row.eventType === "TECHNICAL_ERROR" && row.errorCategory) {
        errors[row.errorCategory] = (errors[row.errorCategory] ?? 0) + row._count._all;
      }
    }
    return { days, counts, errors };
  }

  async record(job: ProductAnalyticsJob): Promise<void> {
    await this.database.productAnalyticsEvent.createMany({
      data: [
        {
          eventId: job.eventId,
          createdAt: new Date(job.occurredAt),
          eventType: job.eventType,
          deviceType: job.deviceType,
          productType: job.productType,
          errorCategory: job.errorCategory,
          result: job.result,
        },
      ],
      skipDuplicates: true,
    });
  }

  async deleteExpired(): Promise<void> {
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60_000);
    let expiredCount = 500;
    while (expiredCount === 500) {
      const expired = await this.database.productAnalyticsEvent.findMany({
        where: { createdAt: { lt: cutoff } },
        select: { id: true },
        take: 500,
        orderBy: { createdAt: "asc" },
      });
      expiredCount = expired.length;
      if (expiredCount) {
        await this.database.productAnalyticsEvent.deleteMany({
          where: { id: { in: expired.map((row) => row.id) } },
        });
      }
    }
  }

  private toJob(input: ProductAnalyticsEventDto): ProductAnalyticsJob {
    if (!ANALYTICS_EVENT_TYPES.includes(input.eventType)) {
      throw new BadRequestException("Неизвестный тип аналитического события");
    }
    const hasProduct = PRODUCT_EVENTS.has(input.eventType);
    const isError = input.eventType === "TECHNICAL_ERROR";
    if (input.productType === null || input.errorCategory === null || input.result === null) {
      throw new BadRequestException("Свойства события не могут быть пустыми");
    }
    if (
      hasProduct !== Boolean(input.productType) ||
      isError !== Boolean(input.errorCategory && input.result)
    ) {
      throw new BadRequestException("Свойства не соответствуют типу аналитического события");
    }
    if ((!hasProduct && input.productType) || (!isError && (input.errorCategory || input.result))) {
      throw new BadRequestException("Свойства не разрешены для этого аналитического события");
    }
    return {
      eventId: input.eventId,
      occurredAt: new Date().toISOString(),
      eventType: input.eventType,
      deviceType: input.deviceType,
      ...(input.productType ? { productType: input.productType } : {}),
      ...(input.errorCategory ? { errorCategory: input.errorCategory } : {}),
      ...(input.result ? { result: input.result } : {}),
    };
  }
}
