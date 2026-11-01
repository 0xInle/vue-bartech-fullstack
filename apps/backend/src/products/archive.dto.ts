import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  ArrayUnique,
  IsArray,
  IsIn,
  IsNotEmpty,
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
const archivableProductTypes: ProductType[] = ["PREPARATION", "GARNISH", "COCKTAIL"];

export class ArchiveListQueryDto {
  @ApiPropertyOptional({ maxLength: 160 })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  query?: string;

  @ApiPropertyOptional({ enum: archivableProductTypes })
  @IsOptional()
  @IsIn(archivableProductTypes)
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

export class ArchiveGarnishDto {
  @ApiProperty({ format: "uuid" }) id!: string;

  @ApiProperty({ enum: [...productTypes, "QUICK"] })
  type!: ProductType | "QUICK";

  @ApiProperty() name!: string;

  @ApiProperty({ enum: ["ACTIVE", "ARCHIVED", null], nullable: true }) status!: string | null;

  @ApiProperty({ enum: ["PRODUCT", "QUICK"] }) kind!: "PRODUCT" | "QUICK";
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

export class PermanentDeleteDto {
  @ApiProperty({ enum: ["DELETE", "REPLACE", "DELETE_CHAIN"] })
  @IsIn(["DELETE", "REPLACE", "DELETE_CHAIN"])
  action!: "DELETE" | "REPLACE" | "DELETE_CHAIN";

  @ApiProperty({ pattern: "^[a-f0-9]{64}$" })
  @Matches(/^[a-f0-9]{64}$/)
  confirmationFingerprint!: string;

  @ApiPropertyOptional({ maxLength: 160 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  confirmationName?: string;

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  replacementProductId?: string;
}

export class PermanentDeleteProductDto extends ArchiveProductSummaryDto {
  @ApiProperty({ enum: ["ACTIVE", "ARCHIVED"] })
  status!: "ACTIVE" | "ARCHIVED";
}

export class PermanentDeleteUsageDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ format: "uuid" }) parentId!: string;
  @ApiProperty({ enum: productTypes }) parentType!: ProductType;
  @ApiProperty() parentName!: string;
  @ApiProperty({ enum: ["ACTIVE", "ARCHIVED"] }) parentStatus!: "ACTIVE" | "ARCHIVED";
  @ApiProperty({ enum: ["COMPONENT", "GARNISH"] }) relation!: "COMPONENT" | "GARNISH";
  @ApiProperty({ type: ArchiveProductSummaryDto, isArray: true })
  replacements!: ArchiveProductSummaryDto[];
}

export class PermanentDeletePlanDto {
  @ApiProperty({ type: PermanentDeleteProductDto }) root!: PermanentDeleteProductDto;
  @ApiProperty({ type: PermanentDeleteUsageDto, isArray: true })
  activeUsages!: PermanentDeleteUsageDto[];
  @ApiProperty({ type: PermanentDeleteUsageDto, isArray: true })
  archivedUsages!: PermanentDeleteUsageDto[];
  @ApiProperty({ type: PermanentDeleteProductDto, isArray: true })
  deleteChain!: PermanentDeleteProductDto[];
  @ApiProperty({ pattern: "^[a-f0-9]{64}$" }) confirmationFingerprint!: string;
}

export class ArchiveReplacementDto {
  @ApiProperty({ format: "uuid" }) parentId!: string;
  @ApiProperty({ format: "uuid" }) productId!: string;
  @ApiProperty({ format: "uuid" }) replacementProductId!: string;
}

export class PermanentDeleteResultDto {
  @ApiProperty({ type: ArchiveProductSummaryDto, isArray: true })
  deletedProducts!: ArchiveProductSummaryDto[];
  @ApiProperty({ type: ArchiveReplacementDto, isArray: true })
  replacements!: ArchiveReplacementDto[];
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
      "PRODUCT_PERMANENT_DELETE_DEPENDENCIES",
    ],
  })
  code!: string;
  @ApiPropertyOptional({ type: ArchiveProductSummaryDto, isArray: true })
  affectedProducts?: ArchiveProductSummaryDto[];
  @ApiPropertyOptional({ type: ArchiveRestorePlanDto }) restorePlan?: ArchiveRestorePlanDto;
  @ApiPropertyOptional({ format: "uuid" }) productId?: string;
}

export class PermanentDeleteConflictDto {
  @ApiProperty({
    enum: ["PRODUCT_PERMANENT_DELETE_DEPENDENCIES", "PRODUCT_PERMANENT_DELETE_PLAN_CHANGED"],
  })
  code!: "PRODUCT_PERMANENT_DELETE_DEPENDENCIES" | "PRODUCT_PERMANENT_DELETE_PLAN_CHANGED";
  @ApiProperty() message!: string;
  @ApiPropertyOptional({ type: PermanentDeletePlanDto }) plan?: PermanentDeletePlanDto;
}
