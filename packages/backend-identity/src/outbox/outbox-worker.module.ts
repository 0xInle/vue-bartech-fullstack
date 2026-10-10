import { Module } from "@nestjs/common";
import { IdentityModule } from "../auth/identity.module.js";
import { OutboxModule } from "./outbox.module.js";
import { OutboxProcessor } from "./outbox.processor.js";

@Module({ imports: [IdentityModule, OutboxModule], providers: [OutboxProcessor] })
export class OutboxWorkerModule {}
