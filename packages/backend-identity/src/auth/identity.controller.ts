import { randomBytes } from "node:crypto";
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";
import {
  ChangePasswordDto,
  AcceptedDto,
  CsrfTokenResponseDto,
  CurrentIdentityResponseDto,
  LoginDto,
  LoginResponseDto,
  PasswordRecoveryCompleteDto,
  PasswordRecoveryRequestDto,
  RegistrationStartDto,
  RegistrationCompleteResponseDto,
  VerifyEmailDto,
} from "./identity.dto.js";
import { AuthenticationService } from "./authentication.service.js";
import { RegistrationService } from "./registration.service.js";
import {
  CurrentUser,
  readCookie,
  SessionGuard,
  sessionCookieName,
  type AuthenticatedUser,
} from "./session.guard.js";

const CSRF_COOKIE = "bartech_csrf";
const REGISTRATION_COOKIE = "bartech_registration";
const SESSION_MAX_AGE = 30 * 24 * 60 * 60 * 1000;

@ApiTags("identity")
@Controller("identity")
export class IdentityController {
  constructor(
    private readonly authentication: AuthenticationService,
    private readonly registration: RegistrationService,
    private readonly config: ConfigService,
  ) {}

  @Get("csrf")
  @ApiOperation({ summary: "Получить CSRF-токен для изменяющих запросов" })
  @ApiOkResponse({
    description: "Токен возвращён и установлен в same-site cookie",
    type: CsrfTokenResponseDto,
  })
  csrf(@Res({ passthrough: true }) response: Response) {
    const token = randomBytes(32).toString("base64url");
    response.cookie(CSRF_COOKIE, token, {
      httpOnly: false,
      secure: this.isProduction(),
      sameSite: "lax",
      path: "/",
      maxAge: 24 * 60 * 60 * 1000,
    });
    return { token };
  }

  @Post("registration")
  @ApiOperation({ summary: "Начать регистрацию и отправить код подтверждения" })
  @ApiOkResponse({
    description: "Запрос принят; адрес аккаунта не раскрывается",
    type: AcceptedDto,
  })
  async startRegistration(
    @Body() body: RegistrationStartDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.registration.startRegistration(body);
    if (result.registrationToken) {
      response.cookie(REGISTRATION_COOKIE, result.registrationToken, {
        httpOnly: true,
        secure: this.isProduction(),
        sameSite: "lax",
        path: "/",
        maxAge: 30 * 60 * 1000,
      });
    }
    return { accepted: true };
  }

  @Post("registration/resend")
  @ApiOperation({ summary: "Повторно отправить код подтверждения регистрации" })
  @ApiOkResponse({ description: "Запрос принят", type: AcceptedDto })
  async resendRegistrationCode(@Req() request: Request) {
    const token = readCookie(request, REGISTRATION_COOKIE);
    if (!token) return { accepted: true };
    await this.registration.resendRegistrationCode(token);
    return { accepted: true };
  }

  @Post("registration/verify")
  @ApiOperation({ summary: "Подтвердить email и атомарно создать аккаунт с первой компанией" })
  @ApiOkResponse({
    description: "Аккаунт и первое рабочее пространство созданы",
    type: RegistrationCompleteResponseDto,
  })
  async verifyRegistration(
    @Body() body: VerifyEmailDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const registrationToken = readCookie(request, REGISTRATION_COOKIE);
    if (!registrationToken)
      throw new BadRequestException(
        "Регистрация не найдена. Начните заново или войдите в существующий аккаунт",
      );
    const result = await this.registration.verifyRegistration(registrationToken, body.code);
    response.clearCookie(REGISTRATION_COOKIE, {
      path: "/",
      sameSite: "lax",
      secure: this.isProduction(),
    });
    this.setSessionCookie(response, result.session.token, result.session.expiresAt);
    return {
      user: result.user,
      company: result.company,
      venue: result.venue,
      redirectTo: `/app/companies/${result.company.id}/venues/${result.venue.id}`,
    };
  }

  @Post("login")
  @ApiOperation({ summary: "Войти по электронной почте и паролю" })
  @ApiOkResponse({ description: "Создана серверная сессия", type: LoginResponseDto })
  async login(@Body() body: LoginDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.authentication.login(body.email, body.password);
    this.setSessionCookie(response, result.session.token, result.session.expiresAt);
    return { user: result.user };
  }

  @Post("logout")
  @UseGuards(SessionGuard)
  @ApiOperation({ summary: "Завершить текущую сессию" })
  @ApiOkResponse({ description: "Текущая сессия завершена", type: AcceptedDto })
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.authentication.logout(user);
    this.clearSessionCookie(response);
    return { accepted: true };
  }

  @Post("logout-all")
  @UseGuards(SessionGuard)
  @ApiOperation({ summary: "Завершить все сессии аккаунта" })
  @ApiOkResponse({ description: "Все сессии завершены", type: AcceptedDto })
  async logoutAll(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.authentication.logoutAll(user);
    this.clearSessionCookie(response);
    return { accepted: true };
  }

  @Get("session")
  @UseGuards(SessionGuard)
  @ApiOperation({ summary: "Получить текущего пользователя и доступные рабочие пространства" })
  @ApiOkResponse({ description: "Текущий пользователь", type: CurrentIdentityResponseDto })
  session(@CurrentUser() user: AuthenticatedUser) {
    return this.authentication.getCurrentUser(user);
  }

  @Post("password-recovery")
  @ApiOperation({ summary: "Запросить код восстановления пароля" })
  @ApiOkResponse({
    description: "Нейтральный ответ независимо от существования аккаунта",
    type: AcceptedDto,
  })
  recoverPassword(@Body() body: PasswordRecoveryRequestDto) {
    return this.authentication.requestPasswordRecovery(body.email);
  }

  @Post("password-recovery/complete")
  @ApiOperation({ summary: "Подтвердить код и установить новый пароль" })
  @ApiOkResponse({ description: "Пароль изменён, активные сессии завершены", type: AcceptedDto })
  async completePasswordRecovery(
    @Body() body: PasswordRecoveryCompleteDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.authentication.completePasswordRecovery(body.email, body.code, body.password);
    this.clearSessionCookie(response);
    return { accepted: true };
  }

  @Post("password")
  @UseGuards(SessionGuard)
  @ApiOperation({ summary: "Изменить пароль текущего аккаунта" })
  @ApiOkResponse({
    description: "Пароль изменён, кроме текущей сессии остальные завершены",
    type: AcceptedDto,
  })
  changePassword(@CurrentUser() user: AuthenticatedUser, @Body() body: ChangePasswordDto) {
    return this.authentication.changePassword(user, body.currentPassword, body.newPassword);
  }

  private setSessionCookie(response: Response, token: string, expiresAt: Date): void {
    const production = this.isProduction();
    response.cookie(sessionCookieName(production), token, {
      httpOnly: true,
      secure: production,
      sameSite: "lax",
      path: "/",
      maxAge: Math.min(SESSION_MAX_AGE, expiresAt.getTime() - Date.now()),
    });
  }

  private clearSessionCookie(response: Response): void {
    const production = this.isProduction();
    response.clearCookie(sessionCookieName(production), {
      httpOnly: true,
      secure: production,
      sameSite: "lax",
      path: "/",
    });
  }

  private isProduction(): boolean {
    return this.config.get("NODE_ENV") === "production";
  }
}
