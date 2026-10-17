import { Module } from "@nestjs/common";
import { IdentityModule } from "@bartech/backend-identity";
import { InternalAuditController } from "./internal-audit.controller.js";
import { InternalAuditPermissionGuard } from "./internal-audit-permission.guard.js";
import { InternalAuditService } from "./internal-audit.service.js";

@Module({
  imports: [IdentityModule],
  controllers: [InternalAuditController],
  providers: [InternalAuditPermissionGuard, InternalAuditService],
})
export class InternalAuditApiModule {}
