import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { CurrentUser, SessionGuard, type AuthenticatedUser } from "@bartech/backend-identity";
import {
  CocktailReadService,
  GarnishReadService,
  GarnishUpdateService,
  PreparationReadService,
  PreparationUpdateService,
  ProductSearchService,
  ProductsService,
  ArchiveReadService,
  ArchiveMutationService,
} from "@bartech/backend-products";
import type { CreateProductContext } from "@bartech/backend-products";
import {
  RequirePermissions,
  WorkspacePermissionGuard,
} from "../organizations/workspace-permission.guard.js";
import {
  CreateCocktailDto,
  UpdateCocktailDto,
  CreateGarnishDto,
  UpdateGarnishDto,
  CreateLocalIngredientDto,
  CreateLocalReferenceValueDto,
  CreateLocalUnitDto,
  CreatePreparationDto,
  UpdatePreparationDto,
  PreparationImpactResponseDto,
  GarnishImpactResponseDto,
  ProductSearchItemResponseDto,
  ProductSearchQueryDto,
  ProductCreatedDto,
  ProductReferencesResponseDto,
  CocktailCardResponseDto,
  CocktailGarnishOptionResponseDto,
  CocktailListItemResponseDto,
  CocktailListQueryDto,
  PreparationCardResponseDto,
  PreparationListItemResponseDto,
  PreparationListQueryDto,
  GarnishCardResponseDto,
  GarnishListItemResponseDto,
  GarnishListQueryDto,
} from "./products.dto.js";
import {
  ArchiveCardDto,
  ArchiveConflictDto,
  ArchiveListItemDto,
  ArchiveListQueryDto,
  ArchiveProductSummaryDto,
  ArchiveRestoreDto,
  ArchiveRestorePlanDto,
  ArchiveRestoreResultDto,
} from "./archive.dto.js";

@ApiTags("products")
@Controller("organizations/companies/:companyId/venues/:venueId/products")
@UseGuards(SessionGuard, WorkspacePermissionGuard)
@ApiParam({ name: "companyId", format: "uuid" })
@ApiParam({ name: "venueId", format: "uuid" })
@ApiNotFoundResponse({ description: "Рабочее пространство или связанная запись недоступны" })
export class ProductsController {
  constructor(
    private readonly products: ProductsService,
    private readonly searchProducts: ProductSearchService,
    private readonly cocktails: CocktailReadService,
    private readonly preparations: PreparationReadService,
    private readonly preparationUpdates: PreparationUpdateService,
    private readonly garnishes: GarnishReadService,
    private readonly garnishUpdates: GarnishUpdateService,
    private readonly archiveReads: ArchiveReadService,
    private readonly archiveMutations: ArchiveMutationService,
  ) {}

  @Get("archive")
  @RequirePermissions("view_archive")
  @ApiOperation({ summary: "Получить архив продукции текущего заведения" })
  @ApiOkResponse({ type: ArchiveListItemDto, isArray: true })
  listArchive(
    @CurrentUser() user: AuthenticatedUser,
    @Param("companyId") companyId: string,
    @Param("venueId") venueId: string,
    @Query() query: ArchiveListQueryDto,
  ) {
    return this.archiveReads.list(context(user, companyId, venueId), query.query, query.type);
  }

  @Get("archive/ingredient-options")
  @RequirePermissions("manage_product_archive")
  @ApiOperation({ summary: "Найти активные локальные ингредиенты для архивирования" })
  @ApiOkResponse({ type: ArchiveProductSummaryDto, isArray: true })
  listArchiveIngredientOptions(
    @CurrentUser() user: AuthenticatedUser,
    @Param("companyId") companyId: string,
    @Param("venueId") venueId: string,
    @Query() query: ArchiveListQueryDto,
  ) {
    return this.archiveMutations.ingredientOptions(context(user, companyId, venueId), query.query);
  }

  @Get("archive/:productId")
  @RequirePermissions("view_archive")
  @ApiOperation({ summary: "Прочитать архивную карточку без возможности редактирования" })
  @ApiParam({ name: "productId", format: "uuid" })
  @ApiOkResponse({ type: ArchiveCardDto })
  getArchiveCard(
    @CurrentUser() user: AuthenticatedUser,
    @Param("companyId") companyId: string,
    @Param("venueId") venueId: string,
    @Param("productId") productId: string,
  ) {
    return this.archiveReads.getById(context(user, companyId, venueId), productId);
  }

