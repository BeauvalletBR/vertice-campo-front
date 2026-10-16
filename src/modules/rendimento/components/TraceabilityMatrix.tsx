import type { Product, YieldTest } from "../types/domain";
import { formatPercent, formatWeight } from "../utils/format";
import { buildTraceabilityMatrices } from "../utils/traceabilityReport";

export function TraceabilityMatrix({ test, products }: { test: YieldTest; products: Product[] }) {
  const matrices = buildTraceabilityMatrices(test, products);
  return <div className="trace-report-list">
    {matrices.map((matrix) => <article className="trace-report" key={matrix.id}>
      <header><span>Rastreabilidade por peça</span><h3>{matrix.title}</h3></header>
      <div className="trace-report-scroll">
        <table>
          <thead><tr><th>Produto / descarte</th>{matrix.pieceOrders.map((order) => <th key={order}>{order}</th>)}<th>Total</th><th>Rendimento</th></tr></thead>
          <tbody>{matrix.rows.map((row) => <tr className={`trace-report-row--${row.kind}`} key={row.id}>
            <th style={{ paddingLeft: `${12 + (row.depth || 0) * 22}px` }}>{row.kind === "discard" ? <span className={`trace-discard-branch ${row.branchLast ? "last" : ""}`}>{row.label}</span> : <span className={row.depth ? "trace-product-branch" : ""}>{row.label}</span>}</th>
            {row.values.map((value, index) => <td key={`${row.id}-${matrix.pieceOrders[index]}`}>{value > 0 ? row.kind === "discard" ? `− ${formatWeight(value)}` : formatWeight(value).replace(" kg", "") : "—"}</td>)}
            <td>{row.total > 0 ? row.kind === "discard" ? `− ${formatWeight(row.total)}` : formatWeight(row.total).replace(" kg", "") : "—"}</td>
            <td>{row.yieldPercent === null ? "—" : formatPercent(row.yieldPercent)}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </article>)}
  </div>;
}
