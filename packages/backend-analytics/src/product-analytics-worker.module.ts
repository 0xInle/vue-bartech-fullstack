import { Module } from "@nestjs/common";
import { ProductAnalyticsModule } from "./product-analytics.module.js";
import { ProductAnalyticsWorker } from "./product-analytics.worker.js";

@Module({ imports: [ProductAnalyticsModule], providers: [ProductAnalyticsWorker] })
export class ProductAnalyticsWorkerModule {}
