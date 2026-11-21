import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";
import { CurrentUser, SessionGuard, type AuthenticatedUser } from "@bartech/backend-identity";
import { OrganizationsService, type WorkspaceSummary } from "@bartech/backend-organizations";
import { ChecklistsService } from "@bartech/backend-checklists";
import { SaveVenueChecklistDto, VenueChecklistDto } from "./checklists.dto.js";

@ApiTags("checklists")
@Controller("organizations/companies/:companyId/venues/:venueId/checklists")
@UseGuards(SessionGuard)
@ApiParam({ name: "companyId", format: "uuid" })
@ApiParam({ name: "venueId", format: "uuid" })
export class ChecklistsController {
  constructor(
    private readonly checklists: ChecklistsService,
    private readonly organizations: OrganizationsService,
  ) {}

  @Get()
  @ApiOperation({ summary: "Получить чек-листы заведения" })
  @ApiOkResponse({ type: [VenueChecklistDto] })
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Param("companyId", new ParseUUIDPipe()) companyId: string,
    @Param("venueId", new ParseUUIDPipe()) venueId: string,
  ) {
    await this.requireWorkspace(user.id, companyId, venueId);
    return this.checklists.list(companyId, venueId);
  }

  @Post()
  @ApiOperation({ summary: "Создать чек-лист заведения" })
  @ApiCreatedResponse({ type: VenueChecklistDto })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Param("companyId", new ParseUUIDPipe()) companyId: string,
    @Param("venueId", new ParseUUIDPipe()) venueId: string,
    @Body() body: SaveVenueChecklistDto,
  ) {
    await this.requireWorkspace(user.id, companyId, venueId, true);
    return this.checklists.create(user.id, companyId, venueId, body);
  }

  @Patch(":checklistId")
  @ApiOperation({ summary: "Изменить чек-лист заведения" })
  @ApiParam({ name: "checklistId", format: "uuid" })
  @ApiOkResponse({ type: VenueChecklistDto })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("companyId", new ParseUUIDPipe()) companyId: string,
    @Param("venueId", new ParseUUIDPipe()) venueId: string,
    @Param("checklistId", new ParseUUIDPipe()) checklistId: string,
    @Body() body: SaveVenueChecklistDto,
  ) {
    await this.requireWorkspace(user.id, companyId, venueId, true);
    return this.checklists.update(checklistId, user.id, companyId, venueId, body);
  }

  @Delete(":checklistId")
  @ApiOperation({ summary: "Удалить чек-лист заведения" })
  @ApiParam({ name: "checklistId", format: "uuid" })
  @ApiOkResponse({ description: "Чек-лист удалён" })
  async delete(
    @CurrentUser() user: AuthenticatedUser,
    @Param("companyId", new ParseUUIDPipe()) companyId: string,
    @Param("venueId", new ParseUUIDPipe()) venueId: string,
    @Param("checklistId", new ParseUUIDPipe()) checklistId: string,
  ) {
    await this.requireWorkspace(user.id, companyId, venueId, true);
    await this.checklists.delete(checklistId, user.id, companyId, venueId);
    return { success: true };
  }

  private async requireWorkspace(
    userId: string,
    companyId: string,
    venueId: string,
    requireManagement = false,
  ): Promise<WorkspaceSummary> {
    const workspace = await this.organizations.findWorkspaceForUser(userId, companyId, venueId);
    if (!workspace) throw new NotFoundException("Рабочее пространство не найдено");
    if (requireManagement && !workspace.permissions.includes("manage_venue")) {
      throw new ForbiddenException("Недостаточно прав для управления чек-листами");
    }
    return workspace;
  }
}
