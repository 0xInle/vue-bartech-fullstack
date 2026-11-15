import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { DATABASE_CLIENT, type Prisma, type PrismaClient } from "@bartech/database";
import { OrganizationsService } from "@bartech/backend-organizations";
import { FILE_STORAGE, type FileStorage } from "@bartech/backend-files";
import {
  CreateInternalSupportMessageDto,
  CreateSupportMessageDto,
  CreateSupportRequestDto,
  SupportQueueQueryDto,
  SupportReasonDto,
  SupportStatusDto,
  UpdateSupportRequestDto,
} from "./support.dto.js";
import { SupportAccessService } from "./access/support-access.service.js";

export const SUPPORT_FILE_MAX_BYTES = 20 * 1024 * 1024;
export const SUPPORT_FILE_MAX_COUNT = 5;
const DOWNLOAD_URL_TTL_SECONDS = 60;

export type SupportUploadFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

@Injectable()
export class SupportService {
  constructor(
    @Inject(DATABASE_CLIENT) private readonly database: PrismaClient,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
    private readonly organizations: OrganizationsService,
    private readonly access: SupportAccessService,
  ) {}

  async create(
    authorUserId: string,
    input: CreateSupportRequestDto,
    files: SupportUploadFile[] = [],
  ) {
    const reason = toDatabaseReason(input.reason);
    const context = await this.resolveContext(authorUserId, input.companyId, input.venueId);
    const technicalContext: Record<string, string> = {};
    const browser = normalizeText(input.browser, 200);
    const errorId = normalizeErrorId(input.errorId);
    if (browser) technicalContext.browser = browser;
    if (errorId) technicalContext.errorId = errorId;

    const message = input.message.trim();
    if (!message) throw new BadRequestException("Напишите сообщение для поддержки");
    if (message.length > 1000)
      throw new BadRequestException("Сообщение не должно превышать 1000 символов");

    const { attachments, uploadedObjectKeys } = await this.stageAttachments(files);

    try {
      const created = await this.database.$transaction(async (transaction) => {
        const request = await transaction.supportRequest.create({
          data: {
            authorUserId,
            companyId: context.companyId,
            venueId: context.venueId,
            reason,
            message,
            technicalContext: Object.keys(technicalContext).length
              ? (technicalContext as Prisma.InputJsonObject)
              : undefined,
          },
        });
        const firstMessageId = randomUUID();
        await transaction.supportMessage.create({
          data: {
            id: firstMessageId,
            requestId: request.id,
            authorType: "CUSTOMER",
            authorUserId,
            body: message,
            createdAt: request.createdAt,
          },
        });
        if (attachments.length) {
          await transaction.supportAttachment.createMany({
            data: attachments.map((attachment) => ({
              id: attachment.id,
              requestId: request.id,
              messageId: firstMessageId,
              uploadedByUserId: authorUserId,
              originalName: attachment.originalName,
              contentType: attachment.contentType,
              sizeBytes: BigInt(attachment.file.size),
              objectKey: attachment.objectKey,
            })),
          });
          await transaction.supportAttachmentOutbox.createMany({
            data: attachments.map(({ id }) => ({ attachmentId: id })),
          });
        }
        const created = await transaction.supportRequest.findUniqueOrThrow({
          where: { id: request.id },
          include: { attachments: true },
        });
        await transaction.auditEvent.create({
          data: {
            eventType: "support.request_created",
            actorType: "USER",
            actorId: authorUserId,
            companyId: context.companyId,
            venueId: context.venueId,
            entityType: "SUPPORT_REQUEST",
            entityId: request.id,
            metadata: { reason },
          },
        });
        return created;
      });
      return serializeRequest(created);
    } catch (error) {
      await Promise.all(
        uploadedObjectKeys.map((key) => this.storage.delete(key).catch(() => undefined)),
      );
      throw error;
    }
  }

