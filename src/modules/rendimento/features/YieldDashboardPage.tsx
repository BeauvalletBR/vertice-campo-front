"use client";

import { Fragment, useEffect, useState } from "react";
import { Activity, ArrowDown, ArrowUp, ArrowUpDown, Boxes, Check, ChevronDown, ChevronRight, ChevronUp, FileSpreadsheet, GitBranch, Layers3, Maximize2, Minimize2, RotateCcw, Scale, Table2, Target, TestTube2, Trash2 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, LabelList, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader } from "../components/PageHeader";
import { ResultFlowTree } from "../components/ResultFlowTree";
import { TraceabilityMatrix } from "../components/TraceabilityMatrix";
import { useRendimentoData } from "../context/RendimentoDataContext";
import { calculateFlowFinalWeight, calculateFlowReferenceWeight, calculateTotalDiscard } from "../utils/calculations";
import { formatDate, formatPercent, formatWeight } from "../utils/format";
import { buildTraceabilityMatrices, exportTraceabilityExcel } from "../utils/traceabilityReport";
import { aggregateYieldGoalRows, exportYieldComparisonExcel, exportYieldGoalExcel } from "../utils/dashboardReport";
import { UNCLASSIFIED_WEIGHT_BAND_ID, type Product } from "../types/domain";

