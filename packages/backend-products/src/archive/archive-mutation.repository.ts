import { Inject, Injectable } from "@nestjs/common";
import { DATABASE_CLIENT, type Prisma, type PrismaClient } from "@bartech/database";
import type { CreateProductContext } from "../product.dto.js";
import { normalizeProductName } from "../product-rules.js";
import { normalizeSearchText } from "../search/product-search-rules.js";

type ArchiveDatabase = PrismaClient | Prisma.TransactionClient;

@Injectable()
export class ArchiveMutationRepository {
  constructor(@Inject(DATABASE_CLIENT) readonly database: PrismaClient) {}

  lockVenue(transaction: Prisma.TransactionClient, venueId: string) {
    return transaction.$queryRaw<Array<{ locked: boolean }>>`
      SELECT pg_advisory_xact_lock(hashtextextended(${venueId}, 0)) IS NULL AS locked
    `;
  }

  setStatus(
    transaction: Prisma.TransactionClient,
    context: CreateProductContext,
    productId: string,
    status: "ACTIVE" | "ARCHIVED",
    name?: string,
  ) {
    return transaction.product.update({
      where: { id: productId, venueId: context.venueId },
      data: {
        status,
        updatedByUserId: context.userId,
        ...(name
          ? {
              name,
              nameNormalized: normalizeProductName(name),
              searchNameNormalized: normalizeSearchText(name),
            }
          : {}),
      },
      select: { id: true, type: true, name: true, status: true },
    });
  }

  globalIngredientReplacements(database: ArchiveDatabase) {
    return database.product.findMany({
      where: { venueId: null, type: "INGREDIENT", status: "ACTIVE" },
      orderBy: [{ nameNormalized: "asc" }, { id: "asc" }],
      select: { id: true, type: true, name: true },
    });
  }

  deletePermanentProduct(
    transaction: Prisma.TransactionClient,
    venueId: string,
    productId: string,
  ) {
    return transaction.product.delete({
      where: { id: productId, venueId },
      select: { id: true, type: true, name: true },
    });
  }

  replaceComponent(
    transaction: Prisma.TransactionClient,
    venueId: string,
    rowId: string,
    productId: string,
    componentVenueId: string | null,
  ) {
    return transaction.productComponent.update({
      where: { id: rowId, parentVenueId: venueId },
      data: { componentProductId: productId, componentVenueId },
    });
  }

  replaceGarnish(
    transaction: Prisma.TransactionClient,
    venueId: string,
    rowId: string,
    productId: string,
  ) {
    return transaction.cocktailGarnish.update({
      where: { id: rowId, cocktailVenueId: venueId },
      data: { garnishId: productId, garnishVenueId: venueId },
    });
  }

  replacementProduct(database: ArchiveDatabase, venueId: string, productId: string) {
    return database.product.findFirst({
      where: {
        id: productId,
        status: "ACTIVE",
        OR: [{ venueId }, { venueId: null, type: "INGREDIENT" }],
      },
      select: { id: true, venueId: true, type: true },
    });
  }

  deleteReferencesToProducts(
    transaction: Prisma.TransactionClient,
    venueId: string,
    ids: string[],
  ) {
    return Promise.all([
      transaction.productComponent.deleteMany({
        where: {
          componentProductId: { in: ids },
          componentVenueId: venueId,
          parentVenueId: venueId,
        },
      }),
      transaction.cocktailGarnish.deleteMany({
        where: { garnishId: { in: ids }, garnishVenueId: venueId, cocktailVenueId: venueId },
      }),
    ]);
  }

  touchParentProduct(
    transaction: Prisma.TransactionClient,
    venueId: string,
    productId: string,
    userId: string | null,
  ) {
    return transaction.product.update({
      where: { id: productId, venueId },
      data: { updatedByUserId: userId },
      select: { id: true },
    });
  }

  audit(
    transaction: Prisma.TransactionClient,
    context: CreateProductContext,
    productId: string,
    eventType:
      "product.archived" | "product.restored" | "product.updated" | "product.permanently_deleted",
    metadata?: Prisma.InputJsonObject,
  ) {
    return transaction.auditEvent.create({
      data: {
        eventType,
        actorType: "USER",
        actorId: context.userId,
        companyId: context.companyId,
        venueId: context.venueId,
        entityType: "PRODUCT",
        entityId: productId,
        metadata,
      },
    });
  }
}
