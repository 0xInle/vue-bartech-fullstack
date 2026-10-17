import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { OrganizationsService } from "@bartech/backend-organizations";
import { ProductExportReadService } from "@bartech/backend-products";
import { FILE_STORAGE, type FileStorage } from "@bartech/backend-files";
import { Inject } from "@nestjs/common";
import type { ExportKind, ExportParameters, ExportState } from "./export.dto.js";
import { ExportRepository } from "./export.repository.js";

export type ExportWorkspace = { userId: string; companyId: string; venueId: string };

@Injectable()
export class ExportService {
  constructor(
    private readonly repository: ExportRepository,
    private readonly organizations: OrganizationsService,
    private readonly products: ProductExportReadService,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
  ) {}

  createSinglePdf(context: ExportWorkspace, productId: string) {
    return this.create(context, "SINGLE_PDF", { productIds: [productId] });
  }

  createBatch(context: ExportWorkspace, parameters: ExportParameters) {
    return this.create(context, "BATCH_PDF_ZIP", parameters);
  }

  createVenueBackup(context: ExportWorkspace) {
    return this.create(context, "VENUE_BACKUP_ZIP", {});
  }

  createClosureExport(input: {
    context: { userId: string; companyId: string; venueId: string | null };
    operationId: string;
    type: ExportKind;
    parameters: ExportParameters;
  }) {
    return this.createRequest(input.context, input.type, input.parameters, input.operationId);
  }

  async getStatus(context: ExportWorkspace, id: string) {
    const request = await this.authorizedRequest(context, id);
    return this.toResponse(request);
  }

  async getDownloadUrl(context: ExportWorkspace, id: string) {
    const request = await this.authorizedRequest(context, id);
    const now = new Date();
    if (
      request.status !== "READY" ||
      !request.objectKey ||
      !request.fileName ||
      !request.expiresAt
    ) {
      throw new NotFoundException("Готовая выгрузка недоступна");
    }
    const expiresInSeconds = Math.floor(
      Math.min(5 * 60_000, request.expiresAt.getTime() - now.getTime()) / 1000,
    );
    if (expiresInSeconds < 1) throw new NotFoundException("Срок хранения выгрузки истёк");
    return {
      url: await this.storage.createDownloadUrl(
        request.objectKey,
        request.fileName,
        expiresInSeconds,
      ),
      expiresAt: new Date(now.getTime() + expiresInSeconds * 1000).toISOString(),
    };
  }

  async getClosureDownloadUrl(userId: string, operationId: string) {
    const operation = await this.repository.findClosureOperation(operationId);
    const request = operation?.exportRequest;
    if (
      !operation ||
      operation.createdByUserId !== userId ||
      operation.status !== "CLOSED" ||
      !operation.closedAt ||
      !request ||
      request.userId !== userId ||
      request.status !== "READY" ||
      !request.objectKey ||
      !request.fileName ||
      !request.expiresAt ||
      request.expiresAt <= new Date()
    ) {
      throw new NotFoundException("Выгрузка закрытия недоступна");
    }
    return this.createDownloadUrl(request);
  }

  async getActiveClosureDownloadUrl(userId: string, operationId: string, companyId: string) {
    const operation = await this.repository.findClosureOperation(operationId);
    const request = operation?.exportRequest;
    if (
      !operation ||
      operation.createdByUserId !== userId ||
      operation.status === "CLOSED" ||
      operation.companyId !== companyId ||
      !request ||
      request.userId !== userId ||
      request.companyId !== companyId ||
      request.status !== "READY" ||
      !request.objectKey ||
      !request.fileName ||
      !request.expiresAt ||
      request.expiresAt <= new Date()
    ) {
      throw new NotFoundException("Выгрузка закрытия недоступна");
    }
    return this.createDownloadUrl(request);
  }

  private async createDownloadUrl(request: {
    objectKey: string | null;
    fileName: string | null;
    expiresAt: Date | null;
  }) {
    if (!request.objectKey || !request.fileName || !request.expiresAt) {
      throw new NotFoundException("Готовая выгрузка недоступна");
    }
    const now = new Date();
    const expiresInSeconds = Math.floor(
      Math.min(5 * 60_000, request.expiresAt.getTime() - now.getTime()) / 1000,
    );
    if (expiresInSeconds < 1) throw new NotFoundException("Срок хранения выгрузки истёк");
    return {
      url: await this.storage.createDownloadUrl(
        request.objectKey,
        request.fileName,
        expiresInSeconds,
      ),
      expiresAt: new Date(now.getTime() + expiresInSeconds * 1000).toISOString(),
    };
  }

