import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";
import {
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProperty,
  ApiPropertyOptional,
  ApiConflictResponse,
  ApiTags,
} from "@nestjs/swagger";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";
import { CurrentUser, SessionGuard, type AuthenticatedUser } from "@bartech/backend-identity";
import {
  ProductExportDownloadResponseDto,
  ProductExportResponseDto,
} from "@bartech/backend-exports";
import { CompanySummaryDto, VenueSummaryDto } from "@bartech/backend-identity";
import { OrganizationsService, WorkspaceSummaryDto } from "@bartech/backend-organizations";
import {
  CurrentWorkspace,
  RequirePermissions,
  WorkspacePermissionGuard,
} from "./workspace-permission.guard.js";
import type { WorkspaceSummary } from "@bartech/backend-organizations";
import { OrganizationLifecycleService } from "./organization-lifecycle.service.js";

class CreateCompanyDto {
  @ApiProperty({ example: "ООО Рога и Копыта", maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  companyName!: string;

  @ApiProperty({ example: "Гадкий Шпрот", maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  venueName!: string;
}

class CreateCompanyResponseDto {
  @ApiProperty({ type: CompanySummaryDto })
  company!: CompanySummaryDto;

  @ApiProperty({ type: VenueSummaryDto })
  venue!: VenueSummaryDto;

  @ApiProperty()
  redirectTo!: string;
}

class CreateVenueDto {
  @ApiProperty({ example: "Гадкий Шпрот — Восток", maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  venueName!: string;
}

class CreateVenueResponseDto {
  @ApiProperty({ type: CompanySummaryDto })
  company!: CompanySummaryDto;

  @ApiProperty({ type: VenueSummaryDto })
  venue!: VenueSummaryDto;

  @ApiProperty()
  redirectTo!: string;
}

class CloseVenueDto {
  @ApiProperty({ example: "Гадкий Шпрот", maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  confirmationName!: string;

  @ApiProperty({ format: "uuid" })
  @IsUUID("all")
  operationId!: string;

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID("all")
  exportRequestId?: string;

  @ApiProperty({ description: "Явное подтверждение закрытия без выгрузки" })
  @IsBoolean()
  withoutExport!: boolean;
}

class CloseCompanyDto {
  @ApiProperty({ example: "ООО Рога и Копыта", maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  confirmationName!: string;

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID("all")
  operationId?: string;

  @ApiProperty({ description: "Явное подтверждение закрытия без выгрузки" })
  @IsBoolean()
  withoutExport!: boolean;
}

class ClosureExportDto {
  @ApiProperty({
    enum: ["SINGLE_PDF", "BATCH_PDF_ZIP", "VENUE_BACKUP_ZIP", "COMPANY_CLOSURE_BACKUP_ZIP"],
  })
  @IsIn(["SINGLE_PDF", "BATCH_PDF_ZIP", "VENUE_BACKUP_ZIP", "COMPANY_CLOSURE_BACKUP_ZIP"])
  type!: "SINGLE_PDF" | "BATCH_PDF_ZIP" | "VENUE_BACKUP_ZIP" | "COMPANY_CLOSURE_BACKUP_ZIP";

  @ApiPropertyOptional({ type: String, format: "uuid", isArray: true, maxItems: 100 })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsUUID("all", { each: true })
  productIds?: string[];

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  includeArchived?: boolean;
}

class CompanyClosureResponseDto {
  @ApiProperty({ enum: ["ACTIVE", "PENDING_CLOSURE"] })
  status!: "ACTIVE" | "PENDING_CLOSURE";

  @ApiProperty({ type: String, format: "date-time", nullable: true })
  closureDeadline!: Date | null;

  @ApiProperty()
  canCancel!: boolean;

  @ApiPropertyOptional({ type: String, format: "uuid", nullable: true })
  operationId!: string | null;
}

class CompanyClosureStartedResponseDto {
  @ApiProperty({ enum: ["PENDING_CLOSURE"] })
  status!: "PENDING_CLOSURE";

  @ApiProperty({ type: String, format: "date-time" })
  closureDeadline!: Date;

  @ApiProperty({ format: "uuid" })
  operationId!: string;
}

class VenueClosureResponseDto {
  @ApiProperty()
  accepted!: true;

  @ApiProperty()
  companyDeleted!: boolean;

  @ApiProperty({ format: "uuid" })
  operationId!: string;
}

class LeaveAndCloseAvailabilityDto {
  @ApiProperty()
  available!: boolean;
}

class ClosureOperationPreparationResponseDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty({ enum: ["VENUE", "COMPANY"] })
  type!: "VENUE" | "COMPANY";

  @ApiProperty({ enum: ["PREPARING"] })
  status!: "PREPARING";
}

class ClosureOperationExportResponseDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty({
    enum: ["SINGLE_PDF", "BATCH_PDF_ZIP", "VENUE_BACKUP_ZIP", "COMPANY_CLOSURE_BACKUP_ZIP"],
  })
  type!: "SINGLE_PDF" | "BATCH_PDF_ZIP" | "VENUE_BACKUP_ZIP" | "COMPANY_CLOSURE_BACKUP_ZIP";

  @ApiProperty({ enum: ["QUEUED", "PROCESSING", "READY", "FAILED", "EXPIRED"] })
  status!: "QUEUED" | "PROCESSING" | "READY" | "FAILED" | "EXPIRED";

  @ApiProperty({ type: String, format: "date-time" })
  createdAt!: string;

  @ApiProperty({ type: String, format: "date-time", nullable: true })
  expiresAt!: string | null;

  @ApiProperty({ type: String, nullable: true })
  errorCode!: string | null;
}

class ClosureOperationResponseDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty({ enum: ["VENUE", "COMPANY"] })
  type!: "VENUE" | "COMPANY";

  @ApiProperty({ enum: ["PREPARING", "PENDING_CLOSURE", "CLOSED", "CANCELLED"] })
  status!: "PREPARING" | "PENDING_CLOSURE" | "CLOSED" | "CANCELLED";

  @ApiProperty()
  originalCompanyName!: string;

  @ApiProperty({ type: String, nullable: true })
  originalVenueName!: string | null;

  @ApiProperty({ type: String, format: "date-time", nullable: true })
  closedAt!: string | null;

  @ApiProperty({ type: ClosureOperationExportResponseDto, nullable: true })
  export!: ClosureOperationExportResponseDto | null;
}

class AcceptedResponseDto {
  @ApiProperty()
  accepted!: true;
}

@ApiTags("organizations")
@Controller("organizations")
@UseGuards(SessionGuard)
export class OrganizationsController {
  constructor(
    private readonly organizations: OrganizationsService,
    private readonly lifecycle: OrganizationLifecycleService,
  ) {}

  @Get("companies/:companyId/closure")
  @ApiOperation({ summary: "Получить состояние ожидания закрытия компании" })
  @ApiParam({ name: "companyId", format: "uuid" })
  @ApiOkResponse({
    description: "Состояние и доступность отмены закрытия",
    type: CompanyClosureResponseDto,
  })
  getCompanyClosure(@CurrentUser() user: AuthenticatedUser, @Param("companyId") companyId: string) {
    return this.lifecycle.getCompanyClosure(user.id, companyId);
  }

  @Post("companies/:companyId/closure-operations")
  @ApiOperation({ summary: "Подготовить закрытие компании и связанную выгрузку" })
  @ApiParam({ name: "companyId", format: "uuid" })
  @ApiCreatedResponse({ type: ClosureOperationPreparationResponseDto })
  prepareCompanyClosure(
    @CurrentUser() user: AuthenticatedUser,
    @Param("companyId", new ParseUUIDPipe()) companyId: string,
  ) {
    return this.lifecycle.prepareClosure(user.id, companyId);
  }

  @Post("companies/:companyId/venues/:venueId/closure-operations")
  @ApiOperation({ summary: "Подготовить закрытие заведения и связанную выгрузку" })
  @ApiParam({ name: "companyId", format: "uuid" })
  @ApiParam({ name: "venueId", format: "uuid" })
  @ApiCreatedResponse({ type: ClosureOperationPreparationResponseDto })
  prepareVenueClosure(
    @CurrentUser() user: AuthenticatedUser,
    @Param("companyId", new ParseUUIDPipe()) companyId: string,
    @Param("venueId", new ParseUUIDPipe()) venueId: string,
  ) {
    return this.lifecycle.prepareClosure(user.id, companyId, venueId);
  }

  @Post("companies/:companyId/closure-operations/:operationId/exports")
  @ApiOperation({ summary: "Запросить выгрузку в контексте операции закрытия" })
  @ApiParam({ name: "companyId", format: "uuid" })
  @ApiParam({ name: "operationId", format: "uuid" })
  @ApiCreatedResponse({
    description: "Выгрузка поставлена в очередь",
    type: ProductExportResponseDto,
  })
  createClosureExport(
    @CurrentUser() user: AuthenticatedUser,
    @Param("companyId", new ParseUUIDPipe()) companyId: string,
    @Param("operationId", new ParseUUIDPipe()) operationId: string,
    @Body() body: ClosureExportDto,
  ) {
    return this.lifecycle.createClosureExport(user.id, companyId, operationId, body.type, {
      productIds: body.productIds,
      includeArchived: body.includeArchived ?? false,
    });
  }

  @Get("closure-operations/:operationId")
  @ApiOperation({ summary: "Получить состояние собственной операции закрытия" })
  @ApiParam({ name: "operationId", format: "uuid" })
  @ApiOkResponse({ type: ClosureOperationResponseDto })
  getClosureOperation(
    @CurrentUser() user: AuthenticatedUser,
    @Param("operationId", new ParseUUIDPipe()) operationId: string,
  ) {
    return this.lifecycle.getClosureOperation(user.id, operationId);
  }

  @Get("closure-operations/:operationId/download")
  @ApiOperation({ summary: "Получить ссылку только на выгрузку своей операции закрытия" })
  @ApiParam({ name: "operationId", format: "uuid" })
  @ApiOkResponse({ type: ProductExportDownloadResponseDto })
  getClosureOperationDownload(
    @CurrentUser() user: AuthenticatedUser,
    @Param("operationId", new ParseUUIDPipe()) operationId: string,
  ) {
    return this.lifecycle.getClosureOperationDownload(user.id, operationId);
  }

  @Post("companies/:companyId/closure")
  @ApiOperation({ summary: "Запустить закрытие компании на 168 часов" })
  @ApiParam({ name: "companyId", format: "uuid" })
  @ApiCreatedResponse({
    description: "Закрытие компании запущено",
    type: CompanyClosureStartedResponseDto,
  })
  @ApiConflictResponse({ description: "Название не совпало или компания уже закрывается" })
  beginCompanyClosure(
    @CurrentUser() user: AuthenticatedUser,
    @Param("companyId") companyId: string,
    @Body() body: CloseCompanyDto,
  ) {
    return this.lifecycle.beginCompanyClosure(
      user.id,
      companyId,
      body.confirmationName,
      body.operationId,
      body.withoutExport,
    );
  }

  @Post("companies/:companyId/closure/cancel")
  @ApiOperation({ summary: "Отменить ожидающее закрытие компании" })
  @ApiParam({ name: "companyId", format: "uuid" })
  @ApiCreatedResponse({ description: "Закрытие компании отменено", type: AcceptedResponseDto })
  cancelCompanyClosure(
    @CurrentUser() user: AuthenticatedUser,
    @Param("companyId") companyId: string,
  ) {
    return this.lifecycle.cancelCompanyClosure(user.id, companyId);
  }

  @Post("companies/:companyId/venues/:venueId/closure")
  @ApiOperation({ summary: "Немедленно закрыть заведение" })
  @ApiParam({ name: "companyId", format: "uuid" })
  @ApiParam({ name: "venueId", format: "uuid" })
  @ApiCreatedResponse({
    description: "Заведение и его рабочие данные удалены",
    type: VenueClosureResponseDto,
  })
  @ApiConflictResponse({ description: "Название не совпало или компания ожидает закрытия" })
  closeVenue(
    @CurrentUser() user: AuthenticatedUser,
    @Param("companyId") companyId: string,
    @Param("venueId") venueId: string,
    @Body() body: CloseVenueDto,
  ) {
    return this.lifecycle.closeVenue(
      user.id,
      companyId,
      venueId,
      body.confirmationName,
      body.operationId,
      body.exportRequestId,
      body.withoutExport,
    );
  }

  @Get("companies/:companyId/venues/:venueId/leave-and-close")
  @ApiOperation({
    summary: "Проверить доступность выхода с закрытием последнего локального сотрудника",
  })
  @ApiParam({ name: "companyId", format: "uuid" })
  @ApiParam({ name: "venueId", format: "uuid" })
  @ApiOkResponse({ type: LeaveAndCloseAvailabilityDto })
  async getLeaveAndCloseAvailability(
    @CurrentUser() user: AuthenticatedUser,
    @Param("companyId") companyId: string,
    @Param("venueId") venueId: string,
  ) {
    return {
      available: await this.lifecycle.canLeaveAndCloseVenue(user.id, companyId, venueId),
    };
  }

  @Post("companies/:companyId/venues/:venueId/leave-and-close")
  @ApiOperation({ summary: "Покинуть и закрыть заведение последнему локальному сотруднику" })
  @ApiParam({ name: "companyId", format: "uuid" })
  @ApiParam({ name: "venueId", format: "uuid" })
  @ApiCreatedResponse({ type: VenueClosureResponseDto })
  @ApiConflictResponse({ description: "Название не совпало или сценарий более недоступен" })
  leaveAndCloseVenue(
    @CurrentUser() user: AuthenticatedUser,
    @Param("companyId") companyId: string,
    @Param("venueId") venueId: string,
    @Body() body: CloseVenueDto,
  ) {
    return this.lifecycle.closeVenue(
      user.id,
      companyId,
      venueId,
      body.confirmationName,
      body.operationId,
      body.exportRequestId,
      body.withoutExport,
      true,
    );
  }

  @Get("companies/:companyId/venues/:venueId")
  @UseGuards(SessionGuard, WorkspacePermissionGuard)
  @RequirePermissions("view_products")
  @ApiOperation({ summary: "Получить доступный рабочий контекст заведения" })
  @ApiParam({ name: "companyId", format: "uuid" })
  @ApiParam({ name: "venueId", format: "uuid" })
  @ApiOkResponse({
    description: "Контекст и эффективные разрешения пользователя",
    type: WorkspaceSummaryDto,
  })
  @ApiNotFoundResponse({ description: "Рабочее пространство не найдено или недоступно" })
  getWorkspace(@CurrentWorkspace() workspace: WorkspaceSummary) {
    return workspace;
  }

  @Post()
  @ApiOperation({ summary: "Создать компанию и первое заведение для существующего пользователя" })
  @ApiCreatedResponse({
    description: "Компания, заведение и роль бар-менеджера созданы атомарно",
    type: CreateCompanyResponseDto,
  })
  async create(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateCompanyDto) {
    const result = await this.organizations.createForUser(user.id, {
      companyName: body.companyName,
      venueName: body.venueName,
    });
    return {
      company: { id: result.company.id, name: result.company.name },
      venue: { id: result.venue.id, name: result.venue.name },
      redirectTo: `/app/companies/${result.company.id}/venues/${result.venue.id}`,
    };
  }

  @Post("companies/:companyId/venues")
  @ApiOperation({ summary: "Создать дополнительное заведение в своей компании" })
  @ApiParam({ name: "companyId", format: "uuid" })
  @ApiCreatedResponse({ type: CreateVenueResponseDto })
  @ApiNotFoundResponse({ description: "Компания недоступна или отсутствует право создания" })
  @ApiConflictResponse({ description: "В компании уже есть заведение с таким названием" })
  async createVenue(
    @CurrentUser() user: AuthenticatedUser,
    @Param("companyId", new ParseUUIDPipe()) companyId: string,
    @Body() body: CreateVenueDto,
  ) {
    const result = await this.organizations.createVenueForUser(user.id, companyId, body.venueName);
    return {
      company: { id: result.company.id, name: result.company.name },
      venue: { id: result.venue.id, name: result.venue.name },
      redirectTo: `/app/companies/${result.company.id}/venues/${result.venue.id}`,
    };
  }
}
