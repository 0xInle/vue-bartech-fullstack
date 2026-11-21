import { Inject, Injectable } from "@nestjs/common";
import { DATABASE_CLIENT, Prisma, PrismaClient } from "@bartech/database";

type VenueAnnouncementRecord =
  Prisma.VenueAnnouncementGetPayload<Prisma.VenueAnnouncementDefaultArgs>;

type AnnouncementContent = { title: string; body: string };

@Injectable()
export class AnnouncementsRepository {
  constructor(@Inject(DATABASE_CLIENT) private readonly database: PrismaClient) {}

  findForVenue(companyId: string, venueId: string): Promise<VenueAnnouncementRecord[]> {
    return this.database.venueAnnouncement.findMany({
      where: { companyId, venueId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
  }

  create(
    userId: string,
    companyId: string,
    venueId: string,
    content: AnnouncementContent,
  ): Promise<VenueAnnouncementRecord> {
    return this.database.$transaction(async (transaction) => {
      const announcement = await transaction.venueAnnouncement.create({
        data: { ...content, authorUserId: userId, companyId, venueId },
      });
      await this.writeAuditEvent(transaction, {
        eventType: "venue_announcement.created",
        userId,
        companyId,
        venueId,
        announcement,
      });
      return announcement;
    });
  }

  update(
    id: string,
    userId: string,
    companyId: string,
    venueId: string,
    content: AnnouncementContent,
  ): Promise<VenueAnnouncementRecord | null> {
    return this.database.$transaction(async (transaction) => {
      const result = await transaction.venueAnnouncement.updateMany({
        where: { id, companyId, venueId },
        data: content,
      });
      if (!result.count) return null;

      const announcement = await transaction.venueAnnouncement.findFirstOrThrow({
        where: { id, companyId, venueId },
      });
      await this.writeAuditEvent(transaction, {
        eventType: "venue_announcement.updated",
        userId,
        companyId,
        venueId,
        announcement,
      });
      return announcement;
    });
  }

  delete(id: string, userId: string, companyId: string, venueId: string): Promise<boolean> {
    return this.database.$transaction(async (transaction) => {
      const announcement = await transaction.venueAnnouncement.findFirst({
        where: { id, companyId, venueId },
      });
      if (!announcement) return false;

      const result = await transaction.venueAnnouncement.deleteMany({
        where: { id, companyId, venueId },
      });
      if (!result.count) return false;

      await this.writeAuditEvent(transaction, {
        eventType: "venue_announcement.deleted",
        userId,
        companyId,
        venueId,
        announcement,
      });
      return true;
    });
  }

  private writeAuditEvent(
    transaction: Prisma.TransactionClient,
    input: {
      eventType: string;
      userId: string;
      companyId: string;
      venueId: string;
      announcement: VenueAnnouncementRecord;
    },
  ): Promise<unknown> {
    return transaction.auditEvent.create({
      data: {
        eventType: input.eventType,
        actorType: "USER",
        actorId: input.userId,
        companyId: input.companyId,
        venueId: input.venueId,
        entityType: "VENUE_ANNOUNCEMENT",
        entityId: input.announcement.id,
        metadata: { name: input.announcement.title },
      },
    });
  }
}
