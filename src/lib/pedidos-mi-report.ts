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

  const rows = pedidos.flatMap((pedido) =>
    pedido.ITENS.map((item, index) => [
      index === 0 ? pedido.NOME_CARGA : "",
      index === 0 ? String(pedido.NROPEDIDO || "-") : "",
      index === 0 ? pedido.CLIENTE : "",
      index === 0 ? formatDate(pedido.DTA_EMBARQUE) : "",
      item.SEQPRODUTO || "-",
      item.PRODUTO,
      `${weight.format(Number(item.PESO_PEDIDO || 0))} kg`,
      item.PRECO_PEDIDO == null ? "-" : currency.format(item.PRECO_PEDIDO),
      `${weight.format(Number(item.PESO_SISTEMA || 0))} kg`,
      item.PRECO_SISTEMA == null ? "-" : currency.format(item.PRECO_SISTEMA),
      `${weight.format(Number(item.DIFERENCA_PESO || 0))} kg`,
      index === 0 ? pedido.STATUS : "",
    ]),
  );

  autoTable(doc, {
    startY: 28,
    margin: { left: margin, right: margin, bottom: 12 },
    head: [[
      "Carga", "Nº pedido", "Cliente", "Embarque", "Cód. produto",
      "Descrição do produto", "Total pedido", "Preço pedido", "Sistema",
      "Preço sistema", "Diferença peso", "Status",
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
      0: { cellWidth: 24 },
      1: { cellWidth: 15, halign: "center" },
      2: { cellWidth: 35 },
      3: { cellWidth: 18, halign: "center" },
      4: { cellWidth: 17, halign: "center" },
      5: { cellWidth: 47 },
      6: { cellWidth: 19, halign: "right" },
      7: { cellWidth: 20, halign: "right" },
      8: { cellWidth: 18, halign: "right" },
      9: { cellWidth: 20, halign: "right" },
      10: { cellWidth: 20, halign: "right" },
      11: { cellWidth: 18, halign: "center" },
    },
    didParseCell: (data) => {
      if (data.section !== "body" || data.column.index !== 10) return;
      const numeric = Number(String(data.cell.raw).replace(/[^\d,-]/g, "").replace(".", "").replace(",", "."));
      if (numeric < 0) data.cell.styles.textColor = [198, 40, 40];
      if (numeric > 0) data.cell.styles.textColor = [4, 128, 93];
      data.cell.styles.fontStyle = "bold";
    },
    didDrawPage: () => {
      const pageHeight = doc.internal.pageSize.getHeight();
      doc.setFontSize(6.5);
      doc.setTextColor(110, 126, 143);
      doc.text("Beauvallet | Documento gerado pelo Vértice", margin, pageHeight - 5);
      doc.text(`Página ${doc.getNumberOfPages()}`, pageWidth - margin, pageHeight - 5, {
        align: "right",
      });
    },
  });

  doc.save(`pedidos-mi-${new Date().toISOString().slice(0, 10)}.pdf`);
}
