import { Fragment, useEffect, useMemo, useState } from "react";
import { LockKeyhole, Plus, Save, Search, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  type DistributionPayload,
  type WeeklyPlanningDay,
  type WeeklyPlanningItem,
  type WeeklyPlanningSubgroup,
  type WeeklyPlanningWeek,
} from "@/services/weekly-planning";

type PieceKey = Exclude<keyof DistributionPayload, "observacao" | "versao">;

const DAYS: Array<{ key: PieceKey; label: string; weekday: number }> = [
  { key: "PECAS_SEG", label: "SEG", weekday: 1 },
  { key: "PECAS_TER", label: "TER", weekday: 2 },
  { key: "PECAS_QUA", label: "QUA", weekday: 3 },
  { key: "PECAS_QUI", label: "QUI", weekday: 4 },
  { key: "PECAS_SEX", label: "SEX", weekday: 5 },
  { key: "PECAS_SAB", label: "SÁB", weekday: 6 },
  { key: "PECAS_DOM", label: "DOM", weekday: 0 },
];

const kg = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const quantity = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const normalized = (value: unknown) => String(value || "").trim().toLocaleUpperCase("pt-BR");

const itemDistribution = (item: WeeklyPlanningItem): DistributionPayload => ({
  PECAS_SEG: Number(item.PECAS_SEG || 0), PECAS_TER: Number(item.PECAS_TER || 0),
  PECAS_QUA: Number(item.PECAS_QUA || 0), PECAS_QUI: Number(item.PECAS_QUI || 0),
  PECAS_SEX: Number(item.PECAS_SEX || 0), PECAS_SAB: Number(item.PECAS_SAB || 0),
  PECAS_DOM: Number(item.PECAS_DOM || 0), observacao: item.OBSERVACAO || "", versao: item.VERSAO,
});

const weekday = (iso: string) => {
  const [year, month, day] = String(iso).slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day).getDay();
};

const dayLabel = (day?: WeeklyPlanningDay) => {
  if (!day) return "—";
  const [, month, date] = String(day.DATA).slice(0, 10).split("-");
  return `${date}/${month}`;
};

const weightFromPieces = (day: WeeklyPlanningDay | undefined, item: WeeklyPlanningItem, pieces: number) => {
  if (!day || Number(day.ANIMAIS_TOTAL || 0) <= 0) return 0;
  const weightPerPiece = Number(day.PESO_CARCACA_LIQUIDO_KG || 0) / (Number(day.ANIMAIS_TOTAL) * 2);
  return Math.max(0, pieces) * weightPerPiece * (Number(item.RENDIMENTO_PCT || 0) / 100);
};

interface MatrixUpdate { id: number; payload: DistributionPayload }
interface Props {
  week: WeeklyPlanningWeek;
  subgroups: WeeklyPlanningSubgroup[];
  locked: boolean;
  onSaveAll: (updates: MatrixUpdate[]) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onAssignSubgroup: (subgroup: string, dayKey: PieceKey) => void;
}

const macroOrder = (macro?: string | null) => macro === "DT DESOS" ? 1 : macro === "TR DESOS" ? 2 : 3;
const macroLabel = (macro?: string | null) => macro === "DT DESOS" ? "DIANTEIRO" : macro === "TR DESOS" ? "TRASEIRO" : "OUTROS";

