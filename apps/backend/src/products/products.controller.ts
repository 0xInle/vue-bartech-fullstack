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
  UpdateLocalIngredientNameDto,
  CreateLocalReferenceValueDto,
  CreateLocalPreparationCategoryDto,
  CreateLocalUnitDto,
  CreatePreparationDto,
  UpdatePreparationDto,
  PreparationImpactResponseDto,
  GarnishImpactResponseDto,
  ProductSearchItemResponseDto,
  ProductSearchQueryDto,
  WorkspaceProductSearchQueryDto,
  ProductSearchPageResponseDto,
  ProductCreatedDto,
  ProductReferencesResponseDto,
  PreparationCategoryResponseDto,
  ReferenceValueResponseDto,
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
  LocalIngredientListItemResponseDto,
  LocalIngredientListQueryDto,
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
  PermanentDeleteDto,
  PermanentDeleteConflictDto,
  PermanentDeletePlanDto,
  PermanentDeleteResultDto,
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

  @Get("local-ingredients")
  @RequirePermissions("view_products")
  @ApiOperation({ summary: "Получить активные локальные ингредиенты текущего заведения" })
  @ApiOkResponse({ type: LocalIngredientListItemResponseDto, isArray: true })
  listLocalIngredients(
    @CurrentUser() user: AuthenticatedUser,
    @Param("companyId") companyId: string,
    @Param("venueId") venueId: string,
    @Query() query: LocalIngredientListQueryDto,
  ) {
    return this.products
      .listLocalIngredients(context(user, companyId, venueId), query.query)
      .then((items) =>
        items.map(({ ingredient, ...item }) => ({
          ...item,
          category: ingredient?.category.name ?? "",
          categoryCode: ingredient?.categoryCode ?? "",
        })),
      );
  }

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
  @ApiOperation({
    summary: "Архивировать заготовку, гарнир или коктейль без активных зависимостей",
  })
  @ApiParam({ name: "productId", format: "uuid" })
  @ApiCreatedResponse({ type: ArchiveProductSummaryDto })
  @ApiBadRequestResponse({ description: "Локальные ингредиенты нельзя архивировать" })
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

  @Get(":productId/permanent-delete-plan")
  @RequirePermissions("delete_products_permanently")
  @ApiOperation({
    summary: "Проверить использования локального продукта перед удалением",
  })
  @ApiParam({ name: "productId", format: "uuid" })
  @ApiOkResponse({ type: PermanentDeletePlanDto })
  permanentDeletePlan(
    @CurrentUser() user: AuthenticatedUser,
    @Param("companyId") companyId: string,
    @Param("venueId") venueId: string,
    @Param("productId") productId: string,
  ) {
    return this.archiveMutations.permanentDeletePlan(context(user, companyId, venueId), productId);
  }

  @Post(":productId/permanent-delete")
  @RequirePermissions("delete_products_permanently")
  @ApiOperation({ summary: "Заменить использования либо удалить локальный продукт или цепочку" })
  @ApiParam({ name: "productId", format: "uuid" })
  @ApiOkResponse({ type: PermanentDeleteResultDto })
  @ApiConflictResponse({ type: PermanentDeleteConflictDto })
  permanentDeleteProduct(
    @CurrentUser() user: AuthenticatedUser,
    @Param("companyId") companyId: string,
    @Param("venueId") venueId: string,
    @Param("productId") productId: string,
    @Body() body: PermanentDeleteDto,
  ) {
    return this.archiveMutations.deletePermanently(
      context(user, companyId, venueId),
      productId,
      body,
    );
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
    return this.garnishes.list(
      context(user, companyId, venueId),
      query.query,
      query.workflowStatus === "ALL" ? undefined : query.workflowStatus,
      query.sort,
    );
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
      query.workflowStatus === "ALL" ? undefined : query.workflowStatus,
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
  @ApiOperation({ summary: "Получить неархивные коктейли текущего заведения" })
  @ApiOkResponse({ type: CocktailListItemResponseDto, isArray: true })
  listCocktails(
    @CurrentUser() user: AuthenticatedUser,
    @Param("companyId") companyId: string,
    @Param("venueId") venueId: string,
    @Query() query: CocktailListQueryDto,
  ) {
    return this.cocktails.list(
      context(user, companyId, venueId),
      query.query,
      query.categoryId,
      query.workflowStatus === "ALL" ? undefined : query.workflowStatus,
    );
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

  @Get("workspace-search")
  @RequirePermissions("view_products")
  @ApiOperation({ summary: "Постранично найти продукцию текущего заведения" })
  @ApiOkResponse({ type: ProductSearchPageResponseDto })
  @ApiBadRequestResponse({ description: "Параметры поиска некорректны" })
  searchWorkspace(
    @CurrentUser() user: AuthenticatedUser,
    @Param("companyId") companyId: string,
    @Param("venueId") venueId: string,
    @Query() query: WorkspaceProductSearchQueryDto,
  ) {
    return this.searchProducts.searchWorkspacePage(context(user, companyId, venueId), query);
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

  @Patch("local-ingredients/:productId")
  @RequirePermissions("manage_products")
  @ApiOperation({ summary: "Изменить название и категорию временного локального ингредиента" })
  @ApiOkResponse({ type: ProductCreatedDto })
  @ApiBadRequestResponse({ description: "Название или категория ингредиента не прошли проверку" })
  @ApiConflictResponse({ description: "Название ингредиента уже используется" })
  @ApiForbiddenResponse({ description: "Нет разрешения управлять продукцией" })
  updateLocalIngredientName(
    @CurrentUser() user: AuthenticatedUser,
    @Param("companyId") companyId: string,
    @Param("venueId") venueId: string,
    @Param("productId") productId: string,
    @Body() body: UpdateLocalIngredientNameDto,
  ) {
    return this.products.updateLocalIngredientName(
      context(user, companyId, venueId),
      productId,
      body,
    );
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
  @ApiCreatedResponse({ type: ReferenceValueResponseDto })
  @ApiForbiddenResponse({ description: "Нет разрешения управлять продукцией" })
  createReferenceValue(
    @CurrentUser() user: AuthenticatedUser,
    @Param("companyId") companyId: string,
    @Param("venueId") venueId: string,
    @Body() body: CreateLocalReferenceValueDto,
  ) {
    return this.products.createLocalReferenceValue(context(user, companyId, venueId), body);
  }

  @Post("preparation-categories")
  @RequirePermissions("manage_products")
  @ApiOperation({ summary: "Добавить локальную категорию заготовки" })
  @ApiCreatedResponse({ type: PreparationCategoryResponseDto })
  @ApiBadRequestResponse({ description: "Название категории некорректно" })
  @ApiConflictResponse({ description: "Такая категория уже доступна этому заведению" })
  @ApiForbiddenResponse({ description: "Нет разрешения управлять продукцией" })
  createPreparationCategory(
    @CurrentUser() user: AuthenticatedUser,
    @Param("companyId") companyId: string,
    @Param("venueId") venueId: string,
    @Body() body: CreateLocalPreparationCategoryDto,
  ) {
    return this.products.createLocalPreparationCategory(context(user, companyId, venueId), body);
  }
}

function context(
  user: AuthenticatedUser,
  companyId: string,
  venueId: string,
): CreateProductContext {
  return { userId: user.id, companyId, venueId };
}
