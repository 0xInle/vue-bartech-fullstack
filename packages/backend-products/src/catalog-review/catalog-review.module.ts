import { Module } from "@nestjs/common";
import { CatalogReviewRepository } from "./catalog-review.repository.js";
import { CatalogReviewService } from "./catalog-review.service.js";

@Module({
  providers: [CatalogReviewRepository, CatalogReviewService],
  exports: [CatalogReviewService],
})
export class CatalogReviewModule {}
