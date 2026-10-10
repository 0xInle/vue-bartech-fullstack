import { Module } from "@nestjs/common";
import { OutboxWorkerModule } from "@bartech/backend-identity";
import { AppModule } from "./app.module.js";

@Module({ imports: [AppModule, OutboxWorkerModule] })
export class WorkerModule {}
