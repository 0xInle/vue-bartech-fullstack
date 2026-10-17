import { Injectable } from "@nestjs/common";
import { IngredientMatchingRepository } from "./ingredient-matching.repository.js";

@Injectable()
export class IngredientMatchingService {
  constructor(private readonly repository: IngredientMatchingRepository) {}

  async matchAllLocalIngredients(): Promise<void> {
    let lastId: string | undefined;
    while (true) {
      const products = await this.repository.findLocalIngredientsAfter(lastId);
      if (!products.length) return;
      for (const product of products) await this.repository.process(product.id);
      lastId = products.at(-1)!.id;
    }
  }
}
