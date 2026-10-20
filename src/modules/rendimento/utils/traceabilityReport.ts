import type { Product, TestFlow, WeightBand, YieldTest } from "../types/domain";
import { formatDate } from "./format";
import { isBranchedFlow, isLeafStep, orderTreeSteps, stepDepth } from "./flowTree";
import { calculateFlowReferenceWeight } from "./calculations";

export type TraceabilityMatrixRowKind = "input" | "product" | "discard" | "final";

export interface TraceabilityMatrixRow {
  id: string;
  productId?: string;
  label: string;
  kind: TraceabilityMatrixRowKind;
  values: number[];
  total: number;
  yieldPercent: number | null;
  depth?: number;
  branchLast?: boolean;
}

export interface TraceabilityMatrix {
  id: string;
  title: string;
  pieceOrders: number[];
  rows: TraceabilityMatrixRow[];
}

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
const normalized = (value: string) => value.trim().toLocaleUpperCase("pt-BR");

const productName = (products: Product[], id?: string) =>
  products.find((product) => product.id === id)?.name || "Produto não informado";

const pieceValue = (
  flow: TestFlow,
  stepIndex: number,
  pieceOrder: number,
  field: "initialWeightKg" | "cleanWeightKg",
) => flow.steps[stepIndex]?.traceItems?.find((item) => item.inputPieceOrder === pieceOrder)?.[field] || 0;

export function buildTraceabilityMatrices(test: YieldTest, products: Product[]): TraceabilityMatrix[] {
  const pieces = test.inputPieces?.length
    ? [...test.inputPieces].sort((first, second) => first.order - second.order)
    : (test.inputPieceWeightsKg || []).map((weightKg, index) => ({ id: String(index + 1), order: index + 1, weightKg }));
  const pieceOrders = pieces.map((piece) => piece.order);
  const inputValues = pieces.map((piece) => piece.weightKg || 0);
  const inputTotal = sum(inputValues);

  return test.flows.map((flow, flowIndex) => {
    const referenceWeight = calculateFlowReferenceWeight(flow, inputTotal);
    const rows: TraceabilityMatrixRow[] = [{
      id: `${flow.id}-input`,
      label: "PESO DA ENTRADA",
      kind: "input",
      values: inputValues,
      total: inputTotal,
      yieldPercent: null,
    }];
    const orderedSteps = orderTreeSteps(flow.steps);
    const branched = isBranchedFlow(flow.steps);
    const operationSteps = branched ? orderedSteps : orderedSteps.slice(0, -1);

    operationSteps.forEach((step) => {
      const stepIndex = flow.steps.findIndex((item) => item.id === step.id);
      const values = pieceOrders.map((order) => pieceValue(flow, stepIndex, order, "initialWeightKg"));
      const total = sum(values);
      rows.push({
        id: `${step.id}-product`,
        productId: step.productId,
        label: productName(products, step.productId),
        kind: branched && isLeafStep(flow.steps, step.id) ? "final" : "product",
        depth: stepDepth(flow.steps, step),
        values,
        total,
        yieldPercent: referenceWeight > 0 ? (total / referenceWeight) * 100 : null,
      });

      const discardNames = new Map<string, string>();
      step.traceItems?.forEach((item) => item.discards.forEach((discard) => {
        if (discard.weightKg > 0) discardNames.set(normalized(discard.name), discard.name);
      }));
      const discardEntries = [...discardNames.entries()];
      discardEntries.forEach(([discardKey, label], discardIndex) => {
        const discardValues = pieceOrders.map((order) => {
          const trace = step.traceItems?.find((item) => item.inputPieceOrder === order);
          return sum((trace?.discards || [])
            .filter((discard) => normalized(discard.name) === discardKey)
            .map((discard) => discard.weightKg));
        });
        rows.push({
          id: `${step.id}-discard-${discardKey}`,
          label,
          kind: "discard",
          depth: stepDepth(flow.steps, step) + 1,
          values: discardValues,
          total: sum(discardValues),
          yieldPercent: null,
          branchLast: discardIndex === discardEntries.length - 1,
        });
      });
    });

    const finalStepIndex = flow.steps.length - 1;
    const finalStep = flow.steps[finalStepIndex];
    if (!branched && finalStep) {
      const values = pieceOrders.map((order) => pieceValue(flow, finalStepIndex, order, "initialWeightKg"));
      const total = sum(values);
      rows.push({
        id: `${finalStep.id}-final`,
        productId: finalStep.productId,
        label: productName(products, finalStep.productId),
        kind: "final",
        depth: stepDepth(flow.steps, finalStep),
        values,
        total,
        yieldPercent: referenceWeight > 0 ? (total / referenceWeight) * 100 : null,
      });
    }

    return {
      id: flow.id,
      title: `Produto ${flowIndex + 1} - ${productName(products, flow.rootProductId)}`,
      pieceOrders,
      rows,
    };
  });
}

