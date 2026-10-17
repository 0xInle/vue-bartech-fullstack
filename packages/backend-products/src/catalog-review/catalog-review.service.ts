import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Prisma } from "@bartech/database";
import { Prisma as PrismaNamespace } from "@bartech/database";
import type { GlobalIngredientInput } from "./catalog-review.dto.js";
import {
  CatalogReviewRepository,
  normalize,
  normalizeSearchValue,
} from "./catalog-review.repository.js";

@Injectable()
export class CatalogReviewService {
  constructor(private readonly repository: CatalogReviewRepository) {}

  async listCandidates(offset: number, limit: number) {
    const candidates = await this.repository.listCandidates(offset, limit);
    return {
      items: candidates.slice(0, limit).map(toCandidateDto),
      hasMore: candidates.length > limit,
    };
  }

  async getCandidate(id: string) {
    const candidate = await this.repository.getCandidate(id);
    if (!candidate?.localProduct.ingredient || !candidate.localProduct.venueId) {
      throw new NotFoundException("Кандидат каталога не найден");
    }
    return toCandidateDto(candidate);
  }

  async searchGlobalIngredients(query: string, offset: number, limit: number) {
    const normalized = normalizeSearchValue(query.trim());
    if (normalized.length < 2) throw new BadRequestException("Введите не менее двух символов");
    const items = await this.repository.searchGlobalIngredients(normalized, offset, limit);
    return items.map((item) => ({
      id: item.id,
      name: item.name,
      categoryCode: item.ingredient?.categoryCode ?? "",
      brand: item.ingredient?.brand ?? null,
      strength: item.ingredient?.strength?.toString() ?? null,
      country: item.ingredient?.country ?? null,
    }));
  }

  listCategories() {
    return this.repository.listCategories();
  }

  linkCandidate(candidateId: string, globalProductId: string, internalUserId: string) {
    return this.resolveToGlobal(candidateId, internalUserId, globalProductId);
  }

  createGlobalFromCandidate(
    candidateId: string,
    input: GlobalIngredientInput,
    internalUserId: string,
  ) {
    return this.repository
      .transaction(async (transaction) => {
        await this.repository.lockCategoryTree(transaction);
        const initial = await this.repository.findCandidate(transaction, candidateId);
        if (!initial?.localProduct.venueId) throw candidateUnavailable();
        const venueId = initial.localProduct.venueId;
        await this.repository.lockVenue(transaction, venueId);
        await this.repository.lockLocalProduct(transaction, initial.localProduct.id);
        const candidate = await this.repository.findCandidate(transaction, candidateId);
        if (!candidate?.localProduct.ingredient || candidate.localProduct.venueId !== venueId) {
          throw candidateUnavailable();
        }
        const categoryCode = input.categoryCode.trim();
        if (!(await this.repository.findCategory(transaction, categoryCode))) {
          throw new BadRequestException("Выберите доступную категорию ингредиента");
        }
        const name = input.name.trim().replace(/\s+/gu, " ");
        if (!normalize(name)) throw new BadRequestException("Укажите название ингредиента");
        const ingredient = await this.repository.createGlobalIngredient(transaction, {
          ...input,
          name,
          categoryCode,
        });
        await this.replaceAndAudit(
          transaction,
          candidate,
          ingredient.id,
          internalUserId,
          "created",
        );
        return { id: ingredient.id, name: ingredient.name };
      })
      .catch((error: unknown) => {
        if (
          error instanceof PrismaNamespace.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          throw new ConflictException("Такой глобальный ингредиент уже существует");
        }
        throw error;
      });
  }

  keepLocal(candidateId: string, internalUserId: string) {
    return this.repository.transaction(async (transaction) => {
      const initial = await this.repository.findCandidate(transaction, candidateId);
      if (!initial?.localProduct.venueId) throw candidateUnavailable();
      await this.repository.lockVenue(transaction, initial.localProduct.venueId);
      await this.repository.lockLocalProduct(transaction, initial.localProduct.id);
      const candidate = await this.repository.findCandidate(transaction, candidateId);
      if (!candidate?.localProduct.venueId) throw candidateUnavailable();
      const now = new Date();
      const resolved = await this.repository.resolveLocal(transaction, candidateId, now);
      if (!resolved.count) throw candidateUnavailable();
      await transaction.internalAuditEvent.create({
        data: {
          eventType: "catalog_candidate.kept_local",
          actorType: "INTERNAL_USER",
          actorId: internalUserId,
          internalUserId,
          companyId: (
            await transaction.venue.findUnique({
              where: { id: candidate.localProduct.venueId },
              select: { companyId: true },
            })
          )?.companyId,
          venueId: candidate.localProduct.venueId,
          metadata: { localProductId: candidate.localProduct.id, candidateId },
        },
      });
      return { id: candidateId, status: "RESOLVED" as const };
    });
  }

