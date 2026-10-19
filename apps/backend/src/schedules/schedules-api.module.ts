import { Module } from "@nestjs/common";
import { IdentityModule } from "@bartech/backend-identity";
import { OrganizationsModule } from "@bartech/backend-organizations";
import { SchedulesModule } from "@bartech/backend-schedules";
import { WorkspacePermissionGuard } from "../organizations/workspace-permission.guard.js";
import { SchedulesController } from "./schedules.controller.js";

@Module({
  imports: [IdentityModule, OrganizationsModule, SchedulesModule],
  controllers: [SchedulesController],
  providers: [WorkspacePermissionGuard],
})
export class SchedulesApiModule {}
