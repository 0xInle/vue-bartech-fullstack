import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from "@nestjs/common";
import { ApiAcceptedResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { SessionGuard } from "@bartech/backend-identity";
import { ProductAnalyticsEventDto, ProductAnalyticsService } from "@bartech/backend-analytics";

@ApiTags("analytics")
@Controller("analytics/events")
@UseGuards(SessionGuard)
export class AnalyticsController {
  constructor(private readonly analytics: ProductAnalyticsService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: "Поставить разрешённое продуктовое событие в очередь" })
  @ApiAcceptedResponse({
    schema: { type: "object", properties: { accepted: { type: "boolean" } } },
  })
  async create(@Body() event: ProductAnalyticsEventDto): Promise<{ accepted: boolean }> {
    return { accepted: await this.analytics.enqueue(event) };
  }
}
