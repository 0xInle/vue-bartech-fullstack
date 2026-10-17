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
  CreateSupportRequestDto,
  SupportQueueQueryDto,
  SupportReasonDto,
  SupportStatusDto,
  UpdateSupportRequestDto,
} from "./support.dto.js";

export const SUPPORT_FILE_MAX_BYTES = 20 * 1024 * 1024;
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
  ) {}

  async create(authorUserId: string, input: CreateSupportRequestDto, file?: SupportUploadFile) {
    const reason = toDatabaseReason(input.reason);
    const context = await this.resolveContext(authorUserId, input.companyId, input.venueId);
    const technicalContext: Record<string, string> = {};
    const browser = normalizeText(input.browser, 200);
    const errorId = normalizeErrorId(input.errorId);
    if (browser) technicalContext.browser = browser;
    if (errorId) technicalContext.errorId = errorId;

    const message = input.message.trim();
    if (!message) throw new BadRequestException("Напишите сообщение для поддержки");

    let attachment: {
      id: string;
      objectKey: string;
      originalName: string;
      contentType: string;
    } | null = null;
    let objectKey: string | undefined;
    if (file) {
      const validated = validateUpload(file);
      objectKey = `support-quarantine/${randomUUID()}`;
      await this.storage.put({
        key: objectKey,
        body: file.buffer,
        contentType: validated.contentType,
        fileName: validated.originalName,
      });
      attachment = {
        id: randomUUID(),
        objectKey,
        originalName: validated.originalName,
        contentType: validated.contentType,
      };
    }

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
            ...(attachment
              ? {
                  attachment: {
                    create: {
                      id: attachment.id,
                      uploadedByUserId: authorUserId,
                      originalName: attachment.originalName,
                      contentType: attachment.contentType,
                      sizeBytes: BigInt(file!.size),
                      objectKey: attachment.objectKey,
                      outbox: { create: {} },
                    },
                  },
                }
              : {}),
          },
          include: { attachment: true },
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
        return request;
      });
      return serializeRequest(created);
    } catch (error) {
      if (objectKey) await this.storage.delete(objectKey).catch(() => undefined);
      throw error;
    }
  }

  async listMine(authorUserId: string) {
    const requests = await this.database.supportRequest.findMany({
      where: { authorUserId },
      orderBy: { createdAt: "desc" },
      include: { attachment: true },
    });
    return requests.map(serializeRequest);
  }

  async getMine(authorUserId: string, requestId: string) {
    const request = await this.database.supportRequest.findFirst({
      where: { id: requestId, authorUserId },
      include: { attachment: true },
    });
    if (!request) throw new NotFoundException("Обращение не найдено");
    return serializeRequest(request);
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
          attachment: true,
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
        attachment: true,
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
      const updated = await transaction.supportRequest.update({
        where: { id: requestId },
        data: { status, assignedToId },
        include: { attachment: true },
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

  async createDownloadUrl(requestId: string, requester: { userId?: string; internal?: boolean }) {
    const attachment = await this.database.supportAttachment.findUnique({
      where: { requestId },
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
        attachment.originalName,
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
        where: { userId: authorUserId, companyId },
        select: { companyId: true },
      });
      if (!membership) throw new ForbiddenException("Выбранный контекст недоступен");
    }
    return { companyId: companyId ?? null, venueId: null };
  }
}

function toDatabaseReason(reason: SupportReasonDto) {
  return { data_migration: "DATA_MIGRATION", error: "ERROR", other: "OTHER" }[reason] as
    "DATA_MIGRATION" | "ERROR" | "OTHER";
}

function toDatabaseStatus(status: SupportStatusDto) {
  return { new: "NEW", in_progress: "IN_PROGRESS", closed: "CLOSED" }[status] as
    "NEW" | "IN_PROGRESS" | "CLOSED";
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
  const originalName = file.originalname.replace(/\\/gu, "/").split("/").at(-1)?.trim();
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
    case "png":
      return startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)
        ? { contentType: "image/png", acceptedMimeTypes: ["image/png"] }
        : null;
    case "jpg":
      return startsWith(0xff, 0xd8, 0xff)
        ? { contentType: "image/jpeg", acceptedMimeTypes: ["image/jpeg"] }
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
    case "csv": {
      const text = buffer.toString("utf8");
      const validText = !buffer.includes(0) && !text.includes("\uFFFD");
      return validText
        ? {
            contentType: "text/csv",
            acceptedMimeTypes: [
              "text/csv",
              "application/csv",
              "text/plain",
              "application/vnd.ms-excel",
            ],
          }
        : null;
    }
    default:
      return null;
  }
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
    attachment: {
      id: string;
      originalName: string;
      contentType: string;
      sizeBytes: bigint;
      status: string;
      scanErrorCode: string | null;
      createdAt: Date;
      scannedAt: Date | null;
    } | null;
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
    attachment: request.attachment
      ? {
          id: request.attachment.id,
          originalName: request.attachment.originalName,
          contentType: request.attachment.contentType,
          sizeBytes: Number(request.attachment.sizeBytes),
          status: request.attachment.status.toLocaleLowerCase("en-US"),
          errorCode: request.attachment.scanErrorCode,
          createdAt: request.attachment.createdAt,
          scannedAt: request.attachment.scannedAt,
        }
      : null,
  };
}
