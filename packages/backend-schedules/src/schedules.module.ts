import { Module } from "@nestjs/common";
import { ScheduleExportService } from "./schedule-export.service.js";
import { SchedulesService } from "./schedules.service.js";

@Module({
  providers: [SchedulesService, ScheduleExportService],
  exports: [SchedulesService, ScheduleExportService],
})
export class SchedulesModule {}
