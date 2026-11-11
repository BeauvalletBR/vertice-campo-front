import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownUp,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileDown,
  FileText,
  Loader2,
  PackageCheck,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Truck,
  Weight,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { exportPedidosMiPdf } from "@/lib/pedidos-mi-report";
import {
  type PedidoMi,
  type PedidoMiItemPayload,
  type PedidoMiPanel,
  type PedidoMiPayload,
  type PedidoMiStatus,
  pedidosMiApi,
} from "@/services/pedidos-mi";

const kg = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 3,
});
const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
});

const formatDate = (value?: string | null) => {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "-";
};

const inputDate = (value?: string | null) => String(value || "").slice(0, 10);

const parseNumber = (value: string) => {
  const normalized = value.trim().replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const numberInput = (value?: number | null) =>
  value == null ? "" : String(value).replace(".", ",");

type FormItem = {
  key: string;
  id?: number;
  seqproduto: string;
  produto: string;
  unidade: string;
  pesoPedido: string;
  precoPedido: string;
  pesoSistema: number;
  precoSistema?: number | null;
};

type FormState = {
  id?: number;
  versao?: number;
  nomeCarga: string;
  nropedido: string;
  nrocarga: string;
  dtaEmbarque: string;
  seqcliente?: number | null;
  cliente: string;
  uf: string;
  status: PedidoMiStatus;
  observacao: string;
  itens: FormItem[];
};

let itemKeySequence = 0;

const createItemKey = () => {
  itemKeySequence += 1;
  return globalThis.crypto?.randomUUID?.()
    ?? `pedido-mi-item-${Date.now()}-${itemKeySequence}`;
};

const newItem = (): FormItem => ({
  key: createItemKey(),
  seqproduto: "",
  produto: "",
  unidade: "KG",
  pesoPedido: "",
  precoPedido: "",
  pesoSistema: 0,
  precoSistema: null,
});

const emptyForm = (): FormState => ({
  nomeCarga: "",
  nropedido: "",
  nrocarga: "",
  dtaEmbarque: "",
  cliente: "",
  uf: "",
  status: "PENDENTE",
  observacao: "",
  itens: [newItem()],
});

const statusStyle: Record<PedidoMiStatus, string> = {
  PENDENTE: "border-amber-200 bg-amber-50 text-amber-800",
  PROGRAMADO: "border-blue-200 bg-blue-50 text-blue-800",
  CARREGADO: "border-emerald-200 bg-emerald-50 text-emerald-800",
  CANCELADO: "border-slate-300 bg-slate-100 text-slate-600",
};

type SortKey = "carga" | "pedido" | "cliente" | "embarque" | "status" | "peso" | "diferenca";

export default function PedidosMi() {
  const [panel, setPanel] = useState<PedidoMiPanel | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [status, setStatus] = useState("TODOS");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [removing, setRemoving] = useState<PedidoMi | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; direction: "asc" | "desc" }>({
    key: "embarque",
    direction: "asc",
  });

  const loadPanel = async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await pedidosMiApi.getPanel({
        dataInicio: dateStart,
        dataFim: dateEnd,
        busca: search,
        status: status === "TODOS" ? "" : status,
      });
      setPanel(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível carregar Pedidos MI.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadPanel();
    // A busca textual é aplicada ao confirmar ou clicar em Atualizar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateStart, dateEnd, status]);

  const sortedOrders = useMemo(() => {
    const items = [...(panel?.pedidos || [])];
    const direction = sort.direction === "asc" ? 1 : -1;
    const value = (order: PedidoMi) => {
      if (sort.key === "carga") return order.NOME_CARGA;
      if (sort.key === "pedido") return Number(order.NROPEDIDO || 0);
      if (sort.key === "cliente") return order.CLIENTE;
      if (sort.key === "embarque") return order.DTA_EMBARQUE;
      if (sort.key === "status") return order.STATUS;
      if (sort.key === "peso") return order.ITENS.reduce((sum, item) => sum + Number(item.PESO_PEDIDO || 0), 0);
      return order.ITENS.reduce((sum, item) => sum + Number(item.DIFERENCA_PESO || 0), 0);
    };
    return items.sort((first, second) => {
      const left = value(first);
      const right = value(second);
      return (typeof left === "number" && typeof right === "number"
        ? left - right
        : String(left).localeCompare(String(right), "pt-BR", { numeric: true })) * direction;
    });
  }, [panel?.pedidos, sort]);

  const changeSort = (key: SortKey) =>
    setSort((current) => ({
      key,
      direction: current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));

  const openEdit = (order: PedidoMi) => {
    setForm({
      id: order.ID_PEDIDO_MI,
      versao: order.VERSAO,
      nomeCarga: order.NOME_CARGA,
      nropedido: order.NROPEDIDO ? String(order.NROPEDIDO) : "",
      nrocarga: String(order.NROCARGA || ""),
      dtaEmbarque: inputDate(order.DTA_EMBARQUE),
      seqcliente: order.SEQCLIENTE,
      cliente: order.CLIENTE,
      uf: order.UF || "",
      status: order.STATUS,
      observacao: order.OBSERVACAO || "",
      itens: order.ITENS.map((item) => ({
        key: String(item.ID_PEDIDO_MI_ITEM || createItemKey()),
        id: item.ID_PEDIDO_MI_ITEM,
        seqproduto: item.SEQPRODUTO ? String(item.SEQPRODUTO) : "",
        produto: item.PRODUTO,
        unidade: item.UNIDADE || "KG",
        pesoPedido: numberInput(item.PESO_PEDIDO),
        precoPedido: numberInput(item.PRECO_PEDIDO),
        pesoSistema: Number(item.PESO_SISTEMA || 0),
        precoSistema: item.PRECO_SISTEMA,
      })),
    });
  };

  const lookupErp = async () => {
    if (!form) return;
    const orderNumber = Number(form.nropedido);
    if (!Number.isInteger(orderNumber) || orderNumber <= 0) {
      toast.error("Informe um número de pedido válido.");
      return;
    }
    setLookingUp(true);
    try {
      const erp = await pedidosMiApi.getErpOrder(orderNumber);
      setForm((current) => current && ({
        ...current,
        nrocarga: String(erp.NROCARGA || current.nrocarga),
        dtaEmbarque: inputDate(erp.DTAEMBARQUE) || current.dtaEmbarque,
        seqcliente: erp.SEQCLIENTE,
        cliente: erp.CLIENTE || current.cliente,
        uf: erp.UF || current.uf,
        itens: erp.ITENS.map((item) => ({
          key: createItemKey(),
          seqproduto: String(item.SEQPRODUTO),
          produto: item.PRODUTO,
          unidade: item.UNIDADE || "KG",
          pesoPedido: numberInput(item.PESO_SISTEMA),
          precoPedido: numberInput(item.PRECO_SISTEMA),
          pesoSistema: Number(item.PESO_SISTEMA || 0),
          precoSistema: item.PRECO_SISTEMA,
        })),
      }));
      toast.success("Dados do pedido carregados do ERP.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Pedido não encontrado.");
    } finally {
      setLookingUp(false);
    }
  };

  const updateItem = (key: string, field: keyof FormItem, value: string) =>
    setForm((current) => current && ({
      ...current,
      itens: current.itens.map((item) => item.key === key ? { ...item, [field]: value } : item),
    }));

  const save = async () => {
    if (!form) return;
    if (!form.nomeCarga.trim() || !form.dtaEmbarque || !form.cliente.trim()) {
      toast.error("Preencha carga, embarque e cliente.");
      return;
    }
    const validItems = form.itens.filter((item) => item.produto.trim());
    if (!validItems.length) {
      toast.error("Inclua ao menos um produto.");
      return;
    }
    const items: PedidoMiItemPayload[] = validItems.map((item, index) => ({
      id_item: item.id,
      seqproduto: item.seqproduto ? Number(item.seqproduto) : null,
      produto: item.produto.trim(),
      unidade: item.unidade || "KG",
      peso_pedido: parseNumber(item.pesoPedido),
      preco_pedido: item.precoPedido.trim() ? parseNumber(item.precoPedido) : null,
      ordem: index + 1,
    }));
    const payload: PedidoMiPayload = {
      nome_carga: form.nomeCarga.trim(),
      nropedido: form.nropedido ? Number(form.nropedido) : null,
      nrocarga: form.nrocarga.trim() || null,
      dta_embarque: form.dtaEmbarque,
      seqcliente: form.seqcliente,
      cliente: form.cliente.trim(),
      uf: form.uf.trim() || null,
      status: form.status,
      observacao: form.observacao.trim() || null,
      versao: form.versao,
      itens: items,
    };
    setSaving(true);
    try {
      if (form.id) await pedidosMiApi.update(form.id, payload);
      else await pedidosMiApi.create(payload);
      toast.success(form.id ? "Lançamento atualizado." : "Lançamento incluído.");
      setForm(null);
      await loadPanel(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!removing) return;
    try {
      await pedidosMiApi.remove(removing.ID_PEDIDO_MI, removing.VERSAO);
      toast.success("Lançamento removido.");
      setRemoving(null);
      await loadPanel(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível remover.");
    }
  };

  const metricCards = [
    { label: "Cargas", value: panel?.resumo.CARGAS || 0, icon: Truck, tone: "blue" },
    { label: "Pedidos", value: panel?.resumo.PEDIDOS || 0, icon: FileText, tone: "blue" },
    { label: "Peso planejado", value: `${kg.format(panel?.resumo.PESO_PLANEJADO || 0)} kg`, icon: Weight, tone: "navy" },
    { label: "Peso no sistema", value: `${kg.format(panel?.resumo.PESO_SISTEMA || 0)} kg`, icon: PackageCheck, tone: "green" },
    { label: "Diferença", value: `${kg.format(panel?.resumo.DIFERENCA_PESO || 0)} kg`, icon: ArrowDownUp, tone: Number(panel?.resumo.DIFERENCA_PESO || 0) === 0 ? "green" : "orange" },
  ];

  return (
    <div className="min-h-full bg-[#F3F7FB] p-3 sm:p-5 lg:p-6">
      <div className="mx-auto max-w-[1780px] space-y-4">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#55718D]">PCP · Mercado interno</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-[#123A68] sm:text-3xl">Pedidos MI</h1>
            <p className="mt-1 text-sm font-medium text-[#60758A]">Planeje cargas e compare peso e preço com o pedido atual do ERP.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void loadPanel(true)} disabled={refreshing} className="border-[#B8CADB] text-[#173D6E]">
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />Atualizar
            </Button>
            <Button variant="outline" onClick={() => void exportPedidosMiPdf(sortedOrders)} disabled={!sortedOrders.length} className="border-emerald-300 text-emerald-800 hover:bg-emerald-50">
              <FileDown className="mr-2 h-4 w-4" />PDF
            </Button>
            <Button onClick={() => setForm(emptyForm())} className="bg-[#173D6E] font-bold hover:bg-[#102E53]">
              <Plus className="mr-2 h-4 w-4" />Novo lançamento
            </Button>
          </div>
        </header>

        <Card className="border-[#CFDCE8] bg-white p-3 shadow-sm">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.4fr_0.72fr_0.72fr_0.72fr_auto]">
            <div>
              <Label className="text-[10px] font-black uppercase tracking-wider text-[#526B83]">Carga, pedido, cliente ou produto</Label>
              <div className="relative mt-1.5">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7990A6]" />
                <Input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void loadPanel(true)} placeholder="Pesquisar..." className="pl-9" />
              </div>
            </div>
            <div><Label className="text-[10px] font-black uppercase tracking-wider text-[#526B83]">Embarque inicial</Label><Input type="date" value={dateStart} onChange={(event) => setDateStart(event.target.value)} className="mt-1.5" /></div>
            <div><Label className="text-[10px] font-black uppercase tracking-wider text-[#526B83]">Embarque final</Label><Input type="date" value={dateEnd} onChange={(event) => setDateEnd(event.target.value)} className="mt-1.5" /></div>
            <div>
              <Label className="text-[10px] font-black uppercase tracking-wider text-[#526B83]">Status</Label>
              <Select value={status} onValueChange={setStatus}><SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="TODOS">Todos</SelectItem><SelectItem value="PENDENTE">Pendente</SelectItem><SelectItem value="PROGRAMADO">Programado</SelectItem><SelectItem value="CARREGADO">Carregado</SelectItem><SelectItem value="CANCELADO">Cancelado</SelectItem></SelectContent></Select>
            </div>
            <Button onClick={() => void loadPanel(true)} className="self-end bg-[#1B58A0] hover:bg-[#154781]"><Search className="mr-2 h-4 w-4" />Filtrar</Button>
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {metricCards.map(({ label, value, icon: Icon, tone }) => (
            <Card key={label} className="flex min-h-[94px] items-center gap-3 border-[#CFDCE8] bg-white p-4 shadow-sm">
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tone === "green" ? "bg-emerald-50 text-emerald-700" : tone === "orange" ? "bg-orange-50 text-orange-700" : "bg-[#EDF4FB] text-[#1B58A0]"}`}><Icon className="h-5 w-5" /></div>
              <div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-wider text-[#6A8197]">{label}</p><p className="mt-1 truncate text-xl font-black text-[#123A68]">{value}</p></div>
            </Card>
          ))}
        </div>

        {!loading && panel && !panel.estrutura_configurada && (
          <Card className="border-amber-300 bg-amber-50 p-4 text-sm font-semibold text-amber-900">Execute <code>sql/criar_modulo_pedidos_mi.sql</code> no usuário VERTICE para habilitar o módulo.</Card>
        )}

        <Card className="overflow-hidden border-[#C9D7E4] bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-[#D4E0EA] px-4 py-3"><div><h2 className="font-black text-[#123A68]">Planejamento de cargas</h2><p className="text-xs text-[#6A8197]">{sortedOrders.length} lançamento(s) no recorte atual</p></div></div>
          {loading ? (
            <div className="flex h-64 items-center justify-center text-[#55718D]"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Buscando dados...</div>
          ) : !sortedOrders.length ? (
            <div className="flex h-64 flex-col items-center justify-center text-center"><Truck className="h-10 w-10 text-[#A8B9C9]" /><p className="mt-3 font-bold text-[#365675]">Nenhum lançamento encontrado</p><p className="mt-1 text-sm text-[#71869A]">Inclua uma carga manualmente ou busque um pedido do ERP.</p></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1320px] border-collapse text-[12px]">
                <thead className="bg-[#EAF1F7] text-[#355675]">
                  <tr>
                    <th className="w-10 px-2 py-3" />
                    {([['carga','Carga'],['pedido','Nº pedido'],['cliente','Cliente'],['embarque','Embarque'],['status','Status'],['peso','Total pedido'],['diferenca','Diferença peso']] as [SortKey,string][]).map(([key,label]) => <th key={key} className="px-3 py-3 text-left"><button onClick={() => changeSort(key)} className="inline-flex items-center gap-1 font-black uppercase tracking-wide hover:text-[#1B58A0]">{label}<ArrowDownUp className="h-3 w-3" /></button></th>)}
                    <th className="px-3 py-3 text-left font-black uppercase tracking-wide">Sistema</th>
                    <th className="px-3 py-3 text-right font-black uppercase tracking-wide">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedOrders.map((order) => {
                    const isOpen = expanded.has(order.ID_PEDIDO_MI);
                    const planned = order.ITENS.reduce((sum, item) => sum + Number(item.PESO_PEDIDO || 0), 0);
                    const system = order.ITENS.reduce((sum, item) => sum + Number(item.PESO_SISTEMA || 0), 0);
                    const difference = system - planned;
                    return [
                      <tr key={`order-${order.ID_PEDIDO_MI}`} className="border-t border-[#D5E0EA] bg-white hover:bg-[#F7FAFD]">
                        <td className="px-2 py-3 text-center"><button onClick={() => setExpanded((current) => { const next = new Set(current); if (isOpen) next.delete(order.ID_PEDIDO_MI); else next.add(order.ID_PEDIDO_MI); return next; })} className="rounded-lg border border-[#C6D6E5] p-1.5 text-[#1B58A0] hover:bg-[#EDF4FB]">{isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</button></td>
                        <td className="px-3 py-3 font-black text-[#123A68]">{order.NOME_CARGA}<span className="mt-0.5 block text-[10px] font-semibold text-[#7790A7]">Carga ERP {order.NROCARGA || "-"}</span></td>
                        <td className="px-3 py-3 font-bold text-[#1B58A0]">{order.NROPEDIDO || "Manual"}</td>
                        <td className="max-w-[260px] px-3 py-3 font-bold text-[#173D6E]">{order.CLIENTE}<span className="block text-[10px] font-semibold text-[#7790A7]">{order.UF || "UF não informada"}</span></td>
                        <td className="px-3 py-3 font-bold text-[#365675]">{formatDate(order.DTA_EMBARQUE)}</td>
                        <td className="px-3 py-3"><span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black ${statusStyle[order.STATUS]}`}>{order.STATUS}</span>{order.STATUS_PEDIDO_ERP && <span className="mt-1 block text-[9px] font-semibold text-[#7890A6]">ERP: {order.STATUS_PEDIDO_ERP}</span>}</td>
                        <td className="px-3 py-3 font-black text-[#123A68]">{kg.format(planned)} kg</td>
                        <td className={`px-3 py-3 font-black ${difference < 0 ? "text-red-600" : difference > 0 ? "text-emerald-700" : "text-[#365675]"}`}>{kg.format(difference)} kg</td>
                        <td className="px-3 py-3 font-black text-[#123A68]">{kg.format(system)} kg</td>
                        <td className="px-3 py-3"><div className="flex justify-end gap-1"><Button size="icon" variant="outline" onClick={() => openEdit(order)} className="h-8 w-8 border-[#BDD0E1] text-[#1B58A0]"><Pencil className="h-3.5 w-3.5" /></Button><Button size="icon" variant="outline" onClick={() => setRemoving(order)} className="h-8 w-8 border-red-200 text-red-600 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /></Button></div></td>
                      </tr>,
                      isOpen && <tr key={`items-${order.ID_PEDIDO_MI}`} className="bg-[#F8FBFD]"><td colSpan={10} className="p-3"><div className="overflow-hidden rounded-xl border border-[#D1DEEA] bg-white"><table className="w-full text-[11px]"><thead className="bg-[#F0F5F9] text-[#526D86]"><tr><th className="px-3 py-2 text-left">Cód. produto</th><th className="px-3 py-2 text-left">Descrição do produto</th><th className="px-3 py-2 text-right">Total pedido</th><th className="px-3 py-2 text-right">Preço pedido</th><th className="px-3 py-2 text-right">Sistema</th><th className="px-3 py-2 text-right">Preço sistema</th><th className="px-3 py-2 text-right">Diferença peso</th></tr></thead><tbody>{order.ITENS.map((item) => <tr key={item.ID_PEDIDO_MI_ITEM || `${item.SEQPRODUTO}-${item.ORDEM}`} className="border-t border-[#DFE8F0]"><td className="px-3 py-2 font-black text-[#1B58A0]">{item.SEQPRODUTO || "Manual"}</td><td className="px-3 py-2 font-bold text-[#173D6E]">{item.PRODUTO}</td><td className="px-3 py-2 text-right font-bold">{kg.format(item.PESO_PEDIDO)} kg</td><td className="px-3 py-2 text-right">{item.PRECO_PEDIDO == null ? "-" : money.format(item.PRECO_PEDIDO)}</td><td className="px-3 py-2 text-right font-bold">{kg.format(item.PESO_SISTEMA)} kg</td><td className="px-3 py-2 text-right">{item.PRECO_SISTEMA == null ? "-" : money.format(item.PRECO_SISTEMA)}</td><td className={`px-3 py-2 text-right font-black ${item.DIFERENCA_PESO < 0 ? "text-red-600" : item.DIFERENCA_PESO > 0 ? "text-emerald-700" : "text-[#365675]"}`}>{kg.format(item.DIFERENCA_PESO)} kg</td></tr>)}</tbody></table></div>{order.OBSERVACAO && <p className="mt-2 text-xs font-medium text-[#60758A]"><strong>Observação:</strong> {order.OBSERVACAO}</p>}</td></tr>,
                    ];
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <Dialog open={Boolean(form)} onOpenChange={(open) => !open && !saving && setForm(null)}>
        <DialogContent className="max-h-[94vh] max-w-[96vw] overflow-y-auto border-[#C7D7E5] xl:max-w-6xl">
          <DialogHeader><DialogTitle className="flex items-center gap-2 text-xl font-black text-[#123A68]"><Truck className="h-5 w-5" />{form?.id ? "Editar lançamento MI" : "Novo lançamento MI"}</DialogTitle><DialogDescription>Informe o pedido para preencher pelo ERP ou deixe em branco para um lançamento totalmente manual.</DialogDescription></DialogHeader>
          {form && <div className="space-y-5">
            <div className="grid gap-3 rounded-xl border border-[#D2DFEA] bg-[#F7FAFD] p-4 sm:grid-cols-2 lg:grid-cols-4">
              <div><Label>Nº pedido ERP</Label><div className="mt-1.5 flex gap-2"><Input inputMode="numeric" value={form.nropedido} onChange={(event) => setForm({ ...form, nropedido: event.target.value.replace(/\D/g, "") })} placeholder="Opcional" /><Button type="button" onClick={() => void lookupErp()} disabled={!form.nropedido || lookingUp} className="shrink-0 bg-[#1B58A0] hover:bg-[#154781]">{lookingUp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}<span className="ml-2 hidden xl:inline">Buscar</span></Button></div></div>
              <div><Label>Nome da carga *</Label><Input className="mt-1.5" value={form.nomeCarga} onChange={(event) => setForm({ ...form, nomeCarga: event.target.value })} placeholder="Ex.: BITRUCK VALCIR" /></div>
              <div><Label>Nº da carga</Label><Input className="mt-1.5" value={form.nrocarga} onChange={(event) => setForm({ ...form, nrocarga: event.target.value })} placeholder="ERP ou manual" /></div>
              <div><Label>Data de embarque *</Label><Input className="mt-1.5" type="date" value={form.dtaEmbarque} onChange={(event) => setForm({ ...form, dtaEmbarque: event.target.value })} /></div>
              <div className="sm:col-span-2"><Label>Cliente *</Label><Input className="mt-1.5" value={form.cliente} onChange={(event) => setForm({ ...form, cliente: event.target.value })} /></div>
              <div><Label>UF</Label><Input className="mt-1.5" maxLength={2} value={form.uf} onChange={(event) => setForm({ ...form, uf: event.target.value.toUpperCase() })} /></div>
              <div><Label>Status</Label><Select value={form.status} onValueChange={(value: PedidoMiStatus) => setForm({ ...form, status: value })}><SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="PENDENTE">Pendente</SelectItem><SelectItem value="PROGRAMADO">Programado</SelectItem><SelectItem value="CARREGADO">Carregado</SelectItem><SelectItem value="CANCELADO">Cancelado</SelectItem></SelectContent></Select></div>
            </div>

            <div className="overflow-hidden rounded-xl border border-[#CAD9E6]">
              <div className="flex items-center justify-between bg-[#EAF1F7] px-4 py-3"><div><h3 className="font-black text-[#123A68]">Produtos do pedido</h3><p className="text-xs text-[#668096]">Pedido é o valor planejado; Sistema vem do ERP.</p></div><Button type="button" size="sm" variant="outline" onClick={() => setForm({ ...form, itens: [...form.itens, newItem()] })} className="border-[#AFC5D8] text-[#173D6E]"><Plus className="mr-1 h-4 w-4" />Produto</Button></div>
              <div className="overflow-x-auto"><table className="w-full min-w-[930px] text-xs"><thead className="bg-[#F5F8FB] text-[#526C84]"><tr><th className="px-3 py-2 text-left">Cód. produto</th><th className="px-3 py-2 text-left">Descrição</th><th className="px-3 py-2 text-left">Un.</th><th className="px-3 py-2 text-right">Total pedido</th><th className="px-3 py-2 text-right">Preço pedido</th><th className="px-3 py-2 text-right">Sistema</th><th className="px-3 py-2 text-right">Preço sistema</th><th className="w-10" /></tr></thead><tbody>{form.itens.map((item) => <tr key={item.key} className="border-t border-[#DFE7EF]"><td className="p-2"><Input inputMode="numeric" value={item.seqproduto} onChange={(event) => updateItem(item.key, "seqproduto", event.target.value.replace(/\D/g, ""))} placeholder="Opcional" /></td><td className="p-2"><Input value={item.produto} onChange={(event) => updateItem(item.key, "produto", event.target.value)} /></td><td className="p-2"><Input value={item.unidade} onChange={(event) => updateItem(item.key, "unidade", event.target.value.toUpperCase())} /></td><td className="p-2"><Input inputMode="decimal" value={item.pesoPedido} onChange={(event) => updateItem(item.key, "pesoPedido", event.target.value)} className="text-right font-bold" /></td><td className="p-2"><Input inputMode="decimal" value={item.precoPedido} onChange={(event) => updateItem(item.key, "precoPedido", event.target.value)} className="text-right" /></td><td className="px-3 py-2 text-right font-black text-[#173D6E]">{kg.format(item.pesoSistema)} kg</td><td className="px-3 py-2 text-right">{item.precoSistema == null ? "-" : money.format(item.precoSistema)}</td><td className="p-2"><Button type="button" size="icon" variant="ghost" disabled={form.itens.length === 1} onClick={() => setForm({ ...form, itens: form.itens.filter((current) => current.key !== item.key) })} className="h-8 w-8 text-red-600 hover:bg-red-50"><X className="h-4 w-4" /></Button></td></tr>)}</tbody></table></div>
            </div>
            <div><Label>Observação</Label><Textarea className="mt-1.5" value={form.observacao} onChange={(event) => setForm({ ...form, observacao: event.target.value })} placeholder="Informações adicionais da carga ou do planejamento" /></div>
            <div className="flex justify-end gap-2 border-t border-[#D5E0EA] pt-4"><Button variant="outline" onClick={() => setForm(null)} disabled={saving}>Cancelar</Button><Button onClick={() => void save()} disabled={saving} className="min-w-36 bg-[#173D6E] font-bold hover:bg-[#102E53]">{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}Salvar</Button></div>
          </div>}
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(removing)} onOpenChange={(open) => !open && setRemoving(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Remover este lançamento?</AlertDialogTitle><AlertDialogDescription>{removing ? `${removing.NOME_CARGA} · ${removing.CLIENTE}. O pedido do ERP não será alterado.` : ""}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => void remove()} className="bg-red-600 hover:bg-red-700">Remover</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </div>
  );
}
