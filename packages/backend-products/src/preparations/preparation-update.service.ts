import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@bartech/database";
import { ProductContextAccess } from "../product-context-access.js";
import type { CreateProductContext, PreparationInput } from "../product.dto.js";
import {
  assertAllowedComponent,
  assertNonEmptyRecipe,
  assertPositiveAmount,
  assertPreparationGraphAcyclic,
  normalizeProductName,
  normalizeReferenceCode,
} from "../product-rules.js";
import { normalizeSearchText } from "../search/product-search-rules.js";
import { findPreparationImpact, preparationImpactFingerprint } from "./preparation-impact.js";
import { PreparationUpdateRepository } from "./preparation-update.repository.js";

export type UpdatePreparationInput = PreparationInput & { confirmationFingerprint?: string };

@Injectable()
export class PreparationUpdateService {
  constructor(
    private readonly repository: PreparationUpdateRepository,
    private readonly access: ProductContextAccess,
  ) {}

  async update(
    context: CreateProductContext,
    preparationId: string,
    input: UpdatePreparationInput,
  ) {
    await this.assertPermission(context);
    const normalized = normalizeInput(input);
    assertNonEmptyRecipe(normalized.technology, normalized.components);
    for (const component of normalized.components) assertPositiveAmount(component.amount);
    if (normalized.output) assertPositiveAmount(normalized.output.amount);

    try {
      return await this.repository.database.$transaction(async (transaction) => {
        await this.access.assert(context, "manage_products", transaction);
        await this.repository.lockVenue(transaction, context.venueId);
        const current = await this.repository.findActive(
          transaction,
          context.venueId,
          preparationId,
        );
        if (!current?.preparation) throw new NotFoundException("Заготовка не найдена");

        const category = await this.repository.findCategory(transaction, normalized.categoryCode);
        if (!category) throw new BadRequestException("Выберите доступную категорию заготовки");

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
          assertAllowedComponent("PREPARATION", component.type);
        }
        const unitIds = new Set(units.map((unit) => unit.id));
        if (
          normalized.components.some((item) => !unitIds.has(item.unitId)) ||
          (normalized.output && !unitIds.has(normalized.output.unitId))
        ) {
          throw new NotFoundException("Единица измерения не найдена в этом заведении");
        }

        const edges = await this.repository.findPreparationEdges(transaction, context.venueId);
        assertPreparationGraphAcyclic(
          preparationId,
          componentIds,
          edges.filter((edge) => edge.parentProductId !== preparationId),
        );

        if (samePreparation(current, normalized)) {
          return {
            id: current.id,
            type: "PREPARATION" as const,
            name: current.name,
            venueId: context.venueId,
          };
        }

        const dependents = await this.repository.findActiveDependents(transaction, context.venueId);
        const affectedProducts = findPreparationImpact(preparationId, dependents);
        if (affectedProducts.length) {
          const confirmationFingerprint = preparationImpactFingerprint(
            context.venueId,
            preparationId,
            normalized,
            affectedProducts,
          );
          if (confirmationFingerprint !== input.confirmationFingerprint) {
            throw new ConflictException({
              code: "PREPARATION_DEPENDENCIES_CONFIRMATION_REQUIRED",
              message: "Изменения затронут связанную продукцию. Подтвердите сохранение",
              affectedProducts,
              confirmationFingerprint,
            });
          }
        }

        const product = await this.repository.replace(transaction, {
          id: preparationId,
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
        throw new ConflictException("Заготовка с таким названием уже существует");
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

function normalizeInput(input: PreparationInput) {
  const name = input.name.trim().replace(/\s+/gu, " ");
  const nameNormalized = normalizeProductName(name);
  if (!nameNormalized) throw new BadRequestException("Укажите название заготовки");
  return {
    name,
    nameNormalized,
    categoryCode: normalizeReferenceCode(input.categoryCode),
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

function samePreparation(
  current: NonNullable<Awaited<ReturnType<PreparationUpdateRepository["findActive"]>>>,
  next: ReturnType<typeof normalizeInput>,
): boolean {
  return (
    current.name === next.name &&
    current.preparation?.categoryCode === next.categoryCode &&
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
