import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { PrismaClient } from "@bartech/database";
import { PrismaPg } from "@prisma/adapter-pg";

const categorySeed = [
  { code: "alcohol", name: "Алкоголь", parentCode: null },
  { code: "vodka", name: "Водка", parentCode: "alcohol" },
  { code: "gin", name: "Джин", parentCode: "alcohol" },
  { code: "rum", name: "Ром", parentCode: "alcohol" },
  { code: "whisky", name: "Виски", parentCode: "alcohol" },
  { code: "brandy", name: "Бренди и коньяк", parentCode: "alcohol" },
  { code: "tequila", name: "Текила", parentCode: "alcohol" },
  { code: "mezcal", name: "Мескаль", parentCode: "alcohol" },
  { code: "aperitif", name: "Аперитивы", parentCode: "alcohol" },
  { code: "amaro", name: "Амаро", parentCode: "alcohol" },
  { code: "bitters", name: "Биттеры", parentCode: "alcohol" },
  { code: "liqueur", name: "Ликёры", parentCode: "alcohol" },
  { code: "vermouth", name: "Вермуты", parentCode: "alcohol" },
  { code: "wine", name: "Вино", parentCode: "alcohol" },
  { code: "non_alcoholic", name: "Безалкогольные напитки", parentCode: null },
  { code: "juice", name: "Соки", parentCode: "non_alcoholic" },
  { code: "soft_drink", name: "Другие безалкогольные напитки", parentCode: "non_alcoholic" },
  { code: "soda", name: "Газированные напитки", parentCode: "non_alcoholic" },
  { code: "tonic", name: "Тоники", parentCode: "non_alcoholic" },
  { code: "water", name: "Вода", parentCode: "non_alcoholic" },
  { code: "fresh_products", name: "Свежие продукты", parentCode: null },
  { code: "fruit", name: "Фрукты", parentCode: "fresh_products" },
  { code: "berry", name: "Ягоды", parentCode: "fresh_products" },
  { code: "vegetables", name: "Овощи", parentCode: "fresh_products" },
  { code: "herb", name: "Зелень и травы", parentCode: "fresh_products" },
  { code: "botanical", name: "Ботаникалы", parentCode: "fresh_products" },
  { code: "dried_flower", name: "Сухоцветы", parentCode: "fresh_products" },
  { code: "grocery", name: "Бакалея", parentCode: null },
  { code: "spice", name: "Специи", parentCode: null },
  { code: "acid", name: "Кислоты", parentCode: null },
  { code: "texturizer", name: "Текстурообразователи", parentCode: null },
  { code: "coffee_tea", name: "Кофе и чай", parentCode: null },
  { code: "dairy", name: "Молочные продукты", parentCode: null },
  { code: "sweeteners", name: "Сахар и подсластители", parentCode: null },
  { code: "syrup", name: "Сиропы", parentCode: null },
  { code: "puree", name: "Пюре", parentCode: null },
  { code: "other", name: "Другое", parentCode: null },
] as const;

const preparationCategorySeed = [
  { code: "syrup", name: "Сироп" },
  { code: "cordial", name: "Кордиал" },
  { code: "tincture", name: "Настойка" },
  { code: "puree", name: "Пюре" },
  { code: "foam", name: "Пена" },
  { code: "premix", name: "Премикс" },
  { code: "other", name: "Другое" },
] as const;

const unitSeed = [
  { code: "ml", label: "мл", kind: "VOLUME" },
  { code: "l", label: "л", kind: "VOLUME" },
  { code: "g", label: "г", kind: "MASS" },
  { code: "kg", label: "кг", kind: "MASS" },
  { code: "pc", label: "шт", kind: "COUNT" },
  { code: "dash", label: "дэш", kind: "BAR_MEASURE" },
  { code: "drop", label: "дроп", kind: "BAR_MEASURE" },
  { code: "bar-spoon", label: "барная ложка", kind: "BAR_MEASURE" },
  { code: "spray", label: "спрей", kind: "BAR_MEASURE" },
] as const;
const ingredientBatchSize = 50;

