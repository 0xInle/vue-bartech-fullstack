import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";
import { IsUUID } from "class-validator";
import { CurrentInternalIdentity, InternalSessionGuard } from "@bartech/backend-identity";
import {
  CocktailReadService,
  GarnishReadService,
  GarnishUpdateService,
  PreparationReadService,
  PreparationUpdateService,
  ProductSearchService,
  ProductsService,
} from "@bartech/backend-products";
import type { CreateProductContext } from "@bartech/backend-products";
import { SupportAccessService } from "@bartech/backend-support";
import { ServiceAccessPermissionGuard } from "../support/service-access.controller.js";
import {
  CreateCocktailDto,
  CreateGarnishDto,
  CreateLocalIngredientDto,
  CreateLocalReferenceValueDto,
  CreatePreparationDto,
  LocalIngredientCardResponseDto,
  ProductCreatedDto,
  GarnishListQueryDto,
  PreparationListQueryDto,
  ProductSearchQueryDto,
  UpdateCocktailDto,
  UpdateGarnishDto,
  UpdatePreparationDto,
  CocktailListQueryDto,
} from "./products.dto.js";

class ProductScopeParams {
  @IsUUID()
  serviceSessionId!: string;

  @IsUUID()
  companyId!: string;

  @IsUUID()
  venueId!: string;
}

@ApiTags("internal-service-products")
@Controller(
  "internal/service-sessions/:serviceSessionId/companies/:companyId/venues/:venueId/products",
)
@UseGuards(InternalSessionGuard, ServiceAccessPermissionGuard)
@ApiParam({ name: "serviceSessionId", format: "uuid" })
@ApiParam({ name: "companyId", format: "uuid" })
@ApiParam({ name: "venueId", format: "uuid" })
export class InternalServiceProductsController {
  constructor(
    private readonly access: SupportAccessService,
    private readonly products: ProductsService,
    private readonly searchProducts: ProductSearchService,
    private readonly cocktails: CocktailReadService,
    private readonly preparations: PreparationReadService,
    private readonly preparationUpdates: PreparationUpdateService,
    private readonly garnishes: GarnishReadService,
    private readonly garnishUpdates: GarnishUpdateService,
  ) {}

  @Get("references")
  @ApiOperation({ summary: "Получить справочники продукции в служебной области" })
  @ApiOkResponse()
  async references(
    @CurrentInternalIdentity() identity: InternalIdentity,
    @Param() params: ProductScopeParams,
  ) {
    return this.products.getReferences(await this.context(identity, params));
  }

  @Get("search")
  @ApiOperation({ summary: "Найти продукцию в служебной области" })
  @ApiOkResponse()
  async search(
    @CurrentInternalIdentity() identity: InternalIdentity,
    @Param() params: ProductScopeParams,
    @Query() query: ProductSearchQueryDto,
  ) {
    return this.searchProducts.search(await this.context(identity, params), query);
  }

  @Get("cocktails")
  @ApiOkResponse()
  async cocktailsList(
    @CurrentInternalIdentity() identity: InternalIdentity,
    @Param() params: ProductScopeParams,
    @Query() query: CocktailListQueryDto,
  ) {
    return this.cocktails.list(await this.context(identity, params), query.query, query.categoryId);
  }

  @Get("cocktails/garnishes")
  @ApiOkResponse()
  async cocktailGarnishes(
    @CurrentInternalIdentity() identity: InternalIdentity,
    @Param() params: ProductScopeParams,
    @Query() query: CocktailListQueryDto,
  ) {
    return this.cocktails.listGarnishes(await this.context(identity, params), query.query);
  }

  @Get("cocktails/:productId")
  @ApiOkResponse()
  async cocktail(
    @CurrentInternalIdentity() identity: InternalIdentity,
    @Param() params: ProductScopeParams,
    @Param("productId", new ParseUUIDPipe()) productId: string,
  ) {
    return this.cocktails.getById(await this.context(identity, params), productId);
  }

  @Get("preparations")
  @ApiOkResponse()
  async preparationsList(
    @CurrentInternalIdentity() identity: InternalIdentity,
    @Param() params: ProductScopeParams,
    @Query() query: PreparationListQueryDto,
  ) {
    return this.preparations.list(
      await this.context(identity, params),
      query.query,
      query.categoryCode,
      query.sort,
    );
  }

  @Get("preparations/:productId")
  @ApiOkResponse()
  async preparation(
    @CurrentInternalIdentity() identity: InternalIdentity,
    @Param() params: ProductScopeParams,
    @Param("productId", new ParseUUIDPipe()) productId: string,
  ) {
    return this.preparations.getById(await this.context(identity, params), productId);
  }

  @Get("garnishes")
  @ApiOkResponse()
  async garnishesList(
    @CurrentInternalIdentity() identity: InternalIdentity,
    @Param() params: ProductScopeParams,
    @Query() query: GarnishListQueryDto,
  ) {
    return this.garnishes.list(await this.context(identity, params), query.query, query.sort);
  }

