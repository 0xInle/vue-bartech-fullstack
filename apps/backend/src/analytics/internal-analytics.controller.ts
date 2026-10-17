import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiForbiddenResponse, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { InternalSessionGuard } from "@bartech/backend-identity";
import { ProductAnalyticsService } from "@bartech/backend-analytics";
import { InternalAnalyticsPermissionGuard } from "./internal-analytics-permission.guard.js";
import { InternalAnalyticsQueryDto } from "./internal-analytics.dto.js";

@ApiTags("internal-analytics")
@Controller("internal/analytics")
@UseGuards(InternalSessionGuard, InternalAnalyticsPermissionGuard)
export class InternalAnalyticsController {
  constructor(private readonly analytics: ProductAnalyticsService) {}

  @Get()
  @ApiOperation({ summary: "Получить агрегированные показатели продуктовой аналитики" })
  @ApiForbiddenResponse({ description: "Нет разрешения product_analytics" })
  @ApiOkResponse({
    schema: {
      type: "object",
      properties: {
        days: { type: "number" },
        counts: { type: "object", additionalProperties: { type: "number" } },
        errors: { type: "object", additionalProperties: { type: "number" } },
      },
    },
  })
  list(@Query() query: InternalAnalyticsQueryDto) {
    return this.analytics.aggregate(query.days);
  }
}
