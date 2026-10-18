import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  MinLength,
  Min,
  IsUUID,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import type { QuantityKind, ReferenceValueType } from "@bartech/database";

export const quantityKinds: QuantityKind[] = ["VOLUME", "MASS", "COUNT", "BAR_MEASURE"];
export const referenceValueTypes: ReferenceValueType[] = ["GLASS", "ICE", "PREPARATION_METHOD"];

export class CreateLocalIngredientDto {
  @ApiProperty({ maxLength: 160 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name!: string;

  @ApiProperty({ example: "other" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  categoryCode!: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  brand?: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
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

export class ProductComponentDto {
  @ApiProperty({ format: "uuid" })
  @IsUUID()
  productId!: string;

  @ApiProperty({ format: "uuid" })
  @IsUUID()
  unitId!: string;

  @ApiProperty({ minimum: 0.001 })
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  amount!: number;
}

export class ProductOutputDto {
  @ApiProperty({ minimum: 0.001 })
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  amount!: number;

  @ApiProperty({ format: "uuid" })
  @IsUUID()
  unitId!: string;
}

export class CreateCompositeProductDto {
  @ApiProperty({ maxLength: 160 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name!: string;

  @ApiProperty({ maxLength: 10000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  technology!: string;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;

  @ApiProperty({ type: [ProductComponentDto], minItems: 1, maxItems: 100 })
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ProductComponentDto)
  components!: ProductComponentDto[];

  @ApiPropertyOptional({ type: ProductOutputDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ProductOutputDto)
  output?: ProductOutputDto;
}

export class CreatePreparationDto extends CreateCompositeProductDto {
  @ApiProperty({ example: "syrup" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  categoryCode!: string;
}

export class UpdatePreparationDto extends CreatePreparationDto {
  @ApiPropertyOptional({ description: "Отпечаток актуального списка затронутой продукции" })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  confirmationFingerprint?: string;
}

export class PreparationImpactItemResponseDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty({ enum: ["PREPARATION", "GARNISH", "COCKTAIL"] })
  type!: "PREPARATION" | "GARNISH" | "COCKTAIL";

  @ApiProperty()
  name!: string;
}

export class PreparationImpactResponseDto {
  @ApiProperty({ enum: ["PREPARATION_DEPENDENCIES_CONFIRMATION_REQUIRED"] })
  code!: "PREPARATION_DEPENDENCIES_CONFIRMATION_REQUIRED";

  @ApiProperty({ type: [PreparationImpactItemResponseDto] })
  affectedProducts!: PreparationImpactItemResponseDto[];

  @ApiProperty()
  confirmationFingerprint!: string;
}

export class GarnishImpactItemResponseDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty({ enum: ["COCKTAIL"] })
  type!: "COCKTAIL";

  @ApiProperty()
  name!: string;
}

export class GarnishImpactResponseDto {
  @ApiProperty({ enum: ["GARNISH_DEPENDENCIES_CONFIRMATION_REQUIRED"] })
  code!: "GARNISH_DEPENDENCIES_CONFIRMATION_REQUIRED";

  @ApiProperty({ type: [GarnishImpactItemResponseDto] })
  affectedProducts!: GarnishImpactItemResponseDto[];

  @ApiProperty()
  confirmationFingerprint!: string;
}

export class CreateCocktailDto extends CreateCompositeProductDto {
  @ApiProperty({ format: "uuid" })
  @IsUUID()
  glassId!: string;

  @ApiProperty({ format: "uuid" })
  @IsUUID()
  iceId!: string;

  @ApiProperty({ format: "uuid" })
  @IsUUID()
  preparationMethodId!: string;

  @ApiPropertyOptional({ type: [String], format: "uuid", maxItems: 20 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsUUID("all", { each: true })
  garnishIds?: string[];
}

export class UpdateCocktailDto extends CreateCocktailDto {}

export class CreateGarnishDto extends CreateCompositeProductDto {}

export class UpdateGarnishDto extends CreateGarnishDto {
  @ApiPropertyOptional({ description: "Отпечаток актуального списка затронутых коктейлей" })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  confirmationFingerprint?: string;
}

export class CreateLocalUnitDto {
  @ApiProperty({ maxLength: 40 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  label!: string;

  @ApiPropertyOptional({ enum: quantityKinds })
  @IsOptional()
  @IsIn(quantityKinds)
  kind?: QuantityKind;
}

export class CreateLocalReferenceValueDto {
  @ApiProperty({ enum: referenceValueTypes })
  @IsIn(referenceValueTypes)
  type!: ReferenceValueType;

  @ApiProperty({ maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  label!: string;
}

export class ProductCreatedDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty({ enum: ["INGREDIENT", "PREPARATION", "GARNISH", "COCKTAIL"] })
  type!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ format: "uuid" })
  venueId!: string;
}

export class IngredientCategoryResponseDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ type: String, nullable: true })
  parentCode!: string | null;

  @ApiProperty()
  sortOrder!: number;

  @ApiProperty()
  isActive!: boolean;
}

export class LocalIngredientDetailsResponseDto {
  @ApiProperty()
  categoryCode!: string;

  @ApiProperty({ type: () => IngredientCategoryResponseDto })
  category!: IngredientCategoryResponseDto;

  @ApiProperty({ type: String, nullable: true })
  brand!: string | null;

  @ApiProperty({ type: String, nullable: true })
  strength!: string | null;

  @ApiProperty({ type: String, nullable: true })
  country!: string | null;

  @ApiProperty({ type: String, nullable: true })
  externalIdentifier!: string | null;
}

export class LocalIngredientCardResponseDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty({ enum: ["INGREDIENT"] })
  type!: "INGREDIENT";

  @ApiProperty()
  name!: string;

  @ApiProperty({ format: "uuid" })
  venueId!: string;

  @ApiProperty({ type: LocalIngredientDetailsResponseDto })
  ingredient!: LocalIngredientDetailsResponseDto;
}

export class PreparationCategoryResponseDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  sortOrder!: number;

  @ApiProperty()
  isActive!: boolean;
}

export class UnitResponseDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  label!: string;

  @ApiProperty({ type: String, enum: quantityKinds, nullable: true })
  kind!: QuantityKind | null;

  @ApiProperty({ type: String, format: "uuid", nullable: true })
  venueId!: string | null;
}

export class ReferenceValueResponseDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty({ enum: referenceValueTypes })
  type!: ReferenceValueType;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  label!: string;

  @ApiProperty({ type: String, format: "uuid", nullable: true })
  venueId!: string | null;

  @ApiProperty()
  sortOrder!: number;

  @ApiProperty()
  isActive!: boolean;
}

export class ProductReferencesResponseDto {
  @ApiProperty({ type: [IngredientCategoryResponseDto] })
  ingredientCategories!: IngredientCategoryResponseDto[];

  @ApiProperty({ type: [PreparationCategoryResponseDto] })
  preparationCategories!: PreparationCategoryResponseDto[];

  @ApiProperty({ type: [UnitResponseDto] })
  units!: UnitResponseDto[];

  @ApiProperty({ type: [ReferenceValueResponseDto] })
  referenceValues!: ReferenceValueResponseDto[];
}

export class ProductAliasResponseDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty()
  value!: string;

  @ApiProperty()
  valueNormalized!: string;

  @ApiProperty({ type: String, nullable: true })
  language!: string | null;
}

export class IngredientDetailsResponseDto {
  @ApiProperty()
  categoryCode!: string;

  @ApiProperty({ type: String, nullable: true })
  brand!: string | null;

  @ApiProperty({ type: String, nullable: true })
  strength!: string | null;

  @ApiProperty({ type: String, nullable: true })
  country!: string | null;

  @ApiProperty({ type: String, nullable: true })
  externalIdentifier!: string | null;

  @ApiProperty({ type: IngredientCategoryResponseDto })
  category!: IngredientCategoryResponseDto;
}

export class ProductCatalogItemResponseDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty({ enum: ["INGREDIENT"] })
  type!: "INGREDIENT";

  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: ["ACTIVE"] })
  status!: "ACTIVE";

  @ApiProperty({ type: String, format: "uuid", nullable: true })
  venueId!: string | null;

  @ApiProperty({ type: IngredientDetailsResponseDto })
  ingredient!: IngredientDetailsResponseDto;

  @ApiProperty({ type: [ProductAliasResponseDto] })
  aliases!: ProductAliasResponseDto[];
}

export class ProductSearchQueryDto {
  @ApiProperty({ maxLength: 160, minLength: 2 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  query!: string;

  @ApiProperty({ enum: ["COMPONENT", "WORKSPACE"] })
  @IsIn(["COMPONENT", "WORKSPACE"])
  scope!: "COMPONENT" | "WORKSPACE";

  @ApiPropertyOptional({ description: "Типы продукции через запятую для области WORKSPACE" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  types?: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  brand?: string;

  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  categoryCode?: string;
}

export class CompanyProductSearchQueryDto {
  @ApiProperty({ minLength: 2, maxLength: 160 })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(160)
  query!: string;

  @ApiPropertyOptional({ description: "Типы продукции через запятую" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  types?: string;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number;

  @ApiPropertyOptional({ enum: ["INGREDIENT", "PREPARATION"] })
  @IsOptional()
  @IsIn(["INGREDIENT", "PREPARATION"])
  categoryType?: "INGREDIENT" | "PREPARATION";

  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  categoryCode?: string;
}

export class WorkspaceProductSearchQueryDto extends CompanyProductSearchQueryDto {}

export class CompanyProductCardQueryDto {
  @ApiProperty({ format: "uuid" })
  @IsUUID()
  venueId!: string;
}

export class ProductSearchItemResponseDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty({ enum: ["INGREDIENT", "PREPARATION", "GARNISH", "COCKTAIL"] })
  type!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ type: String, format: "uuid", nullable: true })
  venueId!: string | null;

  @ApiProperty({ type: String, nullable: true })
  venueName!: string | null;

  @ApiProperty({ enum: ["GLOBAL", "VENUE"] })
  scope!: "GLOBAL" | "VENUE";

  @ApiProperty({
    enum: ["EXACT_NAME", "CONFIRMED_ALIAS", "PREFIX", "FUZZY_NAME", "ATTRIBUTE_MATCH"],
  })
  matchReason!: string;

  @ApiProperty({ type: String, nullable: true })
  brand!: string | null;

  @ApiProperty({ type: String, nullable: true })
  categoryCode!: string | null;

  @ApiProperty({ type: Number, nullable: true })
  strength!: number | null;
}

export class ProductSearchCategoryResponseDto {
  @ApiProperty({ enum: ["INGREDIENT", "PREPARATION"] })
  type!: "INGREDIENT" | "PREPARATION";

  @ApiProperty()
  code!: string;

  @ApiProperty()
  name!: string;
}

export class ProductSearchPageResponseDto {
  @ApiProperty({ type: [ProductSearchItemResponseDto] })
  items!: ProductSearchItemResponseDto[];

  @ApiProperty()
  totalRecords!: number;

  @ApiProperty({ type: [ProductSearchCategoryResponseDto] })
  categories!: ProductSearchCategoryResponseDto[];
}

export class CocktailListQueryDto {
  @ApiPropertyOptional({ maxLength: 160 })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  query?: string;
}

export class PreparationListQueryDto {
  @ApiPropertyOptional({ maxLength: 160 })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  query?: string;

  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  categoryCode?: string;

  @ApiPropertyOptional({ enum: ["name", "updated"] })
  @IsOptional()
  @IsIn(["name", "updated"])
  sort?: "name" | "updated";
}

export class GarnishListQueryDto {
  @ApiPropertyOptional({ maxLength: 160 })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  query?: string;

  @ApiPropertyOptional({ enum: ["name", "updated"] })
  @IsOptional()
  @IsIn(["name", "updated"])
  sort?: "name" | "updated";
}

export class CocktailListItemResponseDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ description: "Краткий состав через запятую" })
  componentSummary!: string;

