import { Module } from "@nestjs/common";
import { OrganizationsModule } from "@bartech/backend-organizations";
import { ProductContextAccessModule } from "../product-context-access.module.js";
import { PreparationReadRepository } from "./preparation-read.repository.js";
import { PreparationReadService } from "./preparation-read.service.js";

@Module({
  imports: [OrganizationsModule, ProductContextAccessModule],
  providers: [PreparationReadRepository, PreparationReadService],
  exports: [PreparationReadService],
})
export class PreparationReadModule {}
