"use client";

import { Fragment, useEffect, useState } from "react";
import { Activity, ArrowDown, ArrowUp, ArrowUpDown, Boxes, Check, ChevronDown, ChevronRight, ChevronUp, FileSpreadsheet, GitBranch, Layers3, Maximize2, Minimize2, Minus, RotateCcw, Scale, Table2, Target, TestTube2, Trash2 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader } from "../components/PageHeader";
import { ResultFlowTree } from "../components/ResultFlowTree";
import { TraceabilityMatrix } from "../components/TraceabilityMatrix";
import { useRendimentoData } from "../context/RendimentoDataContext";
import { calculateFlowFinalWeight, calculateFlowReferenceWeight, calculateTotalDiscard } from "../utils/calculations";
import { formatDate, formatPercent, formatWeight } from "../utils/format";
import { buildTraceabilityMatrices, exportTraceabilityExcel } from "../utils/traceabilityReport";
import { exportYieldComparisonExcel, exportYieldGoalExcel } from "../utils/dashboardReport";
import { UNCLASSIFIED_WEIGHT_BAND_ID, type Product } from "../types/domain";

const pct = (value: number, base: number) => base > 0 ? (value / base) * 100 : 0;
type TargetSortKey = "week" | "date" | "standard" | "pieces" | "band" | "yieldPercent" | "goal" | "difference";
type SortDirection = "asc" | "desc";
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
    const groupIds = [product.id, ...descendantsOf(product.id)].filter((id) => selectableIds.has(id));
    const allSelected = groupIds.every((id) => values.includes(id));
    onChange(allSelected
      ? values.filter((id) => !groupIds.includes(id))
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
    const selectedCount = groupIds.filter((id) => values.includes(id)).length;
    const selected = groupIds.length > 0 && selectedCount === groupIds.length;
    const partial = selectedCount > 0 && !selected;
    const isOpen = expanded.has(product.id);
    return <div className="yield-product-filter-node" key={product.id}>
      <div className={`yield-product-filter-row ${depth === 0 ? "is-root" : ""}`} style={{ paddingLeft: `${8 + depth * 18}px` }}>
        <button type="button" className="yield-product-filter-expand" disabled={!children.length} onClick={() => toggleExpanded(product.id)}>{children.length ? isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} /> : <span />}</button>
        <button type="button" className={`yield-product-filter-check ${selected ? "active" : ""} ${partial ? "partial" : ""}`} onClick={() => toggleProduct(product)}><i>{selected ? <Check size={12} /> : partial ? <Minus size={12} /> : null}</i><span><strong>{product.name}</strong><small>{depth === 0 ? `Grupo - ${groupIds.length} itens` : `Subproduto - nivel ${product.level}`}</small></span></button>
      </div>
      {isOpen && children.length > 0 && <div>{children.map((child) => renderNode(child, depth + 1))}</div>}
    </div>;
  };

  return <div className="yield-multi-filter yield-product-tree-filter"><span>Produto</span><details><summary><b>{summary}</b><ChevronDown size={15} /></summary><div className="yield-multi-filter-menu yield-product-filter-menu"><div className="yield-product-filter-actions"><button type="button" onClick={() => onChange(selectableProductIds)}><Check size={13} /> Selecionar tudo</button><button type="button" onClick={() => onChange([])}>Limpar filtro</button></div><div className="yield-product-filter-tree">{roots.map((product) => renderNode(product))}</div></div></details></div>;
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
  const records = rawRecords.filter((record) => (!productIds.length || record.productIds.some((id) => productIds.includes(id))) && (!bandIds.length || record.pieceBands.some(pieceMatchesBandFilter) || (!record.pieceBands.length && (record.bandId ? bandIds.includes(record.bandId) : bandIds.includes(UNCLASSIFIED_WEIGHT_BAND_ID)))) && (!startDate || record.test.date >= startDate) && (!endDate || record.test.date <= endDate)).map((record) => {
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
  const productCount = new Set(records.flatMap((record) => record.productIds)).size;
  const bandGroups = new Map<string, { id: string; name: string; color: string; reference: number; final: number; pieces: number }>();
  records.forEach((record) => {
    const pieces = bandIds.length ? record.pieceBands.filter(pieceMatchesBandFilter) : record.pieceBands;
    if (!pieces.length) {
      const key = record.bandId || UNCLASSIFIED_WEIGHT_BAND_ID;
      const group = bandGroups.get(key) || { id: record.bandId || UNCLASSIFIED_WEIGHT_BAND_ID, name: record.bandId ? record.bandName : "Sem faixa", color: record.bandColor, reference: 0, final: 0, pieces: 0 };
      group.reference += record.referenceWeight;
      group.final += record.finalWeight;
      group.pieces += record.pieceCount;
      bandGroups.set(key, group);
      return;
    }
    pieces.forEach((piece) => {
      const key = piece.band?.id || UNCLASSIFIED_WEIGHT_BAND_ID;
      const group = bandGroups.get(key) || { id: piece.band?.id || UNCLASSIFIED_WEIGHT_BAND_ID, name: piece.band?.name || "Sem faixa", color: piece.band?.color || "#7890A8", reference: 0, final: 0, pieces: 0 };
      group.reference += piece.referenceWeight;
      group.final += piece.finalWeight;
      group.pieces += 1;
      bandGroups.set(key, group);
    });
  });
  const byBand = [...bandGroups.values()].map((group) => ({ ...group, label: `${group.name} · ${group.pieces} ${group.pieces === 1 ? "peça" : "peças"}`, rendimento: pct(group.final, group.reference) }));
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
  const targetRows = records.flatMap((record) => {
    const rows = record.matrix?.rows.filter((row) => (row.kind === "product" || row.kind === "final") && row.productId && (!productIds.length || productIds.includes(row.productId))) || [];
    return rows.map((row) => {
      const product = products.find((item) => item.id === row.productId);
      const goal = product?.erpProductSeq ? targetPercent(product.erpYieldTarget) : null;
      return {
        id: `${record.test.id}-${record.flow.id}-${row.id}`,
        productId: product?.id || row.productId || "",
        hierarchyOrder: productHierarchyOrder.get(product?.id || row.productId || "") ?? Number.MAX_SAFE_INTEGER,
        week: isoWeek(record.test.date),
        date: record.test.date,
        standard: product?.name || row.label,
        pieces: record.pieceCount,
        band: record.bandLabel,
        yieldPercent: row.yieldPercent,
        goal,
        difference: goal == null || row.yieldPercent == null ? null : goal - row.yieldPercent,
      };
    });
  }).sort((first, second) => second.date.localeCompare(first.date) || first.hierarchyOrder - second.hierarchyOrder || first.standard.localeCompare(second.standard, "pt-BR"));
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
  const selectableProductIds = products.filter((product) => rawRecords.some((record) => record.productIds.includes(product.id))).map((product) => product.id);
  const hierarchyProductIds = new Set(selectableProductIds);
  const productById = new Map(products.map((product) => [product.id, product]));
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
  const handleProductIdsChange = (nextProductIds: string[]) => {
    const nextReferenceIds = referenceProductIdsFor(nextProductIds);
    const compatibleBandIds = new Set(weightBands.filter((band) => band.active && (!nextProductIds.length || nextReferenceIds.has(band.productReferenceId))).map((band) => band.id));
    compatibleBandIds.add(UNCLASSIFIED_WEIGHT_BAND_ID);
    setProductIds(nextProductIds);
    setBandIds((current) => current.filter((bandId) => compatibleBandIds.has(bandId)));
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
    setProductIds([]);
    setBandIds([]);
    setStartDate("");
    setEndDate("");
    setTargetSort(null);
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
    <section className="yield-dashboard-filters" id="yield-dashboard-filters"><ProductTreeFilter products={availableProducts} selectableProductIds={selectableProductIds} values={productIds} onChange={handleProductIdsChange} /><MultiFilter label="Faixa de peso" allLabel="Todas as faixas" values={bandIds} onChange={setBandIds} options={[{ value: UNCLASSIFIED_WEIGHT_BAND_ID, label: "Sem faixa" }, ...availableWeightBands.map((band) => ({ value: band.id, label: `${band.productReferenceName} · ${band.name}` }))]} /><label>Início<input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label><label>Fim<input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label><div className="yield-filter-actions"><span>Ações</span><button type="button" onClick={resetFilters}><RotateCcw size={15} /> Restaurar filtros</button></div></section>
    <section className="yield-dashboard-cards"><article><span><TestTube2 size={18} />Testes comparados</span><strong>{records.length}</strong><small>registros finalizados</small></article><article><span><Layers3 size={18} />Produtos</span><strong>{productCount}</strong><small>grupos e subprodutos</small></article><article><span><Scale size={18} />Peso médio base</span><strong>{formatWeight(averageReference)}</strong><small>por peça</small></article><article className="featured"><span><Target size={18} />Rendimento ponderado</span><strong>{formatPercent(weightedYield)}</strong><small>{formatWeight(totalFinal)} de produto final</small></article><article><span><Trash2 size={18} />Descarte</span><strong>{formatPercent(pct(totalDiscard, totalReference))}</strong><small>{formatWeight(totalDiscard)} retirados</small></article><article><span><Boxes size={18} />Peso analisado</span><strong>{formatWeight(totalReference)}</strong><small>base dos cálculos</small></article></section>
    <section className="yield-dashboard-grid">
      <article className="yield-dashboard-chart"><header><div><span>Comparação</span><h2>Rendimento e peças por faixa</h2></div><Activity size={20} /></header><div>{byBand.length ? <ResponsiveContainer width="100%" height={300}><BarChart data={byBand} layout="vertical" margin={{ left: 14, right: 35 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" domain={[0, 100]} tickFormatter={(value) => `${value}%`} /><YAxis dataKey="label" type="category" width={145} /><Tooltip formatter={(value: number, name: string, item) => name === "rendimento" ? [formatPercent(value), `${item.payload.pieces} peças`] : value} /><Bar dataKey="rendimento" radius={[0, 6, 6, 0]} cursor="pointer" onClick={(entry) => { const clicked = entry as unknown as { id?: string; payload?: { id?: string } }; const id = String(clicked.id || clicked.payload?.id || ""); if (id) setBandIds((current) => current.length === 1 && current[0] === id ? [] : [id]); }} label={{ position: "right", formatter: (value: number) => formatPercent(value), fill: "#173D6E", fontSize: 11 }}>{byBand.map((item) => <Cell key={item.id || item.name} fill={item.color} opacity={!bandIds.length || bandIds.includes(item.id) ? 1 : .35} />)}</Bar></BarChart></ResponsiveContainer> : <p className="dashboard-empty">Nenhum teste encontrado para os filtros.</p>}</div></article>
      <article className={`yield-target-panel ${targetExpanded ? "is-expanded" : ""}`}>
        <header><div><span>Meta do ERP</span><h2>Teste x meta do produto</h2></div><div className="yield-panel-actions"><button type="button" onClick={() => void exportYieldGoalExcel(sortedTargetRows)} disabled={!sortedTargetRows.length}><FileSpreadsheet size={15} /> Excel</button><button type="button" onClick={toggleTargetExpanded}>{targetExpanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}{targetExpanded ? "Voltar aos filtros" : "Expandir"}</button></div></header>
        <div className="yield-target-table-wrap">
          <table className="yield-target-table"><thead><tr>{targetSortHeader("week", "Ano/Semana")}{targetSortHeader("date", "Data")}{targetSortHeader("standard", "Padrão")}{targetSortHeader("pieces", "Peças")}{targetSortHeader("band", "Faixa @")}{targetSortHeader("yieldPercent", "Rend. teste")}{targetSortHeader("goal", "Meta")}{targetSortHeader("difference", "Diferença")}</tr></thead><tbody>
            {sortedTargetRows.length ? sortedTargetRows.map((row) => <tr key={row.id}><td>{row.week}</td><td>{formatDate(row.date)}</td><td><strong>{row.standard}</strong></td><td>{row.pieces}</td><td>{row.band}</td><td>{row.yieldPercent == null ? "" : formatPercent(row.yieldPercent)}</td><td>{row.goal == null ? "" : formatPercent(row.goal)}</td><td className={row.difference == null ? "" : row.difference < 0 ? "below-target" : "above-target"}>{row.difference == null ? "" : formatPercent(row.difference)}</td></tr>) : <tr><td colSpan={8} className="dashboard-empty">Nenhum teste encontrado para os filtros.</td></tr>}
          </tbody></table>
        </div>
      </article>
    </section>
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