  @Post(":productId/archive")
  @RequirePermissions("manage_product_archive")
  @ApiOperation({ summary: "Архивировать локальную продукцию без активных зависимостей" })
  @ApiParam({ name: "productId", format: "uuid" })
  @ApiCreatedResponse({ type: ArchiveProductSummaryDto })
  @ApiConflictResponse({ type: ArchiveConflictDto })
  archiveProduct(
    @CurrentUser() user: AuthenticatedUser,
    @Param("companyId") companyId: string,
    @Param("venueId") venueId: string,
    @Param("productId") productId: string,
  ) {
    return this.archiveMutations.archive(context(user, companyId, venueId), productId);
  }

  @Get("archive/:productId/restore-plan")
  @RequirePermissions("manage_product_archive")
  @ApiOperation({ summary: "Рассчитать план восстановления и допустимые замены" })
  @ApiParam({ name: "productId", format: "uuid" })
  @ApiOkResponse({ type: ArchiveRestorePlanDto })
  getArchiveRestorePlan(
    @CurrentUser() user: AuthenticatedUser,
    @Param("companyId") companyId: string,
    @Param("venueId") venueId: string,
    @Param("productId") productId: string,
  ) {
    return this.archiveMutations.restorePlan(context(user, companyId, venueId), productId);
  }

  @Post("archive/:productId/restore")
  @RequirePermissions("manage_product_archive")
  @ApiOperation({ summary: "Атомарно восстановить продукцию по подтверждённому плану" })
  @ApiParam({ name: "productId", format: "uuid" })
  @ApiCreatedResponse({ type: ArchiveRestoreResultDto })
  @ApiConflictResponse({ type: ArchiveConflictDto })
  restoreProduct(
    @CurrentUser() user: AuthenticatedUser,
    @Param("companyId") companyId: string,
    @Param("venueId") venueId: string,
    @Param("productId") productId: string,
    @Body() body: ArchiveRestoreDto,
  ) {
    return this.archiveMutations.restore(context(user, companyId, venueId), productId, body);
  }

  @Get("garnishes")
  @RequirePermissions("view_products")
  @ApiOperation({ summary: "Получить активные гарниры текущего заведения" })
  @ApiOkResponse({ type: GarnishListItemResponseDto, isArray: true })
  listGarnishes(
    @CurrentUser() user: AuthenticatedUser,
    @Param("companyId") companyId: string,
    @Param("venueId") venueId: string,
    @Query() query: GarnishListQueryDto,
  ) {
    return this.garnishes.list(context(user, companyId, venueId), query.query, query.sort);
  }

  @Get("garnishes/:garnishId")
  @RequirePermissions("view_products")
  @ApiOperation({ summary: "Получить доступную технологическую карту гарнира" })
  @ApiParam({ name: "garnishId", format: "uuid" })
  @ApiOkResponse({ type: GarnishCardResponseDto })
  getGarnish(
    @CurrentUser() user: AuthenticatedUser,
    @Param("companyId") companyId: string,
    @Param("venueId") venueId: string,
    @Param("garnishId") garnishId: string,
  ) {
    return this.garnishes.getById(context(user, companyId, venueId), garnishId);
  }

  @Patch("garnishes/:garnishId")
  @RequirePermissions("manage_products")
  @ApiOperation({ summary: "Изменить гарнир с проверкой влияния на связанные коктейли" })
  @ApiParam({ name: "garnishId", format: "uuid" })
  @ApiOkResponse({ type: ProductCreatedDto })
  @ApiBadRequestResponse({ description: "Недопустимый состав или количество" })
  @ApiConflictResponse({ type: GarnishImpactResponseDto })
  @ApiForbiddenResponse({ description: "Нет разрешения управлять продукцией" })
  updateGarnish(
    @CurrentUser() user: AuthenticatedUser,
    @Param("companyId") companyId: string,
    @Param("venueId") venueId: string,
    @Param("garnishId") garnishId: string,
    @Body() body: UpdateGarnishDto,
  ) {
    return this.garnishUpdates.update(context(user, companyId, venueId), garnishId, body);
  }

  @Get("preparations")
  @RequirePermissions("view_products")
  @ApiOperation({ summary: "Получить активные заготовки текущего заведения" })
  @ApiOkResponse({ type: PreparationListItemResponseDto, isArray: true })
  listPreparations(
    @CurrentUser() user: AuthenticatedUser,
    @Param("companyId") companyId: string,
    @Param("venueId") venueId: string,
    @Query() query: PreparationListQueryDto,
  ) {
    return this.preparations.list(
      context(user, companyId, venueId),
      query.query,
      query.categoryCode,
      query.sort,
    );
  }

