import type { EscalaLinha } from "@/types/escala";
import {
  getOrderTotal,
  getPlanningKey,
  getUniquePlanningRecords,
  toNumber,
} from "@/lib/escala-planning";
import {
  getAnimalBasePrice,
  getEffectivePremium,
} from "@/lib/escala-pricing";

interface ScaleExcelReportOptions {
  rows: EscalaLinha[];
  selectedWeek: string;
  dateStart: string;
  dateEnd: string;
}

interface ScaleExcelLine {
  date: string;
  producer: string;
  bullPrice: number | null;
  cowPrice: number | null;
  cows: number;
  cowArrobas: number | null;
  bulls: number;
  bullArrobas: number | null;
}

const workbookMimeType =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const parseLocalDate = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
};

const formatShortDate = (value: string) => {
  const [, month, day] = value.split("-");
  return `${day}-${month}`;
};

const buildReportLines = (rows: EscalaLinha[]): ScaleExcelLine[] => {
  const recordsByOrder = new Map<string, EscalaLinha>();

  for (const row of getUniquePlanningRecords(rows)) {
    if (getOrderTotal(row) <= 0) continue;

    const orderNumber =
      toNumber(row.NROPEDIDO) ||
      toNumber(row.NROPEDIDO_SNAPSHOT) ||
      toNumber(row.SEQPEDIDO);
    const key =
      row.ORIGEM_REGISTRO === "ERP" && orderNumber > 0
        ? `ERP-${orderNumber}`
        : getPlanningKey(row);

    recordsByOrder.set(key, row);
  }

  const records = Array.from(recordsByOrder.values())
    .filter((row) => getOrderTotal(row) > 0)
    .sort((first, second) => {
      const dateComparison = String(first.DATA_ABATE || "").localeCompare(
        String(second.DATA_ABATE || ""),
      );
      if (dateComparison !== 0) return dateComparison;
      return toNumber(first.ORDEM_EXIBICAO) - toNumber(second.ORDEM_EXIBICAO);
    });

  return records.map((row) => {
    const date = row.DATA_ABATE?.split("T")[0] || "";
    const producer = String(row.PRODUTOR || "PRODUTOR NÃO INFORMADO").trim();
    const cows = Math.max(0, toNumber(row.QTD_VACA));
    const bulls = Math.max(0, toNumber(row.QTD_BOI));
    const cowArrobas =
      row.ARROBAS_VACA === null || row.ARROBAS_VACA === undefined
        ? null
        : toNumber(row.ARROBAS_VACA);
    const bullArrobas =
      row.ARROBAS_BOI === null || row.ARROBAS_BOI === undefined
        ? null
        : toNumber(row.ARROBAS_BOI);
    return {
      date,
      producer,
      bullPrice: getEffectivePremium(row),
      cowPrice: getAnimalBasePrice(row, "VACA"),
      cows,
      cowArrobas,
      bulls,
      bullArrobas,
    };
  });
};