  @ApiProperty({ type: String, format: "date-time" })
  updatedAt!: Date;
}

export class CocktailGarnishOptionResponseDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty()
  name!: string;
}

export class CocktailCardComponentResponseDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty({ format: "uuid" })
  productId!: string;

  @ApiProperty({ enum: ["INGREDIENT", "PREPARATION"] })
  productType!: "INGREDIENT" | "PREPARATION";

  @ApiProperty({ format: "uuid" })
  unitId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  amount!: number;

  @ApiProperty()
  unit!: string;
}

export class CocktailCardOutputResponseDto {
  @ApiProperty()
  amount!: number;

  @ApiProperty({ format: "uuid" })
  unitId!: string;

  @ApiProperty()
  unit!: string;
}

export class CocktailCardResponseDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: ["COCKTAIL"] })
  type!: "COCKTAIL";

  @ApiProperty({ enum: ["ACTIVE"] })
  status!: "ACTIVE";

  @ApiProperty({ type: [CocktailCardComponentResponseDto] })
  components!: CocktailCardComponentResponseDto[];

  @ApiProperty({ type: [CocktailGarnishOptionResponseDto] })
  garnishes!: CocktailGarnishOptionResponseDto[];

  @ApiProperty()
  technology!: string;

  @ApiProperty({ type: CocktailCardOutputResponseDto, nullable: true })
  output!: CocktailCardOutputResponseDto | null;

  @ApiProperty({ type: String, nullable: true })
  comment!: string | null;

  @ApiProperty({ type: String, nullable: true })
  glass!: string | null;

  @ApiProperty({ type: String, format: "uuid", nullable: true })
  glassId!: string | null;

  @ApiProperty({ type: String, nullable: true })
  ice!: string | null;

  @ApiProperty({ type: String, format: "uuid", nullable: true })
  iceId!: string | null;

  @ApiProperty({ type: String, nullable: true })
  preparationMethod!: string | null;

  @ApiProperty({ type: String, format: "uuid", nullable: true })
  preparationMethodId!: string | null;
}

