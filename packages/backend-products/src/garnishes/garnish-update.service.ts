import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@bartech/database";
import { ProductContextAccess } from "../product-context-access.js";
import type { CreateProductContext, ProductBaseInput } from "../product.dto.js";
import {
  assertAllowedComponent,
  assertNonEmptyRecipe,
  assertPositiveAmount,
  normalizeProductName,
} from "../product-rules.js";
import { normalizeSearchText } from "../search/product-search-rules.js";
import { garnishImpactFingerprint } from "./garnish-impact.js";
import { GarnishUpdateRepository } from "./garnish-update.repository.js";

export type UpdateGarnishInput = ProductBaseInput & { confirmationFingerprint?: string };

@Injectable()
export class GarnishUpdateService {
  constructor(
    private readonly repository: GarnishUpdateRepository,
    private readonly access: ProductContextAccess,
  ) {}

  async update(context: CreateProductContext, garnishId: string, input: UpdateGarnishInput) {
    await this.assertPermission(context);
    const normalized = normalizeInput(input);
    assertNonEmptyRecipe(normalized.technology, normalized.components);
    for (const component of normalized.components) assertPositiveAmount(component.amount);
    if (normalized.output) assertPositiveAmount(normalized.output.amount);

    try {
      return await this.repository.database.$transaction(async (transaction) => {
        await this.access.assert(context, "manage_products", transaction);
        await this.repository.lockVenue(transaction, context.venueId);
        const current = await this.repository.findActive(transaction, context.venueId, garnishId);
        if (!current || !current.technology) throw new NotFoundException("Гарнир не найден");

        const componentIds = [...new Set(normalized.components.map((item) => item.productId))];
        const [products, units] = await Promise.all([
          this.repository.findAllowedProducts(transaction, context.venueId, componentIds),
          this.repository.findAllowedUnits(transaction, context.venueId, [
            ...normalized.components.map((item) => item.unitId),
            ...(normalized.output ? [normalized.output.unitId] : []),
          ]),
        ]);
        const productsById = new Map(products.map((product) => [product.id, product]));
        for (const componentId of componentIds) {
          const component = productsById.get(componentId);
          if (!component) throw new NotFoundException("Компонент не найден в этом заведении");
          assertAllowedComponent("GARNISH", component.type);
        }
        const unitIds = new Set(units.map((unit) => unit.id));
        if (
          normalized.components.some((item) => !unitIds.has(item.unitId)) ||
          (normalized.output && !unitIds.has(normalized.output.unitId))
        ) {
          throw new NotFoundException("Единица измерения не найдена в этом заведении");
        }

        if (sameGarnish(current, normalized)) {
          return {
            id: current.id,
            type: "GARNISH" as const,
            name: current.name,
            venueId: context.venueId,
          };
        }

        const affectedProducts = await this.repository.findActiveDependents(
          transaction,
          context.venueId,
          garnishId,
        );
        if (affectedProducts.length) {
          const confirmationFingerprint = garnishImpactFingerprint(
            context.venueId,
            garnishId,
            normalized,
            affectedProducts,
          );
          if (confirmationFingerprint !== input.confirmationFingerprint) {
            throw new ConflictException({
              code: "GARNISH_DEPENDENCIES_CONFIRMATION_REQUIRED",
              message: "Изменения затронут связанные коктейли. Подтвердите сохранение",
              affectedProducts,
              confirmationFingerprint,
            });
          }
        }

        const product = await this.repository.replace(transaction, {
          id: garnishId,
          venueId: context.venueId,
          userId: context.userId,
          ...normalized,
          searchNameNormalized: normalizeSearchText(normalized.name),
          searchTechnologyNormalized: normalizeSearchText(normalized.technology),
          components: normalized.components.map((component, position) => ({
            ...component,
            position,
            productVenueId: productsById.get(component.productId)!.venueId,
          })),
        });
        if (context.internalUserId) {
          await Promise.all([
            transaction.auditEvent.create({
              data: {
                eventType: "product.updated",
                actorType: "INTERNAL_USER",
                internalUserId: context.internalUserId,
                serviceSessionId: context.serviceSessionId,
                companyId: context.companyId,
                venueId: context.venueId,
                entityType: "PRODUCT",
                entityId: product.id,
                metadata: { productType: product.type, name: product.name },
              },
            }),
            transaction.internalAuditEvent.create({
              data: {
                eventType: "product.updated",
                actorType: "INTERNAL_USER",
                internalUserId: context.internalUserId,
                companyId: context.companyId,
                venueId: context.venueId,
                serviceSessionId: context.serviceSessionId,
                metadata: {
                  grantId: context.grantId,
                  serviceSessionId: context.serviceSessionId,
                  entityType: "PRODUCT",
                  entityId: product.id,
                  actorId: context.internalUserId,
                },
              },
            }),
          ]);
        } else {
          await transaction.auditEvent.create({
            data: {
              eventType: "product.updated",
              actorType: "USER",
              actorId: context.userId,
              companyId: context.companyId,
              venueId: context.venueId,
              entityType: "PRODUCT",
              entityId: product.id,
              metadata: { productType: product.type, name: product.name },
            },
          });
        }
        return product;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("Гарнир с таким названием уже существует");
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
        throw new ConflictException("Связанные данные изменились. Обновите страницу");
      }
      throw error;
    }
  }

  private async assertPermission(context: CreateProductContext): Promise<void> {
    await this.access.assert(context, "manage_products");
  }
}

function normalizeInput(input: ProductBaseInput) {
  const name = input.name.trim().replace(/\s+/gu, " ");
  const nameNormalized = normalizeProductName(name);
  if (!nameNormalized) throw new BadRequestException("Укажите название гарнира");
  return {
    name,
    nameNormalized,
    technology: input.technology.trim(),
    comment: input.comment?.trim() || undefined,
    output: input.output ? { amount: input.output.amount, unitId: input.output.unitId } : undefined,
    components: input.components.map((item) => ({
      productId: item.productId,
      amount: item.amount,
      unitId: item.unitId,
    })),
  };
}

function sameGarnish(
  current: NonNullable<Awaited<ReturnType<GarnishUpdateRepository["findActive"]>>>,
  next: ReturnType<typeof normalizeInput>,
): boolean {
  return (
    current.name === next.name &&
    current.technology?.trim() === next.technology &&
    (current.comment?.trim() || undefined) === next.comment &&
    (current.outputAmount ? Number(current.outputAmount) : undefined) === next.output?.amount &&
    (current.outputUnitId || undefined) === next.output?.unitId &&
    current.parentComponents.length === next.components.length &&
    current.parentComponents.every(
      (component, index) =>
        component.componentProductId === next.components[index]?.productId &&
        component.unitId === next.components[index]?.unitId &&
        Number(component.amount) === next.components[index]?.amount,
    )
  );
}
