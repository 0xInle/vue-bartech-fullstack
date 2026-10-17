import { Module } from "@nestjs/common";
import { IngredientMatchingRepository } from "./ingredient-matching.repository.js";
import { IngredientMatchingService } from "./ingredient-matching.service.js";

@Module({
  providers: [IngredientMatchingRepository, IngredientMatchingService],
  exports: [IngredientMatchingService],
})
export class IngredientMatchingModule {}
