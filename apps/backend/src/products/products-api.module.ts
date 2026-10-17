import { Module } from "@nestjs/common";
import { IdentityModule } from "@bartech/backend-identity";
import { OrganizationsModule } from "@bartech/backend-organizations";
import { ProductsModule } from "@bartech/backend-products";
import { ProductsController } from "./products.controller.js";
import { InternalServiceProductsController } from "./internal-service-products.controller.js";
import { SupportAccessModule } from "@bartech/backend-support";
import { ServiceAccessPermissionGuard } from "../support/service-access.controller.js";
import { WorkspacePermissionGuard } from "../organizations/workspace-permission.guard.js";
import { InternalCatalogController } from "./internal-catalog.controller.js";
import { InternalCatalogPermissionGuard } from "./internal-catalog-permission.guard.js";

@Module({
  imports: [IdentityModule, OrganizationsModule, ProductsModule, SupportAccessModule],
  controllers: [ProductsController, InternalServiceProductsController, InternalCatalogController],
  providers: [
    WorkspacePermissionGuard,
    ServiceAccessPermissionGuard,
    InternalCatalogPermissionGuard,
  ],
})
export class ProductsApiModule {}
