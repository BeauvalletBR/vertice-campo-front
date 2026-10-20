import type { TraceabilityMatrix, TraceabilityMatrixRow } from "./traceabilityReport";
import { formatDate } from "./format";

export interface YieldGoalExportRow {
  week: string;
  date: string;
  standard: string;
  pieces: number;
  band: string;
  yieldPercent: number | null;
  goal: number | null;
  difference: number | null;
}

export interface YieldComparisonExportRecord {
  testNumber: number;
  date: string;
  productName: string;
  bandName: string;
  bandColor: string;
  matrix: TraceabilityMatrix;
  visiblePieceIndexes: number[];
  referenceValues: number[];
}

const downloadWorkbook = async (workbook: import("exceljs").Workbook, fileName: string) => {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const border = {
  top: { style: "thin" as const, color: { argb: "FFC6D2DE" } },
  left: { style: "thin" as const, color: { argb: "FFC6D2DE" } },
  bottom: { style: "thin" as const, color: { argb: "FFC6D2DE" } },
  right: { style: "thin" as const, color: { argb: "FFC6D2DE" } },
};

export async function exportYieldGoalExcel(rows: YieldGoalExportRow[]) {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Vértice";
  const worksheet = workbook.addWorksheet("Teste x meta", {
    views: [{ state: "frozen", ySplit: 2, showGridLines: false }],
  });
  worksheet.mergeCells("A1:H1");
  worksheet.getCell("A1").value = "COMPARATIVO DE RENDIMENTO X META";
  worksheet.getCell("A1").font = { name: "Arial", size: 15, bold: true, color: { argb: "FFFFFFFF" } };
  worksheet.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF173D6E" } };
  worksheet.getCell("A1").alignment = { horizontal: "left", vertical: "middle" };
  worksheet.getRow(1).height = 27;
  worksheet.addRow(["Ano/Semana", "Data", "Padrão", "Peças", "Faixa @", "Rend. teste", "Meta", "Diferença"]);
  const header = worksheet.getRow(2);
  header.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF245A86" } };
  header.alignment = { horizontal: "center", vertical: "middle" };
  rows.forEach((item) => {
    const row = worksheet.addRow([
      item.week,
      formatDate(item.date),
      item.standard,
      item.pieces,
      item.band,
      item.yieldPercent == null ? null : item.yieldPercent / 100,
      item.goal == null ? null : item.goal / 100,
      item.difference == null ? null : item.difference / 100,
    ]);
    row.eachCell((cell, column) => {
      cell.border = border;
      cell.alignment = { horizontal: column === 3 ? "left" : "center", vertical: "middle" };
      if (column >= 6) cell.numFmt = "0.00%";
    });
  });
  [14, 13, 30, 10, 21, 14, 12, 14].forEach((width, index) => { worksheet.getColumn(index + 1).width = width; });
  worksheet.autoFilter = { from: "A2", to: `H${rows.length + 2}` };
  await downloadWorkbook(workbook, "comparativo-rendimento-meta.xlsx");
}

const rowKey = (row: TraceabilityMatrixRow, index: number) =>
  `${index}|${row.kind}|${row.productId || ""}|${row.label}|${row.depth || 0}`;

export async function exportYieldComparisonExcel(records: YieldComparisonExportRecord[]) {
  const usableRecords = [...records]
    .filter((record) => record.visiblePieceIndexes.length > 0)
    .sort((first, second) => first.date.localeCompare(second.date) || first.testNumber - second.testNumber);
  if (!usableRecords.length) return false;

  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Vértice";
  const worksheet = workbook.addWorksheet("Comparativo por peça", {
    views: [{ state: "frozen", xSplit: 1, ySplit: 4, showGridLines: false }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  const columns = usableRecords.flatMap((record) =>
    record.visiblePieceIndexes.map((pieceIndex) => ({ record, pieceIndex })),
  );
  const lastColumn = columns.length + 3;
  worksheet.mergeCells(1, 1, 1, lastColumn);
  worksheet.getCell(1, 1).value = "COMPARATIVO CONSOLIDADO DE TESTES";
  worksheet.getCell(1, 1).font = { name: "Arial", size: 15, bold: true, color: { argb: "FFFFFFFF" } };
  worksheet.getCell(1, 1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF173D6E" } };
  worksheet.getCell(1, 1).alignment = { horizontal: "left", vertical: "middle" };
  worksheet.getRow(1).height = 27;

  let startColumn = 2;
  usableRecords.forEach((record) => {
    const endColumn = startColumn + record.visiblePieceIndexes.length - 1;
    if (endColumn >= startColumn) {
      if (endColumn > startColumn) worksheet.mergeCells(2, startColumn, 2, endColumn);
      const cell = worksheet.getCell(2, startColumn);
      cell.value = `${formatDate(record.date)} · Teste ${record.testNumber} · ${record.productName}`;
      cell.font = { name: "Arial", size: 9, bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF245A86" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      for (let column = startColumn; column <= endColumn; column += 1) {
        worksheet.getCell(2, column).fill = cell.fill;
        worksheet.getCell(2, column).border = border;
      }
    }
    startColumn = endColumn + 1;
  });
  worksheet.getCell(2, 1).value = "Data / teste";
  worksheet.getCell(2, 1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  worksheet.getCell(2, 1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF245A86" } };

  worksheet.addRow(["Produto / descarte", ...columns.map((_, index) => `Peça ${index + 1}`), "Total", "Rendimento"]);
  const header = worksheet.getRow(3);
  header.font = { name: "Arial", size: 9, bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF173D6E" } };
  header.alignment = { horizontal: "center", vertical: "middle" };

  const definitions = new Map<string, TraceabilityMatrixRow>();
  usableRecords.forEach((record) => record.matrix.rows.forEach((row, index) => {
    const key = rowKey(row, index);
    if (!definitions.has(key)) definitions.set(key, row);
  }));

  definitions.forEach((definition, key) => {
    const values = columns.map(({ record, pieceIndex }) => {
      const matrixRow = record.matrix.rows.find((row, index) => rowKey(row, index) === key);
      return matrixRow?.values[pieceIndex] || 0;
    });
    const references = columns.map(({ record, pieceIndex }) => record.referenceValues[pieceIndex] || 0);
    const total = values.reduce((sum, value) => sum + value, 0);
    const referenceTotal = references.reduce((sum, value) => sum + value, 0);
    const excelRow = worksheet.addRow([
      `${"   ".repeat(definition.depth || 0)}${definition.label}`,
      ...values.map((value) => value ? (definition.kind === "discard" ? -value : value) : null),
      total ? (definition.kind === "discard" ? -total : total) : null,
      definition.kind === "discard" || referenceTotal <= 0 ? null : total / referenceTotal,
    ]);
    excelRow.font = { name: "Arial", size: 10, bold: definition.kind !== "discard", color: { argb: definition.kind === "discard" ? "FFC3222E" : definition.kind === "final" ? "FF0D6548" : "FF203448" } };
    if (definition.kind === "input" || definition.kind === "final") {
      excelRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: definition.kind === "final" ? "FFE8F7EF" : "FFEBF3FA" } };
    }
    excelRow.eachCell((cell, column) => {
      cell.border = border;
      cell.alignment = { horizontal: column === 1 ? "left" : "right", vertical: "middle" };
      if (column > 1 && column < lastColumn) cell.numFmt = "0.000";
      if (column === lastColumn) cell.numFmt = "0.00%";
    });
  });

  worksheet.getColumn(1).width = 34;
  columns.forEach((_, index) => { worksheet.getColumn(index + 2).width = 11; });
  worksheet.getColumn(lastColumn - 1).width = 14;
  worksheet.getColumn(lastColumn).width = 14;
  worksheet.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3 + definitions.size, column: lastColumn } };
  await downloadWorkbook(workbook, "comparativo-testes-selecionados.xlsx");
  return true;
}