  async listMine(authorUserId: string) {
    const requests = await this.database.supportRequest.findMany({
      where: { authorUserId },
      orderBy: { createdAt: "desc" },
      include: { attachments: true },
    });
    return requests.map(serializeRequest);
  }

  async getMine(authorUserId: string, requestId: string) {
    const request = await this.database.supportRequest.findFirst({
      where: { id: requestId, authorUserId },
      include: { attachments: true },
    });
    if (!request) throw new NotFoundException("Обращение не найдено");
    return serializeRequest(request);
  }

  async getMessages(requestId: string, requester: { userId?: string; internal?: boolean }) {
    const request = await this.database.supportRequest.findFirst({
      where: {
        id: requestId,
        ...(requester.internal ? {} : { authorUserId: requester.userId }),
      },
      select: { id: true },
    });
    if (!request) throw new NotFoundException("Обращение не найдено");
    const messages = await this.database.supportMessage.findMany({
      where: { requestId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      include: {
        authorUser: { select: { email: true, profile: { select: { fullName: true } } } },
        attachments: true,
        accessGrant: {
          include: { company: { select: { name: true } }, venue: { select: { name: true } } },
        },
      },
    });
    return messages.map(serializeSupportMessage);
  }

  async createCustomerMessage(
    authorUserId: string,
    requestId: string,
    input: CreateSupportMessageDto,
    files: SupportUploadFile[] = [],
  ) {
    const message = input.message?.trim() ?? "";
    if (message.length > 1000 || (!message && !files.length)) {
      throw new BadRequestException("Напишите сообщение или прикрепите файл");
    }
    const initial = await this.database.supportRequest.findFirst({
      where: { id: requestId, authorUserId },
      select: { status: true },
    });
    if (!initial) throw new NotFoundException("Обращение не найдено");
    if (initial.status === "CLOSED") throw new BadRequestException("Обращение закрыто");
    const existingCount = await this.database.supportAttachment.count({ where: { requestId } });
    if (existingCount + files.length > SUPPORT_FILE_MAX_COUNT) {
      throw new BadRequestException("К одному обращению можно приложить не более пяти файлов");
    }

    const { attachments, uploadedObjectKeys } = await this.stageAttachments(files);
    try {
      const created = await this.database.$transaction(async (transaction) => {
        await transaction.$queryRaw`SELECT "id" FROM "support_requests" WHERE "id" = ${requestId}::uuid FOR UPDATE`;
        const request = await transaction.supportRequest.findFirst({
          where: { id: requestId, authorUserId },
          select: { id: true, status: true },
        });
        if (!request) throw new NotFoundException("Обращение не найдено");
        if (request.status === "CLOSED") throw new BadRequestException("Обращение закрыто");
        const currentCount = await transaction.supportAttachment.count({ where: { requestId } });
        if (currentCount + attachments.length > SUPPORT_FILE_MAX_COUNT) {
          throw new BadRequestException("К одному обращению можно приложить не более пяти файлов");
        }
        const createdMessage = await transaction.supportMessage.create({
          data: {
            requestId,
            authorType: "CUSTOMER",
            authorUserId,
            body: message,
            attachments: {
              create: attachments.map((attachment) => ({
                requestId,
                uploadedByUserId: authorUserId,
                originalName: attachment.originalName,
                contentType: attachment.contentType,
                sizeBytes: BigInt(attachment.file.size),
                objectKey: attachment.objectKey,
                outbox: { create: {} },
              })),
            },
          },
          include: {
            authorUser: { select: { email: true, profile: { select: { fullName: true } } } },
            attachments: true,
            accessGrant: {
              include: { company: { select: { name: true } }, venue: { select: { name: true } } },
            },
          },
        });
        await transaction.supportRequest.update({
          where: { id: requestId },
          data: {
            status: request.status === "WAITING_ON_CUSTOMER" ? "IN_PROGRESS" : request.status,
            updatedAt: new Date(),
          },
        });
        return createdMessage;
      });
      return serializeSupportMessage(created);
    } catch (error) {
      await Promise.all(
        uploadedObjectKeys.map((key) => this.storage.delete(key).catch(() => undefined)),
      );
      throw error;
    }
  }

  async createInternalMessage(
    internalUserId: string,
    requestId: string,
    input: CreateInternalSupportMessageDto,
  ) {
    const body = input.message.trim();
    if (!body) throw new BadRequestException("Введите сообщение");
    return this.database.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT "id" FROM "support_requests" WHERE "id" = ${requestId}::uuid FOR UPDATE`;
      const request = await transaction.supportRequest.findUnique({
        where: { id: requestId },
        select: { id: true, status: true, reason: true, companyId: true, venueId: true },
      });
      if (!request) throw new NotFoundException("Обращение не найдено");
      if (request.status === "CLOSED") throw new BadRequestException("Обращение закрыто");
      if (input.requestAccess) await this.access.assertCanRequestAccess(transaction, requestId);
      const created = await transaction.supportMessage.create({
        data: {
          requestId,
          authorType: "INTERNAL",
          authorInternalUserId: internalUserId,
          kind: input.requestAccess ? "ACCESS_REQUEST" : "TEXT",
          body,
        },
        include: {
          authorUser: { select: { email: true, profile: { select: { fullName: true } } } },
          attachments: true,
          accessGrant: {
            include: { company: { select: { name: true } }, venue: { select: { name: true } } },
          },
        },
      });
      await transaction.supportRequest.update({
        where: { id: requestId },
        data: { status: "WAITING_ON_CUSTOMER", updatedAt: new Date() },
      });
      await transaction.internalAuditEvent.create({
        data: {
          eventType: input.requestAccess ? "support.access_requested" : "support.message_sent",
          actorType: "INTERNAL_USER",
          actorId: internalUserId,
          internalUserId,
          metadata: { requestId, messageId: created.id },
        },
      });
      return serializeSupportMessage(created);
    });
  }

  async getUnreadCount(requester: { userId?: string; internal?: boolean }) {
    const rows = requester.internal
      ? await this.database.$queryRaw<Array<{ requestId: string; unreadCount: number }>>`
          SELECT message."requestId", COUNT(*)::int AS "unreadCount"
          FROM "support_messages" AS message
          INNER JOIN "support_requests" AS request ON request."id" = message."requestId"
          WHERE message."authorType" = 'CUSTOMER'
            AND (request."supportReadAt" IS NULL OR message."createdAt" > request."supportReadAt")
          GROUP BY message."requestId"
          ORDER BY message."requestId"
        `
      : await this.database.$queryRaw<Array<{ requestId: string; unreadCount: number }>>`
          SELECT message."requestId", COUNT(*)::int AS "unreadCount"
          FROM "support_messages" AS message
          INNER JOIN "support_requests" AS request ON request."id" = message."requestId"
          WHERE request."authorUserId" = ${requester.userId}::uuid
            AND message."authorType" = 'INTERNAL'
            AND (request."customerReadAt" IS NULL OR message."createdAt" > request."customerReadAt")
          GROUP BY message."requestId"
          ORDER BY message."requestId"
        `;
    return {
      totalCount: rows.reduce((total, row) => total + Number(row.unreadCount), 0),
      requests: rows.map((row) => ({
        requestId: row.requestId,
        unreadCount: Number(row.unreadCount),
      })),
    };
  }

  async markMessagesRead(
    requestId: string,
    throughMessageId: string,
    requester: { userId?: string; internal?: boolean },
  ) {
    return this.database.$transaction(async (transaction) => {
      const request = await transaction.supportRequest.findFirst({
        where: {
          id: requestId,
          ...(requester.internal ? {} : { authorUserId: requester.userId }),
        },
        select: { id: true },
      });
      if (!request) throw new NotFoundException("Обращение не найдено");
      const message = await transaction.supportMessage.findFirst({
        where: { id: throughMessageId, requestId },
        select: { createdAt: true },
      });
      if (!message) throw new NotFoundException("Сообщение не найдено");
      const cursorWhere: Prisma.SupportRequestWhereInput = {
        id: request.id,
        OR: requester.internal
          ? [{ supportReadAt: null }, { supportReadAt: { lt: message.createdAt } }]
          : [{ customerReadAt: null }, { customerReadAt: { lt: message.createdAt } }],
      };
      await transaction.supportRequest.updateMany({
        where: cursorWhere,
        data: requester.internal
          ? { supportReadAt: message.createdAt }
          : { customerReadAt: message.createdAt },
      });
      return { readThrough: message.createdAt };
    });
  }

  async listQueue(query: SupportQueueQueryDto) {
    const where = query.status ? { status: toDatabaseStatus(query.status) } : {};
    const [requests, total] = await Promise.all([
      this.database.supportRequest.findMany({
        where,
        orderBy: [{ status: "asc" }, { createdAt: "asc" }],
        skip: (query.page - 1) * 50,
        take: 50,
        include: {
          attachments: true,
          author: { select: { id: true, email: true, profile: { select: { fullName: true } } } },
          assignedTo: { select: { id: true, email: true } },
        },
      }),
      this.database.supportRequest.count({ where }),
    ]);
    return {
      items: requests.map((request) => ({
        ...serializeRequest(request),
        author: request.author
          ? {
              id: request.author.id,
              email: request.author.email,
              fullName: request.author.profile?.fullName ?? "",
            }
          : null,
        assignedTo: request.assignedTo,
      })),
      page: query.page,
      pageSize: 50,
      total,
    };
  }

  async getQueueItem(requestId: string) {
    const request = await this.database.supportRequest.findUnique({
      where: { id: requestId },
      include: {
        attachments: true,
        author: { select: { id: true, email: true, profile: { select: { fullName: true } } } },
        assignedTo: { select: { id: true, email: true } },
      },
    });
    if (!request) throw new NotFoundException("Обращение не найдено");
    return {
      ...serializeRequest(request),
      author: request.author
        ? {
            id: request.author.id,
            email: request.author.email,
            fullName: request.author.profile?.fullName ?? "",
          }
        : null,
      assignedTo: request.assignedTo,
    };
  }

  listInternalUsers(): Promise<Array<{ id: string; email: string }>> {
    return this.database.internalUser.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, email: true },
      orderBy: { emailNormalized: "asc" },
    });
  }

  async update(internalUserId: string, requestId: string, input: UpdateSupportRequestDto) {
    return this.database.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT "id" FROM "support_requests" WHERE "id" = ${requestId}::uuid FOR UPDATE`;
      const current = await transaction.supportRequest.findUnique({ where: { id: requestId } });
      if (!current) throw new NotFoundException("Обращение не найдено");

      let assignedToId = current.assignedToId;
      if (input.assignedToId !== undefined) {
        assignedToId = input.assignedToId;
        if (assignedToId) {
          const assignee = await transaction.internalUser.findFirst({
            where: { id: assignedToId, status: "ACTIVE" },
            select: { id: true },
          });
          if (!assignee) throw new NotFoundException("Внутренний сотрудник не найден");
        }
      }
      const status = input.status ? toDatabaseStatus(input.status) : current.status;
      if (current.status === "CLOSED") {
        if (status !== "CLOSED") {
          throw new BadRequestException("Закрытое обращение нельзя открыть повторно");
        }
        if (assignedToId !== current.assignedToId) {
          throw new BadRequestException("Закрытое обращение доступно только для чтения");
        }
      }
      if (status === "CLOSED" && current.status !== "CLOSED") {
        const activeGrant = await transaction.supportAccessGrant.findFirst({
          where: { requestId, revokedAt: null, expiresAt: { gt: new Date() } },
          select: { id: true },
        });
        if (activeGrant) {
          throw new BadRequestException(
            "Сначала отзовите временный доступ или дождитесь его истечения",
          );
        }
      }
      const updated = await transaction.supportRequest.update({
        where: { id: requestId },
        data: { status, assignedToId },
        include: { attachments: true },
      });
      if (status !== current.status) {
        await transaction.internalAuditEvent.create({
          data: {
            eventType: "support.request_status_changed",
            actorType: "INTERNAL_USER",
            actorId: internalUserId,
            internalUserId,
            metadata: { requestId, from: current.status, to: status },
          },
        });
      }
      if (assignedToId !== current.assignedToId) {
        await transaction.internalAuditEvent.create({
          data: {
            eventType: "support.request_assigned",
            actorType: "INTERNAL_USER",
            actorId: internalUserId,
            internalUserId,
            metadata: { requestId, assignedToId },
          },
        });
      }
      return serializeRequest(updated);
    });
  }

  revokeAccessBySupport(internalUserId: string, requestId: string, grantId: string) {
    return this.access.revokeGrantByInternalSupport(internalUserId, requestId, grantId);
  }

  async createDownloadUrl(
    requestId: string,
    attachmentId: string,
    requester: { userId?: string; internal?: boolean },
  ) {
    const attachment = await this.database.supportAttachment.findFirst({
      where: { id: attachmentId, requestId },
      include: { request: { select: { authorUserId: true } } },
    });
    if (!attachment || attachment.status !== "CLEAN") {
      throw new NotFoundException("Проверенное вложение не найдено");
    }
    if (!requester.internal && attachment.request.authorUserId !== requester.userId) {
      throw new NotFoundException("Проверенное вложение не найдено");
    }
    return {
      url: await this.storage.createDownloadUrl(
        attachment.objectKey,
        normalizeOriginalName(attachment.originalName),
        DOWNLOAD_URL_TTL_SECONDS,
      ),
      expiresInSeconds: DOWNLOAD_URL_TTL_SECONDS,
    };
  }

  async recordScanResult(attachmentId: string, status: "CLEAN" | "REJECTED", errorCode?: string) {
    return this.database.$transaction(async (transaction) => {
      const attachment = await transaction.supportAttachment.findUnique({
        where: { id: attachmentId },
        select: { id: true, requestId: true, status: true },
      });
      if (!attachment || attachment.status !== "PENDING_SCAN") return false;
      const updated = await transaction.supportAttachment.updateMany({
        where: { id: attachmentId, status: "PENDING_SCAN" },
        data: { status, scanErrorCode: errorCode ?? null, scannedAt: new Date() },
      });
      if (!updated.count) return false;
      await transaction.internalAuditEvent.create({
        data: {
          eventType:
            status === "CLEAN"
              ? "support.attachment_scan_completed"
              : "support.attachment_scan_failed",
          actorType: "SYSTEM",
          metadata: { requestId: attachment.requestId, attachmentId, status, errorCode },
        },
      });
      return true;
    });
  }

  async rejectPending(attachmentId: string) {
    return this.recordScanResult(attachmentId, "REJECTED", "SCAN_FAILED");
  }

  private async resolveContext(authorUserId: string, companyId?: string, venueId?: string) {
    if (venueId && !companyId) throw new BadRequestException("Для заведения требуется компания");
    if (venueId && companyId) {
      const workspace = await this.organizations.findWorkspaceForUser(
        authorUserId,
        companyId,
        venueId,
      );
      if (!workspace) throw new ForbiddenException("Выбранный контекст недоступен");
      return { companyId, venueId };
    }
    if (companyId) {
      const membership = await this.database.companyMembership.findFirst({
        where: {
          userId: authorUserId,
          companyId,
          endedOn: null,
        },
        select: { companyId: true },
      });
      if (!membership) throw new ForbiddenException("Выбранный контекст недоступен");
    }
    return { companyId: companyId ?? null, venueId: null };
  }

  private async stageAttachments(files: SupportUploadFile[]) {
    if (files.length > SUPPORT_FILE_MAX_COUNT) {
      throw new BadRequestException("К одному обращению можно приложить не более пяти файлов");
    }
    const staged: Array<{
      id: string;
      originalName: string;
      contentType: string;
      objectKey: string;
      file: SupportUploadFile;
    }> = [];
    const uploadedObjectKeys: string[] = [];
    try {
      for (const file of files) {
        const validated = validateUpload(file);
        const id = randomUUID();
        const objectKey = `support-quarantine/${id}`;
        await this.storage.put({
          key: objectKey,
          body: file.buffer,
          contentType: validated.contentType,
          fileName: validated.originalName,
        });
        uploadedObjectKeys.push(objectKey);
        staged.push({ id, ...validated, objectKey, file });
      }
      return { attachments: staged, uploadedObjectKeys };
    } catch (error) {
      await Promise.all(
        uploadedObjectKeys.map((key) => this.storage.delete(key).catch(() => undefined)),
      );
      throw error;
    }
  }
}