  @Get("preparations/:preparationId")
  @RequirePermissions("view_products")
  @ApiOperation({ summary: "Получить доступную технологическую карту заготовки" })
  @ApiParam({ name: "preparationId", format: "uuid" })
  @ApiOkResponse({ type: PreparationCardResponseDto })
  getPreparation(
    @CurrentUser() user: AuthenticatedUser,
    @Param("companyId") companyId: string,
    @Param("venueId") venueId: string,
    @Param("preparationId") preparationId: string,
  ) {
    return this.preparations.getById(context(user, companyId, venueId), preparationId);
  }

  @Patch("preparations/:preparationId")
  @RequirePermissions("manage_products")
  @ApiOperation({ summary: "Изменить заготовку с проверкой влияния на связанную продукцию" })
  @ApiParam({ name: "preparationId", format: "uuid" })
  @ApiOkResponse({ type: ProductCreatedDto })
  @ApiBadRequestResponse({ description: "Недопустимая категория, состав или количество" })
  @ApiConflictResponse({ type: PreparationImpactResponseDto })
  @ApiForbiddenResponse({ description: "Нет разрешения управлять продукцией" })
  updatePreparation(
    @CurrentUser() user: AuthenticatedUser,
    @Param("companyId") companyId: string,
    @Param("venueId") venueId: string,
    @Param("preparationId") preparationId: string,
    @Body() body: UpdatePreparationDto,
  ) {
    return this.preparationUpdates.update(context(user, companyId, venueId), preparationId, body);
  }

  @Get("cocktails")
  @RequirePermissions("view_products")
  @ApiOperation({ summary: "Получить активные коктейли текущего заведения" })
  @ApiOkResponse({ type: CocktailListItemResponseDto, isArray: true })
  listCocktails(
    @CurrentUser() user: AuthenticatedUser,
    @Param("companyId") companyId: string,
    @Param("venueId") venueId: string,
    @Query() query: CocktailListQueryDto,
  ) {
    return this.cocktails.list(context(user, companyId, venueId), query.query);
  }

  @Get("cocktails/garnishes")
  @RequirePermissions("view_products")
  @ApiOperation({ summary: "Получить активные гарниры текущего заведения" })
  @ApiOkResponse({ type: CocktailGarnishOptionResponseDto, isArray: true })
  listCocktailGarnishes(
    @CurrentUser() user: AuthenticatedUser,
    @Param("companyId") companyId: string,
    @Param("venueId") venueId: string,
    @Query() query: CocktailListQueryDto,
  ) {
    return this.cocktails.listGarnishes(context(user, companyId, venueId), query.query);
  }

  @Get("cocktails/:cocktailId")
  @RequirePermissions("view_products")
  @ApiOperation({ summary: "Получить доступную технологическую карту коктейля" })
  @ApiParam({ name: "cocktailId", format: "uuid" })
  @ApiOkResponse({ type: CocktailCardResponseDto })
  getCocktail(
    @CurrentUser() user: AuthenticatedUser,
    @Param("companyId") companyId: string,
    @Param("venueId") venueId: string,
    @Param("cocktailId") cocktailId: string,
  ) {
    return this.cocktails.getById(context(user, companyId, venueId), cocktailId);
  }

  @Get("references")
  @RequirePermissions("view_products")
  @ApiOperation({ summary: "Получить системные и локальные справочники продукции" })
  @ApiOkResponse({ type: ProductReferencesResponseDto })
  getReferences(
    @CurrentUser() user: AuthenticatedUser,
    @Param("companyId") companyId: string,
    @Param("venueId") venueId: string,
  ) {
    return this.products.getReferences(context(user, companyId, venueId));
  }

  @Get("search")
  @RequirePermissions("view_products")
  @ApiOperation({ summary: "Найти доступную продукцию в текущем заведении" })
  @ApiQuery({ name: "query", required: true, maxLength: 160 })
  @ApiQuery({ name: "scope", required: true, enum: ["COMPONENT", "WORKSPACE"] })
  @ApiQuery({ name: "types", required: false, description: "Типы продукции через запятую" })
  @ApiOkResponse({ type: ProductSearchItemResponseDto, isArray: true })
  @ApiBadRequestResponse({ description: "Поисковый запрос слишком короткий или некорректный" })
  search(
    @CurrentUser() user: AuthenticatedUser,
    @Param("companyId") companyId: string,
    @Param("venueId") venueId: string,
    @Query() query: ProductSearchQueryDto,
  ) {
    return this.searchProducts.search(context(user, companyId, venueId), query);
  }

