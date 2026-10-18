import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { CurrentUser, SessionGuard, type AuthenticatedUser } from "@bartech/backend-identity";
import { OrganizationsService } from "@bartech/backend-organizations";
import {
  CocktailReadService,
  GarnishReadService,
  PreparationReadService,
  ProductSearchService,
} from "@bartech/backend-products";
import type { CreateProductContext } from "@bartech/backend-products";
import {
  CompanyProductCardQueryDto,
  CompanyProductSearchQueryDto,
  ProductSearchPageResponseDto,
} from "./products.dto.js";

const cardTypes = ["cocktails", "preparations", "garnishes"] as const;
type CardType = (typeof cardTypes)[number];

@ApiTags("products")
@Controller("organizations/companies/:companyId/products")
@UseGuards(SessionGuard)
@ApiParam({ name: "companyId", format: "uuid" })
@ApiNotFoundResponse({ description: "Компания или продукция недоступны" })
export class CompanyProductsController {
  constructor(
    private readonly organizations: OrganizationsService,
    private readonly search: ProductSearchService,
    private readonly cocktails: CocktailReadService,
    private readonly preparations: PreparationReadService,
    private readonly garnishes: GarnishReadService,
  ) {}

  @Get("search")
  @ApiOperation({ summary: "Найти активную продукцию во всех заведениях компании шеф-бармена" })
  @ApiQuery({ name: "query", required: true, minLength: 2, maxLength: 160 })
  @ApiQuery({ name: "types", required: false, description: "Типы продукции через запятую" })
  @ApiOkResponse({ type: ProductSearchPageResponseDto })
  @ApiBadRequestResponse({ description: "Поисковый запрос слишком короткий или некорректный" })
  searchCompany(
    @CurrentUser() user: AuthenticatedUser,
    @Param("companyId", new ParseUUIDPipe()) companyId: string,
    @Query() query: CompanyProductSearchQueryDto,
  ) {
    return this.search.searchCompanyPage(user.id, companyId, query);
  }

  @Get(":type/:productId")
  @ApiOperation({ summary: "Прочитать карточку продукции другого заведения компании" })
  @ApiQuery({ name: "venueId", required: true, format: "uuid" })
  @ApiOkResponse({
    description: "Карточка доступна только для чтения; изменение рабочего контекста не выполняется",
    schema: {
      oneOf: [
        { $ref: "#/components/schemas/CocktailCardResponseDto" },
        { $ref: "#/components/schemas/PreparationCardResponseDto" },
        { $ref: "#/components/schemas/GarnishCardResponseDto" },
      ],
    },
  })
  async getCompanyProduct(
    @CurrentUser() user: AuthenticatedUser,
    @Param("companyId", new ParseUUIDPipe()) companyId: string,
    @Param("type") type: string,
    @Param("productId", new ParseUUIDPipe()) productId: string,
    @Query() query: CompanyProductCardQueryDto,
  ) {
    if (!cardTypes.includes(type as CardType)) {
      throw new BadRequestException("Тип продукции недоступен");
    }
    await this.organizations.assertChefBartenderInCompany(user.id, companyId);
    const workspace = await this.organizations.findWorkspaceForUser(
      user.id,
      companyId,
      query.venueId,
    );
    if (!workspace) throw new NotFoundException("Продукция не найдена");
    const context: CreateProductContext = { userId: user.id, companyId, venueId: query.venueId };

    switch (type as CardType) {
      case "cocktails":
        return this.cocktails.getById(context, productId);
      case "preparations":
        return this.preparations.getById(context, productId);
      case "garnishes":
        return this.garnishes.getById(context, productId);
    }
  }
}
