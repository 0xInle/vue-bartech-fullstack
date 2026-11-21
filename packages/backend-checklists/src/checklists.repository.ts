import { Inject, Injectable } from "@nestjs/common";
import { DATABASE_CLIENT, Prisma, PrismaClient } from "@bartech/database";

type ChecklistRecord = Prisma.VenueChecklistGetPayload<Prisma.VenueChecklistDefaultArgs>;
type ChecklistContent = { title: string; steps: string[] };

@Injectable()
export class ChecklistsRepository {
  constructor(@Inject(DATABASE_CLIENT) private readonly database: PrismaClient) {}

  findForVenue(companyId: string, venueId: string): Promise<ChecklistRecord[]> {
    return this.database.venueChecklist.findMany({
      where: { companyId, venueId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
  }

  create(userId: string, companyId: string, venueId: string, content: ChecklistContent) {
    return this.database.$transaction(async (transaction) => {
      const checklist = await transaction.venueChecklist.create({
        data: { ...content, authorUserId: userId, companyId, venueId },
      });
      await this.writeAuditEvent(
        transaction,
        "venue_checklist.created",
        userId,
        companyId,
        venueId,
        checklist,
      );
      return checklist;
    });
  }

  update(
    id: string,
    userId: string,
    companyId: string,
    venueId: string,
    content: ChecklistContent,
  ) {
    return this.database.$transaction(async (transaction) => {
      const result = await transaction.venueChecklist.updateMany({
        where: { id, companyId, venueId },
        data: content,
      });
      if (!result.count) return null;
      const checklist = await transaction.venueChecklist.findFirstOrThrow({
        where: { id, companyId, venueId },
      });
      await this.writeAuditEvent(
        transaction,
        "venue_checklist.updated",
        userId,
        companyId,
        venueId,
        checklist,
      );
      return checklist;
    });
  }

  delete(id: string, userId: string, companyId: string, venueId: string): Promise<boolean> {
    return this.database.$transaction(async (transaction) => {
      const checklist = await transaction.venueChecklist.findFirst({
        where: { id, companyId, venueId },
      });
      if (!checklist) return false;
      const result = await transaction.venueChecklist.deleteMany({
        where: { id, companyId, venueId },
      });
      if (!result.count) return false;
      await this.writeAuditEvent(
        transaction,
        "venue_checklist.deleted",
        userId,
        companyId,
        venueId,
        checklist,
      );
      return true;
    });
  }

  private writeAuditEvent(
    transaction: Prisma.TransactionClient,
    eventType: string,
    userId: string,
    companyId: string,
    venueId: string,
    checklist: ChecklistRecord,
  ): Promise<unknown> {
    return transaction.auditEvent.create({
      data: {
        eventType,
        actorType: "USER",
        actorId: userId,
        companyId,
        venueId,
        entityType: "VENUE_CHECKLIST",
        entityId: checklist.id,
        metadata: { name: checklist.title },
      },
    });
  }
}
