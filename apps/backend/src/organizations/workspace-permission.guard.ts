import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
  SetMetadata,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import {
  OrganizationsService,
  type PermissionCode,
  type WorkspaceSummary,
} from "@bartech/backend-organizations";
import type { AuthenticatedUser } from "@bartech/backend-identity";
import type { Request } from "express";

const REQUIRED_PERMISSIONS = Symbol("required-permissions");

type WorkspaceRequest = Request & {
  user: AuthenticatedUser;
  workspace?: WorkspaceSummary;
};

export const RequirePermissions = (...permissions: PermissionCode[]) =>
  SetMetadata(REQUIRED_PERMISSIONS, permissions);

export const CurrentWorkspace = createParamDecorator(
  (_data: unknown, context: ExecutionContext) =>
    context.switchToHttp().getRequest<WorkspaceRequest>().workspace,
);

@Injectable()
export class WorkspacePermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly organizations: OrganizationsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<WorkspaceRequest>();
    const companyId = request.params.companyId;
    const venueId = request.params.venueId;
    if (typeof companyId !== "string" || typeof venueId !== "string") {
      throw new NotFoundException("Рабочее пространство не найдено");
    }

    const workspace = await this.organizations.findWorkspaceForUser(
      request.user.id,
      companyId,
      venueId,
    );
    if (!workspace) throw new NotFoundException("Рабочее пространство не найдено");

    const requiredPermissions = this.reflector.getAllAndOverride<PermissionCode[]>(
      REQUIRED_PERMISSIONS,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredPermissions?.length) {
      return false;
    }
    if (requiredPermissions?.some((permission) => !workspace.permissions.includes(permission))) {
      throw new ForbiddenException("У вас нет доступа к этому действию");
    }

    request.workspace = workspace;
    return true;
  }
}
