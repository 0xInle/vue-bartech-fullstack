import { Module } from "@nestjs/common";
import { OrganizationsModule } from "@bartech/backend-organizations";
import { ProductContextAccessModule } from "../product-context-access.module.js";
import { GarnishUpdateRepository } from "./garnish-update.repository.js";
import { GarnishUpdateService } from "./garnish-update.service.js";

@Module({
  imports: [OrganizationsModule, ProductContextAccessModule],
  providers: [GarnishUpdateRepository, GarnishUpdateService],
  exports: [GarnishUpdateService],
})
export class GarnishUpdateModule {}
