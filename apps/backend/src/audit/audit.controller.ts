import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";
import { CurrentUser, SessionGuard, type AuthenticatedUser } from "@bartech/backend-identity";
import { AuditReadService } from "@bartech/backend-audit";
import {
  AuditHistoryAuthorHttpDto,
  AuditHistoryAuthorsQueryDto,
  AuditHistoryPageHttpDto,
  AuditHistoryQueryDto,
} from "./audit.dto.js";
import { AuditWorkspaceGuard } from "./audit-workspace.guard.js";

@ApiTags("audit")
@Controller("organizations/companies/:companyId/venues/:venueId/history")
@UseGuards(SessionGuard, AuditWorkspaceGuard)
@ApiParam({ name: "companyId", format: "uuid" })
@ApiParam({ name: "venueId", format: "uuid" })
@ApiNotFoundResponse({ description: "Рабочее пространство недоступно" })
export class AuditController {
  constructor(private readonly audit: AuditReadService) {}

  @Get()
  @ApiOperation({ summary: "Получить доступную историю действий рабочего пространства" })
  @ApiBadRequestResponse({ description: "Некорректный фильтр или курсор истории" })
  @ApiOkResponse({ type: AuditHistoryPageHttpDto })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param("companyId", new ParseUUIDPipe()) companyId: string,
    @Param("venueId", new ParseUUIDPipe()) venueId: string,
    @Query() query: AuditHistoryQueryDto,
  ) {
    return this.audit.list({ userId: user.id, companyId, venueId }, query);
  }

  @Get("authors")
  @ApiOperation({ summary: "Получить авторов доступных событий истории" })
  @ApiBadRequestResponse({ description: "Некорректный фильтр истории" })
  @ApiOkResponse({ type: [AuditHistoryAuthorHttpDto] })
  listAuthors(
    @CurrentUser() user: AuthenticatedUser,
    @Param("companyId", new ParseUUIDPipe()) companyId: string,
    @Param("venueId", new ParseUUIDPipe()) venueId: string,
    @Query() query: AuditHistoryAuthorsQueryDto,
  ) {
    return this.audit.listAuthors({ userId: user.id, companyId, venueId }, query);
  }
}
