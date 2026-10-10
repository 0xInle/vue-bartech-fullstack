import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import nodemailer, { type Transporter } from "nodemailer";
import type { EmailMessage } from "./email-outbox.service.js";

@Injectable()
export class SmtpEmailService implements OnModuleDestroy {
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(config: ConfigService) {
    const user = config.get<string>("MAIL_USER");
    const password = config.get<string>("MAIL_PASSWORD");
    this.from = config.getOrThrow<string>("MAIL_FROM");
    this.transporter = nodemailer.createTransport({
      host: config.getOrThrow<string>("MAIL_HOST"),
      port: config.getOrThrow<number>("MAIL_PORT"),
      secure: config.get<boolean>("MAIL_SECURE", false),
      ...(user && password ? { auth: { user, pass: password } } : {}),
    });
  }

  async send(message: EmailMessage, messageId: string): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      messageId,
    });
  }

  onModuleDestroy(): void {
    this.transporter.close();
  }
}
