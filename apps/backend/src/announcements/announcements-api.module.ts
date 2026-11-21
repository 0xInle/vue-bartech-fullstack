import { Module } from "@nestjs/common";
import { IdentityModule } from "@bartech/backend-identity";
import { OrganizationsModule } from "@bartech/backend-organizations";
import { AnnouncementsModule } from "@bartech/backend-announcements";
import { AnnouncementsController } from "./announcements.controller.js";

@Module({
  imports: [IdentityModule, OrganizationsModule, AnnouncementsModule],
  controllers: [AnnouncementsController],
})
export class AnnouncementsApiModule {}
