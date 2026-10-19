"use client";

import { Fragment, useState } from "react";
import { Activity, Boxes, ChevronDown, ChevronUp, FileSpreadsheet, GitBranch, Layers3, Scale, Table2, Target, TestTube2, Trash2 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader } from "../components/PageHeader";
import { ResultFlowTree } from "../components/ResultFlowTree";
import { TraceabilityMatrix } from "../components/TraceabilityMatrix";
import { useRendimentoData } from "../context/RendimentoDataContext";
import { calculateFlowFinalWeight, calculateFlowReferenceWeight, calculateTotalDiscard } from "../utils/calculations";
import { formatDate, formatPercent, formatWeight } from "../utils/format";
import { buildTraceabilityMatrices, exportTraceabilityExcel } from "../utils/traceabilityReport";

const pct = (value: number, base: number) => base > 0 ? (value / base) * 100 : 0;

export function YieldDashboardPage() {
  const { products, tests, weightBands } = useRendimentoData();
  const [productId, setProductId] = useState("");
  const [bandId, setBandId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [expandedRecords, setExpandedRecords] = useState<string[]>([]);
  const [detailViews, setDetailViews] = useState<Record<string, "flow" | "table">>({});
  const nameOf = (id: string) => products.find((product) => product.id === id)?.name || "Produto";

  const rawRecords = tests.filter((test) => test.status === "FINALIZADO").flatMap((test) => {
    const matrices = buildTraceabilityMatrices(test, products);
    return test.flows.map((flow) => {
      const referenceWeight = calculateFlowReferenceWeight(flow, test.inputWeightKg);
      const averageReference = test.bandReferenceWeightKg ?? (test.inputQuantity > 0 ? referenceWeight / test.inputQuantity : referenceWeight);
      const matrix = matrices.find((item) => item.id === flow.id);
      const inputRow = matrix?.rows.find((row) => row.kind === "input");
      const firstProductRow = matrix?.rows.find((row) => row.kind === "product" || row.kind === "final");
      const hasInputWeights = Boolean(test.inputProductId) && Boolean(inputRow?.values.some((value) => value > 0));
      const referenceProductId = hasInputWeights ? test.inputProductId : flow.rootProductId;
      const referenceValues = hasInputWeights ? inputRow?.values || [] : firstProductRow?.values || [];
      const finalRows = matrix?.rows.filter((row) => row.kind === "final") || [];
      const discardRows = matrix?.rows.filter((row) => row.kind === "discard") || [];
      const pieceBands = (matrix?.pieceOrders || []).map((_, index) => {
        const pieceReference = referenceValues[index] || 0;
        const band = weightBands.find((item) => item.productReferenceId === referenceProductId && pieceReference >= item.minWeightKg && (item.maxWeightKg == null || pieceReference < item.maxWeightKg));
        return {
          band,
          referenceWeight: pieceReference,
          finalWeight: finalRows.reduce((total, row) => total + (row.values[index] || 0), 0),
          discardWeight: discardRows.reduce((total, row) => total + (row.values[index] || 0), 0),
        };
      }).filter((piece) => piece.referenceWeight > 0);
      const savedBand = weightBands.find((band) => band.id === test.weightBandId);
      const dynamicBand = weightBands.find((band) => band.productReferenceId === referenceProductId && averageReference >= band.minWeightKg && (band.maxWeightKg == null || averageReference < band.maxWeightKg));
      const resolvedBand = savedBand || dynamicBand;
      const discardWeight = flow.steps.reduce((total, step) => total + calculateTotalDiscard(step.discards), 0);
      const finalWeight = calculateFlowFinalWeight(flow);
      return {
        test, flow, pieceBands,
        productId: flow.rootProductId,
        productName: nameOf(flow.rootProductId),
        referenceWeight, averageReference, finalWeight, discardWeight,
        yieldPercent: pct(finalWeight, referenceWeight),
        discardPercent: pct(discardWeight, referenceWeight),
        bandId: test.weightBandId || resolvedBand?.id || "",
        bandName: test.weightBandName || resolvedBand?.name || "Sem faixa",
        bandColor: resolvedBand?.color || "#7890A8",
      };
    });
  });
  const records = rawRecords.filter((record) => (!productId || record.productId === productId) && (!bandId || record.pieceBands.some((piece) => piece.band?.id === bandId) || (!record.pieceBands.length && record.bandId === bandId)) && (!startDate || record.test.date >= startDate) && (!endDate || record.test.date <= endDate)).map((record) => {
    if (!bandId) return record;
    const scopedPieces = record.pieceBands.filter((piece) => piece.band?.id === bandId);
    if (!scopedPieces.length) return record;
    const selectedBand = weightBands.find((band) => band.id === bandId);
    const referenceWeight = scopedPieces.reduce((total, piece) => total + piece.referenceWeight, 0);
    const finalWeight = scopedPieces.reduce((total, piece) => total + piece.finalWeight, 0);
    const discardWeight = scopedPieces.reduce((total, piece) => total + piece.discardWeight, 0);
    return { ...record, referenceWeight, finalWeight, discardWeight, averageReference: referenceWeight / scopedPieces.length, yieldPercent: pct(finalWeight, referenceWeight), discardPercent: pct(discardWeight, referenceWeight), bandId, bandName: selectedBand?.name || record.bandName, bandColor: selectedBand?.color || record.bandColor };
  });

  const totalReference = records.reduce((sum, item) => sum + item.referenceWeight, 0);
  const totalFinal = records.reduce((sum, item) => sum + item.finalWeight, 0);
  const totalDiscard = records.reduce((sum, item) => sum + item.discardWeight, 0);
  const weightedYield = pct(totalFinal, totalReference);
  const averageReference = records.length ? records.reduce((sum, item) => sum + item.averageReference, 0) / records.length : 0;
  const bandGroups = new Map<string, { name: string; color: string; reference: number; final: number }>();
  records.forEach((record) => {
    const pieces = bandId ? record.pieceBands.filter((piece) => piece.band?.id === bandId) : record.pieceBands;
    if (!pieces.length) {
      const key = record.bandId || record.bandName;
      const group = bandGroups.get(key) || { name: record.bandName, color: record.bandColor, reference: 0, final: 0 };
      group.reference += record.referenceWeight;
      group.final += record.finalWeight;
      bandGroups.set(key, group);
      return;
    }
    pieces.forEach((piece) => {
      const key = piece.band?.id || "sem-faixa";
      const group = bandGroups.get(key) || { name: piece.band?.name || "Sem faixa", color: piece.band?.color || "#7890A8", reference: 0, final: 0 };
      group.reference += piece.referenceWeight;
      group.final += piece.finalWeight;
      bandGroups.set(key, group);
    });
  });
  const byBand = [...bandGroups.values()].map((group) => ({ name: group.name, rendimento: pct(group.final, group.reference), color: group.color }));
  const trend = [...records].sort((a, b) => a.test.date.localeCompare(b.test.date) || a.test.number - b.test.number).map((item) => ({ name: `#${item.test.number}`, rendimento: Number(item.yieldPercent.toFixed(2)), date: formatDate(item.test.date) }));
  const availableProducts = products.filter((product) => tests.some((test) => test.status === "FINALIZADO" && test.flows.some((flow) => flow.rootProductId === product.id)));
  const recordKeys = records.map((item) => `${item.test.id}-${item.flow.id}`);
  const allExpanded = recordKeys.length > 0 && recordKeys.every((key) => expandedRecords.includes(key));
  const toggleRecord = (key: string) => setExpandedRecords((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
  const toggleAll = () => setExpandedRecords(allExpanded ? [] : recordKeys);

  return <>
    <PageHeader eyebrow="Análise" title="Dashboard de Rendimento" description="Compare testes do mesmo produto por período e faixa de peso, com médias ponderadas pelos quilos processados." />
    <section className="yield-dashboard-filters"><label>Produto<select value={productId} onChange={(event) => setProductId(event.target.value)}><option value="">Todos os produtos</option>{availableProducts.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label><label>Faixa de peso<select value={bandId} onChange={(event) => setBandId(event.target.value)}><option value="">Todas as faixas</option>{weightBands.filter((band) => band.active).map((band) => <option key={band.id} value={band.id}>{band.productReferenceName} · {band.name}</option>)}</select></label><label>Início<input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label><label>Fim<input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label></section>
    <section className="yield-dashboard-cards"><article><span><TestTube2 size={18} />Testes comparados</span><strong>{records.length}</strong><small>registros finalizados</small></article><article><span><Scale size={18} />Peso médio base</span><strong>{formatWeight(averageReference)}</strong><small>por peça</small></article><article className="featured"><span><Target size={18} />Rendimento ponderado</span><strong>{formatPercent(weightedYield)}</strong><small>{formatWeight(totalFinal)} de produto final</small></article><article><span><Trash2 size={18} />Descarte</span><strong>{formatPercent(pct(totalDiscard, totalReference))}</strong><small>{formatWeight(totalDiscard)} retirados</small></article><article><span><Boxes size={18} />Peso analisado</span><strong>{formatWeight(totalReference)}</strong><small>base dos cálculos</small></article></section>
    <section className="yield-dashboard-grid"><article className="yield-dashboard-chart"><header><div><span>Comparação</span><h2>Rendimento por faixa</h2></div><Activity size={20} /></header><div>{byBand.length ? <ResponsiveContainer width="100%" height={300}><BarChart data={byBand} layout="vertical" margin={{ left: 14, right: 35 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" domain={[0, 100]} tickFormatter={(value) => `${value}%`} /><YAxis dataKey="name" type="category" width={110} /><Tooltip formatter={(value: number) => formatPercent(value)} /><Bar dataKey="rendimento" radius={[0, 6, 6, 0]} label={{ position: "right", formatter: (value: number) => formatPercent(value), fill: "#173D6E", fontSize: 11 }}>{byBand.map((item) => <Cell key={item.name} fill={item.color} />)}</Bar></BarChart></ResponsiveContainer> : <p className="dashboard-empty">Nenhum teste encontrado para os filtros.</p>}</div></article><article className="yield-dashboard-chart"><header><div><span>Evolução</span><h2>Rendimento por teste</h2></div><Activity size={20} /></header><div>{trend.length ? <ResponsiveContainer width="100%" height={300}><LineChart data={trend} margin={{ left: 4, right: 22 }}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} /><Tooltip formatter={(value: number) => formatPercent(value)} labelFormatter={(_, payload) => payload?.[0]?.payload?.date || ""} /><Line type="monotone" dataKey="rendimento" stroke="#173D6E" strokeWidth={3} dot={{ fill: "#DC2626", r: 4 }} /></LineChart></ResponsiveContainer> : <p className="dashboard-empty">Nenhum teste encontrado para os filtros.</p>}</div></article></section>
    <section className="table-panel yield-dashboard-table">
      <header className="table-title yield-comparison-header">
        <div><span>Comparativo teste a teste</span><small>Expanda uma linha para consultar todo o fluxo analítico do teste</small></div>
        {records.length > 0 && <button type="button" className="comparison-expand-all" onClick={toggleAll}>{allExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}{allExpanded ? "Recolher todos" : "Expandir todos"}</button>}
      </header>
      <div className="responsive-table"><table><thead><tr><th aria-label="Detalhar teste" /><th>Teste / data</th><th>Produto</th><th>Faixa</th><th>Peso base</th><th>Base média</th><th>Produto final</th><th>Descarte</th><th>Rendimento</th></tr></thead><tbody>{records.map((item) => {
        const recordKey = `${item.test.id}-${item.flow.id}`;
        const expanded = expandedRecords.includes(recordKey);
        const detailView = detailViews[recordKey] || (item.test.executionMode === "traceable" ? "table" : "flow");
        return <Fragment key={recordKey}>
          <tr className={`yield-comparison-row ${expanded ? "is-expanded" : ""}`} style={{ borderLeftColor: item.bandColor, background: `${item.bandColor}12` }}>
            <td><button type="button" className="comparison-expand-button" aria-expanded={expanded} title={expanded ? "Recolher análise" : "Ver teste analítico"} onClick={() => toggleRecord(recordKey)}>{expanded ? <ChevronUp size={17} /> : <ChevronDown size={17} />}</button></td>
            <td><strong>Teste {item.test.number}</strong><small>{formatDate(item.test.date)}</small></td><td><strong>{item.productName}</strong></td><td><span className="weight-band-name"><i style={{ background: item.bandColor }} />{item.bandName}</span></td><td>{formatWeight(item.referenceWeight)}</td><td>{formatWeight(item.averageReference)}</td><td>{formatWeight(item.finalWeight)}</td><td><strong className="negative-text">{formatWeight(item.discardWeight)}</strong><small>{formatPercent(item.discardPercent)}</small></td><td><strong className="positive-value">{formatPercent(item.yieldPercent)}</strong></td>
          </tr>
          {expanded && <tr className="yield-comparison-detail-row"><td colSpan={9}><section className="yield-comparison-detail" style={{ borderColor: item.bandColor, background: `${item.bandColor}0D` }}>
            <header><div><span><Layers3 size={16} /> Análise completa</span><h3>Teste {item.test.number} · {item.test.name || item.productName}</h3><small>{item.test.flows.length} {item.test.flows.length === 1 ? "fluxo" : "fluxos"} · {item.test.inputQuantity} peças · faixa {item.bandName}</small></div>{item.test.executionMode === "traceable" && <div className="yield-comparison-detail-actions"><button type="button" className="comparison-excel-button" onClick={() => void exportTraceabilityExcel(item.test, products, weightBands, bandId)}><FileSpreadsheet size={15} /> Excel</button><div className="result-view-toggle" role="group" aria-label="Visualização analítica"><button type="button" className={detailView === "flow" ? "active" : ""} onClick={() => setDetailViews((current) => ({ ...current, [recordKey]: "flow" }))}><GitBranch size={15} /> Fluxo</button><button type="button" className={detailView === "table" ? "active" : ""} onClick={() => setDetailViews((current) => ({ ...current, [recordKey]: "table" }))}><Table2 size={15} /> Tabela por peça</button></div></div>}</header>
            {detailView === "table" && item.test.executionMode === "traceable" ? <div className="yield-comparison-matrix"><TraceabilityMatrix test={item.test} products={products} weightBands={weightBands} filterBandId={bandId} /></div> : <div className="result-flow-list">{item.test.flows.map((flow, flowIndex) => <ResultFlowTree key={flow.id} flow={flow} flowIndex={flowIndex} products={products} inputWeightKg={item.test.inputWeightKg} />)}</div>}
          </section></td></tr>}
        </Fragment>;
      })}</tbody></table></div>
    </section>
  </>;
}
