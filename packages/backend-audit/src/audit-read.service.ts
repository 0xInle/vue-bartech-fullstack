import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { OrganizationsService } from "@bartech/backend-organizations";
import { Prisma } from "@bartech/database";
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
  "product.permanently_deleted",
  "PRODUCT_CATALOG_MATCHED",
];
const HIDDEN_EVENT_TYPES = ["export.requested", "export.completed", "export.failed"];
const COMPANY_CLOSURE_EVENTS = [
  "company.closure_started",
  "company.closure_cancelled",
  "company.closed",
];
const VENUE_LIFECYCLE_EVENTS = ["venue.created", "venue.closed"];
const PERMISSION_EVENT = [
  "membership.role_changed",
  "membership.permission_overrides_changed",
  "membership.ended",
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
  page?: number;
};

@Injectable()
export class AuditReadService {
  constructor(
    private readonly repository: AuditReadRepository,
    private readonly organizations: OrganizationsService,
  ) {}

  async list(context: AuditReadContext, query: AuditReadQuery) {
    const { where } = await this.buildWhere(context, query);

    const limit = [10, 20, 30].includes(query.limit ?? 20) ? (query.limit ?? 20) : 20;
    const page = Math.max(query.page ?? 1, 1);
    const [rows, totalRecords] = await Promise.all([
      this.repository.list(where, (page - 1) * limit, limit),
      this.repository.count(where),
    ]);
    const detailData = await this.repository.eventDetails(rows);
    const items = rows.slice(0, limit).map((row) => {
      const metadata = safeMetadata(row.metadata);
      const product = resolveProductContext(row, metadata, detailData);
      const resolvedMetadata = metadata
        ? {
            ...metadata,
            ...(product.name ? { name: product.name } : {}),
            ...(product.type ? { productType: product.type } : {}),
          }
        : product.name || product.type
          ? {
              ...(product.name ? { name: product.name } : {}),
              ...(product.type ? { productType: product.type } : {}),
            }
          : null;
      const details = eventDetails(
        row,
        resolvedMetadata,
        detailData,
        row.actorType === "INTERNAL_USER"
          ? (row.internalUser?.email ?? null)
          : (row.serviceSession?.internalUser.email ?? null),
      );
      if (product.usesCurrentName) details.push("Показано текущее название продукта");
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
        entityName: typeof resolvedMetadata?.name === "string" ? resolvedMetadata.name : null,
        summary: eventSummary(
          row.eventType,
          typeof resolvedMetadata?.name === "string" ? resolvedMetadata.name : null,
          typeof resolvedMetadata?.productType === "string" ? resolvedMetadata.productType : null,
        ),
        details,
        metadata: null,
        venueId: row.venueId,
      };
    });
    return { items, totalRecords };
  }

  async listAuthors(
    context: AuditReadContext,
    query: Omit<AuditReadQuery, "actorId" | "limit" | "page">,
  ) {
    const { where } = await this.buildWhere(context, query);
    return this.repository.listAuthors(where);
  }

  private async buildWhere(
    context: AuditReadContext,
    query: Omit<AuditReadQuery, "limit" | "page">,
  ) {
    const workspace = await this.organizations.findWorkspaceForUser(
      context.userId,
      context.companyId,
      context.venueId,
    );
    if (!workspace) throw new NotFoundException("Рабочее пространство не найдено");

    const fullHistory = workspace.permissions.includes("view_history");
    const excludedEventTypes = [
      ...COMPANY_CLOSURE_EVENTS,
      ...HIDDEN_EVENT_TYPES,
      ...VENUE_LIFECYCLE_EVENTS,
    ];
    const andConditions: Prisma.AuditEventWhereInput[] = [
      { eventType: { notIn: excludedEventTypes } },
    ];
    if (query.eventType) andConditions.push({ eventType: query.eventType });
    if (query.actorId) {
      andConditions.push({ OR: [{ actorId: query.actorId }, { internalUserId: query.actorId }] });
    }
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
      AND: andConditions,
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

function safeMetadata(value: Prisma.JsonValue | null): Record<string, unknown> | null {
  if (!value || Array.isArray(value) || typeof value !== "object") return null;
  const allowed = [
    "productType",
    "previousRole",
    "newRole",
    "granted",
    "revoked",
    "name",
    "subjectUserId",
    "subjectName",
    "subjectRole",
    "permissions",
    "purpose",
    "role",
    "localProductId",
    "globalProductId",
    "localName",
    "globalName",
    "changedReferences",
    "changes",
    "resolution",
    "scopeType",
    "expiresAt",
    "durationHours",
    "terminationDate",
    "closureDeadline",
    "closedAt",
    "exportType",
    "errorCode",
  ];
  return Object.fromEntries(
    Object.entries(value).filter(([key, entry]) => {
      if (!allowed.includes(key)) return false;
      if (key === "exportType")
        return [
          "SINGLE_PDF",
          "BATCH_PDF_ZIP",
          "VENUE_BACKUP_ZIP",
          "COMPANY_CLOSURE_BACKUP_ZIP",
          "COMPANY_CLOSURE_PDF_ZIP",
        ].includes(String(entry));
      if (key === "errorCode")
        return ["EXPORT_PROCESSING_FAILED", "DEADLINE_EXCEEDED"].includes(String(entry));
      if (
        [
          "name",
          "subjectRole",
          "productType",
          "previousRole",
          "newRole",
          "purpose",
          "role",
          "resolution",
          "scopeType",
          "expiresAt",
          "terminationDate",
          "localName",
          "globalName",
        ].includes(key)
      )
        return typeof entry === "string";
      if (["granted", "revoked", "permissions"].includes(key))
        return Array.isArray(entry) && entry.every((item) => typeof item === "string");
      if (key === "durationHours") return typeof entry === "number";
      if (key === "changedReferences")
        return typeof entry === "number" && Number.isInteger(entry) && entry >= 0;
      if (key === "changes")
        return (
          Array.isArray(entry) &&
          entry.length <= 50 &&
          entry.every((item) => typeof item === "string" && item.length <= 300)
        );
      if (["subjectUserId", "localProductId", "globalProductId"].includes(key)) return false;
      return true;
    }),
  );
}

function eventSummary(eventType: string, name: string | null, productType: string | null): string {
  const actions: Record<string, string> = {
    "support.access_granted": "Выдача доступа техподдержке",
    "support.access_revoked": "Отзыв доступа техподдержке",
    "service_access.started": "Сотрудник техподдержки подключился",
    "service_access.ended": "Сотрудник техподдержки завершил сессию",
    "membership.role_changed": "Изменена должность сотрудника",
    "membership.permission_overrides_changed": "Изменены права сотрудника",
    "membership.ended": "Сотрудник удалён из заведения",
    "temporary_responsibility.ended": "Завершена временная ответственность сотрудника",
    "invitation.created": "Создано приглашение",
    "invitation.revoked": "Приглашение отозвано",
    "invitation.expired": "Срок приглашения истёк",
    "invitation.completed": "Приглашение принято",
    PRODUCT_CATALOG_MATCHED: "Сопоставлен локальный ингредиент с каталогом",
  };
  if (!eventType.startsWith("product.")) return actions[eventType] ?? "Выполнено действие";

  if (!productType) {
    const subject = name ? `продукт «${name}»` : "продукт без сохранённого названия";
    const missingType = " (тип продукта в старой записи не сохранён)";
    const summaries: Record<string, string> = {
      "product.created": `Создан ${subject}${missingType}`,
      "product.updated": `Изменён ${subject}${missingType}`,
      "product.archived": `${subject} помещён в архив${missingType}`,
      "product.restored": `${subject} восстановлен из архива${missingType}`,
      "product.permanently_deleted": `Удалён ${subject}${missingType}; связанные данные также удалены`,
    };
    return summaries[eventType] ?? "Выполнено действие с продуктом";
  }

  const product = productDescriptor(productType);
  const subject = `${product.name}${name ? ` «${name}»` : ""}`;
  const actionsByType: Record<string, string> = {
    "product.created": `Создан${product.feminine ? "а" : ""} ${subject}`,
    "product.updated": `Изменён${product.feminine ? "а" : ""} ${subject}`,
    "product.archived": `${subject} помещён${product.feminine ? "а" : ""} в архив`,
    "product.restored": `${subject} восстановлен${product.feminine ? "а" : ""} из архива`,
    "product.permanently_deleted": `Удалён${product.feminine ? "а" : ""} ${subject} и связанные с ${product.feminine ? "ней" : "ним"} данные`,
  };
  return actionsByType[eventType] ?? "Выполнено действие с продуктом";
}

function eventDetails(
  row: { eventType: string; entityType: string; entityId: string; companyId: string | null },
  metadata: Record<string, unknown> | null,
  data: Awaited<ReturnType<AuditReadRepository["eventDetails"]>>,
  actorName: string | null,
): string[] {
  const details: string[] = [];
  details.push(...stringArray(metadata?.changes));
  if (row.eventType.startsWith("product.") && typeof metadata?.productType !== "string") {
    details.unshift("Тип продукта не сохранён в этой записи");
  }
  if (row.eventType.startsWith("product.") && typeof metadata?.name !== "string") {
    details.push("Название продукта не сохранено в этой записи");
  }
  const targetName =
    typeof metadata?.subjectName === "string"
      ? metadata.subjectName
      : data.memberships.get(row.entityId);
  if (targetName) details.push(`Сотрудник: ${targetName}`);
  if (row.eventType === "membership.role_changed" && metadata?.previousRole && metadata.newRole) {
    details.push(`Должность: ${roleLabel(metadata.previousRole)} → ${roleLabel(metadata.newRole)}`);
  }
  if (row.eventType === "membership.permission_overrides_changed") {
    for (const permission of stringArray(metadata?.granted))
      details.push(`Выдано право: ${permissionLabel(permission)}`);
    for (const permission of stringArray(metadata?.revoked))
      details.push(`Отозвано право: ${permissionLabel(permission)}`);
  }
  if (row.eventType === "membership.ended" && typeof metadata?.subjectRole === "string") {
    details.push(`Должность: ${roleLabel(metadata.subjectRole)}`);
  }
  const invitation = data.invitations.get(row.entityId);
  if (invitation) {
    details.push(`Приглашён: ${invitation.email}`);
    if (invitation.role) details.push(`Должность: ${roleLabel(invitation.role)}`);
    else details.push("Цель: создание заведения");
  }
  const grant = data.grants.get(row.entityId);
  if (row.eventType.startsWith("service_access.") && actorName) {
    details.push(`Сотрудник техподдержки: ${actorName}`);
  }
  if (grant) {
    details.push(`Область доступа: ${grant.scopeType === "COMPANY" ? "компания" : "заведение"}`);
    details.push(
      `Доступ действует до: ${new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(grant.expiresAt)}`,
    );
  }
  if (typeof metadata?.name === "string" && !row.eventType.startsWith("product."))
    details.push(metadata.name);
  if (typeof metadata?.resolution === "string") {
    const result = catalogResolutionLabel(metadata.resolution);
    details.push(`Результат сопоставления: ${result}`);
  }
  if (typeof metadata?.localName === "string" && typeof metadata.globalName === "string") {
    details.push(`Ингредиент: ${metadata.localName} → ${metadata.globalName}`);
  }
  if (typeof metadata?.changedReferences === "number") {
    details.push(`Обновлено ссылок в рецептах: ${metadata.changedReferences}`);
  }
  return details;
}

function roleLabel(value: unknown): string {
  const labels: Record<string, string> = {
    BAR_MANAGER: "бар-менеджер",
    CHEF_BARTENDER: "шеф-бармен",
    HEAD_BARTENDER: "шеф-бармен",
    SENIOR_BARTENDER: "старший бармен",
    BARTENDER: "бармен",
    BARBACK: "барбек",
    TRAINEE: "стажёр",
  };
  return typeof value === "string" ? (labels[value] ?? value) : "неизвестно";
}

function resolveProductContext(
  row: { id: string; eventType: string; entityType: string; entityId: string; createdAt: Date },
  metadata: Record<string, unknown> | null,
  data: Awaited<ReturnType<AuditReadRepository["eventDetails"]>>,
): { name: string | null; type: string | null; usesCurrentName: boolean } {
  if (row.entityType !== "PRODUCT" || !row.eventType.startsWith("product.")) {
    return { name: null, type: null, usesCurrentName: false };
  }

  let name = typeof metadata?.name === "string" ? metadata.name : null;
  let type = typeof metadata?.productType === "string" ? metadata.productType : null;
  const history = data.productHistory.filter(
    (event) =>
      event.entityId === row.entityId && event.id !== row.id && event.createdAt <= row.createdAt,
  );
  for (const event of history) {
    const previous = safeMetadata(event.metadata);
    if (!name && typeof previous?.name === "string") name = previous.name;
    if (!type && typeof previous?.productType === "string") type = previous.productType;
    if (name && type) break;
  }

  const current = data.products.get(row.entityId);
  if (!type && current) type = current.type;
  const usesCurrentName =
    !name &&
    current !== undefined &&
    ["product.archived", "product.restored"].includes(row.eventType);
  if (usesCurrentName) name = current.name;

  return { name, type, usesCurrentName };
}

function productDescriptor(value: string | null): { name: string; feminine: boolean } {
  const descriptors: Record<string, { name: string; feminine: boolean }> = {
    INGREDIENT: { name: "ингредиент", feminine: false },
    COCKTAIL: { name: "коктейль", feminine: false },
    PREPARATION: { name: "заготовка", feminine: true },
    GARNISH: { name: "гарнир", feminine: false },
  };
  return value
    ? (descriptors[value] ?? { name: "продукт", feminine: false })
    : { name: "продукт", feminine: false };
}

function catalogResolutionLabel(value: string): string {
  const labels: Record<string, string> = {
    created: "создан ингредиент каталога",
    linked: "локальный ингредиент связан с ингредиентом каталога",
    automatic_exact: "выполнено автоматическое сопоставление по точному совпадению",
  };
  return labels[value] ?? "сопоставление выполнено";
}

function permissionLabel(value: string): string {
  const labels: Record<string, string> = {
    view_products: "просмотр продукции",
    view_archive: "просмотр архива",
    view_team: "просмотр команды",
    manage_products: "управление продукцией",
    manage_product_archive: "управление архивом продукции",
    export_data: "выгрузка данных",
    invite_employees: "приглашение сотрудников",
    invite_bar_manager: "приглашение бар-менеджера",
    invite_chef_bartender: "приглашение шеф-бармена",
    view_history: "просмотр истории",
    manage_team: "управление командой",
    manage_delegated_permissions: "управление делегированными правами",
    create_venues: "создание заведений",
    manage_venue: "управление заведением",
    manage_venues: "управление заведениями компании",
    manage_company: "управление компанией",
    view_schedule: "просмотр графика сотрудников",
    manage_schedule: "управление графиком",
    delete_products_permanently: "безвозвратное удаление продукции",
  };
  return labels[value.toLowerCase()] ?? value;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}
