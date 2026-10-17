import { Module } from "@nestjs/common";
import { IdentityModule } from "@bartech/backend-identity";
import { ProductAnalyticsModule } from "@bartech/backend-analytics";
import { AnalyticsController } from "./analytics.controller.js";
import { InternalAnalyticsController } from "./internal-analytics.controller.js";
import { InternalAnalyticsPermissionGuard } from "./internal-analytics-permission.guard.js";

@Module({
  imports: [IdentityModule, ProductAnalyticsModule],
  controllers: [AnalyticsController, InternalAnalyticsController],
  providers: [InternalAnalyticsPermissionGuard],
})
export class AnalyticsApiModule {}
