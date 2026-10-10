import { Module } from "@nestjs/common";
import { OrganizationsService } from "./organizations.service.js";
import { OrganizationInvitationsService } from "./organization-invitations.service.js";
import { PermissionService } from "./permissions/permission.service.js";

@Module({
  providers: [OrganizationsService, OrganizationInvitationsService, PermissionService],
  exports: [OrganizationsService, OrganizationInvitationsService, PermissionService],
})
export class OrganizationsModule {}
