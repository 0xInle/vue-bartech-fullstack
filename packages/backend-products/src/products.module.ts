import { Module } from "@nestjs/common";
import { OrganizationsModule } from "@bartech/backend-organizations";
import { ProductContextAccessModule } from "./product-context-access.module.js";
import { ProductsRepository } from "./products.repository.js";
import { ProductsService } from "./products.service.js";
import { ProductSearchModule } from "./search/product-search.module.js";
import { IngredientMatchingModule } from "./matching/ingredient-matching.module.js";
import { CocktailReadModule } from "./cocktails/cocktail-read.module.js";
import { PreparationReadModule } from "./preparations/preparation-read.module.js";
import { PreparationUpdateModule } from "./preparations/preparation-update.module.js";
import { GarnishReadModule } from "./garnishes/garnish-read.module.js";
import { GarnishUpdateModule } from "./garnishes/garnish-update.module.js";
import { ArchiveModule } from "./archive/archive.module.js";
import { ProductExportReadModule } from "./exports/product-export-read.module.js";
import { CatalogReviewModule } from "./catalog-review/catalog-review.module.js";
import { CatalogManagementModule } from "./catalog-management/catalog-management.module.js";
import { CatalogCategoriesModule } from "./catalog-categories/catalog-categories.module.js";

@Module({
  imports: [
    OrganizationsModule,
    ProductContextAccessModule,
    ProductSearchModule,
    IngredientMatchingModule,
    CocktailReadModule,
    PreparationReadModule,
    PreparationUpdateModule,
    GarnishReadModule,
    GarnishUpdateModule,
    ArchiveModule,
    ProductExportReadModule,
    CatalogReviewModule,
    CatalogManagementModule,
    CatalogCategoriesModule,
  ],
  providers: [ProductsRepository, ProductsService],
  exports: [
    ProductsService,
    ProductSearchModule,
    IngredientMatchingModule,
    CocktailReadModule,
    PreparationReadModule,
    PreparationUpdateModule,
    GarnishReadModule,
    GarnishUpdateModule,
    ArchiveModule,
    ProductExportReadModule,
    CatalogReviewModule,
    CatalogManagementModule,
    CatalogCategoriesModule,
  ],
})
export class ProductsModule {}
