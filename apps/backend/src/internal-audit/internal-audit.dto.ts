import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

export class InternalAuditQueryDto {
  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 100, default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 50;

  @ApiPropertyOptional({ maxLength: 256 })
  @IsOptional()
  @IsString()
  @MaxLength(256)
  cursor?: string;
}

export class InternalAuditEventDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty({ format: "date-time" })
  createdAt!: string;

  @ApiProperty()
  eventType!: string;

  @ApiProperty({ enum: ["OPERATOR", "INTERNAL_USER", "SYSTEM"] })
  actorType!: "OPERATOR" | "INTERNAL_USER" | "SYSTEM";

  @ApiProperty({ type: String, nullable: true, format: "email" })
  actorEmail!: string | null;

  @ApiProperty({ type: String, nullable: true, format: "uuid" })
  companyId!: string | null;

  @ApiProperty({ type: String, nullable: true, format: "uuid" })
  venueId!: string | null;

  @ApiProperty({ type: String, nullable: true, format: "uuid" })
  serviceSessionId!: string | null;
}

export class InternalAuditPageDto {
  @ApiProperty({ type: [InternalAuditEventDto] })
  items!: InternalAuditEventDto[];

  @ApiProperty({ type: String, nullable: true, maxLength: 256 })
  nextCursor!: string | null;
}