function toDatabaseReason(reason: SupportReasonDto) {
  return { data_migration: "DATA_MIGRATION", error: "ERROR", other: "OTHER" }[reason] as
    "DATA_MIGRATION" | "ERROR" | "OTHER";
}

function toDatabaseStatus(status: SupportStatusDto) {
  return {
    new: "NEW",
    in_progress: "IN_PROGRESS",
    waiting_on_customer: "WAITING_ON_CUSTOMER",
    closed: "CLOSED",
  }[status] as "NEW" | "IN_PROGRESS" | "WAITING_ON_CUSTOMER" | "CLOSED";
}

function normalizeText(value: string | undefined, maxLength: number): string | undefined {
  const normalized = value
    ?.split("")
    .map((character) => {
      const code = character.charCodeAt(0);
      return code <= 31 || code === 127 ? " " : character;
    })
    .join("")
    .trim()
    .slice(0, maxLength);
  return normalized || undefined;
}

function normalizeErrorId(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized && /^[A-Za-z0-9._:-]{1,128}$/u.test(normalized) ? normalized : undefined;
}

function validateUpload(file: SupportUploadFile) {
  if (file.size > SUPPORT_FILE_MAX_BYTES) {
    throw new BadRequestException("Размер вложения превышает 20 МБ");
  }
  const originalName = normalizeOriginalName(
    file.originalname.replace(/\\/gu, "/").split("/").at(-1)?.trim() ?? "",
  );
  if (!originalName || originalName.length > 255) {
    throw new BadRequestException("Недопустимое имя файла");
  }
  const extension = originalName.split(".").at(-1)?.toLocaleLowerCase("en-US");
  const detected = detectFileType(file.buffer, extension ?? "");
  const suppliedType = file.mimetype.toLocaleLowerCase("en-US").split(";")[0];
  if (!detected || !detected.acceptedMimeTypes.includes(suppliedType)) {
    throw new BadRequestException("Формат вложения не поддерживается");
  }
  return { originalName, contentType: detected.contentType };
}

