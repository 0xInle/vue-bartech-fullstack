import { Module } from "@nestjs/common";
import { CatalogCategoriesRepository } from "./catalog-categories.repository.js";
import { CatalogCategoriesService } from "./catalog-categories.service.js";

@Module({
  providers: [CatalogCategoriesRepository, CatalogCategoriesService],
  exports: [CatalogCategoriesService],
})
export class CatalogCategoriesModule {}
