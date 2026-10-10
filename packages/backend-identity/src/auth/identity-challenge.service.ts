import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import { DATABASE_CLIENT, Prisma, PrismaClient, REDIS_CLIENT } from "@bartech/database";
import { randomInt } from "node:crypto";
import argon2 from "argon2";
import type { Redis } from "ioredis";
import { CODE_TTL_MS, EMAIL_RESEND_DELAY_SECONDS, redisKey } from "./identity.helpers.js";

@Injectable()
export class IdentityChallengeService {
  constructor(
    @Inject(DATABASE_CLIENT) private readonly database: PrismaClient,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async createChallenge(
    transaction: Prisma.TransactionClient,
    input: {
      emailNormalized: string;
      purpose: "EMAIL_VERIFICATION" | "PASSWORD_RESET";
      code: string;
      userId?: string;
      registrationAttemptId?: string;
    },
  ): Promise<void> {
    await transaction.emailChallenge.create({
      data: {
        emailNormalized: input.emailNormalized,
        purpose: input.purpose,
        codeHash: await argon2.hash(input.code, { type: argon2.argon2id }),
        expiresAt: new Date(Date.now() + CODE_TTL_MS),
        ...(input.userId ? { userId: input.userId } : {}),
        ...(input.registrationAttemptId
          ? { registrationAttemptId: input.registrationAttemptId }
          : {}),
      },
    });
  }

  async verifyCode(
    challenge: { id: string; codeHash: string; expiresAt: Date; attemptCount: number } | undefined,
    code: string,
  ): Promise<boolean> {
    if (!challenge || challenge.expiresAt <= new Date() || challenge.attemptCount >= 5)
      return false;
    const valid = await argon2.verify(challenge.codeHash, code).catch(() => false);
    if (valid) return true;
    const nextAttemptCount = challenge.attemptCount + 1;
    await this.database.emailChallenge.updateMany({
      where: { id: challenge.id, consumedAt: null, attemptCount: { lt: 5 } },
      data: {
        attemptCount: { increment: 1 },
        ...(nextAttemptCount >= 5 ? { consumedAt: new Date() } : {}),
      },
    });
    return false;
  }

  async reserveEmailDelivery(email: string, silent = false): Promise<boolean> {
    const result = await this.redis.set(
      redisKey("email-last-sent", email),
      "1",
      "EX",
      EMAIL_RESEND_DELAY_SECONDS,
      "NX",
    );
    if (result === "OK") return true;
    if (silent) return false;
    const ttl = await this.redis.ttl(redisKey("email-last-sent", email));
    throw new HttpException(
      `Повторно отправить код можно через ${Math.max(ttl, 1)} сек.`,
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  createCode(): string {
    return randomInt(0, 1_000_000).toString().padStart(6, "0");
  }
}
