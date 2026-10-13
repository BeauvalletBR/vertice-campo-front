import type { Product, YieldTest } from "../types/domain";
import { calculateTotalDiscard } from "./calculations";
import {
  formatDate,
  formatDateTime,
  formatPercent,
  formatWeight,
} from "./format";

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

export function buildFinalizedTestReport(
  test: YieldTest,
  products: Product[],
  logoUrl = "/logo.png",
) {
  const productName = (id?: string) =>
    products.find((item) => item.id === id)?.name || "Não informado";
  const confirmedSteps = test.flows.flatMap((flow) =>
    flow.steps.slice(0, -1).filter((step) => step.confirmed),
  );
  const totalDiscard = confirmedSteps.reduce(
    (total, step) => total + calculateTotalDiscard(step.discards),
    0,
  );
  const finalWeight = test.flows.reduce((total, flow) => {
    const lastStep = [...flow.steps].reverse().find((step) => step.confirmed);
    return total + (lastStep?.cleanWeightKg || 0);
  }, 0);
  const finalYield =
    test.inputWeightKg > 0 ? (finalWeight / test.inputWeightKg) * 100 : 0;

  const groups = test.flows
    .map((flow, flowIndex) => {
      const steps = flow.steps.filter((step) => step.confirmed);
      const firstStep = steps[0];
      const lastStep = steps.at(-1);
      const operationSteps = steps.slice(0, -1);
      const groupDiscard = operationSteps.reduce(
        (total, step) => total + calculateTotalDiscard(step.discards),
        0,
      );
      const groupYield = firstStep?.initialWeightKg
        ? ((lastStep?.cleanWeightKg || 0) / firstStep.initialWeightKg) * 100
        : 0;
      const inputShare =
        test.inputWeightKg > 0
          ? ((lastStep?.cleanWeightKg || 0) / test.inputWeightKg) * 100
          : 0;
      const rows = operationSteps
        .map((step, stepIndex) => {
          const discards = step.discards.filter(
            (discard) => discard.weightKg > 0,
          );
          const cumulativeStageYield = firstStep?.initialWeightKg
            ? (step.initialWeightKg / firstStep.initialWeightKg) * 100
            : 0;
          const discardText = discards.length
            ? discards
                .map(
                  (discard) =>
                    `${escapeHtml(discard.name)}: ${formatWeight(discard.weightKg)}`,
                )
                .join("<br>")
            : "—";
          return `<tr>
        <td><strong>${stepIndex + 1}</strong></td>
        <td><strong>${escapeHtml(productName(step.productId))}</strong></td>
        <td><strong>${escapeHtml(productName(steps[stepIndex + 1]?.productId))}</strong></td>
        <td class="number">${formatWeight(step.initialWeightKg)}</td>
        <td>${discardText}</td>
        <td class="number negative">${formatWeight(calculateTotalDiscard(step.discards))}</td>
        <td class="number">${formatWeight(step.cleanWeightKg)}</td>
        <td class="number positive">${formatPercent(cumulativeStageYield)}</td>
        <td class="number positive">${formatPercent(step.inputYieldPercent)}</td>
      </tr>`;
        })
        .join("");

      return `<section class="product-group">
      <div class="group-heading">
        <div><span>Grupo de produto ${flowIndex + 1}</span><h2>${escapeHtml(productName(flow.rootProductId))}</h2><p>${flow.productIds.map(productName).map(escapeHtml).join(" → ")}</p></div>
        <div class="group-yield"><span>Rendimento final do grupo · peso final ÷ peso inicial</span><strong>${formatPercent(groupYield)}</strong></div>
      </div>
      <div class="group-metrics">
        <div><span>Produto final</span><strong>${escapeHtml(productName(lastStep?.productId))}</strong></div>
        <div><span>Peso inicial do grupo</span><strong>${formatWeight(firstStep?.initialWeightKg || 0)}</strong></div>
        <div><span>Total de descartes</span><strong>${formatWeight(groupDiscard)}</strong></div>
        <div><span>Peso final do grupo</span><strong>${formatWeight(lastStep?.cleanWeightKg || 0)}</strong></div>
        <div><span>Peso final sobre a entrada</span><strong>${formatPercent(inputShare)}</strong></div>
      </div>
      <table><thead><tr><th>Etapa</th><th>Produto processado</th><th>Produto gerado</th><th>Peso inicial</th><th>Descartes</th><th>Total retirado</th><th>Peso gerado</th><th>Rend. etapa</th><th>Sobre entrada</th></tr></thead><tbody>${rows}</tbody></table>
    </section>`;
    })
    .join("");

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório - Teste ${test.number} - ${escapeHtml(test.name)}</title><style>
    @page{size:A4 landscape;margin:12mm}*{box-sizing:border-box}body{margin:0;color:#334155;background:#fff;font-family:Inter,Arial,sans-serif;font-size:11px;-webkit-print-color-adjust:exact;print-color-adjust:exact}.report{max-width:1320px;margin:0 auto}.brand{display:flex;align-items:center;justify-content:space-between;border-bottom:5px solid #173d6e;padding:0 0 12px}.brand-main{display:flex;align-items:center;gap:14px}.brand img{width:58px;height:52px;object-fit:contain}.brand h1{margin:0;color:#173d6e;font-size:22px}.brand p{margin:4px 0 0;color:#64748b}.report-code{text-align:right}.report-code span,.summary span,.group-heading span,.group-metrics span{display:block;color:#64748b;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.06em}.report-code strong{display:block;margin-top:4px;color:#173d6e;font-size:16px}.summary{display:grid;grid-template-columns:repeat(6,1fr);margin:16px 0;border:1px solid #d8e2ec;border-radius:10px;overflow:hidden}.summary div,.group-metrics div{padding:11px 12px;border-right:1px solid #e2e8f0}.summary div:last-child,.group-metrics div:last-child{border-right:0}.summary strong,.group-metrics strong{display:block;margin-top:5px;color:#1e293b;font-size:12px}.summary .highlight strong,.positive{color:#16805c}.product-group{margin:0 0 18px;border:1px solid #cbd5e1;border-radius:10px;overflow:hidden;break-inside:avoid}.group-heading{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:12px 14px;background:#f8fafc;border-bottom:1px solid #d8e2ec}.group-heading h2{margin:3px 0;color:#173d6e;font-size:16px}.group-heading p{margin:0;color:#64748b}.group-yield{text-align:right}.group-yield strong{display:block;margin-top:3px;color:#16805c;font-size:18px}.group-metrics{display:grid;grid-template-columns:repeat(5,1fr);border-bottom:1px solid #d8e2ec}.group-metrics div{padding:9px 12px}table{width:100%;border-collapse:collapse;font-size:10px}th{height:38px;padding:8px 10px;color:#334155;background:#f8fafc;border-bottom:1px solid #cbd5e1;font-size:9px;text-align:left;text-transform:uppercase}td{padding:9px 10px;border-bottom:1px solid #e2e8f0;vertical-align:top}tbody tr:last-child td{border-bottom:0}.number{text-align:right;white-space:nowrap}.negative{color:#b4232c}.footer{display:flex;justify-content:space-between;margin-top:8px;padding-top:9px;border-top:1px solid #cbd5e1;color:#64748b;font-size:9px}@media print{.report{max-width:none}}
  </style></head><body><main class="report">
    <header class="brand"><div class="brand-main"><img src="${escapeHtml(logoUrl)}" alt="Beauvallet"><div><h1>Relatório de Teste de Rendimento</h1><p>${escapeHtml(test.name || `Teste ${test.number}`)}</p></div></div><div class="report-code"><span>Identificação</span><strong>Teste ${test.number}</strong></div></header>
    <section class="summary">
      <div><span>Data do teste</span><strong>${formatDate(test.date)}</strong></div>
      <div><span>Matéria-prima</span><strong>${escapeHtml(productName(test.inputProductId))}</strong></div>
      <div><span>Peso de entrada</span><strong>${formatWeight(test.inputWeightKg)}</strong></div>
      <div><span>Total descartado</span><strong>${formatWeight(totalDiscard)}</strong></div>
      <div><span>Peso final somado</span><strong>${formatWeight(finalWeight)}</strong></div>
      <div class="highlight"><span>Rendimento final</span><strong>${formatPercent(finalYield)}</strong></div>
    </section>
    ${groups}
    <footer class="footer"><span>Finalizado por ${escapeHtml(test.finalizedBy || test.updatedBy)} em ${formatDateTime(test.finalizedAt || test.updatedAt)}</span><span>Relatório gerado em ${formatDateTime(new Date().toISOString())}</span></footer>
  </main><script>window.addEventListener("load",()=>setTimeout(()=>window.print(),250));</script></body></html>`;
}

async function loadImageDataUrl(url: string) {
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
}

export async function exportFinalizedTestReport(
  test: YieldTest,
  products: Product[],
) {
  if (test.status !== "FINALIZADO") return false;

  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;
  const contentWidth = pageWidth - margin * 2;
  const productName = (id?: string) =>
    products.find((item) => item.id === id)?.name || "Não informado";
  const confirmedSteps = test.flows.flatMap((flow) =>
    flow.steps.filter((step) => step.confirmed),
  );
  const totalDiscard = confirmedSteps.reduce(
    (total, step) => total + calculateTotalDiscard(step.discards),
    0,
  );
  const finalWeight = test.flows.reduce(
    (total, flow) =>
      total +
      ([...flow.steps].reverse().find((step) => step.confirmed)
        ?.cleanWeightKg || 0),
    0,
  );
  const finalYield =
    test.inputWeightKg > 0 ? (finalWeight / test.inputWeightKg) * 100 : 0;
  const logo = await loadImageDataUrl(`${window.location.origin}/logo.png`);

  if (logo) doc.addImage(logo, "PNG", margin, 7, 24, 21, undefined, "FAST");
  const titleX = logo ? margin + 30 : margin;
  doc.setTextColor(23, 61, 110);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(19);
  doc.text("Relatório de Teste de Rendimento", titleX, 14);
  doc.setFontSize(11);
  doc.text(test.name || `Teste ${test.number}`, titleX, 21);
  doc.setTextColor(96, 117, 138);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(
    `Finalizado em ${formatDateTime(test.finalizedAt || test.updatedAt)}`,
    titleX,
    26,
  );
  doc.setTextColor(23, 61, 110);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(`Teste ${test.number}`, pageWidth - margin, 15, { align: "right" });
  doc.setDrawColor(23, 61, 110);
  doc.setLineWidth(1.4);
  doc.line(margin, 31, pageWidth - margin, 31);

  const summary = [
    ["Data", formatDate(test.date)],
    ["Matéria-prima", productName(test.inputProductId)],
    ["Peso de entrada", formatWeight(test.inputWeightKg)],
    ["Total descartado", formatWeight(totalDiscard)],
    ["Peso final", formatWeight(finalWeight)],
    ["Rendimento final", formatPercent(finalYield)],
  ];
  const summaryWidth = contentWidth / summary.length;
  summary.forEach(([label, value], index) => {
    const x = margin + index * summaryWidth;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(216, 226, 236);
    doc.roundedRect(x, 36, summaryWidth - 1.5, 19, 1.5, 1.5, "FD");
    doc.setTextColor(96, 117, 138);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text(label.toUpperCase(), x + 3, 42);
    doc.setTextColor(
      index === summary.length - 1 ? 22 : 30,
      index === summary.length - 1 ? 128 : 41,
      index === summary.length - 1 ? 92 : 59,
    );
    doc.setFontSize(10);
    const clipped = doc.splitTextToSize(value, summaryWidth - 7)[0] || "—";
    doc.text(clipped, x + 3, 49);
  });

  let cursorY = 63;
  test.flows.forEach((flow, flowIndex) => {
    const steps = flow.steps.filter((step) => step.confirmed);
    const firstStep = steps[0];
    const lastStep = steps.at(-1);
    const operationSteps = steps.slice(0, -1);
    const groupDiscard = operationSteps.reduce(
      (total, step) => total + calculateTotalDiscard(step.discards),
      0,
    );
    const groupYield = firstStep?.initialWeightKg
      ? ((lastStep?.cleanWeightKg || 0) / firstStep.initialWeightKg) * 100
      : 0;
    const inputShare =
      test.inputWeightKg > 0
        ? ((lastStep?.cleanWeightKg || 0) / test.inputWeightKg) * 100
        : 0;

    if (cursorY > pageHeight - 58) {
      doc.addPage();
      cursorY = 15;
    }
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(margin, cursorY, contentWidth, 17, 2, 2, "FD");
    doc.setTextColor(27, 88, 160);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text(`GRUPO DE PRODUTO ${flowIndex + 1}`, margin + 4, cursorY + 5);
    doc.setTextColor(23, 61, 110);
    doc.setFontSize(13);
    doc.text(productName(flow.rootProductId), margin + 4, cursorY + 11);
    doc.setTextColor(96, 117, 138);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(
      doc.splitTextToSize(
        flow.productIds.map(productName).join(" → "),
        150,
      )[0] || "",
      margin + 4,
      cursorY + 15,
    );
    doc.setTextColor(22, 128, 92);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(formatPercent(groupYield), pageWidth - margin - 4, cursorY + 10, {
      align: "right",
    });
    doc.setTextColor(96, 117, 138);
    doc.setFontSize(6.5);
    doc.text("FINAL ÷ INICIAL DO GRUPO", pageWidth - margin - 4, cursorY + 14, {
      align: "right",
    });

    const metrics = [
      `Produto final: ${productName(lastStep?.productId)}`,
      `Inicial: ${formatWeight(firstStep?.initialWeightKg || 0)}`,
      `Descartes: ${formatWeight(groupDiscard)}`,
      `Final: ${formatWeight(lastStep?.cleanWeightKg || 0)}`,
      `Final sobre entrada: ${formatPercent(inputShare)}`,
    ];
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    metrics.forEach((metric, index) =>
      doc.text(metric, margin + index * (contentWidth / 5), cursorY + 23),
    );

    autoTable(doc, {
      startY: cursorY + 27,
      margin: { left: margin, right: margin, bottom: 12 },
      head: [
        [
          "Etapa",
          "Produto processado",
          "Produto gerado",
          "Peso inicial",
          "Descartes",
          "Total retirado",
          "Peso gerado",
          "Rend. etapa",
          "Sobre entrada",
        ],
      ],
      body: operationSteps.map((step, stepIndex) => {
        const cumulativeStageYield = firstStep?.initialWeightKg
          ? (step.initialWeightKg / firstStep.initialWeightKg) * 100
          : 0;
        return [
          String(stepIndex + 1),
          productName(step.productId),
          productName(steps[stepIndex + 1]?.productId),
          formatWeight(step.initialWeightKg),
          step.discards
            .filter((discard) => discard.weightKg > 0)
            .map(
              (discard) => `${discard.name}: ${formatWeight(discard.weightKg)}`,
            )
            .join("\n") || "—",
          formatWeight(calculateTotalDiscard(step.discards)),
          formatWeight(step.cleanWeightKg),
          formatPercent(cumulativeStageYield),
          formatPercent(step.inputYieldPercent),
        ];
      }),
      theme: "grid",
      styles: {
        font: "helvetica",
        fontSize: 7.5,
        cellPadding: 2.5,
        textColor: [71, 85, 105],
        lineColor: [226, 232, 240],
        lineWidth: 0.2,
        valign: "middle",
      },
      headStyles: {
        fillColor: [248, 250, 252],
        textColor: [51, 65, 85],
        fontStyle: "bold",
        fontSize: 7,
        minCellHeight: 9,
      },
      columnStyles: {
        0: { cellWidth: 12, halign: "center" },
        1: { cellWidth: 31, fontStyle: "bold" },
        2: { cellWidth: 31, fontStyle: "bold", textColor: [23, 61, 110] },
        3: { halign: "right" },
        5: { halign: "right", textColor: [180, 56, 66] },
        6: { halign: "right" },
        7: { halign: "right", textColor: [22, 128, 92], fontStyle: "bold" },
        8: { halign: "right", textColor: [22, 128, 92], fontStyle: "bold" },
      },
    });
    cursorY =
      ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
        ?.finalY || cursorY + 40) + 10;
  });

  if (cursorY > pageHeight - 13) {
    doc.addPage();
    cursorY = 15;
  }
  doc.setDrawColor(203, 213, 225);
  doc.line(margin, cursorY, pageWidth - margin, cursorY);
  doc.setTextColor(96, 117, 138);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(
    `Responsável: ${test.finalizedBy || test.updatedBy}`,
    margin,
    cursorY + 5,
  );
  doc.text(
    `PDF gerado em ${formatDateTime(new Date().toISOString())}`,
    pageWidth - margin,
    cursorY + 5,
    { align: "right" },
  );

  const safeName = (test.name || `teste-${test.number}`)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  doc.save(`relatorio-teste-${test.number}-${safeName}.pdf`);
  return true;
}
