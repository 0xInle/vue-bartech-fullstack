import { Module } from "@nestjs/common";
import { IdentityModule } from "@bartech/backend-identity";
import { OrganizationsModule } from "@bartech/backend-organizations";
import { ChecklistsModule } from "@bartech/backend-checklists";
import { ChecklistsController } from "./checklists.controller.js";

@Module({
  imports: [IdentityModule, OrganizationsModule, ChecklistsModule],
  controllers: [ChecklistsController],
})
export class ChecklistsApiModule {}
