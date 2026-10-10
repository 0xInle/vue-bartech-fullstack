import { Inject, Injectable } from "@nestjs/common";
import { DATABASE_CLIENT, PrismaClient } from "@bartech/database";
import { OrganizationInvitationsService } from "@bartech/backend-organizations";

@Injectable()
export class ExpiredDataCleanupService {
  constructor(
    @Inject(DATABASE_CLIENT) private readonly database: PrismaClient,
    private readonly organizationInvitations: OrganizationInvitationsService,
  ) {}

  async cleanupExpired(): Promise<void> {
    const now = new Date();
    await this.database.$transaction(async (transaction) => {
      await this.organizationInvitations.cleanupExpiredInTransaction(transaction, now);
      await Promise.all([
        transaction.registrationAttempt.deleteMany({ where: { expiresAt: { lte: now } } }),
        transaction.emailChallenge.deleteMany({ where: { expiresAt: { lte: now } } }),
        transaction.session.deleteMany({ where: { expiresAt: { lte: now } } }),
      ]);
    });
  }
}
