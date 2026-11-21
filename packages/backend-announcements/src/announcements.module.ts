import { Module } from "@nestjs/common";
import { AnnouncementsRepository } from "./announcements.repository.js";
import { AnnouncementsService } from "./announcements.service.js";

@Module({
  providers: [AnnouncementsRepository, AnnouncementsService],
  exports: [AnnouncementsService],
})
export class AnnouncementsModule {}