export class PreparationListItemResponseDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  categoryName!: string;

  @ApiProperty({ description: "Краткий состав через запятую" })
  componentSummary!: string;

  @ApiProperty({ type: String, format: "date-time" })
  updatedAt!: Date;
}

export class PreparationCardComponentResponseDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty({ format: "uuid" })
  productId!: string;

  @ApiProperty({ enum: ["INGREDIENT", "PREPARATION"] })
  productType!: "INGREDIENT" | "PREPARATION";

  @ApiProperty()
  name!: string;

  @ApiProperty()
  amount!: number;

  @ApiProperty({ format: "uuid" })
  unitId!: string;

  @ApiProperty()
  unit!: string;
}

export class PreparationCardOutputResponseDto {
  @ApiProperty()
  amount!: number;

  @ApiProperty({ format: "uuid" })
  unitId!: string;

  @ApiProperty()
  unit!: string;
}

export class PreparationCardResponseDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: ["PREPARATION"] })
  type!: "PREPARATION";

  @ApiProperty({ enum: ["ACTIVE"] })
  status!: "ACTIVE";

  @ApiProperty()
  categoryName!: string;

  @ApiProperty()
  categoryCode!: string;

  @ApiProperty({ type: [PreparationCardComponentResponseDto] })
  components!: PreparationCardComponentResponseDto[];

  @ApiProperty()
  technology!: string;

  @ApiProperty({ type: PreparationCardOutputResponseDto, nullable: true })
  output!: PreparationCardOutputResponseDto | null;

  @ApiProperty({ type: String, nullable: true })
  comment!: string | null;
}

