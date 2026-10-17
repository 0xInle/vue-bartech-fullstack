import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsUUID } from "class-validator";
import {
  ANALYTICS_DEVICE_TYPES,
  ANALYTICS_ERROR_CATEGORIES,
  ANALYTICS_EVENT_TYPES,
  ANALYTICS_PRODUCT_TYPES,
} from "./analytics.types.js";

export class ProductAnalyticsEventDto {
  @ApiProperty({ format: "uuid" })
  @IsUUID()
  eventId!: string;

  @ApiProperty({ enum: ANALYTICS_EVENT_TYPES })
  @IsIn(ANALYTICS_EVENT_TYPES)
  eventType!: (typeof ANALYTICS_EVENT_TYPES)[number];

  @ApiProperty({ enum: ANALYTICS_DEVICE_TYPES })
  @IsIn(ANALYTICS_DEVICE_TYPES)
  deviceType!: (typeof ANALYTICS_DEVICE_TYPES)[number];

  @ApiPropertyOptional({ enum: ANALYTICS_PRODUCT_TYPES })
  @IsOptional()
  @IsIn(ANALYTICS_PRODUCT_TYPES)
  productType?: (typeof ANALYTICS_PRODUCT_TYPES)[number];

  @ApiPropertyOptional({ enum: ANALYTICS_ERROR_CATEGORIES })
  @IsOptional()
  @IsIn(ANALYTICS_ERROR_CATEGORIES)
  errorCategory?: (typeof ANALYTICS_ERROR_CATEGORIES)[number];

  @ApiPropertyOptional({ enum: ["FAILURE"] })
  @IsOptional()
  @IsIn(["FAILURE"])
  result?: "FAILURE";
}
