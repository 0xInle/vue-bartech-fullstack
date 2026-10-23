import { randomBytes } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { DATABASE_CLIENT, Prisma, PrismaClient } from "@bartech/database";
import argon2 from "argon2";
import { normalizeName, OrganizationInvitationsService } from "@bartech/backend-organizations";
import { sessionTokenHash, type AuthenticatedUser } from "./session.guard.js";
import { EmailOutboxService } from "../outbox/email-outbox.service.js";
import { IdentityChallengeService } from "./identity-challenge.service.js";
import {
  CODE_TTL_MS,
  SESSION_IDLE_MS,
  normalizeEmail,
  normalizePassword,
  publicInvitation,
  type TokenSession,
} from "./identity.helpers.js";

@Injectable()
export class InvitationAcceptanceService {
  constructor(
    @Inject(DATABASE_CLIENT) private readonly database: PrismaClient,
    private readonly organizationInvitations: OrganizationInvitationsService,
    private readonly outbox: EmailOutboxService,
    private readonly challenges: IdentityChallengeService,
  ) {}

  async getInvitation(token: string) {
    return this.organizationInvitations.findInvitationByToken(sessionTokenHash(token));
  }

  async getInvitationAcceptance(token: string) {
    const acceptance = await this.findAcceptanceSession(token);
    const now = new Date();
    const currentInvitation = await this.database.invitation.findFirst({
      where: {
        id: acceptance.invitationId,
        status: "IN_PROGRESS",
        acceptanceSession: { is: { id: acceptance.id, expiresAt: { gt: now } } },
      },
      include: { company: true, venue: true },
    });
    if (!currentInvitation) {
      throw new UnauthorizedException("Приглашение больше недоступно");
    }
    return {
      invitation: publicInvitation(currentInvitation),
      registrationStarted: Boolean(acceptance.fullName && acceptance.passwordHash),
    };
  }