  async create(context: ExportWorkspace, type: ExportKind, parameters: ExportParameters) {
    return this.createRequest(context, type, parameters);
  }

  private async createRequest(
    context: { userId: string; companyId: string; venueId: string | null },
    type: ExportKind,
    parameters: ExportParameters,
    closureOperationId?: string,
  ) {
    if (type === "COMPANY_CLOSURE_BACKUP_ZIP") {
      if (!closureOperationId || !Array.isArray(parameters.venueIds)) {
        throw new NotFoundException("Операция выгрузки недоступна");
      }
      const request = await this.repository.createClosure({
        ...context,
        closureOperationId,
        type,
        parameters,
      });
      return this.toResponse(request);
    }
    if (!context.venueId) throw new NotFoundException("Рабочее пространство не найдено");
    const workspace = await this.organizations.findWorkspaceForUser(
      context.userId,
      context.companyId,
      context.venueId,
    );
    if (
      !workspace ||
      workspace.company.id !== context.companyId ||
      workspace.venue.id !== context.venueId
    ) {
      throw new NotFoundException("Рабочее пространство не найдено");
    }
    if (!workspace.permissions.includes("export_data"))
      throw new ForbiddenException("У вас нет доступа к выгрузке данных");
    if (type === "VENUE_BACKUP_ZIP" && !workspace.permissions.includes("view_archive")) {
      throw new ForbiddenException("Для резервной выгрузки нужен доступ к архиву");
    }
    if (parameters.includeArchived && !workspace.permissions.includes("view_archive")) {
      throw new ForbiddenException("У вас нет доступа к архиву");
    }
    if (parameters.productIds) {
      if (new Set(parameters.productIds).size !== parameters.productIds.length) {
        throw new NotFoundException("Техкарта недоступна");
      }
      if (type === "SINGLE_PDF" && parameters.productIds.length !== 1) {
        throw new NotFoundException("Техкарта недоступна");
      }
      const snapshot = await this.products.readSnapshot(
        { companyId: context.companyId, venueId: context.venueId },
        parameters.productIds,
        parameters.includeArchived === true,
      );
      if (
        snapshot.products.some(
          (product) => !["COCKTAIL", "PREPARATION", "GARNISH"].includes(String(product.type)),
        )
      ) {
        throw new NotFoundException("Техкарта недоступна");
      }
    }
    const input = {
      userId: context.userId,
      companyId: context.companyId,
      venueId: context.venueId,
      type,
      parameters,
    };
    const request = closureOperationId
      ? await this.repository.createClosure({ ...input, closureOperationId })
      : await this.repository.create(input);
    return this.toResponse(request);
  }

  async prepare(id: string) {
    return this.repository.claim(id);
  }

  private async authorizedRequest(context: ExportWorkspace, id: string) {
    const request = await this.repository.findById(id);
    if (
      !request ||
      request.userId !== context.userId ||
      request.companyId !== context.companyId ||
      request.venueId !== context.venueId
    ) {
      throw new NotFoundException("Запрос выгрузки недоступен");
    }
    const workspace = await this.organizations.findWorkspaceForUser(
      context.userId,
      context.companyId,
      context.venueId,
    );
    if (!workspace || !workspace.permissions.includes("export_data")) {
      throw new NotFoundException("Запрос выгрузки недоступен");
    }
    return request;
  }

  private toResponse(request: {
    id: string;
    type: ExportKind;
    status: string;
    createdAt: Date;
    expiresAt: Date | null;
    errorCode: string | null;
  }) {
    const expired =
      request.status === "READY" && request.expiresAt !== null && request.expiresAt <= new Date();
    const status: ExportState = expired ? "EXPIRED" : (request.status as ExportState);
    return {
      id: request.id,
      type: request.type,
      status,
      createdAt: request.createdAt.toISOString(),
      expiresAt: request.expiresAt?.toISOString() ?? null,
      errorCode: request.status === "FAILED" ? request.errorCode : null,
    };
  }
}