  private async resolveToGlobal(
    candidateId: string,
    internalUserId: string,
    globalProductId: string,
  ) {
    return this.repository.transaction(async (transaction) => {
      const initial = await this.repository.findCandidate(transaction, candidateId);
      if (!initial?.localProduct.venueId) throw candidateUnavailable();
      const venueId = initial.localProduct.venueId;
      await this.repository.lockVenue(transaction, venueId);
      await this.repository.lockLocalProduct(transaction, initial.localProduct.id);
      const candidate = await this.repository.findCandidate(transaction, candidateId);
      if (!candidate?.localProduct.ingredient || candidate.localProduct.venueId !== venueId) {
        throw candidateUnavailable();
      }
      const global = await this.repository.findGlobalIngredient(transaction, globalProductId);
      if (!global?.ingredient) throw new NotFoundException("Глобальный ингредиент не найден");
      await this.replaceAndAudit(transaction, candidate, global.id, internalUserId, "linked");
      return { id: global.id, name: global.name };
    });
  }

  private async replaceAndAudit(
    transaction: Prisma.TransactionClient,
    candidate: NonNullable<Awaited<ReturnType<CatalogReviewRepository["findCandidate"]>>>,
    globalProductId: string,
    internalUserId: string,
    resolution: "created" | "linked",
  ) {
    const local = candidate.localProduct;
    if (!local.venueId || !local.ingredient || local.status !== "ACTIVE") {
      throw new ConflictException("Локальный ингредиент недоступен для обработки");
    }
    const venue = await transaction.venue.findUnique({
      where: { id: local.venueId },
      select: { companyId: true },
    });
    if (!venue) throw new NotFoundException("Кандидат каталога не найден");
    await this.repository.replaceVenueReferences(
      transaction,
      local.venueId,
      local.id,
      globalProductId,
    );
    await transaction.auditEvent.create({
      data: {
        eventType: "PRODUCT_CATALOG_MATCHED",
        actorType: "INTERNAL_USER",
        internalUserId,
        companyId: venue.companyId,
        venueId: local.venueId,
        entityType: "PRODUCT",
        entityId: local.id,
        metadata: { localProductId: local.id, globalProductId, resolution },
      },
    });
    await transaction.internalAuditEvent.create({
      data: {
        eventType: `catalog_candidate.${resolution}`,
        actorType: "INTERNAL_USER",
        actorId: internalUserId,
        internalUserId,
        companyId: venue.companyId,
        venueId: local.venueId,
        metadata: { localProductId: local.id, globalProductId, candidateId: candidate.id },
      },
    });
    await this.repository.deleteLocalAndCandidate(transaction, local.id, candidate.id);
  }
}

function candidateUnavailable() {
  return new ConflictException({
    code: "CATALOG_CANDIDATE_UNAVAILABLE",
    message: "Кандидат больше недоступен для обработки",
  });
}

function toCandidateDto(candidate: {
  id: string;
  status: string;
  reason: string;
  confidence: number | null;
  processedAt: Date;
  localProduct: {
    id: string;
    venueId: string | null;
    name: string;
    status: string;
    ingredient: {
      categoryCode: string;
      brand: string | null;
      strength: { toString(): string } | null;
      country: string | null;
      externalIdentifier: string | null;
    } | null;
  };
  suggestedGlobalProduct: { id: string; name: string } | null;
}) {
  if (!candidate.localProduct.venueId || !candidate.localProduct.ingredient) {
    throw new NotFoundException("Кандидат каталога не найден");
  }
  return {
    id: candidate.id,
    status: candidate.status as "NEEDS_REVIEW",
    reason: candidate.reason,
    confidence: candidate.confidence,
    processedAt: candidate.processedAt,
    local: {
      id: candidate.localProduct.id,
      name: candidate.localProduct.name,
      categoryCode: candidate.localProduct.ingredient.categoryCode,
      brand: candidate.localProduct.ingredient.brand,
      strength: candidate.localProduct.ingredient.strength?.toString() ?? null,
      country: candidate.localProduct.ingredient.country,
      externalIdentifier: candidate.localProduct.ingredient.externalIdentifier,
    },
    suggestion: candidate.suggestedGlobalProduct
      ? { id: candidate.suggestedGlobalProduct.id, name: candidate.suggestedGlobalProduct.name }
      : null,
  };
}
