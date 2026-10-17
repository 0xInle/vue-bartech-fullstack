import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { Prisma } from "@bartech/database";
import type { ReferenceValueType } from "@bartech/database";
import { ProductContextAccess } from "./product-context-access.js";
import type {
  CocktailInput,
  CreateProductContext,
  LocalIngredientInput,
  PreparationInput,
  ProductBaseInput,
} from "./product.dto.js";
import {
  assertAllowedComponent,
  assertNonEmptyRecipe,
  assertPositiveAmount,
  assertPreparationGraphAcyclic,
  normalizeProductName,
  normalizeReferenceCode,
} from "./product-rules.js";
import { ProductsRepository } from "./products.repository.js";
import { normalizeSearchText } from "./search/product-search-rules.js";

@Injectable()
export class ProductsService {
  constructor(
    private readonly repository: ProductsRepository,
    private readonly access: ProductContextAccess,
  ) {}

  async getReferences(context: CreateProductContext) {
    await this.assertPermission(context, "view_products");
    return this.repository.getReferences(context.venueId);
  }

  async createLocalIngredient(context: CreateProductContext, input: LocalIngredientInput) {
    await this.assertPermission(context, "manage_products");
    const categoryCode = normalizeReferenceCode(input.categoryCode);
    const name = input.name.trim().replace(/\s+/gu, " ");
    const nameNormalized = normalizeProductName(name);
    if (!nameNormalized) throw new BadRequestException("Укажите название ингредиента");

    try {
      return await this.database().$transaction(async (transaction) => {
        await this.assertPermission(context, "manage_products", transaction);
        await this.repository.lockIngredientCategoryTree(transaction);
        if (!(await this.repository.findIngredientCategory(transaction, categoryCode))) {
          throw new BadRequestException("Выберите доступную категорию ингредиента");
        }
        const product = await this.repository.createLocalIngredient(transaction, {
          id: randomUUID(),
          venueId: context.venueId,
          userId: context.userId,
          name,
          nameNormalized,
          searchNameNormalized: normalizeSearchText(name),
          categoryCode,
          brand: normalizeOptional(input.brand),
          brandNormalized: input.brand ? normalizeProductName(input.brand) : undefined,
          searchBrandNormalized: input.brand ? normalizeSearchText(input.brand) : undefined,
          searchAttributesNormalized: normalizeSearchText(
            [categoryCode, input.brand, input.strength, input.country, input.externalIdentifier]
              .filter((value) => value !== undefined && value !== null && value !== "")
              .join(" "),
          ),
          strength: input.strength,
          country: normalizeOptional(input.country),
          externalIdentifier: normalizeOptional(input.externalIdentifier),
        });
        await this.recordProductEvent(transaction, context, "product.created", product);
        return product;
      });
    } catch (error) {
      throw mapProductConflict(error);
    }
  }

  async getLocalIngredient(context: CreateProductContext, productId: string) {
    await this.assertPermission(context, "view_products");
    const ingredient = await this.repository.findLocalIngredient(
      this.database(),
      context.venueId,
      productId,
    );
    if (!ingredient?.ingredient) throw new NotFoundException("Локальный ингредиент не найден");
    return {
      ...ingredient,
      ingredient: ingredient.ingredient
        ? {
            ...ingredient.ingredient,
            strength: ingredient.ingredient.strength?.toString() ?? null,
          }
        : null,
    };
  }

