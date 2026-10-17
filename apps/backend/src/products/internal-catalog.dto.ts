import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsIn,
  IsISO8601,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from "class-validator";

export class CatalogCandidateQueryDto {
  @ApiPropertyOptional({ type: Number, minimum: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset = 0;

  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 100, default: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 25;
}

export class CatalogIngredientSearchQueryDto extends CatalogCandidateQueryDto {
  @ApiProperty({ minLength: 2, maxLength: 160 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  query!: string;
}

export class LinkCatalogCandidateDto {
  @ApiProperty({ format: "uuid" })
  @IsUUID()
  globalProductId!: string;
}

export class CreateGlobalIngredientFromCandidateDto {
  @ApiProperty({ maxLength: 160 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name!: string;

  @ApiProperty({ maxLength: 80 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  categoryCode!: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  brand?: string;

  @ApiPropertyOptional({ type: Number, minimum: 0, maximum: 100, multipleOf: 0.01 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  strength?: number;

  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  country?: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  externalIdentifier?: string;
}

export class CatalogCandidateLocalDto {
  @ApiProperty({ format: "uuid" })
  id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() categoryCode!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) brand!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) strength!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) country!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) externalIdentifier!: string | null;
}

export class CatalogCandidateResponseDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ enum: ["NEEDS_REVIEW"] }) status!: "NEEDS_REVIEW";
  @ApiProperty() reason!: string;
  @ApiPropertyOptional({ type: Number, nullable: true }) confidence!: number | null;
  @ApiProperty({ type: CatalogCandidateLocalDto }) local!: CatalogCandidateLocalDto;
  @ApiPropertyOptional({ nullable: true, type: Object }) suggestion!: {
    id: string;
    name: string;
  } | null;
}

export class CatalogCandidatePageDto {
  @ApiProperty({ type: [CatalogCandidateResponseDto] }) items!: CatalogCandidateResponseDto[];
  @ApiProperty() hasMore!: boolean;
}

export class GlobalIngredientSearchItemDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() categoryCode!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) brand!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) strength!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) country!: string | null;
}

export class IngredientCategoryDto {
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
}

export class IngredientCategoryManagementDto extends IngredientCategoryDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ type: String, nullable: true }) parentCode!: string | null;
  @ApiProperty() sortOrder!: number;
  @ApiProperty() isActive!: boolean;
}

export class CreateIngredientCategoryDto {
  @ApiProperty({ maxLength: 80 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name!: string;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  parentCode?: string | null;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(2_147_483_647)
  sortOrder?: number;
}

export class UpdateIngredientCategoryDto {
  @ApiPropertyOptional({ maxLength: 80 })
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name?: string;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  parentCode?: string | null;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(2_147_483_647)
  sortOrder?: number;
}

export class CatalogManagementQueryDto extends CatalogCandidateQueryDto {
  @ApiPropertyOptional({ type: String, maxLength: 160, default: "" })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  query = "";

  @ApiPropertyOptional({ enum: ["ACTIVE", "ALL"], default: "ACTIVE" })
  @IsOptional()
  @IsIn(["ACTIVE", "ALL"])
  status: "ACTIVE" | "ALL" = "ACTIVE";
}

export class UpdateGlobalIngredientDto {
  @ApiProperty({ maxLength: 160 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name!: string;

  @ApiProperty({ maxLength: 80 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  categoryCode!: string;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  brand?: string | null;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    minimum: 0,
    maximum: 100,
    multipleOf: 0.01,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  strength?: number | null;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  country?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  externalIdentifier?: string | null;
}

export class CreateGlobalAliasDto {
  @ApiProperty({ maxLength: 160 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  value!: string;
}

export class CatalogMergePreviewDto {
  @ApiProperty({ format: "uuid" })
  @IsUUID()
  canonicalId!: string;

  @ApiProperty({ format: "uuid" })
  @IsUUID()
  duplicateId!: string;
}

export class ConfirmCatalogMergeDto extends CatalogMergePreviewDto {
  @ApiProperty({ format: "date-time" })
  @IsISO8601()
  canonicalUpdatedAt!: string;

  @ApiProperty({ format: "date-time" })
  @IsISO8601()
  duplicateUpdatedAt!: string;
}

export class CatalogManagementItemDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: ["ACTIVE", "ARCHIVED"] }) status!: "ACTIVE" | "ARCHIVED";
  @ApiProperty() categoryCode!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) brand!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) strength!: string | null;
}

export class CatalogManagementPageDto {
  @ApiProperty({ type: [CatalogManagementItemDto] }) items!: CatalogManagementItemDto[];
  @ApiProperty() hasMore!: boolean;
}

export class GlobalIngredientAliasDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty() value!: string;
  @ApiProperty() isConfirmed!: boolean;
  @ApiPropertyOptional({ type: String, nullable: true }) language!: string | null;
}

export class GlobalIngredientCardDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: ["ACTIVE", "ARCHIVED"] }) status!: "ACTIVE" | "ARCHIVED";
  @ApiProperty({ format: "date-time" }) updatedAt!: string;
  @ApiProperty() categoryCode!: string;
  @ApiProperty() categoryName!: string;
  @ApiProperty() categoryIsActive!: boolean;
  @ApiPropertyOptional({ type: String, nullable: true }) brand!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) strength!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) country!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) externalIdentifier!: string | null;
  @ApiProperty({ type: [GlobalIngredientAliasDto] }) aliases!: GlobalIngredientAliasDto[];
}

export class CatalogMergeConflictDto {
  @ApiProperty() code!: string;
  @ApiProperty({ format: "uuid" }) productId!: string;
  @ApiProperty() name!: string;
}

export class CatalogMergeAliasDto {
  @ApiProperty() value!: string;
  @ApiProperty() isConfirmed!: boolean;
}

export class CatalogMergeValuesDto {
  @ApiProperty() name!: string;
  @ApiProperty() categoryCode!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) brand!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) strength!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) country!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) externalIdentifier!: string | null;
}

export class CatalogMergePreviewResponseDto {
  @ApiProperty({ type: GlobalIngredientCardDto }) canonical!: GlobalIngredientCardDto;
  @ApiProperty({ type: GlobalIngredientCardDto }) duplicate!: GlobalIngredientCardDto;
  @ApiProperty({ type: CatalogMergeValuesDto }) merged!: CatalogMergeValuesDto;
  @ApiProperty({ type: [CatalogMergeAliasDto] }) aliasesToMove!: CatalogMergeAliasDto[];
  @ApiPropertyOptional({ type: String, nullable: true }) oldNameAlias!: string | null;
  @ApiProperty() referenceCount!: number;
  @ApiProperty({ type: [CatalogMergeConflictDto] }) conflicts!: CatalogMergeConflictDto[];
}

export class CatalogMergeResultDto {
  @ApiProperty({ format: "uuid" }) canonicalProductId!: string;
  @ApiProperty({ format: "uuid" }) deletedProductId!: string;
  @ApiProperty() movedReferences!: number;
}

export class GlobalAliasDeletedDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty() deleted!: boolean;
}

export class CatalogManagementConflictDto {
  @ApiPropertyOptional() code?: string;
  @ApiProperty() message!: string;
  @ApiPropertyOptional({ format: "uuid" }) productId?: string;
  @ApiPropertyOptional() name?: string;
  @ApiPropertyOptional({ type: [CatalogMergeConflictDto] }) conflicts?: CatalogMergeConflictDto[];
}
