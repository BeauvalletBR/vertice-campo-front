import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarRange, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Factory, FileSpreadsheet, PackageCheck, Save, Settings2, ShieldAlert, Upload, Warehouse } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { contractsApi, type ContractsPanelResponse, type ExportContract, type PcpConfig, type PcpPlanning, type PcpRecommendation, type PcpStockProjection, type SpreadsheetImportResult } from "@/services/contracts";

export type PcpView = "RECOMENDACAO" | "LINHA_TEMPO" | "CALENDARIO_EMBARQUE" | "IMPORTACAO" | "CONFIGURACAO" | "MANUAL";
const kg = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 2 });
const shortDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" });
const formatKg = (value?: number | null) => `${kg.format(Number(value || 0))} kg`;
const formatDate = (value?: string | null) => value ? new Intl.DateTimeFormat("pt-BR").format(new Date(`${String(value).slice(0, 10)}T12:00:00`)) : "Não definida";
const errorMessage = (error: unknown) => error instanceof Error ? error.message : "Não foi possível concluir a operação.";
const decisionStyle: Record<string, string> = {
  INICIAR: "border-emerald-300 bg-emerald-50 text-emerald-800", PROXIMO: "border-blue-300 bg-blue-50 text-blue-800",
  ENCAMINHADO: "border-cyan-300 bg-cyan-50 text-cyan-800", PROGRAMAR: "border-slate-300 bg-slate-50 text-slate-700", CRITICO: "border-red-300 bg-red-50 text-red-800",
  AGUARDAR_ESTOQUE: "border-orange-300 bg-orange-50 text-orange-800", COBERTO: "border-emerald-300 bg-emerald-50 text-emerald-800",
  REVISAR_DADOS: "border-amber-300 bg-amber-50 text-amber-800",
  EM_EXPEDICAO: "border-cyan-300 bg-cyan-50 text-cyan-800",
};
const decisionLabel = (decision: PcpRecommendation["DECISAO"]) => ({
  INICIAR: "INICIAR", PROXIMO: "PRÓXIMO", ENCAMINHADO: "ENCAMINHADO",
  PROGRAMAR: "DEFINIR DATA", CRITICO: "PRIORIDADE CRÍTICA", AGUARDAR_ESTOQUE: "AGUARDAR ESTOQUE",
  COBERTO: "COBERTO", REVISAR_DADOS: "REVISAR DADOS", EM_EXPEDICAO: "EM EXPEDIÇÃO",
}[decision]);

const recommendationHeadline = (recommendation: PcpRecommendation) => ({
  INICIAR: "Iniciar contrato",
  PROXIMO: "Preparar próximo contrato",
  ENCAMINHADO: "Contrato encaminhado",
  PROGRAMAR: "Definir data do contrato",
  CRITICO: "Priorizar contrato",
  AGUARDAR_ESTOQUE: "Aguardar estoque para o contrato",
  COBERTO: "Contrato coberto",
  REVISAR_DADOS: "Revisar dados do contrato",
  EM_EXPEDICAO: "Contrato em expedição",
}[recommendation.DECISAO]);