const pct = (value: number, base: number) => base > 0 ? (value / base) * 100 : 0;
type TargetSortKey = "week" | "standard" | "pieces" | "yieldPercent" | "goal" | "difference";
type SortDirection = "asc" | "desc";
type ComparisonView = "matrix" | "chart" | "both";
type ComparisonBucket = {
  productId: string;
  productName: string;
  bandId: string;
  bandName: string;
  referenceWeight: number;
  productWeight: number;
  pieces: number;
  yieldPercent: number;
};
type ComparisonChartDetail = ComparisonBucket & { color: string };
type ComparisonChartRow = {
  productId: string;
  productName: string;
  details: Record<string, ComparisonChartDetail>;
  [key: string]: unknown;
};
const targetPercent = (value?: number | null) => value == null || value <= 0 ? null : Math.abs(value) <= 1 ? value * 100 : value;
const bandRange = (band?: { minWeightKg: number; maxWeightKg: number | null; name: string }) => {
  if (!band) return "Sem faixa";
  const min = band.minWeightKg.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const max = band.maxWeightKg == null ? null : band.maxWeightKg.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return max ? `${min} - ${max} @` : `A partir de ${min} @`;
};
const isoWeek = (date: string) => {
  const current = new Date(`${date}T12:00:00`);
  const day = current.getDay() || 7;
  current.setDate(current.getDate() + 4 - day);
  const yearStart = new Date(current.getFullYear(), 0, 1, 12);
  const week = Math.ceil((((current.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${current.getFullYear()}.${String(week).padStart(2, "0")}`;
};

const PRODUCT_CHART_COLORS = ["#1f5a8a", "#0f8069", "#d18828", "#b94a58", "#5677a4", "#748a37", "#8a5e91", "#3f8291"];

function ComparisonChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ dataKey?: string | number; payload?: ComparisonChartRow }>; label?: string }) {
  if (!active || !payload?.length) return null;
  const details = payload.flatMap((item) => {
    const detail = item.payload?.details[String(item.dataKey || "")];
    return detail ? [detail] : [];
  });
  if (!details.length) return null;
  const productName = payload[0]?.payload?.productName || label;
  return <div className="yield-chart-tooltip"><strong>{productName}</strong>{details.map((detail) => <div key={`${detail.bandId}-${detail.productId}`}><i style={{ background: detail.color }} /><span><b>{detail.bandName}</b><small>{formatPercent(detail.yieldPercent)} · {detail.pieces} {detail.pieces === 1 ? "peça" : "peças"} · {formatWeight(detail.productWeight)}</small></span></div>)}</div>;
}

function ProductAxisTick({ x = 0, y = 0, payload, onSelect, labelOf }: { x?: number; y?: number; payload?: { value?: string }; onSelect: (productId: string) => void; labelOf: (productId: string) => string }) {
  const productId = String(payload?.value || "");
  const select = () => productId && onSelect(productId);
  return <g className="yield-product-axis-tick" transform={`translate(${x},${y})`} role="button" tabIndex={0} onClick={select} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") select(); }}><text x={-8} y={0} dy={4} textAnchor="end">{labelOf(productId)}</text></g>;
}

function MultiFilter({ label, allLabel, options, values, onChange }: { label: string; allLabel: string; options: Array<{ value: string; label: string }>; values: string[]; onChange: (values: string[]) => void }) {
  const summary = values.length === 0 ? allLabel : values.length === 1 ? options.find((option) => option.value === values[0])?.label || "1 selecionado" : `${values.length} selecionados`;
  const toggle = (value: string) => onChange(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  return <div className="yield-multi-filter"><span>{label}</span><details><summary><b>{summary}</b><ChevronDown size={15} /></summary><div className="yield-multi-filter-menu"><button type="button" className={values.length === 0 ? "active" : ""} onClick={() => onChange([])}><i>{values.length === 0 && <Check size={13} />}</i>{allLabel}</button>{options.map((option) => <button type="button" className={values.includes(option.value) ? "active" : ""} onClick={() => toggle(option.value)} key={option.value}><i>{values.includes(option.value) && <Check size={13} />}</i>{option.label}</button>)}</div></details></div>;
}

function ProductTreeFilter({ products, selectableProductIds, values, onChange }: { products: Product[]; selectableProductIds: string[]; values: string[]; onChange: (values: string[]) => void }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const availableIds = new Set(products.map((product) => product.id));
  const selectableIds = new Set(selectableProductIds);
  const parentOf = (product: Product) => product.parentId && availableIds.has(product.parentId)
    ? product.parentId
    : product.originProductIds.find((id) => availableIds.has(id)) || null;
  const childrenOf = (parentId: string) => products.filter((product) => parentOf(product) === parentId);
  const roots = products.filter((product) => !parentOf(product));
  const descendantsOf = (productId: string, visited = new Set<string>()): string[] => {
    if (visited.has(productId)) return [];
    const nextVisited = new Set(visited).add(productId);
    return childrenOf(productId).flatMap((child) => [child.id, ...descendantsOf(child.id, nextVisited)]);
  };
  const toggleExpanded = (id: string) => setExpanded((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const toggleProduct = (product: Product) => {
    const children = childrenOf(product.id);
    const groupIds = (children.length ? [product.id, ...descendantsOf(product.id)] : [product.id]).filter((id) => selectableIds.has(id));
    if (!groupIds.length) return;
    const productSelected = values.includes(product.id);
    onChange(productSelected
      ? values.filter((id) => id !== product.id)
      : [...new Set([...values, ...groupIds])]);
  };
  const summary = values.length === 0
    ? "Todos os produtos"
    : values.length === 1
      ? products.find((product) => product.id === values[0])?.name || "1 selecionado"
      : `${values.length} selecionados`;
  const renderNode = (product: Product, depth = 0) => {
    const children = childrenOf(product.id);
    const groupIds = [product.id, ...descendantsOf(product.id)].filter((id) => selectableIds.has(id));
    const selected = values.includes(product.id);
    const hasSelectedChildren = !selected && groupIds.some((id) => id !== product.id && values.includes(id));
    const isOpen = expanded.has(product.id);
    return <div className="yield-product-filter-node" key={product.id}>
      <div className={`yield-product-filter-row ${depth === 0 ? "is-root" : ""}`} style={{ paddingLeft: `${8 + depth * 18}px` }}>
        <button type="button" className="yield-product-filter-expand" disabled={!children.length} onClick={() => toggleExpanded(product.id)}>{children.length ? isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} /> : <span />}</button>
        <button type="button" role="checkbox" aria-checked={selected} className={`yield-product-filter-check ${selected ? "active" : ""} ${hasSelectedChildren ? "has-selected-children" : ""}`} onClick={() => toggleProduct(product)}><i>{selected ? <Check size={12} /> : null}</i><span><strong>{product.name}</strong><small>{depth === 0 ? `Grupo - ${groupIds.length} itens` : `Subproduto - nível ${product.level}`}</small></span></button>
      </div>
      {isOpen && children.length > 0 && <div className="yield-product-filter-children">{children.map((child) => renderNode(child, depth + 1))}</div>}
    </div>;
  };

  const expandableIds = products.filter((product) => childrenOf(product.id).length > 0).map((product) => product.id);
  const allExpanded = expandableIds.length > 0 && expandableIds.every((id) => expanded.has(id));
  const toggleAllExpanded = () => setExpanded(allExpanded ? new Set() : new Set(expandableIds));

  return <section className="yield-product-box-filter"><header><div><span>Filtro de produtos</span><h2>{summary}</h2></div><div className="yield-product-box-actions"><button type="button" onClick={() => onChange(selectableProductIds)}><Check size={14} /> Selecionar tudo</button><button type="button" onClick={() => onChange([])}>Limpar</button><button type="button" onClick={toggleAllExpanded}>{allExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}{allExpanded ? "Recolher grupos" : "Expandir grupos"}</button></div></header><div className="yield-product-filter-menu yield-product-box-body"><div className="yield-product-filter-tree">{roots.map((product) => renderNode(product))}</div></div></section>;
}

export function YieldDashboardPage() {
  const { products, tests, weightBands } = useRendimentoData();
  const [productIds, setProductIds] = useState<string[]>([]);
  const [bandIds, setBandIds] = useState<string[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [expandedRecords, setExpandedRecords] = useState<string[]>([]);
  const [detailViews, setDetailViews] = useState<Record<string, "flow" | "table">>({});
  const [targetExpanded, setTargetExpanded] = useState(false);
  const [targetSort, setTargetSort] = useState<{ key: TargetSortKey; direction: SortDirection } | null>(null);
  const [comparisonView, setComparisonView] = useState<ComparisonView>("both");
  const [chartProductFilter, setChartProductFilter] = useState<{ productId: string; baseProductIds: string[] } | null>(null);
  const nameOf = (id: string) => products.find((product) => product.id === id)?.name || "Produto";

  useEffect(() => {
    const closeOpenFilters = (event: PointerEvent) => {
      const target = event.target as Node;
      document.querySelectorAll<HTMLDetailsElement>("#yield-dashboard-filters details[open]").forEach((details) => {
        if (!details.contains(target)) details.removeAttribute("open");
      });
    };
    document.addEventListener("pointerdown", closeOpenFilters);
    return () => document.removeEventListener("pointerdown", closeOpenFilters);
  }, []);

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
          index,
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
      const flowProductIds = [...new Set([flow.rootProductId, ...flow.steps.map((step) => step.productId)])];
      return {
        test, flow, matrix, pieceBands,
        productIds: flowProductIds,
        referenceProductId: test.inputProductId || referenceProductId,
        productId: flow.rootProductId,
        productName: nameOf(flow.rootProductId),
        referenceWeight, averageReference, finalWeight, discardWeight,
        yieldPercent: pct(finalWeight, referenceWeight),
        discardPercent: pct(discardWeight, referenceWeight),
        bandId: test.weightBandId || resolvedBand?.id || "",
        bandName: test.weightBandName || resolvedBand?.name || "Sem faixa",
        bandLabel: bandRange(resolvedBand),
        bandColor: resolvedBand?.color || "#7890A8",
        pieceCount: pieceBands.length || test.inputQuantity,
        referenceValues,
        visiblePieceIndexes: pieceBands.length ? pieceBands.map((piece) => piece.index) : (matrix?.pieceOrders || []).map((_, index) => index),
      };
    });
  });
  const pieceMatchesBandFilter = (piece: { band?: { id: string } }) => piece.band
    ? bandIds.includes(piece.band.id)
    : bandIds.includes(UNCLASSIFIED_WEIGHT_BAND_ID);
  const periodRecords = rawRecords.filter((record) => (!startDate || record.test.date >= startDate) && (!endDate || record.test.date <= endDate));
  const records = periodRecords.filter((record) => (!productIds.length || record.productIds.some((id) => productIds.includes(id))) && (!bandIds.length || record.pieceBands.some(pieceMatchesBandFilter) || (!record.pieceBands.length && (record.bandId ? bandIds.includes(record.bandId) : bandIds.includes(UNCLASSIFIED_WEIGHT_BAND_ID))))).map((record) => {
    if (!bandIds.length) return record;
    const scopedPieces = record.pieceBands.filter(pieceMatchesBandFilter);
    if (!scopedPieces.length) return record;
    const selectedBand = bandIds.length === 1 ? weightBands.find((band) => band.id === bandIds[0]) : undefined;
    const onlyUnclassified = bandIds.length === 1 && bandIds[0] === UNCLASSIFIED_WEIGHT_BAND_ID;
    const referenceWeight = scopedPieces.reduce((total, piece) => total + piece.referenceWeight, 0);
    const finalWeight = scopedPieces.reduce((total, piece) => total + piece.finalWeight, 0);
    const discardWeight = scopedPieces.reduce((total, piece) => total + piece.discardWeight, 0);
    return { ...record, referenceWeight, finalWeight, discardWeight, averageReference: referenceWeight / scopedPieces.length, yieldPercent: pct(finalWeight, referenceWeight), discardPercent: pct(discardWeight, referenceWeight), bandId: onlyUnclassified ? UNCLASSIFIED_WEIGHT_BAND_ID : selectedBand?.id || "MULTIPLAS", bandName: onlyUnclassified ? "Sem faixa" : selectedBand?.name || `${bandIds.length} faixas`, bandLabel: onlyUnclassified ? "Sem faixa" : selectedBand ? bandRange(selectedBand) : `${bandIds.length} faixas`, bandColor: selectedBand?.color || "#7890A8", pieceCount: scopedPieces.length, visiblePieceIndexes: scopedPieces.map((piece) => piece.index) };
  });

  const totalReference = records.reduce((sum, item) => sum + item.referenceWeight, 0);
  const totalFinal = records.reduce((sum, item) => sum + item.finalWeight, 0);
  const totalDiscard = records.reduce((sum, item) => sum + item.discardWeight, 0);
  const weightedYield = pct(totalFinal, totalReference);
  const averageReference = records.length ? records.reduce((sum, item) => sum + item.averageReference, 0) / records.length : 0;
  const piecesByTest = new Map<string, number>();
  records.forEach((record) => {
    piecesByTest.set(record.test.id, Math.max(piecesByTest.get(record.test.id) || 0, record.pieceCount));
  });
  const totalPieces = [...piecesByTest.values()].reduce((sum, pieces) => sum + pieces, 0);
  const productById = new Map(products.map((product) => [product.id, product]));
  const productHierarchyOrder = (() => {
    const productIds = new Set(products.map((product) => product.id));
    const parentOf = (product: Product) => product.parentId && productIds.has(product.parentId)
      ? product.parentId
      : product.originProductIds.find((id) => productIds.has(id)) || null;
    const childrenByParent = new Map<string, Product[]>();
    products.forEach((product) => {
      const parentId = parentOf(product);
      if (!parentId) return;
      childrenByParent.set(parentId, [...(childrenByParent.get(parentId) || []), product]);
    });
    childrenByParent.forEach((children) => children.sort((first, second) => first.name.localeCompare(second.name, "pt-BR")));
    const roots = products.filter((product) => !parentOf(product)).sort((first, second) => first.name.localeCompare(second.name, "pt-BR"));
    const order = new Map<string, number>();
    const visit = (product: Product, visited = new Set<string>()) => {
      if (visited.has(product.id) || order.has(product.id)) return;
      const nextVisited = new Set(visited).add(product.id);
      order.set(product.id, order.size);
      (childrenByParent.get(product.id) || []).forEach((child) => visit(child, nextVisited));
    };
    roots.forEach((product) => visit(product));
    products.filter((product) => !order.has(product.id)).sort((first, second) => first.name.localeCompare(second.name, "pt-BR")).forEach((product) => visit(product));
    return order;
  })();
  const comparisonBucketMap = new Map<string, Omit<ComparisonBucket, "yieldPercent">>();
  records.forEach((record) => {
    if (!record.matrix) return;
    const visiblePieceIndexes = new Set(record.visiblePieceIndexes);
    const bandByPieceIndex = new Map(record.pieceBands.map((piece) => [piece.index, piece.band]));
    const countedProductPieces = new Set<string>();
    record.matrix.rows.filter((row) => (row.kind === "product" || row.kind === "final") && row.productId && (!productIds.length || productIds.includes(row.productId))).forEach((row) => {
      visiblePieceIndexes.forEach((pieceIndex) => {
        const referenceWeight = record.referenceValues[pieceIndex] || 0;
        const productWeight = row.values[pieceIndex] || 0;
        if (referenceWeight <= 0 || productWeight <= 0 || !row.productId) return;
        const band = bandByPieceIndex.get(pieceIndex);
        const bandId = band?.id || UNCLASSIFIED_WEIGHT_BAND_ID;
        const key = `${row.productId}|${bandId}`;
        const current = comparisonBucketMap.get(key) || {
          productId: row.productId,
          productName: productById.get(row.productId)?.name || row.label,
          bandId,
          bandName: band?.name || "Sem faixa",
          referenceWeight: 0,
          productWeight: 0,
          pieces: 0,
        };
        current.productWeight += productWeight;
        const productPieceKey = `${row.productId}|${pieceIndex}`;
        if (!countedProductPieces.has(productPieceKey)) {
          current.referenceWeight += referenceWeight;
          current.pieces += 1;
          countedProductPieces.add(productPieceKey);
        }
        comparisonBucketMap.set(key, current);
      });
    });
  });
  const comparisonBuckets: ComparisonBucket[] = [...comparisonBucketMap.values()].map((bucket) => ({
    ...bucket,
    yieldPercent: pct(bucket.productWeight, bucket.referenceWeight),
  }));
  const comparedProductIds = new Set(comparisonBuckets.map((bucket) => bucket.productId));
  const comparisonProducts = products
    .filter((product) => comparedProductIds.has(product.id))
    .sort((first, second) => (productHierarchyOrder.get(first.id) ?? Number.MAX_SAFE_INTEGER) - (productHierarchyOrder.get(second.id) ?? Number.MAX_SAFE_INTEGER) || first.name.localeCompare(second.name, "pt-BR"));
  const comparedBandIds = new Set(comparisonBuckets.filter((bucket) => bucket.bandId !== UNCLASSIFIED_WEIGHT_BAND_ID).map((bucket) => bucket.bandId));
  const comparisonBands = weightBands
    .filter((band) => comparedBandIds.has(band.id))
    .sort((first, second) => first.productReferenceName.localeCompare(second.productReferenceName, "pt-BR") || first.minWeightKg - second.minWeightKg || first.name.localeCompare(second.name, "pt-BR"));
  const comparisonBucketByKey = new Map(comparisonBuckets.map((bucket) => [`${bucket.productId}|${bucket.bandId}`, bucket]));
  const classifiedYields = comparisonBuckets.filter((bucket) => bucket.bandId !== UNCLASSIFIED_WEIGHT_BAND_ID).map((bucket) => bucket.yieldPercent);
  const minClassifiedYield = classifiedYields.length ? Math.min(...classifiedYields) : 0;
  const maxClassifiedYield = classifiedYields.length ? Math.max(...classifiedYields) : 0;
  const heatOpacity = (value: number) => maxClassifiedYield === minClassifiedYield
    ? 0.16
    : 0.08 + ((value - minClassifiedYield) / (maxClassifiedYield - minClassifiedYield)) * 0.24;
  const bandExtremes = new Map(comparisonBands.map((band) => {
    const values = comparisonBuckets.filter((bucket) => bucket.bandId === band.id).map((bucket) => bucket.yieldPercent);
    return [band.id, { min: values.length ? Math.min(...values) : 0, max: values.length ? Math.max(...values) : 0, count: values.length }];
  }));
  const bandSeries = comparisonBands.map((band, index) => ({ band, key: `band_${index}`, color: band.color || PRODUCT_CHART_COLORS[index % PRODUCT_CHART_COLORS.length] }));
  const comparisonChartData: ComparisonChartRow[] = comparisonProducts.map((product) => {
    const row: ComparisonChartRow = { productId: product.id, productName: product.name, details: {} };
    bandSeries.forEach((series) => {
      const bucket = comparisonBucketByKey.get(`${product.id}|${series.band.id}`);
      if (!bucket) return;
      row[series.key] = bucket.yieldPercent;
      row.details[series.key] = { ...bucket, color: series.color };
    });
    return row;
  });
  const unclassifiedBuckets = comparisonBuckets.filter((bucket) => bucket.bandId === UNCLASSIFIED_WEIGHT_BAND_ID);
  const maxChartYield = classifiedYields.length ? Math.max(...classifiedYields) : 0;
  const targetSourceRows = records.flatMap((record) => {
    const rows = record.matrix?.rows.filter((row) => (row.kind === "product" || row.kind === "final") && row.productId && (!productIds.length || productIds.includes(row.productId))) || [];
    return rows.map((row) => {
      const product = products.find((item) => item.id === row.productId);
      const goal = product?.erpProductSeq ? targetPercent(product.erpYieldTarget) : null;
      const referenceWeight = record.visiblePieceIndexes.reduce((total, pieceIndex) => total + (record.referenceValues[pieceIndex] || 0), 0);
      const productWeight = record.visiblePieceIndexes.reduce((total, pieceIndex) => total + (row.values[pieceIndex] || 0), 0);
      return {
        id: `${record.test.id}-${record.flow.id}-${row.id}`,
        testId: record.test.id,
        productId: product?.id || row.productId || "",
        hierarchyOrder: productHierarchyOrder.get(product?.id || row.productId || "") ?? Number.MAX_SAFE_INTEGER,
        week: isoWeek(record.test.date),
        standard: product?.name || row.label,
        pieces: record.pieceCount,
        referenceWeight,
        productWeight,
        yieldPercent: row.yieldPercent,
        goal,
      };
    });
  });
  const targetRows = aggregateYieldGoalRows(targetSourceRows)
    .sort((first, second) => second.week.localeCompare(first.week, "pt-BR", { numeric: true }) || first.hierarchyOrder - second.hierarchyOrder || first.standard.localeCompare(second.standard, "pt-BR"));
  const sortedTargetRows = targetSort ? [...targetRows].sort((first, second) => {
    const firstValue = first[targetSort.key];
    const secondValue = second[targetSort.key];
    if (firstValue == null && secondValue == null) return 0;
    if (firstValue == null) return 1;
    if (secondValue == null) return -1;
    const comparison = typeof firstValue === "number" && typeof secondValue === "number"
      ? firstValue - secondValue
      : String(firstValue).localeCompare(String(secondValue), "pt-BR", { numeric: true });
    return targetSort.direction === "asc" ? comparison : -comparison;
  }) : targetRows;
  const targetPiecesByTest = new Map<string, number>();
  records.forEach((record) => {
    targetPiecesByTest.set(record.test.id, Math.max(targetPiecesByTest.get(record.test.id) || 0, record.pieceCount));
  });
  const targetTotalPieces = [...targetPiecesByTest.values()].reduce((total, pieces) => total + pieces, 0);
  const selectableProductIds = products.filter((product) => periodRecords.some((record) => record.productIds.includes(product.id))).map((product) => product.id);
  const selectableProductKey = selectableProductIds.join("|");
  useEffect(() => {
    const validIds = new Set(selectableProductIds);
    setProductIds((current) => current.filter((id) => validIds.has(id)));
  }, [selectableProductKey]);
  const hierarchyProductIds = new Set(selectableProductIds);
  selectableProductIds.forEach((productId) => {
    const product = productById.get(productId);
    let parentId = product?.parentId || product?.originProductIds.find((id) => productById.has(id)) || null;
    const visited = new Set<string>();
    while (parentId && !visited.has(parentId)) {
      visited.add(parentId);
      hierarchyProductIds.add(parentId);
      const parent = productById.get(parentId);
      parentId = parent?.parentId || parent?.originProductIds.find((id) => productById.has(id)) || null;
    }
  });
  const availableProducts = products.filter((product) => hierarchyProductIds.has(product.id)).sort((first, second) => first.level - second.level || first.name.localeCompare(second.name, "pt-BR"));
  const referenceProductIdsFor = (selectedIds: string[]) => {
    const referenceIds = new Set<string>();
    const selectedIdSet = new Set(selectedIds);
    const visitOrigins = (productId: string, visited = new Set<string>()) => {
      if (visited.has(productId)) return;
      const nextVisited = new Set(visited).add(productId);
      referenceIds.add(productId);
      const product = productById.get(productId);
      const originIds = product?.originProductIds.length
        ? product.originProductIds
        : product?.parentId
          ? [product.parentId]
          : [];
      originIds.forEach((originId) => visitOrigins(originId, nextVisited));
    };
    selectedIds.forEach((productId) => visitOrigins(productId));
    rawRecords.filter((record) => record.productIds.some((productId) => selectedIdSet.has(productId))).forEach((record) => {
      if (record.referenceProductId) referenceIds.add(record.referenceProductId);
    });
    return referenceIds;
  };
  const compatibleReferenceProductIds = referenceProductIdsFor(productIds);
  const availableWeightBands = weightBands.filter((band) => band.active && (!productIds.length || compatibleReferenceProductIds.has(band.productReferenceId)));
  const applyProductIdsChange = (nextProductIds: string[]) => {
    const nextReferenceIds = referenceProductIdsFor(nextProductIds);
    const compatibleBandIds = new Set(weightBands.filter((band) => band.active && (!nextProductIds.length || nextReferenceIds.has(band.productReferenceId))).map((band) => band.id));
    compatibleBandIds.add(UNCLASSIFIED_WEIGHT_BAND_ID);
    setProductIds(nextProductIds);
    setBandIds((current) => current.filter((bandId) => compatibleBandIds.has(bandId)));
  };
  const handleProductIdsChange = (nextProductIds: string[]) => {
    setChartProductFilter(null);
    applyProductIdsChange(nextProductIds);
  };
  const toggleChartProductFilter = (productId: string) => {
    if (chartProductFilter?.productId === productId) {
      const baseProductIds = chartProductFilter.baseProductIds;
      setChartProductFilter(null);
      applyProductIdsChange(baseProductIds);
      return;
    }
    const baseProductIds = chartProductFilter?.baseProductIds || productIds;
    setChartProductFilter({ productId, baseProductIds });
    applyProductIdsChange([productId]);
  };
  const comparisonExportRecords = records.flatMap((record) => record.matrix ? [{
    testNumber: record.test.number,
    date: record.test.date,
    productName: record.productName,
    bandName: record.bandName,
    bandColor: record.bandColor,
    matrix: record.matrix,
    visiblePieceIndexes: record.visiblePieceIndexes,
    referenceValues: record.referenceValues,
  }] : []);
  const recordKeys = records.map((item) => `${item.test.id}-${item.flow.id}`);
  const allExpanded = recordKeys.length > 0 && recordKeys.every((key) => expandedRecords.includes(key));
  const toggleRecord = (key: string) => setExpandedRecords((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
  const toggleAll = () => setExpandedRecords(allExpanded ? [] : recordKeys);
  const toggleTargetSort = (key: TargetSortKey) => setTargetSort((current) => current?.key === key
    ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
    : { key, direction: "asc" });
  const targetSortIcon = (key: TargetSortKey) => targetSort?.key === key
    ? targetSort.direction === "asc" ? <ArrowUp size={13} /> : <ArrowDown size={13} />
    : <ArrowUpDown size={13} />;
  const targetSortHeader = (key: TargetSortKey, label: string) => <th aria-sort={targetSort?.key === key ? targetSort.direction === "asc" ? "ascending" : "descending" : "none"}><button type="button" onClick={() => toggleTargetSort(key)}>{label}{targetSortIcon(key)}</button></th>;
  const resetFilters = () => {
    setChartProductFilter(null);
    setProductIds([]);
    setBandIds([]);
    setStartDate("");
    setEndDate("");
    setTargetSort(null);
    setComparisonView("both");
  };
  const toggleTargetExpanded = () => {
    if (!targetExpanded) {
      setTargetExpanded(true);
      return;
    }
    setTargetExpanded(false);
    requestAnimationFrame(() => document.getElementById("yield-dashboard-filters")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  return <>
    <PageHeader eyebrow="Análise" title="Dashboard de Rendimento" description="Compare testes do mesmo produto por período e faixa de peso, com médias ponderadas pelos quilos processados." />
    <section className="yield-dashboard-filters" id="yield-dashboard-filters"><MultiFilter label="Faixa de peso" allLabel="Todas as faixas" values={bandIds} onChange={setBandIds} options={[{ value: UNCLASSIFIED_WEIGHT_BAND_ID, label: "Sem faixa" }, ...availableWeightBands.map((band) => ({ value: band.id, label: `${band.productReferenceName} · ${band.name}` }))]} /><label>Início<input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label><label>Fim<input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label><div className="yield-filter-actions"><span>Ações</span><button type="button" onClick={resetFilters}><RotateCcw size={15} /> Restaurar filtros</button></div></section>
    <section className="yield-dashboard-cards"><article><span><TestTube2 size={18} />Testes comparados</span><strong>{piecesByTest.size}</strong><small>registros finalizados</small></article><article className="pieces-card"><span><Layers3 size={18} />Peças</span><strong>{totalPieces}</strong><small>entradas analisadas</small></article><article><span><Scale size={18} />Peso médio base</span><strong>{formatWeight(averageReference)}</strong><small>por peça</small></article><article className="featured"><span><Target size={18} />Rendimento ponderado</span><strong>{formatPercent(weightedYield)}</strong><small>{formatWeight(totalFinal)} de produto final</small></article><article><span><Trash2 size={18} />Descarte</span><strong>{formatPercent(pct(totalDiscard, totalReference))}</strong><small>{formatWeight(totalDiscard)} retirados</small></article><article><span><Boxes size={18} />Peso analisado</span><strong>{formatWeight(totalReference)}</strong><small>base dos cálculos</small></article></section>
    <ProductTreeFilter products={availableProducts} selectableProductIds={selectableProductIds} values={productIds} onChange={handleProductIdsChange} />
    <section className="yield-product-band-panel">
      <header className="yield-product-band-header">
        <div><span>Comparação ponderada</span><h2>Análise comparativa por produto e faixa</h2><small>Cada resultado considera o peso produzido dividido pelo peso de referência das peças.</small></div>
        <div className="yield-comparison-view-toggle" role="group" aria-label="Visualização da comparação"><button type="button" className={comparisonView === "matrix" ? "active" : ""} onClick={() => setComparisonView("matrix")}><Table2 size={14} /> Matriz</button><button type="button" className={comparisonView === "chart" ? "active" : ""} onClick={() => setComparisonView("chart")}><Activity size={14} /> Gráfico</button><button type="button" className={comparisonView === "both" ? "active" : ""} onClick={() => setComparisonView("both")}><Layers3 size={14} /> Ambos</button></div>
      </header>
      <div className="yield-analysis-products"><strong>Produtos analisados</strong><div>{comparisonProducts.length ? comparisonProducts.map((product) => <span key={product.id}><i />{product.name}</span>) : <span>Sem produtos para os filtros atuais</span>}</div></div>
      {(comparisonView === "matrix" || comparisonView === "both") && <div className="yield-heatmap-wrap">
        {comparisonProducts.length && comparisonBands.length ? <table className="yield-heatmap-table"><thead><tr><th>Produto</th>{comparisonBands.map((band) => <th key={band.id}><span>{band.name}</span><small>{band.productReferenceName}</small></th>)}</tr></thead><tbody>{comparisonProducts.map((product) => <tr key={product.id}><th><i /><span>{product.name}</span></th>{comparisonBands.map((band) => {
          const bucket = comparisonBucketByKey.get(`${product.id}|${band.id}`);
          const extremes = bandExtremes.get(band.id);
          const hasDistinctExtremes = Boolean(extremes && extremes.count > 1 && Math.abs(extremes.max - extremes.min) > 0.0001);
          const extremeClass = bucket && hasDistinctExtremes && Math.abs(bucket.yieldPercent - (extremes?.max || 0)) < 0.0001 ? "is-highest" : bucket && hasDistinctExtremes && Math.abs(bucket.yieldPercent - (extremes?.min || 0)) < 0.0001 ? "is-lowest" : "";
          return <td key={band.id}>{bucket ? <button type="button" className={`yield-heatmap-cell ${extremeClass}`} style={{ background: `rgba(31, 90, 138, ${heatOpacity(bucket.yieldPercent)})` }} onClick={() => setBandIds((current) => current.length === 1 && current[0] === band.id ? [] : [band.id])}><strong>{formatPercent(bucket.yieldPercent)}</strong><small>{bucket.pieces} {bucket.pieces === 1 ? "peça" : "peças"}</small><span className="yield-heatmap-tooltip"><b>{product.name}</b><em>{band.name}</em><span>Rendimento: {formatPercent(bucket.yieldPercent)}</span><span>Peças: {bucket.pieces}</span><span>Peso analisado: {formatWeight(bucket.referenceWeight)}</span><span>Peso do produto: {formatWeight(bucket.productWeight)}</span></span></button> : <span className="yield-no-data">—</span>}</td>;
        })}</tr>)}</tbody></table> : <p className="dashboard-empty">Nenhum resultado classificado em faixa para os filtros.</p>}
      </div>}
      {(comparisonView === "chart" || comparisonView === "both") && <div className="yield-grouped-chart"><header><div><span>Comparativo visual</span><h3>Faixas de peso por produto</h3></div><small>Clique no nome ou em uma barra para filtrar; clique novamente para retirar o filtro.</small></header>{comparisonChartData.length && bandSeries.length ? <div className="yield-grouped-chart-scroll"><div style={{ minWidth: `${Math.max(760, bandSeries.length * 120)}px` }}><ResponsiveContainer width="100%" height={Math.max(390, comparisonProducts.length * 66 + 110)}><BarChart data={comparisonChartData} layout="vertical" margin={{ top: 22, right: 62, left: 18, bottom: 20 }} barGap={3}><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" domain={[0, Math.max(10, Math.ceil(maxChartYield * 1.15))]} tickFormatter={(value) => `${value}%`} tick={{ fontSize: 10 }} /><YAxis dataKey="productId" type="category" width={190} tick={<ProductAxisTick onSelect={toggleChartProductFilter} labelOf={nameOf} />} /><Tooltip content={<ComparisonChartTooltip />} /><Legend wrapperStyle={{ fontSize: 10, paddingTop: 12 }} />{bandSeries.map((series) => <Bar key={series.band.id} dataKey={series.key} name={series.band.name} fill={series.color} radius={[0, 5, 5, 0]} cursor="pointer" onClick={(entry) => { const clicked = entry as unknown as { productId?: string; payload?: ComparisonChartRow }; const clickedProductId = clicked.productId || clicked.payload?.productId; if (clickedProductId) toggleChartProductFilter(clickedProductId); }}>{bandSeries.length <= 4 && <LabelList dataKey={series.key} position="right" formatter={(value: number) => typeof value === "number" ? formatPercent(value) : ""} fill="#173d6e" fontSize={9} />}</Bar>)}</BarChart></ResponsiveContainer></div></div> : <p className="dashboard-empty">Nenhum resultado classificado em faixa para os filtros.</p>}</div>}
      {unclassifiedBuckets.length > 0 && <div className="yield-unclassified"><header><div><strong>Sem faixa</strong><small>Resultados mantidos fora do gráfico para não distorcer a comparação.</small></div><span>{unclassifiedBuckets.reduce((total, bucket) => total + bucket.pieces, 0)} peças</span></header><div>{unclassifiedBuckets.map((bucket) => <article key={bucket.productId}><strong>{bucket.productName}</strong><span>{formatPercent(bucket.yieldPercent)}</span><small>{bucket.pieces} peças · {formatWeight(bucket.referenceWeight)} analisados</small></article>)}</div></div>}
    </section>
    <article className={`yield-target-panel ${targetExpanded ? "is-expanded" : ""}`}>
      <header><div><span>Meta do ERP</span><h2>Teste x meta do produto <strong className="yield-target-piece-total">{targetTotalPieces} peças de entrada</strong></h2></div><div className="yield-panel-actions"><button type="button" onClick={() => void exportYieldGoalExcel(sortedTargetRows, targetTotalPieces)} disabled={!sortedTargetRows.length}><FileSpreadsheet size={15} /> Excel</button><button type="button" onClick={toggleTargetExpanded}>{targetExpanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}{targetExpanded ? "Voltar aos filtros" : "Expandir"}</button></div></header>
      <div className="yield-target-table-wrap"><table className="yield-target-table"><thead><tr>{targetSortHeader("week", "Ano/Semana")}{targetSortHeader("standard", "Padrão")}{targetSortHeader("pieces", "Peças")}{targetSortHeader("yieldPercent", "Rend. teste")}{targetSortHeader("goal", "Meta")}{targetSortHeader("difference", "Diferença")}</tr></thead><tbody>
        {sortedTargetRows.length ? sortedTargetRows.map((row) => <tr key={row.id}><td>{row.week}</td><td><strong>{row.standard}</strong></td><td>{row.pieces}</td><td>{row.yieldPercent == null ? "" : formatPercent(row.yieldPercent)}</td><td>{row.goal == null ? "" : formatPercent(row.goal)}</td><td className={row.difference == null ? "" : row.difference < 0 ? "below-target" : "above-target"}>{row.difference == null ? "" : formatPercent(row.difference)}</td></tr>) : <tr><td colSpan={6} className="dashboard-empty">Nenhum teste encontrado para os filtros.</td></tr>}
      </tbody></table></div>
    </article>
    <section className="table-panel yield-dashboard-table">
      <header className="table-title yield-comparison-header">
        <div><span>Comparativo teste a teste</span><small>Expanda uma linha para consultar todo o fluxo analítico do teste</small></div>
        {records.length > 0 && <div className="yield-comparison-header-actions"><button type="button" className="comparison-excel-button" onClick={() => void exportYieldComparisonExcel(comparisonExportRecords)}><FileSpreadsheet size={15} /> Excel selecionados</button><button type="button" className="comparison-expand-all" onClick={toggleAll}>{allExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}{allExpanded ? "Recolher todos" : "Expandir todos"}</button></div>}
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
            <header><div><span><Layers3 size={16} /> Análise completa</span><h3>Teste {item.test.number} · {item.test.name || item.productName}</h3><small>{item.test.flows.length} {item.test.flows.length === 1 ? "fluxo" : "fluxos"} · {item.test.inputQuantity} peças · faixa {item.bandName}</small></div>{item.test.executionMode === "traceable" && <div className="yield-comparison-detail-actions"><button type="button" className="comparison-excel-button" onClick={() => void exportTraceabilityExcel(item.test, products, weightBands, bandIds)}><FileSpreadsheet size={15} /> Excel</button><div className="result-view-toggle" role="group" aria-label="Visualização analítica"><button type="button" className={detailView === "flow" ? "active" : ""} onClick={() => setDetailViews((current) => ({ ...current, [recordKey]: "flow" }))}><GitBranch size={15} /> Fluxo</button><button type="button" className={detailView === "table" ? "active" : ""} onClick={() => setDetailViews((current) => ({ ...current, [recordKey]: "table" }))}><Table2 size={15} /> Tabela por peça</button></div></div>}</header>
            {detailView === "table" && item.test.executionMode === "traceable" ? <div className="yield-comparison-matrix"><TraceabilityMatrix test={item.test} products={products} weightBands={weightBands} filterBandIds={bandIds} /></div> : <div className="result-flow-list">{item.test.flows.map((flow, flowIndex) => <ResultFlowTree key={flow.id} flow={flow} flowIndex={flowIndex} products={products} inputWeightKg={item.test.inputWeightKg} />)}</div>}
          </section></td></tr>}
        </Fragment>;
      })}</tbody></table></div>
    </section>
  </>;
}
