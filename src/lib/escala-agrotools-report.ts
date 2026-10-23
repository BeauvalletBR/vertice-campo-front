import type {
  AgrotoolsAnaliseStatus,
  EscalaAgrotoolsAnalise,
  EscalaLinha,
} from "@/types/escala";

export interface EscalaAgrotoolsReportRecord {
  row: EscalaLinha;
  analysis: EscalaAgrotoolsAnalise;
}

const statusLabel = (status: AgrotoolsAnaliseStatus) => {
  switch (status) {
    case "APTO":
      return "Apto";
    case "APTO_COM_RESSALVAS":
      return "Apto com ressalva";
    case "INAPTO":
      return "Inapto";
    case "NAO_ENCONTRADO":
      return "IE não encontrada";
    case "ERRO":
      return "Erro na consulta";
    case "EM_ANALISE":
      return "Em análise";
    default:
      return "Sem cadastro/consulta";
  }
};

const statusOrder: Record<AgrotoolsAnaliseStatus, number> = {
  INAPTO: 0,
  APTO_COM_RESSALVAS: 1,
  APTO: 2,
  NAO_ENCONTRADO: 3,
  PENDENTE: 4,
  EM_ANALISE: 5,
  ERRO: 6,
};

const formatDate = (value: string) => {
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
};

export const getAgrotoolsCars = (analysis: EscalaAgrotoolsAnalise) =>
  Array.from(
    new Set(
      [
        ...(analysis.cars || []),
        ...(analysis.fazendas || []).map((farm) => farm.car),
      ]
        .map((value) => String(value || "").trim())
        .filter(Boolean),
    ),
  );

export const normalizeAgrotoolsText = (value: unknown) => {
  let text = String(value || "");
  if (!/[ÃÂâ]/.test(text)) return text;

  for (let attempt = 0; attempt < 2 && /[ÃÂâ]/.test(text); attempt += 1) {
    try {
      const bytes = Uint8Array.from(text, (character) => character.charCodeAt(0));
      const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      if (decoded === text) break;
      text = decoded;
    } catch {
      break;
    }
  }
  return text;
};

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

const getReasons = (analysis: EscalaAgrotoolsAnalise) => {
  const reasons: string[] = [];
  for (const farm of analysis.fazendas || []) {
    for (const criterion of [
      ...(farm.criteriosInaptos || []),
      ...(farm.criteriosComRessalva || []),
    ]) {
      const title = normalizeAgrotoolsText(
        criterion.criterio || criterion.classificacao || "Critério",
      );
      const detail = normalizeAgrotoolsText(
        criterion.motivo || criterion.resultadoOriginal,
      );
      reasons.push(detail ? `${title}: ${detail}` : title);
    }
  }
  for (const criterion of analysis.criterios || []) {
    const title = normalizeAgrotoolsText(
      criterion.criterio || criterion.classificacao || "Critério",
    );
    const detail = normalizeAgrotoolsText(
      criterion.motivo || criterion.resultadoOriginal,
    );
    reasons.push(detail ? `${title}: ${detail}` : title);
  }

  const uniqueReasons = Array.from(new Set(reasons.filter(Boolean)));
  if (uniqueReasons.length) return uniqueReasons.join(" | ");
  if (analysis.mensagem) return normalizeAgrotoolsText(analysis.mensagem);
  if (analysis.status === "APTO") return "Apto sem ressalvas informadas pela Agrotools.";
  if (analysis.status === "NAO_ENCONTRADO") {
    return "Inscrição estadual não encontrada no sistema da Agrotools.";
  }
  if (analysis.status === "PENDENTE") {
    return "Sem inscrição ou consulta Agrotools vinculada à escala.";
  }
  return "Nenhum detalhe adicional informado.";
};

