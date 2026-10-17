import { Module } from "@nestjs/common";
import { IdentityModule } from "@bartech/backend-identity";
import { SupportModule } from "@bartech/backend-support";
import { InternalSupportPermissionGuard } from "./internal-support-permission.guard.js";
import { InternalSupportController, SupportController } from "./support.controller.js";
import {
  InternalServiceAccessController,
  ServiceAccessPermissionGuard,
  SupportAccessGrantController,
} from "./service-access.controller.js";

@Module({
  imports: [IdentityModule, SupportModule],
  controllers: [
    SupportController,
    InternalSupportController,
    SupportAccessGrantController,
    InternalServiceAccessController,
  ],
  providers: [InternalSupportPermissionGuard, ServiceAccessPermissionGuard],
})
export class SupportApiModule {}