function detectFileType(buffer: Buffer, extension: string) {
  const startsWith = (...bytes: number[]) => bytes.every((byte, index) => buffer[index] === byte);
  switch (extension) {
    case "pdf":
      return buffer.subarray(0, 5).toString("ascii") === "%PDF-"
        ? { contentType: "application/pdf", acceptedMimeTypes: ["application/pdf"] }
        : null;
    case "xls":
      return startsWith(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1)
        ? {
            contentType: "application/vnd.ms-excel",
            acceptedMimeTypes: ["application/vnd.ms-excel"],
          }
        : null;
    case "xlsx": {
      const content = buffer.toString("latin1");
      return startsWith(0x50, 0x4b, 0x03, 0x04) &&
        content.includes("[Content_Types].xml") &&
        content.includes("xl/")
        ? {
            contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            acceptedMimeTypes: [
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            ],
          }
        : null;
    }
    case "doc":
      return startsWith(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1)
        ? { contentType: "application/msword", acceptedMimeTypes: ["application/msword"] }
        : null;
    case "docx": {
      const content = buffer.toString("latin1");
      return startsWith(0x50, 0x4b, 0x03, 0x04) &&
        content.includes("[Content_Types].xml") &&
        content.includes("word/document.xml")
        ? {
            contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            acceptedMimeTypes: [
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ],
          }
        : null;
    }
    default:
      return null;
  }
}

