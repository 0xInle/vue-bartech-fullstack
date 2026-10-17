import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class AuditEventDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty()
  eventType!: string;

  @ApiProperty()
  entityType!: string;

  @ApiProperty({ format: "uuid" })
  entityId!: string;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty({ nullable: true })
  actorName!: string | null;

  @ApiProperty({ format: "uuid", nullable: true })
  actorId!: string | null;

  @ApiProperty({ nullable: true })
  entityName!: string | null;

  @ApiProperty({ type: Object, nullable: true })
  metadata!: Record<string, unknown> | null;

  @ApiProperty({ format: "uuid", nullable: true })
  venueId!: string | null;
}

export class AuditHistoryPageDto {
  @ApiProperty({ type: [AuditEventDto] })
  items!: AuditEventDto[];

  @ApiPropertyOptional({ nullable: true })
  nextCursor!: string | null;
}
