import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Patch,
  Query,
  Put,
  UseGuards,
} from "@nestjs/common";
import {
  ApiCreatedResponse,
  ApiConflictResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";
import { CurrentInternalIdentity, InternalSessionGuard } from "@bartech/backend-identity";
import {
  CatalogCategoriesService,
  CatalogManagementService,
  CatalogReviewService,
} from "@bartech/backend-products";
import type { GlobalIngredientInput } from "@bartech/backend-products";
import { InternalCatalogPermissionGuard } from "./internal-catalog-permission.guard.js";
import {
  CatalogCandidateQueryDto,
  CatalogCandidateResponseDto,
  CatalogCandidatePageDto,
  CatalogIngredientSearchQueryDto,
  CatalogManagementPageDto,
  CatalogManagementConflictDto,
  CatalogManagementQueryDto,
  CatalogMergePreviewResponseDto,
  CatalogMergeResultDto,
  CatalogMergePreviewDto,
  ConfirmCatalogMergeDto,
  CreateIngredientCategoryDto,
  CreateGlobalAliasDto,
  CreateGlobalIngredientFromCandidateDto,
  GlobalIngredientSearchItemDto,
  IngredientCategoryDto,
  LinkCatalogCandidateDto,
  GlobalIngredientCardDto,
  GlobalAliasDeletedDto,
  GlobalIngredientAliasDto,
  UpdateGlobalIngredientDto,
  UpdateIngredientCategoryDto,
  IngredientCategoryManagementDto,
} from "./internal-catalog.dto.js";

@ApiTags("internal-catalog")
@Controller("internal/catalog")
@UseGuards(InternalSessionGuard, InternalCatalogPermissionGuard)
export class InternalCatalogController {
  constructor(
    private readonly catalog: CatalogReviewService,
    private readonly catalogManagement: CatalogManagementService,
    private readonly catalogCategories: CatalogCategoriesService,
  ) {}

  @Get("manage/categories")
  @ApiOperation({ summary: "Получить дерево категорий ингредиентов для управления" })
  @ApiOkResponse({ type: IngredientCategoryManagementDto, isArray: true })
  managedCategories(): Promise<IngredientCategoryManagementDto[]> {
    return this.catalogCategories.list();
  }

  @Post("manage/categories")
  @ApiCreatedResponse({ type: IngredientCategoryManagementDto })
  createCategory(
    @Body() input: CreateIngredientCategoryDto,
    @CurrentInternalIdentity() identity: { user: { id: string } },
  ) {
    return this.catalogCategories.create(input, identity.user.id);
  }

  @Patch("manage/categories/:code")
  @ApiParam({ name: "code" })
  @ApiOkResponse({ type: IngredientCategoryManagementDto })
  updateCategory(
    @Param("code") code: string,
    @Body() input: UpdateIngredientCategoryDto,
    @CurrentInternalIdentity() identity: { user: { id: string } },
  ) {
    return this.catalogCategories.update(code, input, identity.user.id);
  }

  @Post("manage/categories/:code/deactivate")
  @ApiParam({ name: "code" })
  @ApiOkResponse({ type: IngredientCategoryManagementDto })
  deactivateCategory(
    @Param("code") code: string,
    @CurrentInternalIdentity() identity: { user: { id: string } },
  ) {
    return this.catalogCategories.setActive(code, false, identity.user.id);
  }

  @Post("manage/categories/:code/activate")
  @ApiParam({ name: "code" })
  @ApiOkResponse({ type: IngredientCategoryManagementDto })
  activateCategory(
    @Param("code") code: string,
    @CurrentInternalIdentity() identity: { user: { id: string } },
  ) {
    return this.catalogCategories.setActive(code, true, identity.user.id);
  }

  @Get("manage/ingredients")
  @ApiOperation({ summary: "Найти глобальные карточки для управления" })
  @ApiOkResponse({ type: CatalogManagementPageDto })
  listManaged(@Query() query: CatalogManagementQueryDto) {
    return this.catalogManagement.list(query.query, query.status, query.offset, query.limit);
  }

  @Get("manage/ingredients/:productId")
  @ApiParam({ name: "productId", format: "uuid" })
  @ApiOkResponse({ type: GlobalIngredientCardDto })
  getManaged(@Param("productId", new ParseUUIDPipe()) productId: string) {
    return this.catalogManagement.get(productId);
  }

  @Put("manage/ingredients/:productId")
  @ApiParam({ name: "productId", format: "uuid" })
  @ApiOkResponse({ type: GlobalIngredientCardDto })
  @ApiConflictResponse({ type: CatalogManagementConflictDto })
  updateManaged(
    @Param("productId", new ParseUUIDPipe()) productId: string,
    @Body() input: UpdateGlobalIngredientDto,
    @CurrentInternalIdentity() identity: { user: { id: string } },
  ) {
    return this.catalogManagement.update(productId, input, identity.user.id);
  }

  @Post("manage/ingredients/:productId/aliases")
  @ApiParam({ name: "productId", format: "uuid" })
  @ApiCreatedResponse({ type: GlobalIngredientAliasDto })
  @ApiConflictResponse({ type: CatalogManagementConflictDto })
  addAlias(
    @Param("productId", new ParseUUIDPipe()) productId: string,
    @Body() input: CreateGlobalAliasDto,
    @CurrentInternalIdentity() identity: { user: { id: string } },
  ) {
    return this.catalogManagement.addAlias(productId, input.value, identity.user.id);
  }

  @Post("manage/ingredients/:productId/aliases/:aliasId/confirm")
  @ApiParam({ name: "productId", format: "uuid" })
  @ApiParam({ name: "aliasId", format: "uuid" })
  @ApiCreatedResponse({ type: GlobalIngredientAliasDto })
  confirmAlias(
    @Param("productId", new ParseUUIDPipe()) productId: string,
    @Param("aliasId", new ParseUUIDPipe()) aliasId: string,
    @CurrentInternalIdentity() identity: { user: { id: string } },
  ) {
    return this.catalogManagement.confirmAlias(productId, aliasId, identity.user.id);
  }

  @Delete("manage/ingredients/:productId/aliases/:aliasId")
  @ApiParam({ name: "productId", format: "uuid" })
  @ApiParam({ name: "aliasId", format: "uuid" })
  @ApiOkResponse({ type: GlobalAliasDeletedDto })
  deleteAlias(
    @Param("productId", new ParseUUIDPipe()) productId: string,
    @Param("aliasId", new ParseUUIDPipe()) aliasId: string,
    @CurrentInternalIdentity() identity: { user: { id: string } },
  ) {
    return this.catalogManagement.deleteAlias(productId, aliasId, identity.user.id);
  }

  @Post("manage/merge/preview")
  @ApiOkResponse({ type: CatalogMergePreviewResponseDto })
  previewMerge(@Body() input: CatalogMergePreviewDto) {
    return this.catalogManagement.previewMerge(input.canonicalId, input.duplicateId);
  }

  @Post("manage/merge")
  @ApiCreatedResponse({ type: CatalogMergeResultDto })
  @ApiConflictResponse({ type: CatalogManagementConflictDto })
  merge(
    @Body() input: ConfirmCatalogMergeDto,
    @CurrentInternalIdentity() identity: { user: { id: string } },
  ) {
    return this.catalogManagement.merge(
      input.canonicalId,
      input.duplicateId,
      input.canonicalUpdatedAt,
      input.duplicateUpdatedAt,
      identity.user.id,
    );
  }

  @Get("candidates")
  @ApiOperation({ summary: "Получить очередь локальных кандидатов каталога" })
  @ApiOkResponse({ type: CatalogCandidatePageDto })
  list(@Query() query: CatalogCandidateQueryDto) {
    return this.catalog.listCandidates(query.offset, query.limit);
  }

  @Get("candidates/:candidateId")
  @ApiParam({ name: "candidateId", format: "uuid" })
  @ApiOkResponse({ type: CatalogCandidateResponseDto })
  get(@Param("candidateId", new ParseUUIDPipe()) candidateId: string) {
    return this.catalog.getCandidate(candidateId);
  }

  @Get("ingredients/search")
  @ApiOperation({ summary: "Найти активные глобальные ингредиенты" })
  @ApiOkResponse({ type: GlobalIngredientSearchItemDto, isArray: true })
  search(@Query() query: CatalogIngredientSearchQueryDto) {
    return this.catalog.searchGlobalIngredients(query.query, query.offset, query.limit);
  }

  @Get("categories")
  @ApiOperation({ summary: "Получить системные категории ингредиентов" })
  @ApiOkResponse({ type: IngredientCategoryDto, isArray: true })
  categories(): Promise<Array<{ code: string; name: string }>> {
    return this.catalog.listCategories();
  }

  @Post("candidates/:candidateId/link")
  @ApiParam({ name: "candidateId", format: "uuid" })
  @ApiCreatedResponse()
  link(
    @Param("candidateId", new ParseUUIDPipe()) candidateId: string,
    @Body() input: LinkCatalogCandidateDto,
    @CurrentInternalIdentity() identity: { user: { id: string } },
  ) {
    return this.catalog.linkCandidate(candidateId, input.globalProductId, identity.user.id);
  }

  @Post("candidates/:candidateId/create-global")
  @ApiParam({ name: "candidateId", format: "uuid" })
  @ApiCreatedResponse()
  createGlobal(
    @Param("candidateId", new ParseUUIDPipe()) candidateId: string,
    @Body() input: CreateGlobalIngredientFromCandidateDto,
    @CurrentInternalIdentity() identity: { user: { id: string } },
  ) {
    return this.catalog.createGlobalFromCandidate(
      candidateId,
      input as GlobalIngredientInput,
      identity.user.id,
    );
  }

  @Post("candidates/:candidateId/keep-local")
  @ApiParam({ name: "candidateId", format: "uuid" })
  @ApiCreatedResponse()
  keepLocal(
    @Param("candidateId", new ParseUUIDPipe()) candidateId: string,
    @CurrentInternalIdentity() identity: { user: { id: string } },
  ) {
    return this.catalog.keepLocal(candidateId, identity.user.id);
  }
}
