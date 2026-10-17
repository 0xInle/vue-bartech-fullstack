import { Inject, Injectable } from "@nestjs/common";
import { DATABASE_CLIENT, Prisma, type PrismaClient } from "@bartech/database";

@Injectable()
export class SupportAttachmentRepository {
  constructor(@Inject(DATABASE_CLIENT) private readonly database: PrismaClient) {}

  listOutbox(limit: number): Promise<Array<{ id: string; attachmentId: string }>> {
    return this.database.supportAttachmentOutbox.findMany({
      where: { deliveredAt: null, nextAttemptAt: { lte: new Date() } },
      orderBy: { createdAt: "asc" },
      take: limit,
      select: { id: true, attachmentId: true },
    });
  }

  markOutboxDelivered(id: string): Promise<Prisma.BatchPayload> {
    return this.database.supportAttachmentOutbox.updateMany({
      where: { id, deliveredAt: null },
      data: { deliveredAt: new Date() },
    });
  }

  listPending(limit: number): Promise<Array<{ id: string }>> {
    return this.database.supportAttachment.findMany({
      where: { status: "PENDING_SCAN" },
      select: { id: true },
      orderBy: { createdAt: "asc" },
      take: limit,
    });
  }

  findAttachment(id: string): Promise<Prisma.SupportAttachmentGetPayload<object> | null> {
    return this.database.supportAttachment.findUnique({ where: { id } });
  }
}
