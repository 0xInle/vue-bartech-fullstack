import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from "node:crypto";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma, DATABASE_CLIENT, PrismaClient } from "@bartech/database";

export type EmailMessage = { to: string; subject: string; text: string };

@Injectable()
export class EmailOutboxService {
  private readonly logger = new Logger(EmailOutboxService.name);
  private readonly encryptionKey: Buffer;

  constructor(
    config: ConfigService,
    @Inject(DATABASE_CLIENT) private readonly database: PrismaClient,
  ) {
    this.encryptionKey = Buffer.from(config.getOrThrow<string>("OUTBOX_ENCRYPTION_KEY"), "base64");
    if (this.encryptionKey.length !== 32) {
      throw new Error("OUTBOX_ENCRYPTION_KEY должен содержать 32 байта в base64");
    }
  }

  async enqueue(
    transaction: Prisma.TransactionClient,
    eventType: string,
    message: EmailMessage,
  ): Promise<void> {
    const id = randomUUID();
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.encryptionKey, iv);
    cipher.setAAD(Buffer.from(`${id}:${eventType}`));
    const ciphertext = Buffer.concat([
      cipher.update(JSON.stringify(message), "utf8"),
      cipher.final(),
    ]);

    await transaction.outboxMessage.create({
      data: {
        id,
        eventType,
        payloadCiphertext: ciphertext.toString("base64"),
        payloadIv: iv.toString("base64"),
        payloadAuthTag: cipher.getAuthTag().toString("base64"),
      },
    });
  }

  async deliver(
    id: string,
    send: (message: EmailMessage, messageId: string) => Promise<void>,
  ): Promise<void> {
    const outbox = await this.database.outboxMessage.findUnique({ where: { id } });
    if (!outbox || outbox.status === "DELIVERED" || outbox.status === "FAILED") return;

    if (!outbox.payloadCiphertext || !outbox.payloadIv || !outbox.payloadAuthTag) {
      await this.database.outboxMessage.update({ where: { id }, data: { status: "FAILED" } });
      return;
    }

    try {
      const decryptor = createDecipheriv(
        "aes-256-gcm",
        this.encryptionKey,
        Buffer.from(outbox.payloadIv, "base64"),
      );
      decryptor.setAAD(Buffer.from(`${outbox.id}:${outbox.eventType}`));
      decryptor.setAuthTag(Buffer.from(outbox.payloadAuthTag, "base64"));
      const plaintext = Buffer.concat([
        decryptor.update(Buffer.from(outbox.payloadCiphertext, "base64")),
        decryptor.final(),
      ]).toString("utf8");
      const message = JSON.parse(plaintext) as EmailMessage;

      await send(message, `<${outbox.id}@bartech>`);
    } catch (error) {
      const attemptCount = outbox.attemptCount + 1;
      const delays = [30_000, 120_000, 600_000, 1_800_000];
      await this.database.outboxMessage.update({
        where: { id },
        data:
          attemptCount >= 5
            ? {
                status: "FAILED",
                attemptCount,
                payloadCiphertext: null,
                payloadIv: null,
                payloadAuthTag: null,
              }
            : {
                status: "PENDING",
                attemptCount,
                nextAttemptAt: new Date(Date.now() + delays[attemptCount - 1]),
              },
      });
      this.logger.warn(
        {
          outboxId: outbox.id,
          eventType: outbox.eventType,
          attemptCount,
          errorType: error instanceof Error ? error.constructor.name : "UnknownError",
        },
        "Не удалось доставить письмо",
      );
      return;
    }

    await this.database.outboxMessage.update({
      where: { id, status: { not: "DELIVERED" } },
      data: {
        status: "DELIVERED",
        deliveredAt: new Date(),
        payloadCiphertext: null,
        payloadIv: null,
        payloadAuthTag: null,
      },
    });
  }
}
