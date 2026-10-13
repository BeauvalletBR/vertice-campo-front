import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Boxes,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ChevronsDown,
  ChevronsUp,
  Factory,
  FileSignature,
  LockKeyhole,
  RefreshCw,
  Search,
  Weight,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  type ContractProduct,
  type ContractsPanelResponse,
  type ExportContract,
  contractsApi,
} from "@/services/contracts";

const kgFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 3,
});
const dateFormatter = new Intl.DateTimeFormat("pt-BR");

const formatKg = (value: number | null | undefined) =>
  `${kgFormatter.format(Number(value || 0))} kg`;

const formatDate = (value: string | null | undefined) => {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : dateFormatter.format(parsed);
};

const inputDate = (value: string | null | undefined) =>
  value ? String(value).slice(0, 10) : "";

const suggestedReservationWeight = (product: ContractProduct) => {
  const contractWeight = Math.max(0, Number(product.PESOCONTRATO || 0));
  const availableWeight = Math.max(0, Number(product.LIMITE_RESERVA || 0));
  return Math.round(Math.min(contractWeight, availableWeight) * 1000) / 1000;
};

const reservationCoverageClass = (product: ContractProduct) => {
  const contractWeight = Number(product.PESOCONTRATO || 0);
  const reservedWeight = Number(product.PESO_RESERVADO_CONTRATO || 0);
  if (contractWeight <= 0) return "bg-white";
  if (reservedWeight >= contractWeight) return "bg-emerald-50/80 hover:bg-emerald-100/70";
  if (reservedWeight / contractWeight >= 0.5) return "bg-orange-50/80 hover:bg-orange-100/70";
  return "bg-white";
};

const normalizeSearch = (value: unknown) =>
  String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Não foi possível concluir a operação.";

const priorityClass: Record<string, string> = {
  BAIXA: "border-slate-300 bg-slate-100 text-slate-700",
  MEDIA: "border-amber-300 bg-amber-50 text-amber-800",
  ALTA: "border-orange-300 bg-orange-50 text-orange-800",
  URGENTE: "border-red-300 bg-red-50 text-red-700",
};

