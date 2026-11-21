import { Module } from "@nestjs/common";
import { RemindersRepository } from "./reminders.repository.js";
import { RemindersService } from "./reminders.service.js";

@Module({
  providers: [RemindersRepository, RemindersService],
  exports: [RemindersService],
})
export class RemindersModule {}
