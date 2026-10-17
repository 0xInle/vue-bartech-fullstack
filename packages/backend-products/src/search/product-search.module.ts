import { Module } from "@nestjs/common";
import { OrganizationsModule } from "@bartech/backend-organizations";
import { ProductContextAccessModule } from "../product-context-access.module.js";
import { ProductSearchRepository } from "./product-search.repository.js";
import { ProductSearchService } from "./product-search.service.js";

@Module({
  imports: [OrganizationsModule, ProductContextAccessModule],
  providers: [ProductSearchRepository, ProductSearchService],
  exports: [ProductSearchService],
})
export class ProductSearchModule {}
