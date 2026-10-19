import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiTags,
} from "@nestjs/swagger";
import { CurrentUser, SessionGuard, type AuthenticatedUser } from "@bartech/backend-identity";
import {
  SchedulesService,
  ScheduleExportService,
  type ScheduleValue,
} from "@bartech/backend-schedules";
import type { Response } from "express";
import type { WorkspaceSummary } from "@bartech/backend-organizations";
import {
  CurrentWorkspace,
  RequirePermissions,
  WorkspacePermissionGuard,
} from "../organizations/workspace-permission.guard.js";
import {
  ScheduleCellDto,
  ScheduleCellsDto,
  ScheduleCommentDto,
  ScheduleExportQueryDto,
  ScheduleGenerateDto,
  ScheduleMonthQueryDto,
  ScheduleSettingsDto,
  ScheduleTemplateDto,
} from "./schedules.dto.js";

@ApiTags("schedules")
@Controller("organizations/companies/:companyId/venues/:venueId/schedule")
@UseGuards(SessionGuard, WorkspacePermissionGuard)
@ApiParam({ name: "companyId", format: "uuid" })
@ApiParam({ name: "venueId", format: "uuid" })
export class SchedulesController {
  constructor(
    private readonly schedules: SchedulesService,
    private readonly scheduleExport: ScheduleExportService,
  ) {}

  @Get()
  @RequirePermissions("view_schedule")
  @ApiOperation({ summary: "Получить график сотрудников за месяц" })
  @ApiOkResponse({ description: "Месячный график с сотрудниками, значениями и итогами" })
  getMonth(@CurrentWorkspace() workspace: WorkspaceSummary, @Query() query: ScheduleMonthQueryDto) {
    return this.schedules.getMonth(
      workspace.company.id,
      workspace.venue.id,
      query.year,
      query.month,
    );
  }

  @Get("templates")
  @RequirePermissions("manage_schedule")
  @ApiOperation({ summary: "Получить доступные шаблоны циклов" })
  listTemplates(@CurrentWorkspace() workspace: WorkspaceSummary) {
    return this.schedules.listTemplates(workspace.venue.id);
  }

  @Post("templates")
  @RequirePermissions("manage_schedule")
  @ApiOperation({ summary: "Создать пользовательский шаблон графика" })
  @ApiCreatedResponse({ description: "Шаблон и первая версия созданы" })
  createTemplate(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentWorkspace() workspace: WorkspaceSummary,
    @Body() body: ScheduleTemplateDto,
  ) {
    return this.schedules.saveTemplate(workspace.venue.id, user.id, body);
  }

  @Put("templates/:templateId")
  @RequirePermissions("manage_schedule")
  @ApiOperation({ summary: "Создать новую версию пользовательского шаблона" })
  updateTemplate(
    @Param("templateId", new ParseUUIDPipe()) templateId: string,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentWorkspace() workspace: WorkspaceSummary,
    @Body() body: ScheduleTemplateDto,
  ) {
    return this.schedules.saveTemplate(workspace.venue.id, user.id, body, templateId);
  }

  @Patch("settings")
  @RequirePermissions("manage_schedule")
  @ApiOperation({ summary: "Изменить стандартную длительность смены" })
  updateSettings(
    @CurrentWorkspace() workspace: WorkspaceSummary,
    @Body() body: ScheduleSettingsDto,
  ) {
    return this.schedules.updateSettings(workspace.venue.id, body.standardShiftDurationHours);
  }

  @Put("cells")
  @RequirePermissions("manage_schedule")
  @ApiOperation({ summary: "Изменить одну ячейку графика" })
  updateCell(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentWorkspace() workspace: WorkspaceSummary,
    @Body() body: ScheduleCellDto,
  ) {
    return this.schedules.setCell(workspace.venue.id, user.id, toCellInput(body));
  }

  @Post("cells/bulk")
  @RequirePermissions("manage_schedule")
  @ApiOperation({ summary: "Массово изменить выбранные ячейки" })
  updateCells(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentWorkspace() workspace: WorkspaceSummary,
    @Body() body: ScheduleCellsDto,
  ) {
    return this.schedules.setCells(workspace.venue.id, user.id, body.cells.map(toCellInput));
  }

  @Post("generate")
  @RequirePermissions("manage_schedule")
  @ApiOperation({ summary: "Сформировать расписание по циклическим шаблонам" })
  generate(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentWorkspace() workspace: WorkspaceSummary,
    @Body() body: ScheduleGenerateDto,
  ) {
    return this.schedules.assignAndGenerate(
      workspace.company.id,
      workspace.venue.id,
      user.id,
      body.year,
      body.month,
      body.assignments,
      body.overwrite ?? false,
    );
  }

  @Post("extend")
  @RequirePermissions("manage_schedule")
  @ApiOperation({ summary: "Продолжить сохранённые циклы на следующий месяц" })
  extend(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentWorkspace() workspace: WorkspaceSummary,
    @Body() body: ScheduleMonthQueryDto,
  ) {
    return this.schedules.extend(
      workspace.company.id,
      workspace.venue.id,
      user.id,
      body.year,
      body.month,
    );
  }

  @Put("comments/:membershipId/:date")
  @RequirePermissions("view_schedule")
  @ApiOperation({ summary: "Добавить или заменить комментарий к дню" })
  saveComment(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentWorkspace() workspace: WorkspaceSummary,
    @Param("membershipId", new ParseUUIDPipe()) membershipId: string,
    @Param("date") date: string,
    @Body() body: ScheduleCommentDto,
  ) {
    return this.schedules.saveComment(workspace.venue.id, user.id, membershipId, date, body.text);
  }

  @Get("export")
  @RequirePermissions("manage_schedule")
  @ApiOperation({ summary: "Скачать график в PDF или Excel" })
  @ApiProduces(
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  )
  async export(
    @CurrentWorkspace() workspace: WorkspaceSummary,
    @Query() query: ScheduleExportQueryDto,
    @Res() response: Response,
  ) {
    const result = await this.scheduleExport.render(
      workspace.venue.id,
      workspace.company.id,
      query.year,
      query.month,
      query.format,
    );
    response.setHeader("Content-Type", result.contentType);
    response.setHeader("Content-Disposition", 'attachment; filename="' + result.fileName + '"');
    response.send(result.buffer);
  }
}

function toCellInput(body: ScheduleCellDto) {
  return { membershipId: body.membershipId, date: body.date, value: body.value as ScheduleValue };
}
