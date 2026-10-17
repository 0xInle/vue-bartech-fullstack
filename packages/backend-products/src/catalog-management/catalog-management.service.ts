import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma as PrismaNamespace, type Prisma, type PrismaClient } from "@bartech/database";
import {
  catalogIdentityKey,
  normalize,
  normalizeSearchValue,
} from "../catalog-review/catalog-review.repository.js";
import { CatalogManagementRepository } from "./catalog-management.repository.js";

type IngredientInput = {
  name: string;
  categoryCode: string;
  brand?: string | null;
  strength?: number | null;
  country?: string | null;
  externalIdentifier?: string | null;
};

@Injectable()
export class CatalogManagementService {
  constructor(private readonly repository: CatalogManagementRepository) {}

  async list(query: string, status: "ACTIVE" | "ALL", offset: number, limit: number) {
    const rows = await this.repository.list(query, status, offset, limit);
    return {
      items: rows.slice(0, limit).map((row) => ({
        id: row.id,
        name: row.name,
        status: row.status,
        categoryCode: row.ingredient?.categoryCode ?? "",
        brand: row.ingredient?.brand ?? null,
        strength: row.ingredient?.strength?.toString() ?? null,
      })),
      hasMore: rows.length > limit,
    };
  }

  async get(id: string) {
    const card = await this.repository.findCard(this.repository.database, id);
    if (!card?.ingredient) throw globalIngredientNotFound();
    return toCardDto(card);
  }

  async update(id: string, input: IngredientInput, internalUserId: string) {
    try {
      return await this.repository.transaction(async (transaction) => {
        await this.repository.lockCategoryTree(transaction);
        await this.repository.lockCards(transaction, [id]);
        const card = await this.repository.findCard(transaction, id);
        if (!card?.ingredient || card.status !== "ACTIVE") throw globalIngredientNotFound();
        const normalized = normalizeInput(input);
        const category = await this.repository.findAnyCategory(
          transaction,
          normalized.categoryCode,
        );
        if (
          !category ||
          (!category.isActive && card.ingredient.categoryCode !== normalized.categoryCode)
        ) {
          throw new BadRequestException("Выберите доступную категорию ингредиента");
        }
        const identityKey = catalogIdentityKey(normalized);
        const owner = await this.repository.findIdentityOwner(transaction, identityKey, [id]);
        if (owner) throw identityConflict(owner.id, owner.name);
        await transaction.product.update({
          where: { id },
          data: {
            name: normalized.name,
            nameNormalized: normalize(normalized.name),
            searchNameNormalized: normalizeSearchValue(normalized.name),
            catalogIdentityKey: identityKey,
            ingredient: {
              update: {
                categoryCode: normalized.categoryCode,
                brand: normalized.brand,
                brandNormalized: normalized.brand ? normalize(normalized.brand) : null,
                searchBrandNormalized: normalized.brand
                  ? normalizeSearchValue(normalized.brand)
                  : null,
                strength: normalized.strength,
                country: normalized.country,
                externalIdentifier: normalized.externalIdentifier,
                searchAttributesNormalized: normalizeSearchValue(
                  [
                    normalized.categoryCode,
                    normalized.brand,
                    normalized.strength,
                    normalized.country,
                    normalized.externalIdentifier,
                  ]
                    .filter((value) => value !== null && value !== undefined && value !== "")
                    .join(" "),
                ),
              },
            },
          },
        });
        await this.writeAudit(transaction, internalUserId, id, "global_ingredient.updated", {
          productId: id,
        });
        const updated = await this.repository.findCard(transaction, id);
        if (!updated?.ingredient) throw globalIngredientNotFound();
        return toCardDto(updated);
      });
    } catch (error) {
      throwKnownConflict(error);
    }
  }

  async addAlias(productId: string, value: string, internalUserId: string) {
    try {
      return await this.repository.transaction(async (transaction) => {
        await this.repository.lockCards(transaction, [productId]);
        const card = await this.repository.findCard(transaction, productId);
        if (!card?.ingredient || card.status !== "ACTIVE") throw globalIngredientNotFound();
        const alias = normalizeAlias(value);
        if (normalize(alias.value) === normalize(card.name)) {
          throw new ConflictException({
            code: "CATALOG_ALIAS_CONFLICT",
            message: "Название уже указано в карточке",
            productId,
            name: card.name,
          });
        }
        const owner = await this.repository.findAliasOwner(
          transaction,
          [alias.valueNormalized],
          [productId],
        );
        if (owner) throw aliasConflict(owner.product.id, owner.product.name);
        const created = await transaction.productAlias.create({
          data: { productId, ...alias, isConfirmed: false },
        });
        await transaction.product.update({
          where: { id: productId },
          data: { updatedAt: new Date() },
        });
        await this.writeAudit(transaction, internalUserId, productId, "global_alias.created", {
          productId,
          aliasId: created.id,
          isConfirmed: false,
        });
        return toAliasDto(created);
      });
    } catch (error) {
      throwKnownConflict(error);
    }
  }

