import type { ContractStock, ExportContract } from "@/services/contracts";

interface ContractsExcelOptions {
  contracts: ExportContract[];
  stock: ContractStock[];
  title?: string;
}

const workbookMimeType =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const asNumber = (value: unknown) => Number(value || 0);

const parseDate = (value: string | null | undefined) => {
  if (!value) return null;
  const text = String(value).slice(0, 10);
  const [year, month, day] = text.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day, 12, 0, 0);
};

const isoWeek = (value: string | null | undefined) => {
  const date = parseDate(value);
  if (!date) return null;
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const weekday = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - weekday);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  return Math.ceil(((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
};

const productStatus = (contract: ExportContract, allocated: number, sold: number) => {
  if (contract.EM_EXPEDICAO) return "Em expedição";
  if (sold > 0 && allocated >= sold * 0.98) return "Finalizado";
  if (allocated > 0) return "Em produção";
  return "Aguardando prod.";
};

const border = {
  top: { style: "thin" as const, color: { argb: "FFB8C8D6" } },
  left: { style: "thin" as const, color: { argb: "FFB8C8D6" } },
  bottom: { style: "thin" as const, color: { argb: "FFB8C8D6" } },
  right: { style: "thin" as const, color: { argb: "FFB8C8D6" } },
};

export async function exportContractsPlanningToExcel({
  contracts,
  stock,
  title = "PLANILHA DE CONTRATOS EXPORTAÇÃO BEAUVALLET",
}: ContractsExcelOptions) {
  if (contracts.length === 0) {
    throw new Error("Não existem contratos para exportar com os filtros atuais.");
  }

  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Vértice PCP";
  workbook.created = new Date();
  workbook.calcProperties.fullCalcOnLoad = true;

  const worksheet = workbook.addWorksheet("CONTRATOS", {
    views: [{ state: "frozen", ySplit: 2, xSplit: 1, activeCell: "A3", showGridLines: false }],
    pageSetup: {
      orientation: "landscape",
      paperSize: 9,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.2, right: 0.2, top: 0.35, bottom: 0.35, header: 0.15, footer: 0.15 },
    },
  });

  const widths = [14, 17, 36, 16, 11, 46, 15, 15, 18, 16, 13, 18, 13, 20, 48];
  widths.forEach((width, index) => {
    worksheet.getColumn(index + 1).width = width;
  });

  worksheet.mergeCells("A1:O1");
  const titleCell = worksheet.getCell("A1");
  titleCell.value = title;
  titleCell.font = { name: "Arial", size: 15, bold: true, color: { argb: "FFFFFFFF" } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF173D6E" } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getRow(1).height = 28;

  const headers = [
    "Nº CONTRATO",
    "STATUS",
    "CLIENTE",
    "DESTINO",
    "CÓDIGO",
    "DESCRIÇÃO",
    "VENDIDO",
    "ESTOQUE",
    "ESTOQUE DISPONÍVEL",
    "DATA DE EMBARQUE",
    "SEMANA DE EMBARQUE",
    "EMBARQUE PLANEJADO",
    "SEMANA PLANEJADA",
    "PREVISÃO PRODUÇÃO",
    "OBSERVAÇÃO",
  ];
  headers.forEach((header, index) => {
    const cell = worksheet.getCell(2, index + 1);
    cell.value = header;
    cell.font = { name: "Arial", size: 9, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF244B70" } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = border;
  });
  worksheet.getRow(2).height = 34;

  let rowNumber = 3;
  contracts.forEach((contract) => {
    const firstProductRow = rowNumber;
    contract.PRODUTOS.forEach((product, productIndex) => {
      const sold = asNumber(product.PESOCONTRATO);
      const allocated = asNumber(product.PESO_ATRELADO_TOTAL);
      const values = [
        contract.NROCONTRATO,
        contract.EM_EXPEDICAO ? "Em expedição" : contract.STATUS_OPERACIONAL,
        contract.NOMERAZAO,
        contract.PAISDESTINO || "",
        product.SEQPRODUTO,
        product.DESCRICAO,
        sold,
        allocated,
        allocated - sold,
        productIndex === 0 ? parseDate(contract.DTA_EMBARQUE_ERP) : null,
        productIndex === 0 ? isoWeek(contract.DTA_EMBARQUE_ERP) : null,
        productIndex === 0 ? parseDate(contract.DTA_EMBARQUE_PLANEJADA) : null,
        productIndex === 0 ? isoWeek(contract.DTA_EMBARQUE_PLANEJADA) : null,
        productStatus(contract, allocated, sold),
        productIndex === 0 ? contract.OBSERVACAO || "" : "",
      ];
      const row = worksheet.addRow(values);
      row.height = 21;
      row.font = { name: "Arial", size: 9 };
      row.alignment = { vertical: "middle" };
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.border = border;
      });
      for (const column of [7, 8, 9]) {
        row.getCell(column).numFmt = '#,##0.000 "kg"';
        row.getCell(column).alignment = { horizontal: "right", vertical: "middle" };
      }
      for (const column of [10, 12]) {
        row.getCell(column).numFmt = "dd/mm/yyyy";
        row.getCell(column).alignment = { horizontal: "center", vertical: "middle" };
      }
      row.getCell(1).font = { name: "Arial", size: 9, bold: true, color: { argb: "FF173D6E" } };
      row.getCell(5).font = { name: "Arial", size: 9, bold: true, color: { argb: "FF244B70" } };
      row.getCell(14).font = {
        name: "Arial",
        size: 9,
        bold: true,
        color: { argb: allocated >= sold * 0.98 && sold > 0 ? "FF047857" : allocated > 0 ? "FFB45309" : "FF64748B" },
      };
      if (allocated >= sold * 0.98 && sold > 0) {
        row.eachCell((cell) => {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFECFDF5" } };
        });
      }
      rowNumber += 1;
    });

    const lastProductRow = Math.max(firstProductRow, rowNumber - 1);
    const totalRow = worksheet.getRow(rowNumber);
    worksheet.mergeCells(rowNumber, 1, rowNumber, 6);
    totalRow.getCell(1).value = contract.OBSERVACAO || "TOTAL";
    totalRow.getCell(7).value = { formula: `SUM(G${firstProductRow}:G${lastProductRow})`, result: asNumber(contract.PESO_TOTAL) };
    totalRow.getCell(8).value = { formula: `SUM(H${firstProductRow}:H${lastProductRow})`, result: asNumber(contract.PESO_RESERVADO) };
    totalRow.getCell(9).value = { formula: `H${rowNumber}-G${rowNumber}`, result: asNumber(contract.PESO_RESERVADO) - asNumber(contract.PESO_TOTAL) };
    totalRow.height = 22;
    totalRow.font = { name: "Arial", size: 9, bold: true, color: { argb: "FF173D6E" } };
    totalRow.alignment = { vertical: "middle" };
    totalRow.eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF2CC" } };
      cell.border = border;
    });
    for (const column of [7, 8, 9]) totalRow.getCell(column).numFmt = '#,##0.000 "kg"';
    rowNumber += 2;
  });

  const lastContractRow = rowNumber - 2;
  worksheet.autoFilter = { from: "A2", to: `O${lastContractRow}` };
  worksheet.pageSetup.printArea = `A1:O${lastContractRow}`;
  worksheet.headerFooter.oddFooter = "Vértice PCP · Contratos de exportação";

  const stockSheet = workbook.addWorksheet("ESTOQUE", {
    views: [{ state: "frozen", ySplit: 1, activeCell: "A2", showGridLines: false }],
  });
  stockSheet.columns = [
    { header: "PRODUTO", key: "produto", width: 13 },
    { header: "DESCRIÇÃO", key: "descricao", width: 52 },
    { header: "ESTOQUE ERP", key: "erp", width: 18 },
    { header: "PROTEGIDO POR OP", key: "op", width: 19 },
    { header: "ALOCADO MANUAL", key: "manual", width: 19 },
    { header: "LIVRE PARA ALOCAR", key: "livre", width: 20 },
    { header: "VENDIDO ATIVO", key: "vendido", width: 18 },
    { header: "ESTOQUE SEM VENDA", key: "semVenda", width: 21 },
  ];
  const stockHeader = stockSheet.getRow(1);
  stockHeader.height = 26;
  stockHeader.eachCell((cell) => {
    cell.font = { name: "Arial", size: 9, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF244B70" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = border;
  });
  stock.forEach((item) => {
    const row = stockSheet.addRow({
      produto: item.SEQPRODUTO,
      descricao: item.DESCRPRODUTO,
      erp: asNumber(item.PESODISPONIVEL),
      op: asNumber(item.PESO_ATRELADO_ORDEM),
      manual: asNumber(item.PESO_RESERVADO_VERTICE),
      livre: asNumber(item.PESO_LIVRE_VERTICE),
      vendido: asNumber(item.PESO_VENDIDO_ATIVO),
      semVenda: asNumber(item.ESTOQUE_SEM_VENDA),
    });
    row.font = { name: "Arial", size: 9 };
    row.eachCell({ includeEmpty: true }, (cell, column) => {
      cell.border = border;
      if (column >= 3) cell.numFmt = '#,##0.000 "kg"';
    });
  });
  stockSheet.autoFilter = `A1:H${Math.max(1, stockSheet.rowCount)}`;

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: workbookMimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10).split("-").reverse().join("-");
  link.href = url;
  link.download = `Planilha de Contratos Exportação - ${date}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
