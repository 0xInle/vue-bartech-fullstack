import { Module } from "@nestjs/common";
import { ChecklistsRepository } from "./checklists.repository.js";
import { ChecklistsService } from "./checklists.service.js";

@Module({ providers: [ChecklistsRepository, ChecklistsService], exports: [ChecklistsService] })
export class ChecklistsModule {}
