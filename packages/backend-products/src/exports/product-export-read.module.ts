import { Module } from "@nestjs/common";
import { ProductExportReadRepository } from "./product-export-read.repository.js";
import { ProductExportReadService } from "./product-export-read.service.js";

@Module({
  providers: [ProductExportReadRepository, ProductExportReadService],
  exports: [ProductExportReadService],
})
export class ProductExportReadModule {}
