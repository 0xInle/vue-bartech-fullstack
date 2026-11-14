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
    await this.finalizeAccountDeletions(now);
  }

  private async finalizeAccountDeletions(now: Date): Promise<void> {
    const accounts = await this.database.user.findMany({
      where: { status: "PENDING_DELETION", deletionScheduledAt: { lte: now } },
      select: { id: true },
      take: 100,
      orderBy: { deletionScheduledAt: "asc" },
    });

    for (const account of accounts) {
      await this.database.$transaction(async (transaction) => {
        const anonymizedEmail = `deleted+${account.id}@deleted.invalid`;
        const updated = await transaction.user.updateMany({
          where: {
            id: account.id,
            status: "PENDING_DELETION",
            deletionScheduledAt: { lte: now },
          },
          data: {
            status: "DELETED",
            email: anonymizedEmail,
            emailNormalized: anonymizedEmail,
            passwordHash: null,
          },
        });
        if (!updated.count) return;

        const profile = await transaction.userProfile.findUnique({
          where: { userId: account.id },
          select: { fullName: true },
        });
        if (profile?.fullName) {
          await transaction.$executeRaw`
            UPDATE "audit_events"
            SET "metadata" = jsonb_set(
              COALESCE("metadata", '{}'::jsonb),
              '{actorName}',
              to_jsonb(${profile.fullName}::text),
              true
            )
            WHERE "actorId" = ${account.id}::uuid
              AND "actorType" = 'USER'
              AND NOT (COALESCE("metadata", '{}'::jsonb) ? 'actorName')
          `;
        }

        await transaction.userProfile.updateMany({
          where: { userId: account.id },
          data: { fullName: "Удалённый пользователь" },
        });
        await transaction.session.updateMany({
          where: { userId: account.id, revokedAt: null },
          data: { revokedAt: now },
        });
        await transaction.emailChallenge.deleteMany({ where: { userId: account.id } });
      });
    }
  }
}