  async updateLocalIngredient(
    context: CreateProductContext,
    productId: string,
    input: LocalIngredientInput,
  ) {
    await this.assertPermission(context, "manage_products");
    const categoryCode = normalizeReferenceCode(input.categoryCode);
    const name = input.name.trim().replace(/\s+/gu, " ");
    const nameNormalized = normalizeProductName(name);
    if (!nameNormalized) throw new BadRequestException("Укажите название ингредиента");
    try {
      return await this.database().$transaction(async (transaction) => {
        await this.assertPermission(context, "manage_products", transaction);
        await this.repository.lockIngredientCategoryTree(transaction);
        const [current, category] = await Promise.all([
          this.repository.findLocalIngredient(transaction, context.venueId, productId),
          this.repository.findAnyIngredientCategory(transaction, categoryCode),
        ]);
        if (!current?.ingredient) throw new NotFoundException("Локальный ингредиент не найден");
        if (!category || (!category.isActive && current.ingredient.categoryCode !== categoryCode)) {
          throw new BadRequestException("Выберите доступную категорию ингредиента");
        }
        const product = await this.repository.updateLocalIngredient(transaction, {
          id: productId,
          venueId: context.venueId,
          userId: context.userId,
          name,
          nameNormalized,
          searchNameNormalized: normalizeSearchText(name),
          categoryCode,
          brand: normalizeOptional(input.brand),
          brandNormalized: input.brand ? normalizeProductName(input.brand) : undefined,
          searchBrandNormalized: input.brand ? normalizeSearchText(input.brand) : undefined,
          searchAttributesNormalized: normalizeSearchText(
            [categoryCode, input.brand, input.strength, input.country, input.externalIdentifier]
              .filter((value) => value !== undefined && value !== null && value !== "")
              .join(" "),
          ),
          strength: input.strength,
          country: normalizeOptional(input.country),
          externalIdentifier: normalizeOptional(input.externalIdentifier),
        });
        await this.recordProductEvent(transaction, context, "product.updated", product);
        return product;
      });
    } catch (error) {
      throw mapProductConflict(error);
    }
  }

  async createPreparation(context: CreateProductContext, input: PreparationInput) {
    await this.assertPermission(context, "manage_products");
    const categoryCode = normalizeReferenceCode(input.categoryCode);
    const category = await this.repository.findPreparationCategory(this.database(), categoryCode);
    if (!category) throw new BadRequestException("Выберите доступную категорию заготовки");
    return this.createComposite(context, "PREPARATION", input, { categoryCode });
  }

  async createGarnish(context: CreateProductContext, input: ProductBaseInput) {
    await this.assertPermission(context, "manage_products");
    return this.createComposite(context, "GARNISH", input);
  }

  async createCocktail(context: CreateProductContext, input: CocktailInput) {
    await this.assertPermission(context, "manage_products");
    const cocktailDetails = {
      glassId: await this.validateReference(context.venueId, "GLASS", input.glassId),
      iceId: await this.validateReference(context.venueId, "ICE", input.iceId),
      preparationMethodId: await this.validateReference(
        context.venueId,
        "PREPARATION_METHOD",
        input.preparationMethodId,
      ),
    };
    return this.createComposite(context, "COCKTAIL", input, {
      cocktailDetails,
      garnishIds: input.garnishIds ?? [],
    });
  }

