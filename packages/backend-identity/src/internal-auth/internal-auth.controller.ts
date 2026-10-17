import { Body, Controller, Get, Post, Req, Res, UseGuards } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { InternalAuthService } from "./internal-auth.service.js";
import {
  InternalAcceptedResponseDto,
  InternalAuthenticatedResponseDto,
  InternalChallengeCodeDto,
  InternalChallengeResponseDto,
  InternalEnrollmentResponseDto,
  InternalLoginDto,
  InternalRecoveryCodesResponseDto,
  InternalRecoveryStartDto,
  InternalSessionResponseDto,
  InternalSetupCompleteDto,
  InternalSetupStartDto,
} from "./internal-auth.dto.js";
import {
  CurrentInternalIdentity,
  INTERNAL_SESSION_COOKIE,
  InternalSessionGuard,
  internalSessionToken,
} from "./internal-session.guard.js";

@ApiTags("internal-auth")
@Controller("internal-auth")
export class InternalAuthController {
  constructor(
    private readonly authentication: InternalAuthService,
    private readonly config: ConfigService,
  ) {}

  @Post("login")
  @ApiOperation({ summary: "Проверить пароль внутреннего аккаунта и создать challenge TOTP" })
  @ApiCreatedResponse({ type: InternalChallengeResponseDto })
  login(@Body() body: InternalLoginDto, @Req() request: Request) {
    return this.authentication.login(body.email, body.password, request.ip ?? "unknown");
  }

  @Post("login/totp")
  @ApiOperation({ summary: "Подтвердить TOTP и открыть внутреннюю сессию" })
  @ApiCreatedResponse({ type: InternalAuthenticatedResponseDto })
  async verifyLogin(
    @Body() body: InternalChallengeCodeDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authentication.verifyLogin(
      body.challenge,
      body.code,
      request.ip ?? "unknown",
    );
    this.setSessionCookie(response, result.token, result.expiresAt);
    return { authenticated: true };
  }

  @Post("setup")
  @ApiOperation({ summary: "Начать настройку по одноразовому токену оператора" })
  @ApiCreatedResponse({ type: InternalEnrollmentResponseDto })
  setup(
    @Body() body: InternalSetupStartDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Referrer-Policy", "no-referrer");
    return this.authentication.startSetup(body.setupToken, request.ip ?? "unknown");
  }

  @Post("setup/complete")
  @ApiOperation({
    summary: "Завершить настройку TOTP и выдать recovery-коды для однократного показа",
  })
  @ApiCreatedResponse({ type: InternalRecoveryCodesResponseDto })
  completeSetup(@Body() body: InternalSetupCompleteDto, @Req() request: Request) {
    return this.authentication.completeSetup(
      body.challenge,
      body.password,
      body.code,
      request.ip ?? "unknown",
    );
  }

  @Post("recovery")
  @ApiOperation({ summary: "Проверить пароль и recovery-код для повторной настройки TOTP" })
  @ApiCreatedResponse({ type: InternalChallengeResponseDto })
  recovery(@Body() body: InternalRecoveryStartDto, @Req() request: Request) {
    return this.authentication.recover(
      body.email,
      body.password,
      body.recoveryCode,
      request.ip ?? "unknown",
    );
  }

  @Post("recovery/setup")
  @ApiOperation({ summary: "Начать привязку нового TOTP после восстановления" })
  @ApiCreatedResponse({ type: InternalEnrollmentResponseDto })
  recoverySetup(
    @Body() body: InternalSetupStartDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Referrer-Policy", "no-referrer");
    return this.authentication.startRecoverySetup(body.setupToken, request.ip ?? "unknown");
  }

  @Post("recovery/complete")
  @ApiOperation({ summary: "Подтвердить новый TOTP и заменить recovery-коды" })
  @ApiCreatedResponse({ type: InternalRecoveryCodesResponseDto })
  recoveryComplete(@Body() body: InternalChallengeCodeDto, @Req() request: Request) {
    return this.authentication.finishRecoverySetup(
      body.challenge,
      body.code,
      request.ip ?? "unknown",
    );
  }

  @Get("session")
  @UseGuards(InternalSessionGuard)
  @ApiOperation({ summary: "Получить внутреннюю сессию" })
  @ApiOkResponse({ type: InternalSessionResponseDto })
  session(
    @CurrentInternalIdentity() identity: { expiresAt: Date },
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const token = internalSessionToken(request, this.config.get("NODE_ENV") === "production");
    if (token) this.setSessionCookie(response, token, identity.expiresAt);
    return identity;
  }

  @Post("logout")
  @UseGuards(InternalSessionGuard)
  @ApiOperation({ summary: "Завершить текущую внутреннюю сессию" })
  @ApiCreatedResponse({ type: InternalAcceptedResponseDto })
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const token = internalSessionToken(request, this.config.get("NODE_ENV") === "production");
    if (token) await this.authentication.logout(token);
    this.clearSessionCookie(response);
    return { accepted: true };
  }

  @Post("logout-all")
  @UseGuards(InternalSessionGuard)
  @ApiOperation({ summary: "Завершить все внутренние сессии" })
  @ApiCreatedResponse({ type: InternalAcceptedResponseDto })
  async logoutAll(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const token = internalSessionToken(request, this.config.get("NODE_ENV") === "production");
    if (token) await this.authentication.logout(token, true);
    this.clearSessionCookie(response);
    return { accepted: true };
  }

  private setSessionCookie(response: Response, token: string, expiresAt: Date) {
    const production = this.config.get("NODE_ENV") === "production";
    response.cookie(
      production ? `__Host-${INTERNAL_SESSION_COOKIE}` : INTERNAL_SESSION_COOKIE,
      token,
      {
        httpOnly: true,
        secure: production,
        sameSite: "lax",
        path: "/",
        expires: expiresAt,
      },
    );
  }

  private clearSessionCookie(response: Response) {
    const production = this.config.get("NODE_ENV") === "production";
    response.clearCookie(
      production ? `__Host-${INTERNAL_SESSION_COOKIE}` : INTERNAL_SESSION_COOKIE,
      {
        path: "/",
        sameSite: "lax",
        secure: production,
      },
    );
  }
}