const weightText = (value: number) => value > 0
  ? value.toLocaleString("pt-BR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })
  : "";
const percentText = (value: number | null) => value === null
  ? ""
  : `${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
const safeFileName = (test: YieldTest) => (test.name || `teste-${test.number}`)
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase();

export async function exportTraceabilityPdf(test: YieldTest, products: Product[]) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const matrices = buildTraceabilityMatrices(test, products);
  const largestPieceCount = Math.max(0, ...matrices.map((matrix) => matrix.pieceOrders.length));
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: largestPieceCount > 10 ? "a3" : "a4" });

  matrices.forEach((matrix, matrixIndex) => {
    if (matrixIndex > 0) doc.addPage();
    doc.setTextColor(23, 61, 110);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Relatório rastreável de rendimento", 12, 14);
    doc.setFontSize(10);
    doc.text(`${test.name || `Teste ${test.number}`} · ${matrix.title}`, 12, 21);
    doc.setTextColor(92, 111, 130);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`Teste ${test.number} · ${formatDate(test.date)}`, 12, 27);

    autoTable(doc, {
      startY: 33,
      head: [["Produto / descarte", ...matrix.pieceOrders.map(String), "Total", "Rendimento"]],
      body: matrix.rows.map((row) => [
        `${"     ".repeat(row.depth || 0)}${row.kind === "discard" ? "└  " : row.depth ? "↳  " : ""}${row.label}`,
        ...row.values.map((value) => row.kind === "discard" && value > 0 ? `- ${weightText(value)} kg` : weightText(value)),
        row.kind === "discard" && row.total > 0 ? `- ${weightText(row.total)} kg` : weightText(row.total),
        percentText(row.yieldPercent),
      ]),
      theme: "grid",
      styles: { font: "helvetica", fontSize: largestPieceCount > 10 ? 6 : 7.5, cellPadding: 1.8, halign: "right", textColor: [34, 52, 70], lineColor: [198, 210, 222], lineWidth: 0.2 },
      headStyles: { fillColor: [23, 61, 110], textColor: [255, 255, 255], fontStyle: "bold" },
      columnStyles: { 0: { halign: "left", cellWidth: 48 } },
      didParseCell: (data) => {
        if (data.section !== "body") return;
        const row = matrix.rows[data.row.index];
        if (!row) return;
        if (row.kind === "discard") data.cell.styles.textColor = [190, 36, 48];
        if (row.kind === "product") data.cell.styles.fontStyle = "bold";
        if (row.kind === "input") { data.cell.styles.fillColor = [235, 243, 250]; data.cell.styles.fontStyle = "bold"; }
        if (row.kind === "final") { data.cell.styles.fillColor = [232, 247, 239]; data.cell.styles.textColor = [13, 101, 72]; data.cell.styles.fontStyle = "bold"; }
      },
      didDrawCell: (data) => {
        if (data.section !== "body" || data.column.index !== 0) return;
        const row = matrix.rows[data.row.index];
        if (row?.kind !== "discard") return;
        const x = data.cell.x + 3.5;
        const middleY = data.cell.y + data.cell.height / 2;
        doc.setDrawColor(211, 166, 172);
        doc.setLineWidth(0.3);
        doc.line(x, data.cell.y, x, row.branchLast ? middleY : data.cell.y + data.cell.height);
        doc.line(x, middleY, x + 4, middleY);
      },
    });
  });

  doc.save(`relatorio-rastreavel-${test.number}-${safeFileName(test)}.pdf`);
  return true;
}

export async function exportTraceabilityExcel(test: YieldTest, products: Product[], weightBands: WeightBand[] = [], filterBandIds: string[] = []) {
  if (test.executionMode !== "traceable") return false;
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Vértice";
  workbook.created = new Date();

  buildTraceabilityMatrices(test, products).forEach((matrix, matrixIndex) => {
    const flow = test.flows.find((item) => item.id === matrix.id);
    const inputRow = matrix.rows.find((row) => row.kind === "input");
    const firstProductRow = matrix.rows.find((row) => row.kind === "product" || row.kind === "final");
    const hasInputWeights = Boolean(test.inputProductId) && Boolean(inputRow?.values.some((value) => value > 0));
    const referenceProductId = hasInputWeights ? test.inputProductId : flow?.rootProductId;
    const referenceValues = hasInputWeights ? inputRow?.values || [] : firstProductRow?.values || [];
    const columns = matrix.pieceOrders.map((order, index) => {
      const weight = referenceValues[index] || 0;
      const band = weightBands.find((item) => item.productReferenceId === referenceProductId && weight >= item.minWeightKg && (item.maxWeightKg == null || weight < item.maxWeightKg));
      return { order, index, band };
    }).filter((column) => !filterBandIds.length || Boolean(column.band && filterBandIds.includes(column.band.id)));
    const sheetName = `Produto ${matrixIndex + 1}`.slice(0, 31);
    const worksheet = workbook.addWorksheet(sheetName, {
      views: [{ state: "frozen", xSplit: 1, ySplit: 4, showGridLines: false }],
      pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    });
    const lastColumn = columns.length * 2 + 3;
    worksheet.mergeCells(1, 1, 1, lastColumn);
    worksheet.getCell(1, 1).value = "RELATÓRIO RASTREÁVEL DE RENDIMENTO";
    worksheet.getCell(1, 1).font = { name: "Arial", size: 15, bold: true, color: { argb: "FFFFFFFF" } };
    worksheet.getCell(1, 1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF173D6E" } };
    worksheet.getCell(1, 1).alignment = { horizontal: "left", vertical: "middle" };
    worksheet.getRow(1).height = 26;
    worksheet.mergeCells(2, 1, 2, lastColumn);
    worksheet.getCell(2, 1).value = `${test.name || `Teste ${test.number}`} | ${matrix.title} | ${formatDate(test.date)}`;
    worksheet.getCell(2, 1).font = { name: "Arial", size: 10, bold: true, color: { argb: "FF173D6E" } };

    worksheet.addRow([]);
    worksheet.addRow(["Produto / descarte", ...columns.flatMap((column) => [`Peça ${column.order}`, "Rend. entrada"]), "Total", "Rendimento"]);
    const header = worksheet.getRow(4);
    header.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF173D6E" } };
    header.alignment = { horizontal: "center", vertical: "middle" };

    matrix.rows.forEach((matrixRow) => {
      const visibleTotal = columns.reduce((total, column) => total + (matrixRow.values[column.index] || 0), 0);
      const visibleReference = columns.reduce((total, column) => total + (referenceValues[column.index] || 0), 0);
      const row = worksheet.addRow([
        matrixRow.label,
        ...columns.flatMap((column) => {
          const value = matrixRow.values[column.index] || 0;
          const reference = referenceValues[column.index] || 0;
          return [value ? (matrixRow.kind === "discard" ? -value : value) : null, matrixRow.kind === "discard" || reference <= 0 ? null : value / reference];
        }),
        visibleTotal ? (matrixRow.kind === "discard" ? -visibleTotal : visibleTotal) : null,
        matrixRow.kind === "discard" || visibleReference <= 0 ? null : visibleTotal / visibleReference,
      ]);
      row.getCell(1).value = `${"   ".repeat(matrixRow.depth || 0)}${matrixRow.kind === "discard" ? matrixRow.branchLast ? "└  " : "├  " : matrixRow.depth ? "↳  " : ""}${matrixRow.label}`;
      row.font = { name: "Arial", size: 10, bold: matrixRow.kind !== "discard", color: { argb: matrixRow.kind === "discard" ? "FFC3222E" : matrixRow.kind === "final" ? "FF0D6548" : "FF203448" } };
      if (matrixRow.kind === "input" || matrixRow.kind === "final") row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: matrixRow.kind === "final" ? "FFE8F7EF" : "FFEBF3FA" } };
      row.eachCell((cell, columnNumber) => {
        cell.border = { top: { style: "thin", color: { argb: "FFC6D2DE" } }, left: { style: "thin", color: { argb: "FFC6D2DE" } }, bottom: { style: "thin", color: { argb: "FFC6D2DE" } }, right: { style: "thin", color: { argb: "FFC6D2DE" } } };
        cell.alignment = { horizontal: columnNumber === 1 ? "left" : "right", vertical: "middle" };
        if (columnNumber > 1 && columnNumber < lastColumn) cell.numFmt = columnNumber % 2 === 0 ? "0.000" : "0.00%";
        if (columnNumber === lastColumn) cell.numFmt = "0.00%";
      });
      columns.forEach((column, index) => {
        if (!column.band) return;
        const hex = column.band.color.replace("#", "").padStart(6, "0").slice(0, 6).toUpperCase();
        const red = Number.parseInt(hex.slice(0, 2), 16);
        const green = Number.parseInt(hex.slice(2, 4), 16);
        const blue = Number.parseInt(hex.slice(4, 6), 16);
        const blend = (channel: number) => Math.round(channel * .16 + 255 * .84).toString(16).padStart(2, "0").toUpperCase();
        const fill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: `FF${blend(red)}${blend(green)}${blend(blue)}` } };
        row.getCell(2 + index * 2).fill = fill;
        row.getCell(3 + index * 2).fill = fill;
      });
    });
    worksheet.getColumn(1).width = 34;
    columns.forEach((_, index) => { worksheet.getColumn(2 + index * 2).width = 12; worksheet.getColumn(3 + index * 2).width = 12; });
    worksheet.getColumn(lastColumn - 1).width = 14;
    worksheet.getColumn(lastColumn).width = 14;
    worksheet.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4 + matrix.rows.length, column: lastColumn } };
    worksheet.pageSetup.printArea = `A1:${worksheet.getColumn(lastColumn).letter}${4 + matrix.rows.length}`;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `relatorio-rastreavel-${test.number}-${safeFileName(test)}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