export async function exportScalePlanningToExcel({
  rows,
  selectedWeek,
  dateStart,
  dateEnd,
}: ScaleExcelReportOptions) {
  const reportLines = buildReportLines(rows);
  if (reportLines.length === 0) {
    throw new Error("Não existem animais para exportar nesta semana.");
  }

  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Vertice Campo";
  workbook.created = new Date();
  workbook.calcProperties.fullCalcOnLoad = true;

  const sheetName = `${formatShortDate(dateStart)} a ${formatShortDate(dateEnd)}`;
  const worksheet = workbook.addWorksheet(sheetName, {
    views: [
      {
        state: "frozen",
        ySplit: 1,
        activeCell: "B2",
        showGridLines: false,
      },
    ],
    pageSetup: {
      orientation: "landscape",
      // ExcelJS expõe o enum apenas na tipagem; no bundle do navegador, A4 é o código 9.
      paperSize: 9,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: {
        left: 0.25,
        right: 0.25,
        top: 0.4,
        bottom: 0.4,
        header: 0.2,
        footer: 0.2,
      },
    },
  });

  worksheet.getColumn("A").width = 2;
  worksheet.getColumn("B").width = 12;
  worksheet.getColumn("C").width = 54;
  worksheet.getColumn("D").width = 14;
  worksheet.getColumn("E").width = 14;
  worksheet.getColumn("F").width = 12;
  worksheet.getColumn("G").width = 17;
  worksheet.getColumn("H").width = 14;
  worksheet.getColumn("I").width = 12;
  worksheet.getColumn("J").width = 17;
  worksheet.getColumn("K").width = 10;

  const headers = [
    "DATA",
    "PRODUTOR",
    "VALOR BOI",
    "QTD VACA",
    "@ VACA",
    "VALOR VACA",
    "QTD BOI",
    "@ BOI",
    "R$ BOI",
    "@ MÉDIA",
  ];
  headers.forEach((header, index) => {
    worksheet.getCell(1, index + 2).value = header;
  });

  const headerRange = worksheet.getRow(1);
  headerRange.height = 24;
  for (let column = 2; column <= 11; column += 1) {
    const cell = worksheet.getCell(1, column);
    cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FF111827" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFF00" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin", color: { argb: "FF64748B" } },
      left: { style: "thin", color: { argb: "FF64748B" } },
      bottom: { style: "thin", color: { argb: "FF64748B" } },
      right: { style: "thin", color: { argb: "FF64748B" } },
    };
  }

  reportLines.forEach((line, index) => {
    const rowNumber = index + 2;
    worksheet.getCell(`B${rowNumber}`).value = parseLocalDate(line.date);
    worksheet.getCell(`C${rowNumber}`).value = line.producer;
    worksheet.getCell(`D${rowNumber}`).value = line.bullPrice;
    worksheet.getCell(`E${rowNumber}`).value = line.cows;
    worksheet.getCell(`F${rowNumber}`).value = {
      formula: `E${rowNumber}*${line.cowArrobas ?? 0}`,
    };
    worksheet.getCell(`G${rowNumber}`).value = line.cowPrice;
    worksheet.getCell(`H${rowNumber}`).value = line.bulls;
    worksheet.getCell(`I${rowNumber}`).value = {
      formula: `H${rowNumber}*${line.bullArrobas ?? 0}`,
    };
    worksheet.getCell(`J${rowNumber}`).value = {
      formula: `I${rowNumber}*D${rowNumber}`,
    };
    worksheet.getCell(`K${rowNumber}`).value = {
      formula: `IFERROR((F${rowNumber}+I${rowNumber})/(E${rowNumber}+H${rowNumber}),0)`,
    };

    const row = worksheet.getRow(rowNumber);
    row.height = 21;
    row.font = { name: "Arial", size: 10 };
    row.alignment = { vertical: "middle" };
    worksheet.getCell(`B${rowNumber}`).numFmt = "dd/mm/yyyy";
    worksheet.getCell(`B${rowNumber}`).alignment = { horizontal: "center" };
    worksheet.getCell(`C${rowNumber}`).alignment = { horizontal: "left" };
    worksheet.getCell(`D${rowNumber}`).numFmt = '"R$" #,##0.00';
    worksheet.getCell(`D${rowNumber}`).alignment = { horizontal: "center" };
    for (const column of ["E", "F", "H", "I"]) {
      worksheet.getCell(`${column}${rowNumber}`).numFmt = "#,##0.00";
      worksheet.getCell(`${column}${rowNumber}`).alignment = { horizontal: "center" };
    }
    for (const column of ["G", "J"]) {
      worksheet.getCell(`${column}${rowNumber}`).numFmt = '"R$" #,##0.00';
      worksheet.getCell(`${column}${rowNumber}`).alignment = { horizontal: "center" };
    }
    worksheet.getCell(`K${rowNumber}`).numFmt = "0.00";
    worksheet.getCell(`K${rowNumber}`).alignment = { horizontal: "center" };
  });

  const firstDataRow = 2;
  const lastDataRow = reportLines.length + 1;
  const totalRow = lastDataRow + 1;
  worksheet.getCell(`C${totalRow}`).value = "TOTAL";
  for (const column of ["E", "F", "H", "I", "J"]) {
    worksheet.getCell(`${column}${totalRow}`).value = {
      formula: `SUM(${column}${firstDataRow}:${column}${lastDataRow})`,
    };
  }
  for (let column = 2; column <= 11; column += 1) {
    const cell = worksheet.getCell(totalRow, column);
    cell.font = { name: "Arial", size: 10, bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF2CC" } };
    cell.border = { top: { style: "double", color: { argb: "FF475569" } } };
  }
  worksheet.getCell(`J${totalRow}`).numFmt = '"R$" #,##0.00';

  const summaryHeaderRow = totalRow + 4;
  const bullSummaryRow = summaryHeaderRow + 1;
  const cowSummaryRow = summaryHeaderRow + 2;
  const summaryTotalRow = summaryHeaderRow + 3;
  const averageRow = summaryHeaderRow + 5;

  ["SEXO", "%", "QTDE", "PESO", "VALOR"].forEach((value, index) => {
    const cell = worksheet.getCell(summaryHeaderRow, index + 4);
    cell.value = value;
    cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF173D6E" } };
    cell.alignment = { horizontal: "center" };
  });

  worksheet.getCell(`D${bullSummaryRow}`).value = "BOI";
  worksheet.getCell(`F${bullSummaryRow}`).value = { formula: `H${totalRow}` };
  worksheet.getCell(`G${bullSummaryRow}`).value = { formula: `I${totalRow}` };
  worksheet.getCell(`H${bullSummaryRow}`).value = { formula: `J${totalRow}` };
  worksheet.getCell(`D${cowSummaryRow}`).value = "VACA";
  worksheet.getCell(`F${cowSummaryRow}`).value = { formula: `E${totalRow}` };
  worksheet.getCell(`G${cowSummaryRow}`).value = { formula: `F${totalRow}` };
  worksheet.getCell(`H${cowSummaryRow}`).value = {
    formula: `SUMPRODUCT(F${firstDataRow}:F${lastDataRow},G${firstDataRow}:G${lastDataRow})`,
  };
  worksheet.getCell(`D${summaryTotalRow}`).value = "TOTAL";

  for (const rowNumber of [bullSummaryRow, cowSummaryRow]) {
    worksheet.getCell(`E${rowNumber}`).value = {
      formula: `IFERROR(F${rowNumber}/$F$${summaryTotalRow},0)`,
    };
    worksheet.getCell(`E${rowNumber}`).numFmt = "0.00%";
  }
  for (const column of ["F", "G", "H"]) {
    worksheet.getCell(`${column}${summaryTotalRow}`).value = {
      formula: `SUM(${column}${bullSummaryRow}:${column}${cowSummaryRow})`,
    };
  }
  worksheet.getCell(`H${bullSummaryRow}`).numFmt = '"R$" #,##0.00';
  worksheet.getCell(`H${cowSummaryRow}`).numFmt = '"R$" #,##0.00';
  worksheet.getCell(`H${summaryTotalRow}`).numFmt = '"R$" #,##0.00';

  worksheet.getCell(`D${averageRow}`).value = "MÉDIAS";
  worksheet.getCell(`E${averageRow}`).value = "POR DIA";
  worksheet.getCell(`F${averageRow}`).value = {
    formula: `IFERROR(F${summaryTotalRow}/5,0)`,
  };
  worksheet.getCell(`G${averageRow}`).value = {
    formula: `IFERROR(G${summaryTotalRow}/F${summaryTotalRow},0)`,
  };
  worksheet.getCell(`H${averageRow}`).value = {
    formula: `IFERROR(H${summaryTotalRow}/G${summaryTotalRow},0)`,
  };
  worksheet.getCell(`F${averageRow}`).numFmt = "0.00";
  worksheet.getCell(`G${averageRow}`).numFmt = "0.00";
  worksheet.getCell(`H${averageRow}`).numFmt = '"R$" #,##0.00';

  for (let rowNumber = bullSummaryRow; rowNumber <= summaryTotalRow; rowNumber += 1) {
    for (let column = 4; column <= 8; column += 1) {
      const cell = worksheet.getCell(rowNumber, column);
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = {
        bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
      };
    }
  }
  worksheet.getRow(summaryTotalRow).font = { name: "Arial", size: 10, bold: true };
  worksheet.getRow(averageRow).font = { name: "Arial", size: 10, bold: true };

  worksheet.autoFilter = `B1:K${lastDataRow}`;
  worksheet.pageSetup.printArea = `B1:K${averageRow}`;
  worksheet.headerFooter.oddFooter =
    `Escala de abate - Semana ${selectedWeek.split("W")[1] || selectedWeek}`;

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: workbookMimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const weekNumber = selectedWeek.split("W")[1] || selectedWeek;
  link.href = url;
  link.download = `Escala de abate - Semana ${weekNumber}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
