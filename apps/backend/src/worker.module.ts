import { Module } from "@nestjs/common";
import { OutboxWorkerModule } from "@bartech/backend-identity";
import { AppModule } from "./app.module.js";
import { IngredientMatchingWorkerModule } from "./worker/ingredient-matching-worker.module.js";
import { ExportWorkerModule } from "@bartech/backend-exports";
import { CompanyLifecycleWorkerModule } from "./worker/company-lifecycle-worker.module.js";
import { SupportWorkerModule } from "@bartech/backend-support";
import { ProductAnalyticsWorkerModule } from "@bartech/backend-analytics";

@Module({
  imports: [
    AppModule,
    OutboxWorkerModule,
    IngredientMatchingWorkerModule,
    ExportWorkerModule,
    CompanyLifecycleWorkerModule,
    SupportWorkerModule,
    ProductAnalyticsWorkerModule,
  ],
})
export class WorkerModule {}
