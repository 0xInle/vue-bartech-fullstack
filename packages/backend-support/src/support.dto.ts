import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export enum SupportReasonDto {
  DATA_MIGRATION = "data_migration",
  ERROR = "error",
  OTHER = "other",
}

export enum SupportStatusDto {
  NEW = "new",
  IN_PROGRESS = "in_progress",
  WAITING_ON_CUSTOMER = "waiting_on_customer",
  CLOSED = "closed",
}

export class CreateSupportMessageDto {
  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string;
}

export class CreateInternalSupportMessageDto {
  @ApiProperty({ maxLength: 5000 })
  @IsString()
  @MaxLength(5000)
  message!: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  requestAccess?: boolean;
}

export class MarkSupportMessagesReadDto {
  @ApiProperty({ format: "uuid" })
  @IsUUID("all")
  throughMessageId!: string;
}

export class CreateSupportRequestDto {
  @ApiProperty({ enum: SupportReasonDto })
  @IsEnum(SupportReasonDto)
  reason!: SupportReasonDto;

  @ApiProperty({ maxLength: 1000 })
  @IsString()
  @MaxLength(1000)
  message!: string;

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID("all")
  companyId?: string;

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID("all")
  venueId?: string;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  browser?: string;

  @ApiPropertyOptional({ maxLength: 128 })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  errorId?: string;
}

export class UpdateSupportRequestDto {
  @ApiPropertyOptional({ enum: SupportStatusDto })
  @IsOptional()
  @IsEnum(SupportStatusDto)
  status?: SupportStatusDto;

  @ApiPropertyOptional({ type: String, format: "uuid", nullable: true })
  @IsOptional()
  @IsUUID("all")
  assignedToId?: string | null;
}

export class SupportQueueQueryDto {
  @ApiPropertyOptional({ enum: SupportStatusDto })
  @IsOptional()
  @IsEnum(SupportStatusDto)
  status?: SupportStatusDto;

  @ApiPropertyOptional({ type: Number, default: 1, minimum: 1, maximum: 10000 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  page = 1;
}

export class SupportAttachmentResponseDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty()
  originalName!: string;

  @ApiProperty()
  contentType!: string;

  @ApiProperty({ type: Number })
  sizeBytes!: number;

  @ApiProperty({ enum: ["pending_scan", "clean", "rejected"] })
  status!: string;

  @ApiPropertyOptional({ type: String, nullable: true, enum: ["INFECTED_FILE", "SCAN_FAILED"] })
  errorCode!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiPropertyOptional({ type: String, format: "date-time", nullable: true })
  scannedAt!: Date | null;
}

export class SupportMessageAccessGrantDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty({ enum: ["COMPANY", "VENUE"] })
  scopeType!: string;

  @ApiProperty()
  companyName!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  venueName!: string | null;

  @ApiProperty({ type: String, format: "date-time" })
  expiresAt!: Date;

  @ApiPropertyOptional({ type: String, format: "date-time", nullable: true })
  revokedAt!: Date | null;

  @ApiProperty()
  active!: boolean;
}

export class SupportMessageResponseDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty({ enum: ["customer", "internal"] })
  authorType!: string;

  @ApiProperty()
  authorName!: string;

  @ApiProperty({ enum: ["text", "access_request"] })
  kind!: string;

  @ApiProperty()
  body!: string;

  @ApiProperty({ type: String, format: "date-time" })
  createdAt!: Date;

  @ApiProperty({ type: [SupportAttachmentResponseDto] })
  attachments!: SupportAttachmentResponseDto[];

  @ApiPropertyOptional({ type: SupportMessageAccessGrantDto, nullable: true })
  accessGrant!: SupportMessageAccessGrantDto | null;
}

export class SupportUnreadRequestDto {
  @ApiProperty({ format: "uuid" })
  requestId!: string;

  @ApiProperty()
  unreadCount!: number;
}

export class SupportUnreadCountDto {
  @ApiProperty()
  totalCount!: number;

  @ApiProperty({ type: [SupportUnreadRequestDto] })
  requests!: SupportUnreadRequestDto[];
}

export class SupportRequestResponseDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty({ enum: SupportReasonDto })
  reason!: string;

  @ApiProperty()
  message!: string;

  @ApiProperty({ enum: SupportStatusDto })
  status!: string;

  @ApiPropertyOptional({ nullable: true })
  technicalContext!: Record<string, string> | null;

  @ApiPropertyOptional({ type: String, format: "uuid", nullable: true })
  companyId!: string | null;

  @ApiPropertyOptional({ type: String, format: "uuid", nullable: true })
  venueId!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiProperty({ type: [SupportAttachmentResponseDto] })
  attachments!: SupportAttachmentResponseDto[];
}

export class SupportRequestAuthorDto {
  @ApiProperty({ type: String, format: "uuid" })
  id!: string;

  @ApiProperty({ type: String, format: "email" })
  email!: string;

  @ApiProperty({ type: String })
  fullName!: string;
}

export class SupportRequestAssigneeDto {
  @ApiProperty({ type: String, format: "uuid" })
  id!: string;

  @ApiProperty({ type: String, format: "email" })
  email!: string;
}

export class SupportRequestQueueItemDto extends SupportRequestResponseDto {
  @ApiPropertyOptional({ type: SupportRequestAuthorDto, nullable: true })
  author!: SupportRequestAuthorDto | null;

  @ApiPropertyOptional({ type: SupportRequestAssigneeDto, nullable: true })
  assignedTo!: SupportRequestAssigneeDto | null;
}

export class SupportRequestQueuePageDto {
  @ApiProperty({ type: [SupportRequestQueueItemDto] })
  items!: SupportRequestQueueItemDto[];

  @ApiProperty()
  page!: number;

  @ApiProperty()
  pageSize!: number;

  @ApiProperty()
  total!: number;
}

export class SupportInternalUserResponseDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty()
  email!: string;
}
