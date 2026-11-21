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
import { AnnouncementsService } from "@bartech/backend-announcements";
import { SaveVenueAnnouncementDto, VenueAnnouncementDto } from "./announcements.dto.js";

@ApiTags("announcements")
@Controller("organizations/companies/:companyId/venues/:venueId/announcements")
@UseGuards(SessionGuard)
@ApiParam({ name: "companyId", format: "uuid" })
@ApiParam({ name: "venueId", format: "uuid" })
export class AnnouncementsController {
  constructor(
    private readonly announcements: AnnouncementsService,
    private readonly organizations: OrganizationsService,
  ) {}

  @Get()
  @ApiOperation({ summary: "Получить объявления заведения" })
  @ApiOkResponse({ type: [VenueAnnouncementDto] })
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Param("companyId", new ParseUUIDPipe()) companyId: string,
    @Param("venueId", new ParseUUIDPipe()) venueId: string,
  ) {
    await this.requireWorkspace(user.id, companyId, venueId);
    return this.announcements.list(companyId, venueId);
  }

  @Post()
  @ApiOperation({ summary: "Создать объявление заведения" })
  @ApiCreatedResponse({ type: VenueAnnouncementDto })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Param("companyId", new ParseUUIDPipe()) companyId: string,
    @Param("venueId", new ParseUUIDPipe()) venueId: string,
    @Body() body: SaveVenueAnnouncementDto,
  ) {
    await this.requireWorkspace(user.id, companyId, venueId, true);
    return this.announcements.create(user.id, companyId, venueId, body);
  }

  @Patch(":announcementId")
  @ApiOperation({ summary: "Изменить объявление заведения" })
  @ApiParam({ name: "announcementId", format: "uuid" })
  @ApiOkResponse({ type: VenueAnnouncementDto })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("companyId", new ParseUUIDPipe()) companyId: string,
    @Param("venueId", new ParseUUIDPipe()) venueId: string,
    @Param("announcementId", new ParseUUIDPipe()) announcementId: string,
    @Body() body: SaveVenueAnnouncementDto,
  ) {
    await this.requireWorkspace(user.id, companyId, venueId, true);
    return this.announcements.update(announcementId, user.id, companyId, venueId, body);
  }

  @Delete(":announcementId")
  @ApiOperation({ summary: "Удалить объявление заведения" })
  @ApiParam({ name: "announcementId", format: "uuid" })
  @ApiOkResponse({ description: "Объявление удалено" })
  async delete(
    @CurrentUser() user: AuthenticatedUser,
    @Param("companyId", new ParseUUIDPipe()) companyId: string,
    @Param("venueId", new ParseUUIDPipe()) venueId: string,
    @Param("announcementId", new ParseUUIDPipe()) announcementId: string,
  ) {
    await this.requireWorkspace(user.id, companyId, venueId, true);
    await this.announcements.delete(announcementId, user.id, companyId, venueId);
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
      throw new ForbiddenException("Недостаточно прав для управления объявлениями");
    }
    return workspace;
  }
}
