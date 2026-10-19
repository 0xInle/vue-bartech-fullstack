import { Body, Controller, Param, Patch, Post, UseGuards } from "@nestjs/common";
import {
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";
import { CurrentUser, SessionGuard, type AuthenticatedUser } from "@bartech/backend-identity";
import { TeamService } from "@bartech/backend-organizations";
import { RequirePermissions, WorkspacePermissionGuard } from "./workspace-permission.guard.js";
import { EndTeamMemberDto, TeamMemberUpdateResponseDto, UpdateTeamMemberDto } from "./team.dto.js";

@ApiTags("team")
@Controller()
@UseGuards(SessionGuard, WorkspacePermissionGuard)
export class TeamController {
  constructor(private readonly team: TeamService) {}

  @Patch("organizations/companies/:companyId/venues/:venueId/team/:membershipId")
  @RequirePermissions("manage_team")
  @ApiOperation({ summary: "Изменить должность и дополнительные права сотрудника" })
  @ApiParam({ name: "companyId", format: "uuid" })
  @ApiParam({ name: "venueId", format: "uuid" })
  @ApiParam({ name: "membershipId", format: "uuid" })
  @ApiOkResponse({
    type: TeamMemberUpdateResponseDto,
    description: "Должность и дополнительные права сохранены",
  })
  @ApiForbiddenResponse({ description: "Нет полномочий для выбранного изменения" })
  @ApiNotFoundResponse({ description: "Сотрудник или заведение не найдены" })
  @ApiConflictResponse({ description: "Изменение нарушает правила команды или управления" })
  updateMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param("companyId") companyId: string,
    @Param("venueId") venueId: string,
    @Param("membershipId") membershipId: string,
    @Body() body: UpdateTeamMemberDto,
  ): Promise<TeamMemberUpdateResponseDto> {
    return this.team.updateMember(user.id, companyId, venueId, membershipId, {
      role: body.role,
      delegatedPermissions: body.delegatedPermissions,
    });
  }

  @Post("organizations/companies/:companyId/venues/:venueId/team/:membershipId/end")
  @RequirePermissions("manage_team")
  @ApiOperation({ summary: "Завершить период членства сотрудника" })
  @ApiParam({ name: "companyId", format: "uuid" })
  @ApiParam({ name: "venueId", format: "uuid" })
  @ApiParam({ name: "membershipId", format: "uuid" })
  @ApiOkResponse({ type: TeamMemberUpdateResponseDto })
  endMembership(
    @CurrentUser() user: AuthenticatedUser,
    @Param("companyId") companyId: string,
    @Param("venueId") venueId: string,
    @Param("membershipId") membershipId: string,
    @Body() body: EndTeamMemberDto,
  ): Promise<TeamMemberUpdateResponseDto> {
    return this.team.endMembership(user.id, companyId, venueId, membershipId, body.lastWorkingDay);
  }
}
