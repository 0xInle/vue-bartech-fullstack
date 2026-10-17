import { Controller, Get, Param, ParseUUIDPipe, Post, Body, UseGuards } from "@nestjs/common";
import {
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";
import { CurrentUser, SessionGuard, type AuthenticatedUser } from "@bartech/backend-identity";
import {
  ExportService,
  CreateProductExportDto,
  ProductExportResponseDto,
  ProductExportDownloadResponseDto,
} from "@bartech/backend-exports";
import {
  CurrentWorkspace,
  RequirePermissions,
  WorkspacePermissionGuard,
} from "../organizations/workspace-permission.guard.js";
import type { WorkspaceSummary } from "@bartech/backend-organizations";

@ApiTags("exports")
@Controller("organizations/companies/:companyId/venues/:venueId/exports")
@UseGuards(SessionGuard, WorkspacePermissionGuard)
@RequirePermissions("export_data")
@ApiParam({ name: "companyId", format: "uuid" })
@ApiParam({ name: "venueId", format: "uuid" })
@ApiNotFoundResponse({ description: "Рабочее пространство или запрос выгрузки недоступны" })
export class ExportsController {
  constructor(private readonly exports: ExportService) {}

  @Post("products/:productId/pdf")
  @ApiOperation({ summary: "Поставить в очередь PDF одной техкарты" })
  @ApiCreatedResponse({ type: ProductExportResponseDto })
  createSingle(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentWorkspace() workspace: WorkspaceSummary,
    @Param("productId", new ParseUUIDPipe()) productId: string,
  ) {
    return this.exports.createSinglePdf(context(user, workspace), productId);
  }

  @Post("batch")
  @ApiOperation({ summary: "Поставить в очередь ZIP с PDF выбранных техкарт" })
  @ApiCreatedResponse({ type: ProductExportResponseDto })
  createBatch(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentWorkspace() workspace: WorkspaceSummary,
    @Body() body: CreateProductExportDto,
  ) {
    return this.exports.createBatch(context(user, workspace), {
      productIds: body.productIds,
      includeArchived: body.includeArchived ?? false,
    });
  }

  @Post("backup")
  @ApiOperation({ summary: "Поставить в очередь резервную ZIP-выгрузку продукции заведения" })
  @ApiCreatedResponse({ type: ProductExportResponseDto })
  createBackup(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentWorkspace() workspace: WorkspaceSummary,
  ) {
    return this.exports.createVenueBackup(context(user, workspace));
  }

  @Get(":exportId")
  @ApiOperation({ summary: "Получить состояние собственного запроса выгрузки" })
  @ApiOkResponse({ type: ProductExportResponseDto })
  getStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param("companyId", new ParseUUIDPipe()) companyId: string,
    @Param("venueId", new ParseUUIDPipe()) venueId: string,
    @Param("exportId", new ParseUUIDPipe()) exportId: string,
  ) {
    return this.exports.getStatus({ userId: user.id, companyId, venueId }, exportId);
  }

  @Get(":exportId/download")
  @ApiOperation({ summary: "Получить краткоживущую ссылку на готовую выгрузку" })
  @ApiOkResponse({ type: ProductExportDownloadResponseDto })
  getDownloadUrl(
    @CurrentUser() user: AuthenticatedUser,
    @Param("companyId", new ParseUUIDPipe()) companyId: string,
    @Param("venueId", new ParseUUIDPipe()) venueId: string,
    @Param("exportId", new ParseUUIDPipe()) exportId: string,
  ) {
    return this.exports.getDownloadUrl({ userId: user.id, companyId, venueId }, exportId);
  }
}

function context(user: AuthenticatedUser, workspace: WorkspaceSummary) {
  return { userId: user.id, companyId: workspace.company.id, venueId: workspace.venue.id };
}