export function WeeklyPlanningMatrix({ week, subgroups, locked, onSaveAll, onDelete, onAssignSubgroup }: Props) {
  const [drafts, setDrafts] = useState<Record<number, DistributionPayload>>({});
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDrafts(Object.fromEntries(week.ITENS.map((item) => [item.ID_ITEM, itemDistribution(item)])));
  }, [week]);

  const days = useMemo(() => Object.fromEntries(
    DAYS.map(({ key, weekday: target }) => [key, week.DIAS_PRODUCAO.find((day) => weekday(day.DATA) === target)]),
  ) as Record<PieceKey, WeeklyPlanningDay | undefined>, [week.DIAS_PRODUCAO]);

  const rows = useMemo(() => {
    const byName = new Map<string, WeeklyPlanningSubgroup>();
    subgroups.forEach((subgroup) => byName.set(normalized(subgroup.SUBGRUPO_GER_REND), subgroup));
    week.ITENS.forEach((item) => {
      const key = normalized(item.SUBGRUPO_GER_REND);
      if (!byName.has(key)) byName.set(key, {
        SUBGRUPO_GER_REND: item.SUBGRUPO_GER_REND,
        MACRO: null,
        RENDIMENTO_REFERENCIA_PCT: item.RENDIMENTO_PCT,
        QTD_PRODUTOS: 1,
      });
    });
    const term = normalized(search);
    return [...byName.values()]
      .filter((subgroup) => !term || normalized(subgroup.SUBGRUPO_GER_REND).includes(term))
      .sort((a, b) => macroOrder(a.MACRO) - macroOrder(b.MACRO)
        || a.SUBGRUPO_GER_REND.localeCompare(b.SUBGRUPO_GER_REND, "pt-BR"))
      .map((subgroup) => ({
        subgroup,
        items: week.ITENS.filter((item) => normalized(item.SUBGRUPO_GER_REND) === normalized(subgroup.SUBGRUPO_GER_REND)),
      }));
  }, [search, subgroups, week.ITENS]);

  const changedUpdates = useMemo(() => week.ITENS.flatMap((item) => {
    const draft = drafts[item.ID_ITEM];
    if (!draft) return [];
    return DAYS.some(({ key }) => Number(draft[key] || 0) !== Number(item[key] || 0))
      ? [{ id: item.ID_ITEM, payload: draft }] : [];
  }), [drafts, week.ITENS]);

  const totals = useMemo(() => Object.fromEntries(DAYS.map(({ key }) => {
    const pieces = week.ITENS.reduce((sum, item) => sum + Number(drafts[item.ID_ITEM]?.[key] ?? item[key] ?? 0), 0);
    const weight = week.ITENS.reduce((sum, item) => sum + weightFromPieces(
      days[key], item, Number(drafts[item.ID_ITEM]?.[key] ?? item[key] ?? 0),
    ), 0);
    return [key, { pieces, weight }];
  })) as Record<PieceKey, { pieces: number; weight: number }>, [days, drafts, week.ITENS]);

  const setPieces = (item: WeeklyPlanningItem, key: PieceKey, value: string) => {
    const parsed = Math.max(0, Number(value) || 0);
    setDrafts((current) => ({
      ...current,
      [item.ID_ITEM]: { ...(current[item.ID_ITEM] || itemDistribution(item)), [key]: parsed },
    }));
  };

  const save = async () => {
    if (!changedUpdates.length) return;
    setSaving(true);
    try { await onSaveAll(changedUpdates); } finally { setSaving(false); }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-[#9EB4C7] bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#B7C9D8] bg-[#E8EFF5] p-4">
        <div><h3 className="text-lg font-black text-[#173D6E]">Disponibilidade e direcionamento</h3><p className="text-sm text-[#60778D]">Cada animal gera 2 peças por corte. O peso usa o rendimento padrão do grupo.</p></div>
        <div className="flex items-center gap-2">
          <label className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-[#6D8296]" /><Input className="h-10 w-72 bg-white pl-9 text-sm" placeholder="Filtrar corte" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
          <Button className="h-10 bg-[#173D6E] text-sm" disabled={locked || saving || !changedUpdates.length} onClick={() => void save()}><Save className="mr-2 h-4 w-4" />{saving ? "Salvando..." : `Salvar${changedUpdates.length ? ` (${changedUpdates.length})` : ""}`}</Button>
        </div>
      </div>

      <div className="overflow-x-scroll [scrollbar-gutter:stable]">
        <div className="min-w-[1520px]">
          <div className="sticky top-0 z-20 grid border-b border-[#0E2E50] bg-[#173D6E] text-white" style={{ gridTemplateColumns: "260px repeat(7, minmax(180px, 1fr))" }}>
            <div className="sticky left-0 z-30 border-r border-white/30 bg-[#173D6E] px-4 py-4 text-xs font-black uppercase [box-shadow:6px_0_10px_-8px_rgba(15,23,42,0.9)]">SUBGRUPO_GER_REND</div>
            {DAYS.map(({ key, label }) => {
              const day = days[key];
              return <div key={key} className="border-r border-white/20 px-2 py-3 text-center last:border-r-0"><p className="text-sm font-black">{label} · {dayLabel(day)}</p><p className="mt-1 text-xs font-bold text-[#D5E4EF]">Escala {quantity.format(Number(day?.ANIMAIS_ESCALA || 0))}{Number(day?.ANIMAIS_SIMULADOS || 0) > 0 ? ` + ${quantity.format(Number(day?.ANIMAIS_SIMULADOS))} sim.` : ""}</p><p className="text-xs font-bold text-[#BBD1E2]">{quantity.format(Number(day?.PECAS_DISPONIVEIS || 0))} peças · {quantity.format(Number(day?.ARROBA_MEDIA_TOTAL || 0))} @</p></div>;
            })}
          </div>

          {rows.map(({ subgroup, items }, rowIndex) => (
            <Fragment key={subgroup.SUBGRUPO_GER_REND}>
            {(rowIndex === 0 || macroLabel(rows[rowIndex - 1]?.subgroup.MACRO) !== macroLabel(subgroup.MACRO)) && (
              <div className={`border-y px-4 py-2 text-sm font-black uppercase tracking-wide ${subgroup.MACRO === "DT DESOS" ? "border-sky-200 bg-sky-100 text-sky-900" : subgroup.MACRO === "TR DESOS" ? "border-emerald-200 bg-emerald-100 text-emerald-900" : "border-slate-200 bg-slate-100 text-slate-700"}`}>
                {macroLabel(subgroup.MACRO)}
              </div>
            )}
            <div className={`grid border-b border-[#CBD8E2] ${rowIndex % 2 ? "bg-[#F7F9FB]" : "bg-white"}`} style={{ gridTemplateColumns: "260px repeat(7, minmax(180px, 1fr))" }}>
              <div className={`sticky left-0 z-10 border-r border-[#AFC2D2] p-3.5 [box-shadow:6px_0_10px_-8px_rgba(15,23,42,0.7)] ${rowIndex % 2 ? "bg-[#EEF3F7]" : "bg-[#E5EEF5]"}`}>
                <p className="flex gap-2 text-sm font-black leading-5 text-[#173D6E]"><LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" />{subgroup.SUBGRUPO_GER_REND}</p>
                <span className={`mt-1.5 inline-flex rounded px-2 py-0.5 text-[10px] font-black uppercase ${subgroup.MACRO === "DT DESOS" ? "bg-sky-100 text-sky-800" : "bg-emerald-100 text-emerald-800"}`}>{macroLabel(subgroup.MACRO)}</span>
                <p className="mt-1 text-xs font-bold text-[#60778D]">Rend. {quantity.format(Number(subgroup.RENDIMENTO_REFERENCIA_PCT || 0))}% · {subgroup.QTD_PRODUTOS} cad.</p>
                {items.map((item) => <div key={item.ID_ITEM} className="mt-2 flex items-start justify-between gap-2 rounded-md bg-white/90 p-2"><div className="min-w-0"><p className="truncate text-xs font-black text-[#173D6E]">{item.NROCONTRATO}</p><p className="truncate text-[11px] leading-4 text-[#60778D]" title={item.DESCRICAO_PRODUTO}>{item.SEQPRODUTO} · {item.DESCRICAO_PRODUTO}</p><p className="mt-0.5 text-[11px] font-black text-[#49667F]">Peso planejado: {kg.format(Number(item.PESO_PLANEJADO || item.PESO_CONTRATO || 0))} kg</p></div><button type="button" disabled={locked} className="shrink-0 rounded p-1 text-red-500 hover:bg-red-50 disabled:opacity-40" onClick={() => void onDelete(item.ID_ITEM)}><Trash2 className="h-4 w-4" /></button></div>)}
              </div>

              {DAYS.map(({ key }) => {
                const day = days[key];
                const availablePieces = Number(day?.PECAS_DISPONIVEIS || 0);
                const availableWeight = Number(day?.PESO_CARCACA_LIQUIDO_KG || 0) * (Number(subgroup.RENDIMENTO_REFERENCIA_PCT || 0) / 100);
                const assignedPieces = items.reduce((sum, item) => sum + Number(drafts[item.ID_ITEM]?.[key] ?? item[key] ?? 0), 0);
                const assignedWeight = items.reduce((sum, item) => sum + weightFromPieces(day, item, Number(drafts[item.ID_ITEM]?.[key] ?? item[key] ?? 0)), 0);
                const remainingPieces = availablePieces - assignedPieces;
                const remainingWeight = availableWeight - assignedWeight;
                const noSale = assignedPieces <= 0;
                const over = remainingPieces < -0.01 || remainingWeight < -0.01;
                const tone = over ? "border-red-300 bg-red-50" : noSale ? "border-amber-300 bg-amber-50" : remainingPieces > 0.01 ? "border-sky-200 bg-sky-50/60" : "border-emerald-300 bg-emerald-50";
                return <div key={key} className={`min-h-[140px] border-r border-[#D4DEE6] p-2.5 last:border-r-0 ${tone}`}>
                  <div className="mb-2 rounded-md border border-white/80 bg-white/80 px-2 py-1.5 text-xs font-bold text-[#526B82]"><p className={`text-[11px] font-black uppercase ${over ? "text-red-700" : noSale ? "text-amber-800" : "text-[#174A78]"}`}>{over ? "Acima do disponível" : noSale ? "Sem venda" : "Saldo disponível"}</p><p className="mt-0.5">{quantity.format(Math.max(0, remainingPieces))} pç · {kg.format(Math.max(0, remainingWeight))} kg</p></div>
                  <button type="button" disabled={locked} className="mb-2 flex w-full items-center justify-center gap-1 rounded-md border border-[#9CB6CA] bg-white px-2 py-1.5 text-xs font-black text-[#174A78] hover:bg-[#EAF1F7] disabled:cursor-not-allowed disabled:opacity-40" onClick={() => onAssignSubgroup(subgroup.SUBGRUPO_GER_REND, key)}><Plus className="h-3.5 w-3.5" />Atrelar contrato</button>
                  <div className="space-y-2">{items.map((item) => {
                    const pieces = Number(drafts[item.ID_ITEM]?.[key] ?? item[key] ?? 0);
                    return <div key={item.ID_ITEM} className="rounded-md border border-[#C7D5E0] bg-white p-2 shadow-sm"><div className="mb-1.5 flex justify-between gap-2"><span className="truncate text-xs font-black text-[#174A78]">{item.NROCONTRATO}</span><span className="text-[11px] font-bold text-[#71869A]">{quantity.format(item.RENDIMENTO_PCT)}%</span></div><div className="grid grid-cols-2 gap-1.5"><Input type="number" min="0" step="1" disabled={locked} className="h-9 px-2 text-right text-sm font-black" value={pieces} onChange={(event) => setPieces(item, key, event.target.value)} /><div className="flex min-h-9 items-center justify-end rounded bg-[#EDF3F7] px-2 py-1.5 text-right text-xs font-black text-[#173D6E]">{kg.format(weightFromPieces(day, item, pieces))} kg</div></div></div>;
                  })}</div>
                </div>;
              })}
            </div>
            </Fragment>
          ))}

          <div className="grid border-t-2 border-[#173D6E] bg-[#DCE8F1]" style={{ gridTemplateColumns: "260px repeat(7, minmax(180px, 1fr))" }}><div className="sticky left-0 z-10 border-r border-[#AFC2D2] bg-[#D2E0EB] px-4 py-4 text-sm font-black uppercase text-[#173D6E] [box-shadow:6px_0_10px_-8px_rgba(15,23,42,0.7)]">Total direcionado</div>{DAYS.map(({ key }) => <div key={key} className="border-r border-[#B7C8D5] px-2 py-3 text-center"><p className="text-sm font-black text-[#173D6E]">{quantity.format(totals[key].pieces)} peças</p><p className="text-xs font-bold text-[#49667F]">{kg.format(totals[key].weight)} kg</p></div>)}</div>
        </div>
      </div>
    </div>
  );
}
