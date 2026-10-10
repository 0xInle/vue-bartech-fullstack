import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";
import {
  CurrentUser,
  InvitationAcceptanceService,
  InvitationIssuanceService,
  readCookie,
  SessionGuard,
  sessionCookieName,
  type AuthenticatedUser,
} from "@bartech/backend-identity";
import {
  CurrentWorkspace,
  RequirePermissions,
  WorkspacePermissionGuard,
} from "./workspace-permission.guard.js";
import type { WorkspaceSummary } from "@bartech/backend-organizations";
import {
  OrganizationInvitationsService,
  OrganizationsService,
} from "@bartech/backend-organizations";
import {
  CompleteInvitationRegistrationDto,
  CreateChefInvitationDto,
  CreateVenueInvitationDto,
  InviteTokenDto,
  RevokeInvitationDto,
  InvitationAcceptanceStateDto,
  StartInvitationRegistrationDto,
  PublicInvitationDto,
  VenueTeamResponseDto,
  CompanyChefTeamResponseDto,
} from "./invitations.dto.js";

const INVITATION_COOKIE = "bartech_invitation";

@ApiTags("invitations")
@Controller()
export class InvitationsController {
  constructor(
    private readonly invitationIssuance: InvitationIssuanceService,
    private readonly invitationAcceptance: InvitationAcceptanceService,
    private readonly organizations: OrganizationsService,
    private readonly organizationInvitations: OrganizationInvitationsService,
    private readonly config: ConfigService,
  ) {}

  @Get("organizations/companies/:companyId/chef-team")
  @UseGuards(SessionGuard)
  @ApiOperation({ summary: "Получить шеф-барменов и приглашения компании" })
  @ApiOkResponse({ type: CompanyChefTeamResponseDto })
  companyChefTeam(@CurrentUser() user: AuthenticatedUser, @Param("companyId") companyId: string) {
    return this.organizationInvitations.getCompanyChefTeam(user.id, companyId);
  }

  @Post("organizations/companies/:companyId/chef-invitations")
  @UseGuards(SessionGuard)
  @ApiOperation({ summary: "Пригласить шеф-бармена в компанию" })
  @ApiOkResponse({ description: "Приглашение создано, письмо поставлено в Outbox" })
  createChefInvitation(
    @CurrentUser() user: AuthenticatedUser,
    @Param("companyId") companyId: string,
    @Body() body: CreateChefInvitationDto,
  ) {
    return this.invitationIssuance.createChefInvitation(user.id, companyId, body.email);
  }

  @Post("organizations/companies/:companyId/chef-invitations/revoke")
  @UseGuards(SessionGuard)
  @ApiOperation({ summary: "Отозвать приглашение шеф-бармена" })
  @ApiOkResponse({ description: "Приглашение и его сессия закрыты" })
  async revokeChefInvitation(
    @CurrentUser() user: AuthenticatedUser,
    @Param("companyId") companyId: string,
    @Body() body: RevokeInvitationDto,
  ) {
    await this.organizationInvitations.revokeChefInvitation(user.id, companyId, body.invitationId);
    return { accepted: true };
  }

  @Get("organizations/companies/:companyId/venues/:venueId/team")
  @UseGuards(SessionGuard, WorkspacePermissionGuard)
  @RequirePermissions("view_team")
  @ApiOperation({ summary: "Получить команду и открытые приглашения заведения" })
  @ApiOkResponse({
    description: "Команда в пределах доступного заведения",
    type: VenueTeamResponseDto,
  })
  team(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentWorkspace() _workspace: WorkspaceSummary,
    @Param("companyId") companyId: string,
    @Param("venueId") venueId: string,
  ) {
    return this.organizations.getVenueTeam(user.id, companyId, venueId);
  }

