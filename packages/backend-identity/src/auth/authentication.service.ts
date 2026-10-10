import { randomBytes } from "node:crypto";
import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import argon2 from "argon2";
import { DATABASE_CLIENT, PrismaClient, REDIS_CLIENT } from "@bartech/database";
import type { Redis } from "ioredis";
import { OrganizationsService } from "@bartech/backend-organizations";
import { sessionTokenHash, type AuthenticatedUser } from "./session.guard.js";
import { EmailOutboxService } from "../outbox/email-outbox.service.js";
import { IdentityChallengeService } from "./identity-challenge.service.js";
import {
  LOGIN_BLOCKED_MESSAGE,
  INVALID_LOGIN_MESSAGE,
  LOGIN_WINDOW_SECONDS,
  SESSION_IDLE_MS,
  normalizeEmail,
  normalizePassword,
  redisKey,
  type TokenSession,
} from "./identity.helpers.js";

@Injectable()
export class AuthenticationService {
  private readonly dummyPasswordHash: Promise<string>;

  constructor(
    @Inject(DATABASE_CLIENT) private readonly database: PrismaClient,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly organizations: OrganizationsService,
    private readonly outbox: EmailOutboxService,
    private readonly challenges: IdentityChallengeService,
  ) {
    this.dummyPasswordHash = argon2.hash(randomBytes(24), { type: argon2.argon2id });
  }