  @Post("ingredients")
  @RequirePermissions("manage_products")
  @ApiOperation({ summary: "Создать временный локальный ингредиент" })
  @ApiCreatedResponse({ type: ProductCreatedDto })
  @ApiForbiddenResponse({ description: "Нет разрешения управлять продукцией" })
  @ApiConflictResponse({ description: "Ингредиент с таким названием уже существует" })
  createIngredient(
    @CurrentUser() user: AuthenticatedUser,
    @Param("companyId") companyId: string,
    @Param("venueId") venueId: string,
    @Body() body: CreateLocalIngredientDto,
  ) {
    return this.products.createLocalIngredient(context(user, companyId, venueId), body);
  }

  @Post("preparations")
  @RequirePermissions("manage_products")
  @ApiOperation({ summary: "Создать заготовку с технологией и составом" })
  @ApiCreatedResponse({ type: ProductCreatedDto })
  @ApiBadRequestResponse({ description: "Недопустимая категория, состав или количество" })
  @ApiConflictResponse({ description: "Название занято или состав создаёт цикл заготовок" })
  createPreparation(
    @CurrentUser() user: AuthenticatedUser,
    @Param("companyId") companyId: string,
    @Param("venueId") venueId: string,
    @Body() body: CreatePreparationDto,
  ) {
    return this.products.createPreparation(context(user, companyId, venueId), body);
  }

  @Post("garnishes")
  @RequirePermissions("manage_products")
  @ApiOperation({ summary: "Создать гарнир с технологией и составом" })
  @ApiCreatedResponse({ type: ProductCreatedDto })
  @ApiBadRequestResponse({ description: "Недопустимый состав или количество" })
  @ApiConflictResponse({ description: "Название занято" })
  createGarnish(
    @CurrentUser() user: AuthenticatedUser,
    @Param("companyId") companyId: string,
    @Param("venueId") venueId: string,
    @Body() body: CreateGarnishDto,
  ) {
    return this.products.createGarnish(context(user, companyId, venueId), body);
  }

  @Post("cocktails")
  @RequirePermissions("manage_products")
  @ApiOperation({ summary: "Создать коктейль с технологией, составом и гарнирами" })
  @ApiCreatedResponse({ type: ProductCreatedDto })
  @ApiBadRequestResponse({ description: "Недопустимый состав или количество" })
  @ApiConflictResponse({ description: "Название занято" })
  createCocktail(
    @CurrentUser() user: AuthenticatedUser,
    @Param("companyId") companyId: string,
    @Param("venueId") venueId: string,
    @Body() body: CreateCocktailDto,
  ) {
    return this.products.createCocktail(context(user, companyId, venueId), body);
  }

  @Patch("cocktails/:cocktailId")
  @RequirePermissions("manage_products")
  @ApiOperation({ summary: "Изменить коктейль с технологией, составом и гарнирами" })
  @ApiParam({ name: "cocktailId", format: "uuid" })
  @ApiOkResponse({ type: ProductCreatedDto })
  @ApiBadRequestResponse({ description: "Недопустимый состав, количество или справочник" })
  @ApiConflictResponse({ description: "Название занято" })
  @ApiForbiddenResponse({ description: "Нет разрешения управлять продукцией" })
  updateCocktail(
    @CurrentUser() user: AuthenticatedUser,
    @Param("companyId") companyId: string,
    @Param("venueId") venueId: string,
    @Param("cocktailId") cocktailId: string,
    @Body() body: UpdateCocktailDto,
  ) {
    return this.products.updateCocktail(context(user, companyId, venueId), cocktailId, body);
  }

  @Post("units")
  @RequirePermissions("manage_products")
  @ApiOperation({ summary: "Добавить локальную единицу измерения" })
  @ApiForbiddenResponse({ description: "Нет разрешения управлять продукцией" })
  createUnit(
    @CurrentUser() user: AuthenticatedUser,
    @Param("companyId") companyId: string,
    @Param("venueId") venueId: string,
    @Body() body: CreateLocalUnitDto,
  ) {
    return this.products.createLocalUnit(context(user, companyId, venueId), body);
  }

  @Post("reference-values")
  @RequirePermissions("manage_products")
  @ApiOperation({ summary: "Добавить локальное значение справочника" })
  @ApiForbiddenResponse({ description: "Нет разрешения управлять продукцией" })
  createReferenceValue(
    @CurrentUser() user: AuthenticatedUser,
    @Param("companyId") companyId: string,
    @Param("venueId") venueId: string,
    @Body() body: CreateLocalReferenceValueDto,
  ) {
    return this.products.createLocalReferenceValue(context(user, companyId, venueId), body);
  }
}

function context(
  user: AuthenticatedUser,
  companyId: string,
  venueId: string,
): CreateProductContext {
  return { userId: user.id, companyId, venueId };
}
