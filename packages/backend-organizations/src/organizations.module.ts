import { Module } from "@nestjs/common";
import { OrganizationsService } from "./organizations.service.js";
import { OrganizationInvitationsService } from "./organization-invitations.service.js";
import { PermissionService } from "./permissions/permission.service.js";
import { TeamService } from "./team/team.service.js";

@Module({
  providers: [OrganizationsService, OrganizationInvitationsService, PermissionService, TeamService],
  exports: [OrganizationsService, OrganizationInvitationsService, PermissionService, TeamService],
})
export class OrganizationsModule {}
