import { Module } from "@nestjs/common";
import { IdentityModule } from "@bartech/backend-identity";
import { AuditModule } from "@bartech/backend-audit";
import { OrganizationsModule } from "@bartech/backend-organizations";
import { AuditController } from "./audit.controller.js";
import { AuditWorkspaceGuard } from "./audit-workspace.guard.js";

@Module({
  imports: [IdentityModule, OrganizationsModule, AuditModule],
  controllers: [AuditController],
  providers: [AuditWorkspaceGuard],
})
export class AuditApiModule {}
