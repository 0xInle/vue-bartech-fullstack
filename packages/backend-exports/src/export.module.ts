import { Module } from "@nestjs/common";
import { OrganizationsModule } from "@bartech/backend-organizations";
import { ProductExportReadModule } from "@bartech/backend-products";
import { ExportRepository } from "./export.repository.js";
import { ExportService } from "./export.service.js";
import { ExportRendererService } from "./export-renderer.service.js";
import { ExportCleanupService } from "./export-cleanup.service.js";

@Module({
  imports: [OrganizationsModule, ProductExportReadModule],
  providers: [ExportRepository, ExportService, ExportRendererService, ExportCleanupService],
  exports: [ExportRepository, ExportService, ExportRendererService, ExportCleanupService],
})
export class ProductExportsModule {}