type IngredientRecord = {
  id?: string;
  name: string;
  category: string;
  brand?: string;
  strength?: number;
  country?: string;
  aliases?: string[];
  externalIdentifier?: string;
};

function normalize(value: string): string {
  return value.trim().replace(/\s+/gu, " ").toLocaleLowerCase("ru-RU").replaceAll("ё", "е");
}

function normalizeSearchValue(value: string): string {
  return normalize(value).normalize("NFD").replace(/\p{M}/gu, "");
}

function normalizeSearchAttributes(values: Array<string | number | null | undefined>): string {
  return normalizeSearchValue(
    values.filter((value) => value !== null && value !== undefined).join(" "),
  );
}

function parseRecords(text: string): IngredientRecord[] {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("Файл global-ingredients.json содержит некорректный JSON-массив");
  }
  if (!Array.isArray(value)) {
    throw new Error("Файл global-ingredients.json должен содержать JSON-массив записей");
  }

  const records = value.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error(`Запись ${index + 1}: ожидается объект ингредиента`);
    }
    const record = item as Record<string, unknown>;
    const allowedKeys = new Set([
      "id",
      "name",
      "category",
      "brand",
      "strength",
      "country",
      "aliases",
      "externalIdentifier",
    ]);
    const unknownKey = Object.keys(record).find((key) => !allowedKeys.has(key));
    if (unknownKey) throw new Error(`Запись ${index + 1}: неизвестное поле «${unknownKey}»`);
    if (typeof record.name !== "string" || !record.name.trim() || record.name.length > 160) {
      throw new Error(`Запись ${index + 1}: поле name обязательно и должно быть до 160 символов`);
    }
    if (typeof record.category !== "string" || !/^[a-z][a-z0-9_-]{0,79}$/u.test(record.category)) {
      throw new Error(
        `Запись ${index + 1}: поле category должно содержать системный код категории`,
      );
    }
    if (record.id !== undefined && (typeof record.id !== "string" || !isUuid(record.id))) {
      throw new Error(`Запись ${index + 1}: поле id должно быть UUID`);
    }
    for (const key of ["brand", "country", "externalIdentifier"] as const) {
      if (record[key] !== undefined && typeof record[key] !== "string") {
        throw new Error(`Запись ${index + 1}: поле ${key} должно быть строкой`);
      }
    }
    if (typeof record.strength === "number" && (record.strength < 0 || record.strength > 100)) {
      throw new Error(`Запись ${index + 1}: крепость должна быть в диапазоне от 0 до 100`);
    }
    if (record.strength !== undefined && typeof record.strength !== "number") {
      throw new Error(`Запись ${index + 1}: поле strength должно быть числом`);
    }
    if (
      record.aliases !== undefined &&
      (!Array.isArray(record.aliases) ||
        record.aliases.some((alias) => typeof alias !== "string" || !alias.trim()))
    ) {
      throw new Error(`Запись ${index + 1}: поле aliases должно быть массивом непустых строк`);
    }

    return record as IngredientRecord;
  });

  const keys = new Set<string>();
  const ids = new Map<string, number>();
  for (const [index, record] of records.entries()) {
    if (record.id) {
      const normalizedId = record.id.toLowerCase();
      const previousIndex = ids.get(normalizedId);
      if (previousIndex !== undefined) {
        throw new Error(
          `Запись ${previousIndex} и запись ${index + 1} используют один UUID «${record.id}»`,
        );
      }
      ids.set(normalizedId, index + 1);
    }
    const key = identityKey(record);
    if (keys.has(key)) throw new Error(`Каталог содержит дубликат ингредиента «${record.name}»`);
    keys.add(key);
  }
  return records;
}

