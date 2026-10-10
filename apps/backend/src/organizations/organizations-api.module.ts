import { Module } from "@nestjs/common";
import { IdentityModule } from "@bartech/backend-identity";
import { OrganizationsModule } from "@bartech/backend-organizations";
import { OrganizationsController } from "./organizations.controller.js";
import { WorkspacePermissionGuard } from "./workspace-permission.guard.js";
import { InvitationsController } from "./invitations.controller.js";

@Module({
  imports: [IdentityModule, OrganizationsModule],
  controllers: [OrganizationsController, InvitationsController],
  providers: [WorkspacePermissionGuard],
})
export class OrganizationsApiModule {}