export async function exportScaleAgrotoolsPdf({
  date,
  records,
}: {
  date: string;
  records: EscalaAgrotoolsReportRecord[];
}) {
  const [{ jsPDF }, { default: autoTable }, beauvalletLogo, agrotoolsLogo] =
    await Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
      loadImageDataUrl(`${window.location.origin}/logo.png`),
      loadImageDataUrl(`${window.location.origin}/agrotools-logo.png`),
    ]);

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;
  const generatedAt = new Date().toLocaleString("pt-BR");
  doc.setProperties({
    title: `Relatório Agrotools - Escala ${formatDate(date)}`,
    subject: "Aptidão socioambiental dos produtores da escala de abate",
    author: "Beauvallet",
  });
  const orderedRecords = [...records].sort((first, second) => {
    const statusDifference =
      statusOrder[first.analysis.status] - statusOrder[second.analysis.status];
    if (statusDifference) return statusDifference;
    return String(first.row.PRODUTOR || "").localeCompare(
      String(second.row.PRODUTOR || ""),
      "pt-BR",
    );
  });

  doc.setFillColor(16, 49, 88);
  doc.rect(0, 0, pageWidth, 3.2, "F");
  if (beauvalletLogo) {
    doc.addImage(beauvalletLogo, "PNG", margin, 7, 21, 18, undefined, "FAST");
  }
  if (agrotoolsLogo) {
    doc.addImage(
      agrotoolsLogo,
      "PNG",
      pageWidth - margin - 34,
      9,
      34,
      12,
      undefined,
      "FAST",
    );
  }

  doc.setTextColor(92, 110, 128);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.8);
  doc.text("VERTICE | ESCALA", margin + 27, 9.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.4);
  doc.text("CONFORMIDADE SOCIOAMBIENTAL", margin + 27, 12.7);
  doc.setTextColor(16, 49, 88);
  doc.setFont("times", "bold");
  doc.setFontSize(16);
  doc.text("Relatório de Aptidão Agrotools", margin + 27, 19.2);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Escala de abate | ${formatDate(date)}`, margin + 27, 24.5);
  doc.setTextColor(103, 120, 137);
  doc.setFontSize(7.2);
  doc.text(`Emitido em ${generatedAt}`, margin + 27, 28.5);
  doc.setDrawColor(198, 210, 221);
  doc.setLineWidth(0.35);
  doc.line(margin, 32, pageWidth - margin, 32);

  const totals = orderedRecords.reduce(
    (summary, record) => {
      const status = record.analysis.status;
      if (status === "APTO") summary.aptos += 1;
      else if (status === "APTO_COM_RESSALVAS") summary.ressalvas += 1;
      else if (status === "INAPTO") summary.inaptos += 1;
      else summary.semCadastro += 1;
      summary.animals +=
        Number(record.row.QTD_BOI || 0) + Number(record.row.QTD_VACA || 0);
      return summary;
    },
    { aptos: 0, ressalvas: 0, inaptos: 0, semCadastro: 0, animals: 0 },
  );

  const summary = [
    ["Produtores", orderedRecords.length, [23, 61, 110]],
    ["Animais", totals.animals, [23, 61, 110]],
    ["Aptos", totals.aptos, [19, 117, 84]],
    ["Com ressalva", totals.ressalvas, [166, 83, 18]],
    ["Inaptos", totals.inaptos, [181, 35, 44]],
    ["Sem cadastro/consulta", totals.semCadastro, [96, 117, 138]],
  ] as const;
  const summaryWidth = (pageWidth - margin * 2) / summary.length;
  summary.forEach(([label, value, color], index) => {
    const x = margin + index * summaryWidth;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(216, 226, 236);
    doc.roundedRect(x, 36, summaryWidth - 1.5, 17, 1.2, 1.2, "FD");
    doc.setTextColor(96, 117, 138);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.4);
    doc.text(label.toUpperCase(), x + 3, 41.5);
    doc.setTextColor(color[0], color[1], color[2]);
    doc.setFontSize(12);
    doc.text(String(value), x + 3, 48.8);
  });

  autoTable(doc, {
    startY: 58,
    margin: { left: margin, right: margin, bottom: 15 },
    head: [[
      "Produtor / propriedade",
      "Pedido",
      "IE consultada",
      "CAR",
      "Animais",
      "Situação",
      "Motivo / observação",
    ]],
    body: orderedRecords.map(({ row, analysis }) => [
      `${row.PRODUTOR || analysis.produtor || "Não informado"}\n${
        row.DESC_PROPRIEDADE || analysis.fazenda || "Propriedade não informada"
      }`,
      row.NROPEDIDO ? String(row.NROPEDIDO) : "Manual",
      analysis.entrada?.ie || "Não informada",
      getAgrotoolsCars(analysis).join("\n") || "Não informado",
      String(Number(row.QTD_BOI || 0) + Number(row.QTD_VACA || 0)),
      statusLabel(analysis.status),
      getReasons(analysis),
    ]),
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 7.3,
      cellPadding: { top: 2.4, right: 2, bottom: 2.4, left: 2 },
      lineColor: [215, 226, 236],
      lineWidth: 0.2,
      textColor: [45, 65, 86],
      valign: "middle",
      overflow: "linebreak",
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    headStyles: {
      fillColor: [23, 61, 110],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 7,
      halign: "left",
    },
    columnStyles: {
      0: { cellWidth: 47, fontStyle: "bold" },
      1: { cellWidth: 16, halign: "center" },
      2: { cellWidth: 25 },
      3: { cellWidth: 43, fontSize: 6.5 },
      4: { cellWidth: 14, halign: "right" },
      5: { cellWidth: 28, fontStyle: "bold" },
      6: { cellWidth: "auto" },
    },
    didParseCell: (data) => {
      if (data.section !== "body" || data.column.index !== 5) return;
      const status = String(data.cell.raw || "");
      if (status === "Apto") {
        data.cell.styles.fillColor = [234, 248, 241];
        data.cell.styles.textColor = [19, 117, 84];
      } else if (status === "Apto com ressalva") {
        data.cell.styles.fillColor = [255, 244, 232];
        data.cell.styles.textColor = [166, 83, 18];
      } else if (status === "Inapto") {
        data.cell.styles.fillColor = [255, 237, 239];
        data.cell.styles.textColor = [181, 35, 44];
      } else {
        data.cell.styles.fillColor = [242, 245, 248];
        data.cell.styles.textColor = [96, 117, 138];
      }
    },
    didDrawPage: () => {
      const currentPage = doc.getCurrentPageInfo().pageNumber;
      doc.setDrawColor(215, 226, 236);
      doc.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10);
      doc.setTextColor(96, 117, 138);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.text("Beauvallet | VERTICE | Planejamento de Escala", margin, pageHeight - 6);
      doc.text(`Página ${currentPage}`, pageWidth - margin, pageHeight - 6, {
        align: "right",
      });
    },
  });

  doc.save(`agrotools-escala-${date}.pdf`);
}
