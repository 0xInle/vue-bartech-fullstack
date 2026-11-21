import { Module } from "@nestjs/common";
import { IdentityModule } from "@bartech/backend-identity";
import { OrganizationsModule } from "@bartech/backend-organizations";
import { RemindersModule } from "@bartech/backend-reminders";
import { RemindersController } from "./reminders.controller.js";

@Module({
  imports: [IdentityModule, OrganizationsModule, RemindersModule],
  controllers: [RemindersController],
})
export class RemindersApiModule {}
