import { Module } from "@nestjs/common";
import { OrganizationsModule } from "@bartech/backend-organizations";
import { ProductContextAccessModule } from "../product-context-access.module.js";
import { PreparationUpdateRepository } from "./preparation-update.repository.js";
import { PreparationUpdateService } from "./preparation-update.service.js";

@Module({
  imports: [OrganizationsModule, ProductContextAccessModule],
  providers: [PreparationUpdateRepository, PreparationUpdateService],
  exports: [PreparationUpdateService],
})
export class PreparationUpdateModule {}