function normalizeOriginalName(value: string): string {
  if (!/[ÐÑ][\u00a0-\u00ff]/u.test(value)) return value;
  const decoded = Buffer.from(value, "latin1").toString("utf8");
  return decoded.includes("\uFFFD") ? value : decoded;
}

function serializeRequest<
  T extends {
    id: string;
    reason: string;
    message: string;
    status: string;
    technicalContext: unknown;
    companyId: string | null;
    venueId: string | null;
    createdAt: Date;
    updatedAt: Date;
    attachments: Array<{
      id: string;
      originalName: string;
      contentType: string;
      sizeBytes: bigint;
      status: string;
      scanErrorCode: string | null;
      createdAt: Date;
      scannedAt: Date | null;
    }>;
  },
>(request: T) {
  return {
    id: request.id,
    reason: request.reason.toLocaleLowerCase("en-US"),
    message: request.message,
    status: request.status.toLocaleLowerCase("en-US"),
    technicalContext: request.technicalContext,
    companyId: request.companyId,
    venueId: request.venueId,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    attachments: request.attachments.map((attachment) => ({
      id: attachment.id,
      originalName: normalizeOriginalName(attachment.originalName),
      contentType: attachment.contentType,
      sizeBytes: Number(attachment.sizeBytes),
      status: attachment.status.toLocaleLowerCase("en-US"),
      errorCode: attachment.scanErrorCode,
      createdAt: attachment.createdAt,
      scannedAt: attachment.scannedAt,
    })),
  };
}

