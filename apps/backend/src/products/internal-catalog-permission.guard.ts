import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import type { Request } from "express";

type InternalRequest = Request & {
  internalIdentity?: { user: { permissions: string[] } };
};

@Injectable()
export class InternalCatalogPermissionGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<InternalRequest>();
    if (!request.internalIdentity?.user.permissions.includes("global_catalog")) {
      throw new ForbiddenException("Нет разрешения на управление глобальным каталогом");
    }
    return true;
  }
}
