import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
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
  ScheduleDateMarkerDto,
  ScheduleExportQueryDto,
  ScheduleExtendDto,
  ScheduleGenerateDto,
  ScheduleMonthQueryDto,
  ScheduleTemplateDto,
  ScheduleShiftSettingsDto,
  ScheduleShiftSettingDto,
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

  @Put("date-markers/:date")
  @RequirePermissions("manage_schedule")
  @ApiOperation({ summary: "Отметить дату графика как день инвентаризации" })
  @ApiParam({ name: "date", format: "date" })
  @ApiOkResponse({ type: ScheduleDateMarkerDto })
  setInventoryMarker(
    @CurrentWorkspace() workspace: WorkspaceSummary,
    @Param("date") date: string,
  ): Promise<ScheduleDateMarkerDto> {
    return this.schedules.setInventoryMarker(workspace.venue.id, date);
  }

  @Delete("date-markers/:date")
  @RequirePermissions("manage_schedule")
  @ApiOperation({ summary: "Снять отметку дня инвентаризации" })
  @ApiParam({ name: "date", format: "date" })
  @ApiOkResponse({ description: "Отметка снята, если она существовала" })
  deleteInventoryMarker(
    @CurrentWorkspace() workspace: WorkspaceSummary,
    @Param("date") date: string,
  ) {
    return this.schedules.deleteInventoryMarker(workspace.venue.id, date);
  }

  @Get("templates")
  @RequirePermissions("manage_schedule")
  @ApiOperation({ summary: "Получить доступные шаблоны циклов" })
  listTemplates(@CurrentWorkspace() workspace: WorkspaceSummary) {
    return this.schedules.listTemplates(workspace.venue.id);
  }

  @Get("shift-settings")
  @RequirePermissions("manage_schedule")
  @ApiOperation({ summary: "Получить настройки типов смен заведения" })
  @ApiOkResponse({ type: [ScheduleShiftSettingDto] })
  getShiftSettings(
    @CurrentWorkspace() workspace: WorkspaceSummary,
  ): Promise<ScheduleShiftSettingDto[]> {
    return this.schedules.getShiftSettings(workspace.venue.id);
  }

  @Put("shift-settings")
  @RequirePermissions("manage_schedule")
  @ApiOperation({ summary: "Заменить настройки типов смен заведения" })
  @ApiOkResponse({ type: [ScheduleShiftSettingDto] })
  saveShiftSettings(
    @CurrentWorkspace() workspace: WorkspaceSummary,
    @Body() body: ScheduleShiftSettingsDto,
  ): Promise<ScheduleShiftSettingDto[]> {
    return this.schedules.saveShiftSettings(workspace.venue.id, body.settings);
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
  @ApiOperation({ summary: "Переименовать пользовательский шаблон или создать его новую версию" })
  updateTemplate(
    @Param("templateId", new ParseUUIDPipe()) templateId: string,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentWorkspace() workspace: WorkspaceSummary,
    @Body() body: ScheduleTemplateDto,
  ) {
    return this.schedules.saveTemplate(workspace.venue.id, user.id, body, templateId);
  }

  @Delete("templates/:templateId")
  @RequirePermissions("manage_schedule")
  @ApiOperation({
    summary: "Удалить пользовательский шаблон и снять назначения, сохранив заполненные графики",
  })
  deleteTemplate(
    @Param("templateId", new ParseUUIDPipe()) templateId: string,
    @CurrentWorkspace() workspace: WorkspaceSummary,
  ) {
    return this.schedules.deleteTemplate(workspace.venue.id, templateId);
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
  @ApiOperation({ summary: "Продолжить сохранённые циклы выбранных сотрудников на целевой месяц" })
  extend(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentWorkspace() workspace: WorkspaceSummary,
    @Body() body: ScheduleExtendDto,
  ) {
    return this.schedules.extend(
      workspace.company.id,
      workspace.venue.id,
      user.id,
      body.year,
      body.month,
      body.membershipIds,
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