function identityKey(record: IngredientRecord): string {
  return [
    normalize(record.name),
    normalize(record.brand ?? ""),
    record.strength ?? "",
    normalize(record.country ?? ""),
    normalize(record.externalIdentifier ?? ""),
  ].join("\u001f");
}

function isUuid(value: string): boolean {
  return /^[\da-f]{8}-[\da-f]{4}-[1-8][\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/iu.test(value);
}

async function preflightCatalog(
  database: PrismaClient,
  records: IngredientRecord[],
): Promise<void> {
  const supportedCategories = new Set<string>(categorySeed.map(({ code }) => code));
  const unsupportedCategories = [...new Set(records.map(({ category }) => category))].filter(
    (code) => !supportedCategories.has(code),
  );
  if (unsupportedCategories.length) {
    throw new Error(`Для каталога не настроены категории: ${unsupportedCategories.join(", ")}`);
  }

  const sourceIds = records.flatMap((record) => (record.id ? [record.id.toLowerCase()] : []));
  const sourceKeys = records.map(identityKey);
  const or: { id?: { in: string[] }; catalogIdentityKey?: { in: string[] } }[] = [];
  if (sourceIds.length) or.push({ id: { in: sourceIds } });
  if (sourceKeys.length) or.push({ catalogIdentityKey: { in: sourceKeys } });

  const existingProducts = await database.product.findMany({
    where: { OR: or },
    select: {
      id: true,
      type: true,
      venueId: true,
      catalogIdentityKey: true,
      catalogSeedManaged: true,
      ingredient: { select: { productId: true } },
    },
  });
  const productsById = new Map(
    existingProducts.map((product) => [product.id.toLowerCase(), product]),
  );
  const productsByIdentity = new Map<string, (typeof existingProducts)[number][]>();
  for (const product of existingProducts) {
    if (!product.catalogIdentityKey) continue;
    const matches = productsByIdentity.get(product.catalogIdentityKey) ?? [];
    matches.push(product);
    productsByIdentity.set(product.catalogIdentityKey, matches);
  }

  const targets = records.map((record, index) => {
    const name = record.name.trim();
    const sourceId = record.id?.toLowerCase();
    const identityKeyValue = identityKey(record);
    const identityMatches = productsByIdentity.get(identityKeyValue) ?? [];
    if (identityMatches.length > 1) {
      throw new Error(
        `Конфликт каталога «${name}»: ключ идентичности найден у нескольких карточек`,
      );
    }

    const identityMatch = identityMatches[0];
    const existingById = sourceId ? productsById.get(sourceId) : undefined;
    if (sourceId && identityMatch && identityMatch.id.toLowerCase() !== sourceId) {
      throw new Error(
        `Конфликт каталога «${name}»: стабильный ID и ключ идентичности указывают на разные карточки`,
      );
    }
    if (sourceId && !existingById && identityMatch) {
      throw new Error(
        `Конфликт каталога «${name}»: стабильный ID отсутствует в базе, а ключ идентичности уже занят другой карточкой`,
      );
    }

    const existing = sourceId ? existingById : identityMatch;
    if (
      existing &&
      (existing.type !== "INGREDIENT" || existing.venueId !== null || !existing.ingredient)
    ) {
      throw new Error(
        `Конфликт каталога «${name}»: найденная карточка не является глобальным ингредиентом`,
      );
    }
    if (existing && !existing.catalogSeedManaged) {
      if (sourceId) {
        throw new Error(
          `Конфликт каталога «${name}»: стабильный ID принадлежит карточке, которой seed не управляет`,
        );
      }
      console.info(`Пропущен уже существующий глобальный ингредиент «${name}»`);
      return { record, targetId: null, skip: true, index };
    }

    return { record, targetId: existing?.id ?? sourceId ?? null, skip: false, index };
  });

  const aliasesByValue = new Map<string, number>();
  const aliasOwners = new Map<string, string>();
  for (const target of targets) {
    if (target.skip) continue;
    const owner = target.targetId ?? `source-record:${target.index}`;
    for (const alias of target.record.aliases ?? []) {
      const valueNormalized = normalize(alias);
      const previousOwner = aliasOwners.get(valueNormalized);
      if (previousOwner && previousOwner !== owner) {
        throw new Error(`Алиас «${alias}» указан у нескольких ингредиентов каталога`);
      }
      aliasOwners.set(valueNormalized, owner);
      aliasesByValue.set(valueNormalized, target.index);
    }
  }

  if (aliasesByValue.size) {
    const existingAliases = await database.productAlias.findMany({
      where: { valueNormalized: { in: [...aliasesByValue.keys()] } },
      select: { value: true, valueNormalized: true, productId: true },
    });
    for (const alias of existingAliases) {
      const target = targets[aliasesByValue.get(alias.valueNormalized)!];
      if (!target.targetId || alias.productId.toLowerCase() !== target.targetId.toLowerCase()) {
        throw new Error(`Алиас «${alias.value}» уже привязан к другому ингредиенту`);
      }
    }
  }
}

async function main(): Promise<void> {
  const projectRoot = resolve(fileURLToPath(new URL("../../../../", import.meta.url)));
  loadEnv({ path: resolve(projectRoot, ".env.local") });
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("Не задан DATABASE_URL в корневом .env.local");

  const sourcePath = resolve(
    fileURLToPath(new URL("../../scripts/data/global-ingredients.json", import.meta.url)),
  );
  const records = parseRecords(await readFile(sourcePath, "utf8"));
  const database = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });

  try {
    await preflightCatalog(database, records);

    await database.$transaction(async (transaction) => {
      for (const [sortOrder, category] of categorySeed.entries()) {
        await transaction.ingredientCategory.upsert({
          where: { code: category.code },
          create: { ...category, sortOrder },
          update: {},
        });
      }
      for (const [sortOrder, category] of preparationCategorySeed.entries()) {
        await transaction.preparationCategory.upsert({
          where: { code: category.code },
          create: { ...category, sortOrder },
          update: { name: category.name, isActive: true },
        });
      }
      for (const unit of unitSeed) {
        const existing = await transaction.unit.findFirst({
          where: { code: unit.code, venueId: null },
        });
        if (existing) {
          await transaction.unit.update({
            where: { id: existing.id },
            data: { label: unit.label, kind: unit.kind },
          });
        } else {
          await transaction.unit.create({ data: { ...unit } });
        }
      }
    });

    for (let offset = 0; offset < records.length; offset += ingredientBatchSize) {
      const batch = records.slice(offset, offset + ingredientBatchSize);
      await database.$transaction(async (transaction) => {
        for (const record of batch) {
          const normalizedName = normalize(record.name);
          const brand = record.brand?.trim() || undefined;
          const catalogIdentityKey = identityKey(record);
          const sourceId = record.id?.toLowerCase();
          const existingById = sourceId
            ? await transaction.product.findUnique({
                where: { id: sourceId },
                include: { ingredient: true },
              })
            : null;
          const identityMatches = await transaction.product.findMany({
            where: { catalogIdentityKey },
            include: { ingredient: true },
            take: 2,
          });
          if (identityMatches.length > 1) {
            throw new Error(
              `Конфликт каталога «${record.name}»: ключ идентичности найден у нескольких карточек`,
            );
          }

          const identityMatch = identityMatches[0];
          const existing = sourceId ? existingById : identityMatch;

          if (sourceId && identityMatch && identityMatch.id.toLowerCase() !== sourceId) {
            throw new Error(
              `Конфликт каталога «${record.name}»: стабильный ID и ключ идентичности указывают на разные карточки`,
            );
          }
          if (record.id && !existing && identityMatch) {
            throw new Error(
              `Конфликт каталога «${record.name}»: стабильный ID отсутствует в базе, а ключ идентичности уже занят другой карточкой`,
            );
          }
          if (
            existing &&
            (existing.type !== "INGREDIENT" || existing.venueId !== null || !existing.ingredient)
          ) {
            throw new Error(
              `Конфликт каталога «${record.name}»: найденная карточка не является глобальным ингредиентом`,
            );
          }

          if (existing && !existing.catalogSeedManaged) {
            if (record.id) {
              throw new Error(
                `Конфликт каталога «${record.name}»: стабильный ID принадлежит карточке, которой seed не управляет`,
              );
            }
            console.info(`Пропущен уже существующий глобальный ингредиент «${record.name}»`);
            continue;
          }

          const productId = existing?.id ?? record.id ?? randomUUID();
          const ingredient = existing?.ingredient;
          const searchAttributesNormalized = normalizeSearchAttributes([
            record.category,
            record.brand !== undefined ? brand : ingredient?.brand,
            record.strength !== undefined ? record.strength : ingredient?.strength?.toString(),
            record.country !== undefined ? record.country.trim() || null : ingredient?.country,
            record.externalIdentifier !== undefined
              ? record.externalIdentifier.trim() || null
              : ingredient?.externalIdentifier,
          ]);
          if (existing) {
            await transaction.product.update({
              where: { id: existing.id },
              data: {
                name: record.name.trim(),
                nameNormalized: normalizedName,
                searchNameNormalized: normalizeSearchValue(record.name),
                catalogIdentityKey,
                ingredient: {
                  update: {
                    categoryCode: record.category,
                    searchAttributesNormalized,
                    ...(record.brand !== undefined ? { brand } : {}),
                    ...(record.strength !== undefined ? { strength: record.strength } : {}),
                    ...(record.country !== undefined
                      ? { country: record.country.trim() || null }
                      : {}),
                    ...(record.externalIdentifier !== undefined
                      ? { externalIdentifier: record.externalIdentifier.trim() || null }
                      : {}),
                    ...(record.brand !== undefined
                      ? { brandNormalized: brand ? normalize(brand) : null }
                      : {}),
                    ...(record.brand !== undefined
                      ? { searchBrandNormalized: brand ? normalizeSearchValue(brand) : null }
                      : {}),
                  },
                },
              },
            });
          } else {
            await transaction.product.create({
              data: {
                id: productId,
                type: "INGREDIENT",
                name: record.name.trim(),
                nameNormalized: normalizedName,
                searchNameNormalized: normalizeSearchValue(record.name),
                catalogIdentityKey,
                catalogSeedManaged: true,
                createdByUserId: null,
                updatedByUserId: null,
                ingredient: {
                  create: {
                    categoryCode: record.category,
                    searchAttributesNormalized,
                    brand,
                    brandNormalized: brand ? normalize(brand) : undefined,
                    searchBrandNormalized: brand ? normalizeSearchValue(brand) : undefined,
                    strength: record.strength,
                    country: record.country?.trim() || undefined,
                    externalIdentifier: record.externalIdentifier?.trim() || undefined,
                  },
                },
              },
            });
          }

          for (const alias of record.aliases ?? []) {
            const valueNormalized = normalize(alias);
            const existingAlias = await transaction.productAlias.findUnique({
              where: { valueNormalized },
            });
            if (existingAlias && existingAlias.productId !== productId) {
              throw new Error(`Алиас «${alias}» уже привязан к другому ингредиенту`);
            }
            if (existingAlias) {
              await transaction.productAlias.update({
                where: { id: existingAlias.id },
                data: {
                  isConfirmed: true,
                  searchValueNormalized: normalizeSearchValue(alias),
                },
              });
            } else {
              await transaction.productAlias.create({
                data: {
                  productId,
                  value: alias.trim(),
                  valueNormalized,
                  searchValueNormalized: normalizeSearchValue(alias),
                  isConfirmed: true,
                },
              });
            }
          }
        }
      });
    }
    console.info(`Глобальный каталог обработан: ${records.length} записей в исходном файле`);
  } finally {
    await database.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Не удалось заполнить глобальный каталог");
  process.exitCode = 1;
});
