import { randomBytes } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DATABASE_CLIENT, PrismaClient } from "@bartech/database";
import {
  OrganizationInvitationsService,
  type VenueInviteRole,
} from "@bartech/backend-organizations";
import { sessionTokenHash } from "./session.guard.js";
import { EmailOutboxService } from "../outbox/email-outbox.service.js";
import { normalizeEmail, roleLabel } from "./identity.helpers.js";

@Injectable()
export class InvitationIssuanceService {
  constructor(
    @Inject(DATABASE_CLIENT) private readonly database: PrismaClient,
    private readonly organizationInvitations: OrganizationInvitationsService,
    private readonly outbox: EmailOutboxService,
    private readonly config: ConfigService,
  ) {}

  async createVenueInvitation(
    actorId: string,
    companyId: string,
    venueId: string,
    emailInput: string,
    role: VenueInviteRole,
  ) {
    const email = emailInput.trim();
    const emailNormalized = normalizeEmail(email);
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    return this.database.$transaction(async (transaction) => {
      const result = await this.organizationInvitations.createInvitationInTransaction(transaction, {
        actorId,
        companyId,
        venueId,
        email,
        emailNormalized,
        role,
        tokenHash: sessionTokenHash(token),
        expiresAt,
      });
      const origin = this.config.getOrThrow<string>("APP_ORIGIN").replace(/\/$/u, "");
      await this.outbox.enqueue(transaction, "organizations.venue_invitation", {
        to: email,
        subject: `Приглашение в ${result.venueName} — IndieBar`,
        text: `Вас приглашают в компанию «${result.companyName}», заведение «${result.venueName}» на должность «${roleLabel(role)}». Примите приглашение по персональной ссылке: ${origin}/invitations#${token}. Ссылка действует 24 часа.`,
      });
      return {
        id: result.invitation.id,
        email: result.invitation.email,
        role: result.invitation.role,
        status: result.invitation.status,
        expiresAt: result.invitation.expiresAt,
      };
    });
  }

  async createChefInvitation(actorId: string, companyId: string, emailInput: string) {
    const email = emailInput.trim();
    const emailNormalized = normalizeEmail(email);
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    return this.database.$transaction(async (transaction) => {
      const result = await this.organizationInvitations.createChefInvitationInTransaction(
        transaction,
        {
          actorId,
          companyId,
          email,
          emailNormalized,
          tokenHash: sessionTokenHash(token),
          expiresAt,
        },
      );
      const origin = this.config.getOrThrow<string>("APP_ORIGIN").replace(/\/$/u, "");
      await this.outbox.enqueue(transaction, "organizations.chef_invitation", {
        to: email,
        subject: `Приглашение стать шеф-барменом в ${result.companyName} — IndieBar`,
        text: `Вас приглашают стать шеф-барменом компании «${result.companyName}». После принятия вы получите доступ ко всем заведениям компании. Примите приглашение по персональной ссылке: ${origin}/invitations#${token}. Ссылка действует 24 часа.`,
      });
      return {
        id: result.invitation.id,
        email: result.invitation.email,
        purpose: result.invitation.purpose,
        status: result.invitation.status,
        expiresAt: result.invitation.expiresAt,
      };
    });
  }
}
