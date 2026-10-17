import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import type { Request } from "express";

type InternalRequest = Request & {
  internalIdentity?: { user: { permissions: string[] } };
};

@Injectable()
export class InternalAnalyticsPermissionGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<InternalRequest>();
    if (!request.internalIdentity?.user.permissions.includes("product_analytics")) {
      throw new ForbiddenException("У вас нет доступа к продуктовой аналитике");
    }
    return true;
  }
}