  async acceptInvitation(
    token: string,
    existingAcceptanceToken?: string,
    authenticatedSessionToken?: string,
  ) {
    const tokenHash = sessionTokenHash(token);
    const acceptanceToken = existingAcceptanceToken ?? randomBytes(32).toString("base64url");
    const now = new Date();
    const result = await this.database.$transaction(async (transaction) => {
      const invitation = await transaction.invitation.findUnique({
        where: { tokenHash },
        include: { company: true, venue: true, acceptanceSession: true },
      });
      if (!invitation || invitation.status === "CLOSED" || invitation.status === "COMPLETED") {
        return { expired: true as const };
      }
      const invitationExpired =
        invitation.status === "ACTIVE"
          ? invitation.expiresAt <= now
          : !invitation.acceptanceSession || invitation.acceptanceSession.expiresAt <= now;
      if (invitationExpired) {
        const expired = await transaction.invitation.updateMany({
          where: {
            id: invitation.id,
            status: invitation.status,
            ...(invitation.status === "ACTIVE"
              ? { expiresAt: { lte: now } }
              : {
                  OR: [
                    { acceptanceSession: { is: null } },
                    { acceptanceSession: { is: { expiresAt: { lte: now } } } },
                  ],
                }),
          },
          data: { status: "CLOSED", closedAt: now },
        });
        if (expired.count === 1) {
          await transaction.auditEvent.create({
            data: {
              eventType: "invitation.expired",
              actorType: "SYSTEM",
              companyId: invitation.companyId,
              venueId: invitation.venueId,
              entityType: "invitation",
              entityId: invitation.id,
            },
          });
          await transaction.invitationAcceptanceSession.deleteMany({
            where: { invitationId: invitation.id },
          });
        }
        return { expired: true as const };
      }
      if (authenticatedSessionToken) {
        const authenticatedSession = await transaction.session.findUnique({
          where: { tokenHash: sessionTokenHash(authenticatedSessionToken) },
          select: {
            createdAt: true,
            expiresAt: true,
            revokedAt: true,
            user: { select: { emailNormalized: true } },
          },
        });
        if (
          authenticatedSession &&
          !authenticatedSession.revokedAt &&
          authenticatedSession.expiresAt > now &&
          authenticatedSession.createdAt.getTime() + 90 * 24 * 60 * 60 * 1000 > now.getTime() &&
          authenticatedSession.user.emailNormalized !== invitation.emailNormalized
        ) {
          throw new ForbiddenException(
            "Приглашение отправлено на другой адрес. Войдите в нужный аккаунт и откройте ссылку снова",
          );
        }
      }
      if (invitation.status === "IN_PROGRESS") {
        if (
          !existingAcceptanceToken ||
          invitation.acceptanceSession?.tokenHash !== sessionTokenHash(existingAcceptanceToken)
        ) {
          throw new UnauthorizedException("Принятие приглашения уже начато в другом браузере");
        }
        return { token: existingAcceptanceToken, invitation: publicInvitation(invitation) };
      }
      if (invitation.status !== "ACTIVE") {
        throw new UnauthorizedException("Это приглашение уже использовано");
      }

      const existingUser = await transaction.user.findUnique({
        where: { emailNormalized: invitation.emailNormalized },
        select: { id: true },
      });
      if (!existingUser) {
        await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${invitation.emailNormalized}, 721804))`;
        const activeRegistration = await transaction.invitationAcceptanceSession.findFirst({
          where: {
            emailNormalized: invitation.emailNormalized,
            userId: null,
            expiresAt: { gt: now },
          },
        });
        if (activeRegistration) {
          throw new ConflictException(
            "Сначала завершите или отмените регистрацию по другому приглашению",
          );
        }
      }

      const accepted = await transaction.invitation.updateMany({
        where: { id: invitation.id, status: "ACTIVE", expiresAt: { gt: now } },
        data: { status: "IN_PROGRESS" },
      });
      if (accepted.count !== 1) {
        throw new ConflictException("Приглашение уже принято или закрыто");
      }
      await transaction.invitationAcceptanceSession.create({
        data: {
          invitationId: invitation.id,
          tokenHash: sessionTokenHash(acceptanceToken),
          emailNormalized: invitation.emailNormalized,
          expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
        },
      });
      return { token: acceptanceToken, invitation: publicInvitation(invitation) };
    });
    if ("expired" in result) {
      throw new UnauthorizedException("Приглашение недействительно или срок его действия истёк");
    }
    return result;
  }

  async declineInvitation(token: string, authenticatedSessionToken?: string): Promise<void> {
    const now = new Date();
    await this.database.$transaction(async (transaction) => {
      const invitation = await transaction.invitation.findUnique({
        where: { tokenHash: sessionTokenHash(token) },
        select: { id: true, emailNormalized: true, status: true, expiresAt: true },
      });
      if (!invitation || invitation.status !== "ACTIVE" || invitation.expiresAt <= now) {
        throw new UnauthorizedException("Приглашение недействительно или уже закрыто");
      }

      if (authenticatedSessionToken) {
        const session = await transaction.session.findUnique({
          where: { tokenHash: sessionTokenHash(authenticatedSessionToken) },
          select: {
            createdAt: true,
            expiresAt: true,
            revokedAt: true,
            user: { select: { emailNormalized: true } },
          },
        });
        const sessionIsValid =
          session &&
          !session.revokedAt &&
          session.expiresAt > now &&
          session.createdAt.getTime() + 90 * 24 * 60 * 60 * 1000 > now.getTime();

        if (sessionIsValid && session.user.emailNormalized !== invitation.emailNormalized) {
          throw new ForbiddenException(
            "Приглашение отправлено на другой адрес. Войдите в нужный аккаунт, чтобы продолжить",
          );
        }
      }

      const result = await transaction.invitation.updateMany({
        where: {
          id: invitation.id,
          status: "ACTIVE",
          expiresAt: { gt: now },
        },
        data: { status: "CLOSED", closedAt: now },
      });
      if (result.count !== 1) {
        throw new UnauthorizedException("Приглашение недействительно или уже закрыто");
      }
    });
  }

  async cancelInvitationAcceptance(acceptanceToken: string): Promise<void> {
    const acceptance = await this.findAcceptanceSession(acceptanceToken);
    const now = new Date();
    await this.database.$transaction(async (transaction) => {
      const cancelled = await transaction.invitation.updateMany({
        where: {
          id: acceptance.invitationId,
          status: "IN_PROGRESS",
          acceptanceSession: {
            is: {
              id: acceptance.id,
              tokenHash: sessionTokenHash(acceptanceToken),
              expiresAt: { gt: now },
            },
          },
        },
        data: { status: "CLOSED", closedAt: now },
      });
      if (cancelled.count !== 1) {
        throw new ConflictException("Присоединение уже завершено, отменено или истекло");
      }

      const deletedSession = await transaction.invitationAcceptanceSession.deleteMany({
        where: { id: acceptance.id, tokenHash: sessionTokenHash(acceptanceToken) },
      });
      if (deletedSession.count !== 1) {
        throw new ConflictException("Сессия присоединения уже завершена, отменена или истекла");
      }
    });
  }

  async beginInvitationRegistration(
    acceptanceToken: string,
    fullNameInput: string,
    passwordInput: string,
  ): Promise<void> {
    const acceptance = await this.findAcceptanceSession(acceptanceToken);
    const fullName = normalizeName(fullNameInput);
    if (!fullName) throw new BadRequestException("Укажите имя и фамилию");
    normalizePassword(passwordInput, acceptance.emailNormalized, fullName);
    if (
      await this.database.user.findUnique({
        where: { emailNormalized: acceptance.emailNormalized },
        select: { id: true },
      })
    ) {
      throw new ConflictException("Аккаунт уже существует. Войдите с адресом приглашения");
    }
    await this.challenges.reserveEmailDelivery(acceptance.emailNormalized);
    const passwordHash = await argon2.hash(passwordInput, { type: argon2.argon2id });
    const code = this.challenges.createCode();
    await this.database.$transaction(async (transaction) => {
      const stillActive = await transaction.invitationAcceptanceSession.updateMany({
        where: {
          id: acceptance.id,
          expiresAt: { gt: new Date() },
          invitation: { status: "IN_PROGRESS" },
        },
        data: { fullName, passwordHash },
      });
      if (stillActive.count !== 1) {
        throw new UnauthorizedException("Сессия приглашения истекла. Запросите новую ссылку");
      }
      await transaction.emailChallenge.updateMany({
        where: {
          invitationSessionId: acceptance.id,
          purpose: "INVITATION_EMAIL_VERIFICATION",
          consumedAt: null,
        },
        data: { consumedAt: new Date() },
      });
      await transaction.emailChallenge.create({
        data: {
          emailNormalized: acceptance.emailNormalized,
          purpose: "INVITATION_EMAIL_VERIFICATION",
          codeHash: await argon2.hash(code, { type: argon2.argon2id }),
          expiresAt: new Date(Date.now() + CODE_TTL_MS),
          invitationSessionId: acceptance.id,
        },
      });
      await this.outbox.enqueue(transaction, "identity.invitation_email_verification", {
        to: acceptance.invitation.email,
        subject: "Подтвердите адрес для приглашения в IndieBar",
        text: `Код подтверждения: ${code}. Он действует 10 минут.`,
      });
    });
  }

  async resendInvitationRegistrationCode(acceptanceToken: string): Promise<void> {
    const acceptance = await this.findAcceptanceSession(acceptanceToken);
    await this.challenges.reserveEmailDelivery(acceptance.emailNormalized);
    const code = this.challenges.createCode();
    await this.database.$transaction(async (transaction) => {
      const activeSession = await transaction.invitationAcceptanceSession.findFirst({
        where: {
          id: acceptance.id,
          tokenHash: sessionTokenHash(acceptanceToken),
          expiresAt: { gt: new Date() },
          invitation: { status: "IN_PROGRESS" },
        },
        include: { invitation: true },
      });
      if (!activeSession) {
        throw new UnauthorizedException("Сессия приглашения истекла. Запросите новую ссылку");
      }
      await transaction.emailChallenge.updateMany({
        where: {
          invitationSessionId: acceptance.id,
          purpose: "INVITATION_EMAIL_VERIFICATION",
          consumedAt: null,
        },
        data: { consumedAt: new Date() },
      });
      await transaction.emailChallenge.create({
        data: {
          emailNormalized: acceptance.emailNormalized,
          purpose: "INVITATION_EMAIL_VERIFICATION",
          codeHash: await argon2.hash(code, { type: argon2.argon2id }),
          expiresAt: new Date(Date.now() + CODE_TTL_MS),
          invitationSessionId: acceptance.id,
        },
      });
      await this.outbox.enqueue(transaction, "identity.invitation_email_verification", {
        to: acceptance.invitation.email,
        subject: "Новый код подтверждения IndieBar",
        text: `Код подтверждения: ${code}. Он действует 10 минут. Предыдущий код больше не работает.`,
      });
    });
  }

  async completeInvitationRegistration(
    acceptanceToken: string,
    code: string,
    venueNameInput?: string,
  ) {
    const acceptance = await this.findAcceptanceSession(acceptanceToken);
    const createsVenue = acceptance.invitation.purpose === "CREATE_VENUE_AS_BAR_MANAGER";
    const venueName = venueNameInput === undefined ? "" : normalizeName(venueNameInput);
    if (createsVenue && (!venueName || venueName.length > 120)) {
      throw new BadRequestException("Укажите название заведения длиной не более 120 символов");
    }
    const challenge = await this.database.emailChallenge.findFirst({
      where: {
        invitationSessionId: acceptance.id,
        purpose: "INVITATION_EMAIL_VERIFICATION",
        consumedAt: null,
      },
      orderBy: { createdAt: "desc" },
    });
    if (!(await this.challenges.verifyCode(challenge ?? undefined, code))) {
      throw new UnauthorizedException("Код неверный или срок его действия истёк");
    }

    const token = randomBytes(32).toString("base64url");
    const now = new Date();
    const sessionExpiry = new Date(now.getTime() + SESSION_IDLE_MS);
    let result:
      | { expired: true }
      | {
          user: { id: string; email: string; fullName: string };
          companyId: string;
          venueId: string | null;
        };
    try {
      result = await this.database.$transaction(async (transaction) => {
        await this.organizationInvitations.lockInvitationTargetInTransaction(
          transaction,
          acceptance.emailNormalized,
          acceptance.invitation.companyId,
        );
        const now = new Date();
        const activeSession = await transaction.invitationAcceptanceSession.findFirst({
          where: {
            id: acceptance.id,
            tokenHash: sessionTokenHash(acceptanceToken),
            expiresAt: { gt: now },
            invitation: { status: "IN_PROGRESS" },
          },
          include: { invitation: true },
        });
        if (!activeSession || !activeSession.fullName || !activeSession.passwordHash) {
          await this.closeExpiredAcceptanceSessionInTransaction(transaction, {
            invitationId: acceptance.invitationId,
            acceptanceSessionId: acceptance.id,
            companyId: acceptance.invitation.companyId,
            venueId: acceptance.invitation.venueId,
            now,
          });
          return { expired: true as const };
        }
        const isChefInvitation = activeSession.invitation.purpose === "JOIN_COMPANY_AS_CHEF";
        const createsVenue = activeSession.invitation.purpose === "CREATE_VENUE_AS_BAR_MANAGER";
        if (
          createsVenue &&
          (activeSession.invitation.venueId || activeSession.invitation.role !== "BAR_MANAGER")
        ) {
          throw new ConflictException("Цель приглашения указана неверно");
        }
        if (
          !isChefInvitation &&
          !createsVenue &&
          (!activeSession.invitation.venueId || !activeSession.invitation.role)
        ) {
          throw new ConflictException("Цель приглашения указана неверно");
        }
        const consumed = await transaction.emailChallenge.updateMany({
          where: {
            id: challenge!.id,
            consumedAt: null,
            expiresAt: { gt: now },
            attemptCount: { lt: 5 },
          },
          data: { consumedAt: now },
        });
        if (consumed.count !== 1) {
          throw new UnauthorizedException("Код неверный или срок его действия истёк");
        }
        const completedInvitation = await transaction.invitation.updateMany({
          where: {
            id: activeSession.invitationId,
            status: "IN_PROGRESS",
            acceptanceSession: { is: { id: activeSession.id, expiresAt: { gt: now } } },
          },
          data: { status: "COMPLETED", completedAt: now },
        });
        if (completedInvitation.count !== 1) {
          throw new ConflictException("Присоединение уже завершено или отменено");
        }
        const user = await transaction.user.create({
          data: {
            email: activeSession.invitation.email,
            emailNormalized: activeSession.emailNormalized,
            passwordHash: activeSession.passwordHash,
            emailVerifiedAt: now,
            profile: { create: { fullName: activeSession.fullName! } },
          },
        });
        await transaction.$queryRaw`SELECT lock_company_membership_pair(${user.id}::UUID, ${activeSession.invitation.companyId}::UUID)`;
        await transaction.companyMembership.create({
          data: {
            companyId: activeSession.invitation.companyId,
            userId: user.id,
            ...(isChefInvitation ? { companyRole: "CHEF_BARTENDER" as const } : {}),
          },
        });
        let venueId = activeSession.invitation.venueId;
        if (isChefInvitation) {
          await this.organizationInvitations.closeConflictingInvitationsInTransaction(transaction, {
            companyId: activeSession.invitation.companyId,
            emailNormalized: activeSession.emailNormalized,
            completedInvitationId: activeSession.invitationId,
            actorId: user.id,
          });
          const venue = await transaction.venue.findFirst({
            where: { companyId: activeSession.invitation.companyId, status: "ACTIVE" },
            orderBy: { createdAt: "asc" },
            select: { id: true },
          });
          if (!venue) throw new ConflictException("В компании нет доступного заведения");
          venueId = venue.id;
        } else if (createsVenue) {
          venueId = (
            await this.organizationInvitations.createInvitedVenueInTransaction(transaction, {
              companyId: activeSession.invitation.companyId,
              userId: user.id,
              name: venueName,
            })
          ).id;
        } else {
          await transaction.venueMembership.create({
            data: {
              companyId: activeSession.invitation.companyId,
              venueId: activeSession.invitation.venueId!,
              userId: user.id,
              role: activeSession.invitation.role!,
              startedOn: dateOnly(now),
              rolePeriods: {
                create: { role: activeSession.invitation.role!, startedOn: dateOnly(now) },
              },
            },
          });
        }
        await transaction.session.create({
          data: {
            userId: user.id,
            tokenHash: sessionTokenHash(token),
            createdAt: now,
            lastActivityAt: now,
            expiresAt: sessionExpiry,
          },
        });
        await transaction.auditEvent.create({
          data: {
            eventType: "invitation.completed",
            actorType: "USER",
            actorId: user.id,
            companyId: activeSession.invitation.companyId,
            venueId,
            entityType: "invitation",
            entityId: activeSession.invitationId,
            metadata: {
              purpose: activeSession.invitation.purpose,
              role: isChefInvitation ? "CHEF_BARTENDER" : activeSession.invitation.role,
            },
          },
        });
        await transaction.invitationAcceptanceSession.delete({ where: { id: activeSession.id } });
        return {
          user: { id: user.id, email: user.email, fullName: activeSession.fullName },
          companyId: activeSession.invitation.companyId,
          venueId,
        };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        if (createsVenue && isVenueNameConflict(error)) {
          throw new ConflictException("В компании уже есть заведение с таким названием");
        }
        await this.closeInvitationAfterConflict(acceptance.invitationId);
        throw new ConflictException("Учётная запись или членство уже существуют");
      }
      throw error;
    }
    if ("expired" in result) {
      throw new UnauthorizedException("Сессия приглашения истекла. Запросите новую ссылку");
    }
    if (!result.venueId) throw new ConflictException("Для перехода в компанию нет заведения");
    return {
      ...result,
      redirectTo: `/app/companies/${result.companyId}/venues/${result.venueId}`,
      session: { token, expiresAt: sessionExpiry } satisfies TokenSession,
    };
  }

  async completeInvitationForUser(
    acceptanceToken: string,
    user: AuthenticatedUser,
    venueNameInput?: string,
  ) {
    const acceptance = await this.findAcceptanceSession(acceptanceToken);
    if (acceptance.emailNormalized !== normalizeEmail(user.email)) {
      throw new ForbiddenException(
        "Войдите с адресом электронной почты, на который пришло приглашение",
      );
    }
    const createsVenue = acceptance.invitation.purpose === "CREATE_VENUE_AS_BAR_MANAGER";
    const venueName = venueNameInput === undefined ? "" : normalizeName(venueNameInput);
    if (createsVenue && (!venueName || venueName.length > 120)) {
      throw new BadRequestException("Укажите название заведения длиной не более 120 символов");
    }
    let result: { expired: true } | { companyId: string; venueId: string };
    let closeOnMembershipConflict = false;
    try {
      result = await this.database.$transaction(async (transaction) => {
        await this.organizationInvitations.lockInvitationTargetInTransaction(
          transaction,
          acceptance.emailNormalized,
          acceptance.invitation.companyId,
        );
        const now = new Date();
        const activeSession = await transaction.invitationAcceptanceSession.findFirst({
          where: {
            id: acceptance.id,
            tokenHash: sessionTokenHash(acceptanceToken),
            expiresAt: { gt: now },
            invitation: { status: "IN_PROGRESS" },
          },
          include: { invitation: true },
        });
        if (!activeSession) {
          await this.closeExpiredAcceptanceSessionInTransaction(transaction, {
            invitationId: acceptance.invitationId,
            acceptanceSessionId: acceptance.id,
            companyId: acceptance.invitation.companyId,
            venueId: acceptance.invitation.venueId,
            now,
          });
          return { expired: true as const };
        }
        const isChefInvitation = activeSession.invitation.purpose === "JOIN_COMPANY_AS_CHEF";
        const createsVenue = activeSession.invitation.purpose === "CREATE_VENUE_AS_BAR_MANAGER";
        if (
          createsVenue &&
          (activeSession.invitation.venueId || activeSession.invitation.role !== "BAR_MANAGER")
        ) {
          throw new ConflictException("Цель приглашения указана неверно");
        }
        if (
          !isChefInvitation &&
          !createsVenue &&
          (!activeSession.invitation.venueId || !activeSession.invitation.role)
        ) {
          throw new ConflictException("Цель приглашения указана неверно");
        }
        if (isChefInvitation) {
          await transaction.$queryRaw`SELECT lock_company_membership_pair(${user.id}::UUID, ${activeSession.invitation.companyId}::UUID)`;
          const localMembership = await transaction.venueMembership.findFirst({
            where: {
              userId: user.id,
              companyId: activeSession.invitation.companyId,
              OR: [{ endedOn: null }, { endedOn: { gt: dateOnly(now) } }],
            },
            select: { id: true },
          });
          if (localMembership) {
            closeOnMembershipConflict = true;
            throw new ConflictException(
              "В этой компании у вас уже есть локальная должность. Попросите пригласившего проверить совместимость ролей.",
            );
          }
        }
        const companyMembership = await transaction.companyMembership.findUnique({
          where: {
            userId_companyId: {
              userId: user.id,
              companyId: activeSession.invitation.companyId,
            },
          },
        });
        let venueId = activeSession.invitation.venueId;
        if (isChefInvitation && companyMembership?.companyRole === "CHEF_BARTENDER") {
          closeOnMembershipConflict = true;
          throw new ConflictException("Вы уже являетесь шеф-барменом этой компании");
        }
        if (
          !isChefInvitation &&
          !createsVenue &&
          (await transaction.venueMembership.findFirst({
            where: {
              userId: user.id,
              venueId: activeSession.invitation.venueId!,
              OR: [{ endedOn: null }, { endedOn: { gt: dateOnly(now) } }],
            },
          }))
        ) {
          closeOnMembershipConflict = true;
          throw new ConflictException("Вы уже состоите в команде этого заведения");
        }
        const completedInvitation = await transaction.invitation.updateMany({
          where: {
            id: activeSession.invitationId,
            status: "IN_PROGRESS",
            acceptanceSession: { is: { id: activeSession.id, expiresAt: { gt: now } } },
          },
          data: { status: "COMPLETED", completedAt: now },
        });
        if (completedInvitation.count !== 1) {
          throw new ConflictException("Присоединение уже завершено или отменено");
        }
        if (isChefInvitation) {
          if (companyMembership) {
            await transaction.companyMembership.update({
              where: { id: companyMembership.id },
              data: { companyRole: "CHEF_BARTENDER" },
            });
          } else {
            await transaction.companyMembership.create({
              data: {
                companyId: activeSession.invitation.companyId,
                userId: user.id,
                companyRole: "CHEF_BARTENDER",
              },
            });
          }
          await this.organizationInvitations.closeConflictingInvitationsInTransaction(transaction, {
            companyId: activeSession.invitation.companyId,
            emailNormalized: activeSession.emailNormalized,
            completedInvitationId: activeSession.invitationId,
            actorId: user.id,
          });
        } else if (createsVenue) {
          if (companyMembership?.companyRole === "CHEF_BARTENDER") {
            closeOnMembershipConflict = true;
            throw new ConflictException("Вы уже являетесь шеф-барменом этой компании");
          }
          if (!companyMembership) {
            await transaction.companyMembership.create({
              data: { companyId: activeSession.invitation.companyId, userId: user.id },
            });
          }
          venueId = (
            await this.organizationInvitations.createInvitedVenueInTransaction(transaction, {
              companyId: activeSession.invitation.companyId,
              userId: user.id,
              name: venueName,
            })
          ).id;
        } else {
          if (!companyMembership) {
            await transaction.companyMembership.create({
              data: { companyId: activeSession.invitation.companyId, userId: user.id },
            });
          }
          await transaction.venueMembership.create({
            data: {
              companyId: activeSession.invitation.companyId,
              venueId: activeSession.invitation.venueId!,
              userId: user.id,
              role: activeSession.invitation.role!,
              startedOn: dateOnly(now),
              rolePeriods: {
                create: { role: activeSession.invitation.role!, startedOn: dateOnly(now) },
              },
            },
          });
        }
        await transaction.auditEvent.create({
          data: {
            eventType: "invitation.completed",
            actorType: "USER",
            actorId: user.id,
            companyId: activeSession.invitation.companyId,
            venueId,
            entityType: "invitation",
            entityId: activeSession.invitationId,
            metadata: {
              purpose: activeSession.invitation.purpose,
              role: isChefInvitation ? "CHEF_BARTENDER" : activeSession.invitation.role,
            },
          },
        });
        await transaction.invitationAcceptanceSession.delete({ where: { id: activeSession.id } });
        const venue = venueId
          ? { id: venueId }
          : await transaction.venue.findFirst({
              where: { companyId: activeSession.invitation.companyId, status: "ACTIVE" },
              orderBy: { createdAt: "asc" },
              select: { id: true },
            });
        if (!venue) throw new ConflictException("В компании нет доступного заведения");
        return { companyId: activeSession.invitation.companyId, venueId: venue.id };
      });
    } catch (error) {
      if (closeOnMembershipConflict) {
        await this.closeInvitationAfterConflict(acceptance.invitationId);
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        if (createsVenue && isVenueNameConflict(error)) {
          throw new ConflictException("В компании уже есть заведение с таким названием");
        }
        await this.closeInvitationAfterConflict(acceptance.invitationId);
        throw new ConflictException("Членство уже создано. Приглашение закрыто без результата");
      }
      throw error;
    }
    if ("expired" in result) {
      throw new UnauthorizedException("Сессия приглашения истекла. Запросите новую ссылку");
    }
    return { redirectTo: `/app/companies/${result.companyId}/venues/${result.venueId}` };
  }

  private async findAcceptanceSession(token: string) {
    const now = new Date();
    const acceptance = await this.database.invitationAcceptanceSession.findFirst({
      where: {
        tokenHash: sessionTokenHash(token),
        expiresAt: { gt: now },
        invitation: { status: "IN_PROGRESS" },
      },
      include: { invitation: true },
    });
    if (!acceptance) {
      const expired = await this.database.invitationAcceptanceSession.findUnique({
        where: { tokenHash: sessionTokenHash(token) },
        include: { invitation: true },
      });
      if (expired && expired.expiresAt <= now) {
        await this.database.$transaction(async (transaction) => {
          await this.closeExpiredAcceptanceSessionInTransaction(transaction, {
            invitationId: expired.invitationId,
            acceptanceSessionId: expired.id,
            companyId: expired.invitation.companyId,
            venueId: expired.invitation.venueId,
            now,
          });
        });
      }
      throw new UnauthorizedException("Сессия приглашения истекла. Запросите новую ссылку");
    }
    return acceptance;
  }

  private async closeExpiredAcceptanceSessionInTransaction(
    transaction: Prisma.TransactionClient,
    input: {
      invitationId: string;
      acceptanceSessionId: string;
      companyId: string;
      venueId: string | null;
      now: Date;
    },
  ): Promise<void> {
    const closed = await transaction.invitation.updateMany({
      where: {
        id: input.invitationId,
        status: "IN_PROGRESS",
        acceptanceSession: {
          is: { id: input.acceptanceSessionId, expiresAt: { lte: input.now } },
        },
      },
      data: { status: "CLOSED", closedAt: input.now },
    });
    if (closed.count !== 1) return;

    await transaction.auditEvent.create({
      data: {
        eventType: "invitation.expired",
        actorType: "SYSTEM",
        companyId: input.companyId,
        venueId: input.venueId,
        entityType: "invitation",
        entityId: input.invitationId,
      },
    });
    await transaction.invitationAcceptanceSession.deleteMany({
      where: {
        id: input.acceptanceSessionId,
        expiresAt: { lte: input.now },
      },
    });
  }

  private async closeInvitationAfterConflict(invitationId: string): Promise<void> {
    const now = new Date();
    await this.database.$transaction(async (transaction) => {
      await transaction.invitation.updateMany({
        where: { id: invitationId, status: "IN_PROGRESS" },
        data: { status: "CLOSED", closedAt: now },
      });
      await transaction.invitationAcceptanceSession.deleteMany({ where: { invitationId } });
    });
  }
}

function isVenueNameConflict(error: Prisma.PrismaClientKnownRequestError): boolean {
  const target = error.meta?.target;
  if (Array.isArray(target)) {
    return target.includes("companyId") && target.includes("nameNormalized");
  }
  return typeof target === "string" && target.includes("venues_company_normalized_name_key");
}

function dateOnly(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}
