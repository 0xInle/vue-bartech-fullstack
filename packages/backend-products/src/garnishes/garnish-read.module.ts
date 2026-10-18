import { Module } from "@nestjs/common";
import { OrganizationsModule } from "@bartech/backend-organizations";
import { ProductContextAccessModule } from "../product-context-access.module.js";
import { ProductSearchModule } from "../search/product-search.module.js";
import { GarnishReadRepository } from "./garnish-read.repository.js";
import { GarnishReadService } from "./garnish-read.service.js";

@Module({
  imports: [OrganizationsModule, ProductContextAccessModule, ProductSearchModule],
  providers: [GarnishReadRepository, GarnishReadService],
  exports: [GarnishReadService],
})
export class GarnishReadModule {}
