import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from "class-validator";

const auditEventTypes = [
  "product.created",
  "product.updated",
  "support.access_granted",
  "support.access_revoked",
  "service_access.started",
  "service_access.ended",
  "product.archived",
  "product.restored",
  "export.requested",
  "export.completed",
  "export.failed",
  "PRODUCT_CATALOG_MATCHED",
  "GLOBAL_INGREDIENT.UPDATED",
  "GLOBAL_ALIAS.CREATED",
  "GLOBAL_ALIAS.CONFIRMED",
  "GLOBAL_ALIAS.DELETED",
  "GLOBAL_INGREDIENT.MERGED",
  "membership.role_changed",
  "membership.delegated_permissions_changed",
  "temporary_responsibility.ended",
  "invitation.created",
  "invitation.revoked",
  "invitation.expired",
  "invitation.completed",
  "venue.created",
];

export class AuditHistoryQueryDto {
  @ApiPropertyOptional({ format: "date-time" })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ format: "date-time" })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsIn(auditEventTypes)
  eventType?: string;

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  actorId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  entityType?: string;

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  entityId?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cursor?: string;
}

export class AuditHistoryAuthorsQueryDto {
  @ApiPropertyOptional({ format: "date-time" })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ format: "date-time" })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsIn(auditEventTypes)
  eventType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  entityType?: string;

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  entityId?: string;
}

export class AuditHistoryAuthorHttpDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty()
  name!: string;
}

export class AuditEventHttpDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty()
  eventType!: string;

  @ApiProperty()
  entityType!: string;

  @ApiProperty({ format: "uuid" })
  entityId!: string;

  @ApiProperty({ format: "date-time" })
  createdAt!: string;

  @ApiProperty({ type: String, nullable: true })
  actorName!: string | null;

  @ApiProperty({ type: String, format: "uuid", nullable: true })
  actorId!: string | null;

  @ApiProperty({ type: String, nullable: true })
  entityName!: string | null;

  @ApiProperty({ type: Object, nullable: true })
  metadata!: Record<string, unknown> | null;

  @ApiProperty({ type: String, format: "uuid", nullable: true })
  venueId!: string | null;
}

export class AuditHistoryPageHttpDto {
  @ApiProperty({ type: [AuditEventHttpDto] })
  items!: AuditEventHttpDto[];

  @ApiProperty({ type: String, nullable: true })
  nextCursor!: string | null;
}
