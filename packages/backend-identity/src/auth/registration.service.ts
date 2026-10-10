import { BadRequestException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { DATABASE_CLIENT, PrismaClient } from "@bartech/database";
import { normalizeName, OrganizationsService } from "@bartech/backend-organizations";
import { sessionTokenHash } from "./session.guard.js";
import { EmailOutboxService } from "../outbox/email-outbox.service.js";
import { IdentityChallengeService } from "./identity-challenge.service.js";
import { randomBytes } from "node:crypto";
import argon2 from "argon2";
import {
  REGISTRATION_TTL_MS,
  SESSION_IDLE_MS,
  normalizeEmail,
  normalizePassword,
  type TokenSession,
} from "./identity.helpers.js";
import type { RegistrationStartDto } from "./identity.dto.js";

@Injectable()
export class RegistrationService {
  constructor(
    @Inject(DATABASE_CLIENT) private readonly database: PrismaClient,
    private readonly organizations: OrganizationsService,
    private readonly outbox: EmailOutboxService,
    private readonly challenges: IdentityChallengeService,
  ) {}

  async startRegistration(
    input: RegistrationStartDto,
  ): Promise<{ accepted: true; registrationToken?: string }> {
    const email = input.email.trim();
    const emailNormalized = normalizeEmail(email);
    const password = normalizePassword(input.password, email, input.fullName);
    const fullName = normalizeName(input.fullName);
    const companyName = normalizeName(input.companyName);
    const venueName = normalizeName(input.venueName);
    if (!fullName || !companyName || !venueName)
      throw new BadRequestException("Заполните имя, компанию и заведение");

    const existingUser = await this.database.user.findUnique({
      where: { emailNormalized },
      select: { id: true },
    });
    if (existingUser) return { accepted: true };
    await this.challenges.reserveEmailDelivery(emailNormalized);

    const registrationToken = randomBytes(32).toString("base64url");
    const tokenHash = sessionTokenHash(registrationToken);
    const code = this.challenges.createCode();
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    const expiresAt = new Date(Date.now() + REGISTRATION_TTL_MS);

    await this.database.$transaction(async (transaction) => {
      await transaction.registrationAttempt.deleteMany({ where: { emailNormalized } });
      const attempt = await transaction.registrationAttempt.create({
        data: {
          email,
          emailNormalized,
          fullName,
          passwordHash,
          companyName,
          companyNameNormalized: companyName.toLocaleLowerCase("ru-RU"),
          venueName,
          venueNameNormalized: venueName.toLocaleLowerCase("ru-RU").replaceAll("ё", "е"),
          tokenHash,
          expiresAt,
        },
      });
      await this.challenges.createChallenge(transaction, {
        emailNormalized,
        purpose: "EMAIL_VERIFICATION",
        code,
        registrationAttemptId: attempt.id,
      });
      await this.outbox.enqueue(transaction, "identity.email_verification", {
        to: email,
        subject: "Подтвердите адрес электронной почты в IndieBar",
        text: `Код подтверждения: ${code}. Он действует 10 минут. Если вы не регистрировались в IndieBar, проигнорируйте это письмо.`,
      });
    });

    return { accepted: true, registrationToken };
  }

  async resendRegistrationCode(registrationToken: string): Promise<void> {
    const tokenHash = sessionTokenHash(registrationToken);
    const attempt = await this.database.registrationAttempt.findUnique({ where: { tokenHash } });
    if (!attempt || attempt.expiresAt <= new Date())
      throw new UnauthorizedException("Регистрация истекла. Начните заново");
    await this.challenges.reserveEmailDelivery(attempt.emailNormalized);
    const code = this.challenges.createCode();
    await this.database.$transaction(async (transaction) => {
      await transaction.emailChallenge.updateMany({
        where: {
          emailNormalized: attempt.emailNormalized,
          purpose: "EMAIL_VERIFICATION",
          consumedAt: null,
        },
        data: { consumedAt: new Date() },
      });
      await this.challenges.createChallenge(transaction, {
        emailNormalized: attempt.emailNormalized,
        purpose: "EMAIL_VERIFICATION",
        code,
        registrationAttemptId: attempt.id,
      });
      await this.outbox.enqueue(transaction, "identity.email_verification", {
        to: attempt.email,
        subject: "Новый код подтверждения IndieBar",
        text: `Код подтверждения: ${code}. Он действует 10 минут. Предыдущий код больше не работает.`,
      });
    });
  }

  async verifyRegistration(registrationToken: string, code: string) {
    const attempt = await this.database.registrationAttempt.findUnique({
      where: { tokenHash: sessionTokenHash(registrationToken) },
      include: {
        challenges: {
          where: { purpose: "EMAIL_VERIFICATION", consumedAt: null },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });
    if (!attempt || attempt.expiresAt <= new Date())
      throw new UnauthorizedException("Регистрация истекла. Начните заново");
    const challenge = attempt.challenges[0];
    if (!(await this.challenges.verifyCode(challenge, code)))
      throw new UnauthorizedException("Код неверный или срок его действия истёк");

    const token = randomBytes(32).toString("base64url");
    const now = new Date();
    const sessionExpiry = new Date(now.getTime() + SESSION_IDLE_MS);
    const result = await this.database.$transaction(async (transaction) => {
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

      const user = await transaction.user.create({
        data: {
          email: attempt.email,
          emailNormalized: attempt.emailNormalized,
          passwordHash: attempt.passwordHash,
          emailVerifiedAt: now,
          profile: { create: { fullName: attempt.fullName } },
        },
      });
      const workspace = await this.organizations.createInTransaction(transaction, user.id, {
        companyName: attempt.companyName,
        venueName: attempt.venueName,
      });
      await transaction.session.create({
        data: {
          userId: user.id,
          tokenHash: sessionTokenHash(token),
          lastActivityAt: now,
          expiresAt: sessionExpiry,
        },
      });
      await transaction.registrationAttempt.delete({ where: { id: attempt.id } });
      return {
        user: { id: user.id, email: user.email, fullName: attempt.fullName },
        company: { id: workspace.company.id, name: workspace.company.name },
        venue: { id: workspace.venue.id, name: workspace.venue.name },
      };
    });
    return { ...result, session: { token, expiresAt: sessionExpiry } satisfies TokenSession };
  }
}
