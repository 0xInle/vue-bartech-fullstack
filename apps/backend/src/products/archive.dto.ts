import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  ArrayUnique,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import type { ProductType } from "@bartech/database";

const productTypes: ProductType[] = ["INGREDIENT", "PREPARATION", "GARNISH", "COCKTAIL"];

export class ArchiveListQueryDto {
  @ApiPropertyOptional({ maxLength: 160 })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  query?: string;

  @ApiPropertyOptional({ enum: productTypes })
  @IsOptional()
  @IsIn(productTypes)
  type?: ProductType;
}

export class ArchiveProductSummaryDto {
  @ApiProperty({ format: "uuid" })
  id!: string;
  @ApiProperty({ enum: productTypes })
  type!: ProductType;
  @ApiProperty()
  name!: string;
}

export class ArchiveListItemDto extends ArchiveProductSummaryDto {
  @ApiProperty({ format: "date-time" })
  updatedAt!: string;
}

export class ArchiveComponentDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ format: "uuid" }) productId!: string;
  @ApiProperty({ enum: productTypes }) productType!: ProductType;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: ["ACTIVE", "ARCHIVED"] }) status!: string;
  @ApiProperty() amount!: number;
  @ApiProperty({ format: "uuid" }) unitId!: string;
  @ApiProperty() unit!: string;
}

export class ArchiveGarnishDto extends ArchiveProductSummaryDto {
  @ApiProperty({ enum: ["ACTIVE", "ARCHIVED"] }) status!: string;
}

export class ArchiveOutputDto {
  @ApiProperty() amount!: number;
  @ApiProperty({ format: "uuid" }) unitId!: string;
  @ApiProperty() unit!: string;
}

export class ArchiveCardDto extends ArchiveListItemDto {
  @ApiProperty({ enum: ["ARCHIVED"] }) status!: "ARCHIVED";
  @ApiProperty({ type: String, nullable: true }) technology!: string | null;
  @ApiProperty({ type: String, nullable: true }) comment!: string | null;
  @ApiProperty({ type: String, nullable: true }) category!: string | null;
  @ApiProperty({ type: String, nullable: true }) brand!: string | null;
  @ApiProperty({ type: Number, nullable: true }) strength!: number | null;
  @ApiProperty({ type: String, nullable: true }) country!: string | null;
  @ApiProperty({ type: String, nullable: true }) externalIdentifier!: string | null;
  @ApiProperty({ type: ArchiveComponentDto, isArray: true }) components!: ArchiveComponentDto[];
  @ApiProperty({ type: ArchiveGarnishDto, isArray: true }) garnishes!: ArchiveGarnishDto[];
  @ApiProperty({ type: ArchiveOutputDto, nullable: true }) output!: ArchiveOutputDto | null;
  @ApiProperty({ type: String, nullable: true }) glass!: string | null;
  @ApiProperty({ type: String, nullable: true }) ice!: string | null;
  @ApiProperty({ type: String, nullable: true }) preparationMethod!: string | null;
}

export class ArchiveRestoreRootDto extends ArchiveProductSummaryDto {
  @ApiProperty() nameConflict!: boolean;
}

export class ArchiveRestoreNodeDto extends ArchiveRestoreRootDto {
  @ApiProperty({ type: String, isArray: true }) parentIds!: string[];
  @ApiProperty({ type: ArchiveProductSummaryDto, isArray: true })
  replacements!: ArchiveProductSummaryDto[];
}

export class ArchiveRestorePlanDto {
  @ApiProperty({ type: ArchiveRestoreRootDto }) root!: ArchiveRestoreRootDto;
  @ApiProperty({ type: ArchiveRestoreNodeDto, isArray: true })
  dependencies!: ArchiveRestoreNodeDto[];
  @ApiProperty() confirmationFingerprint!: string;
}

export class ArchiveRestoreDecisionDto {
  @ApiProperty({ format: "uuid" }) @IsUUID() productId!: string;
  @ApiProperty({ enum: ["RESTORE", "REPLACE"] }) @IsIn(["RESTORE", "REPLACE"]) action!:
    "RESTORE" | "REPLACE";
  @ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsUUID() replacementProductId?: string;
  @ApiPropertyOptional({ maxLength: 160 })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  newName?: string;
}

export class ArchiveRestoreDto {
  @ApiProperty() @Matches(/^[a-f0-9]{64}$/) confirmationFingerprint!: string;
  @ApiProperty({ type: ArchiveRestoreDecisionDto, isArray: true })
  @IsArray()
  @ArrayUnique((decision: ArchiveRestoreDecisionDto) => decision.productId)
  @ValidateNested({ each: true })
  @Type(() => ArchiveRestoreDecisionDto)
  decisions!: ArchiveRestoreDecisionDto[];
  @ApiPropertyOptional({ maxLength: 160 })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  newName?: string;
}

export class ArchiveReplacementDto {
  @ApiProperty({ format: "uuid" }) parentId!: string;
  @ApiProperty({ format: "uuid" }) productId!: string;
  @ApiProperty({ format: "uuid" }) replacementProductId!: string;
}

export class ArchiveRestoreResultDto {
  @ApiProperty({ type: ArchiveProductSummaryDto, isArray: true })
  restoredProducts!: ArchiveProductSummaryDto[];
  @ApiProperty({ type: ArchiveReplacementDto, isArray: true })
  replacements!: ArchiveReplacementDto[];
}

export class ArchiveConflictDto {
  @ApiProperty({
    enum: [
      "PRODUCT_ARCHIVE_ACTIVE_DEPENDENCIES",
      "PRODUCT_ARCHIVE_RESTORE_PLAN_CHANGED",
      "PRODUCT_ARCHIVE_NAME_CONFLICT",
    ],
  })
  code!: string;
  @ApiPropertyOptional({ type: ArchiveProductSummaryDto, isArray: true })
  affectedProducts?: ArchiveProductSummaryDto[];
  @ApiPropertyOptional({ type: ArchiveRestorePlanDto }) restorePlan?: ArchiveRestorePlanDto;
  @ApiPropertyOptional({ format: "uuid" }) productId?: string;
}
