import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { OrganizationsService } from "@bartech/backend-organizations";
import { Prisma } from "@bartech/database";
import { isUUID } from "class-validator";
import { AuditReadRepository } from "./audit-read.repository.js";

const SELF_VISIBLE_EVENT = [
  "product.created",
  "product.updated",
  "support.access_granted",
  "support.access_revoked",
  "service_access.started",
  "service_access.ended",
  "product.archived",
  "product.restored",
  "export.requested",
  "export.completed",
  "export.failed",
  "venue.closed",
  "company.closure_started",
  "company.closure_cancelled",
  "company.closed",
];
const PERMISSION_EVENT = [
  "membership.role_changed",
  "membership.delegated_permissions_changed",
  "temporary_responsibility.ended",
];

export type AuditReadContext = { userId: string; companyId: string; venueId: string };
export type AuditReadQuery = {
  from?: string;
  to?: string;
  eventType?: string;
  actorId?: string;
  entityType?: string;
  entityId?: string;
  limit?: number;
  cursor?: string;
};

@Injectable()
export class AuditReadService {
  constructor(
    private readonly repository: AuditReadRepository,
    private readonly organizations: OrganizationsService,
  ) {}

  async list(context: AuditReadContext, query: AuditReadQuery) {
    const cursor = query.cursor ? decodeCursor(query.cursor) : undefined;
    const { where } = await this.buildWhere(context, query);

    const limit = Math.min(Math.max(query.limit ?? 30, 1), 50);
    const rows = await this.repository.list(where, limit + 1, cursor);
    const hasNext = rows.length > limit;
    const items = rows.slice(0, limit).map((row) => {
      const metadata = safeMetadata(row.metadata);
      return {
        id: row.id,
        eventType: row.eventType,
        entityType: row.entityType,
        entityId: row.entityId,
        createdAt: row.createdAt.toISOString(),
        actorName:
          row.actorType === "SYSTEM"
            ? "Система"
            : row.actorType === "INTERNAL_USER"
              ? (row.internalUser?.email ?? "Сотрудник IndieBar")
              : (row.actor?.profile?.fullName ?? "Аккаунт недоступен"),
        actorId: row.actorId ?? row.internalUserId,
        entityName: typeof metadata?.name === "string" ? metadata.name : null,
        metadata: metadata
          ? Object.fromEntries(Object.entries(metadata).filter(([key]) => key !== "name"))
          : null,
        venueId: row.venueId,
      };
    });
    const last = rows[limit - 1];
    return {
      items,
      nextCursor: hasNext && last ? encodeCursor(last.createdAt, last.id) : null,
    };
  }

  async listAuthors(
    context: AuditReadContext,
    query: Omit<AuditReadQuery, "actorId" | "limit" | "cursor">,
  ) {
    const { where } = await this.buildWhere(context, query);
    return this.repository.listAuthors(where);
  }

  private async buildWhere(
    context: AuditReadContext,
    query: Omit<AuditReadQuery, "limit" | "cursor">,
  ) {
    const workspace = await this.organizations.findWorkspaceForUser(
      context.userId,
      context.companyId,
      context.venueId,
    );
    if (!workspace) throw new NotFoundException("Рабочее пространство не найдено");

    const fullHistory = workspace.permissions.includes("view_history");
    const where: Prisma.AuditEventWhereInput = {
      companyId: workspace.company.id,
      ...(workspace.scope === "venue" ? { venueId: workspace.venue.id } : {}),
      ...(fullHistory
        ? {}
        : {
            OR: [
              { actorId: context.userId, eventType: { in: SELF_VISIBLE_EVENT } },
              {
                eventType: { in: PERMISSION_EVENT },
                metadata: { path: ["subjectUserId"], equals: context.userId },
                venueId: workspace.venue.id,
              },
            ],
          }),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: parseDate(query.from) } : {}),
              ...(query.to ? { lte: parseDate(query.to) } : {}),
            },
          }
        : {}),
      ...(query.eventType ? { eventType: query.eventType } : {}),
      ...(query.actorId
        ? { AND: [{ OR: [{ actorId: query.actorId }, { internalUserId: query.actorId }] }] }
        : {}),
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.entityId ? { entityId: query.entityId } : {}),
    };
    return { where, fullHistory };
  }
}

function parseDate(value: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new BadRequestException("Некорректная дата фильтра");
  return date;
}

function decodeCursor(value: string): { createdAt: Date; id: string } {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as {
      createdAt?: string;
      id?: string;
    };
    if (
      typeof parsed.createdAt !== "string" ||
      typeof parsed.id !== "string" ||
      !isUUID(parsed.id)
    ) {
      throw new Error();
    }
    return { createdAt: parseDate(parsed.createdAt), id: parsed.id };
  } catch {
    throw new BadRequestException("Некорректный курсор истории");
  }
}

function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(JSON.stringify({ createdAt: createdAt.toISOString(), id })).toString(
    "base64url",
  );
}

function safeMetadata(value: Prisma.JsonValue | null): Record<string, unknown> | null {
  if (!value || Array.isArray(value) || typeof value !== "object") return null;
  const allowed = [
    "previousRole",
    "newRole",
    "granted",
    "revoked",
    "name",
    "closureDeadline",
    "closedAt",
    "exportType",
    "errorCode",
  ];
  return Object.fromEntries(
    Object.entries(value).filter(([key, entry]) => {
      if (!allowed.includes(key)) return false;
      if (key === "exportType")
        return ["SINGLE_PDF", "BATCH_PDF_ZIP", "VENUE_BACKUP_ZIP"].includes(String(entry));
      if (key === "errorCode")
        return ["EXPORT_PROCESSING_FAILED", "DEADLINE_EXCEEDED"].includes(String(entry));
      return true;
    }),
  );
}
