import { Module } from "@nestjs/common";
import { SupportModule } from "./support.module.js";
import { ClamAvScanner } from "./clamav-scanner.js";
import { SupportAttachmentProcessor } from "./support-attachment.processor.js";
import { SupportAttachmentWorker } from "./support-attachment.worker.js";

@Module({
  imports: [SupportModule],
  providers: [ClamAvScanner, SupportAttachmentProcessor, SupportAttachmentWorker],
})
export class SupportWorkerModule {}