  async updateCocktail(context: CreateProductContext, cocktailId: string, input: CocktailInput) {
    await this.assertPermission(context, "manage_products");
    const name = input.name.trim().replace(/\s+/gu, " ");
    const nameNormalized = normalizeProductName(name);
    if (!nameNormalized) throw new BadRequestException("Укажите название продукции");
    assertNonEmptyRecipe(input.technology, input.components);
    for (const component of input.components) assertPositiveAmount(component.amount);
    if (input.output) assertPositiveAmount(input.output.amount);

    try {
      return await this.database().$transaction(async (transaction) => {
        await this.assertPermission(context, "manage_products", transaction);
        await this.repository.lockPreparationGraph(transaction, context.venueId);
        const cocktail = await this.repository.findActiveCocktail(
          transaction,
          context.venueId,
          cocktailId,
        );
        if (!cocktail) throw new NotFoundException("Коктейль не найден");

        const [glass, ice, preparationMethod] = await Promise.all([
          this.repository.findAvailableReferenceValueById(
            transaction,
            context.venueId,
            "GLASS",
            input.glassId,
          ),
          this.repository.findAvailableReferenceValueById(
            transaction,
            context.venueId,
            "ICE",
            input.iceId,
          ),
          this.repository.findAvailableReferenceValueById(
            transaction,
            context.venueId,
            "PREPARATION_METHOD",
            input.preparationMethodId,
          ),
        ]);
        if (!glass || !ice || !preparationMethod) {
          throw new NotFoundException("Значение справочника недоступно этому заведению");
        }

        const componentIds = [...new Set(input.components.map(({ productId }) => productId))];
        const garnishIds = input.garnishIds ?? [];
        const [products, units] = await Promise.all([
          this.repository.findAllowedProducts(transaction, context.venueId, [
            ...componentIds,
            ...garnishIds,
          ]),
          this.repository.findAllowedUnits(transaction, context.venueId, [
            ...input.components.map(({ unitId }) => unitId),
            ...(input.output ? [input.output.unitId] : []),
          ]),
        ]);
        const productsById = new Map(products.map((product) => [product.id, product]));
        for (const componentId of componentIds) {
          const component = productsById.get(componentId);
          if (!component) throw new NotFoundException("Компонент не найден в этом заведении");
          assertAllowedComponent("COCKTAIL", component.type);
        }
        const unitIds = new Set(units.map(({ id }) => id));
        if (
          input.components.some(({ unitId }) => !unitIds.has(unitId)) ||
          (input.output && !unitIds.has(input.output.unitId))
        ) {
          throw new NotFoundException("Единица измерения не найдена в этом заведении");
        }
        if (garnishIds.some((id) => productsById.get(id)?.type !== "GARNISH")) {
          throw new NotFoundException("Гарнир не найден в этом заведении");
        }

        const product = await this.repository.replaceCocktail(transaction, {
          id: cocktail.id,
          venueId: context.venueId,
          userId: context.userId,
          name,
          nameNormalized,
          searchNameNormalized: normalizeSearchText(name),
          searchTechnologyNormalized: normalizeSearchText(input.technology),
          technology: input.technology.trim(),
          comment: normalizeOptional(input.comment),
          output: input.output,
          cocktailDetails: {
            glassId: glass.id,
            iceId: ice.id,
            preparationMethodId: preparationMethod.id,
          },
          components: input.components.map((component, position) => ({
            productId: component.productId,
            productVenueId: productsById.get(component.productId)!.venueId,
            unitId: component.unitId,
            amount: component.amount,
            position,
          })),
          garnishIds,
        });
        await this.recordProductEvent(transaction, context, "product.updated", product);
        return product;
      });
    } catch (error) {
      throw mapProductConflict(error);
    }
  }

  async createLocalUnit(
    context: CreateProductContext,
    input: { label: string; kind?: "VOLUME" | "MASS" | "COUNT" | "BAR_MEASURE" },
  ) {
    await this.assertPermission(context, "manage_products");
    const label = input.label.trim();
    if (!label) throw new BadRequestException("Укажите обозначение единицы измерения");
    const code = normalizeReferenceCode(label);
    if (!code) throw new BadRequestException("Укажите допустимое обозначение единицы измерения");
    const existing = await this.repository.findUnitByCode(this.database(), context.venueId, code);
    if (existing) throw new ConflictException("Такая единица уже доступна этому заведению");
    try {
      return await this.repository.createLocalUnit(this.database(), {
        venueId: context.venueId,
        userId: context.userId,
        code,
        label,
        kind: input.kind,
      });
    } catch (error) {
      throw mapProductConflict(error);
    }
  }

  async createLocalReferenceValue(
    context: CreateProductContext,
    input: { type: ReferenceValueType; label: string },
  ) {
    await this.assertPermission(context, "manage_products");
    const label = input.label.trim();
    if (!label) throw new BadRequestException("Укажите название значения справочника");
    const code = normalizeReferenceCode(label);
    if (!code) throw new BadRequestException("Укажите допустимое название значения справочника");
    const existing = await this.repository.findReferenceValueByCode(
      this.database(),
      context.venueId,
      input.type,
      code,
    );
    if (existing) throw new ConflictException("Такое значение уже доступно этому заведению");
    try {
      return await this.repository.createLocalReferenceValue(this.database(), {
        venueId: context.venueId,
        userId: context.userId,
        type: input.type,
        code,
        label,
      });
    } catch (error) {
      throw mapProductConflict(error);
    }
  }

