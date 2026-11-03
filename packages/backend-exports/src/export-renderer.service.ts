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
import type { ExportKind, ExportParameters } from "./export.dto.js";

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
  type: ExportKind;
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
      const fileName = this.outputName(request.type, request.id);
      if (request.type === "COMPANY_CLOSURE_PDF_ZIP") {
        return await this.renderCompanyPdfArchive(request, parameters, folder, path, fileName);
      }
      if (request.type === "VENUE_BACKUP_ZIP" || request.type === "COMPANY_CLOSURE_BACKUP_ZIP")
        throw new Error("Этот формат выгрузки больше не поддерживается");
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
      for (const product of snapshot.products) {
        const pdfPath = join(folder, `${String(product.id)}.pdf`);
        await this.writePdf(pdfPath, product, snapshot);
        archive.file(pdfPath, { name: productArchivePath(product) });
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

  private async renderCompanyPdfArchive(
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
    try {
      for (const venueId of venueIds) {
        const snapshot = await this.products.readSnapshot({
          companyId: request.companyId,
          venueId,
        });
        const venuePath = `venues/${slug(snapshot.venue.name)}-${venueId}`;
        const recipeProducts = snapshot.products.filter(isRecipeProduct);
        for (const product of recipeProducts) {
          const pdfPath = join(folder, `${venueId}-${String(product.id)}.pdf`);
          await this.writePdf(pdfPath, product, snapshot);
          archive.file(pdfPath, { name: `${venuePath}/${productArchivePath(product)}` });
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
      output.destroy(error instanceof Error ? error : undefined);
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
    const details = product as ProductRecord;
    drawText(document, String(product.name), 22, true);
    document.moveDown(0.35);
    const metadata = [productTypeLabel(details.type)];
    if (details.categories.length) metadata.push(...details.categories.map(({ label }) => label));
    if (details.preparation?.category) metadata.push(details.preparation.category);
    metadata.push(productStatusLabel(details));
    drawText(document, metadata.join(" · "), 10, false);

    drawSectionHeading(document, "Состав:");
    for (const [index, component] of details.components.entries()) {
      const unit = snapshot.dependencies.units.find((entry) => entry.id === component.unitId);
      drawText(
        document,
        `${component.product?.name ?? "Компонент"} — ${formatAmount(component.amount)} ${String(unit?.label ?? "")}`,
        11,
        false,
      );
      if (index < details.components.length - 1) drawRowDivider(document);
    }
    if (details.outputAmount && details.outputUnitId) {
      const unit = snapshot.dependencies.units.find((entry) => entry.id === details.outputUnitId);
      document.moveDown(0.5);
      drawText(
        document,
        `Фактический выход: ${formatAmount(details.outputAmount)} ${String(unit?.label ?? "")}`,
        11,
        false,
      );
    }
    if (details.cocktail && details.garnishes.length) {
      drawSectionHeading(document, "Гарнир:");
      drawText(
        document,
        details.garnishes
          .map(({ name }) => name)
          .filter(Boolean)
          .join(", "),
        11,
        false,
      );
    }
    if (details.cocktail?.glass || details.cocktail?.ice || details.cocktail?.preparationMethod) {
      drawSectionHeading(document, "Подача и приготовление:");
      if (details.cocktail.glass) drawDetailRow(document, "Посуда:", details.cocktail.glass);
      if (details.cocktail.ice) drawDetailRow(document, "Лёд:", details.cocktail.ice);
      if (details.cocktail.preparationMethod)
        drawDetailRow(document, "Метод:", details.cocktail.preparationMethod);
    }
    if (details.technology) {
      drawSectionHeading(document, "Технология приготовления:");
      drawText(document, details.technology, 11, false);
    }
    if (details.comment) {
      drawSectionHeading(document, "Комментарий:");
      drawText(document, details.comment, 11, false);
    }
    document.end();
    await finished(output);
  }

  private outputName(type: string, id: string): string {
    if (type === "SINGLE_PDF") return `tech-card-${id}.pdf`;
    if (type === "BATCH_PDF_ZIP") return `tech-cards-${id}.zip`;
    if (type === "COMPANY_CLOSURE_PDF_ZIP") return `company-tech-cards-${id}.zip`;
    if (type === "VENUE_BACKUP_ZIP" || type === "COMPANY_CLOSURE_BACKUP_ZIP")
      return `unsupported-${id}.zip`;
    return `tech-cards-${id}.zip`;
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
  categories: Array<{ id: string; label: string }>;
  status: "ACTIVE" | "ARCHIVED";
  workflowStatus: "ACTIVE" | "IN_DEVELOPMENT" | null;
  cocktail: {
    glass: string | null;
    ice: string | null;
    preparationMethod: string | null;
    workflowStatus: "ACTIVE" | "IN_DEVELOPMENT";
  } | null;
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

function productStatusLabel(product: ProductRecord): string {
  if (product.status === "ARCHIVED") return "В архиве";
  return product.workflowStatus === "IN_DEVELOPMENT" ? "Проработка" : "Активен";
}

function formatAmount(value: string): string {
  const amount = Number(value);
  return Number.isFinite(amount)
    ? new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 6 }).format(amount)
    : value;
}

function drawSectionHeading(document: PDFKit.PDFDocument, value: string): void {
  ensureSpace(document, 48);
  document.moveDown(0.7);
  const x = document.page.margins.left;
  const y = document.y;
  const width = document.page.width - document.page.margins.left - document.page.margins.right;
  document.roundedRect(x, y, width, 24, 4).fill("#f3f4f6");
  document.roundedRect(x + 8, y + 6, 3, 12, 1.5).fill("#10b981");
  document.x = x + 16;
  document.y = y + 5;
  drawText(document, value, 11, true);
  document.x = x;
  document.y = y + 31;
}

function drawDetailRow(document: PDFKit.PDFDocument, label: string, value: string): void {
  drawText(document, `${label} ${value}`, 11, false);
  document.moveDown(0.35);
}

function drawRowDivider(document: PDFKit.PDFDocument): void {
  ensureSpace(document, 8);
  const x = document.page.margins.left;
  const width = document.page.width - document.page.margins.left - document.page.margins.right;
  const y = document.y + 3;
  document
    .strokeColor("#e5e7eb")
    .lineWidth(0.5)
    .moveTo(x, y)
    .lineTo(x + width, y)
    .stroke();
  document.y = y + 7;
  document.x = x;
}

function ensureSpace(document: PDFKit.PDFDocument, height: number): void {
  if (document.y + height > document.page.maxY()) document.addPage();
}

function drawText(document: PDFKit.PDFDocument, value: string, size: number, bold: boolean): void {
  const startX = document.x;
  const width = document.page.width - startX - document.page.margins.right;
  const parts = value.split(/([\u0400-\u04ff\u0500-\u052f]+)/u).filter(Boolean);
  for (const [index, part] of parts.entries()) {
    const isCyrillic = /[\u0400-\u052f]/u.test(part);
    document.font(
      bold
        ? isCyrillic
          ? cyrillicBoldFont
          : latinBoldFont
        : isCyrillic
          ? cyrillicFont
          : latinFont,
    );
    document
      .fontSize(size)
      .fillColor("#1f2937")
      .text(part, {
        width,
        lineGap: 3,
        continued: index < parts.length - 1,
      });
  }
  document.x = startX;
}
