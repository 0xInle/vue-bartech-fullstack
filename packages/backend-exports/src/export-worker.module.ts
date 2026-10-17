import { Module } from "@nestjs/common";
import { ProductExportsModule } from "./export.module.js";
import { ExportProcessor } from "./export.processor.js";
import { ExportWorker } from "./export.worker.js";

@Module({
  imports: [ProductExportsModule],
  providers: [ExportProcessor, ExportWorker],
})
export class ExportWorkerModule {}
