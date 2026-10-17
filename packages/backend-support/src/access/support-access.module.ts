import { Module } from "@nestjs/common";
import { SupportAccessService } from "./support-access.service.js";

@Module({
  providers: [SupportAccessService],
  exports: [SupportAccessService],
})
export class SupportAccessModule {}
