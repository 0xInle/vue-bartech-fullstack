import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DATABASE_CLIENT, REDIS_CLIENT, Prisma, PrismaClient } from "@bartech/database";
import argon2 from "argon2";
import type { Redis } from "ioredis";
import QRCode from "qrcode";
import { EmailOutboxService } from "../outbox/email-outbox.service.js";
import {
  INTERNAL_SESSION_ABSOLUTE_MS,
  INTERNAL_SESSION_IDLE_MS,
  normalizePassword,
} from "../auth/identity.helpers.js";

const CHALLENGE_TTL_MS = 5 * 60_000;
const ENROLLMENT_CHALLENGE_TTL_MS = 30 * 60_000;
const TOTP_FAILURE_LIMIT = 100;
const INVALID_CREDENTIALS = "Неверные данные для входа";
const DUMMY_PASSWORD_HASH = argon2.hash(randomBytes(32).toString("hex"), { type: argon2.argon2id });

type ChallengePurpose = "LOGIN" | "ENROLLMENT" | "RECOVERY";

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function constantEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function base32Encode(bytes: Buffer): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits) output += alphabet[(value << (5 - bits)) & 31];
  return output;
}

function base32Decode(value: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0;
  let buffer = 0;
  const bytes: number[] = [];
  for (const character of value.toUpperCase().replace(/=+$/u, "")) {
    const digit = alphabet.indexOf(character);
    if (digit < 0) throw new UnauthorizedException(INVALID_CREDENTIALS);
    buffer = (buffer << 5) | digit;
    bits += 5;
    if (bits >= 8) {
      bytes.push((buffer >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function encryptSecret(secret: string, key: Buffer) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return {
    totpSecretCiphertext: ciphertext.toString("base64url"),
    totpSecretIv: iv.toString("base64url"),
    totpSecretAuthTag: cipher.getAuthTag().toString("base64url"),
  };
}

function decryptSecret(
  record: {
    totpSecretCiphertext: string | null;
    totpSecretIv: string | null;
    totpSecretAuthTag: string | null;
  },
  key: Buffer,
): string {
  if (!record.totpSecretCiphertext || !record.totpSecretIv || !record.totpSecretAuthTag) {
    throw new UnauthorizedException(INVALID_CREDENTIALS);
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(record.totpSecretIv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(record.totpSecretAuthTag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(record.totpSecretCiphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

function totp(secret: string, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hmac = createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1]! & 15;
  const binary =
    ((hmac[offset]! & 127) << 24) |
    ((hmac[offset + 1]! & 255) << 16) |
    ((hmac[offset + 2]! & 255) << 8) |
    (hmac[offset + 3]! & 255);
  return String(binary % 1_000_000).padStart(6, "0");
}

function acceptedStep(
  secret: string,
  code: string,
  now: number,
  lastAcceptedStep: bigint,
): number | null {
  const current = Math.floor(now / 30_000);
  for (const step of [current, current - 1, current + 1]) {
    if (BigInt(step) > lastAcceptedStep && constantEqual(totp(secret, step), code)) return step;
  }
  return null;
}

@Injectable()
export class InternalAuthService {
  private readonly encryptionKey: Buffer;

  constructor(
    @Inject(DATABASE_CLIENT) private readonly database: PrismaClient,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    config: ConfigService,
    private readonly outbox: EmailOutboxService,
  ) {
    this.encryptionKey = Buffer.from(
      config.getOrThrow<string>("INTERNAL_TOTP_ENCRYPTION_KEY"),
      "base64",
    );
    if (this.encryptionKey.length !== 32)
      throw new Error("INTERNAL_TOTP_ENCRYPTION_KEY должен быть ключом 32 байта в Base64");
  }

  async limitSource(ip: string, action: string): Promise<void> {
    const key = `bartech:internal-auth:${action}:${hash(ip)}`;
    const count = (await this.redis.eval(
      "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n",
      1,
      key,
      60,
    )) as number;
    if (count > 20) {
      throw new HttpException(
        "Слишком много попыток. Попробуйте позже",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  async login(email: string, password: string, ip: string) {
    await this.limitSource(ip, "login");
    const normalized = email.trim().toLowerCase();
    await this.waitForAccountThrottle(normalized);
    const user = await this.database.internalUser.findUnique({
      where: { emailNormalized: normalized },
    });
    const passwordValid = await argon2
      .verify(user?.passwordHash ?? (await DUMMY_PASSWORD_HASH), password)
      .catch(() => false);
    if (!user || user.status !== "ACTIVE" || user.totpAuthenticatorDisabledAt || !passwordValid) {
      await this.recordFailure(normalized);
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }
    const token = randomBytes(32).toString("base64url");
    const challenge = await this.database.internalAuthChallenge.create({
      data: {
        internalUserId: user.id,
        purpose: "LOGIN",
        tokenHash: hash(token),
        expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
      },
    });
    return { challenge: token, expiresAt: challenge.expiresAt };
  }

  async startSetup(setupToken: string, ip: string) {
    await this.limitSource(ip, "setup");
    const user = await this.database.internalUser.findFirst({
      where: {
        setupTokenHash: hash(setupToken),
        setupTokenExpiresAt: { gt: new Date() },
        status: "PENDING_ENROLLMENT",
      },
    });
    if (!user) throw new UnauthorizedException("Ссылка настройки недействительна или истекла");
    const enrollmentExpiresAt = new Date(
      Math.min(Date.now() + ENROLLMENT_CHALLENGE_TTL_MS, user.setupTokenExpiresAt!.getTime()),
    );
    const secret = base32Encode(randomBytes(20));
    const challengeToken = randomBytes(32).toString("base64url");
    const otpAuthUrl = `otpauth://totp/IndieBar:${encodeURIComponent(user.email)}?secret=${secret}&issuer=IndieBar&algorithm=SHA1&digits=6&period=30`;
    const qrCodeDataUrl = await QRCode.toDataURL(otpAuthUrl);
    await this.database.$transaction(async (tx) => {
      const consumed = await tx.internalUser.updateMany({
        where: {
          id: user.id,
          setupTokenHash: hash(setupToken),
          setupTokenExpiresAt: { gt: new Date() },
          status: "PENDING_ENROLLMENT",
        },
        data: {
          ...encryptSecret(secret, this.encryptionKey),
          setupTokenHash: null,
          setupTokenExpiresAt: null,
        },
      });
      if (consumed.count !== 1)
        throw new UnauthorizedException("Ссылка настройки недействительна или истекла");
      await tx.internalAuthChallenge.create({
        data: {
          internalUserId: user.id,
          purpose: "ENROLLMENT",
          tokenHash: hash(challengeToken),
          expiresAt: enrollmentExpiresAt,
        },
      });
    });
    return { challenge: challengeToken, secret, otpAuthUrl, qrCodeDataUrl };
  }

  async completeSetup(challengeToken: string, password: string, code: string, ip: string) {
    await this.limitSource(ip, "setup");
    const challenge = await this.claimChallengeAttempt(challengeToken, "ENROLLMENT");
    const user = await this.database.internalUser.findUniqueOrThrow({
      where: { id: challenge.internalUserId },
    });
    const secret = decryptSecret(user, this.encryptionKey);
    const step = acceptedStep(secret, code, Date.now(), user.lastAcceptedTotpStep);
    if (step === null) return this.rejectChallenge(challenge.id);
    const codes = Array.from({ length: 10 }, () =>
      base32Encode(randomBytes(16))
        .match(/.{1,5}/gu)!
        .join("-"),
    );
    const passwordHash = await argon2.hash(normalizePassword(password, user.email), {
      type: argon2.argon2id,
    });
    await this.database.$transaction(async (tx) => {
      const claimed = await tx.internalAuthChallenge.updateMany({
        where: { id: challenge.id, consumedAt: null, expiresAt: { gt: new Date() } },
        data: { consumedAt: new Date() },
      });
      if (claimed.count !== 1) throw new UnauthorizedException(INVALID_CREDENTIALS);
      const advanced = await tx.internalUser.updateMany({
        where: {
          id: user.id,
          lastAcceptedTotpStep: { lt: BigInt(step) },
          status: "PENDING_ENROLLMENT",
        },
        data: {
          lastAcceptedTotpStep: BigInt(step),
          totpFailureCount: 0,
          totpAuthenticatorDisabledAt: null,
          passwordHash,
          status: "ACTIVE",
        },
      });
      if (advanced.count !== 1) throw new UnauthorizedException(INVALID_CREDENTIALS);
      await tx.internalRecoveryCode.createMany({
        data: codes.map((codeValue) => ({
          internalUserId: user.id,
          codeHash: hash(codeValue.replaceAll("-", "")),
        })),
      });
      await tx.internalAuditEvent.create({
        data: {
          eventType: "totp.enrolled",
          actorType: "INTERNAL_USER",
          actorId: user.id,
          internalUserId: user.id,
        },
      });
    });
    await this.redis.del(`bartech:internal-auth:account-failures:${hash(user.emailNormalized)}`);
    return { recoveryCodes: codes };
  }

  async verifyLogin(challengeToken: string, code: string, ip: string) {
    await this.limitSource(ip, "login");
    const challenge = await this.claimChallengeAttempt(challengeToken, "LOGIN");
    const user = await this.database.internalUser.findUniqueOrThrow({
      where: { id: challenge.internalUserId },
    });
    await this.waitForAccountThrottle(user.emailNormalized);
    if (user.totpAuthenticatorDisabledAt) return this.rejectChallenge(challenge.id);
    const step = acceptedStep(
      decryptSecret(user, this.encryptionKey),
      code,
      Date.now(),
      user.lastAcceptedTotpStep,
    );
    if (step === null) return this.rejectTotpAttempt(challenge.id, user.id);
    const rawToken = randomBytes(32).toString("base64url");
    const now = new Date();
    const expiresAt = new Date(now.getTime() + INTERNAL_SESSION_IDLE_MS);
    let replayDetected = false;
    try {
      await this.database.$transaction(async (tx) => {
        const claimed = await tx.internalAuthChallenge.updateMany({
          where: { id: challenge.id, consumedAt: null, expiresAt: { gt: now } },
          data: { consumedAt: now },
        });
        if (claimed.count !== 1) throw new UnauthorizedException(INVALID_CREDENTIALS);
        const advanced = await tx.internalUser.updateMany({
          where: {
            id: user.id,
            lastAcceptedTotpStep: { lt: BigInt(step) },
            status: "ACTIVE",
            totpAuthenticatorDisabledAt: null,
          },
          data: { lastAcceptedTotpStep: BigInt(step), totpFailureCount: 0 },
        });
        if (advanced.count !== 1) {
          const latest = await tx.internalUser.findUnique({
            where: { id: user.id },
            select: { status: true, lastAcceptedTotpStep: true, totpAuthenticatorDisabledAt: true },
          });
          replayDetected = Boolean(
            latest?.status === "ACTIVE" &&
            !latest.totpAuthenticatorDisabledAt &&
            latest.lastAcceptedTotpStep >= BigInt(step),
          );
          throw new UnauthorizedException(INVALID_CREDENTIALS);
        }
        await tx.internalSession.create({
          data: { internalUserId: user.id, tokenHash: hash(rawToken), expiresAt },
        });
        await tx.internalAuditEvent.create({
          data: {
            eventType: "session.created",
            actorType: "INTERNAL_USER",
            actorId: user.id,
            internalUserId: user.id,
          },
        });
      });
    } catch (error) {
      if (replayDetected) return this.rejectTotpAttempt(challenge.id, user.id);
      throw error;
    }
    await this.redis.del(`bartech:internal-auth:account-failures:${hash(user.emailNormalized)}`);
    return { token: rawToken, expiresAt };
  }

  async recover(email: string, password: string, recoveryCode: string, ip: string) {
    await this.limitSource(ip, "recovery");
    const normalized = email.trim().toLowerCase();
    await this.waitForAccountThrottle(normalized);
    const user = await this.database.internalUser.findUnique({
      where: { emailNormalized: normalized },
    });
    if (
      !user ||
      !["ACTIVE", "RECOVERY_REQUIRED"].includes(user.status) ||
      !user.passwordHash ||
      !(await argon2.verify(user.passwordHash, password).catch(() => false))
    ) {
      await this.recordFailure(normalized);
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }
    const codeHash = hash(recoveryCode.replaceAll("-", "").toUpperCase());
    const code = await this.database.internalRecoveryCode.findFirst({
      where: { internalUserId: user.id, codeHash, consumedAt: null },
    });
    if (!code) {
      await this.recordFailure(user.emailNormalized);
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }
    const challengeToken = randomBytes(32).toString("base64url");
    const now = new Date();
    await this.database.$transaction(async (tx) => {
      const sessions = await this.lockInternalSessions(tx, user.id);
      const consumed = await tx.internalRecoveryCode.updateMany({
        where: { id: code.id, consumedAt: null },
        data: { consumedAt: now },
      });
      if (consumed.count !== 1) throw new UnauthorizedException(INVALID_CREDENTIALS);
      await tx.internalSession.updateMany({
        where: { id: { in: sessions }, revokedAt: null },
        data: { revokedAt: now },
      });
      await this.endServiceSessions(tx, user.id, "mfa_recovery", sessions);
      await tx.internalUser.update({
        where: { id: user.id },
        data: {
          status: "RECOVERY_REQUIRED",
          totpSecretCiphertext: null,
          totpSecretIv: null,
          totpSecretAuthTag: null,
          lastAcceptedTotpStep: -1n,
          totpFailureCount: 0,
          totpAuthenticatorDisabledAt: null,
        },
      });
      await tx.internalAuthChallenge.updateMany({
        where: { internalUserId: user.id, consumedAt: null },
        data: { consumedAt: now },
      });
      await tx.internalAuthChallenge.create({
        data: {
          internalUserId: user.id,
          purpose: "RECOVERY",
          tokenHash: hash(challengeToken),
          expiresAt: new Date(now.getTime() + CHALLENGE_TTL_MS),
        },
      });
      await tx.internalAuditEvent.create({
        data: {
          eventType: "account.recovery_started",
          actorType: "INTERNAL_USER",
          actorId: user.id,
          internalUserId: user.id,
        },
      });
      await this.outbox.enqueue(tx, "internal_auth.recovery_notification", {
        to: user.email,
        subject: "Восстановление внутреннего аккаунта IndieBar",
        text: "Для вашего внутреннего аккаунта IndieBar началось восстановление доступа и перенастройка приложения-аутентификатора. Если это были не вы, свяжитесь с владельцем продукта.",
      });
    });
    return { challenge: challengeToken };
  }

  async startRecoverySetup(challengeToken: string, ip: string) {
    await this.limitSource(ip, "recovery");
    const challenge = await this.readChallenge(challengeToken, "RECOVERY");
    const user = await this.database.internalUser.findUniqueOrThrow({
      where: { id: challenge.internalUserId },
    });
    const secret = base32Encode(randomBytes(20));
    const nextToken = randomBytes(32).toString("base64url");
    const otpAuthUrl = `otpauth://totp/IndieBar:${encodeURIComponent(user.email)}?secret=${secret}&issuer=IndieBar&algorithm=SHA1&digits=6&period=30`;
    const qrCodeDataUrl = await QRCode.toDataURL(otpAuthUrl);
    await this.database.$transaction(async (tx) => {
      const claimed = await tx.internalAuthChallenge.updateMany({
        where: { id: challenge.id, consumedAt: null, expiresAt: { gt: new Date() } },
        data: { consumedAt: new Date() },
      });
      if (claimed.count !== 1) throw new UnauthorizedException(INVALID_CREDENTIALS);
      await tx.internalUser.update({
        where: { id: user.id },
        data: encryptSecret(secret, this.encryptionKey),
      });
      await tx.internalAuthChallenge.create({
        data: {
          internalUserId: user.id,
          purpose: "ENROLLMENT",
          tokenHash: hash(nextToken),
          expiresAt: new Date(Date.now() + ENROLLMENT_CHALLENGE_TTL_MS),
        },
      });
    });
    return { challenge: nextToken, secret, otpAuthUrl, qrCodeDataUrl };
  }

  async finishRecoverySetup(challengeToken: string, code: string, ip: string) {
    await this.limitSource(ip, "recovery");
    const challenge = await this.claimChallengeAttempt(challengeToken, "ENROLLMENT");
    const user = await this.database.internalUser.findUniqueOrThrow({
      where: { id: challenge.internalUserId },
    });
    await this.waitForAccountThrottle(user.emailNormalized);
    const step = acceptedStep(
      decryptSecret(user, this.encryptionKey),
      code,
      Date.now(),
      user.lastAcceptedTotpStep,
    );
    if (step === null) return this.rejectChallenge(challenge.id);
    const recoveryCodes = Array.from({ length: 10 }, () =>
      base32Encode(randomBytes(16))
        .match(/.{1,5}/gu)!
        .join("-"),
    );
    await this.database.$transaction(async (tx) => {
      const claimed = await tx.internalAuthChallenge.updateMany({
        where: { id: challenge.id, consumedAt: null, expiresAt: { gt: new Date() } },
        data: { consumedAt: new Date() },
      });
      if (claimed.count !== 1) throw new UnauthorizedException(INVALID_CREDENTIALS);
      const saved = await tx.internalUser.updateMany({
        where: {
          id: user.id,
          lastAcceptedTotpStep: { lt: BigInt(step) },
          status: "RECOVERY_REQUIRED",
        },
        data: {
          lastAcceptedTotpStep: BigInt(step),
          totpFailureCount: 0,
          totpAuthenticatorDisabledAt: null,
          status: "ACTIVE",
        },
      });
      if (saved.count !== 1) throw new UnauthorizedException(INVALID_CREDENTIALS);
      await tx.internalRecoveryCode.deleteMany({ where: { internalUserId: user.id } });
      await tx.internalRecoveryCode.createMany({
        data: recoveryCodes.map((value) => ({
          internalUserId: user.id,
          codeHash: hash(value.replaceAll("-", "")),
        })),
      });
      await tx.internalAuditEvent.create({
        data: {
          eventType: "totp.reenrolled",
          actorType: "INTERNAL_USER",
          actorId: user.id,
          internalUserId: user.id,
        },
      });
    });
    await this.redis.del(`bartech:internal-auth:account-failures:${hash(user.emailNormalized)}`);
    return { recoveryCodes };
  }

  async currentSession(token: string) {
    const now = new Date();
    const session = await this.database.internalSession.findUnique({
      where: { tokenHash: hash(token) },
      include: { internalUser: true },
    });
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= now ||
      session.createdAt.getTime() + INTERNAL_SESSION_ABSOLUTE_MS <= now.getTime() ||
      session.internalUser.status !== "ACTIVE"
    ) {
      if (session) {
        await this.database.$transaction(async (transaction) => {
          const lockedSessionIds = await this.lockInternalSessions(
            transaction,
            session.internalUserId,
          );
          const latestSession = await transaction.internalSession.findUnique({
            where: { id: session.id },
            include: { internalUser: { select: { status: true } } },
          });
          const stillInvalid =
            !latestSession ||
            Boolean(latestSession.revokedAt) ||
            latestSession.expiresAt <= new Date() ||
            latestSession.createdAt.getTime() + INTERNAL_SESSION_ABSOLUTE_MS <= Date.now() ||
            latestSession.internalUser.status !== "ACTIVE";
          if (!stillInvalid || !lockedSessionIds.length) return;
          const sessionIds =
            latestSession?.internalUser.status === "ACTIVE"
              ? lockedSessionIds.filter((id) => id === session.id)
              : lockedSessionIds;
          if (!sessionIds.length) return;
          await transaction.internalSession.updateMany({
            where: { id: { in: sessionIds }, revokedAt: null },
            data: { revokedAt: new Date() },
          });
          await this.endServiceSessions(
            transaction,
            session.internalUserId,
            "internal_session_ended",
            sessionIds,
          );
        });
      }
      throw new UnauthorizedException("Внутренняя сессия завершена");
    }
    const absoluteExpiry = new Date(session.createdAt.getTime() + INTERNAL_SESSION_ABSOLUTE_MS);
    const expiresAt = new Date(
      Math.min(now.getTime() + INTERNAL_SESSION_IDLE_MS, absoluteExpiry.getTime()),
    );
    if (session.lastActivityAt.getTime() < now.getTime() - 60_000) {
      await this.database.internalSession.update({
        where: { id: session.id },
        data: { lastActivityAt: now, expiresAt },
      });
    }
    return {
      user: {
        id: session.internalUser.id,
        email: session.internalUser.email,
        permissions: session.internalUser.permissions,
        sessionId: session.id,
      },
      expiresAt,
    };
  }

  async logout(token: string, all = false) {
    const session = await this.database.internalSession.findUnique({
      where: { tokenHash: hash(token) },
    });
    if (!session) return;
    await this.database.$transaction(async (transaction) => {
      const sessionIds = await this.lockInternalSessions(
        transaction,
        session.internalUserId,
        all ? undefined : session.id,
      );
      await transaction.internalSession.updateMany({
        where: { id: { in: sessionIds }, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.endServiceSessions(
        transaction,
        session.internalUserId,
        "internal_session_ended",
        sessionIds,
      );
      await transaction.internalAuditEvent.create({
        data: {
          eventType: all ? "sessions.revoked_all" : "session.revoked",
          actorType: "INTERNAL_USER",
          actorId: session.internalUserId,
          internalUserId: session.internalUserId,
        },
      });
    });
  }

  private async endServiceSessions(
    transaction: Prisma.TransactionClient,
    internalUserId: string,
    reason: string,
    internalSessionIds: string[],
  ) {
    const activeSessions = await transaction.serviceSession.findMany({
      where: {
        internalUserId,
        endedAt: null,
        internalSessionId: { in: internalSessionIds },
      },
      select: { grantId: true },
    });
    if (!activeSessions.length) return;

    // Product mutations take a shared grant lock before checking their ServiceSession.
    // Taking the same locks here makes auth-session termination wait for admitted writes.
    const grantIds = [...new Set(activeSessions.map(({ grantId }) => grantId))].sort();
    for (const grantId of grantIds) {
      await transaction.$queryRaw`SELECT "id" FROM "support_access_grants" WHERE "id" = ${grantId}::uuid FOR UPDATE`;
    }

    // Re-read after acquiring the locks so sessions ended while we waited aren't audited twice.
    const sessions = await transaction.serviceSession.findMany({
      where: {
        internalUserId,
        endedAt: null,
        internalSessionId: { in: internalSessionIds },
      },
      orderBy: { id: "asc" },
      include: { grant: { select: { id: true, companyId: true, venueId: true } } },
    });
    if (!sessions.length) return;
    const endedAt = new Date();
    for (const session of sessions) {
      const endReason = session.expiresAt <= endedAt ? "expired" : reason;
      const ended = await transaction.serviceSession.updateMany({
        where: { id: session.id, endedAt: null },
        data: { endedAt, endReason },
      });
      if (ended.count !== 1) continue;
      const actorType = endReason === "expired" ? "SYSTEM" : "INTERNAL_USER";
      await transaction.auditEvent.create({
        data: {
          eventType: "service_access.ended",
          actorType,
          ...(actorType === "INTERNAL_USER" ? { internalUserId } : {}),
          serviceSessionId: session.id,
          companyId: session.grant.companyId,
          venueId: session.grant.venueId,
          entityType: "SUPPORT_ACCESS_GRANT",
          entityId: session.grant.id,
          metadata: { reason: endReason },
        },
      });
      await transaction.internalAuditEvent.create({
        data: {
          eventType: "service_access.ended",
          actorType,
          ...(actorType === "INTERNAL_USER" ? { internalUserId } : {}),
          companyId: session.grant.companyId,
          venueId: session.grant.venueId,
          serviceSessionId: session.id,
          metadata: {
            grantId: session.grant.id,
            serviceSessionId: session.id,
            ...(actorType === "INTERNAL_USER" ? { actorId: internalUserId } : {}),
            reason: endReason,
          },
        },
      });
    }
  }

  private async lockInternalSessions(
    transaction: Prisma.TransactionClient,
    internalUserId: string,
    internalSessionId?: string,
  ) {
    const rows = internalSessionId
      ? await transaction.$queryRaw<{ id: string }[]>`
          SELECT "id" FROM "internal_sessions"
          WHERE "internalUserId" = ${internalUserId}::uuid AND "id" = ${internalSessionId}::uuid
          ORDER BY "id" FOR UPDATE
        `
      : await transaction.$queryRaw<{ id: string }[]>`
          SELECT "id" FROM "internal_sessions"
          WHERE "internalUserId" = ${internalUserId}::uuid AND "revokedAt" IS NULL
          ORDER BY "id" FOR UPDATE
        `;
    return rows.map(({ id }) => id);
  }

  private async readChallenge(token: string, purpose: ChallengePurpose) {
    const challenge = await this.database.internalAuthChallenge.findUnique({
      where: { tokenHash: hash(token) },
    });
    if (
      !challenge ||
      challenge.purpose !== purpose ||
      challenge.consumedAt ||
      challenge.expiresAt <= new Date() ||
      challenge.attemptCount >= 5
    )
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    return challenge;
  }

  private async claimChallengeAttempt(token: string, purpose: ChallengePurpose) {
    const challenge = await this.readChallenge(token, purpose);
    const claimed = await this.database.internalAuthChallenge.updateMany({
      where: {
        id: challenge.id,
        purpose,
        consumedAt: null,
        expiresAt: { gt: new Date() },
        attemptCount: { lt: 5 },
      },
      data: { attemptCount: { increment: 1 } },
    });
    if (claimed.count !== 1) throw new UnauthorizedException(INVALID_CREDENTIALS);
    return challenge;
  }

  private async rejectChallenge(id: string): Promise<never> {
    const challenge = await this.database.internalAuthChallenge.findUnique({ where: { id } });
    if (challenge) {
      const user = await this.database.internalUser.findUnique({
        where: { id: challenge.internalUserId },
        select: { emailNormalized: true },
      });
      if (user) await this.recordFailure(user.emailNormalized);
    }
    if (challenge && challenge.attemptCount >= 5)
      await this.database.internalAuthChallenge.updateMany({
        where: { id, consumedAt: null },
        data: { consumedAt: new Date() },
      });
    throw new UnauthorizedException(INVALID_CREDENTIALS);
  }

  private async rejectTotpAttempt(challengeId: string, userId: string): Promise<never> {
    const now = new Date();
    await this.database.$transaction(async (tx) => {
      const challenge = await tx.internalAuthChallenge.findUnique({
        where: { id: challengeId },
      });
      if (challenge?.attemptCount && challenge.attemptCount >= 5 && !challenge.consumedAt) {
        await tx.internalAuthChallenge.updateMany({
          where: { id: challengeId, consumedAt: null },
          data: { consumedAt: now },
        });
      }

      await tx.internalUser.updateMany({
        where: {
          id: userId,
          totpAuthenticatorDisabledAt: null,
          status: "ACTIVE",
          totpFailureCount: { lt: TOTP_FAILURE_LIMIT },
        },
        data: { totpFailureCount: { increment: 1 } },
      });
      const disabled = await tx.internalUser.updateMany({
        where: {
          id: userId,
          status: "ACTIVE",
          totpAuthenticatorDisabledAt: null,
          totpFailureCount: { gte: TOTP_FAILURE_LIMIT },
        },
        data: { totpAuthenticatorDisabledAt: now },
      });
      if (disabled.count === 1) {
        await tx.internalAuditEvent.create({
          data: {
            eventType: "totp.authenticator_disabled_after_failed_attempts",
            actorType: "SYSTEM",
            internalUserId: userId,
            metadata: { consecutiveFailures: TOTP_FAILURE_LIMIT },
          },
        });
      }
    });
    await this.recordFailure(
      (
        await this.database.internalUser.findUniqueOrThrow({
          where: { id: userId },
          select: { emailNormalized: true },
        })
      ).emailNormalized,
    );
    throw new UnauthorizedException(INVALID_CREDENTIALS);
  }

  private async recordFailure(emailNormalized: string): Promise<void> {
    const key = `bartech:internal-auth:account-failures:${hash(emailNormalized)}`;
    await this.redis.eval(
      "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],3600) end; return n",
      1,
      key,
    );
  }

  private async waitForAccountThrottle(emailNormalized: string): Promise<void> {
    const failures = await this.redis.get(
      `bartech:internal-auth:account-failures:${hash(emailNormalized)}`,
    );
    const delay = Math.min(Number(failures ?? 0) * 200, 2_000);
    if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
  }
}
