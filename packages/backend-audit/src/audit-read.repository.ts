import { Inject, Injectable } from "@nestjs/common";
import { DATABASE_CLIENT, type Prisma, type PrismaClient } from "@bartech/database";

@Injectable()
export class AuditReadRepository {
  constructor(@Inject(DATABASE_CLIENT) private readonly database: PrismaClient) {}

  list(where: Prisma.AuditEventWhereInput, take: number, cursor?: { createdAt: Date; id: string }) {
    return this.database.auditEvent.findMany({
      where: cursor
        ? {
            AND: [
              where,
              {
                OR: [
                  { createdAt: { lt: cursor.createdAt } },
                  { createdAt: cursor.createdAt, id: { lt: cursor.id } },
                ],
              },
            ],
          }
        : where,
      take,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        eventType: true,
        entityType: true,
        entityId: true,
        actorType: true,
        actorId: true,
        internalUserId: true,
        metadata: true,
        venueId: true,
        createdAt: true,
        actor: { select: { profile: { select: { fullName: true } } } },
        internalUser: { select: { email: true } },
      },
    });
  }

  async listAuthors(where: Prisma.AuditEventWhereInput) {
    const events = await this.database.auditEvent.findMany({
      where,
      distinct: ["actorId", "internalUserId"],
      select: { actorId: true, internalUserId: true },
    });
    const actorIds = events.flatMap(({ actorId }) => (actorId ? [actorId] : []));
    const internalUserIds = events.flatMap(({ internalUserId }) =>
      internalUserId ? [internalUserId] : [],
    );
    const [users, internalUsers] = await Promise.all([
      actorIds.length
        ? this.database.user.findMany({
            where: { id: { in: actorIds }, profile: { isNot: null } },
            select: { id: true, profile: { select: { fullName: true } } },
          })
        : [],
      internalUserIds.length
        ? this.database.internalUser.findMany({
            where: { id: { in: internalUserIds } },
            select: { id: true, email: true },
          })
        : [],
    ]);
    return [
      ...users.map(({ id, profile }) => ({ id, name: profile!.fullName })),
      ...internalUsers.map(({ id, email }) => ({ id, name: email })),
    ].sort((left, right) => left.name.localeCompare(right.name, "ru"));
  }
}
