import { randomUUID } from "node:crypto";
import { lstat, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { PrismaClient } from "@bartech/database";
import { PrismaPg } from "@prisma/adapter-pg";

type IngredientRecord = {
  id?: string;
  name: string;
  brand?: string;
  strength?: number;
  country?: string;
  externalIdentifier?: string;
};

function normalize(value: string): string {
  return value.trim().replace(/\s+/gu, " ").toLocaleLowerCase("ru-RU").replaceAll("ё", "е");
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

function requireLocalDatabase(databaseUrl: string): void {
  const url = new URL(databaseUrl);
  const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
  if (
    process.env.NODE_ENV === "production" ||
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !localHosts.has(url.hostname) ||
    decodeURIComponent(url.pathname.slice(1)) !== "indiebar"
  ) {
    throw new Error(
      "Операция разрешена только для локальной базы indiebar на localhost; файл не изменён",
    );
  }
}

function parseRecords(text: string): IngredientRecord[] {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("Файл global-ingredients.json содержит некорректный JSON; файл не изменён");
  }
  if (!Array.isArray(value)) {
    throw new Error("Файл global-ingredients.json должен содержать массив; файл не изменён");
  }
  return value.map((record, index) => {
    if (!record || typeof record !== "object" || Array.isArray(record)) {
      throw new Error(`Запись ${index + 1} не является объектом; файл не изменён`);
    }
    const item = record as Record<string, unknown>;
    if (
      typeof item.name !== "string" ||
      !item.name.trim() ||
      (item.id !== undefined && typeof item.id !== "string")
    ) {
      throw new Error(`Запись ${index + 1} не содержит корректную идентичность; файл не изменён`);
    }
    return item as IngredientRecord;
  });
}

async function main(): Promise<void> {
  const argumentsList = process.argv.slice(2);
  if (argumentsList[0] === "--") argumentsList.shift();
  if (argumentsList.some((argument) => argument !== "--apply")) {
    throw new Error("Допустим только необязательный аргумент --apply");
  }
  const apply = argumentsList.includes("--apply");
  const projectRoot = resolve(fileURLToPath(new URL("../../../../", import.meta.url)));
  loadEnv({ path: resolve(projectRoot, ".env.local") });
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("Не задан DATABASE_URL в корневом .env.local");
  requireLocalDatabase(databaseUrl);

  const sourcePath = resolve(
    fileURLToPath(new URL("../../scripts/data/global-ingredients.json", import.meta.url)),
  );
  if ((await lstat(sourcePath)).isSymbolicLink()) {
    throw new Error("Исходный файл каталога не должен быть символической ссылкой");
  }
  const originalText = await readFile(sourcePath, "utf8");
  const records = parseRecords(originalText);
  const database = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });

  try {
    const databaseInfo = await database.$queryRaw<{ database: string }[]>`
      SELECT current_database() AS database
    `;
    if (databaseInfo[0]?.database !== "indiebar") {
      throw new Error("Подключение ведёт не к локальной базе indiebar; файл не изменён");
    }
    const products = await database.product.findMany({
      where: { type: "INGREDIENT", venueId: null, catalogSeedManaged: true },
      select: {
        id: true,
        catalogIdentityKey: true,
        ingredient: { select: { productId: true } },
      },
    });
    const databaseByKey = new Map<string, (typeof products)[number]>();
    for (const product of products) {
      if (!product.catalogIdentityKey || !product.ingredient) {
        throw new Error("В локальной базе найдена неполная запись; файл каталога не изменён");
      }
      if (databaseByKey.has(product.catalogIdentityKey)) {
        throw new Error("В локальной базе повторяется catalogIdentityKey; файл не изменён");
      }
      databaseByKey.set(product.catalogIdentityKey, product);
    }

    const sourceKeys = new Set<string>();
    const matches: { record: IngredientRecord; id: string }[] = [];
    for (const [index, record] of records.entries()) {
      const key = identityKey(record);
      if (sourceKeys.has(key)) {
        throw new Error(`В каталоге повторяется идентичность записи ${index + 1}; файл не изменён`);
      }
      sourceKeys.add(key);
      const product = databaseByKey.get(key);
      if (!product) {
        throw new Error(
          `Для записи ${index + 1} «${record.name}» нет точного совпадения в локальной базе; файл не изменён`,
        );
      }
      if (record.id && record.id.toLowerCase() !== product.id.toLowerCase()) {
        throw new Error(`ID записи ${index + 1} не совпадает с локальной базой; файл не изменён`);
      }
      matches.push({ record, id: product.id });
    }

    const extraDatabaseKeys = [...databaseByKey.keys()].filter((key) => !sourceKeys.has(key));
    if (
      matches.length !== records.length ||
      records.length !== products.length ||
      extraDatabaseKeys.length
    ) {
      throw new Error(
        `Нарушено соответствие 1:1: каталог ${records.length}, база ${products.length}; файл не изменён`,
      );
    }

    console.info(`Проверено точное соответствие 1:1: ${matches.length} глобальных ингредиентов.`);
    if (!apply) {
      console.info("Сухой прогон: файл не изменён. Для записи ID повторите команду с --apply.");
      return;
    }

    if ((await readFile(sourcePath, "utf8")) !== originalText) {
      throw new Error("Исходный файл изменился во время проверки; файл не перезаписан");
    }
    const updatedRecords = matches.map(({ record, id }) => ({ id, ...record }));
    const temporaryPath = `${sourcePath}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporaryPath, `${JSON.stringify(updatedRecords, null, 2)}\n`, {
        encoding: "utf8",
        flag: "wx",
      });
      await rename(temporaryPath, sourcePath);
    } catch (error) {
      await unlink(temporaryPath).catch(() => undefined);
      throw error;
    }
    console.info(`В файл добавлены стабильные ID для ${updatedRecords.length} записей.`);
  } finally {
    await database.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Не удалось закрепить ID каталога");
  process.exitCode = 1;
});
