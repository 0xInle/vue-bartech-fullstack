import { createRequire } from "node:module";
import { Injectable } from "@nestjs/common";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { SchedulesService } from "./schedules.service.js";

const require = createRequire(import.meta.url);
const cyrillicFont =
  require.resolve("@fontsource/noto-sans/files/noto-sans-cyrillic-400-normal.woff");
const cyrillicBoldFont =
  require.resolve("@fontsource/noto-sans/files/noto-sans-cyrillic-700-normal.woff");

@Injectable()
export class ScheduleExportService {
  constructor(private readonly schedules: SchedulesService) {}

  async render(
    venueId: string,
    companyId: string,
    year: number,
    month: number,
    format: "pdf" | "xlsx",
  ) {
    const report = await this.schedules.getMonth(companyId, venueId, year, month);
    const fileName = "schedule-" + year + "-" + String(month).padStart(2, "0") + "." + format;
    return {
      fileName,
      contentType:
        format === "pdf"
          ? "application/pdf"
          : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: format === "pdf" ? await renderPdf(report) : await renderXlsx(report),
    };
  }
}

type ScheduleReport = Awaited<ReturnType<SchedulesService["getMonth"]>>;

async function renderXlsx(report: ScheduleReport): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("График");
  const days = Array.from({ length: report.daysInMonth }, (_, index) => index + 1);
  sheet.columns = [
    { header: "Сотрудник", key: "employee", width: 28 },
    { header: "Должность", key: "role", width: 20 },
    ...days.map((day) => ({ header: String(day), key: "day" + day, width: 5 })),
    { header: "Итого часов", key: "hours", width: 14 },
    { header: "Итого смен", key: "shifts", width: 14 },
  ];
  sheet.addRow(["График за " + String(report.month).padStart(2, "0") + "." + report.year]);
  sheet.mergeCells(1, 1, 1, report.daysInMonth + 4);
  const headerRow = sheet.addRow(sheet.columns.map((column) => String(column.header ?? "")));
  headerRow.font = { bold: true };
  for (const row of report.rows) {
    const excelRow = sheet.addRow([
      row.fullName,
      row.roleLabel,
      ...row.cells.map(({ value }) =>
        value?.kind === "SHIFT"
          ? value.durationHours + (value.shiftType === "NIGHT" ? "*" : "")
          : value?.kind === "STATUS"
            ? statusLabel(value.status)
            : "",
      ),
      row.totalHours,
      row.totalShifts,
    ]);
    row.cells.forEach(({ value }, index) => {
      if (value?.kind === "SHIFT" && value.shiftType === "NIGHT") {
        const cell = excelRow.getCell(index + 3);
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF475569" } };
        cell.font = { color: { argb: "FFFFFFFF" } };
      }
    });
  }
  sheet.addRow([]);
  sheet.addRow([
    "Число — обычная смена; число* — ночная смена; пустая ячейка — выходной; О — отпуск; Б — больничный; Н — неявка",
  ]);
  sheet.views = [{ state: "frozen", xSplit: 2, ySplit: 2 }];
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

async function renderPdf(report: ScheduleReport): Promise<Buffer> {
  const document = new PDFDocument({ size: "A3", layout: "landscape", margin: 24 });
  const chunks: Buffer[] = [];
  const complete = new Promise<Buffer>((resolve, reject) => {
    document.on("data", (chunk: Buffer) => chunks.push(chunk));
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);
  });
  document
    .font(cyrillicBoldFont)
    .fontSize(16)
    .text("График за " + String(report.month).padStart(2, "0") + "." + report.year);
  document.moveDown(0.6);
  const pageWidth = document.page.width - document.page.margins.left - document.page.margins.right;
  const fixedWidths = [155, 110];
  const totalsWidth = 92;
  const dayWidth =
    (pageWidth - fixedWidths[0]! - fixedWidths[1]! - totalsWidth * 2) / report.daysInMonth;
  const rowHeight = 22;
  let y = document.y;
  const x = document.page.margins.left;
  const headers = [
    "Сотрудник",
    "Должность",
    ...Array.from({ length: report.daysInMonth }, (_, index) => String(index + 1)),
    "Итого ч.",
    "Итого смен",
  ];
  const widths = [
    ...fixedWidths,
    ...Array.from({ length: report.daysInMonth }, () => dayWidth),
    totalsWidth,
    totalsWidth,
  ];
  drawRow(document, headers, widths, x, y, true);
  y += rowHeight;
  for (const row of report.rows) {
    if (y + rowHeight > document.page.height - document.page.margins.bottom) {
      document.addPage();
      y = document.page.margins.top;
      drawRow(document, headers, widths, x, y, true);
      y += rowHeight;
    }
    const cells = row.cells.map(({ value }) =>
      value?.kind === "SHIFT"
        ? String(value.durationHours) + (value.shiftType === "NIGHT" ? "*" : "")
        : value?.kind === "STATUS"
          ? statusLabel(value.status)
          : "",
    );
    const nightCells = new Set(
      row.cells.flatMap(({ value }, index) =>
        value?.kind === "SHIFT" && value.shiftType === "NIGHT" ? [index + 2] : [],
      ),
    );
    drawRow(
      document,
      [row.fullName, row.roleLabel, ...cells, String(row.totalHours), String(row.totalShifts)],
      widths,
      x,
      y,
      false,
      nightCells,
    );
    y += rowHeight;
  }
  document.moveDown();
  document
    .font(cyrillicFont)
    .fontSize(8)
    .fillColor("#1f2937")
    .text(
      "Число — обычная смена; число* — ночная смена; пустая ячейка — выходной; О — отпуск; Б — больничный; Н — неявка.",
    );
  document.end();
  return complete;
}

function drawRow(
  document: PDFKit.PDFDocument,
  values: string[],
  widths: number[],
  startX: number,
  y: number,
  header: boolean,
  nightCells = new Set<number>(),
) {
  let x = startX;
  document.font(header ? cyrillicBoldFont : cyrillicFont).fontSize(header ? 7 : 6.5);
  values.forEach((value, index) => {
    const width = widths[index]!;
    const isNight = nightCells.has(index);
    if (isNight) document.rect(x, y, width, 22).fill("#475569");
    document.rect(x, y, width, 22).strokeColor("#cbd5e1").stroke();
    document.fillColor(isNight ? "#ffffff" : "#1f2937");
    document.text(value, x + 2, y + 6, {
      width: width - 4,
      height: 10,
      ellipsis: true,
      lineBreak: false,
    });
    x += width;
  });
}

function statusLabel(status: string): string {
  return { VACATION: "О", SICK_LEAVE: "Б", NO_SHOW: "Н" }[status] ?? status;
}
