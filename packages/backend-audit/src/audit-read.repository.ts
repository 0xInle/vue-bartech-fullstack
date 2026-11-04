import { Inject, Injectable } from "@nestjs/common";
import { DATABASE_CLIENT, type Prisma, type PrismaClient } from "@bartech/database";

@Injectable()
export class AuditReadRepository {
  constructor(@Inject(DATABASE_CLIENT) private readonly database: PrismaClient) {}

  list(where: Prisma.AuditEventWhereInput, skip: number, take: number) {
    return this.database.auditEvent.findMany({
      where,
      skip,
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
        companyId: true,
        actor: { select: { profile: { select: { fullName: true } } } },
        internalUser: { select: { email: true } },
        serviceSession: { select: { internalUser: { select: { email: true } } } },
      },
    });
  }

  count(where: Prisma.AuditEventWhereInput) {
    return this.database.auditEvent.count({ where });
  }

  async eventDetails(
    rows: Array<{
      id: string;
      eventType: string;
      entityType: string;
      entityId: string;
      companyId: string | null;
      venueId: string | null;
      createdAt: Date;
    }>,
  ) {
    const membershipIds = rows
      .filter((row) => row.entityType === "venue_membership")
      .map((row) => row.entityId);
    const invitationIds = rows
      .filter((row) => row.entityType === "invitation")
      .map((row) => row.entityId);
    const grantIds = rows
      .filter((row) => row.entityType === "SUPPORT_ACCESS_GRANT")
      .map((row) => row.entityId);
    const companyIds = [
      ...new Set(rows.flatMap(({ companyId }) => (companyId ? [companyId] : []))),
    ];
    const productRows = rows.filter((row) => row.entityType === "PRODUCT" && row.companyId);
    const productIds = [...new Set(productRows.map(({ entityId }) => entityId))];
    const venueIds = [...new Set(productRows.flatMap(({ venueId }) => (venueId ? [venueId] : [])))];
    const [memberships, invitations, grants, productHistory, products] = await Promise.all([
      membershipIds.length
        ? this.database.venueMembership.findMany({
            where: { id: { in: membershipIds }, companyId: { in: companyIds } },
            select: {
              id: true,
              companyId: true,
              user: { select: { profile: { select: { fullName: true } } } },
            },
          })
        : [],
      invitationIds.length
        ? this.database.invitation.findMany({
            where: { id: { in: invitationIds }, companyId: { in: companyIds } },
            select: { id: true, email: true, purpose: true, role: true },
          })
        : [],
      grantIds.length
        ? this.database.supportAccessGrant.findMany({
            where: { id: { in: grantIds }, companyId: { in: companyIds } },
            select: { id: true, scopeType: true, expiresAt: true },
          })
        : [],
      productIds.length && companyIds.length
        ? this.database.auditEvent.findMany({
            where: {
              entityType: "PRODUCT",
              entityId: { in: productIds },
              companyId: { in: companyIds },
              eventType: {
                in: [
                  "product.created",
                  "product.updated",
                  "product.archived",
                  "product.restored",
                  "product.permanently_deleted",
                ],
              },
            },
            select: { id: true, entityId: true, createdAt: true, metadata: true },
            orderBy: { createdAt: "desc" },
          })
        : [],
      productIds.length && venueIds.length
        ? this.database.product.findMany({
            where: { id: { in: productIds }, venueId: { in: venueIds } },
            select: { id: true, type: true, name: true },
          })
        : [],
    ]);
    return {
      memberships: new Map(memberships.map(({ id, user }) => [id, user.profile?.fullName ?? null])),
      invitations: new Map(
        invitations.map(({ id, email, purpose, role }) => [id, { email, purpose, role }]),
      ),
      grants: new Map(grants.map(({ id, scopeType, expiresAt }) => [id, { scopeType, expiresAt }])),
      productHistory,
      products: new Map(products.map(({ id, type, name }) => [id, { type, name }])),
    };
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
