import { createRequire } from "node:module";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { finished } from "node:stream/promises";
import PDFDocument from "pdfkit";
import { ZipArchive } from "archiver";
import { Injectable } from "@nestjs/common";
import { ProductExportReadService, type ProductExportSnapshot } from "@bartech/backend-products";
import type { ExportParameters } from "./export.dto.js";

export type RenderedExport = {
  path: string;
  fileName: string;
  contentType: string;
  size: bigint;
  cleanup: () => Promise<void>;
};
const require = createRequire(import.meta.url);
const cyrillicFont =
  require.resolve("@fontsource/noto-sans/files/noto-sans-cyrillic-400-normal.woff");
const latinFont = require.resolve("@fontsource/noto-sans/files/noto-sans-latin-400-normal.woff");
const cyrillicBoldFont =
  require.resolve("@fontsource/noto-sans/files/noto-sans-cyrillic-700-normal.woff");
const latinBoldFont =
  require.resolve("@fontsource/noto-sans/files/noto-sans-latin-700-normal.woff");
type ExportRenderRequest = {
  id: string;
  companyId: string | null;
  venueId: string | null;
  type: "SINGLE_PDF" | "BATCH_PDF_ZIP" | "VENUE_BACKUP_ZIP" | "COMPANY_CLOSURE_BACKUP_ZIP";
  parameters: unknown;
};

@Injectable()
export class ExportRendererService {
  constructor(private readonly products: ProductExportReadService) {}

  async render(request: ExportRenderRequest): Promise<RenderedExport> {
    const folder = await mkdtemp(join(tmpdir(), "indiebar-export-"));
    try {
      const parameters = request.parameters as ExportParameters;
      const path = join(folder, request.type === "SINGLE_PDF" ? "product.pdf" : "products.zip");
      const fileName = this.outputName(request.type, request.id, request.venueId ?? request.id);
      if (request.type === "COMPANY_CLOSURE_BACKUP_ZIP") {
        return await this.renderCompanyBackup(request, parameters, folder, path, fileName);
      }
      if (!request.companyId || !request.venueId) throw new Error("Область выгрузки недоступна");
      const snapshot = await this.products.readSnapshot(
        { companyId: request.companyId, venueId: request.venueId },
        parameters.productIds,
        parameters.includeArchived === true,
      );

      if (request.type === "SINGLE_PDF") {
        await this.writePdf(path, snapshot.products[0]!, snapshot);
        const file = await stat(path);
        return {
          path,
          fileName,
          contentType: "application/pdf",
          size: BigInt(file.size),
          cleanup: () => rm(folder, { recursive: true, force: true }),
        };
      }

      const archive = new ZipArchive({ zlib: { level: 6 } });
      const output = createWriteStream(path, { flags: "wx" });
      archive.on("error", (error) => output.destroy(error));
      archive.pipe(output);
      if (request.type === "BATCH_PDF_ZIP") {
        for (const product of snapshot.products) {
          const pdfPath = join(folder, `${String(product.id)}.pdf`);
          await this.writePdf(pdfPath, product, snapshot);
          archive.file(pdfPath, { name: productArchivePath(product) });
        }
      } else {
        const generatedAt = new Date().toISOString();
        const recipeProducts = snapshot.products.filter(isRecipeProduct);
        const files = [
          { path: "data/products.json", purpose: "Структурированные данные продукции" },
          ...recipeProducts.map((product) => ({
            path: productArchivePath(product),
            purpose: "PDF техкарты",
          })),
        ];
        archive.append(JSON.stringify({ schemaVersion: 1, ...snapshot, generatedAt }, null, 2), {
          name: "data/products.json",
        });
        archive.append(
          JSON.stringify(
            {
              schemaVersion: 1,
              scope: { type: "VENUE", venueId: snapshot.venue.id, venueName: snapshot.venue.name },
              generatedAt,
              files,
            },
            null,
            2,
          ),
          { name: "manifest.json" },
        );
        for (const product of recipeProducts) {
          const pdfPath = join(folder, `${String(product.id)}.pdf`);
          await this.writePdf(pdfPath, product, snapshot);
          archive.file(pdfPath, { name: productArchivePath(product) });
        }
      }
      const outputFinished = finished(output);
      await archive.finalize();
      await outputFinished;
      const file = await stat(path);
      return {
        path,
        fileName,
        contentType: "application/zip",
        size: BigInt(file.size),
        cleanup: () => rm(folder, { recursive: true, force: true }),
      };
    } catch (error) {
      await rm(folder, { recursive: true, force: true });
      throw error;
    }
  }

