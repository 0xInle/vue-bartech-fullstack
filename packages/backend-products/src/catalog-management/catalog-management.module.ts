import { Module } from "@nestjs/common";
import { CatalogManagementRepository } from "./catalog-management.repository.js";
import { CatalogManagementService } from "./catalog-management.service.js";

@Module({
  providers: [CatalogManagementRepository, CatalogManagementService],
  exports: [CatalogManagementService],
})
export class CatalogManagementModule {}
