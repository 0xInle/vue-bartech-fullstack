import { Module } from "@nestjs/common";
import { EmailOutboxService } from "./email-outbox.service.js";
import { SmtpEmailService } from "./smtp-email.service.js";

@Module({
  providers: [EmailOutboxService, SmtpEmailService],
  exports: [EmailOutboxService, SmtpEmailService],
})
export class OutboxModule {}
