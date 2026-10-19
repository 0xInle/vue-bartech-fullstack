import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

const scheduleRoles = ["BARTENDER", "SENIOR_BARTENDER", "BARBACK", "TRAINEE", "BAR_MANAGER"];
const shiftTypes = ["NORMAL", "NIGHT"];
const statuses = ["VACATION", "SICK_LEAVE", "NO_SHOW"];

export class ScheduleMonthQueryDto {
  @ApiProperty({ minimum: 2000, maximum: 2200 })
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2200)
  year!: number;

  @ApiProperty({ minimum: 1, maximum: 12 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;
}

export class ScheduleSettingsDto {
  @ApiProperty({ minimum: 1, maximum: 24 })
  @IsInt()
  @Min(1)
  @Max(24)
  standardShiftDurationHours!: number;
}

export class ScheduleValueDto {
  @ApiProperty({ enum: ["SHIFT", "STATUS", "EMPTY"] })
  @IsIn(["SHIFT", "STATUS", "EMPTY"])
  kind!: "SHIFT" | "STATUS" | "EMPTY";

  @ApiPropertyOptional({ minimum: 1, maximum: 24 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(24)
  durationHours?: number;

  @ApiPropertyOptional({ enum: shiftTypes })
  @IsOptional()
  @IsIn(shiftTypes)
  shiftType?: "NORMAL" | "NIGHT";

  @ApiPropertyOptional({ enum: statuses })
  @IsOptional()
  @IsIn(statuses)
  status?: "VACATION" | "SICK_LEAVE" | "NO_SHOW";
}

export class ScheduleCellDto {
  @ApiProperty({ format: "uuid" })
  @IsUUID()
  membershipId!: string;

  @ApiProperty({ format: "date" })
  @IsDateString({ strict: true })
  date!: string;

  @ApiProperty({ type: ScheduleValueDto })
  @ValidateNested()
  @Type(() => ScheduleValueDto)
  value!: ScheduleValueDto;
}

export class ScheduleCellsDto {
  @ApiProperty({ type: [ScheduleCellDto], minItems: 1, maxItems: 500 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => ScheduleCellDto)
  cells!: ScheduleCellDto[];
}

export class ScheduleAssignmentDto {
  @ApiProperty({ format: "uuid" })
  @IsUUID()
  membershipId!: string;

  @ApiProperty({ format: "uuid" })
  @IsUUID()
  templateId!: string;

  @ApiProperty({ format: "uuid" })
  @IsUUID()
  templateVersionId!: string;

  @ApiProperty({ format: "date" })
  @IsDateString({ strict: true })
  cycleAnchorDate!: string;

  @ApiProperty({ format: "date" })
  @IsDateString({ strict: true })
  applyFromDate!: string;
}

export class ScheduleGenerateDto extends ScheduleMonthQueryDto {
  @ApiProperty({ type: [ScheduleAssignmentDto] })
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => ScheduleAssignmentDto)
  assignments!: ScheduleAssignmentDto[];

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  overwrite?: boolean;
}

export class ScheduleTemplateDto {
  @ApiProperty({ maxLength: 80 })
  @IsString()
  @MaxLength(80)
  name!: string;

  @ApiProperty({ minimum: 1, maximum: 31 })
  @IsInt()
  @Min(1)
  @Max(31)
  workDays!: number;

  @ApiProperty({ minimum: 1, maximum: 31 })
  @IsInt()
  @Min(1)
  @Max(31)
  offDays!: number;

  @ApiProperty({ minimum: 1, maximum: 24 })
  @IsInt()
  @Min(1)
  @Max(24)
  durationHours!: number;

  @ApiProperty({ enum: shiftTypes })
  @IsIn(shiftTypes)
  shiftType!: "NORMAL" | "NIGHT";
}

export class ScheduleCommentDto {
  @ApiProperty({ maxLength: 1000 })
  @IsString()
  @MaxLength(1000)
  text!: string;
}

export class ScheduleExportQueryDto extends ScheduleMonthQueryDto {
  @ApiProperty({ enum: ["pdf", "xlsx"] })
  @IsIn(["pdf", "xlsx"])
  format!: "pdf" | "xlsx";
}

export class ScheduleRoleDto {
  @ApiProperty({ enum: scheduleRoles })
  @IsIn(scheduleRoles)
  role!: string;
}
