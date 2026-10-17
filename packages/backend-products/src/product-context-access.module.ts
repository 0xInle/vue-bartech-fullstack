import { Module } from "@nestjs/common";
import { OrganizationsModule } from "@bartech/backend-organizations";
import { SupportAccessModule } from "@bartech/backend-support";
import { ProductContextAccess } from "./product-context-access.js";

@Module({
  imports: [OrganizationsModule, SupportAccessModule],
  providers: [ProductContextAccess],
  exports: [ProductContextAccess],
})
export class ProductContextAccessModule {}
