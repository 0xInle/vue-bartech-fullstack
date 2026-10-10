import { createHash } from "node:crypto";
import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DATABASE_CLIENT, PrismaClient } from "@bartech/database";
import type { Request, Response } from "express";

export type AuthenticatedUser = { id: string; email: string; fullName: string; sessionId: string };
type AuthenticatedRequest = Request & { user: AuthenticatedUser };

export function readCookie(request: Request, name: string): string | undefined {
  const cookieHeader = request.headers.cookie;
  if (!cookieHeader) return undefined;
  const entry = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  if (!entry) return undefined;
  try {
    return decodeURIComponent(entry.slice(name.length + 1));
  } catch {
    return undefined;
  }
}

export function sessionCookieName(production: boolean): string {
  return production ? "__Host-bartech_session" : "bartech_session";
}

export function sessionTokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    @Inject(DATABASE_CLIENT) private readonly database: PrismaClient,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const response = context.switchToHttp().getResponse<Response>();
    const production = this.config.get("NODE_ENV") === "production";
    const token = readCookie(request, sessionCookieName(production));
    if (!token) throw new UnauthorizedException("Войдите в аккаунт");

    const now = new Date();
    const session = await this.database.session.findUnique({
      where: { tokenHash: sessionTokenHash(token) },
      include: { user: { include: { profile: true } } },
    });
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= now ||
      session.createdAt.getTime() + 90 * 24 * 60 * 60 * 1000 <= now.getTime()
    ) {
      throw new UnauthorizedException("Сессия завершена. Войдите снова");
    }

    const idleExpiry = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const absoluteExpiry = new Date(session.createdAt.getTime() + 90 * 24 * 60 * 60 * 1000);
    const expiresAt = idleExpiry < absoluteExpiry ? idleExpiry : absoluteExpiry;
    if (session.lastActivityAt.getTime() < now.getTime() - 60_000) {
      await this.database.session.update({
        where: { id: session.id },
        data: { lastActivityAt: now, expiresAt },
      });
    }

    response.cookie(sessionCookieName(production), token, {
      httpOnly: true,
      secure: production,
      sameSite: "lax",
      path: "/",
      maxAge: Math.max(0, expiresAt.getTime() - now.getTime()),
    });
    request.user = {
      id: session.user.id,
      email: session.user.email,
      fullName: session.user.profile?.fullName ?? "",
      sessionId: session.id,
    };
    return true;
  }
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext) =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().user,
);