export default function Contratos() {
  const [data, setData] = useState<ContractsPanelResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncingStock, setSyncingStock] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState("");
  const [country, setCountry] = useState("TODOS");
  const [stockSearch, setStockSearch] = useState("");
  const [onlySurplus, setOnlySurplus] = useState(true);
  const [reservationInputs, setReservationInputs] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<number, string>>({});

  const loadPanel = async (silent = false, refreshStock = false) => {
    if (!silent) setLoading(true);
    try {
      setData(await contractsApi.getPanel(refreshStock));
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    void loadPanel();
  }, []);

  const syncStock = async () => {
    setSyncingStock(true);
    try {
      setData(await contractsApi.getPanel(true));
      toast.success("Estoque e ordens de produção sincronizados.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSyncingStock(false);
    }
  };

  const countries = Array.from(
    new Set((data?.contratos || []).map((item) => item.PAISDESTINO).filter(Boolean)),
  ).sort((a, b) => String(a).localeCompare(String(b), "pt-BR"));

  const contractSearchTerm = normalizeSearch(search);
  const contracts = (data?.contratos || []).filter((contract) => {
    const productMatches = contract.PRODUTOS.some(
      (product) =>
        String(product.SEQPRODUTO).includes(contractSearchTerm) ||
        normalizeSearch(product.DESCRICAO).includes(contractSearchTerm),
    );
    const matchesSearch =
      !contractSearchTerm ||
      normalizeSearch(contract.NROCONTRATO).includes(contractSearchTerm) ||
      normalizeSearch(contract.NOMERAZAO).includes(contractSearchTerm) ||
      normalizeSearch(contract.PAISDESTINO).includes(contractSearchTerm) ||
      productMatches;
    return matchesSearch && (country === "TODOS" || contract.PAISDESTINO === country);
  });

  const stock = (data?.estoque || []).filter((item) => {
    const term = normalizeSearch(stockSearch);
    const matchesSearch =
      !term ||
      String(item.SEQPRODUTO).includes(term) ||
      normalizeSearch(item.DESCRPRODUTO).includes(term);
    return matchesSearch && (!onlySurplus || Number(item.ESTOQUE_SEM_VENDA) > 0);
  });

  const totalContracted = contracts.reduce((sum, item) => sum + Number(item.PESO_TOTAL || 0), 0);
  const totalReserved = contracts.reduce((sum, item) => sum + Number(item.PESO_RESERVADO || 0), 0);
  const totalStock = (data?.estoque || []).reduce((sum, item) => sum + Number(item.PESO_LIVRE_VERTICE || 0), 0);
  const totalSurplus = (data?.estoque || []).reduce((sum, item) => sum + Math.max(0, Number(item.ESTOQUE_SEM_VENDA || 0)), 0);

  const toggleExpanded = (contractId: number) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(contractId)) next.delete(contractId);
      else next.add(contractId);
      return next;
    });
  };

  const allVisibleExpanded =
    contracts.length > 0 &&
    contracts.every((contract) => expanded.has(contract.SEQCONTRATO));

  const toggleAllExpanded = () => {
    setExpanded((current) => {
      const next = new Set(current);
      contracts.forEach((contract) => {
        if (allVisibleExpanded) next.delete(contract.SEQCONTRATO);
        else next.add(contract.SEQCONTRATO);
      });
      return next;
    });
  };

  const saveConfig = async (contract: ExportContract, changes: Partial<ExportContract>) => {
    if (!data?.estrutura_configurada) {
      toast.warning("Execute a migração do módulo de contratos antes de salvar.");
      return;
    }
    const key = `config-${contract.SEQCONTRATO}`;
    setSaving(key);
    try {
      const next = { ...contract, ...changes };
      const result = await contractsApi.saveConfig({
        seqcontrato: contract.SEQCONTRATO,
        prioridade: next.PRIORIDADE,
        dta_embarque_planejada: inputDate(next.DTA_EMBARQUE_PLANEJADA) || null,
        status_operacional: next.STATUS_OPERACIONAL,
        observacao: next.OBSERVACAO || null,
        versao: contract.VERSAO_CONFIG ?? null,
      });
      toast.success(result.message);
      await loadPanel(true);
    } catch (error) {
      toast.error(errorMessage(error));
      await loadPanel(true);
    } finally {
      setSaving(null);
    }
  };

  const saveReservation = async (contract: ExportContract, product: ContractProduct) => {
    if (!data?.estrutura_configurada) {
      toast.warning("Execute a migração antes de travar estoque.");
      return;
    }
    const key = `${contract.SEQCONTRATO}-${product.SEQPRODUTO}`;
    const raw = reservationInputs[key] ?? String(suggestedReservationWeight(product));
    const weight = Number(raw.replace(",", "."));
    if (!Number.isFinite(weight) || weight < 0) {
      toast.error("Informe um peso válido.");
      return;
    }
    setSaving(key);
    try {
      const result = await contractsApi.saveReservation({
        seqcontrato: contract.SEQCONTRATO,
        seqproduto: product.SEQPRODUTO,
        peso_reservado: weight,
        versao: product.VERSAO_RESERVA ?? null,
      });
      toast.success(result.message);
      setReservationInputs((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      await loadPanel(true);
    } catch (error) {
      toast.error(errorMessage(error));
      await loadPanel(true);
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-full items-center justify-center bg-[#F4F7FA] p-8">
        <div className="text-center">
          <RefreshCw className="mx-auto h-8 w-8 animate-spin text-[#315F88]" />
          <p className="mt-3 text-sm font-bold text-[#60758A]">Buscando contratos e estoque...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[#F4F7FA] p-3 sm:p-5 lg:p-7">
      <div className="mx-auto max-w-[1650px] space-y-5">
        <header className="rounded-xl border border-[#CEDAE5] bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-md bg-[#244B70] text-white"><FileSignature className="h-5 w-5" /></div>
              <div><p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#60758A]">PCP • Exportação</p><h1 className="text-2xl font-black tracking-tight text-[#173D6E]">Planejamento de contratos</h1><p className="text-xs font-medium text-[#667B90]">Contratos ativos, cobertura de produtos e disponibilidade de estoque.</p></div>
            </div>
            <Button variant="outline" onClick={() => void loadPanel()} className="border-[#AFC1D1] text-[#244B70]"><RefreshCw className="mr-2 h-4 w-4" />Atualizar painel</Button>
          </div>
        </header>

        {!data?.estrutura_configurada && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div><p className="text-sm font-black">Planejamento em modo de consulta</p><p className="mt-1 text-xs font-medium">Execute <code>sql/criar_modulo_contratos.sql</code> no banco para habilitar prioridade, data planejada e travas de estoque.</p></div>
          </div>
        )}

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard icon={FileSignature} label="Contratos ativos" value={String(contracts.length)} />
          <MetricCard icon={Weight} label="Peso contratado" value={formatKg(totalContracted)} />
          <MetricCard icon={LockKeyhole} label="Peso travado" value={formatKg(totalReserved)} />
          <MetricCard icon={Boxes} label="Estoque sem venda" value={formatKg(totalSurplus)} />
        </section>

        <Card className="border-[#CEDAE5] shadow-sm">
          <CardContent className="p-0">
            <div className="flex flex-col gap-3 border-b border-[#DCE5ED] p-4 lg:flex-row lg:items-end lg:justify-between">
              <div><h2 className="text-base font-black text-[#173D6E]">Contratos ativos ({contracts.length})</h2><p className="mt-0.5 text-xs text-[#6B7F92]">Ordenados do contrato mais antigo para o mais recente.</p></div>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                <div className="relative w-full sm:min-w-[320px] sm:flex-1">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#8396A9]" />
                  <Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Contrato, cliente, país, produto ou cód. produto" />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={toggleAllExpanded}
                  disabled={contracts.length === 0}
                  className="h-10 w-full border-[#AFC1D1] px-3 text-[#244B70] sm:w-auto"
                  title={allVisibleExpanded ? "Fechar produtos de todos os contratos" : "Abrir produtos de todos os contratos"}
                >
                  {allVisibleExpanded ? <ChevronsUp className="h-4 w-4" /> : <ChevronsDown className="h-4 w-4" />}
                  <span className="ml-2 hidden text-xs font-bold lg:inline">{allVisibleExpanded ? "Fechar todos" : "Abrir todos"}</span>
                </Button>
                <select value={country} onChange={(event) => setCountry(event.target.value)} className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm sm:w-auto sm:min-w-[170px]"><option value="TODOS">Todos os países</option>{countries.map((item) => <option key={String(item)} value={String(item)}>{item}</option>)}</select>
              </div>
            </div>
            <div className="overflow-x-auto">
              <Table className="w-full min-w-[980px] table-fixed [&_td]:px-2 [&_th]:px-2">
                <TableHeader className="bg-[#EDF3F7]"><TableRow><Header className="w-[64px] text-center">Itens</Header><Header className="w-[105px]">Nº contrato</Header><Header>Cliente</Header><Header className="w-[90px]">País</Header><Header className="w-[92px]">Prioridade</Header><Header className="w-[158px]">Embarque planejado</Header><Header className="w-[82px]">Prazo</Header><Header className="w-[120px] text-right">Peso total</Header><Header className="w-[132px]">Status</Header></TableRow></TableHeader>
                <TableBody>
                  {contracts.map((contract) => {
                    const isOpen = expanded.has(contract.SEQCONTRATO);
                    const coverage = contract.PESO_TOTAL > 0 ? Math.min(100, (contract.PESO_RESERVADO / contract.PESO_TOTAL) * 100) : 0;
                    return [
                      <TableRow key={`main-${contract.SEQCONTRATO}`} className="border-[#DCE5ED] hover:bg-[#F8FAFC]">
                        <TableCell className="text-center"><Button variant="outline" size="sm" className="h-8 min-w-[50px] gap-1 border-[#B9CAD8] px-2 text-[#244B70]" title={isOpen ? "Fechar produtos" : "Abrir produtos"} aria-label={isOpen ? "Fechar produtos do contrato" : "Abrir produtos do contrato"} onClick={() => toggleExpanded(contract.SEQCONTRATO)}>{isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}<span className="text-[10px] font-black">{contract.PRODUTOS.length}</span></Button></TableCell>
                        <TableCell><button type="button" onClick={() => toggleExpanded(contract.SEQCONTRATO)} className="font-mono text-xs font-black text-[#244B70] hover:underline">{contract.NROCONTRATO}</button><p className="mt-1 text-[10px] text-[#778A9D]">{formatDate(contract.DTACONTRATO)}</p></TableCell>
                        <TableCell><p className="truncate text-xs font-black text-[#173D6E]" title={contract.NOMERAZAO}>{contract.NOMERAZAO}</p></TableCell>
                        <TableCell><p className="truncate text-xs font-semibold text-[#5D7185]" title={contract.PAISDESTINO || ""}>{contract.PAISDESTINO || "—"}</p></TableCell>
                        <TableCell><select disabled={!data?.estrutura_configurada || saving === `config-${contract.SEQCONTRATO}`} value={contract.PRIORIDADE} onChange={(event) => void saveConfig(contract, { PRIORIDADE: event.target.value as ExportContract["PRIORIDADE"] })} className={`h-8 w-full min-w-0 rounded-md border px-1 text-[11px] font-black ${priorityClass[contract.PRIORIDADE] || priorityClass.MEDIA}`}><option value="BAIXA">Baixa</option><option value="MEDIA">Média</option><option value="ALTA">Alta</option><option value="URGENTE">Urgente</option></select></TableCell>
                        <TableCell><Input type="date" disabled={!data?.estrutura_configurada || saving === `config-${contract.SEQCONTRATO}`} value={inputDate(contract.DTA_EMBARQUE_PLANEJADA)} onChange={(event) => void saveConfig(contract, { DTA_EMBARQUE_PLANEJADA: event.target.value })} className="h-8 w-full min-w-[140px] px-2 text-[11px] [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-100" /></TableCell>
                        <TableCell><Deadline days={contract.PRAZO_DIAS} /></TableCell>
                        <TableCell className="text-right"><p className="whitespace-nowrap text-xs font-black text-[#173D6E]">{formatKg(contract.PESO_TOTAL)}</p><div className="mt-1 flex items-center justify-end gap-1"><Progress value={coverage} className="h-1.5 w-12" /><span className="text-[9px] text-[#6B7F92]">{coverage.toFixed(0)}%</span></div></TableCell>
                        <TableCell><select disabled={!data?.estrutura_configurada || saving === `config-${contract.SEQCONTRATO}`} value={contract.STATUS_OPERACIONAL} onChange={(event) => void saveConfig(contract, { STATUS_OPERACIONAL: event.target.value as ExportContract["STATUS_OPERACIONAL"] })} className="h-8 w-full min-w-0 rounded-md border border-[#B9C9D7] bg-white px-1 text-[11px] font-bold text-[#244B70]"><option value="PENDENTE">Pendente</option><option value="PROGRAMADO">Programado</option><option value="EM_SEPARACAO">Em separação</option><option value="PRONTO">Pronto</option><option value="EMBARCADO">Embarcado</option></select></TableCell>
                      </TableRow>,
                      isOpen ? <TableRow key={`detail-${contract.SEQCONTRATO}`} className="bg-[#F6F9FB] hover:bg-[#F6F9FB]"><TableCell colSpan={9} className="p-0"><ContractDetails contract={contract} configured={Boolean(data?.estrutura_configurada)} saving={saving} reservationInputs={reservationInputs} setReservationInputs={setReservationInputs} notes={notes} setNotes={setNotes} onSaveReservation={saveReservation} onSaveConfig={saveConfig} /></TableCell></TableRow> : null,
                    ];
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#CEDAE5] shadow-sm">
          <CardContent className="p-0">
            <div className="flex flex-col gap-3 border-b border-[#DCE5ED] p-4 lg:flex-row lg:items-end lg:justify-between">
              <div><h2 className="text-base font-black text-[#173D6E]">Estoque sem venda</h2><p className="mt-0.5 text-xs text-[#6B7F92]">Estoque disponível ERP menos o peso dos contratos ativos, como na análise da planilha.</p></div>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                <div className="relative w-full sm:min-w-[260px] sm:flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-[#8396A9]" /><Input value={stockSearch} onChange={(event) => setStockSearch(event.target.value)} className="pl-9" placeholder="Código ou produto" /></div>
                <label className="flex h-10 items-center gap-2 rounded-md border border-[#C9D6E1] bg-white px-3 text-xs font-bold text-[#405B74]"><input type="checkbox" checked={onlySurplus} onChange={(event) => setOnlySurplus(event.target.checked)} />Somente saldo positivo</label>
                <Button type="button" variant="outline" disabled={syncingStock} onClick={() => void syncStock()} className="h-10 border-[#AFC1D1] text-[#244B70]">
                  <RefreshCw className={`mr-2 h-4 w-4 ${syncingStock ? "animate-spin" : ""}`} />
                  {syncingStock ? "Sincronizando..." : "Sincronizar ERP"}
                </Button>
              </div>
            </div>
            <div className="max-h-[560px] overflow-auto"><Table className="w-full min-w-[900px] table-fixed [&_td]:px-2 [&_th]:px-2"><TableHeader className="sticky top-0 z-10 bg-[#EDF3F7]"><TableRow><Header className="w-[90px]">Produto</Header><Header>Descrição</Header><Header className="w-[135px] text-right">Peso disponível ERP</Header><Header className="w-[120px] text-right">Vendido ativo</Header><Header className="w-[145px] text-right">Peso atrelado</Header><Header className="w-[135px] text-right">Livre após vínculos</Header><Header className="w-[130px] text-right">Estoque sem venda</Header></TableRow></TableHeader><TableBody>{stock.map((item) => <TableRow key={item.SEQPRODUTO}><TableCell className="font-mono text-xs font-black text-[#244B70]">{item.SEQPRODUTO}</TableCell><TableCell><p className="truncate text-xs font-bold text-[#304D68]" title={item.DESCRPRODUTO}>{item.DESCRPRODUTO}</p></TableCell><NumberCell value={item.PESODISPONIVEL} /><NumberCell value={item.PESO_VENDIDO_ATIVO} /><TableCell className="text-right"><p className="whitespace-nowrap text-xs font-black text-[#173D6E]">{formatKg(item.PESO_ATRELADO_TOTAL)}</p><p className="text-[9px] font-bold text-[#3A6F9B]">OP {formatKg(item.PESO_ATRELADO_ORDEM)}</p><p className="text-[9px] font-bold text-amber-700">Manual {formatKg(item.PESO_RESERVADO_VERTICE)}</p></TableCell><NumberCell value={item.PESO_LIVRE_VERTICE} /><TableCell className={`whitespace-nowrap text-right text-xs font-black ${Number(item.ESTOQUE_SEM_VENDA) < 0 ? "text-red-700" : "text-emerald-700"}`}>{formatKg(item.ESTOQUE_SEM_VENDA)}</TableCell></TableRow>)}</TableBody></Table></div>
          </CardContent>
        </Card>
        <p className="pb-2 text-center text-[10px] font-semibold text-[#7B8EA1]">Estoque livre atual: {formatKg(totalStock)} • Atualização: {formatDate(data?.atualizado_em)}</p>
      </div>
    </div>
  );
}

interface ContractDetailsProps {
  contract: ExportContract;
  configured: boolean;
  saving: string | null;
  reservationInputs: Record<string, string>;
  setReservationInputs: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  notes: Record<number, string>;
  setNotes: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  onSaveReservation: (contract: ExportContract, product: ContractProduct) => Promise<void>;
  onSaveConfig: (contract: ExportContract, changes: Partial<ExportContract>) => Promise<void>;
}

function ContractDetails({ contract, configured, saving, reservationInputs, setReservationInputs, notes, setNotes, onSaveReservation, onSaveConfig }: ContractDetailsProps) {
  const [detailProduct, setDetailProduct] = useState<ContractProduct | null>(null);

  return (
    <div className="border-l-4 border-[#315F88] p-4">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div><p className="text-xs font-black uppercase tracking-wider text-[#315F88]">Produtos do contrato</p><p className="mt-1 text-xs text-[#667B90]">O sistema impede travas acima do contrato ou do estoque livre.</p></div>
        <div className="flex w-full max-w-xl gap-2"><Textarea value={notes[contract.SEQCONTRATO] ?? contract.OBSERVACAO ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [contract.SEQCONTRATO]: event.target.value }))} placeholder="Observação operacional" className="min-h-16 text-xs" disabled={!configured} /><Button variant="outline" disabled={!configured || saving === `config-${contract.SEQCONTRATO}`} onClick={() => void onSaveConfig(contract, { OBSERVACAO: notes[contract.SEQCONTRATO] ?? contract.OBSERVACAO ?? "" })}>Salvar nota</Button></div>
      </div>
      <div className="overflow-x-auto rounded-md border border-[#D5E0E9]">
        <Table className="w-full min-w-[940px] table-fixed [&_td]:px-2 [&_th]:px-2">
          <TableHeader className="bg-white"><TableRow><Header className="w-[82px]">Produto</Header><Header>Descrição</Header><Header className="w-[105px] text-right">Peso contrato</Header><Header className="w-[105px] text-right">Disponível ERP</Header><Header className="w-[155px] text-right">Peso atrelado</Header><Header className="w-[100px] text-right">Saldo contrato</Header><Header className="w-[112px] text-right">Manual sugerido</Header><Header className="w-[102px] text-center">Ação</Header></TableRow></TableHeader>
          <TableBody>{contract.PRODUTOS.map((product) => {
            const key = `${contract.SEQCONTRATO}-${product.SEQPRODUTO}`;
            const otherLocks = Math.max(0, Number(product.PESO_RESERVADO_TOTAL_VERTICE) - Number(product.PESO_ATRELADO_TOTAL));
            const suggestedWeight = suggestedReservationWeight(product);
            const hasManualReservation = Number(product.PESO_RESERVADO_MANUAL) > 0;
            return (
              <TableRow key={key} className={reservationCoverageClass(product)}>
                <TableCell className="font-mono text-xs font-black text-[#244B70]">{product.SEQPRODUTO}</TableCell>
                <TableCell><p className="truncate text-xs font-bold text-[#304D68]" title={product.DESCRICAO}>{product.DESCRICAO}</p></TableCell>
                <NumberCell value={product.PESOCONTRATO} />
                <NumberCell value={product.PESO_DISPONIVEL_ERP} />
                <TableCell className="text-right">
                  <button type="button" onClick={() => setDetailProduct(product)} className="ml-auto block rounded-md border border-[#B9CAD8] bg-white/80 px-2 py-1 text-right hover:border-[#315F88] hover:bg-white" title="Ver origem do peso atrelado">
                    <span className="block whitespace-nowrap text-xs font-black text-[#173D6E]">{formatKg(product.PESO_ATRELADO_TOTAL)}</span>
                    <span className="block whitespace-nowrap text-[9px] font-bold text-[#3A6F9B]">OP {formatKg(product.PESO_ATRELADO_ORDEM)}</span>
                    <span className="block whitespace-nowrap text-[9px] font-bold text-amber-700">Manual {formatKg(product.PESO_RESERVADO_MANUAL)}</span>
                  </button>
                  {otherLocks > 0 && <p className="mt-1 whitespace-nowrap text-[9px] text-[#6B7F92]">Outros contratos: {formatKg(otherLocks)}</p>}
                </TableCell>
                <NumberCell value={product.SALDO_CONTRATO} />
                <TableCell className="text-right"><Input type="number" min="0" step="0.001" max={suggestedWeight} title={`Sugestão manual máxima: ${formatKg(suggestedWeight)}`} disabled={!configured} value={reservationInputs[key] ?? String(suggestedWeight)} onChange={(event) => setReservationInputs((current) => ({ ...current, [key]: event.target.value }))} className="ml-auto h-8 w-24 px-2 text-right text-xs" /></TableCell>
                <TableCell className="text-center"><Button size="sm" disabled={!configured || saving === key || (suggestedWeight <= 0 && !hasManualReservation)} onClick={() => void onSaveReservation(contract, product)} className="h-8 px-2 text-xs bg-[#244B70] hover:bg-[#193B5C]"><LockKeyhole className="mr-1 h-3.5 w-3.5" />{hasManualReservation ? "Atualizar" : "Travar"}</Button></TableCell>
              </TableRow>
            );
          })}</TableBody>
        </Table>
      </div>

      <Dialog open={Boolean(detailProduct)} onOpenChange={(open) => !open && setDetailProduct(null)}>
        <DialogContent className="max-w-3xl border-[#CBD8E3]">
          <DialogHeader>
            <DialogTitle className="text-[#173D6E]">Origem do peso atrelado</DialogTitle>
            <DialogDescription>{detailProduct ? `${detailProduct.SEQPRODUTO} • ${detailProduct.DESCRICAO}` : "Detalhes do produto"}</DialogDescription>
          </DialogHeader>
          {detailProduct && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                <AllocationSummary label="Total atrelado" value={detailProduct.PESO_ATRELADO_TOTAL} className="border-[#AFC4D6] bg-[#F3F7FA] text-[#173D6E]" />
                <AllocationSummary label="Ordens de produção" value={detailProduct.PESO_ATRELADO_ORDEM} className="border-blue-200 bg-blue-50 text-blue-800" />
                <AllocationSummary label="Manual" value={detailProduct.PESO_RESERVADO_MANUAL} className="border-amber-200 bg-amber-50 text-amber-800" />
              </div>
              <div className="max-h-[430px] space-y-2 overflow-y-auto pr-1">
                {detailProduct.DETALHES_ATRELAMENTO.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-[#BCCAD6] p-6 text-center text-sm text-[#6B7F92]">Nenhum peso atrelado a este produto.</div>
                ) : detailProduct.DETALHES_ATRELAMENTO.map((detail, index) => (
                  <div key={`${detail.ORIGEM}-${detail.NUMERO_ORDEM || "manual"}-${index}`} className={`rounded-lg border p-3 ${detail.ORIGEM === "ORDEM_PRODUCAO" ? "border-blue-200 bg-blue-50/60" : "border-amber-200 bg-amber-50/60"}`}>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-2">
                        {detail.ORIGEM === "ORDEM_PRODUCAO" ? <Factory className="h-4 w-4 text-blue-700" /> : <LockKeyhole className="h-4 w-4 text-amber-700" />}
                        <div><p className="text-xs font-black text-[#173D6E]">{detail.ORIGEM === "ORDEM_PRODUCAO" ? `Ordem de produção ${detail.NUMERO_ORDEM}` : "Lançamento manual sem vínculo de ordem"}</p><p className="text-[10px] text-[#6B7F92]">{detail.ORIGEM === "ORDEM_PRODUCAO" ? `Contrato industrial ${detail.CODCONTRATO} • vínculo protegido` : `Incluído por ${detail.USUARIO || "usuário não informado"}`}</p></div>
                      </div>
                      <p className="whitespace-nowrap text-sm font-black text-[#173D6E]">{formatKg(detail.PESO)}</p>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] text-[#526A80] sm:grid-cols-3">
                      <p><span className="block font-black uppercase">Início produção</span>{formatDate(detail.DATA_INICIO)}</p>
                      <p><span className="block font-black uppercase">Data rendimento</span>{formatDate(detail.DATA_RENDIMENTO)}</p>
                      <p><span className="block font-black uppercase">Origem</span>{detail.ORIGEM === "ORDEM_PRODUCAO" ? "Automática pelo ERP" : "Manual no Vértice"}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AllocationSummary({ label, value, className }: { label: string; value: number; className: string }) {
  return <div className={`rounded-lg border p-3 ${className}`}><p className="text-[9px] font-black uppercase tracking-wider">{label}</p><p className="mt-1 whitespace-nowrap text-sm font-black">{formatKg(value)}</p></div>;
}

function MetricCard({ icon: Icon, label, value }: { icon: typeof FileSignature; label: string; value: string }) {
  return <div className="rounded-lg border border-[#CFDAE4] bg-white p-4 shadow-sm"><div className="flex items-center gap-2 text-[#61778C]"><Icon className="h-4 w-4" /><span className="text-[10px] font-black uppercase tracking-wider">{label}</span></div><p className="mt-2 whitespace-nowrap text-lg font-black text-[#173D6E] sm:text-xl">{value}</p></div>;
}

function Header({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <TableHead className={`whitespace-nowrap text-[10px] font-black uppercase tracking-wider text-[#47627D] ${className}`}>{children}</TableHead>;
}

function NumberCell({ value }: { value: number }) {
  return <TableCell className="whitespace-nowrap text-right text-xs font-bold text-[#304D68]">{formatKg(value)}</TableCell>;
}

function Deadline({ days }: { days?: number | null }) {
  if (days == null) return <span className="text-xs font-semibold text-[#8192A2]">Indefinido</span>;
  const className = days < 0 ? "text-red-700" : days <= 7 ? "text-orange-700" : "text-[#405B74]";
  return <span className={`inline-flex items-center gap-1 text-xs font-black ${className}`}><CalendarDays className="h-3.5 w-3.5" />{days < 0 ? `${Math.abs(days)}d atrasado` : days === 0 ? "Hoje" : `${days} dias`}</span>;
}
