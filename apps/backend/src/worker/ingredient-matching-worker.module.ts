import { Module } from "@nestjs/common";
import { IngredientMatchingModule } from "@bartech/backend-products";
import { IngredientMatchingProcessor } from "./ingredient-matching.processor.js";

@Module({
  imports: [IngredientMatchingModule],
  providers: [IngredientMatchingProcessor],
})
export class IngredientMatchingWorkerModule {}