export function PcpWorkspace({ view, data, reload }: { view: PcpView | "CONTRATOS" | "ESTOQUE"; data: ContractsPanelResponse; reload: () => Promise<void> }) {
  const isMaintenanceView = view === "RECOMENDACAO" || view === "LINHA_TEMPO";

  if (isMaintenanceView) {
    const title = view === "RECOMENDACAO" ? "Recomendação PCP" : "Calendário de ocupação do estoque";
    return <Card className="overflow-hidden border-amber-300 bg-white shadow-sm"><CardContent className="p-0"><div className="flex min-h-[360px] flex-col items-center justify-center bg-[radial-gradient(circle_at_top,#FFF7DF_0%,#FFFFFF_58%)] px-6 py-14 text-center"><span className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 text-amber-700"><AlertTriangle className="h-8 w-8" /></span><span className="rounded-full border border-amber-300 bg-amber-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-amber-900">Em manutenção</span><h2 className="mt-4 text-2xl font-black text-[#173D6E]">{title}</h2><p className="mt-2 max-w-xl text-sm font-semibold leading-6 text-[#667B90]">As regras e projeções deste painel estão em revisão. Os contratos e as operações de alocação continuam disponíveis normalmente nas demais telas.</p></div></CardContent></Card>;
  }

  return <>
    <section className={view === "CALENDARIO_EMBARQUE" ? "block" : "hidden"} aria-hidden={view !== "CALENDARIO_EMBARQUE"}><ShipmentCalendar contracts={data.contratos} /></section>
    <section className={view === "IMPORTACAO" ? "block" : "hidden"} aria-hidden={view !== "IMPORTACAO"}><SpreadsheetImport configured={data.pcp_estrutura_configurada} reload={reload} /></section>
    <section className={view === "CONFIGURACAO" ? "block" : "hidden"} aria-hidden={view !== "CONFIGURACAO"}><Configuration data={data} reload={reload} /></section>
    <section className={view === "MANUAL" ? "block" : "hidden"} aria-hidden={view !== "MANUAL"}><ContractsManual /></section>
  </>;
}

type ShipmentRisk = "OK" | "ATENCAO" | "RISCO" | "ATRASADO";

const parseDateOnly = (value?: string | null) => {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
};

const dateKey = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;

const shipmentDate = (contract: ExportContract) => contract.DTA_EMBARQUE_PLANEJADA || contract.DTA_EMBARQUE_ERP || null;

const shipmentCoverage = (contract: ExportContract) => {
  const total = Number(contract.PESO_TOTAL || 0);
  if (total <= 0) return 0;
  const covered = contract.EM_EXPEDICAO
    ? Number(contract.PESO_EXPEDIDO || 0)
    : contract.PRODUTOS.reduce((sum, product) => sum + Math.min(Number(product.PESOCONTRATO || 0), Number(product.PESO_ATRELADO_TOTAL || 0)), 0);
  return Math.min(100, Math.max(0, covered / total * 100));
};

const shipmentType = (contract: ExportContract) => {
  const types = new Set(contract.PRODUTOS.map((product) => {
    const value = String(product.RESFCONG || "").toUpperCase();
    if (value.includes("RESF")) return "RESFRIADO";
    if (value.includes("CONG")) return "CONGELADO";
    return "NÃO CLASSIFICADO";
  }));
  if (types.size === 1) return [...types][0];
  if (types.has("RESFRIADO") && types.has("CONGELADO")) return "MISTO";
  return [...types].filter((item) => item !== "NÃO CLASSIFICADO").join(" + ") || "NÃO CLASSIFICADO";
};

const shipmentRisk = (contract: ExportContract): ShipmentRisk => {
  const shipping = parseDateOnly(shipmentDate(contract));
  if (!shipping) return "ATENCAO";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const coverage = shipmentCoverage(contract);
  if (shipping < today && coverage < 98) return "ATRASADO";
  const forecast = parseDateOnly(contract.PREVISAO_TERMINO_PRODUCAO);
  if (forecast && forecast > shipping) return "RISCO";
  if (!forecast && coverage < 98) return "ATENCAO";
  return "OK";
};

const shipmentRiskLabel: Record<ShipmentRisk, string> = {
  OK: "No prazo",
  ATENCAO: "Sem previsão completa",
  RISCO: "Risco de atraso",
  ATRASADO: "Atrasado",
};

function ShipmentCalendar({ contracts }: { contracts: ExportContract[] }) {
  const visibleContracts = useMemo(() => contracts.filter((contract) => !contract.DESCONSIDERADO && shipmentDate(contract)), [contracts]);
  const initialDate = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const next = visibleContracts.map((contract) => parseDateOnly(shipmentDate(contract))).filter((item): item is Date => Boolean(item)).sort((a, b) => a.getTime() - b.getTime()).find((item) => item >= today);
    return next || today;
  }, [visibleContracts]);
  const [month, setMonth] = useState(() => new Date(initialDate.getFullYear(), initialDate.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedContract, setSelectedContract] = useState<ExportContract | null>(null);
  const contractsByDate = useMemo(() => {
    const grouped = new Map<string, ExportContract[]>();
    visibleContracts.forEach((contract) => {
      const date = parseDateOnly(shipmentDate(contract));
      if (!date) return;
      const key = dateKey(date);
      grouped.set(key, [...(grouped.get(key) || []), contract]);
    });
    return grouped;
  }, [visibleContracts]);
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - first.getDay());
  const days = Array.from({ length: 42 }, (_, index) => {
    const day = new Date(gridStart);
    day.setDate(gridStart.getDate() + index);
    return day;
  });
  const selectedContracts = selectedDate ? contractsByDate.get(selectedDate) || [] : [];
  const monthTitle = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(month);

  const openDay = (key: string) => {
    setSelectedDate(key);
    setSelectedContract(null);
  };

  return <div className="space-y-4">
    <Card className="border-[#CEDAE5] shadow-sm"><CardContent className="p-0">
      <div className="flex flex-col gap-3 border-b border-[#DCE5ED] p-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="flex items-center gap-2 text-lg font-black text-[#173D6E]"><CalendarRange className="h-5 w-5" />Calendário de embarques</h2><p className="mt-1 text-xs text-[#6A7E91]">Planejamento, previsão de término e risco dos contratos por data.</p></div><div className="flex items-center gap-2"><Button type="button" size="sm" variant="outline" onClick={() => setMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}><ChevronLeft className="h-4 w-4" /></Button><p className="min-w-[190px] text-center text-sm font-black capitalize text-[#173D6E]">{monthTitle}</p><Button type="button" size="sm" variant="outline" onClick={() => setMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}><ChevronRight className="h-4 w-4" /></Button><Button type="button" size="sm" variant="outline" onClick={() => { const today = new Date(); setMonth(new Date(today.getFullYear(), today.getMonth(), 1)); }}>Hoje</Button></div></div>
      <div className="flex flex-wrap gap-4 border-b border-[#E1E8EE] px-4 py-3 text-[10px] font-bold text-[#536B82]"><CalendarLegend className="bg-emerald-500" label="No prazo" /><CalendarLegend className="bg-amber-400" label="Sem previsão completa" /><CalendarLegend className="bg-red-500" label="Atrasado ou previsão após o embarque" /></div>
      <div className="overflow-x-auto p-4"><div className="min-w-[920px]"><div className="grid grid-cols-7">{["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((label) => <div key={label} className="border-b bg-[#EDF3F7] p-2 text-center text-[10px] font-black uppercase text-[#536B82]">{label}</div>)}</div><div className="grid grid-cols-7 border-l border-t border-[#D7E1E9]">{days.map((day) => { const key = dateKey(day); const items = contractsByDate.get(key) || []; const outside = day.getMonth() !== month.getMonth(); const risks = items.map(shipmentRisk); const worst: ShipmentRisk = risks.includes("ATRASADO") ? "ATRASADO" : risks.includes("RISCO") ? "RISCO" : risks.includes("ATENCAO") ? "ATENCAO" : "OK"; const frozen = items.filter((item) => shipmentType(item).includes("CONGELADO")).length; const chilled = items.filter((item) => shipmentType(item).includes("RESFRIADO")).length; return <button key={key} type="button" disabled={items.length === 0} onClick={() => openDay(key)} className={`min-h-[118px] border-b border-r border-[#D7E1E9] p-2 text-left transition ${outside ? "bg-[#F7F9FB] text-[#9AA8B5]" : "bg-white"} ${items.length ? "hover:bg-blue-50" : "cursor-default"}`}><div className="flex items-center justify-between"><span className={`text-xs font-black ${outside ? "text-[#9AA8B5]" : "text-[#173D6E]"}`}>{day.getDate()}</span>{items.length > 0 && <span className={`h-2.5 w-2.5 rounded-full ${worst === "OK" ? "bg-emerald-500" : worst === "ATENCAO" ? "bg-amber-400" : "bg-red-500"}`} />}</div>{items.length > 0 && <div className="mt-3"><p className="text-lg font-black text-[#173D6E]">{items.length}</p><p className="text-[9px] font-bold uppercase text-[#71869A]">{items.length === 1 ? "contrato" : "contratos"}</p><p className="mt-2 truncate text-[9px] font-semibold text-[#536B82]">{frozen} cong. · {chilled} resf.</p><p className="mt-1 truncate text-[9px] font-black text-[#315F88]">{formatKg(items.reduce((sum, item) => sum + Number(item.PESO_TOTAL || 0), 0))}</p></div>}</button>; })}</div></div></div>
    </CardContent></Card>
    <Dialog open={Boolean(selectedDate)} onOpenChange={(open) => { if (!open) { setSelectedDate(null); setSelectedContract(null); } }}><DialogContent className="max-h-[90vh] max-w-[96vw] overflow-y-auto border-[#CBD8E3] xl:max-w-5xl"><DialogHeader><DialogTitle className="text-[#173D6E]">{selectedContract ? `Contrato ${selectedContract.NROCONTRATO}` : `Embarques de ${selectedDate ? formatDate(selectedDate) : ""}`}</DialogTitle><DialogDescription>{selectedContract ? `${selectedContract.NOMERAZAO} · ${shipmentType(selectedContract)}` : `${selectedContracts.length} contrato(s) programado(s) nesta data.`}</DialogDescription></DialogHeader>{selectedContract ? <ShipmentContractDetail contract={selectedContract} onBack={() => setSelectedContract(null)} /> : <div className="space-y-2">{selectedContracts.map((contract) => { const risk = shipmentRisk(contract); const coverage = shipmentCoverage(contract); return <button key={contract.SEQCONTRATO} type="button" onClick={() => setSelectedContract(contract)} className={`grid w-full gap-3 rounded-lg border p-4 text-left sm:grid-cols-[130px_1fr_130px_120px_24px] sm:items-center ${risk === "OK" ? "border-emerald-200 bg-emerald-50/50" : risk === "ATENCAO" ? "border-amber-200 bg-amber-50/60" : "border-red-300 bg-red-50/70"}`}><p className="font-mono text-sm font-black text-[#173D6E]">{contract.NROCONTRATO}</p><div><p className="text-xs font-black text-[#173D6E]">{contract.NOMERAZAO}</p><p className="mt-1 text-[10px] font-semibold text-[#60758A]">{contract.PAISDESTINO || "País não informado"} · {shipmentType(contract)}</p></div><div><p className="text-[9px] font-black uppercase text-[#71869A]">Previsão término</p><p className="mt-1 text-xs font-black text-[#304D68]">{formatDate(contract.PREVISAO_TERMINO_PRODUCAO)}</p></div><div><p className={`text-[10px] font-black uppercase ${risk === "OK" ? "text-emerald-700" : risk === "ATENCAO" ? "text-amber-800" : "text-red-700"}`}>{shipmentRiskLabel[risk]}</p><p className="mt-1 text-xs font-bold text-[#536B82]">{decimal.format(coverage)}% coberto</p></div><ChevronRight className="h-4 w-4 text-[#315F88]" /></button>; })}</div>}</DialogContent></Dialog>
  </div>;
}

function ShipmentContractDetail({ contract, onBack }: { contract: ExportContract; onBack: () => void }) {
  const risk = shipmentRisk(contract);
  return <div className="space-y-4"><Button type="button" size="sm" variant="outline" onClick={onBack}><ChevronLeft className="mr-1 h-4 w-4" />Voltar para a data</Button><div className="grid grid-cols-2 gap-2 sm:grid-cols-5"><DecisionMetric label="Embarque" value={formatDate(shipmentDate(contract))} /><DecisionMetric label="Previsão término" value={formatDate(contract.PREVISAO_TERMINO_PRODUCAO)} /><DecisionMetric label="Cobertura" value={`${decimal.format(shipmentCoverage(contract))}%`} /><DecisionMetric label="Tipo" value={shipmentType(contract)} /><DecisionMetric label="Situação" value={shipmentRiskLabel[risk]} alert={risk === "RISCO" || risk === "ATRASADO"} /></div><div className="overflow-x-auto rounded-lg border border-[#D5E0E9]"><Table className="min-w-[900px]"><TableHeader className="bg-[#EDF3F7]"><TableRow><TableHead>Produto</TableHead><TableHead>Descrição</TableHead><TableHead>Tipo</TableHead><TableHead className="text-right">Peso contrato</TableHead><TableHead className="text-right">Alocado</TableHead><TableHead className="text-right">Saldo</TableHead><TableHead>Validade</TableHead></TableRow></TableHeader><TableBody>{contract.PRODUTOS.map((product) => <TableRow key={product.SEQPRODUTO}><TableCell className="font-mono text-xs font-black text-[#173D6E]">{product.SEQPRODUTO}</TableCell><TableCell className="text-xs font-bold text-[#304D68]">{product.DESCRICAO}</TableCell><TableCell className="text-xs font-semibold">{product.RESFCONG || "—"}</TableCell><TableCell className="text-right text-xs font-black">{formatKg(product.PESOCONTRATO)}</TableCell><TableCell className="text-right text-xs font-black text-emerald-700">{formatKg(product.PESO_ATRELADO_TOTAL)}</TableCell><TableCell className="text-right text-xs font-black text-orange-700">{formatKg(product.SALDO_CONTRATO)}</TableCell><TableCell className="text-xs font-semibold">{product.VALIDADE ? `${product.VALIDADE} ${product.TIPOVALIDADE === "D" ? "dias" : product.TIPOVALIDADE === "M" ? "meses" : "anos"}` : "Sem regra"}</TableCell></TableRow>)}</TableBody></Table></div></div>;
}

function CalendarLegend({ className, label }: { className: string; label: string }) { return <span className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${className}`} />{label}</span>; }

function Recommendation({ data }: { data: ContractsPanelResponse }) {
  const planning = data.planejamento;
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [selectedDecision, setSelectedDecision] = useState<PcpRecommendation | null>(null);
  if (!planning?.CONFIGURADO) return <EmptyConfiguration />;
  const first = planning.RECOMENDACOES.find((item) => ["INICIAR", "CRITICO"].includes(item.DECISAO))
    || planning.RECOMENDACOES.find((item) => item.DECISAO === "AGUARDAR_ESTOQUE")
    || planning.RECOMENDACOES.find((item) => item.DECISAO === "PROXIMO")
    || planning.RECOMENDACOES[0];
  return <div className="space-y-4">
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Metric label="Contratos analisados" value={String(planning.RESUMO.CONTRATOS_ANALISADOS)} icon={PackageCheck} />
      <Metric label="Contratos críticos" value={String(planning.RESUMO.CONTRATOS_CRITICOS)} icon={ShieldAlert} tone={planning.RESUMO.CONTRATOS_CRITICOS ? "red" : "blue"} />
      <Metric label="Peso a produzir" value={formatKg(planning.RESUMO.PESO_FALTANTE)} icon={Factory} />
      <Metric label="Excesso projetado" value={formatKg(planning.RESUMO.EXCESSO_PROJETADO)} icon={Warehouse} tone={planning.RESUMO.EXCESSO_PROJETADO ? "orange" : "blue"} />
    </section>
    <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
      <Card className="overflow-hidden border-[#B8CCDC] shadow-sm"><div className="bg-[#173D6E] p-5 text-white"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-100">Recomendação de hoje</p><div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">{first ? <button type="button" onClick={() => setSelectedDecision(first)} className="group text-left focus:outline-none focus:ring-2 focus:ring-white/70" title="Clique para entender a decisão deste contrato"><h2 className="text-2xl font-black underline-offset-4 group-hover:underline">{recommendationHeadline(first)} {first.NROCONTRATO}</h2><p className="mt-1 text-sm text-blue-100">{first.CLIENTE}</p><span className="mt-2 inline-block text-[10px] font-bold uppercase tracking-wider text-blue-200">Clique no nome para ver a decisão completa</span></button> : <div><h2 className="text-2xl font-black">Nenhum contrato pendente</h2><p className="mt-1 text-sm text-blue-100">Todos os contratos estão cobertos.</p></div>}{first && <button type="button" onClick={() => setSelectedDecision(first)} className={`w-fit rounded-md border px-3 py-1 text-xs font-black transition hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-white ${decisionStyle[first.DECISAO]}`} title="Clique para entender a decisão">{decisionLabel(first.DECISAO)}</button>}</div></div>{first && <CardContent className="grid gap-4 p-5 sm:grid-cols-4"><Fact label="Tempo estimado" value={first.DIAS_ESTIMADOS == null ? "Revisar dados" : `${first.DIAS_ESTIMADOS} dias`} /><Fact label="Produto gargalo" value={first.PRODUTO_GARGALO || "Sem gargalo"} /><Fact label="Embarque" value={formatDate(first.DATA_EMBARQUE)} /><Fact label="Cobertura" value={`${decimal.format(first.COBERTURA_PCT)}%`} /><div className="rounded-lg border border-[#D6E1EA] bg-[#F7F9FB] p-3 text-sm font-semibold text-[#3D5871] sm:col-span-4">{first.MOTIVO}</div><BottleneckGuidance recommendation={first} /></CardContent>}</Card>
      <Card className="border-[#CEDAE5] shadow-sm"><CardContent className="p-5"><h3 className="text-sm font-black text-[#173D6E]">Ocupação do estoque</h3><p className="mt-1 text-xs text-[#6A7E91]">Inclui MI na ocupação física.</p><div className="mt-4 space-y-4">{planning.OCUPACAO.map((item) => <div key={item.TIPO}><div className="mb-1.5 flex items-end justify-between"><div><p className="text-xs font-black text-[#274967]">{item.TIPO}</p><p className="text-[10px] text-[#708497]">Alerta {formatKg(item.ALERTA)}</p></div><p className={`text-sm font-black ${item.SITUACAO === "NORMAL" ? "text-[#173D6E]" : "text-orange-700"}`}>{formatKg(item.PESO_ATUAL)} <span className="text-[10px]">/ {formatKg(item.LIMITE)}</span></p></div><Progress value={Math.min(100, item.PERCENTUAL)} className="h-2" /></div>)}</div></CardContent></Card>
    </div>
    <Card className="border-[#CEDAE5] shadow-sm"><CardContent className="p-0"><div className="border-b border-[#DCE5ED] p-4"><h2 className="text-base font-black text-[#173D6E]">Sequência recomendada</h2><p className="text-xs text-[#6A7E91]">Prioridade, embarque, cobertura, gargalo e capacidade de estoque. Clique na decisão para ver os motivos.</p></div><div className="overflow-x-auto"><Table className="min-w-[1150px]"><TableHeader className="bg-[#EDF3F7]"><TableRow><Head>Ordem</Head><Head>Contrato / cliente</Head><Head>Decisão</Head><Head>Cobertura</Head><Head>Gargalo</Head><Head>Dias</Head><Head>Data de entrega</Head><Head>Conclusão</Head><Head>Excesso</Head><Head /></TableRow></TableHeader><TableBody>{planning.RECOMENDACOES.map((item) => { const open = expanded.has(item.SEQCONTRATO); return [<TableRow key={`r-${item.SEQCONTRATO}`} className={item.DECISAO === "CRITICO" ? "bg-red-50/60" : ""}><TableCell className="text-center text-base font-black text-[#173D6E]">{item.POSICAO}</TableCell><TableCell><p className="text-xs font-black text-[#173D6E]">{item.NROCONTRATO} · {item.CLIENTE}</p><p className="text-[10px] text-[#6A7E91]">{item.PAIS || "País não informado"} · {item.PRIORIDADE}</p></TableCell><TableCell><button type="button" onClick={() => setSelectedDecision(item)} className={`rounded border px-2 py-1 text-[10px] font-black transition hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-[#315F88] ${decisionStyle[item.DECISAO]}`} title="Clique para entender a decisão">{item.DECISAO.replaceAll("_", " ")}</button></TableCell><TableCell className="text-xs font-black">{decimal.format(item.COBERTURA_PCT)}%</TableCell><TableCell className="max-w-52 truncate text-xs font-bold">{item.PRODUTO_GARGALO || "—"}</TableCell><TableCell className="text-xs font-black">{item.DIAS_ESTIMADOS ?? "—"}</TableCell><TableCell className="whitespace-nowrap text-xs font-bold">{item.DATA_EMBARQUE ? formatDate(item.DATA_EMBARQUE) : "—"}</TableCell><TableCell className="whitespace-nowrap text-xs font-bold">{formatDate(item.FIM_SEQUENCIA)}</TableCell><TableCell className="text-xs font-black text-orange-700">{formatKg(item.EXCESSO_PROJETADO)}</TableCell><TableCell><button className="rounded border p-1.5 text-[#244B70]" onClick={() => setExpanded((current) => { const next = new Set(current); if (open) next.delete(item.SEQCONTRATO); else next.add(item.SEQCONTRATO); return next; })}>{open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</button></TableCell></TableRow>, open && <TableRow key={`d-${item.SEQCONTRATO}`} className="bg-[#F7F9FB]"><TableCell colSpan={10} className="p-4"><ProductProjection recommendation={item} /></TableCell></TableRow>]; })}</TableBody></Table></div></CardContent></Card>
    <DecisionDetailsDialog recommendation={selectedDecision} onClose={() => setSelectedDecision(null)} />
  </div>;
}

const decisionImpact: Record<PcpRecommendation["DECISAO"], string> = {
  INICIAR: "Este contrato ficou em primeiro na sequência. Adiar o início pode comprometer a data de embarque ou aumentar o risco indicado pelos fatores abaixo.",
  PROXIMO: "Este é o próximo contrato recomendado. Iniciá-lo antes do atual pode inverter prioridades e antecipar estoque que ainda não é necessário.",
  ENCAMINHADO: "Este contrato já possui data ou andamento operacional e permanece na posição calculada da sequência produtiva.",
  PROGRAMAR: "O contrato pode entrar na programação sem risco crítico imediato, respeitando a posição indicada na sequência.",
  CRITICO: "A conclusão estimada ultrapassa o embarque. Cada dia sem produção mantém ou aumenta o atraso projetado.",
  AGUARDAR_ESTOQUE: "Não comece os demais produtos agora. Forme primeiro o estoque mínimo do produto gargalo para reduzir o tempo em que os outros itens ficariam parados aguardando o fechamento do contrato.",
  COBERTO: "O peso necessário já está coberto. Produção adicional para este contrato pode gerar estoque excedente.",
  REVISAR_DADOS: "Faltam metas ou origem produtiva para calcular prazo e impacto com segurança. A programação pode ficar incorreta até completar esses dados.",
  EM_EXPEDICAO: "O carregamento já foi iniciado. A cobertura exibida considera o peso efetivamente expedido; reservas manuais e de ordens de produção permanecem protegidas para o saldo ainda não carregado.",
};

function DecisionDetailsDialog({ recommendation, onClose }: { recommendation: PcpRecommendation | null; onClose: () => void }) {
  if (!recommendation) return null;
  const coverage = Math.min(100, Math.max(0, Number(recommendation.COBERTURA_PCT || 0)));
  const linkedExcess = Number(recommendation.PESO_EXCEDENTE_VINCULADO || 0);
  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}><DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto border-[#C5D4E1]"><DialogHeader><DialogTitle className="flex flex-wrap items-center gap-2 text-[#173D6E]"><span>Decisão do contrato {recommendation.NROCONTRATO}</span><span className={`rounded border px-2 py-1 text-[10px] font-black ${decisionStyle[recommendation.DECISAO]}`}>{recommendation.DECISAO.replaceAll("_", " ")}</span></DialogTitle><DialogDescription>{recommendation.CLIENTE} · posição {recommendation.POSICAO} da sequência recomendada</DialogDescription></DialogHeader><div className="space-y-4"><div className="rounded-lg border border-[#BFD0DE] bg-[#F4F8FB] p-4"><p className="text-[10px] font-black uppercase tracking-wider text-[#5D748A]">Por que o sistema tomou esta decisão</p><p className="mt-2 text-sm font-bold leading-6 text-[#244B70]">{recommendation.MOTIVO}</p><p className="mt-2 text-xs leading-5 text-[#536B82]">{decisionImpact[recommendation.DECISAO]}</p></div><DataIssues recommendation={recommendation} /><div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><DecisionMetric label="Peso contratado" value={formatKg(recommendation.PESO_TOTAL)} /><DecisionMetric label="Cobertura válida" value={`${decimal.format(coverage)}%`} /><DecisionMetric label="Falta produzir" value={formatKg(recommendation.FALTANTE_PRODUZIR)} /><DecisionMetric label="Excesso vinculado" value={formatKg(linkedExcess)} alert={linkedExcess > 0} /></div><div className="rounded-lg border border-[#D6E1EA] p-4"><h3 className="text-xs font-black uppercase tracking-wider text-[#173D6E]">Como a cobertura é calculada</h3><p className="mt-2 text-xs leading-5 text-[#536B82]">Cobertura é a parte do peso contratado que já possui estoque, reserva ou ordem vinculada: <strong>{formatKg(recommendation.PESO_COBERTO)}</strong> de <strong>{formatKg(recommendation.PESO_TOTAL)}</strong>. Ela é limitada a 100%.</p>{linkedExcess > 0 && <p className="mt-2 rounded-md border border-orange-200 bg-orange-50 p-2 text-xs font-bold text-orange-800">Há {formatKg(linkedExcess)} vinculados acima da necessidade do contrato. Esse valor não aumenta a cobertura; ele aparece como excesso para revisão.</p>}</div><div className="grid gap-3 sm:grid-cols-2"><DecisionFactor label="Prioridade cadastrada" value={recommendation.PRIORIDADE || "Não informada"} /><DecisionFactor label="Data de embarque" value={formatDate(recommendation.DATA_EMBARQUE)} /><DecisionFactor label="Conclusão na sequência" value={formatDate(recommendation.FIM_SEQUENCIA)} /><DecisionFactor label="Atraso projetado" value={`${recommendation.ATRASO_DIAS || 0} dia(s)`} alert={Number(recommendation.ATRASO_DIAS) > 0} /><DecisionFactor label="Produto gargalo" value={recommendation.PRODUTO_GARGALO || "Nenhum"} /><DecisionFactor label="Tempo estimado" value={recommendation.DIAS_ESTIMADOS == null ? "Não calculado" : `${recommendation.DIAS_ESTIMADOS} dia(s)`} /><DecisionFactor label="Excesso futuro congelado" value={formatKg(recommendation.EXCESSO_CONGELADO)} alert={Number(recommendation.EXCESSO_CONGELADO) > 0} /><DecisionFactor label="Excesso futuro resfriado" value={formatKg(recommendation.EXCESSO_RESFRIADO)} alert={Number(recommendation.EXCESSO_RESFRIADO) > 0} /></div><BottleneckGuidance recommendation={recommendation} />{recommendation.ALERTAS.length > 0 && recommendation.DECISAO !== "REVISAR_DADOS" && <div className="rounded-lg border border-amber-200 bg-amber-50 p-4"><h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-amber-900"><AlertTriangle className="h-4 w-4" />Pontos que interferiram</h3><ul className="mt-2 space-y-1.5">{recommendation.ALERTAS.map((alert) => <li key={alert} className="text-xs font-semibold text-amber-900">• {alert}</li>)}</ul></div>}</div></DialogContent></Dialog>;
}

function DataIssues({ recommendation }: { recommendation: PcpRecommendation }) {
  const issues = recommendation.PENDENCIAS_DADOS || [];
  if (recommendation.DECISAO !== "REVISAR_DADOS" || !issues.length) return null;
  return <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-4"><h3 className="flex items-center gap-2 text-sm font-black text-amber-950"><AlertTriangle className="h-5 w-5" />O que precisa ser corrigido</h3><p className="mt-1 text-xs font-semibold text-amber-900">Corrija os itens abaixo e atualize o painel para o sistema recalcular o prazo.</p><div className="mt-3 space-y-2">{issues.map((issue, index) => <div key={`${issue.ESCOPO}-${issue.SEQPRODUTO || index}`} className="rounded-md border border-amber-200 bg-white p-3"><div className="flex flex-wrap items-center gap-2"><span className="rounded bg-amber-100 px-2 py-0.5 text-[9px] font-black uppercase text-amber-900">{issue.ESCOPO === "CONFIGURACAO" ? "Configuração da desossa" : `Produto ${issue.SEQPRODUTO}`}</span>{issue.CAMPOS.map((field) => <span key={field} className="rounded border border-amber-200 px-1.5 py-0.5 font-mono text-[9px] font-bold text-amber-900">{field}</span>)}</div><p className="mt-2 text-xs font-bold leading-5 text-[#5F4317]">{issue.MENSAGEM}</p></div>)}</div></div>;
}

function DecisionMetric({ label, value, alert = false }: { label: string; value: string; alert?: boolean }) { return <div className={`rounded-lg border p-3 ${alert ? "border-orange-200 bg-orange-50" : "border-[#D6E1EA] bg-white"}`}><p className="text-[9px] font-black uppercase tracking-wider text-[#6A7E91]">{label}</p><p className={`mt-1 text-sm font-black ${alert ? "text-orange-800" : "text-[#173D6E]"}`}>{value}</p></div>; }
function DecisionFactor({ label, value, alert = false }: { label: string; value: string; alert?: boolean }) { return <div className="flex items-start justify-between gap-3 rounded-md border border-[#DCE5ED] p-3"><span className="text-xs font-semibold text-[#60758A]">{label}</span><strong className={`text-right text-xs ${alert ? "text-red-700" : "text-[#173D6E]"}`}>{value}</strong></div>; }

function BottleneckGuidance({ recommendation }: { recommendation: PcpRecommendation }) {
  if (recommendation.DECISAO !== "AGUARDAR_ESTOQUE") return null;
  return <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 sm:col-span-4">
    <p className="text-[10px] font-black uppercase tracking-wider text-orange-800">Ponto seguro para começar</p>
    <div className="mt-3 grid gap-3 sm:grid-cols-4">
      <DecisionMetric label="Produto gargalo" value={recommendation.ESTOQUE_GATILHO_PRODUTO || "Não identificado"} alert />
      <DecisionMetric label="Estoque atual" value={formatKg(recommendation.ESTOQUE_GATILHO_ATUAL_KG)} />
      <DecisionMetric label="Estoque necessário" value={formatKg(recommendation.ESTOQUE_GATILHO_KG)} alert />
      <DecisionMetric label="Começar a partir de" value={formatDate(recommendation.DATA_RECOMENDADA_INICIO)} />
    </div>
    <p className="mt-3 text-xs font-semibold leading-5 text-orange-900">Faltam {formatKg(recommendation.FALTA_PARA_GATILHO_KG)} do produto gargalo. A espera estimada é de {recommendation.DIAS_ESPERA_GARGALO || 0} dia(s) e evita, em média, {decimal.format(recommendation.MEDIA_ESPERA_PRODUTOS_DIAS || 0)} dia(s) de estoque parado nos demais produtos.</p>
  </div>;
}

function ProductProjection({ recommendation }: { recommendation: PcpRecommendation }) {
  return <div className="overflow-x-auto rounded-lg border bg-white"><Table className="min-w-[1120px]"><TableHeader className="bg-[#EDF3F7]"><TableRow><Head>Produto</Head><Head>Origem</Head><Head>Meta</Head><Head>Peso contrato</Head><Head>Já reservado</Head><Head>Falta produzir</Head><Head>Produção/dia</Head><Head>Dias</Head><Head>Espera</Head><Head>Excesso</Head></TableRow></TableHeader><TableBody>{recommendation.PRODUTOS.map((product) => { const pending = product.PENDENCIAS_DADOS || []; return <TableRow key={product.SEQPRODUTO} className={pending.length ? "bg-amber-50/70" : ""}><TableCell className="text-xs font-black text-[#173D6E]"><span>{product.SEQPRODUTO} · {product.DESCRICAO}</span>{pending.length > 0 && <div className="mt-1 space-y-0.5">{pending.map((item) => <p key={item} className="max-w-72 text-[10px] font-bold leading-4 text-amber-800">{item}</p>)}</div>}</TableCell><TableCell className={`text-xs font-bold ${!product.MAT_PRIMA && pending.length ? "text-amber-800" : ""}`}>{product.MAT_PRIMA || "Não cadastrada"}</TableCell><TableCell className={`text-xs font-bold ${Number(product.META_PRODUTO || 0) <= 0 && pending.length ? "text-amber-800" : ""}`}>{product.META_PRODUTO == null ? "—" : `${decimal.format(product.META_PRODUTO)}%`}</TableCell><TableCell className="text-xs font-black text-[#173D6E]">{formatKg(product.PESOCONTRATO)}</TableCell><TableCell className="text-xs font-black text-emerald-700">{formatKg(product.PESO_ATRELADO_TOTAL)}</TableCell><TableCell className="text-xs font-black text-orange-700">{formatKg(product.FALTANTE_PRODUZIR)}</TableCell><TableCell className="text-xs font-bold">{formatKg(product.PRODUCAO_DIA)}</TableCell><TableCell className="text-xs font-black">{product.DIAS_PRODUCAO ?? "—"}</TableCell><TableCell className="text-xs">{product.ESPERA_DIAS ?? "—"} dias</TableCell><TableCell className="text-xs font-black text-orange-700">{formatKg(product.EXCESSO_PROJETADO)}</TableCell></TableRow>; })}</TableBody></Table></div>;
}

function Timeline({ planning }: { planning: PcpPlanning }) {
  const recommendations = planning?.RECOMENDACOES || [];
  const projections = useMemo(() => planning?.PROJECAO_ESTOQUE || [], [planning?.PROJECAO_ESTOQUE]);
  const dates = useMemo(() => {
    if (projections.length) return projections.slice(0, 21).map((item) => new Date(`${item.DATA.slice(0, 10)}T12:00:00`));
    return Array.from({ length: 21 }, (_, index) => { const value = new Date(); value.setHours(12, 0, 0, 0); value.setDate(value.getDate() + index); return value; });
  }, [projections]);
  const projectionByDate = useMemo(() => new Map(projections.map((item) => [item.DATA.slice(0, 10), item])), [projections]);
  const [selected, setSelected] = useState<PcpRecommendation | null>(null);
  const [selectedStock, setSelectedStock] = useState<{ projection: PcpStockProjection; type: "CONGELADO" | "RESFRIADO" } | null>(null);
  if (!recommendations.length) return <EmptyConfiguration />;
  return <>
    <Card className="border-[#CEDAE5] shadow-sm"><CardContent className="p-0">
      <div className="border-b p-4"><h2 className="flex items-center gap-2 text-base font-black text-[#173D6E]"><CalendarRange className="h-5 w-5" />Linha do tempo produtiva e estoque</h2><p className="text-xs text-[#6A7E91]">A projeção soma a entrada exportável da desossa e desconta o peso dos contratos na data planejada de embarque.</p><div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[10px] font-bold text-[#536B82]"><TimelineLegend color="bg-[#315F88]" label="Produção programada" /><TimelineLegend color="bg-orange-400" label="Alerta de estoque" /><TimelineLegend color="bg-red-500" label="Limite ou contrato crítico" /><TimelineLegend color="bg-emerald-500" label="Estoque normal" /></div></div>
      <div className="overflow-x-auto p-4"><div className="min-w-[1180px]"><div className="grid grid-cols-[240px_repeat(21,minmax(42px,1fr))] border-b"><div className="p-2 text-[10px] font-black uppercase">Contrato / estoque</div>{dates.map((date) => <div key={date.toISOString()} className="border-l p-2 text-center text-[10px] font-black">{shortDate.format(date)}</div>)}</div>{recommendations.slice(0, 12).map((item) => { const start = item.INICIO_SEQUENCIA ? new Date(`${item.INICIO_SEQUENCIA}T12:00:00`) : null; const end = item.FIM_SEQUENCIA ? new Date(`${item.FIM_SEQUENCIA}T12:00:00`) : null; const visual = timelineVisual(item); return <div key={item.SEQCONTRATO} className="grid grid-cols-[240px_repeat(21,minmax(42px,1fr))] border-b"><button type="button" onClick={() => setSelected(item)} className="p-2 text-left hover:bg-[#EDF3F7] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#315F88]"><p className="text-xs font-black text-[#173D6E]">{item.NROCONTRATO}</p><p className="truncate text-[10px] text-[#6A7E91]">{item.CLIENTE}</p></button>{dates.map((date) => { const active = Boolean(start && end && date >= start && date <= end); return <div key={date.toISOString()} className="flex items-center border-l px-0.5">{active && <button type="button" onClick={() => setSelected(item)} className={`h-7 w-full rounded-sm ${visual.barClass} transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-[#173D6E] focus:ring-offset-1`} title={`${visual.label}: clique para ver o motivo`} aria-label={`${item.NROCONTRATO}, ${visual.label}, ${shortDate.format(date)}`} />}</div>; })}</div>; })}{(["CONGELADO", "RESFRIADO"] as const).map((type) => <div key={type} className="grid grid-cols-[240px_repeat(21,minmax(42px,1fr))] border-b bg-[#F8FAFC]"><div className="flex items-center gap-2 p-2 text-xs font-black text-[#173D6E]"><Warehouse className="h-4 w-4" />Estoque {type.toLowerCase()}</div>{dates.map((date) => { const projection = projectionByDate.get(date.toISOString().slice(0, 10)); if (!projection) return <div key={date.toISOString()} className="border-l" />; const stock = stockProjectionData(projection, type); return <div key={date.toISOString()} className="flex items-center border-l p-0.5"><button type="button" onClick={() => setSelectedStock({ projection, type })} className={`h-8 w-full rounded-sm text-[9px] font-black ${stockCellClass(stock.situation)}`} title={`${formatKg(stock.balance)} · ${decimal.format(stock.percent)}%`}>{Math.round(stock.percent)}%</button></div>; })}</div>)}</div></div>
    </CardContent></Card>
    <DailyStockMovement projections={projections.slice(0, 21)} />
    <TimelineReasonDialog recommendation={selected} onClose={() => setSelected(null)} />
    <StockProjectionDialog selection={selectedStock} onClose={() => setSelectedStock(null)} />
  </>;
}

function DailyStockMovement({ projections }: { projections: PcpStockProjection[] }) {
  return <Card className="mt-4 border-[#CEDAE5] shadow-sm"><CardContent className="p-0">
    <div className="border-b border-[#DCE5ED] p-4">
      <h3 className="text-sm font-black text-[#173D6E]">Memória diária da projeção</h3>
      <p className="mt-1 text-xs text-[#6A7E91]">Mostra exatamente por que o estoque aumentou, permaneceu igual ou diminuiu.</p>
    </div>
    <div className="max-h-[420px] overflow-auto">
      <Table className="min-w-[1050px]">
        <TableHeader className="sticky top-0 bg-[#EDF3F7]"><TableRow><Head>Data</Head><Head>Produção</Head><Head>Entrada congelado</Head><Head>Entrada resfriado</Head><Head>Saída prevista</Head><Head>Saldo congelado</Head><Head>Saldo resfriado</Head><Head>Regra aplicada</Head></TableRow></TableHeader>
        <TableBody>{projections.map((item) => <TableRow key={item.DATA}>
          <TableCell className="whitespace-nowrap text-xs font-black">{formatDate(item.DATA)}</TableCell>
          <TableCell className="text-xs font-bold">{item.CONTRATO_PRODUCAO || "Sem produção"}</TableCell>
          <TableCell className="text-xs font-black text-emerald-700">+ {formatKg(item.ENTRADA_CONGELADO_KG)}</TableCell>
          <TableCell className="text-xs font-black text-emerald-700">+ {formatKg(item.ENTRADA_RESFRIADO_KG)}</TableCell>
          <TableCell className="text-xs font-black text-red-700">- {formatKg(item.SAIDA_CONGELADO_KG + item.SAIDA_RESFRIADO_KG)}</TableCell>
          <TableCell className="text-xs font-black text-[#173D6E]">{formatKg(item.SALDO_CONGELADO_KG)}</TableCell>
          <TableCell className="text-xs font-black text-[#173D6E]">{formatKg(item.SALDO_RESFRIADO_KG)}</TableCell>
          <TableCell className="max-w-[360px] text-xs leading-5 text-[#536B82]">{item.MOTIVO_ENTRADA || "Regra não informada."}{item.CONTRATOS_EXPEDIDOS.length ? ` Saída dos contratos: ${item.CONTRATOS_EXPEDIDOS.join(", ")}.` : ""}</TableCell>
        </TableRow>)}</TableBody>
      </Table>
    </div>
  </CardContent></Card>;
}

function timelineVisual(recommendation: PcpRecommendation) {
  if (recommendation.DECISAO === "AGUARDAR_ESTOQUE") {
    return {
      label: "Laranja: aguardar produto gargalo",
      barClass: "bg-orange-400",
      panelClass: "border-orange-200 bg-orange-50 text-orange-900",
      reason: `Não iniciar agora. Aguarde ${recommendation.ESTOQUE_GATILHO_PRODUTO || "o produto gargalo"} atingir ${formatKg(recommendation.ESTOQUE_GATILHO_KG)} para reduzir o estoque parado dos demais produtos.`,
    };
  }
  if (recommendation.DECISAO === "CRITICO" || recommendation.ESTOQUE_PROJETADO_SITUACAO === "LIMITE") {
    return {
      label: "Vermelho: atenção imediata",
      barClass: "bg-red-500",
      panelClass: "border-red-200 bg-red-50 text-red-900",
      reason: recommendation.DECISAO === "CRITICO"
        ? `A conclusão projetada ultrapassa a entrega em ${recommendation.ATRASO_DIAS || 0} dia(s).`
        : "A produção continua prioritária, mas exige venda, expedição ou reordenação antes do pico de ocupação do estoque.",
    };
  }
  if (recommendation.ESTOQUE_PROJETADO_SITUACAO === "ALERTA" || Number(recommendation.EXCESSO_PROJETADO || 0) > 0) {
    return {
      label: "Laranja: excesso projetado",
      barClass: "bg-orange-400",
      panelClass: "border-orange-200 bg-orange-50 text-orange-900",
      reason: recommendation.ESTOQUE_PROJETADO_SITUACAO === "ALERTA"
        ? `O estoque ${String(recommendation.ESTOQUE_PROJETADO_TIPO || "").toLowerCase()} chega a ${decimal.format(recommendation.ESTOQUE_PROJETADO_PCT || 0)}% durante esta produção, já considerando as saídas planejadas.`
        : `A programação gera ${formatKg(recommendation.EXCESSO_PROJETADO)} de estoque antecipado enquanto outros produtos do contrato ainda são concluídos.`,
    };
  }
  return {
    label: "Azul: produção programada",
    barClass: "bg-[#315F88]",
    panelClass: "border-blue-200 bg-blue-50 text-blue-900",
    reason: "O contrato está programado dentro da sequência sem atraso ou excesso crítico projetado.",
  };
}

function stockProjectionData(projection: PcpStockProjection, type: "CONGELADO" | "RESFRIADO") {
  if (type === "CONGELADO") return {
    previous: projection.SALDO_ANTERIOR_CONGELADO_KG,
    input: projection.ENTRADA_CONGELADO_KG,
    output: projection.SAIDA_CONGELADO_KG,
    balance: projection.SALDO_CONGELADO_KG,
    percent: projection.PERCENTUAL_CONGELADO,
    situation: projection.SITUACAO_CONGELADO,
  };
  return {
    previous: projection.SALDO_ANTERIOR_RESFRIADO_KG,
    input: projection.ENTRADA_RESFRIADO_KG,
    output: projection.SAIDA_RESFRIADO_KG,
    balance: projection.SALDO_RESFRIADO_KG,
    percent: projection.PERCENTUAL_RESFRIADO,
    situation: projection.SITUACAO_RESFRIADO,
  };
}

function stockProjectionContracts(projection: PcpStockProjection, type: "CONGELADO" | "RESFRIADO") {
  return type === "CONGELADO"
    ? projection.CONTRATOS_EXPEDIDOS_CONGELADO || []
    : projection.CONTRATOS_EXPEDIDOS_RESFRIADO || [];
}

function stockCellClass(situation: "NORMAL" | "ALERTA" | "LIMITE") {
  if (situation === "LIMITE") return "bg-red-500 text-white hover:bg-red-600";
  if (situation === "ALERTA") return "bg-orange-400 text-orange-950 hover:bg-orange-500";
  return "bg-emerald-100 text-emerald-800 hover:bg-emerald-200";
}

function StockProjectionDialog({ selection, onClose }: { selection: { projection: PcpStockProjection; type: "CONGELADO" | "RESFRIADO" } | null; onClose: () => void }) {
  if (!selection) return null;
  const { projection, type } = selection;
  const stock = stockProjectionData(projection, type);
  const contracts = stockProjectionContracts(projection, type);
  const reason = stock.situation === "LIMITE"
    ? "O saldo projetado alcança ou ultrapassa a capacidade máxima configurada."
    : stock.situation === "ALERTA"
      ? "O saldo projetado entrou na faixa de alerta configurada."
      : "O saldo permanece abaixo da faixa de alerta após entradas e saídas do dia.";
  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}><DialogContent className="max-w-xl border-[#C5D4E1]"><DialogHeader><DialogTitle className="text-[#173D6E]">Estoque {type.toLowerCase()} em {formatDate(projection.DATA)}</DialogTitle><DialogDescription>{reason}</DialogDescription></DialogHeader><div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><DecisionMetric label="Saldo anterior" value={formatKg(stock.previous)} /><DecisionMetric label="Entrada do dia" value={formatKg(stock.input)} /><DecisionMetric label="Saída prevista" value={formatKg(stock.output)} /><DecisionMetric label="Saldo projetado" value={formatKg(stock.balance)} /></div><div className={`rounded-lg border p-4 ${stock.situation === "LIMITE" ? "border-red-200 bg-red-50" : stock.situation === "ALERTA" ? "border-orange-200 bg-orange-50" : "border-emerald-200 bg-emerald-50"}`}><p className="text-xs font-black uppercase text-[#536B82]">{decimal.format(stock.percent)}% da capacidade</p><p className="mt-2 text-sm font-bold text-[#244B70]">Produção: {projection.CONTRATO_PRODUCAO || "sem contrato programado"}</p><p className="mt-1 text-xs text-[#536B82]">Expedições de {type.toLowerCase()}: {contracts.length ? contracts.join(", ") : "nenhuma saída planejada"}</p></div></DialogContent></Dialog>;
}

function TimelineReasonDialog({ recommendation, onClose }: { recommendation: PcpRecommendation | null; onClose: () => void }) {
  if (!recommendation) return null;
  const visual = timelineVisual(recommendation);
  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}><DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto border-[#C5D4E1]"><DialogHeader><DialogTitle className="text-[#173D6E]">Contrato {recommendation.NROCONTRATO} na linha do tempo</DialogTitle><DialogDescription>{recommendation.CLIENTE}</DialogDescription></DialogHeader><div className="space-y-4"><div className={`rounded-lg border p-4 ${visual.panelClass}`}><p className="text-[10px] font-black uppercase tracking-wider">Motivo da cor</p><p className="mt-1 text-base font-black">{visual.label}</p><p className="mt-2 text-sm font-semibold leading-6">{visual.reason}</p></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><DecisionMetric label="Início previsto" value={formatDate(recommendation.INICIO_SEQUENCIA)} /><DecisionMetric label="Conclusão" value={formatDate(recommendation.FIM_SEQUENCIA)} /><DecisionMetric label="Cobertura" value={`${decimal.format(recommendation.COBERTURA_PCT)}%`} /><DecisionMetric label="Falta produzir" value={formatKg(recommendation.FALTANTE_PRODUZIR)} /></div><div className="rounded-lg border border-[#D6E1EA] bg-[#F7F9FB] p-4"><p className="text-[10px] font-black uppercase tracking-wider text-[#5D748A]">Decisão operacional</p><p className="mt-2 text-sm font-bold leading-6 text-[#244B70]">{recommendation.MOTIVO}</p><p className="mt-2 text-xs leading-5 text-[#536B82]">{decisionImpact[recommendation.DECISAO]}</p></div>{recommendation.ALERTAS.length > 0 && <div className="rounded-lg border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-black uppercase text-amber-900">Dados que influenciaram</p><ul className="mt-2 space-y-1">{recommendation.ALERTAS.map((alert) => <li key={alert} className="text-xs font-semibold text-amber-900">• {alert}</li>)}</ul></div>}</div></DialogContent></Dialog>;
}

function TimelineLegend({ color, label, bordered = false }: { color: string; label: string; bordered?: boolean }) { return <span className="flex items-center gap-2"><span className={`h-3 w-6 rounded-sm ${color} ${bordered ? "border border-[#B9CAD8]" : ""}`} />{label}</span>; }

function Configuration({ data, reload }: { data: ContractsPanelResponse; reload: () => Promise<void> }) {
  const [form, setForm] = useState<PcpConfig>(data.pcp_config); const [saving, setSaving] = useState(false);
  useEffect(() => setForm(data.pcp_config), [data.pcp_config]);
  const setNumber = (field: keyof PcpConfig, value: string) => setForm((current) => ({ ...current, [field]: Number(value.replace(",", ".")) || 0 }));
  const gross = form.ARROBA_MEDIA * form.QTD_ANIMAIS_DIA * 15; const net = gross * (1 - form.QUEBRA_FRIO_PCT / 100);
  const exportable = net * ((form.PCT_TRASEIRO + form.PCT_DIANTEIRO + form.PCT_PONTA_AGULHA) / 100) * (form.PCT_EXPORTACAO / 100);
  const productionMixTotal = form.PCT_PRODUCAO_CONGELADO + form.PCT_PRODUCAO_RESFRIADO;
  const save = async () => {
    if (Math.abs(productionMixTotal - 100) > 0.01) {
      toast.warning(`O mix de produção deve totalizar 100%. Total atual: ${decimal.format(productionMixTotal)}%.`);
      return;
    }
    setSaving(true);
    try { const result = await contractsApi.savePcpConfig(form); toast.success(result.message); await reload(); }
    catch (error) { toast.error(errorMessage(error)); }
    finally { setSaving(false); }
  };
  return <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
    <Card className="border-[#CEDAE5] shadow-sm"><CardContent className="p-5">
      <h2 className="flex items-center gap-2 text-base font-black text-[#173D6E]"><Settings2 className="h-5 w-5" />Configuração da desossa</h2>
      <p className="mt-1 text-xs text-[#6A7E91]">Parâmetros versionados usados nas projeções.</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="@ médio" value={form.ARROBA_MEDIA} onChange={(v) => setNumber("ARROBA_MEDIA", v)} />
        <Field label="Animais por dia" value={form.QTD_ANIMAIS_DIA} onChange={(v) => setNumber("QTD_ANIMAIS_DIA", v)} />
        <Field label="Quebra de frio (%)" value={form.QUEBRA_FRIO_PCT} onChange={(v) => setNumber("QUEBRA_FRIO_PCT", v)} />
        <Field label="Exportação (%)" value={form.PCT_EXPORTACAO} onChange={(v) => setNumber("PCT_EXPORTACAO", v)} />
      </div>
      <SubTitle>Quarteio</SubTitle>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Traseiro (%)" value={form.PCT_TRASEIRO} onChange={(v) => setNumber("PCT_TRASEIRO", v)} />
        <Field label="Dianteiro (%)" value={form.PCT_DIANTEIRO} onChange={(v) => setNumber("PCT_DIANTEIRO", v)} />
        <Field label="Ponta de agulha (%)" value={form.PCT_PONTA_AGULHA} onChange={(v) => setNumber("PCT_PONTA_AGULHA", v)} />
      </div>
      <SubTitle>Mix da produção exportável</SubTitle>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Produção congelada (%)" value={form.PCT_PRODUCAO_CONGELADO} onChange={(v) => setNumber("PCT_PRODUCAO_CONGELADO", v)} />
        <Field label="Produção resfriada (%)" value={form.PCT_PRODUCAO_RESFRIADO} onChange={(v) => setNumber("PCT_PRODUCAO_RESFRIADO", v)} />
      </div>
      <p className={`mt-2 text-xs font-bold ${Math.abs(productionMixTotal - 100) <= 0.01 ? "text-emerald-700" : "text-red-700"}`}>Total do mix: {decimal.format(productionMixTotal)}%</p>
      <SubTitle>Capacidade de estoque</SubTitle>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Alerta congelado" value={form.ALERTA_CONGELADO_KG} onChange={(v) => setNumber("ALERTA_CONGELADO_KG", v)} />
        <Field label="Limite congelado" value={form.LIMITE_CONGELADO_KG} onChange={(v) => setNumber("LIMITE_CONGELADO_KG", v)} />
        <Field label="Alerta resfriado" value={form.ALERTA_RESFRIADO_KG} onChange={(v) => setNumber("ALERTA_RESFRIADO_KG", v)} />
        <Field label="Limite resfriado" value={form.LIMITE_RESFRIADO_KG} onChange={(v) => setNumber("LIMITE_RESFRIADO_KG", v)} />
      </div>
      <div className="mt-6 flex justify-end"><Button onClick={() => void save()} disabled={saving || !data.pcp_estrutura_configurada} className="bg-[#173D6E]"><Save className="mr-2 h-4 w-4" />{saving ? "Salvando..." : "Salvar configuração"}</Button></div>
    </CardContent></Card>
    <Card className="border-[#B8CCDC] bg-[#F8FAFC] shadow-sm"><CardContent className="p-5">
      <h3 className="text-sm font-black text-[#173D6E]">Prévia da entrada diária</h3>
      <p className="text-xs text-[#6A7E91]">A projeção exportável exclui miúdos e já considera a quebra de frio.</p>
      <div className="mt-5 space-y-3">
        <Preview label="Peso bruto" value={gross} />
        <Preview label="Peso livre de quebra" value={net} />
        <Preview label="Traseiro" value={net * form.PCT_TRASEIRO / 100} />
        <Preview label="Dianteiro" value={net * form.PCT_DIANTEIRO / 100} />
        <Preview label="Ponta de agulha" value={net * form.PCT_PONTA_AGULHA / 100} />
        <Preview label="Entrada exportável/dia" value={exportable} />
        <Preview label="Entrada congelada/dia" value={exportable * form.PCT_PRODUCAO_CONGELADO / 100} />
        <Preview label="Entrada resfriada/dia" value={exportable * form.PCT_PRODUCAO_RESFRIADO / 100} />
        <Preview label="Base de miúdos" value={gross} />
      </div>
    </CardContent></Card>
  </div>;
}

function SpreadsheetImport({ configured, reload }: { configured: boolean; reload: () => Promise<void> }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<SpreadsheetImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const analyze = async () => {
    if (!file) return toast.warning("Selecione a planilha XLSB.");
    setLoading(true);
    try {
      setPreview(await contractsApi.importSpreadsheet(file));
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const apply = async () => {
    if (!file) return;
    setLoading(true);
    try {
      setPreview(await contractsApi.importSpreadsheet(file, true));
      setConfirm(false);
      toast.success("Planilha aplicada e estoque complementar atualizado.");
      await reload();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return <div className="space-y-4">
    <Card className="border-[#CEDAE5] shadow-sm"><CardContent className="p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-base font-black text-[#173D6E]"><FileSpreadsheet className="h-5 w-5" />Importar alocações da planilha</h2>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-[#6A7E91]">O peso da planilha representa o total desejado no contrato. O sistema preserva o peso já vinculado por ordem de produção e reserva no estoque somente a diferença necessária.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="flex h-10 cursor-pointer items-center rounded-md border bg-white px-3 text-xs font-black text-[#244B70]"><Upload className="mr-2 h-4 w-4" />{file?.name || "Selecionar .xlsb"}<input type="file" accept=".xlsb" className="hidden" onChange={(event) => { setFile(event.target.files?.[0] || null); setPreview(null); }} /></label>
          <Button onClick={() => void analyze()} disabled={!file || loading || !configured} className="bg-[#173D6E]">{loading ? "Analisando..." : "Gerar prévia"}</Button>
        </div>
      </div>
    </CardContent></Card>

    {preview && <>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Ajustes aplicáveis" value={String(preview.RESUMO.RESERVAS_APLICAVEIS)} icon={PackageCheck} />
        <Metric label="Reserva complementar" value={formatKg(preview.RESUMO.PESO_APLICAVEL)} icon={Warehouse} />
        <Metric label="Datas a atualizar" value={String(preview.RESUMO.DATAS_APLICAVEIS)} icon={CalendarRange} />
        <Metric label="Ignorados" value={String(preview.RESUMO.IGNORADOS)} icon={AlertTriangle} tone="orange" />
      </section>
      <Card className="border-[#CEDAE5] shadow-sm"><CardContent className="p-0">
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
          <div><h3 className="text-sm font-black text-[#173D6E]">Prévia da importação</h3><p className="text-xs leading-5 text-[#6A7E91]">Cálculo: total da planilha menos peso protegido por OP. O complemento final é limitado pelo saldo do contrato e pelo estoque livre.</p></div>
          <Button disabled={!preview.RESUMO.RESERVAS_APLICAVEIS || preview.aplicado} onClick={() => setConfirm(true)} className="bg-emerald-700"><CheckCircle2 className="mr-2 h-4 w-4" />{preview.aplicado ? "Aplicado" : "Aplicar ajustes"}</Button>
        </div>
        <div className="max-h-[520px] overflow-auto"><Table className="min-w-[1160px]"><TableHeader className="sticky top-0 bg-[#EDF3F7]"><TableRow><Head>Linha</Head><Head>Contrato</Head><Head>Produto</Head><Head>Planilha</Head><Head>OP protegida</Head><Head>Complemento necessário</Head><Head>Reserva final</Head><Head>Situação</Head><Head>Observação</Head></TableRow></TableHeader><TableBody>{preview.ITENS.map((item) => <TableRow key={`${item.LINHA}-${item.NROCONTRATO}-${item.SEQPRODUTO}`}><TableCell className="text-xs">{item.LINHA}</TableCell><TableCell className="text-xs font-black">{item.NROCONTRATO}</TableCell><TableCell className="text-xs font-bold">{item.SEQPRODUTO} · {item.DESCRICAO || "Produto"}</TableCell><TableCell className="text-xs font-bold">{formatKg(item.PESO_ESTOQUE_PLANILHA)}</TableCell><TableCell className="text-xs text-blue-700">{formatKg(item.PESO_ORDEM_PRODUCAO)}</TableCell><TableCell className="text-xs text-amber-700">{formatKg(item.PESO_COMPLEMENTO_NECESSARIO)}</TableCell><TableCell className="text-xs font-black text-emerald-700">{formatKg(item.PESO_APLICADO)}</TableCell><TableCell className="text-[10px] font-black">{item.SITUACAO.replaceAll("_", " ")}</TableCell><TableCell className="text-xs">{item.MENSAGEM}</TableCell></TableRow>)}</TableBody></Table></div>
      </CardContent></Card>
    </>}

    <Dialog open={confirm} onOpenChange={setConfirm}><DialogContent><DialogHeader><DialogTitle>Aplicar a distribuição da planilha?</DialogTitle><DialogDescription>O sistema manterá os pesos protegidos por ordem de produção e ajustará somente a reserva complementar para atingir o total informado na planilha, respeitando o estoque livre. Reservas anteriores originadas por planilha serão reconciliadas com esta nova importação.</DialogDescription></DialogHeader><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setConfirm(false)}>Cancelar</Button><Button className="bg-emerald-700" disabled={loading} onClick={() => void apply()}>{loading ? "Aplicando..." : "Confirmar aplicação"}</Button></div></DialogContent></Dialog>
  </div>;
}

function ContractsManual() {
  return <div className="space-y-4">
    <Card className="overflow-hidden border-[#B8CCDC] shadow-sm">
      <div className="bg-[#173D6E] p-6 text-white"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-100">Ajuda operacional</p><h2 className="mt-1 text-2xl font-black">Manual de Contratos e Alocação</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-blue-100">Fluxo para consultar contratos e distribuir o estoque livre de exportação com segurança.</p></div>
    </Card>
    <div className="grid gap-4 xl:grid-cols-2">
      <ManualSection title="Rotina recomendada" items={["Sincronize o ERP antes de iniciar a distribuição.", "Abra Alocação de estoque e localize o produto pelo código ou descrição.", "Confira o estoque livre, os contratos que utilizam o produto e suas datas de embarque.", "Informe o novo total manual no contrato escolhido e confirme em Salvar.", "Volte à aba Contratos para revisar cobertura, saldo, prioridade e embarque."]} />
      <ManualSection title="Como o estoque livre é calculado" items={["O painel considera somente produtos de mercado ME.", "Estoque livre = estoque disponível no ERP menos ordens de produção protegidas e menos alocações manuais.", "Uma ordem de produção nunca pode ser reduzida ou transferida por esta tela.", "Uma alocação manual pode ser ajustada; informe zero para liberá-la.", "O sistema impede alocação acima do estoque livre ou acima do saldo permitido no contrato."]} />
      <ManualSection title="Aba Contratos" items={["A aba é consultiva para pesos e permite administrar prioridade, embarque, status e observação.", "Expanda um contrato para consultar seus produtos, o peso contratado, o total alocado e o saldo.", "Clique no valor alocado para consultar a composição detalhada do peso.", "Use Desconsiderar quando o contrato não deve participar da operação, informando uma observação quando necessário."]} />
      <ManualSection title="Origem dos pesos" items={["Ordem de produção: vínculo automático do ERP, protegido contra realocação.", "Manual: peso distribuído pelo operador na aba Alocação de estoque.", "Expedição: quando o carregamento começa, o peso expedido passa a ser a referência de cobertura.", "A origem detalhada só aparece ao clicar no total alocado, mantendo as tabelas principais limpas."]} />
      <ManualSection title="Configuração da desossa" items={["Peso bruto = @ médio x animais por dia x 15.", "A quebra de frio é retirada antes do quarteio.", "Traseiro, dianteiro e ponta de agulha seguem os percentuais configurados.", "A entrada exportável é separada pelo mix congelado e resfriado.", "Esses parâmetros alimentam as projeções exibidas em Sugestões e Calendário de ocupação."]} />
      <ManualSection title="Recursos em validação" items={["Sugestões e Calendário de ocupação estão disponíveis em modo de consulta, com aviso de manutenção e validação em produção.", "A decisão operacional deve considerar prioridade, data de embarque, saldo do contrato e estoque livre.", "Confirme as projeções antes de executar uma decisão enquanto esses painéis estiverem em revisão."]} />
    </div>
  </div>;
}

function ManualSection({ title, items }: { title: string; items: string[] }) {
  return <Card className="border-[#CEDAE5] shadow-sm"><CardContent className="p-5"><h3 className="text-base font-black text-[#173D6E]">{title}</h3><div className="mt-4 space-y-2">{items.map((item, index) => <div key={item} className="flex gap-3 rounded-md border border-[#E0E8EF] bg-[#F8FAFC] p-3"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#DCEAF5] text-[10px] font-black text-[#173D6E]">{index + 1}</span><p className="text-xs font-semibold leading-5 text-[#4D667D]">{item}</p></div>)}</div></CardContent></Card>;
}

function EmptyConfiguration() { return <div className="rounded-xl border border-amber-300 bg-amber-50 p-6"><div className="flex gap-3"><Settings2 className="h-5 w-5 text-amber-800" /><div><h2 className="font-black text-amber-900">Configure a origem produtiva</h2><p className="mt-1 text-sm text-amber-800">Informe @ médio, animais, quebra e quarteio na Configuração da desossa.</p></div></div></div>; }
function Metric({ label, value, icon: Icon, tone = "blue" }: { label: string; value: string; icon: typeof Factory; tone?: "blue" | "red" | "orange" }) { const color = tone === "red" ? "text-red-700" : tone === "orange" ? "text-orange-700" : "text-[#173D6E]"; return <div className="rounded-lg border bg-white p-4 shadow-sm"><div className="flex items-center gap-2 text-[#61778C]"><Icon className="h-4 w-4" /><span className="text-[10px] font-black uppercase tracking-wider">{label}</span></div><p className={`mt-2 whitespace-nowrap text-xl font-black ${color}`}>{value}</p></div>; }
function Fact({ label, value }: { label: string; value: string }) { return <div><p className="text-[9px] font-black uppercase tracking-wider text-[#708497]">{label}</p><p className="mt-1 text-sm font-black text-[#173D6E]">{value}</p></div>; }
function Field({ label, value, onChange }: { label: string; value: number; onChange: (value: string) => void }) { return <label className="space-y-1.5"><span className="text-[10px] font-black uppercase tracking-wider text-[#536B82]">{label}</span><Input type="number" min="0" step="0.01" value={value} onChange={(e) => onChange(e.target.value)} className="font-bold text-[#173D6E]" /></label>; }
function SubTitle({ children }: { children: React.ReactNode }) { return <h3 className="mb-3 mt-6 text-xs font-black uppercase tracking-wider text-[#47627D]">{children}</h3>; }
function Preview({ label, value }: { label: string; value: number }) { return <div className="flex justify-between rounded-lg border bg-white p-3"><span className="text-xs font-bold text-[#536B82]">{label}</span><span className="text-sm font-black text-[#173D6E]">{formatKg(value)}</span></div>; }
function Head({ children }: { children?: React.ReactNode }) { return <TableHead className="whitespace-nowrap text-[10px] font-black uppercase tracking-wider text-[#47627D]">{children}</TableHead>; }