  @Get("garnishes/:productId")
  @ApiOkResponse()
  async garnish(
    @CurrentInternalIdentity() identity: InternalIdentity,
    @Param() params: ProductScopeParams,
    @Param("productId", new ParseUUIDPipe()) productId: string,
  ) {
    return this.garnishes.getById(await this.context(identity, params), productId);
  }

  @Post("ingredients")
  @ApiCreatedResponse()
  async createIngredient(
    @CurrentInternalIdentity() identity: InternalIdentity,
    @Param() params: ProductScopeParams,
    @Body() input: CreateLocalIngredientDto,
  ) {
    return this.products.createLocalIngredient(await this.context(identity, params), input);
  }

  @Post("reference-values")
  @ApiCreatedResponse()
  async createReferenceValue(
    @CurrentInternalIdentity() identity: InternalIdentity,
    @Param() params: ProductScopeParams,
    @Body() input: CreateLocalReferenceValueDto,
  ) {
    return this.products.createLocalReferenceValue(await this.context(identity, params), input);
  }

  @Get("ingredients/:productId")
  @ApiOkResponse({ type: LocalIngredientCardResponseDto })
  async ingredient(
    @CurrentInternalIdentity() identity: InternalIdentity,
    @Param() params: ProductScopeParams,
    @Param("productId", new ParseUUIDPipe()) productId: string,
  ) {
    return this.products.getLocalIngredient(await this.context(identity, params), productId);
  }

  @Patch("ingredients/:productId")
  @ApiOkResponse({ type: ProductCreatedDto })
  async updateIngredient(
    @CurrentInternalIdentity() identity: InternalIdentity,
    @Param() params: ProductScopeParams,
    @Param("productId", new ParseUUIDPipe()) productId: string,
    @Body() input: CreateLocalIngredientDto,
  ) {
    return this.products.updateLocalIngredient(
      await this.context(identity, params),
      productId,
      input,
    );
  }

  @Post("preparations")
  @ApiCreatedResponse()
  async createPreparation(
    @CurrentInternalIdentity() identity: InternalIdentity,
    @Param() params: ProductScopeParams,
    @Body() input: CreatePreparationDto,
  ) {
    return this.products.createPreparation(await this.context(identity, params), input);
  }

  @Patch("preparations/:productId")
  @ApiOkResponse()
  async updatePreparation(
    @CurrentInternalIdentity() identity: InternalIdentity,
    @Param() params: ProductScopeParams,
    @Param("productId", new ParseUUIDPipe()) productId: string,
    @Body() input: UpdatePreparationDto,
  ) {
    return this.preparationUpdates.update(await this.context(identity, params), productId, input);
  }

  @Post("garnishes")
  @ApiCreatedResponse()
  async createGarnish(
    @CurrentInternalIdentity() identity: InternalIdentity,
    @Param() params: ProductScopeParams,
    @Body() input: CreateGarnishDto,
  ) {
    return this.products.createGarnish(await this.context(identity, params), input);
  }

  @Patch("garnishes/:productId")
  @ApiOkResponse()
  async updateGarnish(
    @CurrentInternalIdentity() identity: InternalIdentity,
    @Param() params: ProductScopeParams,
    @Param("productId", new ParseUUIDPipe()) productId: string,
    @Body() input: UpdateGarnishDto,
  ) {
    return this.garnishUpdates.update(await this.context(identity, params), productId, input);
  }

  @Post("cocktails")
  @ApiCreatedResponse()
  async createCocktail(
    @CurrentInternalIdentity() identity: InternalIdentity,
    @Param() params: ProductScopeParams,
    @Body() input: CreateCocktailDto,
  ) {
    return this.products.createCocktail(await this.context(identity, params), input);
  }

  @Patch("cocktails/:productId")
  @ApiOkResponse()
  async updateCocktail(
    @CurrentInternalIdentity() identity: InternalIdentity,
    @Param() params: ProductScopeParams,
    @Param("productId", new ParseUUIDPipe()) productId: string,
    @Body() input: UpdateCocktailDto,
  ) {
    return this.products.updateCocktail(await this.context(identity, params), productId, input);
  }

  private async context(
    identity: InternalIdentity,
    params: ProductScopeParams,
  ): Promise<CreateProductContext> {
    const session = await this.access.assertActiveSession(
      params.serviceSessionId,
      identity.user.id,
      identity.user.sessionId,
      params.companyId,
      params.venueId,
    );
    return {
      userId: null,
      internalUserId: identity.user.id,
      internalSessionId: identity.user.sessionId,
      grantId: session.grantId,
      serviceSessionId: params.serviceSessionId,
      companyId: params.companyId,
      venueId: params.venueId,
    };
  }
}

type InternalIdentity = { user: { id: string; sessionId: string } };