export class GarnishListItemResponseDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ description: "Краткий состав через запятую" })
  componentSummary!: string;

  @ApiProperty({ type: String, format: "date-time" })
  updatedAt!: Date;
}

export class GarnishCardComponentResponseDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty({ format: "uuid" })
  productId!: string;

  @ApiProperty({ format: "uuid" })
  unitId!: string;

  @ApiProperty({ type: String, format: "uuid", nullable: true })
  venueId!: string | null;

  @ApiProperty({ enum: ["INGREDIENT", "PREPARATION"] })
  productType!: "INGREDIENT" | "PREPARATION";

  @ApiProperty()
  name!: string;

  @ApiProperty()
  amount!: number;

  @ApiProperty()
  unit!: string;
}

export class GarnishCardOutputResponseDto {
  @ApiProperty()
  amount!: number;

  @ApiProperty({ format: "uuid" })
  unitId!: string;

  @ApiProperty()
  unit!: string;
}

export class GarnishCardResponseDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: ["GARNISH"] })
  type!: "GARNISH";

  @ApiProperty({ enum: ["ACTIVE"] })
  status!: "ACTIVE";

  @ApiProperty({ type: [GarnishCardComponentResponseDto] })
  components!: GarnishCardComponentResponseDto[];

  @ApiProperty()
  technology!: string;

  @ApiProperty({ type: GarnishCardOutputResponseDto, nullable: true })
  output!: GarnishCardOutputResponseDto | null;

  @ApiProperty({ type: String, nullable: true })
  comment!: string | null;
}