  async login(
    emailInput: string,
    password: string,
  ): Promise<{ user: AuthenticatedUser; session: TokenSession }> {
    const emailNormalized = normalizeEmail(emailInput);
    const blocked = await this.redis.get(redisKey("login-block", emailNormalized));
    if (blocked) throw new HttpException(LOGIN_BLOCKED_MESSAGE, HttpStatus.TOO_MANY_REQUESTS);

    const user = await this.database.user.findUnique({
      where: { emailNormalized },
      include: { profile: true },
    });
    const passwordHash = user?.passwordHash ?? (await this.dummyPasswordHash);
    const valid = await argon2.verify(passwordHash, password).catch(() => false);
    if (!user || !valid) {
      const key = redisKey("login-failures", emailNormalized);
      const failures = await this.redis.incr(key);
      if (failures === 1) await this.redis.expire(key, LOGIN_WINDOW_SECONDS);
      if (failures >= 5) {
        await this.redis.set(
          redisKey("login-block", emailNormalized),
          "1",
          "EX",
          LOGIN_WINDOW_SECONDS,
        );
        await this.redis.del(key);
        if (user) {
          await this.database.$transaction((transaction) =>
            this.outbox.enqueue(transaction, "identity.login_limited", {
              to: user.email,
              subject: "Вход в IndieBar временно ограничен",
              text: "За 15 минут было допущено пять неудачных попыток входа. Вход временно ограничен. Если это были не вы, восстановите пароль.",
            }),
          );
        }
        throw new HttpException(LOGIN_BLOCKED_MESSAGE, HttpStatus.TOO_MANY_REQUESTS);
      }
      throw new UnauthorizedException(INVALID_LOGIN_MESSAGE);
    }

    await this.redis.del(
      redisKey("login-failures", emailNormalized),
      redisKey("login-block", emailNormalized),
    );
    const session = await this.createSession(user.id);
    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.profile?.fullName ?? "",
        sessionId: session.id,
      },
      session: { token: session.token, expiresAt: session.expiresAt },
    };
  }

  async logout(user: AuthenticatedUser): Promise<void> {
    await this.database.session.updateMany({
      where: { id: user.sessionId, userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async logoutAll(user: AuthenticatedUser): Promise<void> {
    await this.database.session.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async requestPasswordRecovery(emailInput: string): Promise<{ accepted: true }> {
    const emailNormalized = normalizeEmail(emailInput);
    const canSend = await this.challenges.reserveEmailDelivery(emailNormalized, true);
    const user = await this.database.user.findUnique({
      where: { emailNormalized },
      select: { id: true, email: true },
    });
    if (user && canSend) {
      const code = this.challenges.createCode();
      await this.database.$transaction(async (transaction) => {
        await transaction.emailChallenge.updateMany({
          where: { emailNormalized, purpose: "PASSWORD_RESET", consumedAt: null },
          data: { consumedAt: new Date() },
        });
        await this.challenges.createChallenge(transaction, {
          emailNormalized,
          purpose: "PASSWORD_RESET",
          code,
          userId: user.id,
        });
        await this.outbox.enqueue(transaction, "identity.password_recovery", {
          to: user.email,
          subject: "Код восстановления пароля IndieBar",
          text: `Код восстановления: ${code}. Он действует 10 минут. Если вы не запрашивали восстановление, проигнорируйте это письмо.`,
        });
      });
    }
    return { accepted: true };
  }

  async completePasswordRecovery(
    emailInput: string,
    code: string,
    newPassword: string,
  ): Promise<void> {
    const emailNormalized = normalizeEmail(emailInput);
    normalizePassword(newPassword, emailInput);
    const challenge = await this.database.emailChallenge.findFirst({
      where: { emailNormalized, purpose: "PASSWORD_RESET", consumedAt: null },
      include: { user: true },
      orderBy: { createdAt: "desc" },
    });
    if (!challenge?.user || !(await this.challenges.verifyCode(challenge, code))) {
      throw new UnauthorizedException("Код неверный или срок его действия истёк");
    }

    const passwordHash = await argon2.hash(newPassword, { type: argon2.argon2id });
    const now = new Date();
    await this.database.$transaction(async (transaction) => {
      const consumed = await transaction.emailChallenge.updateMany({
        where: {
          id: challenge.id,
          consumedAt: null,
          expiresAt: { gt: now },
          attemptCount: { lt: 5 },
        },
        data: { consumedAt: now },
      });
      if (consumed.count !== 1)
        throw new UnauthorizedException("Код неверный или срок его действия истёк");
      await transaction.user.update({ where: { id: challenge.userId! }, data: { passwordHash } });
      await transaction.session.updateMany({
        where: { userId: challenge.userId!, revokedAt: null },
        data: { revokedAt: now },
      });
      await this.outbox.enqueue(transaction, "identity.password_changed", {
        to: challenge.user!.email,
        subject: "Пароль IndieBar изменён",
        text: "Пароль вашего аккаунта IndieBar изменён после восстановления. Если это сделали не вы, обратитесь в поддержку.",
      });
    });
  }

  async changePassword(
    user: AuthenticatedUser,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    normalizePassword(newPassword, user.email, user.fullName);
    const record = await this.database.user.findUnique({ where: { id: user.id } });
    if (
      !record ||
      !(await argon2.verify(record.passwordHash, currentPassword).catch(() => false))
    ) {
      throw new UnauthorizedException("Текущий пароль неверен");
    }
    const passwordHash = await argon2.hash(newPassword, { type: argon2.argon2id });
    const now = new Date();
    await this.database.$transaction(async (transaction) => {
      await transaction.user.update({ where: { id: user.id }, data: { passwordHash } });
      await transaction.session.updateMany({
        where: { userId: user.id, id: { not: user.sessionId }, revokedAt: null },
        data: { revokedAt: now },
      });
      await this.outbox.enqueue(transaction, "identity.password_changed", {
        to: record.email,
        subject: "Пароль IndieBar изменён",
        text: "Пароль вашего аккаунта IndieBar был изменён. Если это сделали не вы, восстановите доступ и обратитесь в поддержку.",
      });
    });
  }

  async getCurrentUser(user: AuthenticatedUser) {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      workplaces: await this.organizations.listWorkspacesForUser(user.id),
      companies: await this.organizations.listEmptyCompaniesForUser(user.id),
    };
  }

  private async createSession(userId: string) {
    const token = randomBytes(32).toString("base64url");
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_IDLE_MS);
    const session = await this.database.session.create({
      data: {
        userId,
        tokenHash: sessionTokenHash(token),
        createdAt: now,
        lastActivityAt: now,
        expiresAt,
      },
    });
    return { ...session, token };
  }
}
