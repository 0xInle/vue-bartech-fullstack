import {
  Body,
  Controller,
  Delete,
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
import { RemindersService } from "@bartech/backend-reminders";
import { CreateReminderDto, SetReminderCompletedDto, VenueReminderDto } from "./reminders.dto.js";

@ApiTags("reminders")
@Controller("organizations/companies/:companyId/venues/:venueId/reminders")
@UseGuards(SessionGuard)
@ApiParam({ name: "companyId", format: "uuid" })
@ApiParam({ name: "venueId", format: "uuid" })
export class RemindersController {
  constructor(
    private readonly reminders: RemindersService,
    private readonly organizations: OrganizationsService,
  ) {}

  @Get()
  @ApiOperation({ summary: "Получить личные напоминания заведения" })
  @ApiOkResponse({ type: [VenueReminderDto] })
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Param("companyId", new ParseUUIDPipe()) companyId: string,
    @Param("venueId", new ParseUUIDPipe()) venueId: string,
  ) {
    await this.requireWorkspace(user.id, companyId, venueId);
    return this.reminders.list(user.id, companyId, venueId);
  }

  @Post()
  @ApiOperation({ summary: "Создать личное напоминание" })
  @ApiCreatedResponse({ type: VenueReminderDto })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Param("companyId", new ParseUUIDPipe()) companyId: string,
    @Param("venueId", new ParseUUIDPipe()) venueId: string,
    @Body() body: CreateReminderDto,
  ) {
    await this.requireWorkspace(user.id, companyId, venueId);
    return this.reminders.create(user.id, companyId, venueId, body.text);
  }

  @Patch(":reminderId")
  @ApiOperation({ summary: "Изменить состояние личного напоминания" })
  @ApiParam({ name: "reminderId", format: "uuid" })
  @ApiOkResponse({ type: VenueReminderDto })
  async setCompleted(
    @CurrentUser() user: AuthenticatedUser,
    @Param("companyId", new ParseUUIDPipe()) companyId: string,
    @Param("venueId", new ParseUUIDPipe()) venueId: string,
    @Param("reminderId", new ParseUUIDPipe()) reminderId: string,
    @Body() body: SetReminderCompletedDto,
  ) {
    await this.requireWorkspace(user.id, companyId, venueId);
    return this.reminders.setCompleted(reminderId, user.id, companyId, venueId, body.completed);
  }

  @Delete(":reminderId")
  @ApiOperation({ summary: "Удалить личное напоминание" })
  @ApiParam({ name: "reminderId", format: "uuid" })
  @ApiOkResponse({ description: "Напоминание удалено" })
  async delete(
    @CurrentUser() user: AuthenticatedUser,
    @Param("companyId", new ParseUUIDPipe()) companyId: string,
    @Param("venueId", new ParseUUIDPipe()) venueId: string,
    @Param("reminderId", new ParseUUIDPipe()) reminderId: string,
  ) {
    await this.requireWorkspace(user.id, companyId, venueId);
    await this.reminders.delete(reminderId, user.id, companyId, venueId);
    return { success: true };
  }

  private async requireWorkspace(
    userId: string,
    companyId: string,
    venueId: string,
  ): Promise<WorkspaceSummary> {
    const workspace = await this.organizations.findWorkspaceForUser(userId, companyId, venueId);
    if (!workspace) throw new NotFoundException("Рабочее пространство не найдено");
    return workspace;
  }
}
