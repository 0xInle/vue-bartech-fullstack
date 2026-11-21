import { Inject, Injectable } from "@nestjs/common";
import { DATABASE_CLIENT, Prisma, PrismaClient } from "@bartech/database";

type VenueReminderRecord =
  Prisma.VenuePersonalReminderGetPayload<Prisma.VenuePersonalReminderDefaultArgs>;

@Injectable()
export class RemindersRepository {
  constructor(@Inject(DATABASE_CLIENT) private readonly database: PrismaClient) {}

  findForUser(userId: string, companyId: string, venueId: string): Promise<VenueReminderRecord[]> {
    return this.database.venuePersonalReminder.findMany({
      where: { userId, companyId, venueId },
      orderBy: [{ completedAt: "asc" }, { createdAt: "desc" }],
    });
  }

  create(
    userId: string,
    companyId: string,
    venueId: string,
    text: string,
  ): Promise<VenueReminderRecord> {
    return this.database.venuePersonalReminder.create({
      data: { userId, companyId, venueId, text },
    });
  }

  async setCompleted(
    id: string,
    userId: string,
    companyId: string,
    venueId: string,
    completed: boolean,
  ): Promise<VenueReminderRecord | null> {
    const result = await this.database.venuePersonalReminder.updateMany({
      where: { id, userId, companyId, venueId },
      data: { completedAt: completed ? new Date() : null },
    });
    if (!result.count) return null;

    return this.database.venuePersonalReminder.findFirst({
      where: { id, userId, companyId, venueId },
    });
  }

  async delete(id: string, userId: string, companyId: string, venueId: string): Promise<boolean> {
    const result = await this.database.venuePersonalReminder.deleteMany({
      where: { id, userId, companyId, venueId },
    });
    return result.count > 0;
  }
}