type SupportMessageForSerialization = {
  id: string;
  authorType: string;
  authorUser?: { email: string; profile?: { fullName: string | null } | null } | null;
  kind: string;
  body: string;
  createdAt: Date;
  attachments: Array<{
    id: string;
    originalName: string;
    contentType: string;
    sizeBytes: bigint;
    status: string;
    scanErrorCode: string | null;
    createdAt: Date;
    scannedAt: Date | null;
  }>;
  accessGrant?: {
    id: string;
    scopeType: string;
    company: { name: string };
    venue: { name: string } | null;
    expiresAt: Date;
    revokedAt: Date | null;
  } | null;
};

function serializeSupportMessage(message: SupportMessageForSerialization) {
  return {
    id: message.id,
    authorType: message.authorType.toLocaleLowerCase("en-US"),
    authorName:
      message.authorType === "INTERNAL"
        ? "Техподдержка"
        : message.authorUser?.profile?.fullName || message.authorUser?.email || "Пользователь",
    kind: message.kind.toLocaleLowerCase("en-US"),
    body: message.body,
    createdAt: message.createdAt,
    attachments: message.attachments.map((attachment) => ({
      id: attachment.id,
      originalName: normalizeOriginalName(attachment.originalName),
      contentType: attachment.contentType,
      sizeBytes: Number(attachment.sizeBytes),
      status: attachment.status.toLocaleLowerCase("en-US"),
      errorCode: attachment.scanErrorCode,
      createdAt: attachment.createdAt,
      scannedAt: attachment.scannedAt,
    })),
    accessGrant: message.accessGrant
      ? {
          id: message.accessGrant.id,
          scopeType: message.accessGrant.scopeType,
          companyName: message.accessGrant.company.name,
          venueName: message.accessGrant.venue?.name ?? null,
          expiresAt: message.accessGrant.expiresAt,
          revokedAt: message.accessGrant.revokedAt,
          active: !message.accessGrant.revokedAt && message.accessGrant.expiresAt > new Date(),
        }
      : null,
  };
}