  async confirmAlias(productId: string, aliasId: string, internalUserId: string) {
    return this.repository.transaction(async (transaction) => {
      await this.repository.lockCards(transaction, [productId]);
      const card = await this.repository.findCard(transaction, productId);
      if (!card?.ingredient || card.status !== "ACTIVE") throw globalIngredientNotFound();
      const alias = await this.repository.findAlias(transaction, aliasId, productId);
      if (!alias) throw new NotFoundException("Алиас не найден");
      if (!alias.isConfirmed) {
        await transaction.productAlias.update({
          where: { id: aliasId },
          data: { isConfirmed: true },
        });
        await transaction.product.update({
          where: { id: productId },
          data: { updatedAt: new Date() },
        });
        await this.writeAudit(transaction, internalUserId, productId, "global_alias.confirmed", {
          productId,
          aliasId,
        });
      }
      return toAliasDto({ ...alias, isConfirmed: true });
    });
  }

  async deleteAlias(productId: string, aliasId: string, internalUserId: string) {
    return this.repository.transaction(async (transaction) => {
      await this.repository.lockCards(transaction, [productId]);
      const card = await this.repository.findCard(transaction, productId);
      if (!card?.ingredient || card.status !== "ACTIVE") throw globalIngredientNotFound();
      const alias = await this.repository.findAlias(transaction, aliasId, productId);
      if (!alias) throw new NotFoundException("Алиас не найден");
      await transaction.productAlias.delete({ where: { id: aliasId } });
      await transaction.product.update({
        where: { id: productId },
        data: { updatedAt: new Date() },
      });
      await this.writeAudit(transaction, internalUserId, productId, "global_alias.deleted", {
        productId,
        aliasId,
        isConfirmed: alias.isConfirmed,
      });
      return { id: aliasId, deleted: true };
    });
  }

  async previewMerge(canonicalId: string, duplicateId: string) {
    if (canonicalId === duplicateId) throw new BadRequestException("Выберите две разные карточки");
    const [canonical, duplicate] = await Promise.all([
      this.repository.findCard(this.repository.database, canonicalId),
      this.repository.findCard(this.repository.database, duplicateId),
    ]);
    if (!canonical?.ingredient || canonical.status !== "ACTIVE") throw globalIngredientNotFound();
    if (!duplicate?.ingredient) throw globalIngredientNotFound();
    return this.buildMergePreview(canonical, duplicate, this.repository.database);
  }

