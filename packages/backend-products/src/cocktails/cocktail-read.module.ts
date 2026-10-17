import { Module } from "@nestjs/common";
import { OrganizationsModule } from "@bartech/backend-organizations";
import { ProductContextAccessModule } from "../product-context-access.module.js";
import { CocktailReadRepository } from "./cocktail-read.repository.js";
import { CocktailReadService } from "./cocktail-read.service.js";

@Module({
  imports: [OrganizationsModule, ProductContextAccessModule],
  providers: [CocktailReadRepository, CocktailReadService],
  exports: [CocktailReadService],
})
export class CocktailReadModule {}
