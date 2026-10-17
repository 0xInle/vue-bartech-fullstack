import { CanActivate, ExecutionContext, Injectable, NotFoundException } from "@nestjs/common";
import { OrganizationsService } from "@bartech/backend-organizations";
import type { AuthenticatedUser } from "@bartech/backend-identity";
import type { Request } from "express";

type WorkspaceRequest = Request & { user: AuthenticatedUser };

@Injectable()
export class AuditWorkspaceGuard implements CanActivate {
  constructor(private readonly organizations: OrganizationsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<WorkspaceRequest>();
    const { companyId, venueId } = request.params;
    if (
      typeof companyId !== "string" ||
      typeof venueId !== "string" ||
      !(await this.organizations.findWorkspaceForUser(request.user.id, companyId, venueId))
    ) {
      throw new NotFoundException("Рабочее пространство не найдено");
    }
    return true;
  }
}
