import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import type { Request } from "express";

type InternalRequest = Request & {
  internalIdentity?: { user: { permissions: string[] } };
};

@Injectable()
export class InternalSupportPermissionGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<InternalRequest>();
    if (!request.internalIdentity?.user.permissions.includes("support_requests")) {
      throw new ForbiddenException("У вас нет доступа к очереди поддержки");
    }
    return true;
  }
}
