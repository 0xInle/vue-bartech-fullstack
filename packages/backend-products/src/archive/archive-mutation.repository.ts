import { Inject, Injectable } from "@nestjs/common";
import { DATABASE_CLIENT, type Prisma, type PrismaClient } from "@bartech/database";
import type { CreateProductContext } from "../product.dto.js";
import { normalizeProductName } from "../product-rules.js";
import { normalizeSearchText } from "../search/product-search-rules.js";

@Injectable()
export class ArchiveMutationRepository {
  constructor(@Inject(DATABASE_CLIENT) readonly database: PrismaClient) {}

  lockVenue(transaction: Prisma.TransactionClient, venueId: string) {
    return transaction.$queryRaw<
      Array<{ pg_advisory_xact_lock: null }>
    >`SELECT pg_advisory_xact_lock(hashtextextended(${venueId}, 0))`;
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

  replaceComponent(
    transaction: Prisma.TransactionClient,
    venueId: string,
    rowId: string,
    productId: string,
  ) {
    return transaction.productComponent.update({
      where: { id: rowId, parentVenueId: venueId },
      data: { componentProductId: productId, componentVenueId: venueId },
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

  audit(
    transaction: Prisma.TransactionClient,
    context: CreateProductContext,
    productId: string,
    eventType: "product.archived" | "product.restored",
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
      },
    });
  }
}
