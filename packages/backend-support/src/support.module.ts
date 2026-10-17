import { Module } from "@nestjs/common";
import { OrganizationsModule } from "@bartech/backend-organizations";
import { SupportService } from "./support.service.js";
import { SupportAttachmentRepository } from "./support-attachment.repository.js";
import { SupportAccessModule } from "./access/support-access.module.js";

@Module({
  imports: [OrganizationsModule, SupportAccessModule],
  providers: [SupportService, SupportAttachmentRepository],
  exports: [SupportService, SupportAttachmentRepository, SupportAccessModule],
})
export class SupportModule {}
