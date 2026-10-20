import { Fragment, type CSSProperties } from "react";
import type { Product, WeightBand, YieldTest } from "../types/domain";
import { formatPercent, formatWeight } from "../utils/format";
import { buildTraceabilityMatrices } from "../utils/traceabilityReport";

const softBandColor = (color: string) => {
  const normalized = color.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return "rgba(120, 144, 168, .14)";
  const value = Number.parseInt(normalized, 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, .14)`;
};

export function TraceabilityMatrix({ test, products, weightBands = [], filterBandIds = [] }: { test: YieldTest; products: Product[]; weightBands?: WeightBand[]; filterBandIds?: string[] }) {
  const matrices = buildTraceabilityMatrices(test, products);
  return <div className="trace-report-list">
    {matrices.map((matrix) => {
      const flow = test.flows.find((item) => item.id === matrix.id);
      const inputRow = matrix.rows.find((row) => row.kind === "input");
      const firstProductRow = matrix.rows.find((row) => row.kind === "product" || row.kind === "final");
      const hasInputWeights = Boolean(test.inputProductId) && Boolean(inputRow?.values.some((value) => value > 0));
      const referenceProductId = hasInputWeights ? test.inputProductId : flow?.rootProductId;
      const referenceValues = hasInputWeights ? inputRow?.values || [] : firstProductRow?.values || [];
      const columnBands = matrix.pieceOrders.map((_, index) => {
        const weight = referenceValues[index] || 0;
        return weightBands.find((band) => band.productReferenceId === referenceProductId && weight >= band.minWeightKg && (band.maxWeightKg == null || weight < band.maxWeightKg));
      });
      const selectedColumns = matrix.pieceOrders.map((order, index) => ({ order, index, band: columnBands[index] })).filter((column) => !filterBandIds.length || Boolean(column.band && filterBandIds.includes(column.band.id)));
      const finalRows = matrix.rows.filter((row) => row.kind === "final");
      const finalValues = matrix.pieceOrders.map((_, index) => finalRows.reduce((total, row) => total + (row.values[index] || 0), 0));
      const matrixBands = [...new Map(selectedColumns.map((column) => column.band).filter((band): band is WeightBand => Boolean(band)).map((band) => [band.id, band])).values()].sort((first, second) => first.order - second.order);
      const bandSummary = (band: WeightBand) => {
        const indices = selectedColumns.filter((column) => column.band?.id === band.id).map((column) => column.index);
        const reference = indices.reduce((total, index) => total + (referenceValues[index] || 0), 0);
        const final = indices.reduce((total, index) => total + (finalValues[index] || 0), 0);
        return reference > 0 ? (final / reference) * 100 : 0;
      };
      const bandStyle = (index: number): CSSProperties | undefined => {
        const band = columnBands[index];
        return band ? { "--trace-band-soft": softBandColor(band.color) } as CSSProperties : undefined;
      };
      return <article className="trace-report" key={matrix.id}>
      <header><div><span>Rastreabilidade por peça</span><div className="trace-report-title-row"><h3>{matrix.title}</h3>{matrixBands.length > 0 && <div className="trace-band-legend" aria-label="Médias por faixa"><strong>Médias por faixa:</strong>{matrixBands.map((band) => <small style={{ "--trace-legend-color": band.color, "--trace-legend-soft": softBandColor(band.color) } as CSSProperties} key={band.id}>{band.name}<b>{formatPercent(bandSummary(band))}</b></small>)}</div>}</div></div><strong>{selectedColumns.length} {selectedColumns.length === 1 ? "peça" : "peças"}</strong></header>
      <div className="trace-report-scroll">
        <table aria-label={`Rastreabilidade de ${matrix.title}`}>
          <thead><tr><th>Produto / descarte</th>{selectedColumns.map((column) => <Fragment key={column.order}><th title={column.band?.name || "Sem faixa"}><small>Peça</small>{column.order}</th><th className="trace-piece-yield-heading"><small>Rend.</small>Entrada</th></Fragment>)}<th className="trace-total-column">Total</th><th className="trace-yield-column">Rendimento</th></tr></thead>
          <tbody>{matrix.rows.map((row) => {
            const visibleTotal = selectedColumns.reduce((total, column) => total + (row.values[column.index] || 0), 0);
            const visibleReference = selectedColumns.reduce((total, column) => total + (referenceValues[column.index] || 0), 0);
            const visibleYield = row.kind === "discard" || visibleReference <= 0 ? null : (visibleTotal / visibleReference) * 100;
            return <tr className={`trace-report-row--${row.kind}`} key={row.id}>
              <th style={{ paddingLeft: `${12 + (row.depth || 0) * 22}px` }}>{row.kind === "discard" ? <span className={`trace-discard-branch ${row.branchLast ? "last" : ""}`}>{row.label}</span> : <span className={row.depth ? "trace-product-branch" : ""}>{row.label}</span>}</th>
              {selectedColumns.map((column) => {
                const value = row.values[column.index] || 0;
                const reference = referenceValues[column.index] || 0;
                const pieceYield = row.kind === "discard" || reference <= 0 ? null : (value / reference) * 100;
                return <Fragment key={`${row.id}-${column.order}`}><td className={column.band ? "trace-band-cell" : ""} style={bandStyle(column.index)}>{value > 0 ? row.kind === "discard" ? `− ${formatWeight(value)}` : formatWeight(value).replace(" kg", "") : "—"}</td><td className={`trace-piece-yield-cell ${column.band ? "trace-band-cell" : ""}`} style={bandStyle(column.index)}>{pieceYield === null ? "—" : formatPercent(pieceYield)}</td></Fragment>;
              })}
              <td className="trace-total-column">{visibleTotal > 0 ? row.kind === "discard" ? `− ${formatWeight(visibleTotal)}` : formatWeight(visibleTotal).replace(" kg", "") : "—"}</td>
              <td className="trace-yield-column">{visibleYield === null ? "—" : formatPercent(visibleYield)}</td>
            </tr>;
          })}</tbody>
        </table>
      </div>
    </article>})}
  </div>;
}
