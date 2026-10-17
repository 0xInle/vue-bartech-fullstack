import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, Max, Min } from "class-validator";

export class InternalAnalyticsQueryDto {
  @ApiProperty({ type: Number, minimum: 1, maximum: 90, default: 30 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(90)
  days = 30;
}
