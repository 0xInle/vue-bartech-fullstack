import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service.js";
import type { InternalAuditQueryDto } from "./internal-audit.dto.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type AuditCursor = { createdAt: string; id: string };

type InternalAuditRow = {
  id: string;
  createdAt: string;
  eventType: string;
  actorType: "OPERATOR" | "INTERNAL_USER" | "SYSTEM";
  companyId: string | null;
  venueId: string | null;
  serviceSessionId: string | null;
  actorEmail: string | null;
};

@Injectable()
export class InternalAuditService {
  constructor(private readonly database: PrismaService) {}

  async list(query: InternalAuditQueryDto) {
    const cursor = query.cursor ? decodeCursor(query.cursor) : undefined;
    const rows = cursor
      ? await this.database.$queryRaw<InternalAuditRow[]>`
          SELECT event."id",
                 to_char(event."createdAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "createdAt",
                 event."eventType",
                 event."actorType",
                 event."companyId",
                 event."venueId",
                 event."serviceSessionId",
                 internal_user."email" AS "actorEmail"
          FROM "internal_audit_events" AS event
          LEFT JOIN "internal_users" AS internal_user ON internal_user."id" = event."internalUserId"
          WHERE (event."createdAt", event."id") < (${cursor.createdAt}::timestamptz, ${cursor.id}::uuid)
          ORDER BY event."createdAt" DESC, event."id" DESC
          LIMIT ${query.limit + 1}
        `
      : await this.database.$queryRaw<InternalAuditRow[]>`
          SELECT event."id",
                 to_char(event."createdAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "createdAt",
                 event."eventType",
                 event."actorType",
                 event."companyId",
                 event."venueId",
                 event."serviceSessionId",
                 internal_user."email" AS "actorEmail"
          FROM "internal_audit_events" AS event
          LEFT JOIN "internal_users" AS internal_user ON internal_user."id" = event."internalUserId"
          ORDER BY event."createdAt" DESC, event."id" DESC
          LIMIT ${query.limit + 1}
        `;
    const hasMore = rows.length > query.limit;
    const page = rows.slice(0, query.limit);
    const last = page.at(-1);

    return { items: page, nextCursor: hasMore && last ? encodeCursor(last) : null };
  }
}

function encodeCursor(cursor: AuditCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

function decodeCursor(value: string): AuditCursor {
  try {
    const decoded = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as {
      createdAt?: unknown;
      id?: unknown;
    };
    if (
      typeof decoded.createdAt !== "string" ||
      !isCursorTimestamp(decoded.createdAt) ||
      typeof decoded.id !== "string" ||
      !UUID_PATTERN.test(decoded.id)
    ) {
      throw new Error("invalid cursor");
    }
    return { createdAt: decoded.createdAt, id: decoded.id };
  } catch {
    throw new BadRequestException("Некорректный курсор внутреннего журнала");
  }
}

function isCursorTimestamp(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(value)) return false;
  const milliseconds = value.slice(0, 23);
  const parsed = new Date(milliseconds);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 23) === milliseconds;
}
