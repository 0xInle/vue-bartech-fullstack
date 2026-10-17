import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { Prisma } from "@bartech/database";
import { CatalogCategoriesRepository } from "./catalog-categories.repository.js";

export type IngredientCategoryInput = {
  name: string;
  parentCode?: string | null;
  sortOrder?: number;
};

@Injectable()
export class CatalogCategoriesService {
  constructor(private readonly repository: CatalogCategoriesRepository) {}

  list() {
    return this.repository.list(this.repository.database);
  }

  async create(input: IngredientCategoryInput, internalUserId: string) {
    return this.repository.transaction(async (transaction) => {
      await this.repository.lockTree(transaction);
      const parentCode = normalizeParent(input.parentCode);
      await assertParent(transaction, this.repository, parentCode);
      const category = await this.repository.create(transaction, {
        code: randomUUID(),
        name: normalizeName(input.name),
        parent: parentCode ? { connect: { code: parentCode } } : undefined,
        sortOrder:
          input.sortOrder ?? (await this.repository.nextSortOrder(transaction, parentCode)),
        isActive: true,
      });
      await this.writeAudit(
        transaction,
        internalUserId,
        category.id,
        "ingredient_category.created",
        {
          code: category.code,
          parentCode: category.parentCode,
        },
      );
      return category;
    });
  }

  async update(code: string, input: Partial<IngredientCategoryInput>, internalUserId: string) {
    return this.repository.transaction(async (transaction) => {
      await this.repository.lockTree(transaction);
      const current = await this.repository.findByCode(transaction, code);
      if (!current) throw new NotFoundException("Категория не найдена");
      const parentCode =
        input.parentCode === undefined ? current.parentCode : normalizeParent(input.parentCode);
      if (code === "other" && (input.name !== undefined || parentCode !== null)) {
        throw new BadRequestException("Категорию «Другое» нельзя переименовать или переместить");
      }
      await assertParent(transaction, this.repository, parentCode, code);
      if (parentCode !== current.parentCode && current.parentCode === null) {
        const children = await this.repository.list(transaction);
        if (children.some((child) => child.parentCode === code)) {
          throw new BadRequestException("Сначала перенесите или удалите подкатегории");
        }
      }
      const category = await this.repository.update(transaction, code, {
        ...(input.name !== undefined ? { name: normalizeName(input.name) } : {}),
        ...(input.parentCode !== undefined
          ? { parent: parentCode ? { connect: { code: parentCode } } : { disconnect: true } }
          : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      });
      await this.writeAudit(
        transaction,
        internalUserId,
        category.id,
        "ingredient_category.updated",
        {
          code,
          changedFields: Object.keys(input),
        },
      );
      return category;
    });
  }

  async setActive(code: string, active: boolean, internalUserId: string) {
    return this.repository.transaction(async (transaction) => {
      await this.repository.lockTree(transaction);
      const current = await this.repository.findByCode(transaction, code);
      if (!current) throw new NotFoundException("Категория не найдена");
      if (code === "other" && !active) {
        throw new BadRequestException("Категорию «Другое» нельзя деактивировать");
      }
      if (active && current.parentCode) {
        const parent = await this.repository.findByCode(transaction, current.parentCode);
        if (!parent?.isActive)
          throw new BadRequestException("Сначала активируйте родительскую категорию");
      }
      if (!active && current.parentCode === null) {
        const children = await this.repository.list(transaction);
        if (children.some((child) => child.parentCode === code && child.isActive)) {
          throw new BadRequestException("Сначала перенесите или деактивируйте подкатегории");
        }
      }
      if (current.isActive === active) return current;
      const category = await this.repository.update(transaction, code, { isActive: active });
      const eventType = active
        ? "ingredient_category.activated"
        : "ingredient_category.deactivated";
      await this.writeAudit(transaction, internalUserId, category.id, eventType, { code });
      return category;
    });
  }

  private async writeAudit(
    transaction: Prisma.TransactionClient,
    internalUserId: string,
    categoryId: string,
    eventType: string,
    metadata: Prisma.InputJsonObject,
  ) {
    await transaction.auditEvent.create({
      data: {
        eventType: eventType.toUpperCase(),
        actorType: "INTERNAL_USER",
        internalUserId,
        entityType: "INGREDIENT_CATEGORY",
        entityId: categoryId,
        metadata,
      },
    });
    await transaction.internalAuditEvent.create({
      data: {
        eventType,
        actorType: "INTERNAL_USER",
        actorId: internalUserId,
        internalUserId,
        metadata,
      },
    });
  }
}

async function assertParent(
  transaction: Prisma.TransactionClient,
  repository: CatalogCategoriesRepository,
  parentCode: string | null,
  movingCode?: string,
) {
  if (!parentCode) return;
  const parent = await repository.findByCode(transaction, parentCode);
  if (!parent || !parent.isActive || parent.parentCode !== null || parent.code === movingCode) {
    throw new BadRequestException("Выберите активную корневую категорию");
  }
}

function normalizeName(value: string) {
  const name = value.trim().replace(/\s+/gu, " ");
  if (!name) throw new BadRequestException("Укажите название категории");
  return name;
}

function normalizeParent(value?: string | null) {
  return value?.trim() || null;
}
