import type { PedidoMi } from "@/services/pedidos-mi";

const formatDate = (value: string | null | undefined) => {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "-";
};

const weight = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 3,
});

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
});

const loadImageDataUrl = async (url: string) => {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};

export async function exportPedidosMiPdf(pedidos: PedidoMi[]) {
  const [{ jsPDF }, { default: autoTable }, logo] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
    loadImageDataUrl(`${window.location.origin}/logo.png`),
  ]);

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const generatedAt = new Date().toLocaleString("pt-BR");
  const margin = 10;

  doc.setProperties({
    title: "Pedidos MI - Planejamento de cargas",
    subject: "Comparativo entre planejamento e pedidos do ERP",
    author: "Beauvallet",
  });
  doc.setFillColor(23, 61, 110);
  doc.rect(0, 0, pageWidth, 4, "F");
  if (logo) doc.addImage(logo, "PNG", margin, 7, 19, 16, undefined, "FAST");
  doc.setTextColor(23, 61, 110);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("Vértice | Pedidos MI", 34, 13);
  doc.setFontSize(10);
  doc.text("Planejamento de cargas do Mercado Interno", 34, 19);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(95, 112, 130);
  doc.setFontSize(7.5);
  doc.text(`Emitido em ${generatedAt}`, pageWidth - margin, 12, { align: "right" });
  doc.text(`${pedidos.length} lançamento(s) no recorte`, pageWidth - margin, 17, {
    align: "right",
  });

  const loads = new Map<string, PedidoMi[]>();
  pedidos.forEach((pedido) => {
    const key = pedido.ID_CARGA_MI != null
      ? String(pedido.ID_CARGA_MI)
      : `${pedido.NOME_CARGA}|${pedido.NROCARGA || ""}|${String(pedido.DTA_EMBARQUE).slice(0, 10)}`;
    loads.set(key, [...(loads.get(key) || []), pedido]);
  });

  type ProductAggregate = {
    code: string;
    description: string;
    planned: number;
    system: number;
    orderIds: Set<number>;
    loadIds: Set<string>;
  };
  const overallProducts = new Map<string, ProductAggregate>();
  const loadProductRows: Array<Array<string | number>> = [];
  const loadEntries = Array.from(loads.entries()).sort(([firstKey], [secondKey]) => {
    const firstId = Number(firstKey);
    const secondId = Number(secondKey);
    return Number.isFinite(firstId) && Number.isFinite(secondId) ? secondId - firstId : 0;
  });

  const rows = loadEntries.flatMap(([loadKey, loadOrders]) => {
    const reference = loadOrders[0];
    const loadLabel = reference.ID_CARGA_MI != null
      ? `#${reference.ID_CARGA_MI}`
      : reference.NOME_CARGA;
    const productTotals = new Map<string, ProductAggregate>();
    let loadPlanned = 0;
    let loadSystem = 0;
    const loadRows: Array<Array<string | number>> = [[
      reference.ID_CARGA_MI != null ? `ID #${reference.ID_CARGA_MI}` : "",
      "", "", formatDate(reference.DTA_EMBARQUE), "",
      `CARGA: ${reference.NOME_CARGA}${reference.NROCARGA ? ` · Nº ${reference.NROCARGA}` : ""} · ${loadOrders.length} pedido(s)`,
      "", "", "", "", "", "", "",
    ]];

    loadOrders.forEach((pedido) => {
      const plannedTotal = pedido.ITENS.reduce(
        (sum, item) => sum + Number(item.PESO_PEDIDO || 0),
        0,
      );
      const systemTotal = pedido.ITENS.reduce(
        (sum, item) => sum + Number(item.PESO_SISTEMA || 0),
        0,
      );
      loadPlanned += plannedTotal;
      loadSystem += systemTotal;

      pedido.ITENS.forEach((item, index) => {
        const code = item.SEQPRODUTO == null ? "MANUAL" : String(item.SEQPRODUTO);
        const productKey = item.SEQPRODUTO == null
          ? `${code}|${item.PRODUTO.trim().toLocaleUpperCase("pt-BR")}`
          : code;
        const subtotal = productTotals.get(productKey) || {
          code,
          description: item.PRODUTO,
          planned: 0,
          system: 0,
          orderIds: new Set<number>(),
          loadIds: new Set<string>(),
        };
        subtotal.planned += Number(item.PESO_PEDIDO || 0);
        subtotal.system += Number(item.PESO_SISTEMA || 0);
        subtotal.orderIds.add(pedido.ID_PEDIDO_MI);
        subtotal.loadIds.add(loadKey);
        productTotals.set(productKey, subtotal);

        const overall = overallProducts.get(productKey) || {
          code,
          description: item.PRODUTO,
          planned: 0,
          system: 0,
          orderIds: new Set<number>(),
          loadIds: new Set<string>(),
        };
        overall.planned += Number(item.PESO_PEDIDO || 0);
        overall.system += Number(item.PESO_SISTEMA || 0);
        overall.orderIds.add(pedido.ID_PEDIDO_MI);
        overall.loadIds.add(loadKey);
        overallProducts.set(productKey, overall);

        loadRows.push([
          index === 0 ? reference.NOME_CARGA : "",
          index === 0 ? String(pedido.NROPEDIDO || "-") : "",
          index === 0 ? pedido.CLIENTE : "",
          index === 0 ? formatDate(pedido.DTA_EMBARQUE) : "",
          code,
          `${item.PRODUTO}${item.DTA_MIN_PRODUCAO || item.DTA_MAX_PRODUCAO ? `\nProdução: ${formatDate(item.DTA_MIN_PRODUCAO)} a ${formatDate(item.DTA_MAX_PRODUCAO)}` : ""}`,
          `${weight.format(Number(item.PESO_PEDIDO || 0))} kg`,
          item.PRECO_PEDIDO == null ? "-" : currency.format(item.PRECO_PEDIDO),
          `${weight.format(Number(item.PESO_SISTEMA || 0))} kg`,
          item.PRECO_SISTEMA == null ? "-" : currency.format(item.PRECO_SISTEMA),
          `${weight.format(Number(item.DIFERENCA_PESO || 0))} kg`,
          item.DIFERENCA_PRECO == null ? "-" : currency.format(item.DIFERENCA_PRECO),
          index === 0 ? pedido.STATUS : "",
        ]);
      });

      loadRows.push([
        "", "", "", "", "",
        `TOTAL DO PEDIDO ${pedido.NROPEDIDO || "MANUAL"}`,
        `${weight.format(plannedTotal)} kg`, "",
        `${weight.format(systemTotal)} kg`, "",
        `${weight.format(systemTotal - plannedTotal)} kg`, "", "",
      ]);
    });

    Array.from(productTotals.values())
      .sort((first, second) => first.code.localeCompare(second.code, "pt-BR", { numeric: true }))
      .forEach((subtotal) => loadProductRows.push([
        loadLabel,
        reference.NOME_CARGA,
        reference.NROCARGA || "-",
        formatDate(reference.DTA_EMBARQUE),
        subtotal.code,
        subtotal.description,
        subtotal.orderIds.size,
        `${weight.format(subtotal.planned)} kg`,
        `${weight.format(subtotal.system)} kg`,
        `${weight.format(subtotal.system - subtotal.planned)} kg`,
      ]));
    loadRows.push([
      "", "", "", "", "", `TOTAL DA CARGA ${loadLabel}`,
      `${weight.format(loadPlanned)} kg`, "",
      `${weight.format(loadSystem)} kg`, "",
      `${weight.format(loadSystem - loadPlanned)} kg`, "", "",
    ]);
    return loadRows;
  });

  const overallProductRows = Array.from(overallProducts.values())
    .sort((first, second) => first.code.localeCompare(second.code, "pt-BR", { numeric: true }))
    .map((subtotal) => [
      subtotal.code,
      subtotal.description,
      subtotal.loadIds.size,
      subtotal.orderIds.size,
      `${weight.format(subtotal.planned)} kg`,
      `${weight.format(subtotal.system)} kg`,
      `${weight.format(subtotal.system - subtotal.planned)} kg`,
    ]);
  const overallPlanned = Array.from(overallProducts.values()).reduce(
    (sum, subtotal) => sum + subtotal.planned,
    0,
  );
  const overallSystem = Array.from(overallProducts.values()).reduce(
    (sum, subtotal) => sum + subtotal.system,
    0,
  );
  overallProductRows.push([
    "",
    "TOTAL GERAL DO FILTRO",
    loads.size,
    pedidos.length,
    `${weight.format(overallPlanned)} kg`,
    `${weight.format(overallSystem)} kg`,
    `${weight.format(overallSystem - overallPlanned)} kg`,
  ]);

  const drawFooter = () => {
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFontSize(6.5);
    doc.setTextColor(110, 126, 143);
    doc.text("Beauvallet | Documento gerado pelo Vértice", margin, pageHeight - 5);
    doc.text(`Página ${doc.getNumberOfPages()}`, pageWidth - margin, pageHeight - 5, {
      align: "right",
    });
  };

  const drawSectionTitle = (title: string, subtitle: string, y: number) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(23, 61, 110);
    doc.text(title, margin, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(95, 112, 130);
    doc.text(subtitle, margin, y + 4);
  };

  drawSectionTitle(
    "1. Resumo sintético geral por produto",
    "Totais consolidados de todos os registros presentes no filtro aplicado.",
    29,
  );
  autoTable(doc, {
    startY: 35,
    margin: { left: margin, right: margin, bottom: 12 },
    head: [[
      "Cód. produto", "Descrição do produto", "Cargas", "Pedidos",
      "Peso planejado", "Peso no sistema", "Diferença",
    ]],
    body: overallProductRows,
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 8,
      cellPadding: 2.2,
      textColor: [27, 58, 89],
      lineColor: [200, 212, 224],
      lineWidth: 0.18,
      valign: "middle",
    },
    headStyles: {
      fillColor: [23, 61, 110],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      halign: "center",
    },
    alternateRowStyles: { fillColor: [246, 249, 252] },
    columnStyles: {
      0: { cellWidth: 25, halign: "center" },
      1: { cellWidth: 92 },
      2: { cellWidth: 22, halign: "center" },
      3: { cellWidth: 22, halign: "center" },
      4: { cellWidth: 35, halign: "right" },
      5: { cellWidth: 35, halign: "right" },
      6: { cellWidth: 35, halign: "right", fontStyle: "bold" },
    },
    didParseCell: (data) => {
      if (data.section !== "body") return;
      const rawRow = data.row.raw as unknown[];
      if (String(rawRow?.[1] || "") !== "TOTAL GERAL DO FILTRO") return;
      data.cell.styles.fillColor = [230, 238, 246];
      data.cell.styles.textColor = [23, 61, 110];
      data.cell.styles.fontStyle = "bold";
    },
    didDrawPage: drawFooter,
  });

  doc.addPage();
  drawSectionTitle(
    "2. Resumo sintético por carga e produto",
    "Totais de cada produto separados por carga, somando todos os pedidos da carga.",
    12,
  );
  autoTable(doc, {
    startY: 18,
    margin: { left: margin, right: margin, bottom: 12 },
    head: [[
      "ID", "Carga", "Nº carga", "Embarque", "Cód. produto",
      "Descrição do produto", "Pedidos", "Planejado", "Sistema", "Diferença",
    ]],
    body: loadProductRows,
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 7,
      cellPadding: 1.8,
      textColor: [27, 58, 89],
      lineColor: [200, 212, 224],
      lineWidth: 0.18,
      valign: "middle",
    },
    headStyles: {
      fillColor: [23, 61, 110],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      halign: "center",
    },
    alternateRowStyles: { fillColor: [246, 249, 252] },
    columnStyles: {
      0: { cellWidth: 15, halign: "center", fontStyle: "bold" },
      1: { cellWidth: 34 },
      2: { cellWidth: 18, halign: "center" },
      3: { cellWidth: 20, halign: "center" },
      4: { cellWidth: 20, halign: "center" },
      5: { cellWidth: 65 },
      6: { cellWidth: 18, halign: "center" },
      7: { cellWidth: 28, halign: "right" },
      8: { cellWidth: 28, halign: "right" },
      9: { cellWidth: 28, halign: "right", fontStyle: "bold" },
    },
    didDrawPage: drawFooter,
  });

  doc.addPage();
  drawSectionTitle(
    "3. Detalhamento analítico por pedido",
    "Itens organizados por carga, pedido e produto, com total de cada pedido e da carga.",
    12,
  );
  autoTable(doc, {
    startY: 18,
    margin: { left: margin, right: margin, bottom: 12 },
    head: [[
      "Carga", "Nº pedido", "Cliente", "Embarque", "Cód. produto",
      "Descrição do produto", "Total pedido", "Preço pedido", "Sistema",
      "Preço sistema", "Diferença peso", "Diferença preço", "Status",
    ]],
    body: rows,
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 6.5,
      cellPadding: 1.7,
      textColor: [27, 58, 89],
      lineColor: [200, 212, 224],
      lineWidth: 0.18,
      valign: "middle",
    },
    headStyles: {
      fillColor: [23, 61, 110],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      halign: "center",
    },
    alternateRowStyles: { fillColor: [246, 249, 252] },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 14, halign: "center" },
      2: { cellWidth: 30 },
      3: { cellWidth: 16, halign: "center" },
      4: { cellWidth: 14, halign: "center" },
      5: { cellWidth: 38 },
      6: { cellWidth: 17, halign: "right" },
      7: { cellWidth: 18, halign: "right" },
      8: { cellWidth: 17, halign: "right" },
      9: { cellWidth: 18, halign: "right" },
      10: { cellWidth: 17, halign: "right" },
      11: { cellWidth: 18, halign: "right" },
      12: { cellWidth: 15, halign: "center" },
    },
    didParseCell: (data) => {
      if (data.section !== "body") return;
      const rawRow = data.row.raw as unknown[];
      const label = String(rawRow?.[5] || "");
      const isLoadHeader = label.startsWith("CARGA:");
      const isOrderTotal = label.startsWith("TOTAL DO PEDIDO");
      const isLoadTotal = label.startsWith("TOTAL DA CARGA");
      if (isLoadHeader) {
        data.cell.styles.fillColor = [23, 61, 110];
        data.cell.styles.textColor = [255, 255, 255];
        data.cell.styles.fontStyle = "bold";
        return;
      }
      if (isOrderTotal) {
        data.cell.styles.fillColor = [230, 238, 246];
        data.cell.styles.textColor = [23, 61, 110];
        data.cell.styles.fontStyle = "bold";
        return;
      }
      if (isLoadTotal) {
        data.cell.styles.fillColor = [23, 61, 110];
        data.cell.styles.textColor = [255, 255, 255];
        data.cell.styles.fontStyle = "bold";
        return;
      }
      if (data.column.index !== 10 && data.column.index !== 11) return;
      const numeric = Number(String(data.cell.raw).replace(/[^\d,-]/g, "").replace(".", "").replace(",", "."));
      if (data.column.index === 11 && numeric !== 0) {
        data.cell.styles.fillColor = [255, 247, 225];
        data.cell.styles.textColor = [146, 92, 10];
      } else {
        if (numeric < 0) data.cell.styles.textColor = [198, 40, 40];
        if (numeric > 0) data.cell.styles.textColor = [4, 128, 93];
      }
      data.cell.styles.fontStyle = "bold";
    },
    didDrawPage: drawFooter,
  });

  doc.save(`pedidos-mi-${new Date().toISOString().slice(0, 10)}.pdf`);
}
