import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request } from "express";
import { InternalAuthService } from "./internal-auth.service.js";

export const INTERNAL_SESSION_COOKIE = "bartech_internal_session";

type InternalRequest = Request & {
  internalIdentity?: Awaited<ReturnType<InternalAuthService["currentSession"]>>;
};

function readInternalCookie(request: Request, production = false): string | undefined {
  const name = production ? `__Host-${INTERNAL_SESSION_COOKIE}` : INTERNAL_SESSION_COOKIE;
  const value = request.headers.cookie
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  if (!value) return undefined;
  try {
    return decodeURIComponent(value.slice(name.length + 1));
  } catch {
    return undefined;
  }
}

@Injectable()
export class InternalSessionGuard implements CanActivate {
  constructor(
    private readonly authentication: InternalAuthService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<InternalRequest>();
    const token = readInternalCookie(request, this.config.get("NODE_ENV") === "production");
    if (!token) throw new UnauthorizedException("Войдите во внутренний аккаунт");
    request.internalIdentity = await this.authentication.currentSession(token);
    return true;
  }
}

export const CurrentInternalIdentity = createParamDecorator(
  (_data: unknown, context: ExecutionContext) =>
    context.switchToHttp().getRequest<InternalRequest>().internalIdentity,
);

export function internalSessionToken(request: Request, production = false): string | undefined {
  return readInternalCookie(request, production);
}
