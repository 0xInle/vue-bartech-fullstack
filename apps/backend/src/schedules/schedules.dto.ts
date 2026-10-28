import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  ArrayUnique,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  isUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
  Validate,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from "class-validator";

const scheduleRoles = ["BARTENDER", "SENIOR_BARTENDER", "BARBACK", "TRAINEE", "BAR_MANAGER"];
export const shiftTypes = ["MORNING", "DAY", "EVENING", "NIGHT"] as const;
const statuses = ["VACATION", "SICK_LEAVE", "NO_SHOW"];

@ValidatorConstraint({ name: "shiftSettingIdOrNull", async: false })
class ShiftSettingIdOrNull implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return value === null || (typeof value === "string" && isUUID(value));
  }
}

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

export class ScheduleDateMarkerDto {
  @ApiProperty({ format: "date" })
  date!: string;

  @ApiProperty({ enum: ["INVENTORY"] })
  type!: "INVENTORY";
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
  shiftCode?: (typeof shiftTypes)[number];

  @ApiPropertyOptional({ minimum: 0, maximum: 1439 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1439)
  startMinute?: number;

  @ApiPropertyOptional({ format: "uuid", nullable: true })
  @IsOptional()
  @IsUUID()
  shiftSettingId?: string | null;

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

export class ScheduleExtendDto extends ScheduleMonthQueryDto {
  @ApiProperty({
    type: "array",
    items: { type: "string", format: "uuid" },
    minItems: 1,
    maxItems: 200,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  membershipIds!: string[];
}

export class ScheduleTemplateDto {
  @ApiProperty({ maxLength: 80 })
  @IsString()
  @MaxLength(80)
  name!: string;

  @ApiProperty({
    type: "array",
    items: { type: "string", format: "uuid", nullable: true },
    minItems: 1,
    maxItems: 31,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(31)
  @Validate(ShiftSettingIdOrNull, { each: true })
  days!: Array<string | null>;
}

export class ScheduleShiftSettingDto {
  @ApiProperty({ format: "uuid" })
  @IsUUID()
  id!: string;

  @ApiProperty({ enum: shiftTypes })
  @IsIn(shiftTypes)
  shiftCode!: (typeof shiftTypes)[number];

  @ApiProperty({ minimum: 0, maximum: 1439 })
  @IsInt()
  @Min(0)
  @Max(1439)
  startMinute!: number;

  @ApiProperty({ minimum: 1, maximum: 24 })
  @IsInt()
  @Min(1)
  @Max(24)
  defaultDurationHours!: number;
}

export class ScheduleShiftSettingInputDto {
  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty({ enum: shiftTypes })
  @IsIn(shiftTypes)
  shiftCode!: (typeof shiftTypes)[number];

  @ApiProperty({ minimum: 0, maximum: 1439 })
  @IsInt()
  @Min(0)
  @Max(1439)
  startMinute!: number;

  @ApiProperty({ minimum: 1, maximum: 24 })
  @IsInt()
  @Min(1)
  @Max(24)
  defaultDurationHours!: number;
}

export class ScheduleShiftSettingsDto {
  @ApiProperty({ type: [ScheduleShiftSettingInputDto], minItems: 0 })
  @IsArray()
  @ArrayUnique(
    (setting: ScheduleShiftSettingInputDto) =>
      setting.id ?? `${setting.shiftCode}:${setting.startMinute}:${setting.defaultDurationHours}`,
  )
  @ValidateNested({ each: true })
  @Type(() => ScheduleShiftSettingInputDto)
  settings!: ScheduleShiftSettingInputDto[];
}

export class ScheduleCommentDto {
  @ApiProperty({ maxLength: 250 })
  @IsString()
  @MaxLength(250)
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