  @Post("organizations/companies/:companyId/venues/:venueId/invitations")
  @UseGuards(SessionGuard, WorkspacePermissionGuard)
  @RequirePermissions("invite_employees")
  @ApiOperation({ summary: "Пригласить сотрудника в существующее заведение" })
  @ApiOkResponse({ description: "Приглашение создано, письмо поставлено в Outbox" })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentWorkspace() _workspace: WorkspaceSummary,
    @Param("companyId") companyId: string,
    @Param("venueId") venueId: string,
    @Body() body: CreateVenueInvitationDto,
  ) {
    return this.invitationIssuance.createVenueInvitation(
      user.id,
      companyId,
      venueId,
      body.email,
      body.role,
    );
  }

  @Post("organizations/companies/:companyId/venues/:venueId/invitations/revoke")
  @UseGuards(SessionGuard, WorkspacePermissionGuard)
  @RequirePermissions("view_team")
  @ApiOperation({ summary: "Отозвать приглашение в заведение" })
  @ApiOkResponse({ description: "Приглашение и его сессия закрыты" })
  async revoke(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentWorkspace() _workspace: WorkspaceSummary,
    @Param("companyId") companyId: string,
    @Param("venueId") venueId: string,
    @Body() body: RevokeInvitationDto,
  ) {
    await this.organizationInvitations.revokeInvitation(
      user.id,
      companyId,
      venueId,
      body.invitationId,
    );
    return { accepted: true };
  }

  @Post("invitations/preview")
  @ApiOperation({ summary: "Получить минимум данных приглашения по токену в теле запроса" })
  @ApiOkResponse({
    description: "Компания, заведение и назначенная должность",
    type: PublicInvitationDto,
  })
  async previewInvitation(@Body() body: InviteTokenDto) {
    const token = body.token;
    const invitation = await this.invitationAcceptance.getInvitation(token);
    if (!invitation) throw new ForbiddenException("Приглашение недействительно или истекло");
    return invitation;
  }

  @Get("invitations/current")
  @ApiOperation({ summary: "Восстановить принятое приглашение по защищённой cookie" })
  @ApiOkResponse({
    description: "Данные активной сессии принятия приглашения",
    type: InvitationAcceptanceStateDto,
  })
  async currentInvitation(@Req() request: Request) {
    const token = readCookie(request, INVITATION_COOKIE);
    if (!token) throw new ForbiddenException("Сессия приглашения не найдена");
    return this.invitationAcceptance.getInvitationAcceptance(token);
  }

  @Post("invitations/accept")
  @ApiOperation({ summary: "Принять приглашение и начать 60-минутную сессию" })
  @ApiOkResponse({ description: "Начат процесс присоединения" })
  async accept(
    @Body() body: InviteTokenDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.invitationAcceptance.acceptInvitation(
      body.token,
      readCookie(request, INVITATION_COOKIE),
      readCookie(request, sessionCookieName(this.isProduction())),
    );
    response.cookie(INVITATION_COOKIE, result.token, {
      httpOnly: true,
      secure: this.isProduction(),
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 1000,
    });
    return { invitation: result.invitation };
  }

  @Post("invitations/decline")
  @ApiOperation({ summary: "Отклонить персональное приглашение" })
  @ApiOkResponse({ description: "Приглашение закрыто без результата" })
  async decline(
    @Body() body: InviteTokenDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.invitationAcceptance.declineInvitation(
      body.token,
      readCookie(request, sessionCookieName(this.isProduction())),
    );
    this.clearInvitationCookie(response);
    return { accepted: true };
  }

  @Post("invitations/cancel")
  @ApiOperation({ summary: "Отменить начатое присоединение" })
  @ApiOkResponse({ description: "Сессия и приглашение закрыты без результата" })
  async cancelAcceptance(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const token = readCookie(request, INVITATION_COOKIE);
    if (!token) throw new ForbiddenException("Сессия приглашения не найдена");
    await this.invitationAcceptance.cancelInvitationAcceptance(token);
    this.clearInvitationCookie(response);
    return { accepted: true };
  }

  @Post("invitations/registration")
  @ApiOperation({ summary: "Начать регистрацию по принятому приглашению" })
  @ApiOkResponse({ description: "Код подтверждения поставлен в Outbox" })
  async startRegistration(@Body() body: StartInvitationRegistrationDto, @Req() request: Request) {
    const token = readCookie(request, INVITATION_COOKIE);
    if (!token) throw new ForbiddenException("Сначала примите приглашение");
    await this.invitationAcceptance.beginInvitationRegistration(
      token,
      body.fullName,
      body.password,
    );
    return { accepted: true };
  }

  @Post("invitations/registration/resend")
  @ApiOperation({ summary: "Повторно отправить код подтверждения приглашения" })
  @ApiOkResponse({ description: "Новый код поставлен в Outbox" })
  async resendRegistrationCode(@Req() request: Request) {
    const token = readCookie(request, INVITATION_COOKIE);
    if (!token) throw new ForbiddenException("Сначала примите приглашение");
    await this.invitationAcceptance.resendInvitationRegistrationCode(token);
    return { accepted: true };
  }

  @Post("invitations/registration/verify")
  @ApiOperation({ summary: "Подтвердить адрес и завершить присоединение" })
  @ApiOkResponse({ description: "Аккаунт, членство и сессия созданы атомарно" })
  async verifyRegistration(
    @Body() body: CompleteInvitationRegistrationDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const token = readCookie(request, INVITATION_COOKIE);
    if (!token) throw new ForbiddenException("Сначала примите приглашение");
    const result = await this.invitationAcceptance.completeInvitationRegistration(token, body.code);
    this.clearInvitationCookie(response);
    this.setSessionCookie(response, result.session.token, result.session.expiresAt);
    return { user: result.user, redirectTo: result.redirectTo };
  }

  @Post("invitations/complete")
  @UseGuards(SessionGuard)
  @ApiOperation({ summary: "Завершить приглашение для существующего аккаунта" })
  @ApiOkResponse({ description: "Пользователь получил членство и доступ" })
  async completeExisting(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const token = readCookie(request, INVITATION_COOKIE);
    if (!token) throw new ForbiddenException("Сначала примите приглашение");
    const result = await this.invitationAcceptance.completeInvitationForUser(token, user);
    this.clearInvitationCookie(response);
    return result;
  }

  private setSessionCookie(response: Response, token: string, expiresAt: Date): void {
    const production = this.isProduction();
    response.cookie(sessionCookieName(production), token, {
      httpOnly: true,
      secure: production,
      sameSite: "lax",
      path: "/",
      maxAge: Math.min(30 * 24 * 60 * 60 * 1000, expiresAt.getTime() - Date.now()),
    });
  }

  private clearInvitationCookie(response: Response): void {
    response.clearCookie(INVITATION_COOKIE, {
      httpOnly: true,
      secure: this.isProduction(),
      sameSite: "lax",
      path: "/",
    });
  }

  private isProduction(): boolean {
    return this.config.get("NODE_ENV") === "production";
  }
}