  private async renderCompanyBackup(
    request: ExportRenderRequest,
    parameters: ExportParameters,
    folder: string,
    path: string,
    fileName: string,
  ): Promise<RenderedExport> {
    if (!request.companyId || !Array.isArray(parameters.venueIds)) {
      throw new Error("Область выгрузки компании недоступна");
    }
    const venueIds = [...new Set(parameters.venueIds)];
    if (venueIds.some((id) => typeof id !== "string")) {
      throw new Error("Область выгрузки компании недоступна");
    }
    const archive = new ZipArchive({ zlib: { level: 6 } });
    const output = createWriteStream(path, { flags: "wx" });
    archive.on("error", (error) => output.destroy(error));
    archive.pipe(output);
    const generatedAt = new Date().toISOString();
    const files: Array<{ path: string; venueId: string; venueName: string }> = [];
    const rendered: RenderedExport[] = [];
    try {
      for (const venueId of venueIds) {
        const inner = await this.render({
          id: `${request.id}-${venueId}`,
          companyId: request.companyId,
          venueId,
          type: "VENUE_BACKUP_ZIP",
          parameters: {},
        });
        rendered.push(inner);
        const snapshot = await this.products.readSnapshot({
          companyId: request.companyId,
          venueId,
        });
        const entryPath = `venues/${venueId}-${slug(snapshot.venue.name)}/products.zip`;
        files.push({ path: entryPath, venueId, venueName: snapshot.venue.name });
        archive.file(inner.path, { name: entryPath });
      }
      archive.append(
        JSON.stringify(
          {
            schemaVersion: 1,
            scope: {
              type: "COMPANY",
              companyId: request.companyId,
              companyName: parameters.companyName ?? "",
            },
            generatedAt,
            files,
          },
          null,
          2,
        ),
        { name: "manifest.json" },
      );
      const outputFinished = finished(output);
      await archive.finalize();
      await outputFinished;
      const file = await stat(path);
      return {
        path,
        fileName,
        contentType: "application/zip",
        size: BigInt(file.size),
        cleanup: async () => {
          await Promise.all(rendered.map((entry) => entry.cleanup()));
          await rm(folder, { recursive: true, force: true });
        },
      };
    } catch (error) {
      for (const entry of rendered) await entry.cleanup();
      throw error;
    }
  }

  private async writePdf(
    path: string,
    product: Record<string, unknown>,
    snapshot: ProductExportSnapshot,
  ) {
    const output = createWriteStream(path, { flags: "wx" });
    const document = new PDFDocument({ size: "A4", margin: 48 });
    document.pipe(output);
    drawText(document, String(product.name), 22, true);
    document.moveDown(0.7);
    drawText(document, productTypeLabel(String(product.type)), 11, false);
    const details = product as ProductRecord;
    if (details.preparation?.category)
      drawField(document, "Категория", details.preparation.category);
    if (details.technology) drawField(document, "Технология приготовления", details.technology);
    if (details.components.length) {
      drawLabel(document, "Состав");
      for (const component of details.components) {
        const unit = snapshot.dependencies.units.find((entry) => entry.id === component.unitId);
        drawText(
          document,
          `${component.product?.name ?? "Компонент"} — ${component.amount} ${String(unit?.label ?? "")}`,
          11,
          false,
        );
      }
    }
    if (details.outputAmount && details.outputUnitId) {
      const unit = snapshot.dependencies.units.find((entry) => entry.id === details.outputUnitId);
      drawField(document, "Выход", `${details.outputAmount} ${String(unit?.label ?? "")}`);
    }
    if (details.cocktail?.glass) drawField(document, "Посуда", details.cocktail.glass);
    if (details.cocktail?.ice) drawField(document, "Лёд", details.cocktail.ice);
    if (details.cocktail?.preparationMethod)
      drawField(document, "Метод приготовления", details.cocktail.preparationMethod);
    if (details.garnishes.length)
      drawField(
        document,
        "Гарниши",
        details.garnishes
          .map(({ name }) => name)
          .filter(Boolean)
          .join(", "),
      );
    if (details.comment) drawField(document, "Комментарий", details.comment);
    document.end();
    await finished(output);
  }

  private outputName(type: string, id: string, venueId: string): string {
    if (type === "SINGLE_PDF") return `tech-card-${id}.pdf`;
    if (type === "BATCH_PDF_ZIP") return `tech-cards-${id}.zip`;
    if (type === "COMPANY_CLOSURE_BACKUP_ZIP") return `company-products-${id}.zip`;
    return `venue-products-${venueId}-${id}.zip`;
  }
}

type ProductRecord = {
  id: string;
  name: string;
  type: string;
  technology: string | null;
  comment: string | null;
  outputAmount: string | null;
  outputUnitId: string | null;
  preparation: { category: string } | null;
  cocktail: { glass: string | null; ice: string | null; preparationMethod: string | null } | null;
  components: Array<{ amount: string; unitId: string; product: { name: string } | null }>;
  garnishes: Array<{ name: string | null }>;
};

function productArchivePath(product: Record<string, unknown>): string {
  return `products/${String(product.id)}-${slug(String(product.name))}.pdf`;
}

function isRecipeProduct(product: Record<string, unknown>): boolean {
  return ["COCKTAIL", "PREPARATION", "GARNISH"].includes(String(product.type));
}

function slug(value: string): string {
  return (
    value
      .normalize("NFKD")
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-|-$/gu, "")
      .slice(0, 60) || "product"
  );
}

function productTypeLabel(value: string): string {
  return { COCKTAIL: "Коктейль", PREPARATION: "Заготовка", GARNISH: "Гарнир" }[value] ?? "Техкарта";
}

function drawLabel(document: PDFKit.PDFDocument, value: string) {
  document.moveDown(0.7);
  drawText(document, value, 13, true);
}

function drawField(document: PDFKit.PDFDocument, label: string, value: string) {
  drawLabel(document, label);
  drawText(document, value, 11, false);
}

function drawText(document: PDFKit.PDFDocument, value: string, size: number, bold: boolean) {
  const latin = value.split(/([\u0400-\u04ff\u0500-\u052f]+)/u);
  for (const part of latin) {
    const isCyrillic = part && /[\u0400-\u052f]/u.test(part);
    document.font(
      bold
        ? isCyrillic
          ? cyrillicBoldFont
          : latinBoldFont
        : isCyrillic
          ? cyrillicFont
          : latinFont,
    );
    document.fontSize(size).fillColor("#1f2937").text(part, { continued: true });
  }
  document.text("", { continued: false });
}