  private async createComposite(
    context: CreateProductContext,
    type: "PREPARATION" | "GARNISH" | "COCKTAIL",
    input: ProductBaseInput,
    options: {
      categoryCode?: string;
      cocktailDetails?: {
        glassId?: string;
        iceId?: string;
        preparationMethodId?: string;
      };
      garnishIds?: string[];
    } = {},
  ) {
    const name = input.name.trim().replace(/\s+/gu, " ");
    const nameNormalized = normalizeProductName(name);
    if (!nameNormalized) throw new BadRequestException("Укажите название продукции");
    assertNonEmptyRecipe(input.technology, input.components);
    for (const component of input.components) assertPositiveAmount(component.amount);
    if (input.output) assertPositiveAmount(input.output.amount);

    const productId = randomUUID();
    try {
      return await this.database().$transaction(async (transaction) => {
        await this.assertPermission(context, "manage_products", transaction);
        await this.repository.lockPreparationGraph(transaction, context.venueId);
        const componentIds = [...new Set(input.components.map(({ productId }) => productId))];
        const [products, units] = await Promise.all([
          this.repository.findAllowedProducts(transaction, context.venueId, [
            ...componentIds,
            ...(options.garnishIds ?? []),
          ]),
          this.repository.findAllowedUnits(transaction, context.venueId, [
            ...input.components.map(({ unitId }) => unitId),
            ...(input.output ? [input.output.unitId] : []),
          ]),
        ]);
        const productsById = new Map(products.map((product) => [product.id, product]));
        for (const componentId of componentIds) {
          const component = productsById.get(componentId);
          if (!component) throw new NotFoundException("Компонент не найден в этом заведении");
          assertAllowedComponent(type, component.type);
        }
        const unitIds = new Set(units.map(({ id }) => id));
        if (
          input.components.some(({ unitId }) => !unitIds.has(unitId)) ||
          (input.output && !unitIds.has(input.output.unitId))
        ) {
          throw new NotFoundException("Единица измерения не найдена в этом заведении");
        }

        const garnishIds = options.garnishIds ?? [];
        if (garnishIds.some((id) => productsById.get(id)?.type !== "GARNISH")) {
          throw new NotFoundException("Гарнир не найден в этом заведении");
        }
        if (type === "PREPARATION") {
          const graph = await this.repository.findPreparationEdges(transaction, context.venueId);
          assertPreparationGraphAcyclic(productId, componentIds, graph);
        }

        const product = await this.repository.createComposite(transaction, {
          id: productId,
          venueId: context.venueId,
          userId: context.userId,
          type,
          name,
          nameNormalized,
          searchNameNormalized: normalizeSearchText(name),
          searchTechnologyNormalized: normalizeSearchText(input.technology),
          technology: input.technology.trim(),
          comment: normalizeOptional(input.comment),
          output: input.output,
          categoryCode: options.categoryCode,
          cocktailDetails: options.cocktailDetails,
          components: input.components.map((component, position) => ({
            productId: component.productId,
            productVenueId: productsById.get(component.productId)!.venueId,
            unitId: component.unitId,
            amount: component.amount,
            position,
          })),
          garnishIds,
        });
        await this.recordProductEvent(transaction, context, "product.created", product);
        return product;
      });
    } catch (error) {
      throw mapProductConflict(error);
    }
  }

  private async validateReference(
    venueId: string,
    type: ReferenceValueType,
    id: string,
  ): Promise<string> {
    const value = await this.repository.findAvailableReferenceValueById(
      this.database(),
      venueId,
      type,
      id,
    );
    if (!value) throw new NotFoundException("Значение справочника недоступно этому заведению");
    return value.id;
  }

  private async assertPermission(
    context: CreateProductContext,
    permission: "view_products" | "manage_products",
    transaction?: Prisma.TransactionClient,
  ): Promise<void> {
    await this.access.assert(context, permission, transaction);
  }

  private database() {
    return this.repository.databaseClient;
  }

  private recordProductEvent(
    transaction: Prisma.TransactionClient,
    context: CreateProductContext,
    eventType: "product.created" | "product.updated",
    product: { id: string; type: string; name: string },
  ) {
    if (context.internalUserId) {
      return Promise.all([
        transaction.auditEvent.create({
          data: {
            eventType,
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
            eventType,
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
    }
    return transaction.auditEvent.create({
      data: {
        eventType,
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
}

function normalizeOptional(value?: string): string | undefined {
  return value?.trim() || undefined;
}

function mapProductConflict(error: unknown): unknown {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return new ConflictException("Продукция с таким названием или идентификатором уже существует");
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
    return new ConflictException("Связанные данные продукции изменились. Обновите страницу");
  }
  return error;
}