  async merge(
    canonicalId: string,
    duplicateId: string,
    canonicalUpdatedAt: string,
    duplicateUpdatedAt: string,
    internalUserId: string,
  ) {
    if (canonicalId === duplicateId) throw new BadRequestException("Выберите две разные карточки");
    try {
      return await this.repository.transaction(async (transaction) => {
        await this.repository.lockCards(transaction, [canonicalId, duplicateId]);
        const canonical = await this.repository.findCard(transaction, canonicalId);
        const duplicate = await this.repository.findCard(transaction, duplicateId);
        if (!canonical?.ingredient || canonical.status !== "ACTIVE" || !duplicate?.ingredient) {
          throw globalIngredientNotFound();
        }
        if (
          canonical.updatedAt.toISOString() !== canonicalUpdatedAt ||
          duplicate.updatedAt.toISOString() !== duplicateUpdatedAt
        ) {
          throw new ConflictException({
            code: "CATALOG_MERGE_STALE",
            message: "Карточки изменились. Обновите предварительный просмотр слияния.",
          });
        }
        const preview = await this.buildMergePreview(canonical, duplicate, transaction);
        if (preview.conflicts.length) throw mergeConflict(preview.conflicts);
        const merged = mergeValues(canonical, duplicate);
        const identityKey = catalogIdentityKey(merged);
        const identityOwner = await this.repository.findIdentityOwner(transaction, identityKey, [
          canonicalId,
          duplicateId,
        ]);
        if (identityOwner) {
          throw mergeConflict([
            { code: "IDENTITY_CONFLICT", productId: identityOwner.id, name: identityOwner.name },
          ]);
        }

        await transaction.product.update({
          where: { id: duplicateId },
          data: { catalogIdentityKey: null },
        });
        await transaction.product.update({
          where: { id: canonicalId },
          data: {
            name: merged.name,
            nameNormalized: normalize(merged.name),
            searchNameNormalized: normalizeSearchValue(merged.name),
            catalogIdentityKey: identityKey,
            ingredient: {
              update: {
                categoryCode: merged.categoryCode,
                brand: merged.brand,
                brandNormalized: merged.brand ? normalize(merged.brand) : null,
                searchBrandNormalized: merged.brand ? normalizeSearchValue(merged.brand) : null,
                strength: merged.strength,
                country: merged.country,
                externalIdentifier: merged.externalIdentifier,
                searchAttributesNormalized: normalizeSearchValue(
                  [
                    merged.categoryCode,
                    merged.brand,
                    merged.strength,
                    merged.country,
                    merged.externalIdentifier,
                  ]
                    .filter((value) => value !== null && value !== undefined && value !== "")
                    .join(" "),
                ),
              },
            },
          },
        });
        await transaction.productAlias.updateMany({
          where: { productId: duplicateId },
          data: { productId: canonicalId },
        });
        const oldNameAlias = normalizeAlias(duplicate.name);
        if (normalize(duplicate.name) !== normalize(canonical.name)) {
          const existingNameAlias = [...canonical.aliases, ...duplicate.aliases].find(
            (alias) => alias.valueNormalized === oldNameAlias.valueNormalized,
          );
          if (existingNameAlias) {
            if (!existingNameAlias.isConfirmed) {
              await transaction.productAlias.update({
                where: { id: existingNameAlias.id },
                data: { isConfirmed: true },
              });
            }
          } else {
            await transaction.productAlias.create({
              data: {
                productId: canonicalId,
                ...oldNameAlias,
                isConfirmed: true,
              },
            });
          }
        }
        const movedReferences = await this.repository.moveReferences(
          transaction,
          duplicateId,
          canonicalId,
        );
        await transaction.product.delete({ where: { id: duplicateId } });
        await this.writeAudit(
          transaction,
          internalUserId,
          canonicalId,
          "global_ingredient.merged",
          {
            canonicalProductId: canonicalId,
            duplicateProductId: duplicateId,
            movedReferences: movedReferences.count,
          },
        );
        return {
          canonicalProductId: canonicalId,
          deletedProductId: duplicateId,
          movedReferences: movedReferences.count,
        };
      });
    } catch (error) {
      throwKnownConflict(error);
    }
  }

  private async buildMergePreview(
    canonical: NonNullable<Awaited<ReturnType<CatalogManagementRepository["findCard"]>>>,
    duplicate: NonNullable<Awaited<ReturnType<CatalogManagementRepository["findCard"]>>>,
    database: Prisma.TransactionClient | PrismaClient,
  ) {
    const merged = mergeValues(canonical, duplicate);
    const oldNameAlias = normalizeAlias(duplicate.name);
    const aliasesToMove = duplicate.aliases.filter(
      (alias) =>
        !canonical.aliases.some((existing) => existing.valueNormalized === alias.valueNormalized),
    );
    const desiredAliasValues = [
      ...aliasesToMove.map((alias) => alias.valueNormalized),
      ...(normalize(duplicate.name) === normalize(canonical.name) ||
      canonical.aliases.some((alias) => alias.valueNormalized === oldNameAlias.valueNormalized) ||
      duplicate.aliases.some((alias) => alias.valueNormalized === oldNameAlias.valueNormalized)
        ? []
        : [oldNameAlias.valueNormalized]),
    ];
    const aliasOwner = await this.repository.findAliasOwner(database, desiredAliasValues, [
      canonical.id,
      duplicate.id,
    ]);
    const identityKey = catalogIdentityKey(merged);
    const identityOwner = await this.repository.findIdentityOwner(database, identityKey, [
      canonical.id,
      duplicate.id,
    ]);
    const conflicts = [
      ...(aliasOwner
        ? [
            {
              code: "ALIAS_CONFLICT",
              productId: aliasOwner.product.id,
              name: aliasOwner.product.name,
            },
          ]
        : []),
      ...(identityOwner
        ? [{ code: "IDENTITY_CONFLICT", productId: identityOwner.id, name: identityOwner.name }]
        : []),
    ];
    const referenceCount = await this.repository.countReferences(database, duplicate.id);
    return {
      canonical: toCardDto(canonical),
      duplicate: toCardDto(duplicate),
      merged,
      aliasesToMove: aliasesToMove.map((alias) => ({
        value: alias.value,
        isConfirmed: alias.valueNormalized === oldNameAlias.valueNormalized || alias.isConfirmed,
      })),
      oldNameAlias: normalize(duplicate.name) === normalize(canonical.name) ? null : duplicate.name,
      referenceCount,
      conflicts,
    };
  }

