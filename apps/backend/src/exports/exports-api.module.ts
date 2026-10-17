import { Module } from "@nestjs/common";
import { IdentityModule } from "@bartech/backend-identity";
import { ProductExportsModule } from "@bartech/backend-exports";
import { OrganizationsModule } from "@bartech/backend-organizations";
import { ExportsController } from "./exports.controller.js";
import { WorkspacePermissionGuard } from "../organizations/workspace-permission.guard.js";

@Module({
  imports: [IdentityModule, OrganizationsModule, ProductExportsModule],
  controllers: [ExportsController],
  providers: [WorkspacePermissionGuard],
})
export class ExportsApiModule {}
