import { Module } from "@nestjs/common";
import { OutboxModule } from "@bartech/backend-identity";
import { ProductExportsModule } from "@bartech/backend-exports";
import { OrganizationsModule } from "@bartech/backend-organizations";
import { SupportAccessModule } from "@bartech/backend-support";
import { OrganizationLifecycleService } from "./organization-lifecycle.service.js";

@Module({
  imports: [OutboxModule, ProductExportsModule, OrganizationsModule, SupportAccessModule],
  providers: [OrganizationLifecycleService],
  exports: [OrganizationLifecycleService],
})
export class OrganizationLifecycleModule {}