  private async writeAudit(
    transaction: Prisma.TransactionClient,
    internalUserId: string,
    productId: string,
    eventType: string,
    metadata: Prisma.InputJsonObject,
  ) {
    await transaction.auditEvent.create({
      data: {
        eventType: eventType.toUpperCase(),
        actorType: "INTERNAL_USER",
        internalUserId,
        entityType: "GLOBAL_INGREDIENT",
        entityId: productId,
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

function toCardDto(
  card: NonNullable<Awaited<ReturnType<CatalogManagementRepository["findCard"]>>>,
) {
  return {
    id: card.id,
    name: card.name,
    status: card.status,
    updatedAt: card.updatedAt.toISOString(),
    categoryCode: card.ingredient!.categoryCode,
    categoryName: card.ingredient!.category.name,
    categoryIsActive: card.ingredient!.category.isActive,
    brand: card.ingredient!.brand,
    strength: card.ingredient!.strength?.toString() ?? null,
    country: card.ingredient!.country,
    externalIdentifier: card.ingredient!.externalIdentifier,
    aliases: card.aliases.map(toAliasDto),
  };
}

function toAliasDto(alias: {
  id: string;
  value: string;
  isConfirmed: boolean;
  language: string | null;
}) {
  return {
    id: alias.id,
    value: alias.value,
    isConfirmed: alias.isConfirmed,
    language: alias.language,
  };
}

function normalizeInput(input: IngredientInput) {
  const name = input.name.trim().replace(/\s+/gu, " ");
  if (!normalize(name)) throw new BadRequestException("Укажите название ингредиента");
  const categoryCode = input.categoryCode.trim();
  if (!categoryCode) throw new BadRequestException("Выберите категорию ингредиента");
  return {
    name,
    categoryCode,
    brand: cleanOptional(input.brand),
    strength: input.strength ?? null,
    country: cleanOptional(input.country),
    externalIdentifier: cleanOptional(input.externalIdentifier),
  };
}

function normalizeAlias(value: string) {
  const normalizedValue = value.trim().replace(/\s+/gu, " ");
  if (!normalizedValue) throw new BadRequestException("Укажите название алиаса");
  return {
    value: normalizedValue,
    valueNormalized: normalize(normalizedValue),
    searchValueNormalized: normalizeSearchValue(normalizedValue),
  };
}

function cleanOptional(value?: string | null) {
  const cleaned = value?.trim().replace(/\s+/gu, " ");
  return cleaned || null;
}

function mergeValues(
  canonical: NonNullable<Awaited<ReturnType<CatalogManagementRepository["findCard"]>>>,
  duplicate: NonNullable<Awaited<ReturnType<CatalogManagementRepository["findCard"]>>>,
) {
  const canonicalIngredient = canonical.ingredient!;
  const duplicateIngredient = duplicate.ingredient!;
  return {
    name: canonical.name,
    categoryCode: canonicalIngredient.categoryCode,
    brand: canonicalIngredient.brand ?? duplicateIngredient.brand,
    strength: canonicalIngredient.strength ?? duplicateIngredient.strength,
    country: canonicalIngredient.country ?? duplicateIngredient.country,
    externalIdentifier:
      canonicalIngredient.externalIdentifier ?? duplicateIngredient.externalIdentifier,
  };
}

function identityConflict(productId: string, name: string) {
  return new ConflictException({
    code: "CATALOG_IDENTITY_CONFLICT",
    message: "Такая идентичность уже есть в глобальном каталоге",
    productId,
    name,
  });
}

function aliasConflict(productId: string, name: string) {
  return new ConflictException({
    code: "CATALOG_ALIAS_CONFLICT",
    message: "Такой нормализованный алиас уже принадлежит другой карточке",
    productId,
    name,
  });
}

function mergeConflict(conflicts: Array<{ code: string; productId: string; name: string }>) {
  return new ConflictException({
    code: "CATALOG_MERGE_CONFLICT",
    message: "Перед слиянием разрешите конфликты каталога",
    conflicts,
  });
}

function globalIngredientNotFound() {
  return new NotFoundException("Глобальный ингредиент не найден");
}

function throwKnownConflict(error: unknown): never {
  if (error instanceof PrismaNamespace.PrismaClientKnownRequestError && error.code === "P2002") {
    throw new ConflictException({
      code: "CATALOG_UNIQUE_CONFLICT",
      message: "Конфликт уникальности глобального каталога",
    });
  }
  throw error;
}
