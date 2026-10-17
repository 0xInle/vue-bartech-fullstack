import { Module } from "@nestjs/common";
import { OrganizationsModule } from "@bartech/backend-organizations";
import { AuditReadRepository } from "./audit-read.repository.js";
import { AuditReadService } from "./audit-read.service.js";

@Module({
  imports: [OrganizationsModule],
  providers: [AuditReadRepository, AuditReadService],
  exports: [AuditReadService],
})
export class AuditModule {}
