import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ArchiveX,
  BarChart3,
  Boxes,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsDown,
  ChevronsUp,
  Clock3,
  Eye,
  Factory,
  FileSpreadsheet,
  FileSignature,
  LockKeyhole,
  Minus,
  Pencil,
  PackageSearch,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Tags,
  Weight,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useLocation, useNavigate } from "react-router-dom";

import { PcpWorkspace, type PcpView } from "@/components/contracts/PcpWorkspace";
import { exportContractsPlanningToExcel } from "@/lib/contratos-excel";
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
  type ContractStock,
  type ContractStockLot,
  type ContractsPanelResponse,
  type ExportContract,
  type PcpRecommendation,
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
  const dateOnly = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dateOnly) {
    return dateFormatter.format(
      new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3])),
    );
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : dateFormatter.format(parsed);
};

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? formatDate(value)
    : parsed.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
};

const inputDate = (value: string | null | undefined) =>
  value ? String(value).slice(0, 10) : "";

const suggestedManualAddition = (product: ContractProduct) => {
  const currentManual = Math.max(0, Number(product.PESO_RESERVADO_MANUAL || 0));
  const remainingContract = Math.max(0, Number(product.SALDO_CONTRATO || 0));
  const maximumManualTotal = Math.max(0, Number(product.LIMITE_RESERVA || 0));
  const availableAddition = Math.max(0, maximumManualTotal - currentManual);
  return Math.round(Math.min(remainingContract, availableAddition) * 1000) / 1000;
};

type ReservationInputMode = "TOTAL" | "ADDITION" | "REMOVE";

const allocationInputValue = (value: number) =>
  String(Math.round(Math.max(0, value) * 1000) / 1000);

const reservationCoverageClass = (product: ContractProduct) => {
  if (Number(product.PESO_TRANSBORDADO || 0) > 0) return "bg-red-50/90 hover:bg-red-100/80";
  const contractWeight = Number(product.PESOCONTRATO || 0);
  const reservedWeight = Number(product.PESO_RESERVADO_CONTRATO || 0);
  if (contractWeight <= 0) return "bg-white";
  if (reservedWeight >= contractWeight) return "bg-emerald-50/80 hover:bg-emerald-100/70";
  if (reservedWeight / contractWeight >= 0.5) return "bg-orange-50/80 hover:bg-orange-100/70";
  return "bg-white";
};

const validityRuleLabel = (product: ContractProduct) => {
  const value = Number(product.VALIDADE || 0);
  const unit = product.TIPOVALIDADE === "D" ? "dias" : product.TIPOVALIDADE === "M" ? "meses" : product.TIPOVALIDADE === "A" ? "anos" : "";
  return value > 0 && unit ? `${value} ${unit}` : "Sem regra";
};

const validityStatus = (product: ContractProduct) => {
  if (!product.REGRA_VALIDADE_CONFIGURADA) return { label: "Sem regra", className: "border-slate-300 bg-slate-50 text-slate-700" };
  if (Number(product.PESO_ESTOQUE_ELEGIVEL || 0) <= 0) return { label: "Sem estoque válido", className: "border-red-300 bg-red-50 text-red-700" };
  if (Number(product.PESO_ESTOQUE_ATENCAO || 0) > 0) return { label: "Válido com atenção", className: "border-amber-300 bg-amber-50 text-amber-800" };
  return { label: "Estoque válido", className: "border-emerald-300 bg-emerald-50 text-emerald-800" };
};

const comparableDate = (value: string | null | undefined) => {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).getTime();
};

const compatibleContractsForLot = (
  productId: number,
  productionDate: string | null | undefined,
  contracts: ExportContract[],
) => {
  const lotDate = comparableDate(productionDate);
  if (lotDate == null) return [];
  return contracts.filter((contract) => {
    if (contract.DESCONSIDERADO) return false;
    const product = contract.PRODUTOS.find((item) => item.SEQPRODUTO === productId);
    if (!product || Number(product.SALDO_CONTRATO || 0) <= 0) return false;
    if (!product.REGRA_VALIDADE_CONFIGURADA) return true;
    const minimumDate = comparableDate(product.DATA_MINIMA_PRODUCAO);
    return minimumDate != null && lotDate >= minimumDate;
  });
};

const productContractsForValidity = (
  productId: number,
  contracts: ExportContract[],
) => contracts.filter((contract) =>
  !contract.DESCONSIDERADO
  && contract.PRODUTOS.some((product) =>
    product.SEQPRODUTO === productId && Number(product.SALDO_CONTRATO || 0) > 0,
  ),
);

const reviewLotValidityStatus = (
  productId: number,
  productionDate: string | null | undefined,
  contracts: ExportContract[],
): ContractStockLot["SITUACAO_VALIDADE"] => {
  if (comparableDate(productionDate) == null) return "SEM_DATA";
  const productContracts = productContractsForValidity(productId, contracts);
  if (productContracts.length === 0) return "INCOMPATIVEL";
  const compatible = compatibleContractsForLot(productId, productionDate, productContracts);
  if (compatible.length === 0) return "INCOMPATIVEL";
  if (compatible.length < productContracts.length) return "ATENCAO";
  return "ELEGIVEL";
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

type StockSortKey = keyof Pick<
  ContractStock,
  | "SEQPRODUTO"
  | "DESCRPRODUTO"
  | "PESODISPONIVEL"
  | "PESO_VENDIDO_ATIVO"
  | "PESO_ATRELADO_ORDEM"
  | "PESO_RESERVADO_PEDIDO"
  | "PESO_BLOQUEADO_ERP"
  | "PESO_RESERVADO_VERTICE"
  | "PESO_ATRELADO_TOTAL"
  | "PESO_LIVRE_VERTICE"
  | "ESTOQUE_SEM_VENDA"
  | "PESO_MAIS_6_MESES"
  | "PESO_RESERVADO_6_MESES"
  | "PESO_MAIS_6_MESES_LIVRE"
  | "SITUACAO_6_MESES"
>;
type SortDirection = "asc" | "desc";
type ContractSortKey =
  | "ITEM_COUNT"
  | "NROCONTRATO"
  | "NOMERAZAO"
  | "PAISDESTINO"
  | "PRIORIDADE"
  | "DTA_EMBARQUE_PLANEJADA"
  | "PRAZO_DIAS"
  | "PREVISAO_TERMINO_PRODUCAO"
  | "PESO_TOTAL"
  | "COBERTURA"
  | "SALDO_TOTAL"
  | "STATUS_ERP";

const priorityOrder: Record<string, number> = {
  BAIXA: 1,
  MEDIA: 2,
  ALTA: 3,
  URGENTE: 4,
};

type ContractWorkspaceView =
  | PcpView
  | "VISAO_GERAL"
  | "CONTRATOS"
  | "ALOCACAO"
  | "ALOCADOS"
  | "REVISAR_DATAS";

const contractWorkspaceFromLocation = (
  pathname: string,
  searchParams: string,
): ContractWorkspaceView => {
  if (pathname.endsWith("/visao-geral")) return "VISAO_GERAL";
  if (pathname.endsWith("/alocacao")) return "ALOCACAO";
  if (pathname.endsWith("/alocados")) return "ALOCADOS";
  if (pathname.endsWith("/revisao-datas")) return "REVISAR_DATAS";
  if (pathname.endsWith("/configuracao/desossa")) return "CONFIGURACAO";
  if (pathname.endsWith("/configuracao/importacao")) return "IMPORTACAO";
  if (pathname.endsWith("/configuracao/calendario")) return "CALENDARIO_EMBARQUE";
  if (pathname.endsWith("/configuracao/recomendacao")) return "RECOMENDACAO";
  if (pathname.endsWith("/configuracao/ocupacao")) return "LINHA_TEMPO";
  const view = new URLSearchParams(searchParams).get("view")?.toUpperCase();
  if (
    view === "IMPORTACAO" ||
    view === "CONFIGURACAO" ||
    view === "MANUAL" ||
    view === "CALENDARIO_EMBARQUE" ||
    view === "RECOMENDACAO" ||
    view === "LINHA_TEMPO"
  ) return view;
  return "CONTRATOS";
};

const contractWorkspaceMeta = (view: ContractWorkspaceView) => {
  if (view === "VISAO_GERAL") return { icon: BarChart3, eyebrow: "Centro de controle PCP", title: "Visão geral", description: "Contratos, estoque livre, validade e decisões que exigem ação em um único painel." };
  if (view === "CONTRATOS") return { icon: FileSignature, eyebrow: "PCP · Exportação", title: "Gestão de contratos", description: "Acompanhe cobertura, embarque e a composição dos pesos de cada produto." };
  if (view === "ALOCACAO") return { icon: Boxes, eyebrow: "Estoque · Contratos", title: "Alocação de estoque", description: "Distribua apenas o estoque realmente livre, respeitando OP, pedidos e validade." };
  if (view === "ALOCADOS") return { icon: CheckCircle2, eyebrow: "Estoque · Conciliação", title: "Alocações existentes", description: "Consulte a origem de cada peso e ajuste somente a parcela manual editável." };
  if (view === "REVISAR_DATAS") return { icon: CalendarDays, eyebrow: "Estoque · Validade", title: "Revisão de datas", description: "Trate lotes sem contrato elegível, sem rastreabilidade ou que exigem decisão operacional." };
  if (view === "CONFIGURACAO") return { icon: Factory, eyebrow: "Configuração PCP", title: "Configuração da desossa", description: "Defina premissas produtivas, quarteio, exportação e capacidade de estoque." };
  if (view === "IMPORTACAO") return { icon: FileSpreadsheet, eyebrow: "Configuração PCP", title: "Importar planilha", description: "Revise e aplique os dados operacionais da planilha de contratos." };
  if (view === "CALENDARIO_EMBARQUE") return { icon: CalendarDays, eyebrow: "Configuração PCP", title: "Calendário de embarques", description: "Visualize contratos, cobertura e risco agrupados por data planejada." };
  if (view === "RECOMENDACAO") return { icon: ShieldAlert, eyebrow: "Configuração PCP", title: "Recomendação PCP", description: "Painel de recomendação temporariamente em manutenção." };
  if (view === "LINHA_TEMPO") return { icon: BarChart3, eyebrow: "Configuração PCP", title: "Ocupação do estoque", description: "Projeção de capacidade temporariamente em manutenção." };
  return { icon: FileSignature, eyebrow: "PCP", title: "Manual operacional", description: "Regras e orientações do módulo de contratos." };
};

const contractSortValue = (contract: ExportContract, key: ContractSortKey): string | number | null => {
  if (key === "ITEM_COUNT") return contract.PRODUTOS.length;
  if (key === "PRIORIDADE") return priorityOrder[contract.PRIORIDADE] || 0;
  if (key === "DTA_EMBARQUE_PLANEJADA") {
    if (!contract.DTA_EMBARQUE_PLANEJADA) return null;
    const timestamp = new Date(contract.DTA_EMBARQUE_PLANEJADA).getTime();
    return Number.isNaN(timestamp) ? null : timestamp;
  }
  if (key === "STATUS_OPERACIONAL") return contract.EM_EXPEDICAO ? "EM_EXPEDICAO" : contract.STATUS_OPERACIONAL;
  if (key === "PRAZO_DIAS") return contract.PRAZO_DIAS == null ? null : Number(contract.PRAZO_DIAS);
  if (key === "PREVISAO_TERMINO_PRODUCAO") return contract.PREVISAO_TERMINO_PRODUCAO
    ? new Date(contract.PREVISAO_TERMINO_PRODUCAO).getTime()
    : null;
  if (key === "PESO_TOTAL") return Number(contract.PESO_TOTAL || 0);
  if (key === "COBERTURA") return contractCoverage(contract);
  if (key === "SALDO_TOTAL") return Number(contract.SALDO_TOTAL || 0);
  return String(contract[key] || "");
};

const compareContracts = (
  first: ExportContract,
  second: ExportContract,
  sort: { key: ContractSortKey; direction: SortDirection },
) => {
  const firstValue = contractSortValue(first, sort.key);
  const secondValue = contractSortValue(second, sort.key);
  const firstMissing = firstValue == null || firstValue === "";
  const secondMissing = secondValue == null || secondValue === "";
  if (firstMissing !== secondMissing) return firstMissing ? 1 : -1;
  if (firstMissing && secondMissing) return 0;
  const comparison = typeof firstValue === "number" && typeof secondValue === "number"
    ? firstValue - secondValue
    : String(firstValue).localeCompare(String(secondValue), "pt-BR", { numeric: true, sensitivity: "base" });
  return sort.direction === "asc" ? comparison : -comparison;
};

type TableSortState<K extends string = string> = { key: K; direction: SortDirection };

const nextTableSort = <K extends string>(current: TableSortState<K>, key: K): TableSortState<K> => ({
  key,
  direction: current.key === key && current.direction === "asc" ? "desc" : "asc",
});

const compareTableValues = (first: unknown, second: unknown, direction: SortDirection) => {
  const firstMissing = first == null || first === "";
  const secondMissing = second == null || second === "";
  if (firstMissing !== secondMissing) return firstMissing ? 1 : -1;
  if (firstMissing && secondMissing) return 0;
  const firstNumber = typeof first === "number" ? first : Number.NaN;
  const secondNumber = typeof second === "number" ? second : Number.NaN;
  const comparison = Number.isFinite(firstNumber) && Number.isFinite(secondNumber)
    ? firstNumber - secondNumber
    : String(first).localeCompare(String(second), "pt-BR", { numeric: true, sensitivity: "base" });
  return direction === "asc" ? comparison : -comparison;
};

export default function Contratos() {
  const location = useLocation();
  const navigate = useNavigate();
  const [data, setData] = useState<ContractsPanelResponse | null>(null);
  const [workspaceView, setWorkspaceView] = useState<ContractWorkspaceView>(
    contractWorkspaceFromLocation(location.pathname, location.search),
  );
  const workspaceViewRef = useRef<ContractWorkspaceView>(workspaceView);
  const workspaceScrollPositions = useRef<Partial<Record<ContractWorkspaceView, number>>>({});
  const reservationRefreshTimerRef = useRef<number | null>(null);
  const [exporting, setExporting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncingStock, setSyncingStock] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState("");
  const [country, setCountry] = useState("TODOS");
  const [contractTab, setContractTab] = useState<"ATIVOS" | "DESCONSIDERADOS">("ATIVOS");
  const [stockSearch, setStockSearch] = useState("");
  const [selectedStockProduct, setSelectedStockProduct] = useState<number | null>(null);
  const [preferredAllocationContractId, setPreferredAllocationContractId] = useState<number | null>(null);
  const [contractSort, setContractSort] = useState<{ key: ContractSortKey; direction: SortDirection }>({ key: "NROCONTRATO", direction: "asc" });
  const [stockSort, setStockSort] = useState<{ key: StockSortKey; direction: SortDirection }>({ key: "PESODISPONIVEL", direction: "desc" });
  const [reservationInputs, setReservationInputs] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [expeditionContract, setExpeditionContract] = useState<ExportContract | null>(null);
  const [forecastContract, setForecastContract] = useState<ExportContract | null>(null);
  const [disregardContract, setDisregardContract] = useState<ExportContract | null>(null);
  const [disregardNote, setDisregardNote] = useState("");

  const loadPanel = async (silent = false, refreshStock = false, recalculate = false) => {
    if (!silent) setLoading(true);
    try {
      setData(await contractsApi.getPanel(refreshStock, recalculate));
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    void loadPanel();
    return () => {
      if (reservationRefreshTimerRef.current !== null) {
        window.clearTimeout(reservationRefreshTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const nextView = contractWorkspaceFromLocation(location.pathname, location.search);
    const currentView = workspaceViewRef.current;
    if (nextView === currentView) return;

    workspaceScrollPositions.current[currentView] = window.scrollY;
    workspaceViewRef.current = nextView;
    setWorkspaceView(nextView);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        window.scrollTo({ top: workspaceScrollPositions.current[nextView] ?? 0, behavior: "auto" });
      });
    });
  }, [location.pathname, location.search]);

  const navigateToWorkspace = (
    nextView: ContractWorkspaceView,
    target: string,
  ) => {
    const currentView = workspaceViewRef.current;
    workspaceScrollPositions.current[currentView] = window.scrollY;
    workspaceViewRef.current = nextView;
    setWorkspaceView(nextView);
    navigate(target);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        window.scrollTo({ top: workspaceScrollPositions.current[nextView] ?? 0, behavior: "auto" });
      });
    });
  };

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

  const activeContracts = useMemo(
    () => (data?.contratos || []).filter((item) => !item.DESCONSIDERADO),
    [data?.contratos],
  );
  const disregardedContracts = useMemo(
    () => (data?.contratos || []).filter((item) => item.DESCONSIDERADO),
    [data?.contratos],
  );
  const tabContracts = contractTab === "ATIVOS" ? activeContracts : disregardedContracts;
  const countries = useMemo(() => Array.from(
    new Set(tabContracts.map((item) => item.PAISDESTINO).filter(Boolean)),
  ).sort((a, b) => String(a).localeCompare(String(b), "pt-BR")), [tabContracts]);

  const contracts = useMemo(() => {
    const contractSearchTerm = normalizeSearch(search);
    return tabContracts.filter((contract) => {
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
    }).sort((first, second) => compareContracts(first, second, contractSort));
  }, [tabContracts, search, country, contractSort]);

  const changeContractSort = (key: ContractSortKey) => {
    setContractSort((current) => ({
      key,
      direction: current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  };

  const stock = (data?.estoque || []).filter((item) => {
    const term = normalizeSearch(stockSearch);
    const matchesSearch =
      !term ||
      String(item.SEQPRODUTO).includes(term) ||
      normalizeSearch(item.DESCRPRODUTO).includes(term);
    const hasFreeStock = Number(item.PESO_LIVRE_VERTICE) > 0;
    const hasManualAllocation = Number(item.PESO_RESERVADO_VERTICE) > 0;
    const hasAgedStock = Number(item.PESO_MAIS_6_MESES) > 0;
    const hasErpStock = Number(item.PESODISPONIVEL) > 0;
    const hasTrackedLots = (item.LOTES_LIVRES || []).some(
      (lot) => Number(lot.PESO_LIVRE_ESTIMADO || 0) > 0,
    );
    return matchesSearch && (
      hasFreeStock || hasManualAllocation || hasAgedStock || hasErpStock || hasTrackedLots
    );
  }).sort((first, second) => {
    const firstValue = first[stockSort.key];
    const secondValue = second[stockSort.key];
    const comparison = stockSort.key === "DESCRPRODUTO" || stockSort.key === "SITUACAO_6_MESES"
      ? String(firstValue || "").localeCompare(String(secondValue || ""), "pt-BR", { numeric: true })
      : Number(firstValue || 0) - Number(secondValue || 0);
    return stockSort.direction === "asc" ? comparison : -comparison;
  });

  const selectedStock = (data?.estoque || []).find(
    (item) => item.SEQPRODUTO === selectedStockProduct,
  ) || null;
  const selectedProductContracts = activeContracts
    .map((contract) => ({
      contract,
      product: contract.PRODUTOS.find(
        (product) => product.SEQPRODUTO === selectedStockProduct,
      ),
    }))
    .filter(
      (item): item is { contract: ExportContract; product: ContractProduct } =>
        Boolean(item.product),
    )
    .sort((first, second) => compareContracts(first.contract, second.contract, {
      key: "DTA_EMBARQUE_PLANEJADA",
      direction: "asc",
    }));
  const allocatedStockItems = activeContracts.flatMap((contract) =>
    contract.PRODUTOS
      .filter((product) => Number(product.PESO_ATRELADO_TOTAL || 0) > 0)
      .map((product) => ({ contract, product })),
  );

  const changeStockSort = (key: StockSortKey) => {
    setStockSort((current) => ({
      key,
      direction: current.key === key && current.direction === "desc" ? "asc" : "desc",
    }));
  };

  const totalContracted = activeContracts.reduce((sum, item) => sum + Number(item.PESO_TOTAL || 0), 0);
  const totalReserved = activeContracts.reduce((sum, item) => sum + Number(item.PESO_RESERVADO || 0), 0);
  const totalStock = (data?.estoque || []).reduce((sum, item) => sum + Number(item.PESO_LIVRE_VERTICE || 0), 0);
  const totalErpStock = (data?.estoque || []).reduce((sum, item) => sum + Number(item.PESODISPONIVEL || 0), 0);
  const totalOrderStock = (data?.estoque || []).reduce((sum, item) => sum + Number(item.PESO_ATRELADO_ORDEM || 0), 0);
  const totalOrderReservation = (data?.estoque || []).reduce((sum, item) => sum + Number(item.PESO_RESERVADO_PEDIDO || 0), 0);
  const totalBlockedStock = (data?.estoque || []).reduce((sum, item) => sum + Number(item.PESO_BLOQUEADO_ERP || 0), 0);
  const totalManualStock = (data?.estoque || []).reduce((sum, item) => sum + Number(item.PESO_RESERVADO_VERTICE || 0), 0);
  const totalAgedAllocated = (data?.estoque || []).reduce((sum, item) => sum + Number(item.PESO_RESERVADO_6_MESES || 0), 0);
  const validityAlertCount = activeContracts.reduce(
    (sum, contract) => sum + contract.PRODUTOS.filter((product) =>
      !product.REGRA_VALIDADE_CONFIGURADA || Number(product.PESO_ESTOQUE_INCOMPATIVEL || 0) > 0,
    ).length,
    0,
  );

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

  const exportPlanning = async () => {
    if (!data) return;
    setExporting(true);
    try {
      await exportContractsPlanningToExcel({
        contracts,
        stock: data.estoque,
        title: contractTab === "ATIVOS"
          ? "PLANILHA DE CONTRATOS EXPORTAÇÃO BEAUVALLET"
          : "CONTRATOS DESCONSIDERADOS - BEAUVALLET",
      });
      toast.success("Planilha de contratos exportada.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setExporting(false);
    }
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

  const saveReservation = async (
    contract: ExportContract,
    product: ContractProduct,
    fallbackWeight?: number,
    inputMode: ReservationInputMode = "TOTAL",
  ) => {
    if (!data?.estrutura_configurada) {
      toast.warning("Execute a migração antes de travar estoque.");
      return;
    }
    const key = `${contract.SEQCONTRATO}-${product.SEQPRODUTO}`;
    const raw = inputMode === "REMOVE"
      ? "0"
      : reservationInputs[key] ?? (fallbackWeight == null ? "" : allocationInputValue(fallbackWeight));
    if (!raw.trim()) {
      toast.warning(inputMode === "ADDITION" ? "Informe o peso que deseja adicionar." : "Informe o novo total da alocação manual.");
      return;
    }
    const enteredWeight = Number(raw.replace(",", "."));
    if (!Number.isFinite(enteredWeight) || enteredWeight < 0) {
      toast.error("Informe um peso válido.");
      return;
    }
    const currentManual = Math.max(0, Number(product.PESO_RESERVADO_MANUAL || 0));
    const weight = inputMode === "ADDITION"
      ? Math.round((currentManual + enteredWeight) * 1000) / 1000
      : enteredWeight;

    const updateReservationLocally = () => {
      const delta = weight - currentManual;
      setData((current) => {
        if (!current) return current;
        return {
          ...current,
          contratos: current.contratos.map((item) => {
            const isEditedContract = item.SEQCONTRATO === contract.SEQCONTRATO;
            return {
              ...item,
              PESO_RESERVADO: isEditedContract ? Math.max(0, Number(item.PESO_RESERVADO || 0) + delta) : item.PESO_RESERVADO,
              SALDO_TOTAL: isEditedContract ? Math.max(0, Number(item.SALDO_TOTAL || 0) - delta) : item.SALDO_TOTAL,
              PRODUTOS: item.PRODUTOS.map((itemProduct) => {
                if (itemProduct.SEQPRODUTO !== product.SEQPRODUTO) return itemProduct;
                if (!isEditedContract) {
                  return {
                    ...itemProduct,
                    PESO_RESERVADO_TOTAL_VERTICE: Math.max(0, Number(itemProduct.PESO_RESERVADO_TOTAL_VERTICE || 0) + delta),
                    PESO_LIVRE_VERTICE: Math.max(0, Number(itemProduct.PESO_LIVRE_VERTICE || 0) - delta),
                  };
                }
                return {
                  ...itemProduct,
                  PESO_RESERVADO_MANUAL: weight,
                  PESO_RESERVADO_CONTRATO: Math.max(0, Number(itemProduct.PESO_RESERVADO_CONTRATO || 0) + delta),
                  PESO_ATRELADO_TOTAL: Math.max(0, Number(itemProduct.PESO_ATRELADO_TOTAL || 0) + delta),
                  PESO_RESERVADO_TOTAL_VERTICE: Math.max(0, Number(itemProduct.PESO_RESERVADO_TOTAL_VERTICE || 0) + delta),
                  PESO_LIVRE_VERTICE: Math.max(0, Number(itemProduct.PESO_LIVRE_VERTICE || 0) - delta),
                  SALDO_CONTRATO: Math.max(0, Number(itemProduct.SALDO_CONTRATO || 0) - delta),
                  VERSAO_RESERVA: weight === 0 ? null : Number(itemProduct.VERSAO_RESERVA || 0) + 1,
                };
              }),
            };
          }),
          estoque: current.estoque.map((item) => item.SEQPRODUTO !== product.SEQPRODUTO
            ? item
            : {
                ...item,
                PESO_RESERVADO_VERTICE: Math.max(0, Number(item.PESO_RESERVADO_VERTICE || 0) + delta),
                PESO_ATRELADO_TOTAL: Math.max(0, Number(item.PESO_ATRELADO_TOTAL || 0) + delta),
                PESO_LIVRE_VERTICE: Math.max(0, Number(item.PESO_LIVRE_VERTICE || 0) - delta),
              }),
        };
      });
    };

    const schedulePanelRefresh = () => {
      if (reservationRefreshTimerRef.current !== null) {
        window.clearTimeout(reservationRefreshTimerRef.current);
      }
      reservationRefreshTimerRef.current = window.setTimeout(() => {
        reservationRefreshTimerRef.current = null;
        void loadPanel(true, false, true);
      }, 4000);
    };

    setSaving(key);
    try {
      const result = await contractsApi.saveReservation({
        seqcontrato: contract.SEQCONTRATO,
        seqproduto: product.SEQPRODUTO,
        peso_reservado: weight,
        versao: product.VERSAO_RESERVA ?? null,
      });
      toast.success(result.message);
      updateReservationLocally();
      setReservationInputs((current) => {
        const next = { ...current };
        if (inputMode === "TOTAL" || inputMode === "REMOVE") {
          next[key] = allocationInputValue(weight);
        } else {
          delete next[key];
        }
        return next;
      });
      schedulePanelRefresh();
    } catch (error) {
      const message = errorMessage(error);
      toast.error(message);
      if (/validade|data de produ[cç][aã]o|produ[cç][aã]o m[ií]nima/i.test(message)) {
        setStockSearch(String(product.SEQPRODUTO));
        setSelectedStockProduct(null);
        setPreferredAllocationContractId(null);
        navigateToWorkspace("REVISAR_DATAS", "/contratos/revisao-datas");
        toast.info(`Produto ${product.SEQPRODUTO} aberto em Revisão de Datas.`);
      }
      await loadPanel(true);
    } finally {
      setSaving(null);
    }
  };

  const saveAgedReservation = async (contract: ExportContract, product: ContractProduct) => {
    if (!data?.estoque_6m_configurado) {
      toast.warning("Execute a migração do estoque +6 meses antes de alocar.");
      return;
    }
    const key = `aged-${contract.SEQCONTRATO}-${product.SEQPRODUTO}`;
    const raw = reservationInputs[key] ?? "";
    const weight = Number(raw.replace(",", "."));
    if (!raw.trim() || !Number.isFinite(weight) || weight < 0) {
      toast.error("Informe um peso válido para o estoque +6 meses.");
      return;
    }
    setSaving(key);
    try {
      const result = await contractsApi.saveAgedReservation({
        seqcontrato: contract.SEQCONTRATO,
        seqproduto: product.SEQPRODUTO,
        peso_reservado: weight,
        versao: product.VERSAO_RESERVA_6_MESES ?? null,
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

  const saveStockTreatment = async (
    item: ContractStock,
    changes: { situacao?: "SEPARADO" | "DISPONIVEL" | "REPROCESSO"; data_reprocesso?: string | null; sem_venda?: boolean },
  ) => {
    if (!data?.estoque_6m_configurado) {
      toast.warning("Execute a migração do estoque +6 meses antes de salvar.");
      return;
    }
    const key = `stock-treatment-${item.SEQPRODUTO}`;
    setSaving(key);
    try {
      const result = await contractsApi.saveStockTreatment({
        seqproduto: item.SEQPRODUTO,
        situacao: changes.situacao ?? item.SITUACAO_6_MESES ?? "SEPARADO",
        data_reprocesso: changes.data_reprocesso === undefined ? item.DTA_REPROCESSO : changes.data_reprocesso,
        sem_venda: changes.sem_venda ?? Boolean(item.SEM_VENDA),
        versao: item.VERSAO_TRATAMENTO ?? null,
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

  const openDisregard = (contract: ExportContract) => {
    setDisregardContract(contract);
    setDisregardNote(contract.OBSERVACAO_DESCONSIDERACAO || "");
  };

  const updateDisregardedLocally = (
    contractId: number,
    disregarded: boolean,
    observation?: string | null,
  ) => {
    setData((current) => {
      if (!current) return current;
      const contract = current.contratos.find((item) => item.SEQCONTRATO === contractId);
      if (!contract) return current;
      const direction = disregarded ? 1 : -1;
      const products = new Map(contract.PRODUTOS.map((item) => [item.SEQPRODUTO, item]));
      const recommendations = disregarded
        ? current.planejamento.RECOMENDACOES.filter((item) => item.SEQCONTRATO !== contractId)
        : current.planejamento.RECOMENDACOES;
      const ranked = recommendations.map((item, index) => ({ ...item, POSICAO: index + 1 }));
      return {
        ...current,
        contratos: current.contratos.map((item) => item.SEQCONTRATO === contractId
          ? {
              ...item,
              DESCONSIDERADO: disregarded,
              OBSERVACAO_DESCONSIDERACAO: disregarded ? observation || null : item.OBSERVACAO_DESCONSIDERACAO,
              VERSAO_CONFIG: Number(item.VERSAO_CONFIG || 0) + 1,
            }
          : item),
        estoque: current.estoque.map((item) => {
          const product = products.get(item.SEQPRODUTO);
          if (!product) return item;
          const manual = Number(product.PESO_RESERVADO_MANUAL || 0);
          const order = Number(product.PESO_ATRELADO_ORDEM || 0);
          const linked = manual + order;
          return {
            ...item,
            PESO_VENDIDO_ATIVO: Math.max(0, Number(item.PESO_VENDIDO_ATIVO) - direction * Number(product.PESOCONTRATO || 0)),
            PESO_RESERVADO_VERTICE: Math.max(0, Number(item.PESO_RESERVADO_VERTICE) - direction * manual),
            PESO_ATRELADO_ORDEM: Math.max(0, Number(item.PESO_ATRELADO_ORDEM) - direction * order),
            PESO_ATRELADO_TOTAL: Math.max(0, Number(item.PESO_ATRELADO_TOTAL) - direction * linked),
            PESO_LIVRE_VERTICE: Math.max(0, Number(item.PESO_LIVRE_VERTICE) + direction * linked),
            ESTOQUE_SEM_VENDA: Number(item.ESTOQUE_SEM_VENDA) + direction * Number(product.PESOCONTRATO || 0),
          };
        }),
        planejamento: {
          ...current.planejamento,
          RECOMENDACOES: ranked,
          RESUMO: {
            CONTRATOS_ANALISADOS: ranked.length,
            CONTRATOS_CRITICOS: ranked.filter((item) => item.DECISAO === "CRITICO" || item.ESTOQUE_PROJETADO_SITUACAO === "LIMITE").length,
            PESO_FALTANTE: ranked.reduce((sum, item) => sum + Number(item.FALTANTE_PRODUZIR || 0), 0),
            EXCESSO_PROJETADO: ranked.reduce((sum, item) => sum + Number(item.EXCESSO_PROJETADO || 0), 0),
          },
        },
      };
    });
  };

  const saveDisregard = async () => {
    if (!disregardContract) return;
    const key = `disregard-${disregardContract.SEQCONTRATO}`;
    setSaving(key);
    try {
      const result = await contractsApi.setDisregarded({
        seqcontrato: disregardContract.SEQCONTRATO,
        desconsiderado: true,
        observacao: disregardNote.trim() || null,
        versao: disregardContract.VERSAO_CONFIG ?? null,
      });
      updateDisregardedLocally(
        disregardContract.SEQCONTRATO,
        true,
        disregardNote.trim() || null,
      );
      toast.success(result.message);
      setDisregardContract(null);
      setDisregardNote("");
      void loadPanel(true);
    } catch (error) {
      toast.error(errorMessage(error));
      void loadPanel(true);
    } finally {
      setSaving(null);
    }
  };

  const restoreContract = async (contract: ExportContract) => {
    const key = `restore-${contract.SEQCONTRATO}`;
    setSaving(key);
    try {
      const result = await contractsApi.setDisregarded({
        seqcontrato: contract.SEQCONTRATO,
        desconsiderado: false,
        versao: contract.VERSAO_CONFIG ?? null,
      });
      updateDisregardedLocally(contract.SEQCONTRATO, false);
      toast.success(result.message);
      void loadPanel(true);
    } catch (error) {
      toast.error(errorMessage(error));
      void loadPanel(true);
    } finally {
      setSaving(null);
    }
  };

  const pageMeta = contractWorkspaceMeta(workspaceView);
  const PageIcon = pageMeta.icon;
  const isContractOperations = workspaceView === "CONTRATOS"
    || workspaceView === "ALOCACAO"
    || workspaceView === "ALOCADOS"
    || workspaceView === "REVISAR_DATAS";

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
    <div className="min-h-full bg-[linear-gradient(135deg,#F2F6F9_0%,#F8FAFC_52%,#EDF3F7_100%)] p-3 sm:p-5 lg:p-7">
      <div className="mx-auto max-w-[1650px] space-y-5">
        <header className={isContractOperations ? "px-1 py-2" : "rounded-2xl border border-[#CBD8E3] bg-white p-5 shadow-[0_8px_24px_rgba(23,61,110,0.07)]"}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#E8F1F8] text-[#174A78]"><PageIcon className="h-6 w-6" /></div>
              <div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#60758A]">{pageMeta.eyebrow}</p><h1 className="text-2xl font-black tracking-tight text-[#102F53] sm:text-[28px]">{pageMeta.title}</h1><p className="mt-0.5 text-xs font-medium text-[#667B90]">{pageMeta.description}</p></div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {workspaceView === "ALOCACAO" && selectedStockProduct !== null && <Button type="button" variant="outline" onClick={() => { setSelectedStockProduct(null); setPreferredAllocationContractId(null); }} className="h-11 border-[#8FB1CE] px-5 text-sm font-black text-[#173D6E] shadow-sm hover:bg-blue-50"><ChevronLeft className="mr-2 h-5 w-5" />Escolher outro produto</Button>}
              {!isContractOperations && (workspaceView === "ALOCACAO" || workspaceView === "ALOCADOS" || workspaceView === "REVISAR_DATAS") && <Button type="button" variant="outline" onClick={() => { setSelectedStockProduct(null); navigateToWorkspace("CONTRATOS", "/contratos"); }} className="border-[#AFC1D1] text-[#173D6E]"><FileSignature className="mr-2 h-4 w-4" />Ir para contratos</Button>}
              {!isContractOperations && workspaceView === "CONTRATOS" && <Button type="button" onClick={() => navigateToWorkspace("ALOCACAO", "/contratos/alocacao")} className="bg-[#173D6E] text-white hover:bg-[#0F3157]"><Boxes className="mr-2 h-4 w-4" />Ir para alocação de estoque</Button>}
              {workspaceView === "VISAO_GERAL" && <Button type="button" onClick={() => navigateToWorkspace("CONTRATOS", "/contratos")} className="bg-[#173D6E] text-white hover:bg-[#0F3157]"><FileSignature className="mr-2 h-4 w-4" />Ver contratos</Button>}
              <Button variant="outline" onClick={() => void loadPanel(false, false, true)} className="border-[#AFC1D1] text-[#244B70]"><RefreshCw className="mr-2 h-4 w-4" />Atualizar</Button>
            </div>
          </div>
        </header>

        {false && workspaceView !== "ALOCACAO" && <nav className="overflow-x-auto rounded-xl border border-[#CEDAE5] bg-white p-2 shadow-sm">
          <div className="flex w-full min-w-max gap-1">
            {([
              ["CONTRATOS", "Contratos"],
              ["ALOCACAO", "Alocação de estoque"],
              ["CALENDARIO_EMBARQUE", "Calendário de embarques"],
              ["IMPORTACAO", "Importar planilha"],
              ["CONFIGURACAO", "Configuração da desossa"],
              ["MANUAL", "Manual"],
            ] as const).map(([value, label]) => (
              <button key={value} type="button" onClick={() => { if (value === "CONTRATOS") navigateToWorkspace(value, "/contratos"); else if (value === "ALOCACAO") navigateToWorkspace(value, "/contratos/alocacao"); else navigateToWorkspace(value, `/contratos?view=${value.toLowerCase()}`); }} className={`rounded-lg px-4 py-2.5 text-xs font-black transition-colors ${workspaceView === value ? "bg-[#173D6E] text-white shadow-sm" : "text-[#47627D] hover:bg-[#EDF3F7]"}`}>
                {label}
              </button>
            ))}
            <div className="ml-auto flex gap-1 border-l border-[#D8E2EA] pl-2">
              {([
                ["RECOMENDACAO", "Sugestões"],
                ["LINHA_TEMPO", "Calendário de ocupação"],
              ] as const).map(([value, label]) => (
                <button key={value} type="button" onClick={() => navigateToWorkspace(value, `/contratos?view=${value.toLowerCase()}`)} className={`rounded-lg px-4 py-2.5 text-xs font-black transition-colors ${workspaceView === value ? "bg-[#173D6E] text-white shadow-sm" : "bg-[#F3F6F8] text-[#47627D] hover:bg-[#E7EEF4]"}`}>
                  {label}
                  <span className={`ml-2 rounded-full px-2 py-0.5 text-[8px] uppercase tracking-wider ${workspaceView === value ? "bg-white/15 text-white" : "bg-amber-100 text-amber-800"}`}>Manutenção</span>
                </button>
              ))}
            </div>
          </div>
        </nav>}

        {!data?.estrutura_configurada && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div><p className="text-sm font-black">Planejamento em modo de consulta</p><p className="mt-1 text-xs font-medium">Execute <code>sql/criar_modulo_contratos.sql</code> em uma instalação nova e <code>sql/migrar_contratos_pcp.sql</code> nas instalações existentes.</p></div>
          </div>
        )}

        {data && (workspaceView === "IMPORTACAO" || workspaceView === "CONFIGURACAO" || workspaceView === "MANUAL" || workspaceView === "CALENDARIO_EMBARQUE" || workspaceView === "RECOMENDACAO" || workspaceView === "LINHA_TEMPO") && (
          <PcpWorkspace view={workspaceView} data={data} reload={() => loadPanel(true)} />
        )}

        {workspaceView === "VISAO_GERAL" && (
          <ContractsOverview
            contracts={activeContracts}
            stock={data?.estoque || []}
            onOpenContracts={() => navigateToWorkspace("CONTRATOS", "/contratos")}
            onOpenContract={(contract) => {
              setContractTab("ATIVOS");
              setCountry("TODOS");
              setSearch(contract.NROCONTRATO);
              setExpanded(new Set([contract.SEQCONTRATO]));
              navigateToWorkspace("CONTRATOS", "/contratos");
            }}
            onOpenProduct={(productId) => {
              setPreferredAllocationContractId(null);
              setSelectedStockProduct(productId);
              navigateToWorkspace("ALOCACAO", "/contratos/alocacao");
            }}
            onReviewDates={() => navigateToWorkspace("REVISAR_DATAS", "/contratos/revisao-datas")}
          />
        )}

        {workspaceView === "CONTRATOS" && (
          <ContractsManagementLayout
            contracts={[...tabContracts].sort((first, second) => compareContracts(first, second, contractSort))}
            contractSort={contractSort}
            onContractSort={changeContractSort}
            activeCount={activeContracts.length}
            disregardedCount={disregardedContracts.length}
            contractTab={contractTab}
            onContractTabChange={(tab) => {
              setContractTab(tab);
              setCountry("TODOS");
            }}
            search={search}
            onSearchChange={setSearch}
            country={country}
            onCountryChange={setCountry}
            countries={countries}
            expanded={expanded}
            onToggleExpanded={toggleExpanded}
            configured={Boolean(data?.estrutura_configurada)}
            saving={saving}
            notes={notes}
            setNotes={setNotes}
            onSaveConfig={saveConfig}
            onDisregard={openDisregard}
            onRestore={restoreContract}
            onForecast={setForecastContract}
            onExpedition={setExpeditionContract}
            onExport={exportPlanning}
            exporting={exporting}
            onAllocate={(productId, contractId) => {
              setPreferredAllocationContractId(contractId);
              setSelectedStockProduct(productId);
              navigateToWorkspace("ALOCACAO", "/contratos/alocacao");
            }}
          />
        )}

        <div className="hidden">
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard icon={FileSignature} label="Contratos ativos" value={String(activeContracts.length)} />
          <MetricCard icon={Weight} label="Peso contratado" value={formatKg(totalContracted)} />
          <MetricCard icon={LockKeyhole} label="Peso alocado" value={formatKg(totalReserved)} />
          <MetricCard icon={Boxes} label="Saldo dos contratos" value={formatKg(activeContracts.reduce((sum, item) => sum + Number(item.SALDO_TOTAL || 0), 0))} />
        </section>

        <div className="hidden">
          <Button type="button" onClick={() => void exportPlanning()} disabled={exporting || contracts.length === 0} className="bg-emerald-700 hover:bg-emerald-800">
            <FileSpreadsheet className="mr-2 h-4 w-4" />{exporting ? "Gerando Excel..." : "Exportar Excel"}
          </Button>
        </div>

        <Card className="border-[#CEDAE5] shadow-sm">
          <CardContent className="p-0">
            <div className="flex flex-col gap-3 border-b border-[#DCE5ED] p-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-3"><div><h2 className="text-base font-black text-[#173D6E]">{contractTab === "ATIVOS" ? "Contratos ativos" : "Contratos desconsiderados"} ({contracts.length})</h2><p className="mt-0.5 text-xs text-[#6B7F92]">{contractTab === "ATIVOS" ? "Ordenados do contrato mais antigo para o mais recente." : "Contratos retirados do planejamento ativo, sem exclusão dos dados."}</p></div><div className="inline-flex rounded-lg border border-[#C7D4E0] bg-[#F4F7FA] p-1"><button type="button" onClick={() => { setContractTab("ATIVOS"); setCountry("TODOS"); }} className={`rounded-md px-3 py-1.5 text-xs font-black ${contractTab === "ATIVOS" ? "bg-[#244B70] text-white shadow-sm" : "text-[#526A80]"}`}>Ativos <span className="ml-1 opacity-75">{activeContracts.length}</span></button><button type="button" onClick={() => { setContractTab("DESCONSIDERADOS"); setCountry("TODOS"); }} className={`rounded-md px-3 py-1.5 text-xs font-black ${contractTab === "DESCONSIDERADOS" ? "bg-[#244B70] text-white shadow-sm" : "text-[#526A80]"}`}>Desconsiderados <span className="ml-1 opacity-75">{disregardedContracts.length}</span></button></div></div>
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
                <Button type="button" onClick={() => void exportPlanning()} disabled={exporting || contracts.length === 0} className="h-10 bg-emerald-700 hover:bg-emerald-800"><FileSpreadsheet className="mr-2 h-4 w-4" />{exporting ? "Gerando..." : "Excel"}</Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <Table className="w-full min-w-[980px] table-fixed [&_td]:px-2 [&_th]:px-2">
                <TableHeader className="bg-[#EDF3F7]"><TableRow><SortableContractHeader label="Itens" sortKey="ITEM_COUNT" activeSort={contractSort} onSort={changeContractSort} centered className="w-[64px]" /><SortableContractHeader label="Nº contrato" sortKey="NROCONTRATO" activeSort={contractSort} onSort={changeContractSort} className="w-[105px]" /><SortableContractHeader label="Cliente" sortKey="NOMERAZAO" activeSort={contractSort} onSort={changeContractSort} /><SortableContractHeader label="País" sortKey="PAISDESTINO" activeSort={contractSort} onSort={changeContractSort} className="w-[90px]" /><SortableContractHeader label="Embarque planejado" sortKey="DTA_EMBARQUE_PLANEJADA" activeSort={contractSort} onSort={changeContractSort} className="w-[158px]" /><SortableContractHeader label="Prazo" sortKey="PRAZO_DIAS" activeSort={contractSort} onSort={changeContractSort} className="w-[82px]" /><SortableContractHeader label="Previsão término" sortKey="PREVISAO_TERMINO_PRODUCAO" activeSort={contractSort} onSort={changeContractSort} className="w-[135px]" /><SortableContractHeader label="Peso total" sortKey="PESO_TOTAL" activeSort={contractSort} onSort={changeContractSort} numeric className="w-[120px]" /><SortableContractHeader label="Status ERP" sortKey="STATUS_ERP" activeSort={contractSort} onSort={changeContractSort} className="w-[132px]" /><Header className="w-[124px] text-center">Ação</Header></TableRow></TableHeader>
                <TableBody>
                  {contracts.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={10} className="h-28 text-center text-sm font-semibold text-[#6B7F92]">
                        {contractTab === "ATIVOS"
                          ? "Nenhum contrato ativo encontrado com os filtros informados."
                          : "Nenhum contrato foi desconsiderado."
                        }
                      </TableCell>
                    </TableRow>
                  )}
                  {contracts.map((contract) => {
                    const isOpen = expanded.has(contract.SEQCONTRATO);
                    const validCoveredWeight = contract.PRODUTOS.reduce(
                      (total, product) => total + Math.min(Number(product.PESOCONTRATO || 0), Number(product.PESO_ATRELADO_TOTAL || 0)),
                      0,
                    );
                    const coverageWeight = contract.EM_EXPEDICAO
                      ? Number(contract.PESO_EXPEDIDO || 0)
                      : validCoveredWeight;
                    const coverage = contract.PESO_TOTAL > 0 ? Math.min(100, (coverageWeight / contract.PESO_TOTAL) * 100) : 0;
                    const coverageComplete = coverage >= 98;
                    return [
                      <TableRow key={`main-${contract.SEQCONTRATO}`} className={coverageComplete ? "border-emerald-200 bg-emerald-50/80 hover:bg-emerald-100/70" : "border-[#DCE5ED] hover:bg-[#F8FAFC]"}>
                        <TableCell className="text-center"><Button variant="outline" size="sm" className="h-8 min-w-[50px] gap-1 border-[#B9CAD8] px-2 text-[#244B70]" title={isOpen ? "Fechar produtos" : "Abrir produtos"} aria-label={isOpen ? "Fechar produtos do contrato" : "Abrir produtos do contrato"} onClick={() => toggleExpanded(contract.SEQCONTRATO)}>{isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}<span className="text-[10px] font-black">{contract.PRODUTOS.length}</span></Button></TableCell>
                        <TableCell><button type="button" onClick={() => toggleExpanded(contract.SEQCONTRATO)} className="font-mono text-xs font-black text-[#244B70] hover:underline">{contract.NROCONTRATO}</button><p className="mt-1 text-[10px] text-[#778A9D]">{formatDate(contract.DTACONTRATO)}</p>{coverageComplete && <span className="mt-1 inline-flex whitespace-nowrap rounded-full border border-emerald-300 bg-emerald-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-emerald-800">Cobertura concluída</span>}</TableCell>
                        <TableCell><p className="truncate text-xs font-black text-[#173D6E]" title={contract.NOMERAZAO}>{contract.NOMERAZAO}</p>{contract.DESCONSIDERADO && contract.OBSERVACAO_DESCONSIDERACAO && <p className="mt-1 line-clamp-2 text-[10px] font-semibold text-amber-800" title={contract.OBSERVACAO_DESCONSIDERACAO}>{contract.OBSERVACAO_DESCONSIDERACAO}</p>}</TableCell>
                        <TableCell><p className="truncate text-xs font-semibold text-[#5D7185]" title={contract.PAISDESTINO || ""}>{contract.PAISDESTINO || "—"}</p></TableCell>
                        <TableCell><Input type="date" disabled={!data?.estrutura_configurada || saving === `config-${contract.SEQCONTRATO}`} value={inputDate(contract.DTA_EMBARQUE_PLANEJADA)} onChange={(event) => void saveConfig(contract, { DTA_EMBARQUE_PLANEJADA: event.target.value })} className="h-8 w-full min-w-[140px] px-2 text-[11px] [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-100" /></TableCell>
                        <TableCell><Deadline days={contract.PRAZO_DIAS} /></TableCell>
                        <TableCell>{Number(contract.PESO_RESERVADO || 0) > 0 ? (contract.PREVISAO_TERMINO_PRODUCAO ? <button type="button" onClick={() => setForecastContract(contract)} className="whitespace-nowrap text-xs font-black text-[#173D6E] underline decoration-dotted underline-offset-4 hover:text-[#2D6A9F]" title="Ver cálculo da previsão">{formatDate(contract.PREVISAO_TERMINO_PRODUCAO)}</button> : <span className="text-[10px] font-bold text-amber-700" title="Revise a configuração da desossa ou as metas dos produtos">Não calculada</span>) : <span className="text-xs font-semibold text-[#9AA8B5]">—</span>}</TableCell>
                        <TableCell className="text-right"><p className="whitespace-nowrap text-xs font-black text-[#173D6E]">{formatKg(contract.PESO_TOTAL)}</p><div className="mt-1 flex items-center justify-end gap-1"><Progress value={coverage} className={`h-1.5 w-12 ${coverageComplete ? "[&>div]:bg-emerald-600" : ""}`} /><span className={`text-[9px] font-bold ${coverageComplete ? "text-emerald-700" : "text-[#6B7F92]"}`}>{coverage.toFixed(0)}%</span></div></TableCell>
                        <TableCell>{contract.EM_EXPEDICAO ? <button type="button" onClick={() => setExpeditionContract(contract)} className="inline-flex whitespace-nowrap rounded-full border border-cyan-300 bg-cyan-50 px-2 py-1 text-[10px] font-black uppercase text-cyan-800 transition-colors hover:bg-cyan-100" title="Ver peso carregado e reservas pendentes">Em expedição</button> : <span className="inline-flex max-w-full rounded-full border border-[#C7D4E0] bg-[#F4F7FA] px-2 py-1 text-[10px] font-black uppercase text-[#405B74]" title={`Status recebido de CONTROLADORIA.BBV_CONTRATO: ${contract.STATUS_ERP || "Não informado"}`}><span className="truncate">{contract.STATUS_ERP || "Não informado"}</span></span>}</TableCell>
                        <TableCell className="text-center">{contract.DESCONSIDERADO ? <Button type="button" variant="outline" size="sm" disabled={!data?.estrutura_configurada || saving === `restore-${contract.SEQCONTRATO}`} onClick={() => void restoreContract(contract)} className="h-8 border-emerald-300 px-2 text-[10px] font-bold text-emerald-700"><RotateCcw className="mr-1 h-3.5 w-3.5" />Restaurar</Button> : <Button type="button" variant="outline" size="sm" disabled={!data?.estrutura_configurada} onClick={() => openDisregard(contract)} className="h-8 border-amber-300 px-2 text-[10px] font-bold text-amber-800"><ArchiveX className="mr-1 h-3.5 w-3.5" />Desconsiderar</Button>}</TableCell>
                      </TableRow>,
                      isOpen ? <TableRow key={`detail-${contract.SEQCONTRATO}`} className="bg-[#F6F9FB] hover:bg-[#F6F9FB]"><TableCell colSpan={10} className="p-0"><ContractDetails contract={contract} configured={Boolean(data?.estrutura_configurada)} saving={saving} notes={notes} setNotes={setNotes} onSaveConfig={saveConfig} /></TableCell></TableRow> : null,
                    ];
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        </div>

        <div className={workspaceView === "ALOCACAO" || workspaceView === "ALOCADOS" || workspaceView === "REVISAR_DATAS" ? "block" : "hidden"}>
          <StockAllocationWorkspace
            section={workspaceView === "ALOCADOS" ? "ALOCADOS" : workspaceView === "REVISAR_DATAS" ? "REVISAR_DATAS" : "DISPONIVEIS"}
            onNavigateSection={(section) => {
              if (section === "ALOCADOS") navigateToWorkspace("ALOCADOS", "/contratos/alocados");
              else if (section === "REVISAR_DATAS") navigateToWorkspace("REVISAR_DATAS", "/contratos/revisao-datas");
              else navigateToWorkspace("ALOCACAO", "/contratos/alocacao");
            }}
            stock={stock}
            totalErpStock={totalErpStock}
            totalOrderStock={totalOrderStock}
            totalOrderReservation={totalOrderReservation}
            totalBlockedStock={totalBlockedStock}
            totalManualStock={totalManualStock}
            totalFreeStock={totalStock}
            totalAgedAllocated={totalAgedAllocated}
            validityAlertCount={validityAlertCount}
            search={stockSearch}
            onSearchChange={setStockSearch}
            sort={stockSort}
            onSort={changeStockSort}
            syncing={syncingStock}
            onSync={syncStock}
            selectedStock={selectedStock}
            selectedContracts={selectedProductContracts}
            preferredContractId={preferredAllocationContractId}
            allocatedItems={allocatedStockItems}
            contracts={activeContracts}
            onSelectProduct={setSelectedStockProduct}
            configured={Boolean(data?.estrutura_configurada)}
            saving={saving}
            reservationInputs={reservationInputs}
            setReservationInputs={setReservationInputs}
            onSaveReservation={saveReservation}
            onSaveAgedReservation={saveAgedReservation}
            onSaveTreatment={saveStockTreatment}
            agedConfigured={Boolean(data?.estoque_6m_configurado)}
            lotTreatmentConfigured={Boolean(data?.estoque_lote_acao_configurado)}
          />
        </div>

        <ExpeditionDetailsDialog contract={expeditionContract} onClose={() => setExpeditionContract(null)} />
        <ProductionForecastDialog
          contract={forecastContract}
          recommendation={forecastContract ? data?.planejamento.RECOMENDACOES.find((item) => item.SEQCONTRATO === forecastContract.SEQCONTRATO) || null : null}
          onClose={() => setForecastContract(null)}
        />

        <Dialog
          open={Boolean(disregardContract)}
          onOpenChange={(open) => {
            if (!open && !saving?.startsWith("disregard-")) {
              setDisregardContract(null);
              setDisregardNote("");
            }
          }}
        >
          <DialogContent className="max-w-lg border-[#CBD8E3]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-[#173D6E]">
                <ArchiveX className="h-5 w-5 text-amber-700" />
                Desconsiderar contrato
              </DialogTitle>
              <DialogDescription>
                O contrato {disregardContract?.NROCONTRATO} sairá do planejamento ativo e ficará disponível na aba Desconsiderados. Nenhum dado ou vínculo será excluído.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <label htmlFor="disregard-note" className="text-xs font-black uppercase tracking-wider text-[#47627D]">
                Observação (opcional)
              </label>
              <Textarea
                id="disregard-note"
                value={disregardNote}
                onChange={(event) => setDisregardNote(event.target.value.slice(0, 1000))}
                placeholder="Informe o motivo ou uma observação para consulta futura."
                className="min-h-28 resize-none"
                maxLength={1000}
                autoFocus
              />
              <p className="text-right text-[10px] font-semibold text-[#7B8EA1]">{disregardNote.length}/1000</p>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                disabled={Boolean(saving?.startsWith("disregard-"))}
                onClick={() => {
                  setDisregardContract(null);
                  setDisregardNote("");
                }}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={!disregardContract || Boolean(saving?.startsWith("disregard-"))}
                onClick={() => void saveDisregard()}
                className="bg-amber-700 text-white hover:bg-amber-800"
              >
                <ArchiveX className="mr-2 h-4 w-4" />
                {saving?.startsWith("disregard-") ? "Movendo..." : "Desconsiderar contrato"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

interface ContractsManagementLayoutProps {
  contracts: ExportContract[];
  contractSort: TableSortState<ContractSortKey>;
  onContractSort: (key: ContractSortKey) => void;
  activeCount: number;
  disregardedCount: number;
  contractTab: "ATIVOS" | "DESCONSIDERADOS";
  onContractTabChange: (tab: "ATIVOS" | "DESCONSIDERADOS") => void;
  search: string;
  onSearchChange: (value: string) => void;
  country: string;
  onCountryChange: (value: string) => void;
  countries: Array<string | null | undefined>;
  expanded: Set<number>;
  onToggleExpanded: (contractId: number) => void;
  configured: boolean;
  saving: string | null;
  notes: Record<number, string>;
  setNotes: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  onSaveConfig: (contract: ExportContract, changes: Partial<ExportContract>) => Promise<void>;
  onDisregard: (contract: ExportContract) => void;
  onRestore: (contract: ExportContract) => Promise<void>;
  onForecast: (contract: ExportContract) => void;
  onExpedition: (contract: ExportContract) => void;
  onExport: () => Promise<void>;
  exporting: boolean;
  onAllocate: (productId: number, contractId: number) => void;
}

function ContractsManagementLayout({
  contracts,
  contractSort,
  onContractSort,
  activeCount,
  disregardedCount,
  contractTab,
  onContractTabChange,
  search,
  onSearchChange,
  country,
  onCountryChange,
  countries,
  expanded,
  onToggleExpanded,
  configured,
  saving,
  notes,
  setNotes,
  onSaveConfig,
  onDisregard,
  onRestore,
  onForecast,
  onExpedition,
  onExport,
  exporting,
  onAllocate: openAllocation,
}: ContractsManagementLayoutProps) {
  const [productFilter, setProductFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("TODOS");
  const [shippingDate, setShippingDate] = useState("");
  const [selected, setSelected] = useState<{ contractId: number; productId: number } | null>(null);
  const [riskContract, setRiskContract] = useState<ExportContract | null>(null);
  const [productSort, setProductSort] = useState<TableSortState<"SEQPRODUTO" | "DESCRICAO" | "PESOCONTRATO" | "EXPEDIDO" | "OP" | "PEDIDO" | "MANUAL" | "TOTAL" | "ATENDIDO" | "SALDO" | "VALIDADE">>({ key: "SEQPRODUTO", direction: "asc" });

  const normalizedSearch = normalizeSearch(search);
  const normalizedProduct = normalizeSearch(productFilter);
  const visibleContracts = contracts.filter((contract) => {
    const productsMatch = !normalizedProduct || contract.PRODUTOS.some((product) =>
      String(product.SEQPRODUTO).includes(normalizedProduct) || normalizeSearch(product.DESCRICAO).includes(normalizedProduct),
    );
    const generalMatch = !normalizedSearch
      || normalizeSearch(contract.NROCONTRATO).includes(normalizedSearch)
      || normalizeSearch(contract.NOMERAZAO).includes(normalizedSearch);
    const statusMatch = statusFilter === "TODOS"
      || (statusFilter === "EXPEDICAO" ? contract.EM_EXPEDICAO : contract.STATUS_ERP === statusFilter);
    const dateMatch = !shippingDate || inputDate(contract.DTA_EMBARQUE_PLANEJADA || contract.DTA_EMBARQUE_ERP) === shippingDate;
    return productsMatch && generalMatch && statusMatch && dateMatch && (country === "TODOS" || contract.PAISDESTINO === country);
  });

  const selectedContract = contracts.find((contract) => contract.SEQCONTRATO === selected?.contractId) || null;
  const selectedProduct = selectedContract?.PRODUTOS.find((product) => product.SEQPRODUTO === selected?.productId) || null;
  const selectedCoveredWeight = Number(selectedProduct?.PESO_EXPEDIDO || 0)
    + Number(selectedProduct?.PESO_ATRELADO_TOTAL || 0);
  const selectedCoverage = selectedProduct && Number(selectedProduct.PESOCONTRATO || 0) > 0
    ? Math.min(100, selectedCoveredWeight / Number(selectedProduct.PESOCONTRATO) * 100)
    : 0;

  const selectContract = (contract: ExportContract) => {
    onToggleExpanded(contract.SEQCONTRATO);
    if (contract.PRODUTOS[0]) setSelected({ contractId: contract.SEQCONTRATO, productId: contract.PRODUTOS[0].SEQPRODUTO });
  };
  const onAllocate = (productId: number) => openAllocation(productId, selected?.contractId || 0);

  return <div className="space-y-4">
    <Card className="border-[#CBD8E3] shadow-[0_6px_18px_rgba(23,61,110,0.06)]"><CardContent className="p-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.1fr_0.75fr_0.8fr_1fr_0.8fr_auto]">
        <FilterField label="Cliente ou contrato"><div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-[#8396A9]" /><Input value={search} onChange={(event) => onSearchChange(event.target.value)} className="pl-9" placeholder="Número ou cliente" /></div></FilterField>
        <FilterField label="País"><select value={country} onChange={(event) => onCountryChange(event.target.value)} className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm"><option value="TODOS">Todos os países</option>{countries.filter(Boolean).map((item) => <option key={String(item)} value={String(item)}>{item}</option>)}</select></FilterField>
        <FilterField label="Embarque"><Input type="date" value={shippingDate} onChange={(event) => setShippingDate(event.target.value)} /></FilterField>
        <FilterField label="Produto"><Input value={productFilter} onChange={(event) => setProductFilter(event.target.value)} placeholder="SEQ ou descrição" /></FilterField>
        <FilterField label="Situação"><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm"><option value="TODOS">Todas as situações</option><option value="EXPEDICAO">Em expedição</option>{Array.from(new Set(contracts.map((item) => item.STATUS_ERP).filter(Boolean))).map((status) => <option key={status} value={status}>{status}</option>)}</select></FilterField>
        <div className="flex items-end gap-2"><Button type="button" variant="outline" onClick={() => { onSearchChange(""); onCountryChange("TODOS"); setProductFilter(""); setStatusFilter("TODOS"); setShippingDate(""); }} className="h-10 border-[#AFC1D1] text-[#31526F]"><X className="mr-2 h-4 w-4" />Limpar</Button><Button type="button" onClick={() => void onExport()} disabled={exporting || visibleContracts.length === 0} className="h-10 bg-emerald-700 hover:bg-emerald-800"><FileSpreadsheet className="mr-2 h-4 w-4" />Excel</Button></div>
      </div>
    </CardContent></Card>

    <div className="grid min-w-0 gap-4 md:grid-cols-[minmax(0,1fr)_310px] xl:grid-cols-[minmax(0,1fr)_350px]">
      <Card className="min-w-0 overflow-hidden border-[#CBD8E3] shadow-[0_6px_18px_rgba(23,61,110,0.06)]"><CardContent className="p-0">
        <div className="flex flex-col gap-3 border-b border-[#DCE5ED] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="flex items-center gap-2 text-lg font-black text-[#102F53]"><FileSignature className="h-5 w-5" />Contratos</h2><p className="text-xs text-[#667B90]">Exibindo {visibleContracts.length} contrato(s)</p></div>
          <div className="inline-flex rounded-lg border border-[#C7D4E0] bg-[#F4F7FA] p-1"><button type="button" onClick={() => onContractTabChange("ATIVOS")} className={`rounded-md px-3 py-1.5 text-xs font-black ${contractTab === "ATIVOS" ? "bg-[#173D6E] text-white" : "text-[#526A80]"}`}>Ativos {activeCount}</button><button type="button" onClick={() => onContractTabChange("DESCONSIDERADOS")} className={`rounded-md px-3 py-1.5 text-xs font-black ${contractTab === "DESCONSIDERADOS" ? "bg-[#173D6E] text-white" : "text-[#526A80]"}`}>Desconsiderados {disregardedCount}</button></div>
        </div>
        <div className="max-h-[70vh] overflow-auto">
          <Table className="min-w-[860px]"><TableHeader className="sticky top-0 z-20 bg-[#EDF3F7]"><TableRow><TableHead className="w-12" /><SortableTableHead label="Contrato" sortKey="NROCONTRATO" sort={contractSort} onSort={onContractSort} /><SortableTableHead label="Cliente" sortKey="NOMERAZAO" sort={contractSort} onSort={onContractSort} /><SortableTableHead label="Embarque" sortKey="DTA_EMBARQUE_PLANEJADA" sort={contractSort} onSort={onContractSort} /><SortableTableHead label="Situação" sortKey="STATUS_ERP" sort={contractSort} onSort={onContractSort} /><SortableTableHead label="Itens" sortKey="ITEM_COUNT" sort={contractSort} onSort={onContractSort} align="center" /><SortableTableHead label="Cobertura" sortKey="COBERTURA" sort={contractSort} onSort={onContractSort} className="w-[180px]" /><SortableTableHead label="Saldo" sortKey="SALDO_TOTAL" sort={contractSort} onSort={onContractSort} align="right" /><TableHead className="sticky right-0 z-30 w-[68px] bg-[#EDF3F7] px-1 text-center">Ações</TableHead></TableRow></TableHeader><TableBody>
            {visibleContracts.length === 0 && <TableRow><TableCell colSpan={9} className="h-32 text-center text-sm font-semibold text-[#6B7F92]">Nenhum contrato encontrado com os filtros informados.</TableCell></TableRow>}
            {visibleContracts.map((contract) => {
              const isOpen = expanded.has(contract.SEQCONTRATO);
              const coverage = contractCoverage(contract);
              const risk = Number(contract.PRAZO_DIAS ?? 9999) <= 7 && coverage < 98;
              const sortedProducts = [...contract.PRODUTOS].sort((first, second) => {
                const values = (product: ContractProduct) => ({
                  SEQPRODUTO: product.SEQPRODUTO,
                  DESCRICAO: product.DESCRICAO,
                  PESOCONTRATO: Number(product.PESOCONTRATO || 0),
                  EXPEDIDO: Number(product.PESO_EXPEDIDO || 0),
                  OP: Number(product.PESO_ATRELADO_ORDEM || 0),
                  PEDIDO: Number(product.PESO_RESERVADO_PEDIDO_LIQUIDO ?? product.PESO_RESERVADO_PEDIDO ?? 0),
                  MANUAL: Number(product.PESO_RESERVADO_MANUAL || 0),
                  TOTAL: Number(product.PESO_ATRELADO_TOTAL || 0),
                  ATENDIDO: Number(product.PESO_EXPEDIDO || 0) + Number(product.PESO_ATRELADO_TOTAL || 0),
                  SALDO: Number(product.SALDO_CONTRATO || 0),
                  VALIDADE: validityRuleLabel(product),
                });
                return compareTableValues(values(first)[productSort.key], values(second)[productSort.key], productSort.direction);
              });
              return [
                <TableRow key={`contract-${contract.SEQCONTRATO}`} className={`${selectedContract?.SEQCONTRATO === contract.SEQCONTRATO ? "bg-blue-50/80" : "hover:bg-[#F7FAFC]"}`}>
                  <TableCell><button type="button" onClick={() => selectContract(contract)} className="flex h-8 w-8 items-center justify-center rounded-md border border-[#B8CAD9] bg-white text-[#174A78]">{isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</button></TableCell>
                  <TableCell><button type="button" onClick={() => selectContract(contract)} className="font-mono text-xs font-black text-blue-700 hover:underline">{contract.NROCONTRATO}</button></TableCell>
                  <TableCell><p className="max-w-[250px] truncate text-xs font-bold text-[#263F58]" title={contract.NOMERAZAO}>{contract.NOMERAZAO}</p><p className="mt-0.5 text-[10px] text-[#72869A]">{contract.PAISDESTINO || "País não informado"}</p></TableCell>
                  <TableCell><Input type="date" disabled={!configured || saving === `config-${contract.SEQCONTRATO}`} value={inputDate(contract.DTA_EMBARQUE_PLANEJADA)} onChange={(event) => void onSaveConfig(contract, { DTA_EMBARQUE_PLANEJADA: event.target.value })} className="h-8 min-w-[136px] text-xs" /></TableCell>
                  <TableCell>{contract.EM_EXPEDICAO ? <button type="button" onClick={() => onExpedition(contract)} className="rounded-full border border-cyan-200 bg-cyan-50 px-2 py-1 text-[9px] font-black uppercase text-cyan-800">Em expedição</button> : risk ? <button type="button" onClick={() => setRiskContract(contract)} className="rounded-full border border-red-200 bg-red-50 px-2 py-1 text-[9px] font-black uppercase text-red-700 transition hover:bg-red-100" title="Ver motivo do risco">Em risco</button> : <span className={`rounded-full border px-2 py-1 text-[9px] font-black uppercase ${coverage >= 98 ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-800"}`}>{coverage >= 98 ? "Atendido" : contract.STATUS_ERP || "Parcial"}</span>}</TableCell>
                  <TableCell className="text-center text-xs font-black text-[#304D68]">{contract.PRODUTOS.length}</TableCell>
                  <TableCell><div className="flex items-center gap-2"><Progress value={coverage} className={`h-2 flex-1 ${coverage >= 98 ? "[&>div]:bg-emerald-600" : risk ? "[&>div]:bg-red-500" : "[&>div]:bg-orange-500"}`} /><span className="w-10 text-right text-[10px] font-black">{coverage.toFixed(0)}%</span></div></TableCell>
                  <TableCell className="text-right text-xs font-black text-[#173D6E]">{formatKg(contract.SALDO_TOTAL)}</TableCell>
                  <TableCell className="sticky right-0 z-10 bg-inherit px-1"><div className="flex justify-center gap-0.5"><button type="button" onClick={() => selectContract(contract)} className="flex h-7 w-7 items-center justify-center rounded-md border border-[#B8CAD9] bg-white text-[#174A78]" title="Visualizar" aria-label={`Visualizar contrato ${contract.NROCONTRATO}`}><Eye className="h-3.5 w-3.5" /></button>{contract.DESCONSIDERADO ? <button type="button" onClick={() => void onRestore(contract)} className="flex h-7 w-7 items-center justify-center rounded-md border border-emerald-200 bg-white text-emerald-700" title="Restaurar" aria-label={`Restaurar contrato ${contract.NROCONTRATO}`}><RotateCcw className="h-3.5 w-3.5" /></button> : <button type="button" onClick={() => onDisregard(contract)} className="flex h-7 w-7 items-center justify-center rounded-md border border-amber-200 bg-white text-amber-700" title="Desconsiderar" aria-label={`Desconsiderar contrato ${contract.NROCONTRATO}`}><ArchiveX className="h-3.5 w-3.5" /></button>}</div></TableCell>
                </TableRow>,
                isOpen ? <TableRow key={`products-${contract.SEQCONTRATO}`} className="bg-[#F7FAFC] hover:bg-[#F7FAFC]"><TableCell colSpan={9} className="p-3"><div className="rounded-xl border border-[#CBD8E3] bg-white p-3"><div className="mb-3 grid gap-3 border-b border-[#E0E8EF] pb-3 md:grid-cols-4"><ContractFact icon={FileSignature} label="Contrato" value={contract.NROCONTRATO} /><ContractFact icon={Tags} label="Cliente" value={contract.NOMERAZAO} /><ContractFact icon={CalendarDays} label="Embarque planejado" value={formatDate(contract.DTA_EMBARQUE_PLANEJADA)} /><ContractFact icon={Boxes} label="Status" value={contract.EM_EXPEDICAO ? "Em expedição" : contract.STATUS_ERP} /></div><h3 className="mb-2 flex items-center gap-2 text-sm font-black text-[#173D6E]"><Boxes className="h-4 w-4 text-emerald-700" />Produtos do contrato</h3><div className="overflow-x-auto"><Table className="min-w-[820px]"><TableHeader className="bg-[#EDF3F7]"><TableRow><SortableTableHead label="SEQPRODUTO" sortKey="SEQPRODUTO" sort={productSort} onSort={(key) => setProductSort((current) => nextTableSort(current, key))} /><SortableTableHead label="Descrição" sortKey="DESCRICAO" sort={productSort} onSort={(key) => setProductSort((current) => nextTableSort(current, key))} /><SortableTableHead label="Contratado" sortKey="PESOCONTRATO" sort={productSort} onSort={(key) => setProductSort((current) => nextTableSort(current, key))} align="right" /><SortableTableHead label="OP protegida" sortKey="OP" sort={productSort} onSort={(key) => setProductSort((current) => nextTableSort(current, key))} align="right" /><SortableTableHead label="Pedido líquido" sortKey="PEDIDO" sort={productSort} onSort={(key) => setProductSort((current) => nextTableSort(current, key))} align="right" /><SortableTableHead label="Manual" sortKey="MANUAL" sort={productSort} onSort={(key) => setProductSort((current) => nextTableSort(current, key))} align="right" /><SortableTableHead label="Total alocado" sortKey="TOTAL" sort={productSort} onSort={(key) => setProductSort((current) => nextTableSort(current, key))} align="right" /><SortableTableHead label="Saldo" sortKey="SALDO" sort={productSort} onSort={(key) => setProductSort((current) => nextTableSort(current, key))} align="right" /><SortableTableHead label="Validade" sortKey="VALIDADE" sort={productSort} onSort={(key) => setProductSort((current) => nextTableSort(current, key))} /></TableRow></TableHeader><TableBody>{sortedProducts.map((product) => <TableRow key={product.SEQPRODUTO} onClick={() => setSelected({ contractId: contract.SEQCONTRATO, productId: product.SEQPRODUTO })} className={`cursor-pointer ${selected?.contractId === contract.SEQCONTRATO && selected.productId === product.SEQPRODUTO ? "bg-blue-50 ring-1 ring-inset ring-blue-200" : reservationCoverageClass(product)}`}><TableCell className="font-mono text-xs font-black text-blue-700">{product.SEQPRODUTO}</TableCell><TableCell className="text-xs font-bold text-[#304D68]">{product.DESCRICAO}</TableCell><NumberCell value={product.PESOCONTRATO} /><NumberCell value={product.PESO_ATRELADO_ORDEM} /><NumberCell value={product.PESO_RESERVADO_PEDIDO_LIQUIDO ?? product.PESO_RESERVADO_PEDIDO} /><NumberCell value={product.PESO_RESERVADO_MANUAL} /><NumberCell value={product.PESO_ATRELADO_TOTAL} /><TableCell className="text-right text-xs font-black text-[#173D6E]">{formatKg(product.SALDO_CONTRATO)}</TableCell><TableCell className="text-xs font-bold text-[#526A80]">{validityRuleLabel(product)}</TableCell></TableRow>)}</TableBody></Table></div><div className="mt-3 flex gap-2"><Textarea value={notes[contract.SEQCONTRATO] ?? contract.OBSERVACAO ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [contract.SEQCONTRATO]: event.target.value }))} placeholder="Observação operacional" className="min-h-10" /><Button variant="outline" onClick={() => void onSaveConfig(contract, { OBSERVACAO: notes[contract.SEQCONTRATO] ?? contract.OBSERVACAO ?? "" })} disabled={!configured || saving === `config-${contract.SEQCONTRATO}`}>Salvar nota</Button>{Number(contract.PESO_RESERVADO || 0) > 0 && <Button variant="outline" onClick={() => onForecast(contract)} className="border-[#AFC1D1] text-[#174A78]">Ver previsão</Button>}</div></div></TableCell></TableRow> : null,
              ];
            })}
          </TableBody></Table>
        </div>
      </CardContent></Card>

      <Card className="h-fit min-w-0 border-[#CBD8E3] shadow-[0_6px_18px_rgba(23,61,110,0.08)] md:sticky md:top-4"><CardContent className="p-4">
        <div className="border-b border-[#DCE5ED] pb-3"><h2 className="flex items-center gap-2 text-lg font-black text-[#102F53]"><Boxes className="h-5 w-5 text-emerald-700" />Resumo do produto selecionado</h2><p className="mt-1 text-xs text-[#667B90]">{selectedContract && selectedProduct ? `Contrato ${selectedContract.NROCONTRATO} · SEQPRODUTO ${selectedProduct.SEQPRODUTO}` : "Selecione um produto na lista de contratos"}</p></div>
        {selectedContract && selectedProduct ? (
          <div className="mt-4 space-y-4">
            <div><p className="text-[10px] font-black uppercase tracking-wider text-[#71869A]">Produto</p><p className="mt-1 text-base font-black text-[#102F53]">{selectedProduct.DESCRICAO}</p></div>
            <div className="grid grid-cols-2 gap-2">
              <SummaryValue label="Peso contratado" value={formatKg(selectedProduct.PESOCONTRATO)} />
              <SummaryValue label="Peso expedido" value={formatKg(selectedProduct.PESO_EXPEDIDO)} tone="green" />
              <SummaryValue label="Ainda reservado" value={formatKg(selectedProduct.PESO_ATRELADO_TOTAL)} />
              <SummaryValue label="Total atendido" value={formatKg(selectedCoveredWeight)} />
              <SummaryValue label="Saldo pendente" value={formatKg(selectedProduct.SALDO_CONTRATO)} tone="red" />
              <SummaryValue label="Estoque livre elegível" value={formatKg(selectedProduct.PESO_ESTOQUE_ELEGIVEL)} tone="green" />
            </div>
            <div className="space-y-2 border-y border-[#DCE5ED] py-3 text-xs"><SummaryLine label="Cobertura total" value={`${selectedCoverage.toFixed(1)}%`} /><SummaryLine label="Estoque livre global" value={formatKg(selectedProduct.PESO_LIVRE_VERTICE)} /><SummaryLine label="Data mínima aceita" value={formatDate(selectedProduct.DATA_MINIMA_PRODUCAO)} /><SummaryLine label="Embarque" value={formatDate(selectedContract.DTA_EMBARQUE_PLANEJADA || selectedContract.DTA_EMBARQUE_ERP)} /></div>
            {Number(selectedProduct.PESO_SOBREPOSTO_ORDEM_PEDIDO || 0) > 0 && <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs leading-5 text-blue-900"><p className="font-black">Entender a conciliação</p><p>{formatKg(selectedProduct.PESO_SOBREPOSTO_ORDEM_PEDIDO)} da reserva de pedido já está coberta pela OP e não foi contada duas vezes.</p></div>}
            <div className="rounded-lg border border-cyan-200 bg-cyan-50 p-3 text-xs leading-5 text-cyan-950"><p className="font-black">Como o saldo é calculado</p><p>Contratado menos expedido e menos o que ainda permanece reservado por OP, pedido ou manualmente.</p></div>
            <Button type="button" onClick={() => onAllocate(selectedProduct.SEQPRODUTO)} className="h-11 w-full bg-emerald-700 text-white hover:bg-emerald-800"><Boxes className="mr-2 h-4 w-4" />Alocar estoque</Button>
            {selectedContract.DESCONSIDERADO ? <Button type="button" variant="outline" onClick={() => void onRestore(selectedContract)} disabled={!configured || Boolean(saving)} className="h-10 w-full border-emerald-300 text-emerald-700 hover:bg-emerald-50"><RotateCcw className="mr-2 h-4 w-4" />Restaurar contrato</Button> : <Button type="button" variant="outline" onClick={() => onDisregard(selectedContract)} disabled={!configured || Boolean(saving)} className="h-10 w-full border-amber-300 text-amber-800 hover:bg-amber-50"><ArchiveX className="mr-2 h-4 w-4" />Desconsiderar contrato</Button>}
            <p className="text-center text-[10px] font-semibold text-[#71869A]">As ações preservam o contrato e o produto selecionados.</p>
          </div>
        ) : <div className="py-12 text-center"><PackageSearch className="mx-auto h-10 w-10 text-[#A3B3C1]" /><p className="mt-3 text-sm font-bold text-[#60758A]">Abra um contrato e selecione um produto para consultar a composição.</p></div>}
      </CardContent></Card>
    </div>
    <ContractRiskDialog contract={riskContract} onClose={() => setRiskContract(null)} />
  </div>;
}

function OverviewAnalysisDialog({
  analysis,
  onClose,
  atRisk,
  overflowRows,
  validityRows,
  decisionProducts,
  onOpenContract,
  onOpenProduct,
  onReviewDates,
}: {
  analysis: "RISK" | "OVERFLOW" | "VALIDITY" | "DECISION" | null;
  onClose: () => void;
  atRisk: ExportContract[];
  overflowRows: Array<{ contract: ExportContract; product: ContractProduct }>;
  validityRows: Array<{ item: ContractStock; lot: ContractStockLot }>;
  decisionProducts: Array<ContractStock & { demand: number; nextShipping: string | null }>;
  onOpenContract: (contract: ExportContract) => void;
  onOpenProduct: (productId: number) => void;
  onReviewDates: () => void;
}) {
  const meta = analysis === "RISK"
    ? { title: "Contratos com risco de embarque", description: "Contratos com saldo pendente e prazo de até sete dias." }
    : analysis === "OVERFLOW"
      ? { title: "Produtos com transbordo", description: "Pesos que ultrapassaram o limite contratado e precisam de conciliação." }
      : analysis === "VALIDITY"
        ? { title: "Lotes que exigem revisão", description: "Lotes com validade incompatível ou sem data de produção rastreável." }
        : { title: "Produtos com decisão possível", description: "Produtos que possuem estoque livre ou demanda contratual pendente." };

  const closeAndRun = (action: () => void) => {
    onClose();
    action();
  };

  return <Dialog open={Boolean(analysis)} onOpenChange={(open) => !open && onClose()}>
    <DialogContent className="max-h-[88vh] max-w-[94vw] overflow-hidden border-[#CBD8E3] sm:max-w-3xl">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-[#173D6E]"><ShieldAlert className="h-5 w-5" />{meta.title}</DialogTitle>
        <DialogDescription>{meta.description}</DialogDescription>
      </DialogHeader>
      <div className="max-h-[64vh] space-y-2 overflow-y-auto pr-1">
        {analysis === "RISK" && (atRisk.length ? atRisk.map((contract) => <div key={contract.SEQCONTRATO} className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50/60 p-4 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="font-mono text-xs font-black text-blue-700">{contract.NROCONTRATO}</p><p className="mt-1 truncate text-sm font-black text-[#203F5D]">{contract.NOMERAZAO}</p><p className="mt-1 text-xs font-semibold text-red-800">Embarque em {formatDate(contract.DTA_EMBARQUE_PLANEJADA || contract.DTA_EMBARQUE_ERP)}, cobertura de {contractCoverage(contract).toFixed(0)}% e saldo de {formatKg(contract.SALDO_TOTAL)}.</p></div><Button type="button" size="sm" onClick={() => closeAndRun(() => onOpenContract(contract))} className="shrink-0 bg-[#173D6E] hover:bg-[#102F53]">Abrir contrato<ChevronRight className="ml-1 h-4 w-4" /></Button></div>) : <EmptyAnalysis />)}
        {analysis === "OVERFLOW" && (overflowRows.length ? overflowRows.map(({ contract, product }) => <div key={`${contract.SEQCONTRATO}-${product.SEQPRODUTO}`} className="flex flex-col gap-3 rounded-xl border border-orange-200 bg-orange-50/60 p-4 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="font-mono text-xs font-black text-blue-700">Contrato {contract.NROCONTRATO} · Produto {product.SEQPRODUTO}</p><p className="mt-1 truncate text-sm font-black text-[#203F5D]">{product.DESCRICAO}</p><p className="mt-1 text-xs font-semibold text-orange-800">Transbordo de {formatKg(product.PESO_TRANSBORDADO)}. Total alocado: {formatKg(product.PESO_ATRELADO_TOTAL)} para {formatKg(product.PESOCONTRATO)} contratados.</p></div><Button type="button" size="sm" onClick={() => closeAndRun(() => onOpenContract(contract))} className="shrink-0 bg-[#173D6E] hover:bg-[#102F53]">Abrir contrato<ChevronRight className="ml-1 h-4 w-4" /></Button></div>) : <EmptyAnalysis />)}
        {analysis === "VALIDITY" && (validityRows.length ? validityRows.map(({ item, lot }, index) => <div key={lot.CHAVE_LOTE || `${item.SEQPRODUTO}-${index}`} className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50/60 p-4 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="font-mono text-xs font-black text-blue-700">Produto {item.SEQPRODUTO}</p><p className="mt-1 truncate text-sm font-black text-[#203F5D]">{item.DESCRPRODUTO}</p><p className="mt-1 text-xs font-semibold text-red-800">{lot.SITUACAO_VALIDADE === "SEM_DATA" ? "Sem data de produção rastreável" : `Produção em ${formatDate(lot.DTAPRODUCAO)} sem contrato compatível`}. Peso livre: {formatKg(lot.PESO_LIVRE_ESTIMADO)}.</p></div><Button type="button" size="sm" onClick={() => closeAndRun(onReviewDates)} className="shrink-0 bg-[#173D6E] hover:bg-[#102F53]">Revisar lote<ChevronRight className="ml-1 h-4 w-4" /></Button></div>) : <EmptyAnalysis />)}
        {analysis === "DECISION" && (decisionProducts.length ? decisionProducts.map((item) => <div key={item.SEQPRODUTO} className="flex flex-col gap-3 rounded-xl border border-blue-200 bg-blue-50/60 p-4 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="font-mono text-xs font-black text-blue-700">Produto {item.SEQPRODUTO}</p><p className="mt-1 truncate text-sm font-black text-[#203F5D]">{item.DESCRPRODUTO}</p><p className="mt-1 text-xs font-semibold text-blue-800">Estoque livre de {formatKg(item.PESO_LIVRE_VERTICE)}, demanda pendente de {formatKg(item.demand)} e próximo embarque em {formatDate(item.nextShipping)}.</p></div><Button type="button" size="sm" onClick={() => closeAndRun(() => onOpenProduct(item.SEQPRODUTO))} className="shrink-0 bg-[#173D6E] hover:bg-[#102F53]">Analisar estoque<ChevronRight className="ml-1 h-4 w-4" /></Button></div>) : <EmptyAnalysis />)}
      </div>
    </DialogContent>
  </Dialog>;
}

function EmptyAnalysis() {
  return <div className="rounded-xl border border-dashed border-[#C7D4E0] p-8 text-center text-sm font-semibold text-[#6B7F92]">Nenhum registro encontrado nesta análise.</div>;
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-[#47627D]">{label}</span>{children}</label>;
}

function ContractFact({ icon: Icon, label, value }: { icon: typeof FileSignature; label: string; value: string | null | undefined }) {
  return <div className="flex min-w-0 items-center gap-2"><Icon className="h-4 w-4 shrink-0 text-[#526F89]" /><div className="min-w-0"><p className="text-[9px] font-black uppercase tracking-wider text-[#71869A]">{label}</p><p className="truncate text-xs font-black text-[#203D59]" title={value || ""}>{value || "Não informado"}</p></div></div>;
}

function SummaryValue({ label, value, tone = "blue" }: { label: string; value: string; tone?: "blue" | "green" | "red" }) {
  const tones = tone === "green" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : tone === "red" ? "border-red-200 bg-red-50 text-red-700" : "border-[#D0DDE7] bg-[#F7F9FB] text-[#173D6E]";
  return <div className={`rounded-lg border p-3 ${tones}`}><p className="text-[9px] font-black uppercase tracking-wider">{label}</p><p className="mt-1 text-lg font-black">{value}</p></div>;
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-3"><span className="font-semibold text-[#60758A]">{label}</span><strong className="text-right text-[#173D6E]">{value}</strong></div>;
}

function contractCoverage(contract: ExportContract) {
  if (Number(contract.PESO_TOTAL || 0) <= 0) return 0;
  const covered = contract.EM_EXPEDICAO
    ? Number(contract.PESO_EXPEDIDO || 0)
    : contract.PRODUTOS.reduce(
        (total, product) => total + Math.min(Number(product.PESOCONTRATO || 0), Number(product.PESO_ATRELADO_TOTAL || 0)),
        0,
      );
  return Math.min(100, Math.max(0, covered / Number(contract.PESO_TOTAL) * 100));
}

function ContractRiskDialog({ contract, onClose }: { contract: ExportContract | null; onClose: () => void }) {
  const coverage = contract ? contractCoverage(contract) : 0;
  const days = Number(contract?.PRAZO_DIAS ?? 0);
  const bottleneck = contract?.PRODUTOS.reduce<ContractProduct | null>((current, product) => (
    !current || Number(product.SALDO_CONTRATO || 0) > Number(current.SALDO_CONTRATO || 0) ? product : current
  ), null);
  const deadlineMessage = days < 0
    ? `O embarque está atrasado há ${Math.abs(days)} dia(s).`
    : days === 0
      ? "O embarque está previsto para hoje."
      : `Faltam ${days} dia(s) para o embarque.`;

  return <Dialog open={Boolean(contract)} onOpenChange={(open) => !open && onClose()}>
    <DialogContent className="max-w-xl border-[#CBD8E3]">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-[#173D6E]"><AlertTriangle className="h-5 w-5 text-red-600" />Por que este contrato está em risco?</DialogTitle>
        <DialogDescription>{contract ? `${contract.NROCONTRATO} · ${contract.NOMERAZAO}` : "Detalhamento do risco"}</DialogDescription>
      </DialogHeader>
      {contract && <div className="space-y-4">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-950">
          <p className="font-black">{deadlineMessage}</p>
          <p>A cobertura atual é de <strong>{coverage.toFixed(1)}%</strong>, abaixo do mínimo operacional de 98%.</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <SummaryValue label="Embarque" value={formatDate(contract.DTA_EMBARQUE_PLANEJADA || contract.DTA_EMBARQUE_ERP)} />
          <SummaryValue label="Saldo pendente" value={formatKg(contract.SALDO_TOTAL)} tone="red" />
          <SummaryValue label="Peso contratado" value={formatKg(contract.PESO_TOTAL)} />
          <SummaryValue label="Cobertura" value={`${coverage.toFixed(1)}%`} tone="red" />
        </div>
        {bottleneck && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950"><p className="font-black">Maior saldo por produto</p><p>{bottleneck.SEQPRODUTO} · {bottleneck.DESCRICAO}: <strong>{formatKg(bottleneck.SALDO_CONTRATO)}</strong> ainda pendentes.</p></div>}
        <p className="text-xs leading-5 text-[#60758A]">O sistema marca como risco contratos com embarque em até 7 dias e cobertura inferior a 98%.</p>
      </div>}
    </DialogContent>
  </Dialog>;
}

function ContractsOverview({
  contracts,
  stock,
  onOpenContracts,
  onOpenContract,
  onOpenProduct,
  onReviewDates,
}: {
  contracts: ExportContract[];
  stock: ContractStock[];
  onOpenContracts: () => void;
  onOpenContract: (contract: ExportContract) => void;
  onOpenProduct: (productId: number) => void;
  onReviewDates: () => void;
}) {
  const [analysis, setAnalysis] = useState<"RISK" | "OVERFLOW" | "VALIDITY" | "DECISION" | null>(null);
  const [prioritySort, setPrioritySort] = useState<TableSortState<"CONTRATO" | "EMBARQUE" | "CONTRATADO" | "SALDO" | "COBERTURA" | "SITUACAO">>({ key: "EMBARQUE", direction: "asc" });
  const [decisionSort, setDecisionSort] = useState<TableSortState<"PRODUTO" | "DESCRICAO" | "LIVRE" | "SALDO" | "EMBARQUE">>({ key: "SALDO", direction: "desc" });
  const pendingWeight = contracts.reduce((sum, contract) => sum + Number(contract.SALDO_TOTAL || 0), 0);
  const freeWeight = stock.reduce((sum, item) => sum + Number(item.PESO_LIVRE_VERTICE || 0), 0);
  const activeProductIds = new Set(contracts.flatMap((contract) => contract.PRODUTOS.filter((product) => Number(product.SALDO_CONTRATO || 0) > 0).map((product) => product.SEQPRODUTO)));
  const eligibleWithoutContract = stock.reduce((sum, item) => sum + (activeProductIds.has(item.SEQPRODUTO) ? Number(item.PESO_LIVRE_VERTICE || 0) : 0), 0);
  const atRisk = contracts.filter((contract) => !contract.EM_EXPEDICAO && Number(contract.SALDO_TOTAL || 0) > 0 && Number(contract.PRAZO_DIAS ?? 9999) <= 7);
  const validityIssues = stock.reduce((sum, item) => sum + (item.LOTES_LIVRES || []).filter((lot) => lot.SITUACAO_VALIDADE === "INCOMPATIVEL" || lot.SITUACAO_VALIDADE === "SEM_DATA").length, 0);
  const overflowCount = contracts.reduce((sum, contract) => sum + contract.PRODUTOS.filter((product) => Number(product.PESO_TRANSBORDADO || 0) > 0).length, 0);
  const overflowRows = contracts.flatMap((contract) => contract.PRODUTOS
    .filter((product) => Number(product.PESO_TRANSBORDADO || 0) > 0)
    .map((product) => ({ contract, product })));
  const validityRows = stock.flatMap((item) => (item.LOTES_LIVRES || [])
    .filter((lot) => lot.SITUACAO_VALIDADE === "INCOMPATIVEL" || lot.SITUACAO_VALIDADE === "SEM_DATA")
    .map((lot) => ({ item, lot })));
  const priorityContracts = contracts
    .filter((contract) => Boolean(contract.DTA_EMBARQUE_PLANEJADA || contract.DTA_EMBARQUE_ERP))
    .sort((first, second) => Number(first.PRAZO_DIAS ?? 9999) - Number(second.PRAZO_DIAS ?? 9999) || contractCoverage(first) - contractCoverage(second))
    .slice(0, 6);
  const decisionProducts = stock
    .map((item) => ({
      ...item,
      demand: contracts.reduce((sum, contract) => sum + Number(contract.PRODUTOS.find((product) => product.SEQPRODUTO === item.SEQPRODUTO)?.SALDO_CONTRATO || 0), 0),
      nextShipping: contracts
        .filter((contract) => contract.PRODUTOS.some((product) => product.SEQPRODUTO === item.SEQPRODUTO && Number(product.SALDO_CONTRATO || 0) > 0))
        .map((contract) => contract.DTA_EMBARQUE_PLANEJADA)
        .filter(Boolean)
        .sort()[0] || null,
    }))
    .filter((item) => Number(item.PESO_LIVRE_VERTICE || 0) > 0 || item.demand > 0)
    .sort((first, second) => second.demand - first.demand)
    .slice(0, 7);
  const sortedPriorityContracts = [...priorityContracts].sort((first, second) => {
    const value = (contract: ExportContract) => ({
      CONTRATO: contract.NROCONTRATO,
      EMBARQUE: contract.DTA_EMBARQUE_PLANEJADA,
      CONTRATADO: Number(contract.PESO_TOTAL || 0),
      SALDO: Number(contract.SALDO_TOTAL || 0),
      COBERTURA: contractCoverage(contract),
      SITUACAO: contract.EM_EXPEDICAO ? "EM_EXPEDICAO" : contractCoverage(contract) >= 98 ? "COBERTO" : Number(contract.PRAZO_DIAS ?? 9999) <= 7 ? "RISCO" : "PARCIAL",
    });
    return compareTableValues(value(first)[prioritySort.key], value(second)[prioritySort.key], prioritySort.direction);
  });
  const sortedDecisionProducts = [...decisionProducts].sort((first, second) => {
    const value = (item: (typeof decisionProducts)[number]) => ({ PRODUTO: item.SEQPRODUTO, DESCRICAO: item.DESCRPRODUTO, LIVRE: Number(item.PESO_LIVRE_VERTICE || 0), SALDO: item.demand, EMBARQUE: item.nextShipping });
    return compareTableValues(value(first)[decisionSort.key], value(second)[decisionSort.key], decisionSort.direction);
  });

  return <><div className="space-y-4">
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <OverviewMetric icon={FileSignature} label="Contratos ativos" value={String(contracts.length)} tone="blue" />
      <OverviewMetric icon={Weight} label="Peso pendente" value={formatKg(pendingWeight)} tone="orange" />
      <OverviewMetric icon={Boxes} label="Estoque realmente livre" value={formatKg(freeWeight)} tone="green" />
      <OverviewMetric icon={Tags} label="Livre com demanda" value={formatKg(eligibleWithoutContract)} tone="green" />
      <OverviewMetric icon={ShieldAlert} label="Risco de embarque" value={String(atRisk.length)} tone="red" />
    </section>

    <section className="grid gap-4 2xl:grid-cols-[minmax(0,1.55fr)_minmax(360px,0.8fr)]">
      <Card className="overflow-hidden border-[#CBD8E3] shadow-[0_6px_18px_rgba(23,61,110,0.06)]"><CardContent className="p-0">
        <div className="flex items-center justify-between border-b border-[#DCE5ED] px-5 py-4"><div><h2 className="text-lg font-black text-[#102F53]">Contratos prioritários</h2><p className="text-xs text-[#667B90]">Ordenados por prazo e cobertura atual</p></div><Button variant="outline" size="sm" onClick={onOpenContracts} className="border-[#AFC1D1] text-[#174A78]">Ver todos</Button></div>
        <div className="overflow-x-auto"><Table className="min-w-[760px]"><TableHeader className="bg-[#EDF3F7]"><TableRow><SortableTableHead label="Contrato / cliente" sortKey="CONTRATO" sort={prioritySort} onSort={(key) => setPrioritySort((current) => nextTableSort(current, key))} /><SortableTableHead label="Embarque" sortKey="EMBARQUE" sort={prioritySort} onSort={(key) => setPrioritySort((current) => nextTableSort(current, key))} /><SortableTableHead label="Contratado" sortKey="CONTRATADO" sort={prioritySort} onSort={(key) => setPrioritySort((current) => nextTableSort(current, key))} align="right" /><SortableTableHead label="Saldo" sortKey="SALDO" sort={prioritySort} onSort={(key) => setPrioritySort((current) => nextTableSort(current, key))} align="right" /><SortableTableHead label="Cobertura" sortKey="COBERTURA" sort={prioritySort} onSort={(key) => setPrioritySort((current) => nextTableSort(current, key))} className="w-[180px]" /><SortableTableHead label="Situação" sortKey="SITUACAO" sort={prioritySort} onSort={(key) => setPrioritySort((current) => nextTableSort(current, key))} /></TableRow></TableHeader><TableBody>
          {sortedPriorityContracts.map((contract) => { const coverage = contractCoverage(contract); const risk = !contract.EM_EXPEDICAO && Number(contract.PRAZO_DIAS ?? 9999) <= 7 && coverage < 98; return <TableRow key={contract.SEQCONTRATO} className="hover:bg-[#F7FAFC]"><TableCell><button type="button" onClick={() => onOpenContract(contract)} className="text-left"><p className="font-mono text-xs font-black text-blue-700">{contract.NROCONTRATO}</p><p className="mt-1 max-w-[260px] truncate text-xs font-bold text-[#304D68]">{contract.NOMERAZAO}</p></button></TableCell><TableCell className="text-xs font-bold text-[#526A80]">{formatDate(contract.DTA_EMBARQUE_PLANEJADA || contract.DTA_EMBARQUE_ERP)}</TableCell><TableCell className="text-right text-xs font-black text-[#173D6E]">{formatKg(contract.PESO_TOTAL)}</TableCell><TableCell className="text-right text-xs font-black text-orange-700">{formatKg(contract.SALDO_TOTAL)}</TableCell><TableCell><div className="flex items-center gap-2"><Progress value={coverage} className={`h-2 flex-1 ${coverage >= 98 ? "[&>div]:bg-emerald-600" : risk ? "[&>div]:bg-red-500" : "[&>div]:bg-amber-500"}`} /><span className="w-10 text-right text-[10px] font-black">{coverage.toFixed(0)}%</span></div></TableCell><TableCell><span className={`rounded-full border px-2 py-1 text-[9px] font-black uppercase ${contract.EM_EXPEDICAO ? "border-cyan-200 bg-cyan-50 text-cyan-800" : coverage >= 98 ? "border-emerald-200 bg-emerald-50 text-emerald-700" : risk ? "border-red-200 bg-red-50 text-red-700" : "border-amber-200 bg-amber-50 text-amber-800"}`}>{contract.EM_EXPEDICAO ? "Em embarque" : coverage >= 98 ? "Coberto" : risk ? "Em risco" : "Parcial"}</span></TableCell></TableRow>; })}
        </TableBody></Table></div>
      </CardContent></Card>

      <Card className="border-[#CBD8E3] shadow-[0_6px_18px_rgba(23,61,110,0.06)]"><CardContent className="p-0"><div className="border-b border-[#DCE5ED] px-5 py-4"><h2 className="text-lg font-black text-[#102F53]">Atenções que exigem ação</h2><p className="text-xs text-[#667B90]">Pendências calculadas com os dados atuais</p></div><div className="space-y-2 p-4">
        <AttentionItem tone="red" title={`${atRisk.length} contrato(s) com risco de embarque`} description="Revise cobertura, produção e data planejada." action="Analisar" onClick={() => setAnalysis("RISK")} />
        <AttentionItem tone="orange" title={`${overflowCount} produto(s) com transbordo`} description="Há peso acima do limite contratado em uma ou mais origens." action="Analisar" onClick={() => setAnalysis("OVERFLOW")} />
        <AttentionItem tone="red" title={`${validityIssues} lote(s) exigem revisão`} description="Validade incompatível ou data de produção ausente." action="Analisar" onClick={() => setAnalysis("VALIDITY")} />
        <AttentionItem tone="blue" title={`${decisionProducts.length} produto(s) com decisão possível`} description="Existe demanda contratual ou estoque livre para analisar." action="Analisar" onClick={() => setAnalysis("DECISION")} />
      </div></CardContent></Card>
    </section>

    <Card className="overflow-hidden border-[#CBD8E3] shadow-[0_6px_18px_rgba(23,61,110,0.06)]"><CardContent className="p-0"><div className="border-b border-[#DCE5ED] px-5 py-4"><h2 className="text-lg font-black text-[#102F53]">Produtos que precisam de decisão</h2><p className="text-xs text-[#667B90]">Estoque livre, demanda dos contratos e próximo embarque</p></div><div className="overflow-x-auto"><Table className="min-w-[850px]"><TableHeader className="bg-[#EDF3F7]"><TableRow><SortableTableHead label="SEQPRODUTO" sortKey="PRODUTO" sort={decisionSort} onSort={(key) => setDecisionSort((current) => nextTableSort(current, key))} className="w-[110px]" /><SortableTableHead label="Produto" sortKey="DESCRICAO" sort={decisionSort} onSort={(key) => setDecisionSort((current) => nextTableSort(current, key))} /><SortableTableHead label="Estoque livre" sortKey="LIVRE" sort={decisionSort} onSort={(key) => setDecisionSort((current) => nextTableSort(current, key))} align="right" /><SortableTableHead label="Saldo dos contratos" sortKey="SALDO" sort={decisionSort} onSort={(key) => setDecisionSort((current) => nextTableSort(current, key))} align="right" /><SortableTableHead label="Próximo embarque" sortKey="EMBARQUE" sort={decisionSort} onSort={(key) => setDecisionSort((current) => nextTableSort(current, key))} /><TableHead className="text-right">Ação</TableHead></TableRow></TableHeader><TableBody>{sortedDecisionProducts.map((item) => <TableRow key={item.SEQPRODUTO}><TableCell className="font-mono text-xs font-black text-[#174A78]">{item.SEQPRODUTO}</TableCell><TableCell className="text-xs font-bold text-[#304D68]">{item.DESCRPRODUTO}</TableCell><TableCell className="text-right text-xs font-black text-emerald-700">{formatKg(item.PESO_LIVRE_VERTICE)}</TableCell><TableCell className="text-right text-xs font-black text-orange-700">{formatKg(item.demand)}</TableCell><TableCell className="text-xs font-bold text-[#526A80]">{formatDate(item.nextShipping)}</TableCell><TableCell className="text-right"><Button type="button" variant="outline" size="sm" onClick={() => onOpenProduct(item.SEQPRODUTO)} className="border-[#8FB1CE] text-[#174A78]"><Boxes className="mr-2 h-3.5 w-3.5" />Analisar e alocar</Button></TableCell></TableRow>)}</TableBody></Table></div></CardContent></Card>
  </div>
  <OverviewAnalysisDialog analysis={analysis} onClose={() => setAnalysis(null)} atRisk={atRisk} overflowRows={overflowRows} validityRows={validityRows} decisionProducts={decisionProducts} onOpenContract={onOpenContract} onOpenProduct={onOpenProduct} onReviewDates={onReviewDates} />
  </>;
}

function OverviewMetric({ icon: Icon, label, value, tone }: { icon: typeof FileSignature; label: string; value: string; tone: "blue" | "green" | "orange" | "red" }) {
  const tones = { blue: "bg-blue-50 text-blue-700", green: "bg-emerald-50 text-emerald-700", orange: "bg-orange-50 text-orange-700", red: "bg-red-50 text-red-700" };
  return <Card className="border-[#CBD8E3] shadow-[0_5px_16px_rgba(23,61,110,0.06)]"><CardContent className="flex items-center gap-3 p-4"><span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}><Icon className="h-6 w-6" /></span><div className="min-w-0"><p className="truncate text-[10px] font-black uppercase tracking-wide text-[#60758A]">{label}</p><p className={`mt-1 truncate text-xl font-black ${tone === "red" ? "text-red-700" : tone === "green" ? "text-emerald-700" : "text-[#102F53]"}`}>{value}</p></div></CardContent></Card>;
}

function AttentionItem({ tone, title, description, action, onClick }: { tone: "red" | "orange" | "blue"; title: string; description: string; action: string; onClick: () => void }) {
  const colors = tone === "red" ? "border-l-red-500 bg-red-50/60" : tone === "orange" ? "border-l-orange-500 bg-orange-50/60" : "border-l-blue-500 bg-blue-50/60";
  return <div className={`flex items-center gap-3 rounded-lg border border-[#D9E3EB] border-l-4 p-3 ${colors}`}><AlertTriangle className={`h-5 w-5 shrink-0 ${tone === "red" ? "text-red-600" : tone === "orange" ? "text-orange-600" : "text-blue-600"}`} /><div className="min-w-0 flex-1"><p className="text-xs font-black text-[#203F5D]">{title}</p><p className="mt-0.5 text-[10px] font-semibold text-[#6A7E91]">{description}</p></div><Button type="button" size="sm" variant="outline" onClick={onClick} className="h-8 shrink-0 border-[#B6C8D6] bg-white px-2 text-[10px] font-black text-[#174A78]">{action}<ChevronRight className="ml-1 h-3.5 w-3.5" /></Button></div>;
}

function ContractsHistoryPanel({ contracts }: { contracts: ExportContract[] }) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<TableSortState<"DATA" | "ORIGEM" | "CONTRATO" | "PRODUTO" | "PESO" | "REFERENCIA" | "OPERADOR">>({ key: "DATA", direction: "desc" });
  const term = normalizeSearch(search);
  const rows = contracts.flatMap((contract) => contract.PRODUTOS.flatMap((product) => product.DETALHES_ATRELAMENTO.map((detail, index) => ({ contract, product, detail, index })))).filter(({ contract, product, detail }) => !term || normalizeSearch(`${contract.NROCONTRATO} ${contract.NOMERAZAO} ${product.SEQPRODUTO} ${product.DESCRICAO} ${detail.ORIGEM} ${detail.USUARIO || ""}`).includes(term));
  const originLabel = (origin: string) => origin === "ORDEM_PRODUCAO" ? "Ordem de produção" : origin === "RESERVA_PEDIDO" ? "Pedido reservado" : origin === "EXPEDICAO" ? "Expedição" : origin === "MAIS_6_MESES" ? "Estoque tratado" : "Manual Vértice";
  const sortedRows = [...rows].sort((first, second) => {
    const value = ({ contract, product, detail }: (typeof rows)[number]) => ({
      DATA: detail.DATA_RENDIMENTO || detail.DATA_INICIO || detail.DATA_EMBARQUE,
      ORIGEM: originLabel(detail.ORIGEM),
      CONTRATO: contract.NROCONTRATO,
      PRODUTO: product.SEQPRODUTO,
      PESO: Number(detail.PESO || 0),
      REFERENCIA: detail.NUMERO_ORDEM || detail.NROPEDIDO || detail.NROCARGA || "",
      OPERADOR: detail.USUARIO || (detail.EDITAVEL ? "Não informado" : "ERP"),
    });
    return compareTableValues(value(first)[sort.key], value(second)[sort.key], sort.direction);
  });
  return <Card className="overflow-hidden border-[#CBD8E3] shadow-[0_6px_18px_rgba(23,61,110,0.06)]"><CardContent className="p-0"><div className="flex flex-col gap-3 border-b border-[#DCE5ED] p-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-lg font-black text-[#102F53]">Registros de alocação carregados</h2><p className="text-xs text-[#667B90]">Origens protegidas do ERP e movimentações manuais vinculadas aos contratos.</p></div><div className="relative w-full sm:w-[360px]"><Search className="absolute left-3 top-2.5 h-4 w-4 text-[#8396A9]" /><Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Contrato, produto, origem ou operador" /></div></div><div className="max-h-[70vh] overflow-auto"><Table className="min-w-[1050px]"><TableHeader className="sticky top-0 z-10 bg-[#EDF3F7]"><TableRow><SortableTableHead label="Data de referência" sortKey="DATA" sort={sort} onSort={(key) => setSort((current) => nextTableSort(current, key))} /><SortableTableHead label="Origem" sortKey="ORIGEM" sort={sort} onSort={(key) => setSort((current) => nextTableSort(current, key))} /><SortableTableHead label="Contrato / cliente" sortKey="CONTRATO" sort={sort} onSort={(key) => setSort((current) => nextTableSort(current, key))} /><SortableTableHead label="Produto" sortKey="PRODUTO" sort={sort} onSort={(key) => setSort((current) => nextTableSort(current, key))} /><SortableTableHead label="Peso" sortKey="PESO" sort={sort} onSort={(key) => setSort((current) => nextTableSort(current, key))} align="right" /><SortableTableHead label="Referência" sortKey="REFERENCIA" sort={sort} onSort={(key) => setSort((current) => nextTableSort(current, key))} /><SortableTableHead label="Operador" sortKey="OPERADOR" sort={sort} onSort={(key) => setSort((current) => nextTableSort(current, key))} /></TableRow></TableHeader><TableBody>{sortedRows.length === 0 ? <TableRow><TableCell colSpan={7} className="h-36 text-center text-sm font-semibold text-[#6B7F92]">Nenhum registro encontrado.</TableCell></TableRow> : sortedRows.map(({ contract, product, detail, index }) => <TableRow key={`${contract.SEQCONTRATO}-${product.SEQPRODUTO}-${detail.ORIGEM}-${index}`}><TableCell className="text-xs font-bold text-[#526A80]">{formatDate(detail.DATA_RENDIMENTO || detail.DATA_INICIO || detail.DATA_EMBARQUE)}</TableCell><TableCell><span className={`rounded-full border px-2 py-1 text-[9px] font-black uppercase ${detail.EDITAVEL ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-blue-200 bg-blue-50 text-blue-700"}`}>{originLabel(detail.ORIGEM)}</span></TableCell><TableCell><p className="font-mono text-xs font-black text-[#174A78]">{contract.NROCONTRATO}</p><p className="mt-1 max-w-[260px] truncate text-[10px] font-bold text-[#526A80]">{contract.NOMERAZAO}</p></TableCell><TableCell><p className="text-xs font-black text-[#173D6E]">{product.SEQPRODUTO}</p><p className="mt-1 max-w-[280px] truncate text-[10px] font-semibold text-[#60758A]">{product.DESCRICAO}</p></TableCell><TableCell className="text-right text-xs font-black text-[#173D6E]">{formatKg(detail.PESO)}</TableCell><TableCell className="text-xs font-semibold text-[#526A80]">{detail.NUMERO_ORDEM ? `OP ${detail.NUMERO_ORDEM}` : detail.NROPEDIDO ? `Pedido ${detail.NROPEDIDO}` : detail.NROCARGA ? `Carga ${detail.NROCARGA}` : "Sem vínculo externo"}</TableCell><TableCell className="text-xs font-bold text-[#526A80]">{detail.USUARIO || (detail.EDITAVEL ? "Não informado" : "ERP")}</TableCell></TableRow>)}</TableBody></Table></div></CardContent></Card>;
}

interface ContractSpreadsheetGridProps {
  contracts: ExportContract[];
  activeCount: number;
  disregardedCount: number;
  contractTab: "ATIVOS" | "DESCONSIDERADOS";
  setContractTab: (value: "ATIVOS" | "DESCONSIDERADOS") => void;
  search: string;
  setSearch: (value: string) => void;
  country: string;
  setCountry: (value: string) => void;
  countries: Array<string | null | undefined>;
  onManage: (contractId: number) => void;
}

function ContractSpreadsheetGrid({
  contracts,
  activeCount,
  disregardedCount,
  contractTab,
  setContractTab,
  search,
  setSearch,
  country,
  setCountry,
  countries,
  onManage,
}: ContractSpreadsheetGridProps) {
  return (
    <Card className="overflow-hidden border-[#B8C9D8] shadow-sm">
      <CardContent className="p-0">
        <div className="flex flex-col gap-3 border-b border-[#D5E0E9] bg-white p-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#60758A]">Visão semelhante à planilha</p>
            <h2 className="text-lg font-black text-[#173D6E]">Distribuição dos pesos por contrato</h2>
            <p className="mt-1 text-xs text-[#667B90]">Contrato, produto, peso vendido, estoque separado e saldo permanecem visíveis na mesma grade.</p>
          </div>
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <div className="inline-flex rounded-lg border border-[#C7D4E0] bg-[#F4F7FA] p-1">
              <button type="button" onClick={() => { setContractTab("ATIVOS"); setCountry("TODOS"); }} className={`rounded-md px-3 py-1.5 text-xs font-black ${contractTab === "ATIVOS" ? "bg-[#244B70] text-white" : "text-[#526A80]"}`}>Ativos {activeCount}</button>
              <button type="button" onClick={() => { setContractTab("DESCONSIDERADOS"); setCountry("TODOS"); }} className={`rounded-md px-3 py-1.5 text-xs font-black ${contractTab === "DESCONSIDERADOS" ? "bg-[#244B70] text-white" : "text-[#526A80]"}`}>Desconsiderados {disregardedCount}</button>
            </div>
            <div className="relative min-w-[280px]">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#8396A9]" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} className="h-10 pl-9" placeholder="Contrato, cliente, país ou produto" />
            </div>
            <select value={country} onChange={(event) => setCountry(event.target.value)} className="h-10 rounded-md border border-input bg-white px-3 text-sm lg:min-w-[170px]"><option value="TODOS">Todos os países</option>{countries.map((item) => <option key={String(item)} value={String(item)}>{item}</option>)}</select>
          </div>
        </div>

        <div className="max-h-[70vh] overflow-auto">
          <Table className="min-w-[1680px] border-separate border-spacing-0 text-[11px]">
            <TableHeader className="sticky top-0 z-20 bg-[#244B70] [&_th]:border-r [&_th]:border-[#496C8D] [&_th]:text-white">
              <TableRow className="hover:bg-[#244B70]">
                <TableHead className="sticky left-0 z-30 w-[112px] bg-[#244B70] text-[9px] font-black uppercase">Nº contrato</TableHead>
                <TableHead className="w-[108px] text-[9px] font-black uppercase">Status</TableHead>
                <TableHead className="w-[235px] text-[9px] font-black uppercase">Cliente</TableHead>
                <TableHead className="w-[105px] text-[9px] font-black uppercase">Destino</TableHead>
                <TableHead className="w-[78px] text-[9px] font-black uppercase">Código</TableHead>
                <TableHead className="w-[330px] text-[9px] font-black uppercase">Descrição</TableHead>
                <TableHead className="w-[112px] text-right text-[9px] font-black uppercase">Vendido</TableHead>
                <TableHead className="w-[112px] text-right text-[9px] font-black uppercase">Estoque</TableHead>
                <TableHead className="w-[112px] text-right text-[9px] font-black uppercase">Saldo</TableHead>
                <TableHead className="w-[118px] text-center text-[9px] font-black uppercase">Embarque ERP</TableHead>
                <TableHead className="w-[125px] text-center text-[9px] font-black uppercase">Emb. planejado</TableHead>
                <TableHead className="w-[128px] text-center text-[9px] font-black uppercase">Previsão produção</TableHead>
                <TableHead className="w-[250px] text-[9px] font-black uppercase">Observação</TableHead>
                <TableHead className="w-[94px] text-center text-[9px] font-black uppercase">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contracts.length === 0 && <TableRow><TableCell colSpan={14} className="h-36 text-center text-sm font-semibold text-[#6B7F92]">Nenhum contrato encontrado com os filtros informados.</TableCell></TableRow>}
              {contracts.flatMap((contract) => {
                const rows = contract.PRODUTOS.map((product, index) => {
                  const sold = Number(product.PESOCONTRATO || 0);
                  const allocated = Number(product.PESO_ATRELADO_TOTAL || 0);
                  const balance = Math.max(0, sold - allocated);
                  const status = productOperationalStatus(contract, product);
                  const complete = sold > 0 && allocated >= sold * 0.98;
                  return (
                    <TableRow key={`${contract.SEQCONTRATO}-${product.SEQPRODUTO}`} className={`${index === 0 ? "border-t-2 border-t-[#315F88]" : ""} ${complete ? "bg-emerald-50/60" : allocated > 0 ? "bg-amber-50/30" : "bg-white"} hover:bg-blue-50/60 [&_td]:border-b [&_td]:border-r [&_td]:border-[#D8E2EA]`}>
                      <TableCell className={`sticky left-0 z-10 font-mono font-black text-[#173D6E] ${complete ? "bg-emerald-50" : allocated > 0 ? "bg-[#FFFDF8]" : "bg-white"}`}>
                        {contract.NROCONTRATO}
                        {index === 0 && <p className="mt-0.5 text-[9px] font-medium text-[#71869A]">{formatDate(contract.DTACONTRATO)}</p>}
                      </TableCell>
                      <TableCell>{index === 0 ? contract.EM_EXPEDICAO ? <button type="button" onClick={() => setExpeditionContract(contract)} className="inline-flex rounded border border-cyan-200 bg-cyan-50 px-1.5 py-0.5 text-[8px] font-black uppercase text-cyan-800 hover:bg-cyan-100" title="Ver peso carregado e reservas pendentes">Expedição</button> : <span className="inline-flex rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[8px] font-black uppercase text-slate-700">{contract.STATUS_OPERACIONAL.replaceAll("_", " ")}</span> : null}</TableCell>
                      <TableCell><p className="truncate font-black text-[#173D6E]" title={contract.NOMERAZAO}>{index === 0 ? contract.NOMERAZAO : ""}</p></TableCell>
                      <TableCell className="font-semibold text-[#526A80]">{index === 0 ? contract.PAISDESTINO || "—" : ""}</TableCell>
                      <TableCell className="font-mono font-black text-[#244B70]">{product.SEQPRODUTO}</TableCell>
                      <TableCell><p className="truncate font-bold text-[#304D68]" title={product.DESCRICAO}>{product.DESCRICAO}</p></TableCell>
                      <TableCell className="text-right font-black text-[#173D6E]">{formatKg(sold)}</TableCell>
                      <TableCell className="text-right font-black text-emerald-700">{formatKg(allocated)}</TableCell>
                      <TableCell className={`text-right font-black ${balance > 0 ? "text-red-700" : "text-emerald-700"}`}>{formatKg(balance)}</TableCell>
                      <TableCell className="text-center font-semibold">{index === 0 ? <>{formatDate(contract.DTA_EMBARQUE_ERP)}{weekNumber(contract.DTA_EMBARQUE_ERP) && <p className="text-[9px] text-[#71869A]">Sem. {weekNumber(contract.DTA_EMBARQUE_ERP)}</p>}</> : null}</TableCell>
                      <TableCell className="text-center font-semibold">{index === 0 ? <>{formatDate(contract.DTA_EMBARQUE_PLANEJADA)}{weekNumber(contract.DTA_EMBARQUE_PLANEJADA) && <p className="text-[9px] text-[#71869A]">Sem. {weekNumber(contract.DTA_EMBARQUE_PLANEJADA)}</p>}</> : null}</TableCell>
                      <TableCell className="text-center"><span className={`inline-flex rounded border px-2 py-1 text-[8px] font-black uppercase ${status.className}`}>{status.label}</span></TableCell>
                      <TableCell><p className="line-clamp-2 leading-4 text-[#526A80]" title={contract.OBSERVACAO || ""}>{index === 0 ? contract.OBSERVACAO || "—" : ""}</p></TableCell>
                      <TableCell className="text-center">{index === 0 && <Button type="button" variant="outline" size="sm" onClick={() => onManage(contract.SEQCONTRATO)} className="h-7 border-[#AFC1D1] px-2 text-[9px] font-black text-[#244B70]">Gerenciar</Button>}</TableCell>
                    </TableRow>
                  );
                });
                const soldTotal = contract.PRODUTOS.reduce((sum, product) => sum + Number(product.PESOCONTRATO || 0), 0);
                const allocatedTotal = contract.PRODUTOS.reduce((sum, product) => sum + Number(product.PESO_ATRELADO_TOTAL || 0), 0);
                rows.push(
                  <TableRow key={`total-${contract.SEQCONTRATO}`} className="bg-[#FFF8D9] hover:bg-[#FFF3BF] [&_td]:border-b [&_td]:border-r [&_td]:border-[#D8E2EA]">
                    <TableCell className="sticky left-0 z-10 bg-[#FFF8D9] font-black text-[#173D6E]">{contract.NROCONTRATO}</TableCell>
                    <TableCell colSpan={5} className="font-black uppercase text-[#173D6E]">{contract.OBSERVACAO || "Total do contrato"}</TableCell>
                    <TableCell className="text-right font-black text-[#173D6E]">{formatKg(soldTotal)}</TableCell>
                    <TableCell className="text-right font-black text-emerald-700">{formatKg(allocatedTotal)}</TableCell>
                    <TableCell className="text-right font-black text-red-700">{formatKg(Math.max(0, soldTotal - allocatedTotal))}</TableCell>
                    <TableCell colSpan={5} />
                  </TableRow>,
                );
                return rows;
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

interface StockAllocationWorkspaceProps {
  section: "DISPONIVEIS" | "ALOCADOS" | "REVISAR_DATAS";
  onNavigateSection: (section: "DISPONIVEIS" | "ALOCADOS" | "REVISAR_DATAS") => void;
  stock: ContractStock[];
  totalErpStock: number;
  totalOrderStock: number;
  totalOrderReservation: number;
  totalBlockedStock: number;
  totalManualStock: number;
  totalFreeStock: number;
  totalAgedAllocated: number;
  validityAlertCount: number;
  search: string;
  onSearchChange: (value: string) => void;
  sort: { key: StockSortKey; direction: SortDirection };
  onSort: (key: StockSortKey) => void;
  syncing: boolean;
  onSync: () => Promise<void>;
  selectedStock: ContractStock | null;
  selectedContracts: Array<{ contract: ExportContract; product: ContractProduct }>;
  preferredContractId: number | null;
  allocatedItems: Array<{ contract: ExportContract; product: ContractProduct }>;
  contracts: ExportContract[];
  onSelectProduct: (productId: number | null) => void;
  configured: boolean;
  saving: string | null;
  reservationInputs: Record<string, string>;
  setReservationInputs: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onSaveReservation: (contract: ExportContract, product: ContractProduct, fallbackWeight?: number, inputMode?: ReservationInputMode) => Promise<void>;
  onSaveAgedReservation: (contract: ExportContract, product: ContractProduct) => Promise<void>;
  onSaveTreatment: (item: ContractStock, changes: { situacao?: "SEPARADO" | "DISPONIVEL" | "REPROCESSO"; data_reprocesso?: string | null; sem_venda?: boolean }) => Promise<void>;
  agedConfigured: boolean;
  lotTreatmentConfigured: boolean;
}

function StockAllocationWorkspace({
  section,
  onNavigateSection,
  stock,
  totalErpStock,
  totalOrderStock,
  totalOrderReservation,
  totalBlockedStock,
  totalManualStock,
  totalFreeStock,
  totalAgedAllocated,
  validityAlertCount,
  search,
  onSearchChange,
  sort,
  onSort,
  syncing,
  onSync,
  selectedStock,
  selectedContracts,
  preferredContractId,
  allocatedItems,
  contracts,
  onSelectProduct,
  configured,
  saving,
  reservationInputs,
  setReservationInputs,
  onSaveReservation,
  onSaveAgedReservation,
  onSaveTreatment,
  agedConfigured,
  lotTreatmentConfigured,
}: StockAllocationWorkspaceProps) {
  const [allocationView, setAllocationView] = useState<"DISPONIVEIS" | "ALOCADOS" | "REVISAR_DATAS" | "MAIS_6_MESES">(section);
  const [allocationSource, setAllocationSource] = useState<"REGULAR" | "MAIS_6_MESES">("REGULAR");
  const [reprocessDates, setReprocessDates] = useState<Record<number, string>>({});
  const [agedDecisionFilter, setAgedDecisionFilter] = useState("TODAS");
  const [agedDecisions, setAgedDecisions] = useState<Record<number, "" | "SEPARADO" | "DISPONIVEL" | "REPROCESSO" | "ALOCAR">>({});
  const [validityDetail, setValidityDetail] = useState<{ contract: ExportContract; product: ContractProduct } | null>(null);
  const [stockLotsDetail, setStockLotsDetail] = useState<ContractStock | null>(null);
  const [allocatedSort, setAllocatedSort] = useState<{ key: "PRODUTO" | "CONTRATO" | "EMBARQUE" | "OP" | "MANUAL" | "TOTAL" | "SALDO"; direction: SortDirection }>({ key: "CONTRATO", direction: "asc" });
  const [allocatedValidityFilter, setAllocatedValidityFilter] = useState("TODAS");
  const [reviewSort, setReviewSort] = useState<{ key: "PRODUTO" | "DATA" | "PESO" | "DECISAO"; direction: SortDirection }>({ key: "DATA", direction: "asc" });
  const [reviewDecisionFilter, setReviewDecisionFilter] = useState("TODAS");
  const [lotDecisions, setLotDecisions] = useState<Record<string, "" | "SEPARADO" | "DISPONIVEL" | "REPROCESSO" | "ALOCAR">>({});
  const [lotReprocessDates, setLotReprocessDates] = useState<Record<string, string>>({});
  const [lotSaving, setLotSaving] = useState<string | null>(null);
  const [reviewPreferredContractId, setReviewPreferredContractId] = useState<number | null>(null);
  const allocationTableScrollRef = useRef<HTMLDivElement | null>(null);
  const allocationBottomScrollRef = useRef<HTMLDivElement | null>(null);
  const syncingAllocationScroll = useRef(false);
  useEffect(() => {
    setAllocationView(section);
  }, [section]);

  const changeAllocationView = (next: "DISPONIVEIS" | "ALOCADOS" | "REVISAR_DATAS") => {
    setAllocationView(next);
    onNavigateSection(next);
  };
  const syncAllocationScroll = (source: "table" | "bottom") => {
    if (syncingAllocationScroll.current) return;
    const sourceElement = source === "table" ? allocationTableScrollRef.current : allocationBottomScrollRef.current;
    const targetElement = source === "table" ? allocationBottomScrollRef.current : allocationTableScrollRef.current;
    if (!sourceElement || !targetElement) return;
    syncingAllocationScroll.current = true;
    targetElement.scrollLeft = sourceElement.scrollLeft;
    requestAnimationFrame(() => { syncingAllocationScroll.current = false; });
  };
  const allocatedSearch = normalizeSearch(search);
  const changeAllocatedSort = (key: typeof allocatedSort.key) => setAllocatedSort((current) => ({
    key,
    direction: current.key === key && current.direction === "asc" ? "desc" : "asc",
  }));
  const changeReviewSort = (key: typeof reviewSort.key) => setReviewSort((current) => ({
    key,
    direction: current.key === key && current.direction === "asc" ? "desc" : "asc",
  }));
  const visibleAllocatedItems = allocatedItems
    .filter(({ contract, product }) =>
      !allocatedSearch ||
      String(product.SEQPRODUTO).includes(allocatedSearch) ||
      normalizeSearch(product.DESCRICAO).includes(allocatedSearch) ||
      normalizeSearch(contract.NROCONTRATO).includes(allocatedSearch) ||
      normalizeSearch(contract.NOMERAZAO).includes(allocatedSearch),
    )
    .filter(({ product }) => {
      if (allocatedValidityFilter === "TODAS") return true;
      const situation = !product.REGRA_VALIDADE_CONFIGURADA
        ? "SEM_REGRA"
        : Number(product.PESO_ESTOQUE_ELEGIVEL || 0) <= 0
          ? "SEM_VALIDO"
          : Number(product.PESO_ESTOQUE_ATENCAO || 0) > 0
            ? "ATENCAO"
            : "VALIDO";
      return situation === allocatedValidityFilter;
    })
    .sort((first, second) => {
      const values = (entry: typeof first) => ({
        PRODUTO: `${entry.product.SEQPRODUTO} ${entry.product.DESCRICAO || ""}`,
        CONTRATO: `${entry.contract.NROCONTRATO} ${entry.contract.NOMERAZAO || ""}`,
        EMBARQUE: comparableDate(entry.contract.DTA_EMBARQUE_PLANEJADA || entry.contract.DTA_EMBARQUE_ERP) || 0,
        OP: Number(entry.product.PESO_ATRELADO_ORDEM || 0),
        MANUAL: Number(entry.product.PESO_RESERVADO_MANUAL || 0),
        TOTAL: Number(entry.product.PESO_ATRELADO_TOTAL || 0),
        SALDO: Number(entry.product.SALDO_CONTRATO || 0),
      });
      const firstValue = values(first)[allocatedSort.key];
      const secondValue = values(second)[allocatedSort.key];
      const comparison = typeof firstValue === "number"
        ? firstValue - Number(secondValue)
        : String(firstValue).localeCompare(String(secondValue), "pt-BR", { numeric: true });
      return allocatedSort.direction === "asc" ? comparison : -comparison;
    });
  const agedStock = stock
    .filter((item) => Number(item.PESO_MAIS_6_MESES || 0) > 0)
    .filter((item) => {
      const term = normalizeSearch(search);
      const matchesSearch = !term || String(item.SEQPRODUTO).includes(term) || normalizeSearch(item.DESCRPRODUTO).includes(term);
      const situation = item.SITUACAO_6_MESES || "SEPARADO";
      const matchesDecision = agedDecisionFilter === "TODAS"
        || situation === agedDecisionFilter
        || (agedDecisionFilter === "SEM_VENDA" && Boolean(item.SEM_VENDA));
      return matchesSearch && matchesDecision;
    });
  const availableStock = stock.filter((item) =>
    Number(item.PESO_LIVRE_VERTICE || 0) > 0 ||
    Number(item.PESO_RESERVADO_VERTICE || 0) > 0 ||
    item.SITUACAO_6_MESES === "DISPONIVEL",
  );
  const dateReviewItems = stock.map((item) => {
    const productContracts = productContractsForValidity(item.SEQPRODUTO, contracts);
    const trackedWeight = (item.LOTES_LIVRES || []).reduce(
      (sum, lot) => sum + Math.max(0, Number(lot.PESO_LIVRE_ESTIMADO || 0)),
      0,
    );
    const untrackedWeightFromContracts = productContracts.reduce((maximum, contract) => {
      const product = contract.PRODUTOS.find((entry) => entry.SEQPRODUTO === item.SEQPRODUTO);
      return Math.max(maximum, Number(product?.PESO_ESTOQUE_SEM_RASTREIO || 0));
    }, 0);
    const untrackedWeight = Math.max(
      0,
      Number(item.PESO_LIVRE_SEM_RASTREIO || 0),
      untrackedWeightFromContracts,
      Number(item.PESO_LIVRE_VERTICE || 0) - trackedWeight,
    );
    const reviewableLots: ContractStockLot[] = [
      ...(item.LOTES_LIVRES || []),
      ...(untrackedWeight > 0 ? [{
        SEQPRODUTO: item.SEQPRODUTO,
        DESCRPRODUTO: item.DESCRPRODUTO,
        DTAPRODUCAO: null,
        LOTE: null,
        SEQEMBALAGEM: null,
        QUANTIDADE: 0,
        PESO_FISICO: untrackedWeight,
        PESO_DISPONIVEL_ESTIMADO: untrackedWeight,
        PESO_LIVRE_ESTIMADO: untrackedWeight,
        SITUACAO_VALIDADE: "SEM_DATA" as const,
        CHAVE_LOTE: `SEM-RASTREIO-${item.SEQPRODUTO}`,
        SINTETICO_SEM_RASTREIO: true,
      }] : []),
    ];
    const rejectedLots = reviewableLots
      .filter((lot) => {
        if (lot.SINTETICO_SEM_RASTREIO) return true;
        const compatible = compatibleContractsForLot(
          item.SEQPRODUTO,
          lot.DTAPRODUCAO,
          productContracts,
        );
        return productContracts.length === 0
          || comparableDate(lot.DTAPRODUCAO) == null
          || compatible.length < productContracts.length;
      })
      .map((lot) => ({
        ...lot,
        SITUACAO_VALIDADE: lot.SINTETICO_SEM_RASTREIO
          ? "SEM_DATA" as const
          : reviewLotValidityStatus(item.SEQPRODUTO, lot.DTAPRODUCAO, contracts),
      }));
    const rejectedDatedWeight = rejectedLots.reduce(
      (sum, lot) => sum + Number(lot.PESO_LIVRE_ESTIMADO || 0),
      0,
    );
    return { item, rejectedLots, rejectedDatedWeight };
  }).filter((analysis) => analysis.rejectedDatedWeight > 0);
  const dateReviewByProduct = new Map(dateReviewItems.map((analysis) => [analysis.item.SEQPRODUTO, analysis]));
  const dateReviewLotCount = dateReviewItems.reduce((sum, analysis) => sum + analysis.rejectedLots.length, 0);
  const reviewRows = dateReviewItems
    .flatMap(({ item, rejectedLots }) => rejectedLots.map((lot) => ({ item, lot })))
    .filter(({ item }) => {
      const term = normalizeSearch(search);
      return !term
        || String(item.SEQPRODUTO).includes(term)
        || normalizeSearch(item.DESCRPRODUTO).includes(term);
    })
    .filter(({ lot }) => {
      const decision = lotDecisions[lot.CHAVE_LOTE || ""] || lot.DECISAO_LOTE || "PENDENTE";
      return reviewDecisionFilter === "TODAS" || decision === reviewDecisionFilter;
    })
    .sort((first, second) => {
      const values = (entry: typeof first) => ({
        PRODUTO: `${entry.item.SEQPRODUTO} ${entry.item.DESCRPRODUTO || ""}`,
        DATA: comparableDate(entry.lot.DTAPRODUCAO) || 0,
        PESO: Number(entry.lot.PESO_LIVRE_ESTIMADO || 0),
        DECISAO: lotDecisions[entry.lot.CHAVE_LOTE || ""] || entry.lot.DECISAO_LOTE || "PENDENTE",
      });
      const firstValue = values(first)[reviewSort.key];
      const secondValue = values(second)[reviewSort.key];
      const comparison = typeof firstValue === "number"
        ? firstValue - Number(secondValue)
        : String(firstValue).localeCompare(String(secondValue), "pt-BR", { numeric: true });
      return reviewSort.direction === "asc" ? comparison : -comparison;
    });

  const saveLotTreatment = async (
    item: ContractStock,
    lot: ContractStockLot,
    decision: "SEPARADO" | "DISPONIVEL" | "REPROCESSO" | "ALOCAR",
    reprocessDateOverride?: string,
    targetContractId?: number,
    targetWeight?: number,
  ) => {
    const key = lot.CHAVE_LOTE || `${item.SEQPRODUTO}-${lot.DTAPRODUCAO}-${lot.LOTE}-${lot.SEQEMBALAGEM}`;
    if (lot.SINTETICO_SEM_RASTREIO) {
      toast.warning("Esse peso não possui lote ou data de produção rastreável no ERP. Corrija a origem do estoque antes de definir uma ação por lote.");
      return;
    }
    const reprocessDate = reprocessDateOverride ?? lotReprocessDates[key] ?? inputDate(lot.DTA_REPROCESSO_LOTE);
    if (decision === "REPROCESSO" && !reprocessDate) {
      toast.error("Informe a data prevista para o reprocesso.");
      return;
    }
    const targetContract = decision === "ALOCAR"
      ? compatibleContractsForLot(item.SEQPRODUTO, lot.DTAPRODUCAO, contracts)
        .find((contract) => contract.SEQCONTRATO === targetContractId)
      : null;
    const targetProduct = targetContract?.PRODUTOS.find((product) => product.SEQPRODUTO === item.SEQPRODUTO) || null;
    const target = targetContract && targetProduct ? { contract: targetContract, product: targetProduct } : null;
    if (decision === "ALOCAR" && !target) {
      toast.error("Selecione o contrato compatível que receberá este peso.");
      return;
    }
    setLotSaving(key);
    try {
      const result = await contractsApi.saveStockLotTreatment({
        seqproduto: item.SEQPRODUTO,
        data_producao: String(lot.DTAPRODUCAO || "").slice(0, 10),
        lote: lot.LOTE == null ? null : String(lot.LOTE),
        seqembalagem: lot.SEQEMBALAGEM == null ? null : String(lot.SEQEMBALAGEM),
        peso_referencia: Number(lot.PESO_LIVRE_ESTIMADO || 0),
        situacao: decision,
        data_reprocesso: decision === "REPROCESSO" ? reprocessDate : null,
        versao: lot.VERSAO_DECISAO_LOTE,
      });
      toast.success(result.message);
      setLotDecisions((current) => ({ ...current, [key]: decision }));
      if (decision === "ALOCAR" && target) {
        const inputKey = `${target.contract.SEQCONTRATO}-${item.SEQPRODUTO}`;
        const weight = Math.max(0, Number(targetWeight || 0));
        setReservationInputs((current) => ({
          ...current,
          [inputKey]: allocationInputValue(weight),
        }));
        setReviewPreferredContractId(target.contract.SEQCONTRATO);
        setAllocationSource("REGULAR");
        onSelectProduct(item.SEQPRODUTO);
        onNavigateSection("DISPONIVEIS");
      }
      await onSync();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setLotSaving(null);
    }
  };

  return <>
    {selectedStock && <AcceptedOldStockNotice stock={selectedStock} saving={lotSaving} onReverse={(lot) => saveLotTreatment(selectedStock, lot, "SEPARADO")} />}
    <ModernStockOperationsLayout
    section={allocationView === "MAIS_6_MESES" ? "DISPONIVEIS" : allocationView}
    stock={stock}
    selectedStock={selectedStock}
    selectedContracts={selectedContracts}
    preferredContractId={reviewPreferredContractId ?? preferredContractId}
    allocatedItems={visibleAllocatedItems}
    contracts={contracts}
    reviewRows={reviewRows}
    totalErpStock={totalErpStock}
    totalOrderStock={totalOrderStock}
    totalOrderReservation={totalOrderReservation}
    totalBlockedStock={totalBlockedStock}
    totalManualStock={totalManualStock}
    totalFreeStock={totalFreeStock}
    validityAlertCount={validityAlertCount}
    search={search}
    onSearchChange={onSearchChange}
    syncing={syncing}
    onSync={onSync}
    onSelectProduct={onSelectProduct}
    configured={configured}
    saving={saving}
    reservationInputs={reservationInputs}
    setReservationInputs={setReservationInputs}
    onSaveReservation={onSaveReservation}
    onSaveLotTreatment={saveLotTreatment}
    onReviewProduct={(productId) => {
      onSearchChange(String(productId));
      onSelectProduct(null);
      onNavigateSection("REVISAR_DATAS");
    }}
      lotSaving={lotSaving}
    />
  </>;

  return (
    <div className="space-y-4">
      {allocationView === "DISPONIVEIS" && <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <OverviewMetric icon={Weight} label="Estoque físico ERP" value={formatKg(totalErpStock)} tone="blue" />
        <OverviewMetric icon={Factory} label="Protegido por OP" value={formatKg(totalOrderStock)} tone="blue" />
        <OverviewMetric icon={LockKeyhole} label="Reservado em pedido" value={formatKg(totalOrderReservation)} tone="blue" />
        <OverviewMetric icon={Boxes} label="Estoque realmente livre" value={formatKg(totalFreeStock)} tone="green" />
        <OverviewMetric icon={ShieldAlert} label="Restrições de validade" value={String(validityAlertCount)} tone={validityAlertCount > 0 ? "red" : "green"} />
      </section>}
      {allocationView === "ALOCADOS" && <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <OverviewMetric icon={FileSignature} label="Peso contratado" value={formatKg(allocatedItems.reduce((sum, item) => sum + Number(item.product.PESOCONTRATO || 0), 0))} tone="blue" />
        <OverviewMetric icon={LockKeyhole} label="Peso alocado" value={formatKg(allocatedItems.reduce((sum, item) => sum + Number(item.product.PESO_ATRELADO_TOTAL || 0), 0))} tone="blue" />
        <OverviewMetric icon={Weight} label="Alocado manualmente" value={formatKg(totalManualStock)} tone="orange" />
        <OverviewMetric icon={Boxes} label="Estoque livre global" value={formatKg(totalFreeStock)} tone="green" />
      </section>}
      {allocationView === "REVISAR_DATAS" && <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <OverviewMetric icon={CalendarDays} label="Lotes que exigem decisão" value={String(dateReviewLotCount)} tone={dateReviewLotCount > 0 ? "red" : "green"} />
        <OverviewMetric icon={CheckCircle2} label="Alocações existentes" value={String(allocatedItems.length)} tone="green" />
        <OverviewMetric icon={AlertTriangle} label="Peso bloqueado no ERP" value={formatKg(totalBlockedStock)} tone={totalBlockedStock > 0 ? "orange" : "green"} />
        <OverviewMetric icon={PackageSearch} label="Produtos analisados" value={String(stock.length)} tone="blue" />
      </section>}

      <Card className="border-[#CEDAE5] shadow-sm">
        <CardContent className="p-0">
          <div className="flex flex-col gap-3 border-b border-[#DCE5ED] p-4 lg:flex-row lg:items-end lg:justify-between">
            <div><h2 className="text-lg font-black text-[#102F53]">{allocationView === "ALOCADOS" ? "Alocações por produto e contrato" : allocationView === "REVISAR_DATAS" ? "Lotes que exigem decisão" : "Produtos disponíveis para alocação"}</h2><p className="mt-0.5 text-xs text-[#667B90]">{allocationView === "ALOCADOS" ? "Consulte OP, pedido e parcela manual sem alterar as reservas protegidas." : allocationView === "REVISAR_DATAS" ? "Analise validade, rastreabilidade e o destino operacional de cada lote." : "Selecione um produto para comparar contratos candidatos e definir o peso manual."}</p></div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="hidden">
                <button type="button" onClick={() => setAllocationView("DISPONIVEIS")} className={`rounded-md px-5 py-2.5 text-xs font-black ${allocationView === "DISPONIVEIS" ? "bg-[#244B70] text-white" : "text-[#526A80]"}`}>Disponível</button>
                <button type="button" onClick={() => setAllocationView("ALOCADOS")} className={`rounded-md px-5 py-2.5 text-xs font-black ${allocationView === "ALOCADOS" ? "bg-[#244B70] text-white" : "text-[#526A80]"}`}>Já alocado ({allocatedItems.length})</button>
                <button type="button" onClick={() => setAllocationView("REVISAR_DATAS")} className={`rounded-md px-5 py-2.5 text-xs font-black ${allocationView === "REVISAR_DATAS" ? "bg-amber-600 text-white" : "text-[#526A80]"}`}>Revisar datas ({dateReviewLotCount})</button>
              </div>
              <div className="relative w-full sm:min-w-[300px]">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#8396A9]" />
                <Input value={search} onChange={(event) => onSearchChange(event.target.value)} className="pl-9" placeholder="Código ou nome do produto" />
              </div>
              {allocationView === "MAIS_6_MESES" && (
                <select
                  value={agedDecisionFilter}
                  onChange={(event) => setAgedDecisionFilter(event.target.value)}
                  className="h-10 rounded-md border border-input bg-white px-3 text-sm font-semibold text-[#304D68] sm:min-w-[190px]"
                  aria-label="Filtrar estoque por decisão"
                >
                  <option value="TODAS">Todas as decisões</option>
                  <option value="SEPARADO">Separado</option>
                  <option value="DISPONIVEL">No disponível</option>
                  <option value="REPROCESSO">Reprocesso</option>
                  <option value="SEM_VENDA">Sem venda</option>
                </select>
              )}
              {allocationView === "REVISAR_DATAS" && (
                <select
                  value={reviewDecisionFilter}
                  onChange={(event) => setReviewDecisionFilter(event.target.value)}
                  className="h-10 rounded-md border border-input bg-white px-3 text-sm font-semibold text-[#304D68] sm:min-w-[180px]"
                  aria-label="Filtrar revisão por decisão"
                >
                  <option value="TODAS">Todas as decisões</option>
                  <option value="PENDENTE">Sem decisão</option>
                  <option value="SEPARADO">Separado</option>
                  <option value="DISPONIVEL">Disponível</option>
                  <option value="REPROCESSO">Reprocesso</option>
                  <option value="ALOCAR">Alocar</option>
                </select>
              )}
              {allocationView === "ALOCADOS" && (
                <select
                  value={allocatedValidityFilter}
                  onChange={(event) => setAllocatedValidityFilter(event.target.value)}
                  className="h-10 rounded-md border border-input bg-white px-3 text-sm font-semibold text-[#304D68] sm:min-w-[170px]"
                  aria-label="Filtrar alocações por validade"
                >
                  <option value="TODAS">Todas as validades</option>
                  <option value="VALIDO">Estoque válido</option>
                  <option value="ATENCAO">Válido com atenção</option>
                  <option value="SEM_VALIDO">Sem estoque válido</option>
                  <option value="SEM_REGRA">Sem regra</option>
                </select>
              )}
              <Button type="button" variant="outline" disabled={syncing} onClick={() => void onSync()} className="h-10 border-[#AFC1D1] text-[#244B70]">
                <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "Sincronizando..." : "Sincronizar ERP"}
              </Button>
            </div>
          </div>

          {allocationView === "DISPONIVEIS" ? <div className="max-h-[640px] overflow-auto">
            <Table className="w-full min-w-[1320px] table-fixed [&_td]:px-3 [&_th]:px-3">
              <TableHeader className="sticky top-0 z-10 bg-[#EDF3F7]">
                <TableRow>
                  <SortableStockHeader label="Produto" sortKey="SEQPRODUTO" activeSort={sort} onSort={onSort} className="w-[92px]" />
                  <SortableStockHeader label="Descrição" sortKey="DESCRPRODUTO" activeSort={sort} onSort={onSort} />
                  <SortableStockHeader label="Estoque disponível" sortKey="PESODISPONIVEL" activeSort={sort} onSort={onSort} numeric className="w-[140px]" />
                   <SortableStockHeader label="Protegido por OP" sortKey="PESO_ATRELADO_ORDEM" activeSort={sort} onSort={onSort} numeric className="w-[145px]" />
                   <SortableStockHeader label="Reserva pedido" sortKey="PESO_RESERVADO_PEDIDO" activeSort={sort} onSort={onSort} numeric className="w-[140px]" />
                   <SortableStockHeader label="Bloqueado ERP" sortKey="PESO_BLOQUEADO_ERP" activeSort={sort} onSort={onSort} numeric className="w-[140px]" />
                  <SortableStockHeader label="Manual" sortKey="PESO_RESERVADO_VERTICE" activeSort={sort} onSort={onSort} numeric className="w-[130px]" />
                  <SortableStockHeader label="Livre para alocar" sortKey="PESO_LIVRE_VERTICE" activeSort={sort} onSort={onSort} numeric className="w-[145px]" />
                  <Header className="w-[190px]">Produção disponível</Header>
                  <Header className="w-[120px] text-center">Contratos</Header>
                  <Header className="w-[120px] text-center">Ação</Header>
                </TableRow>
              </TableHeader>
              <TableBody>
                {availableStock.length === 0 && (
                  <TableRow>
                      <TableCell colSpan={11} className="h-32 text-center text-sm font-semibold text-[#6B7F92]">
                      Nenhum produto com estoque livre ou alocação manual foi encontrado.
                    </TableCell>
                  </TableRow>
                )}
                {availableStock.map((item) => {
                  const matchingContracts = contracts.filter((contract) =>
                    contract.PRODUTOS.some((product) => product.SEQPRODUTO === item.SEQPRODUTO),
                  ).length;
                  const dateReview = dateReviewByProduct.get(item.SEQPRODUTO);
                  return (
                    <TableRow key={item.SEQPRODUTO} onClick={() => { setAllocationSource("REGULAR"); onSelectProduct(item.SEQPRODUTO); }} className={`cursor-pointer hover:bg-[#EDF5FB] ${selectedStock?.SEQPRODUTO === item.SEQPRODUTO ? "bg-blue-50 ring-1 ring-inset ring-[#6C9BC1]" : ""}`}>
                      <TableCell className="font-mono text-xs font-black text-[#244B70]">{item.SEQPRODUTO}</TableCell>
                      <TableCell><div className="flex min-w-0 items-center gap-2"><p className="truncate text-xs font-bold text-[#304D68]" title={item.DESCRPRODUTO}>{item.DESCRPRODUTO}</p>{item.SEM_VENDA && <span className="shrink-0 rounded-full border border-sky-300 bg-sky-50 px-2 py-0.5 text-[9px] font-black uppercase text-sky-800">Sem venda</span>}</div></TableCell>
                      <NumberCell value={item.PESO_DISPONIVEL_REGULAR ?? item.PESODISPONIVEL} />
                       <NumberCell value={item.PESO_ATRELADO_ORDEM} />
                       <NumberCell value={item.PESO_RESERVADO_PEDIDO} />
                      <TableCell className="text-right text-xs font-black text-red-700">{formatKg(item.PESO_BLOQUEADO_ERP)}</TableCell>
                      <NumberCell value={item.PESO_RESERVADO_VERTICE} />
                      <TableCell className="text-right text-xs font-black text-emerald-700">{formatKg(item.PESO_LIVRE_VERTICE)}</TableCell>
                      <TableCell>
                        <button type="button" onClick={(event) => { event.stopPropagation(); setStockLotsDetail(item); }} className="w-full rounded-md p-1 text-left hover:bg-blue-50" title="Ver quantidades livres por data de produção">
                          {Number(item.QTD_LOTES_LIVRES || 0) > 0 ? <><p className="whitespace-nowrap text-xs font-bold text-[#304D68]">{formatDate(item.DTA_PRODUCAO_MAIS_ANTIGA)} a {formatDate(item.DTA_PRODUCAO_MAIS_RECENTE)}</p><p className="mt-0.5 text-[9px] font-semibold text-blue-700">{item.QTD_LOTES_LIVRES} lotes livres · ver datas</p>{dateReview && <p className="mt-1 text-[9px] font-black text-amber-700">{formatKg(dateReview.rejectedDatedWeight)} sem destino por validade</p>}</> : <><p className="text-xs font-black text-red-700">Sem rastreabilidade</p><p className="mt-0.5 text-[9px] font-semibold text-red-600">Clique para entender</p></>}
                        </button>
                      </TableCell>
                      <TableCell className="text-center text-xs font-black text-[#47627D]">{matchingContracts || "-"}</TableCell>
                      <TableCell className="text-center"><div className="flex items-center justify-center gap-1">
                        <Button type="button" size="sm" variant="outline" onClick={(event) => { event.stopPropagation(); void onSaveTreatment(item, { sem_venda: !item.SEM_VENDA }); }} disabled={!agedConfigured || saving === `stock-treatment-${item.SEQPRODUTO}`} className="h-8 border-sky-300 px-2 text-[10px] font-black text-sky-800">{item.SEM_VENDA ? "Com venda" : "Sem venda"}</Button>
                        <Button type="button" size="sm" variant="outline" onClick={(event) => { event.stopPropagation(); setAllocationSource("REGULAR"); onSelectProduct(item.SEQPRODUTO); }} className="h-8 border-[#AFC1D1] text-xs font-black text-[#244B70]">
                          {selectedStock?.SEQPRODUTO === item.SEQPRODUTO ? "Selecionado" : "Alocar"}
                          <ChevronRight className="ml-1 h-3.5 w-3.5" />
                        </Button>
                      </div></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div> : allocationView === "ALOCADOS" ? <div className="max-h-[640px] overflow-auto">
            <Table className="w-full table-fixed [&_td]:px-2.5 [&_th]:px-2.5">
              <TableHeader className="sticky top-0 z-10 bg-[#EDF3F7]"><TableRow>
                <CompactSortableHeader label="Produto" sortKey="PRODUTO" activeSort={allocatedSort} onSort={changeAllocatedSort} />
                <CompactSortableHeader label="Contrato / cliente" sortKey="CONTRATO" activeSort={allocatedSort} onSort={changeAllocatedSort} />
                <CompactSortableHeader label="Embarque" sortKey="EMBARQUE" activeSort={allocatedSort} onSort={changeAllocatedSort} className="w-[108px]" />
                 <CompactSortableHeader label="OP / pedido / manual" sortKey="OP" activeSort={allocatedSort} onSort={changeAllocatedSort} numeric className="w-[175px]" />
                <CompactSortableHeader label="Total / saldo" sortKey="TOTAL" activeSort={allocatedSort} onSort={changeAllocatedSort} numeric className="w-[155px]" />
                <Header className="w-[130px]">Validade / ação</Header>
              </TableRow></TableHeader>
              <TableBody>
                {visibleAllocatedItems.length === 0 && <TableRow><TableCell colSpan={6} className="h-32 text-center text-sm font-semibold text-[#6B7F92]">Nenhuma alocação encontrada para a pesquisa.</TableCell></TableRow>}
                {visibleAllocatedItems.map(({ contract, product }) => { const validity = validityStatus(product); const allocationKey = `${contract.SEQCONTRATO}-${product.SEQPRODUTO}`; const manualWeight = Number(product.PESO_RESERVADO_MANUAL || 0); return <TableRow key={allocationKey} className={reservationCoverageClass(product)}>
                  <TableCell><p className="truncate text-xs font-black text-[#173D6E]" title={product.DESCRICAO}>{product.SEQPRODUTO} · {product.DESCRICAO}</p></TableCell>
                  <TableCell><p className="truncate text-xs font-black text-[#173D6E]">{contract.NROCONTRATO}</p><p className="truncate text-[10px] font-semibold text-[#647B90]" title={contract.NOMERAZAO}>{contract.NOMERAZAO}</p></TableCell>
                  <TableCell className="whitespace-nowrap text-xs font-semibold">{formatDate(contract.DTA_EMBARQUE_PLANEJADA || contract.DTA_EMBARQUE_ERP)}</TableCell>
                   <TableCell className="text-right"><p className="text-xs font-black text-blue-700">OP {formatKg(product.PESO_ATRELADO_ORDEM)}</p><p className="text-[10px] font-bold text-emerald-700">Pedido {formatKg(product.PESO_RESERVADO_PEDIDO)}</p><div className="flex items-center justify-end gap-1"><p className="text-[10px] font-semibold text-amber-700">Manual {formatKg(manualWeight)}</p>{manualWeight > 0 && <Button type="button" size="icon" variant="outline" disabled={saving === allocationKey} onClick={() => void onSaveReservation(contract, product, 0, "REMOVE")} title="Retirar somente a alocação manual" aria-label={`Retirar alocação manual do contrato ${contract.NROCONTRATO}`} className="h-6 w-6 shrink-0 border-red-200 text-red-700 hover:bg-red-50"><Minus className="h-3.5 w-3.5" /></Button>}</div></TableCell>
                  <TableCell className="text-right"><p className="text-xs font-black text-emerald-700">{formatKg(product.PESO_ATRELADO_TOTAL)}</p>{Number(product.PESO_TRANSBORDADO || 0) > 0 ? <p className="text-[10px] font-black text-red-700">Transbordou {formatKg(product.PESO_TRANSBORDADO)}</p> : <p className="text-[10px] font-semibold text-[#647B90]">Saldo {formatKg(product.SALDO_CONTRATO)}</p>}</TableCell>
                  <TableCell><div className="flex items-center justify-between gap-1"><span className={`truncate rounded-full border px-2 py-1 text-[8px] font-black uppercase ${validity.className}`}>{validity.label}</span><Button type="button" size="sm" variant="outline" onClick={() => onSelectProduct(product.SEQPRODUTO)} className="h-7 shrink-0 border-[#AFC1D1] px-2 text-[10px] font-black text-[#244B70]">Ver</Button></div></TableCell>
                </TableRow>; })}
              </TableBody>
            </Table>
          </div> : allocationView === "REVISAR_DATAS" ? <div className="max-h-[640px] overflow-auto">
            <div className="border-b border-amber-200 bg-amber-50 p-3 text-xs font-semibold leading-5 text-amber-900">Cada linha representa um peso livre com data que nenhum contrato ativo aceita. Defina a destinação sem alterar os outros lotes do produto.</div>
            {!lotTreatmentConfigured && <div className="border-b border-red-200 bg-red-50 p-3 text-xs font-bold text-red-900">Execute <code>sql/migrar_contrato_estoque_lote_acao.sql</code> para habilitar as decisões por lote.</div>}
            <Table className="w-full table-fixed [&_td]:px-2.5 [&_th]:px-2.5">
              <TableHeader className="sticky top-0 z-10 bg-[#EDF3F7]"><TableRow>
                <CompactSortableHeader label="Produto" sortKey="PRODUTO" activeSort={reviewSort} onSort={changeReviewSort} />
                <CompactSortableHeader label="Produção / lote" sortKey="DATA" activeSort={reviewSort} onSort={changeReviewSort} className="w-[175px]" />
                <CompactSortableHeader label="Peso sem destino" sortKey="PESO" activeSort={reviewSort} onSort={changeReviewSort} numeric className="w-[145px]" />
                <CompactSortableHeader label="Decisão" sortKey="DECISAO" activeSort={reviewSort} onSort={changeReviewSort} className="w-[210px]" />
                <Header className="w-[205px]">Data / confirmar</Header>
              </TableRow></TableHeader>
              <TableBody>{reviewRows.length === 0 ? <TableRow><TableCell colSpan={5} className="h-32 text-center text-sm font-semibold text-emerald-700">Nenhum lote encontrado para os filtros informados.</TableCell></TableRow> : reviewRows.map(({ item, lot }) => {
                const key = lot.CHAVE_LOTE || `${item.SEQPRODUTO}-${lot.DTAPRODUCAO}-${lot.LOTE}-${lot.SEQEMBALAGEM}`;
                const decision = lotDecisions[key] || lot.DECISAO_LOTE || "";
                const reprocessDate = lotReprocessDates[key] ?? inputDate(lot.DTA_REPROCESSO_LOTE);
                return <TableRow key={key} className="bg-amber-50/20">
                  <TableCell><button type="button" onClick={() => { setAllocationSource("REGULAR"); onSelectProduct(item.SEQPRODUTO); }} className="group w-full rounded-md px-1 py-1 text-left hover:bg-blue-50" title="Ver contratos deste produto e conferir as travas permitidas"><p className="truncate text-xs font-black text-[#173D6E] group-hover:text-blue-700" title={item.DESCRPRODUTO}>{item.SEQPRODUTO} · {item.DESCRPRODUTO}</p><p className="mt-0.5 text-[9px] font-bold text-blue-700">Ver contratos e travas</p></button></TableCell>
                  <TableCell><p className="text-xs font-black text-[#304D68]">{formatDate(lot.DTAPRODUCAO)}</p><p className="truncate text-[10px] font-semibold text-[#71869A]">{lot.LOTE || "Sem lote"}{lot.SEQEMBALAGEM ? ` · Emb. ${lot.SEQEMBALAGEM}` : ""}</p></TableCell>
                  <TableCell className="text-right text-sm font-black text-amber-800">{formatKg(lot.PESO_LIVRE_ESTIMADO)}</TableCell>
                  <TableCell><select value={decision} disabled={!lotTreatmentConfigured || lotSaving === key} onChange={(event) => setLotDecisions((current) => ({ ...current, [key]: event.target.value as typeof decision }))} className="h-9 w-full rounded-md border border-[#C7D4E0] bg-white px-2 text-xs font-bold text-[#304D68]"><option value="">Selecionar decisão</option><option value="SEPARADO">Manter separado</option><option value="DISPONIVEL">Manter disponível</option><option value="REPROCESSO">Enviar para reprocesso</option><option value="ALOCAR">Alocar em contrato</option></select></TableCell>
                  <TableCell>{decision === "REPROCESSO" ? <div className="flex gap-1"><Input type="date" value={reprocessDate} onChange={(event) => setLotReprocessDates((current) => ({ ...current, [key]: event.target.value }))} className="h-9 min-w-0 text-xs" /><Button type="button" size="sm" disabled={!lotTreatmentConfigured || lotSaving === key || !reprocessDate} onClick={() => void saveLotTreatment(item, lot, decision)} className="h-9 bg-orange-600 px-2 text-[10px] font-black hover:bg-orange-700">Salvar</Button></div> : <Button type="button" size="sm" disabled={!lotTreatmentConfigured || lotSaving === key || !decision} onClick={() => decision && void saveLotTreatment(item, lot, decision)} className="h-9 w-full bg-[#244B70] text-xs font-black hover:bg-[#193B5C]">{lotSaving === key ? "Salvando..." : decision === "ALOCAR" ? "Salvar e escolher contrato" : "Confirmar decisão"}</Button>}</TableCell>
                </TableRow>;
              })}</TableBody>
            </Table>
          </div> : <div className="max-h-[640px] overflow-auto">
            {!agedConfigured && <div className="m-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs font-bold text-amber-900">Execute <code>sql/migrar_contratos_pcp.sql</code> para habilitar as decisões deste estoque.</div>}
            <Table className="w-full min-w-[1180px] table-fixed [&_td]:px-3 [&_th]:px-3">
              <TableHeader className="sticky top-0 z-10 bg-amber-50"><TableRow><SortableStockHeader label="Produto" sortKey="SEQPRODUTO" activeSort={sort} onSort={onSort} className="w-[90px]" /><SortableStockHeader label="Descrição" sortKey="DESCRPRODUTO" activeSort={sort} onSort={onSort} /><SortableStockHeader label="Peso +6 meses" sortKey="PESO_MAIS_6_MESES" activeSort={sort} onSort={onSort} numeric className="w-[145px]" /><SortableStockHeader label="Já alocado" sortKey="PESO_RESERVADO_6_MESES" activeSort={sort} onSort={onSort} numeric className="w-[135px]" /><SortableStockHeader label="Saldo separado" sortKey="PESO_MAIS_6_MESES_LIVRE" activeSort={sort} onSort={onSort} numeric className="w-[135px]" /><SortableStockHeader label="Situação" sortKey="SITUACAO_6_MESES" activeSort={sort} onSort={onSort} className="w-[130px]" /><Header className="w-[185px]">Data reprocesso</Header><Header className="w-[235px]">Decisão</Header></TableRow></TableHeader>
              <TableBody>
                {agedStock.length === 0 && <TableRow><TableCell colSpan={8} className="h-32 text-center text-sm font-semibold text-[#6B7F92]">Nenhum produto com estoque acima de seis meses.</TableCell></TableRow>}
                {agedStock.map((item) => {
                  const treatmentKey = `stock-treatment-${item.SEQPRODUTO}`;
                  const situation = item.SITUACAO_6_MESES || "SEPARADO";
                  const selectedDecision = agedDecisions[item.SEQPRODUTO] || "";
                  const showReprocessDate = selectedDecision === "REPROCESSO" || (!selectedDecision && situation === "REPROCESSO");
                  const reprocessDate = reprocessDates[item.SEQPRODUTO] ?? inputDate(item.DTA_REPROCESSO);
                  return <TableRow key={`aged-${item.SEQPRODUTO}`} className="bg-amber-50/40 hover:bg-amber-50"><TableCell className="font-mono text-xs font-black text-[#244B70]">{item.SEQPRODUTO}</TableCell><TableCell><div className="flex min-w-0 items-center gap-2"><p className="truncate text-xs font-bold text-[#304D68]" title={item.DESCRPRODUTO}>{item.DESCRPRODUTO}</p>{item.SEM_VENDA && <span className="shrink-0 rounded-full border border-sky-300 bg-sky-50 px-2 py-0.5 text-[9px] font-black uppercase text-sky-800">Sem venda</span>}</div></TableCell><TableCell className="text-right text-xs font-black text-amber-800">{formatKg(item.PESO_MAIS_6_MESES)}</TableCell><NumberCell value={item.PESO_RESERVADO_6_MESES} /><TableCell className="text-right text-xs font-black text-amber-700">{formatKg(item.PESO_MAIS_6_MESES_LIVRE)}</TableCell><TableCell><span className={`rounded-full border px-2 py-1 text-[9px] font-black uppercase ${situation === "REPROCESSO" ? "border-orange-300 bg-orange-100 text-orange-800" : situation === "DISPONIVEL" ? "border-emerald-300 bg-emerald-100 text-emerald-800" : "border-amber-300 bg-amber-100 text-amber-800"}`}>{situation === "REPROCESSO" ? "Reprocesso" : situation === "DISPONIVEL" ? "No disponível" : "Separado"}</span></TableCell><TableCell>{showReprocessDate ? <div className="flex items-center gap-1"><Input type="date" value={reprocessDate} onChange={(event) => setReprocessDates((current) => ({ ...current, [item.SEQPRODUTO]: event.target.value }))} className="h-9 min-w-0 text-xs" /><Button type="button" size="sm" disabled={!agedConfigured || saving === treatmentKey || !reprocessDate} onClick={() => void onSaveTreatment(item, { situacao: "REPROCESSO", data_reprocesso: reprocessDate })} className="h-9 bg-orange-600 px-2 text-[10px] font-black hover:bg-orange-700">Salvar</Button></div> : <span className="text-xs font-semibold text-[#9AA8B5]">—</span>}</TableCell><TableCell><select value={selectedDecision} disabled={!agedConfigured || saving === treatmentKey} onChange={(event) => { const decision = event.target.value as "" | "SEPARADO" | "DISPONIVEL" | "REPROCESSO" | "ALOCAR"; setAgedDecisions((current) => ({ ...current, [item.SEQPRODUTO]: decision })); if (decision === "ALOCAR") { setAllocationSource("MAIS_6_MESES"); onSelectProduct(item.SEQPRODUTO); return; } if (decision === "SEPARADO" || decision === "DISPONIVEL") void onSaveTreatment(item, { situacao: decision, data_reprocesso: null }); }} className="h-9 w-full rounded-md border border-[#C7D4E0] bg-white px-2 text-xs font-bold text-[#304D68]"><option value="">Selecionar decisão</option><option value="SEPARADO">Manter separado</option><option value="DISPONIVEL">Voltar ao disponível</option><option value="REPROCESSO">Enviar para reprocesso</option><option value="ALOCAR" disabled={Number(item.PESO_MAIS_6_MESES_LIVRE || 0) <= 0}>Alocar em contrato</option></select></TableCell></TableRow>;
                })}
              </TableBody>
            </Table>
          </div>}
        </CardContent>
      </Card>

      <Dialog open={Boolean(selectedStock)} onOpenChange={(open) => { if (!open) { onSelectProduct(null); setAllocationSource("REGULAR"); } }}>
        <DialogContent className="max-h-[90vh] max-w-[96vw] overflow-hidden border-[#CBD8E3] xl:max-w-[1500px]">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2 text-[#173D6E]">
              <PackageSearch className="h-5 w-5" />
              {selectedStock ? `${selectedStock.SEQPRODUTO} - ${selectedStock.DESCRPRODUTO}` : "Alocação de estoque"}
              {allocationSource === "MAIS_6_MESES" && <span className="rounded-full border border-amber-300 bg-amber-100 px-2 py-1 text-[9px] font-black uppercase text-amber-800">Origem +6 meses</span>}
            </DialogTitle>
            <DialogDescription>
              {allocationSource === "MAIS_6_MESES" ? "Informe quanto do estoque acima de seis meses ficará reservado neste contrato." : "Para uma nova alocação, informe somente o peso a adicionar. Onde já existe manual, reduza o total ou use zero para devolver o peso ao disponível; OP e pedido permanecem protegidos."}
            </DialogDescription>
          </DialogHeader>

          {selectedStock && (
            <div className="min-h-0 space-y-4 overflow-hidden">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
                <AllocationSummary label={allocationSource === "MAIS_6_MESES" ? "Estoque +6 meses" : "Estoque disponível"} value={allocationSource === "MAIS_6_MESES" ? selectedStock.PESO_MAIS_6_MESES : selectedStock.PESO_DISPONIVEL_REGULAR ?? selectedStock.PESODISPONIVEL} className={allocationSource === "MAIS_6_MESES" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-[#C8D7E3] bg-[#F5F8FA] text-[#173D6E]"} />
                <AllocationSummary label="Protegido por OP" value={selectedStock.PESO_ATRELADO_ORDEM} className="border-blue-200 bg-blue-50 text-blue-800" />
                <AllocationSummary label="Reservado em pedido" value={selectedStock.PESO_RESERVADO_PEDIDO || 0} className="border-emerald-200 bg-emerald-50 text-emerald-800" />
                <AllocationSummary label="Sobreposição OP/pedido" value={selectedStock.PESO_SOBREPOSTO_ORDEM_PEDIDO || 0} className="border-cyan-200 bg-cyan-50 text-cyan-800" />
                <AllocationSummary label="Bloqueado no ERP" value={selectedStock.PESO_BLOQUEADO_ERP || 0} className="border-red-200 bg-red-50 text-red-800" />
                <AllocationSummary label={allocationSource === "MAIS_6_MESES" ? "Alocado +6 meses" : "Manual"} value={allocationSource === "MAIS_6_MESES" ? selectedStock.PESO_RESERVADO_6_MESES : selectedStock.PESO_RESERVADO_VERTICE} className="border-amber-200 bg-amber-50 text-amber-800" onClick={allocationSource === "REGULAR" && Number(selectedStock.PESO_RESERVADO_VERTICE || 0) > 0 ? () => changeAllocationView("ALOCADOS") : undefined} title={allocationSource === "REGULAR" && Number(selectedStock.PESO_RESERVADO_VERTICE || 0) > 0 ? "Clique para reduzir ou retirar as alocações manuais" : undefined} />
                <AllocationSummary label="Livre para alocar" value={allocationSource === "MAIS_6_MESES" ? selectedStock.PESO_MAIS_6_MESES_LIVRE : selectedStock.PESO_LIVRE_VERTICE} className="border-emerald-200 bg-emerald-50 text-emerald-800" />
              </div>

              <div ref={allocationTableScrollRef} onScroll={() => syncAllocationScroll("table")} className="max-h-[54vh] overflow-auto rounded-t-lg border border-b-0 border-[#D5E0E9]">
                <Table className="min-w-[1855px] table-fixed [&_td]:px-2 [&_th]:px-2">
                  <TableHeader className="sticky top-0 z-10 bg-[#EDF3F7]">
                    <TableRow>
                      <Header className="w-[110px]">Contrato</Header>
                      <Header>Cliente</Header>
                      <Header className="w-[120px]">Embarque</Header>
                      <Header className="w-[125px]">Regra</Header>
                      <Header className="w-[130px]">Produção mínima</Header>
                      <Header className="w-[125px] text-right">Elegível</Header>
                      <Header className="w-[125px] text-right">Incompatível</Header>
                      <Header className="w-[120px] text-right">Peso contrato</Header>
                      <Header className="w-[115px] text-right">OP protegida</Header>
                      <Header className="w-[115px] text-right">Pedido reservado</Header>
                      <Header className="w-[115px] text-right">Manual</Header>
                      <Header className="w-[115px] text-right">Total alocado</Header>
                      <Header className="w-[110px] text-right">Saldo</Header>
                      <Header className="sticky right-[125px] z-20 w-[145px] border-l border-[#C6D4E0] bg-[#EDF3F7] text-right">Peso manual</Header>
                      <Header className="sticky right-0 z-20 w-[125px] border-l border-[#C6D4E0] bg-[#EDF3F7] text-center shadow-[-8px_0_12px_-12px_rgba(15,45,75,0.8)]">Ação</Header>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedContracts.length === 0 && (
                      <TableRow><TableCell colSpan={15} className="h-28 text-center text-sm font-semibold text-[#6B7F92]">Nenhum contrato ativo possui este produto.</TableCell></TableRow>
                    )}
                    {selectedContracts.map(({ contract, product }) => {
                      const key = `${contract.SEQCONTRATO}-${product.SEQPRODUTO}`;
                      const suggestedAddition = suggestedManualAddition(product);
                      const currentManual = Math.max(0, Number(product.PESO_RESERVADO_MANUAL || 0));
                      const maximumManualTotal = Math.max(currentManual, Number(product.LIMITE_RESERVA || 0));
                      const maintenanceMode = currentManual > 0;
                      const defaultWeight = maintenanceMode ? currentManual : suggestedAddition;
                      const inputValue = reservationInputs[key] ?? allocationInputValue(defaultWeight);
                      const enteredWeight = Number(String(inputValue).replace(",", "."));
                      const contractFilled = Number(product.SALDO_CONTRATO || 0) <= 0 && currentManual <= 0;
                      const canSave = configured && Number.isFinite(enteredWeight) && enteredWeight >= 0 && (maintenanceMode || (suggestedAddition > 0 && enteredWeight > 0));
                      const validity = validityStatus(product);
                      return (
                        <TableRow key={key} className={reservationCoverageClass(product)}>
                          <TableCell className="font-mono text-xs font-black text-[#173D6E]">{contract.NROCONTRATO}</TableCell>
                          <TableCell><p className="truncate text-xs font-bold text-[#304D68]" title={contract.NOMERAZAO}>{contract.NOMERAZAO}</p></TableCell>
                          <TableCell className="whitespace-nowrap text-xs font-semibold">{formatDate(contract.DTA_EMBARQUE_PLANEJADA || contract.DTA_EMBARQUE_ERP)}</TableCell>
                          <TableCell><button type="button" onClick={() => setValidityDetail({ contract, product })} className={`rounded-full border px-2 py-1 text-[9px] font-black uppercase ${validity.className}`}>{validityRuleLabel(product)}</button></TableCell>
                          <TableCell className="whitespace-nowrap text-xs font-bold text-[#304D68]">{formatDate(product.DATA_MINIMA_PRODUCAO)}</TableCell>
                          <TableCell className="text-right text-xs font-black text-emerald-700">{formatKg(product.PESO_ESTOQUE_ELEGIVEL)}</TableCell>
                          <TableCell className="text-right"><button type="button" onClick={() => setValidityDetail({ contract, product })} disabled={Number(product.PESO_ESTOQUE_INCOMPATIVEL || 0) <= 0} title="Ver os lotes incompatíveis e retirar do disponível" className="ml-auto inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-black text-red-700 enabled:hover:bg-red-50 disabled:cursor-default"><span>{formatKg(product.PESO_ESTOQUE_INCOMPATIVEL)}</span>{Number(product.PESO_ESTOQUE_INCOMPATIVEL || 0) > 0 && <Minus className="h-3.5 w-3.5" />}</button></TableCell>
                          <NumberCell value={product.PESOCONTRATO} />
                          <NumberCell value={product.PESO_ATRELADO_ORDEM} />
                          <NumberCell value={product.PESO_RESERVADO_PEDIDO} />
                          <TableCell className="text-right">
                            <button
                              type="button"
                              disabled={currentManual <= 0}
                              onClick={() => {
                                setReservationInputs((current) => ({ ...current, [key]: allocationInputValue(currentManual) }));
                                requestAnimationFrame(() => {
                                  const input = document.getElementById(`manual-weight-${key}`) as HTMLInputElement | null;
                                  input?.focus();
                                  input?.select();
                                });
                              }}
                              title={currentManual > 0 ? "Clique para reduzir ou retirar este peso manual" : "Sem peso manual neste contrato"}
                              className="ml-auto rounded-md px-1.5 py-1 text-xs font-black text-amber-700 enabled:cursor-pointer enabled:hover:bg-amber-50 enabled:hover:underline disabled:cursor-default disabled:text-[#304D68]"
                            >
                              {formatKg(currentManual)}
                            </button>
                          </TableCell>
                          <NumberCell value={product.PESO_ATRELADO_TOTAL} />
                          <TableCell className="whitespace-nowrap text-right text-sm font-black text-[#173D6E]">{formatKg(product.SALDO_CONTRATO)}</TableCell>
                          <TableCell className="sticky right-[125px] z-10 border-l border-[#D5E0E9] bg-white text-right">
                            <Input
                              id={`manual-weight-${key}`}
                              type="number"
                              min="0"
                              step="0.001"
                              max={maintenanceMode ? maximumManualTotal : suggestedAddition}
                              value={inputValue}
                              onChange={(event) => setReservationInputs((current) => ({ ...current, [key]: event.target.value }))}
                              title={maintenanceMode ? "Altere o peso manual ou informe zero para liberar." : `Este peso será acrescentado ao manual atual de ${formatKg(currentManual)}.`}
                              disabled={!configured || (!maintenanceMode && suggestedAddition <= 0)}
                              className="ml-auto h-8 w-28 px-2 text-right text-xs"
                            />
                            <p className={`mt-1 text-[9px] font-semibold ${maintenanceMode || suggestedAddition > 0 ? "text-[#71869A]" : "text-red-700"}`}>{maintenanceMode ? "Edite ou use 0 para liberar" : contractFilled ? "Já preenchido; manual desnecessário" : suggestedAddition > 0 ? `Adicionar até ${formatKg(suggestedAddition)}` : Number(product.PESO_ESTOQUE_SEM_RASTREIO || 0) > 0 ? "Bloqueado: saldo sem data" : "Bloqueado pela validade"}</p>
                          </TableCell>
                          <TableCell className={`sticky right-0 z-10 border-l border-[#D5E0E9] text-center shadow-[-8px_0_12px_-12px_rgba(15,45,75,0.8)] ${canSave ? "bg-emerald-50" : "bg-red-50"}`}>
                            <p className={`mb-1 text-[8px] font-black uppercase ${canSave ? "text-emerald-700" : "text-red-700"}`}>{maintenanceMode ? "Manutenção manual" : suggestedAddition > 0 ? "Somar ao manual" : "Já preenchido"}</p>
                            <Button
                              type="button"
                              size="sm"
                              disabled={!canSave || saving === key}
                              onClick={() => void onSaveReservation(contract, product, defaultWeight, maintenanceMode ? "TOTAL" : "ADDITION")}
                              className="h-8 bg-[#244B70] px-3 text-xs hover:bg-[#193B5C]"
                            >
                              {saving === key ? "Salvando" : maintenanceMode && enteredWeight === 0 ? "Liberar" : maintenanceMode ? "Salvar" : "Adicionar"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <div ref={allocationBottomScrollRef} onScroll={() => syncAllocationScroll("bottom")} className="h-5 overflow-x-auto overflow-y-hidden rounded-b-lg border border-[#D5E0E9] bg-[#EDF3F7]" aria-label="Rolagem horizontal da tabela de contratos">
                <div className="h-px w-[1740px]" />
              </div>
              <p className="text-[10px] font-semibold text-[#60758A]">Use a barra acima para consultar todas as colunas. O botão de salvar permanece fixo à direita.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <ValidityLotsDialog detail={validityDetail} onClose={() => setValidityDetail(null)} lotSaving={lotSaving} lotTreatmentConfigured={lotTreatmentConfigured} onSeparateLot={async (lot) => { const item = stock.find((stockItem) => stockItem.SEQPRODUTO === lot.SEQPRODUTO); if (!item) { toast.error("Produto não encontrado no estoque para retirar o lote."); return; } await saveLotTreatment(item, lot, "SEPARADO"); setValidityDetail(null); }} />
      <StockLotsDialog stock={stockLotsDetail} contracts={contracts} onClose={() => setStockLotsDetail(null)} />
    </div>
  );
}

function AcceptedOldStockNotice({ stock, saving, onReverse }: { stock: ContractStock; saving: string | null; onReverse: (lot: ContractStockLot) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const lots = (stock.LOTES_LIVRES || stock.LOTES_ESTOQUE || []).filter((lot) => lot.DECISAO_LOTE === "DISPONIVEL");
  if (lots.length === 0) return null;
  const total = lots.reduce((sum, lot) => sum + Number(lot.PESO_LIVRE_ESTIMADO || lot.PESO_DISPONIVEL_ESTIMADO || 0), 0);
  return <>
    <button type="button" onClick={() => setOpen(true)} className="flex w-full items-center justify-between gap-4 rounded-xl border border-orange-300 bg-orange-50 px-4 py-3 text-left shadow-sm hover:bg-orange-100">
      <div className="min-w-0"><p className="truncate text-sm font-black text-[#173D6E]">{stock.SEQPRODUTO} - {stock.DESCRPRODUTO}</p><p className="mt-1 text-xs font-semibold text-orange-900">Lote antigo liberado manualmente para alocação. Clique para consultar ou reverter.</p></div>
      <span className="shrink-0 rounded-full border border-orange-300 bg-white px-3 py-1.5 text-[10px] font-black uppercase text-orange-800">Produto antigo aceito · {formatKg(total)}</span>
    </button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl border-[#CBD8E3]">
        <DialogHeader><DialogTitle className="text-[#173D6E]">Produto antigo aceito</DialogTitle><DialogDescription>{stock.SEQPRODUTO} - {stock.DESCRPRODUTO}. Estes lotes foram liberados como exceção à validade contratual.</DialogDescription></DialogHeader>
        <div className="max-h-[55vh] space-y-2 overflow-auto pr-1">
          {lots.map((lot) => { const key = lot.CHAVE_LOTE || `${stock.SEQPRODUTO}-${lot.DTAPRODUCAO}-${lot.LOTE}`; return <div key={key} className="flex flex-col gap-3 rounded-lg border border-orange-200 bg-orange-50 p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-black text-[#173D6E]">Produção em {formatDate(lot.DTAPRODUCAO)}</p><p className="mt-1 text-xs font-semibold text-[#60758A]">Lote {lot.LOTE || "sem lote"} · {formatKg(lot.PESO_LIVRE_ESTIMADO || lot.PESO_DISPONIVEL_ESTIMADO)}</p>{lot.DECISAO_ATUALIZADA_POR && <p className="mt-1 text-[10px] font-semibold text-[#71869A]">Aceito por {lot.DECISAO_ATUALIZADA_POR} em {formatDateTime(lot.DECISAO_ATUALIZADA_EM)}</p>}</div><Button type="button" variant="outline" disabled={saving === key} onClick={() => void onReverse(lot)} className="border-orange-300 bg-white font-black text-orange-900 hover:bg-orange-100">{saving === key ? "Revertendo..." : "Voltar para revisão"}</Button></div>; })}
        </div>
      </DialogContent>
    </Dialog>
  </>;
}

interface ModernStockOperationsLayoutProps {
  section: "DISPONIVEIS" | "ALOCADOS" | "REVISAR_DATAS";
  stock: ContractStock[];
  selectedStock: ContractStock | null;
  selectedContracts: Array<{ contract: ExportContract; product: ContractProduct }>;
  preferredContractId: number | null;
  allocatedItems: Array<{ contract: ExportContract; product: ContractProduct }>;
  contracts: ExportContract[];
  reviewRows: Array<{ item: ContractStock; lot: ContractStockLot }>;
  totalErpStock: number;
  totalOrderStock: number;
  totalOrderReservation: number;
  totalBlockedStock: number;
  totalManualStock: number;
  totalFreeStock: number;
  validityAlertCount: number;
  search: string;
  onSearchChange: (value: string) => void;
  syncing: boolean;
  onSync: () => Promise<void>;
  onSelectProduct: (productId: number | null) => void;
  configured: boolean;
  saving: string | null;
  reservationInputs: Record<string, string>;
  setReservationInputs: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onSaveReservation: (contract: ExportContract, product: ContractProduct, fallbackWeight?: number, inputMode?: ReservationInputMode) => Promise<void>;
  onSaveLotTreatment: (item: ContractStock, lot: ContractStockLot, decision: "SEPARADO" | "DISPONIVEL" | "REPROCESSO" | "ALOCAR", reprocessDateOverride?: string, targetContractId?: number, targetWeight?: number) => Promise<void>;
  onReviewProduct: (productId: number) => void;
  lotSaving: string | null;
}

function ModernStockOperationsLayout({
  section,
  stock,
  selectedStock,
  selectedContracts,
  preferredContractId,
  allocatedItems,
  contracts,
  reviewRows,
  totalErpStock,
  totalOrderStock,
  totalOrderReservation,
  totalBlockedStock,
  totalManualStock,
  totalFreeStock,
  validityAlertCount,
  search,
  onSearchChange,
  syncing,
  onSync,
  onSelectProduct,
  configured,
  saving,
  reservationInputs,
  setReservationInputs,
  onSaveReservation,
  onSaveLotTreatment,
  onReviewProduct,
  lotSaving,
}: ModernStockOperationsLayoutProps) {
  const [selectedCandidateKey, setSelectedCandidateKey] = useState("");
  const [selectedAllocatedKey, setSelectedAllocatedKey] = useState("");
  const [selectedReviewKey, setSelectedReviewKey] = useState("");
  const [reviewDecision, setReviewDecision] = useState<"SEPARADO" | "DISPONIVEL" | "REPROCESSO" | "ALOCAR">("SEPARADO");
  const [reviewReprocessDate, setReviewReprocessDate] = useState("");
  const [availableSort, setAvailableSort] = useState<TableSortState<"PRODUTO" | "DESCRICAO" | "ESTOQUE" | "OP" | "PEDIDO" | "MANUAL" | "LIVRE" | "CONTRATOS">>({ key: "LIVRE", direction: "desc" });
  const [lotSort, setLotSort] = useState<TableSortState<"DATA" | "PESO" | "SITUACAO">>({ key: "DATA", direction: "asc" });
  const [candidateSort, setCandidateSort] = useState<TableSortState<"CONTRATO" | "CLIENTE" | "EMBARQUE" | "SALDO" | "ELEGIVEL">>({ key: "EMBARQUE", direction: "asc" });
  const [allocatedSort, setAllocatedSort] = useState<TableSortState<"PRODUTO" | "CONTRATO" | "CONTRATADO" | "EXPEDIDO" | "OP" | "PEDIDO" | "MANUAL" | "TOTAL" | "ATENDIDO" | "SALDO" | "SITUACAO">>({ key: "CONTRATO", direction: "asc" });
  const [reviewSort, setReviewSort] = useState<TableSortState<"PRODUTO" | "LOTE" | "DATA" | "PESO" | "CONTRATOS" | "MOTIVO">>({ key: "DATA", direction: "asc" });

  const candidateKey = (contractId: number, productId: number) => `${contractId}-${productId}`;
  useEffect(() => {
    if (!selectedStock) {
      setSelectedCandidateKey("");
      return;
    }
    const preferred = preferredContractId == null
      ? null
      : selectedContracts.find(({ contract }) => contract.SEQCONTRATO === preferredContractId);
    if (preferred) {
      setSelectedCandidateKey(candidateKey(preferred.contract.SEQCONTRATO, preferred.product.SEQPRODUTO));
      return;
    }
    if (!selectedContracts.some(({ contract, product }) => candidateKey(contract.SEQCONTRATO, product.SEQPRODUTO) === selectedCandidateKey)) {
      const first = selectedContracts[0];
      setSelectedCandidateKey(first ? candidateKey(first.contract.SEQCONTRATO, first.product.SEQPRODUTO) : "");
    }
  }, [selectedStock?.SEQPRODUTO, selectedContracts.length, preferredContractId]);
  useEffect(() => {
    if (!allocatedItems.some(({ contract, product }) => candidateKey(contract.SEQCONTRATO, product.SEQPRODUTO) === selectedAllocatedKey)) {
      const first = allocatedItems[0];
      setSelectedAllocatedKey(first ? candidateKey(first.contract.SEQCONTRATO, first.product.SEQPRODUTO) : "");
    }
  }, [allocatedItems.length]);
  useEffect(() => {
    const selected = allocatedItems.find(
      ({ contract, product }) => candidateKey(contract.SEQCONTRATO, product.SEQPRODUTO) === selectedAllocatedKey,
    );
    if (!selected) return;
    const key = candidateKey(selected.contract.SEQCONTRATO, selected.product.SEQPRODUTO);
    setReservationInputs((current) => ({
      ...current,
      [key]: allocationInputValue(Number(selected.product.PESO_RESERVADO_MANUAL || 0)),
    }));
  }, [selectedAllocatedKey]);
  useEffect(() => {
    const keys = reviewRows.map(({ item, lot }) => lot.CHAVE_LOTE || `${item.SEQPRODUTO}-${lot.DTAPRODUCAO}-${lot.LOTE}-${lot.SEQEMBALAGEM}`);
    if (!keys.includes(selectedReviewKey)) setSelectedReviewKey(keys[0] || "");
  }, [reviewRows.map(({ item, lot }) => lot.CHAVE_LOTE || `${item.SEQPRODUTO}-${lot.DTAPRODUCAO}-${lot.LOTE}-${lot.SEQEMBALAGEM}`).join("|")]);

  const selectedCandidate = selectedContracts.find(({ contract, product }) => candidateKey(contract.SEQCONTRATO, product.SEQPRODUTO) === selectedCandidateKey) || null;
  const selectedAllocated = allocatedItems.find(({ contract, product }) => candidateKey(contract.SEQCONTRATO, product.SEQPRODUTO) === selectedAllocatedKey) || null;
  const selectedReview = reviewRows.find(({ item, lot }) => (lot.CHAVE_LOTE || `${item.SEQPRODUTO}-${lot.DTAPRODUCAO}-${lot.LOTE}-${lot.SEQEMBALAGEM}`) === selectedReviewKey) || null;
  useEffect(() => {
    setReviewDecision(selectedReview?.lot.DECISAO_LOTE || "SEPARADO");
    setReviewReprocessDate(inputDate(selectedReview?.lot.DTA_REPROCESSO_LOTE));
  }, [selectedReviewKey, selectedReview?.lot.DECISAO_LOTE, selectedReview?.lot.DTA_REPROCESSO_LOTE]);

  const sortedStock = stock.filter((item) =>
    Number(item.PESO_LIVRE_VERTICE || 0) > 0
    || Number(item.PESO_RESERVADO_VERTICE || 0) > 0
    || item.SITUACAO_6_MESES === "DISPONIVEL",
  ).sort((first, second) => {
    const value = (item: ContractStock) => ({
      PRODUTO: item.SEQPRODUTO,
      DESCRICAO: item.DESCRPRODUTO,
      ESTOQUE: Number(item.PESODISPONIVEL || 0),
      OP: Number(item.PESO_ATRELADO_ORDEM || 0),
      PEDIDO: Number(item.PESO_RESERVADO_PEDIDO_LIQUIDO ?? item.PESO_RESERVADO_PEDIDO ?? 0),
      MANUAL: Number(item.PESO_RESERVADO_VERTICE || 0),
      LIVRE: Number(item.PESO_LIVRE_VERTICE || 0),
      CONTRATOS: contracts.filter((contract) => contract.PRODUTOS.some((product) => product.SEQPRODUTO === item.SEQPRODUTO)).length,
    });
    return compareTableValues(value(first)[availableSort.key], value(second)[availableSort.key], availableSort.direction);
  });
  const sortedLots = [...(selectedStock?.LOTES_LIVRES || [])].sort((first, second) => {
    const value = (lot: ContractStockLot) => ({ DATA: lot.DTAPRODUCAO, PESO: Number(lot.PESO_LIVRE_ESTIMADO || 0), SITUACAO: lot.SITUACAO_VALIDADE });
    return compareTableValues(value(first)[lotSort.key], value(second)[lotSort.key], lotSort.direction);
  });
  const sortedCandidates = [...selectedContracts].sort((first, second) => {
    const value = ({ contract, product }: { contract: ExportContract; product: ContractProduct }) => ({
      CONTRATO: contract.NROCONTRATO,
      CLIENTE: contract.NOMERAZAO,
      EMBARQUE: contract.DTA_EMBARQUE_PLANEJADA || contract.DTA_EMBARQUE_ERP,
      SALDO: Number(product.SALDO_CONTRATO || 0),
      ELEGIVEL: Number(product.PESO_ESTOQUE_ELEGIVEL || 0),
    });
    return compareTableValues(value(first)[candidateSort.key], value(second)[candidateSort.key], candidateSort.direction);
  });
  const sortedAllocated = [...allocatedItems].sort((first, second) => {
    const value = ({ contract, product }: { contract: ExportContract; product: ContractProduct }) => ({
      PRODUTO: product.SEQPRODUTO,
      CONTRATO: contract.NROCONTRATO,
      CONTRATADO: Number(product.PESOCONTRATO || 0),
      EXPEDIDO: Number(product.PESO_EXPEDIDO || 0),
      OP: Number(product.PESO_ATRELADO_ORDEM || 0),
      PEDIDO: Number(product.PESO_RESERVADO_PEDIDO_LIQUIDO ?? product.PESO_RESERVADO_PEDIDO ?? 0),
      MANUAL: Number(product.PESO_RESERVADO_MANUAL || 0),
      TOTAL: Number(product.PESO_ATRELADO_TOTAL || 0),
      ATENDIDO: Number(product.PESO_EXPEDIDO || 0) + Number(product.PESO_ATRELADO_TOTAL || 0),
      SALDO: Number(product.SALDO_CONTRATO || 0),
      SITUACAO: Number(product.SALDO_CONTRATO || 0) <= 0 ? "ATENDIDO" : "PARCIAL",
    });
    return compareTableValues(value(first)[allocatedSort.key], value(second)[allocatedSort.key], allocatedSort.direction);
  });
  const sortedReviewRows = [...reviewRows].sort((first, second) => {
    const value = ({ item, lot }: { item: ContractStock; lot: ContractStockLot }) => ({
      PRODUTO: item.SEQPRODUTO,
      LOTE: lot.LOTE,
      DATA: lot.DTAPRODUCAO,
      PESO: Number(lot.PESO_LIVRE_ESTIMADO || 0),
      CONTRATOS: compatibleContractsForLot(item.SEQPRODUTO, lot.DTAPRODUCAO, contracts).length,
      MOTIVO: lot.SITUACAO_VALIDADE,
    });
    return compareTableValues(value(first)[reviewSort.key], value(second)[reviewSort.key], reviewSort.direction);
  });

  const stockTotal = selectedStock ? Math.max(0, Number(selectedStock.PESODISPONIVEL || 0)) : 0;
  const stockSegments = selectedStock ? [
    { label: "Bloqueado no ERP", value: Number(selectedStock.PESO_BLOQUEADO_ERP || 0), color: "bg-red-500" },
    { label: "Protegido por OP", value: Number(selectedStock.PESO_ATRELADO_ORDEM || 0), color: "bg-blue-700" },
    { label: "Pedido líquido reservado", value: Number(selectedStock.PESO_RESERVADO_PEDIDO_LIQUIDO || selectedStock.PESO_RESERVADO_PEDIDO || 0), color: "bg-blue-400" },
    { label: "Manual em contratos", value: Number(selectedStock.PESO_RESERVADO_VERTICE || 0), color: "bg-orange-500" },
    { label: "Estoque realmente livre", value: Number(selectedStock.PESO_LIVRE_VERTICE || 0), color: "bg-emerald-600" },
  ] : [];

  if (section === "DISPONIVEIS") {
    return <div className="space-y-4">
      {!selectedStock ? <>
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><OverviewMetric icon={Weight} label="Estoque físico ERP" value={formatKg(totalErpStock)} tone="blue" /><OverviewMetric icon={Factory} label="Protegido por OP" value={formatKg(totalOrderStock)} tone="blue" /><OverviewMetric icon={LockKeyhole} label="Reservado em pedido" value={formatKg(totalOrderReservation)} tone="blue" /><OverviewMetric icon={Boxes} label="Estoque realmente livre" value={formatKg(totalFreeStock)} tone="green" /><OverviewMetric icon={ShieldAlert} label="Restrições de validade" value={String(validityAlertCount)} tone={validityAlertCount > 0 ? "red" : "green"} /></section>
        <Card className="overflow-hidden border-[#CBD8E3] shadow-sm"><CardContent className="p-0"><WorkspaceToolbar title="Produtos disponíveis para alocação" description="Selecione um produto para comparar os contratos candidatos." search={search} onSearchChange={onSearchChange} syncing={syncing} onSync={onSync} /><div className="max-h-[66vh] overflow-auto"><Table><TableHeader className="sticky top-0 z-10 bg-[#EDF3F7]"><TableRow><SortableTableHead label="Produto" sortKey="PRODUTO" sort={availableSort} onSort={(key) => setAvailableSort((current) => nextTableSort(current, key))} /><SortableTableHead label="Descrição" sortKey="DESCRICAO" sort={availableSort} onSort={(key) => setAvailableSort((current) => nextTableSort(current, key))} /><SortableTableHead label="Estoque físico" sortKey="ESTOQUE" sort={availableSort} onSort={(key) => setAvailableSort((current) => nextTableSort(current, key))} align="right" /><SortableTableHead label="OP" sortKey="OP" sort={availableSort} onSort={(key) => setAvailableSort((current) => nextTableSort(current, key))} align="right" /><SortableTableHead label="Pedido" sortKey="PEDIDO" sort={availableSort} onSort={(key) => setAvailableSort((current) => nextTableSort(current, key))} align="right" /><SortableTableHead label="Manual" sortKey="MANUAL" sort={availableSort} onSort={(key) => setAvailableSort((current) => nextTableSort(current, key))} align="right" /><SortableTableHead label="Livre" sortKey="LIVRE" sort={availableSort} onSort={(key) => setAvailableSort((current) => nextTableSort(current, key))} align="right" /><SortableTableHead label="Contratos" sortKey="CONTRATOS" sort={availableSort} onSort={(key) => setAvailableSort((current) => nextTableSort(current, key))} align="center" /><TableHead className="text-right">Ação</TableHead></TableRow></TableHeader><TableBody>{sortedStock.map((item) => { const candidateCount = contracts.filter((contract) => contract.PRODUTOS.some((product) => product.SEQPRODUTO === item.SEQPRODUTO)).length; return <TableRow key={item.SEQPRODUTO} className="hover:bg-[#F7FAFC]"><TableCell className="font-mono text-xs font-black text-blue-700">{item.SEQPRODUTO}</TableCell><TableCell className="text-xs font-bold text-[#304D68]"><span>{item.DESCRPRODUTO}</span>{(item.LOTES_LIVRES || item.LOTES_ESTOQUE || []).some((lot) => lot.DECISAO_LOTE === "DISPONIVEL") && <span className="ml-2 inline-flex rounded-full border border-orange-300 bg-orange-50 px-2 py-1 text-[9px] font-black uppercase text-orange-800">Produto antigo aceito</span>}</TableCell><NumberCell value={item.PESODISPONIVEL} /><NumberCell value={item.PESO_ATRELADO_ORDEM} /><NumberCell value={item.PESO_RESERVADO_PEDIDO_LIQUIDO ?? item.PESO_RESERVADO_PEDIDO} /><NumberCell value={item.PESO_RESERVADO_VERTICE} /><TableCell className="text-right text-xs font-black text-emerald-700">{formatKg(item.PESO_LIVRE_VERTICE)}</TableCell><TableCell className="text-center text-xs font-black">{candidateCount}</TableCell><TableCell className="text-right"><Button variant="outline" size="sm" onClick={() => onSelectProduct(item.SEQPRODUTO)} className="border-[#8FB1CE] text-[#174A78]"><Boxes className="mr-2 h-3.5 w-3.5" />Analisar e alocar</Button></TableCell></TableRow>; })}</TableBody></Table></div></CardContent></Card>
      </> : <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(270px,0.72fr)_minmax(420px,1.15fr)_minmax(300px,0.82fr)]">
        <Card className="h-fit border-[#CBD8E3] shadow-sm"><CardContent className="space-y-4 p-4"><button type="button" onClick={() => onSelectProduct(null)} className="text-xs font-black text-blue-700 hover:underline">← Escolher outro produto</button><div className="rounded-xl border border-blue-200 bg-blue-50 p-4"><p className="font-mono text-sm font-black text-blue-700">{selectedStock.SEQPRODUTO}</p><p className="mt-1 text-base font-black text-[#102F53]">{selectedStock.DESCRPRODUTO}</p></div><div><h3 className="text-sm font-black text-[#102F53]">Distribuição do peso no estoque</h3><div className="mt-3 flex h-7 overflow-hidden rounded-md bg-[#E6EDF3]">{stockSegments.map((segment) => <div key={segment.label} className={segment.color} style={{ width: `${stockTotal > 0 ? Math.max(0, segment.value / stockTotal * 100) : 0}%` }} title={`${segment.label}: ${formatKg(segment.value)}`} />)}</div><div className="mt-3 space-y-2">{stockSegments.map((segment) => <SummaryLine key={segment.label} label={segment.label} value={formatKg(segment.value)} />)}</div></div><div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-[10px] font-black uppercase tracking-wider text-emerald-700">Estoque realmente livre</p><p className="mt-1 text-2xl font-black text-emerald-800">{formatKg(selectedStock.PESO_LIVRE_VERTICE)}</p></div><div><h3 className="text-sm font-black text-[#102F53]">Lotes livres do produto</h3><div className="mt-2 max-h-52 overflow-auto rounded-lg border border-[#D8E2EA]"><Table><TableHeader className="bg-[#EDF3F7]"><TableRow><SortableTableHead label="Produção" sortKey="DATA" sort={lotSort} onSort={(key) => setLotSort((current) => nextTableSort(current, key))} /><SortableTableHead label="Peso" sortKey="PESO" sort={lotSort} onSort={(key) => setLotSort((current) => nextTableSort(current, key))} align="right" /><SortableTableHead label="Situação" sortKey="SITUACAO" sort={lotSort} onSort={(key) => setLotSort((current) => nextTableSort(current, key))} /></TableRow></TableHeader><TableBody>{sortedLots.map((lot, index) => <TableRow key={lot.CHAVE_LOTE || index}><TableCell className="text-xs font-bold">{formatDate(lot.DTAPRODUCAO)}</TableCell><TableCell className="text-right text-xs font-black">{formatKg(lot.PESO_LIVRE_ESTIMADO)}</TableCell><TableCell><ValidityBadge status={lot.SITUACAO_VALIDADE} /></TableCell></TableRow>)}</TableBody></Table></div></div></CardContent></Card>
        <Card className="min-w-0 overflow-hidden border-[#CBD8E3] shadow-sm"><CardContent className="p-0"><div className="border-b border-[#DCE5ED] px-4 py-4"><h2 className="text-lg font-black text-[#102F53]">Contratos candidatos</h2><p className="text-xs text-[#667B90]">Produtos que utilizam o SEQPRODUTO {selectedStock.SEQPRODUTO}</p></div><div className="max-h-[70vh] overflow-auto p-3">{selectedContracts.length === 0 ? <div className="rounded-lg border border-dashed p-8 text-center text-sm font-semibold text-[#6B7F92]">Nenhum contrato ativo possui este produto.</div> : <div className="min-w-[610px] space-y-2"><div className="grid grid-cols-[auto_0.7fr_1.25fr_0.8fr_0.8fr_0.8fr] items-center gap-3 px-3 text-[9px] font-black uppercase tracking-wider text-[#526A80]"><span className="w-4" /><CandidateSortButton label="Contrato" sortKey="CONTRATO" sort={candidateSort} onSort={(key) => setCandidateSort((current) => nextTableSort(current, key))} /><CandidateSortButton label="Cliente" sortKey="CLIENTE" sort={candidateSort} onSort={(key) => setCandidateSort((current) => nextTableSort(current, key))} /><CandidateSortButton label="Embarque" sortKey="EMBARQUE" sort={candidateSort} onSort={(key) => setCandidateSort((current) => nextTableSort(current, key))} /><CandidateSortButton label="Saldo" sortKey="SALDO" sort={candidateSort} onSort={(key) => setCandidateSort((current) => nextTableSort(current, key))} align="right" /><CandidateSortButton label="Elegível" sortKey="ELEGIVEL" sort={candidateSort} onSort={(key) => setCandidateSort((current) => nextTableSort(current, key))} align="right" /></div>{sortedCandidates.map(({ contract, product }) => { const key = candidateKey(contract.SEQCONTRATO, product.SEQPRODUTO); const selectedRow = key === selectedCandidateKey; const eligibility = Number(product.PESO_ESTOQUE_ELEGIVEL || 0); return <button type="button" key={key} onClick={() => setSelectedCandidateKey(key)} className={`grid w-full grid-cols-[auto_0.7fr_1.25fr_0.8fr_0.8fr_0.8fr] items-center gap-3 rounded-lg border p-3 text-left ${selectedRow ? "border-blue-500 bg-blue-50 ring-1 ring-blue-200" : "border-[#D3DEE7] bg-white hover:bg-[#F7FAFC]"}`}><span className={`h-4 w-4 rounded-full border-2 ${selectedRow ? "border-blue-600 bg-blue-600 ring-2 ring-blue-100" : "border-[#AFC1D1]"}`} /><span className="font-mono text-xs font-black text-[#173D6E]">{contract.NROCONTRATO}</span><span className="truncate text-xs font-bold text-[#304D68]">{contract.NOMERAZAO}</span><span className="text-xs font-bold text-[#526A80]">{formatDate(contract.DTA_EMBARQUE_PLANEJADA || contract.DTA_EMBARQUE_ERP)}</span><span className="text-right text-xs font-black text-orange-700">{formatKg(product.SALDO_CONTRATO)}</span><span className="text-right text-xs font-black text-emerald-700">{formatKg(eligibility)}</span></button>; })}</div>}</div>{selectedCandidate && Number(selectedCandidate.product.PESO_ESTOQUE_INCOMPATIVEL || 0) > 0 && <div className="m-3 flex flex-col gap-3 rounded-lg border border-orange-200 bg-orange-50 p-3 text-xs font-semibold text-orange-900 sm:flex-row sm:items-center sm:justify-between"><span><AlertTriangle className="mr-2 inline h-4 w-4" />{formatKg(selectedCandidate.product.PESO_ESTOQUE_INCOMPATIVEL)} livres não atendem à validade deste contrato.</span><Button type="button" size="sm" variant="outline" onClick={() => onReviewProduct(selectedStock.SEQPRODUTO)} className="shrink-0 border-orange-300 bg-white text-orange-900 hover:bg-orange-100"><CalendarDays className="mr-2 h-4 w-4" />Revisar datas</Button></div>}</CardContent></Card>
        <AllocationEditor candidate={selectedCandidate} selectedStock={selectedStock} configured={configured} saving={saving} reservationInputs={reservationInputs} setReservationInputs={setReservationInputs} onSave={onSaveReservation} onReviewDates={() => onReviewProduct(selectedStock.SEQPRODUTO)} />
      </div>}
    </div>;
  }

  if (section === "ALOCADOS") {
    return (
      <div className="space-y-4">
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <OverviewMetric icon={FileSignature} label="Peso contratado" value={formatKg(allocatedItems.reduce((sum, item) => sum + Number(item.product.PESOCONTRATO || 0), 0))} tone="blue" />
          <OverviewMetric icon={LockKeyhole} label="Ainda reservado" value={formatKg(allocatedItems.reduce((sum, item) => sum + Number(item.product.PESO_ATRELADO_TOTAL || 0), 0))} tone="blue" />
          <OverviewMetric icon={Weight} label="Manual editável" value={formatKg(totalManualStock)} tone="orange" />
          <OverviewMetric icon={Boxes} label="Estoque livre global" value={formatKg(totalFreeStock)} tone="green" />
        </section>
        <WorkspaceToolbar title="Alocações por produto e contrato" description="Expedição e reservas são exibidas separadamente; somente a parcela manual é editável." search={search} onSearchChange={onSearchChange} syncing={syncing} onSync={onSync} />
        <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_370px]">
          <Card className="min-w-0 overflow-hidden border-[#CBD8E3]">
            <CardContent className="p-0">
              <div className="max-h-[68vh] overflow-auto">
                <Table className="min-w-[1180px]">
                  <TableHeader className="sticky top-0 z-10 bg-[#EDF3F7]">
                    <TableRow>
                      <SortableTableHead label="Produto" sortKey="PRODUTO" sort={allocatedSort} onSort={(key) => setAllocatedSort((current) => nextTableSort(current, key))} />
                      <SortableTableHead label="Contrato / cliente" sortKey="CONTRATO" sort={allocatedSort} onSort={(key) => setAllocatedSort((current) => nextTableSort(current, key))} />
                      <SortableTableHead label="Contratado" sortKey="CONTRATADO" sort={allocatedSort} onSort={(key) => setAllocatedSort((current) => nextTableSort(current, key))} align="right" />
                      <SortableTableHead label="Expedido" sortKey="EXPEDIDO" sort={allocatedSort} onSort={(key) => setAllocatedSort((current) => nextTableSort(current, key))} align="right" />
                      <SortableTableHead label="OP" sortKey="OP" sort={allocatedSort} onSort={(key) => setAllocatedSort((current) => nextTableSort(current, key))} align="right" />
                      <SortableTableHead label="Pedido líquido" sortKey="PEDIDO" sort={allocatedSort} onSort={(key) => setAllocatedSort((current) => nextTableSort(current, key))} align="right" />
                      <SortableTableHead label="Manual" sortKey="MANUAL" sort={allocatedSort} onSort={(key) => setAllocatedSort((current) => nextTableSort(current, key))} align="right" />
                      <SortableTableHead label="Ainda reservado" sortKey="TOTAL" sort={allocatedSort} onSort={(key) => setAllocatedSort((current) => nextTableSort(current, key))} align="right" />
                      <SortableTableHead label="Total atendido" sortKey="ATENDIDO" sort={allocatedSort} onSort={(key) => setAllocatedSort((current) => nextTableSort(current, key))} align="right" />
                      <SortableTableHead label="Saldo" sortKey="SALDO" sort={allocatedSort} onSort={(key) => setAllocatedSort((current) => nextTableSort(current, key))} align="right" />
                      <SortableTableHead label="Situação" sortKey="SITUACAO" sort={allocatedSort} onSort={(key) => setAllocatedSort((current) => nextTableSort(current, key))} />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedAllocated.map(({ contract, product }) => {
                      const key = candidateKey(contract.SEQCONTRATO, product.SEQPRODUTO);
                      const totalAttended = Number(product.PESO_EXPEDIDO || 0) + Number(product.PESO_ATRELADO_TOTAL || 0);
                      return (
                        <TableRow key={key} onClick={() => setSelectedAllocatedKey(key)} className={`cursor-pointer ${key === selectedAllocatedKey ? "bg-blue-50 ring-1 ring-inset ring-blue-200" : "hover:bg-[#F7FAFC]"}`}>
                          <TableCell><p className="font-mono text-xs font-black text-blue-700">{product.SEQPRODUTO}</p><p className="text-[10px] font-bold text-[#526A80]">{product.DESCRICAO}</p></TableCell>
                          <TableCell><p className="font-mono text-xs font-black text-[#173D6E]">{contract.NROCONTRATO}</p><p className="max-w-[210px] truncate text-[10px] font-bold text-[#526A80]">{contract.NOMERAZAO}</p></TableCell>
                          <NumberCell value={product.PESOCONTRATO} />
                          <TableCell className="text-right text-xs font-black text-cyan-800">{formatKg(product.PESO_EXPEDIDO)}</TableCell>
                          <NumberCell value={product.PESO_ATRELADO_ORDEM} />
                          <NumberCell value={product.PESO_RESERVADO_PEDIDO_LIQUIDO ?? product.PESO_RESERVADO_PEDIDO} />
                          <TableCell className="text-right text-xs font-black text-amber-700">{formatKg(product.PESO_RESERVADO_MANUAL)}</TableCell>
                          <NumberCell value={product.PESO_ATRELADO_TOTAL} />
                          <TableCell className="text-right text-xs font-black text-[#173D6E]">{formatKg(totalAttended)}</TableCell>
                          <TableCell className="text-right text-xs font-black text-emerald-700">{formatKg(product.SALDO_CONTRATO)}</TableCell>
                          <TableCell><CoverageBadge product={product} /></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              {selectedAllocated && Number(selectedAllocated.product.PESO_TRANSBORDADO || 0) > 0 && <div className="m-4 rounded-lg border border-orange-200 bg-orange-50 p-3 text-xs font-semibold text-orange-900"><AlertTriangle className="mr-2 inline h-4 w-4" />Transbordo identificado: {formatKg(selectedAllocated.product.PESO_TRANSBORDADO)} acima do contratado. Somente a parcela manual pode ser corrigida aqui.</div>}
            </CardContent>
          </Card>
          <ManualAllocationEditor allocation={selectedAllocated} totalFreeStock={totalFreeStock} configured={configured} saving={saving} reservationInputs={reservationInputs} setReservationInputs={setReservationInputs} onSave={onSaveReservation} onReviewDates={selectedAllocated ? () => onReviewProduct(selectedAllocated.product.SEQPRODUTO) : undefined} />
        </div>
      </div>
    );
  }

  const semData = reviewRows.filter(({ lot }) => !lot.DTAPRODUCAO || lot.SITUACAO_VALIDADE === "SEM_DATA");
  const incompatibles = reviewRows.filter(({ lot }) => lot.SITUACAO_VALIDADE === "INCOMPATIVEL");
  const noDemand = reviewRows.filter(({ item }) => !contracts.some((contract) => contract.PRODUTOS.some((product) => product.SEQPRODUTO === item.SEQPRODUTO)));
  return <div className="space-y-4"><section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><ReviewMetric tone="red" title="Sem contrato elegível por validade" rows={incompatibles} /><ReviewMetric tone="green" title="Elegível para outro contrato" rows={reviewRows.filter(({ item, lot }) => compatibleContractsForLot(item.SEQPRODUTO, lot.DTAPRODUCAO, contracts).length > 0)} /><ReviewMetric tone="orange" title="Sem data de produção rastreável" rows={semData} /><ReviewMetric tone="blue" title="Sem demanda contratual ativa" rows={noDemand} /></section><WorkspaceToolbar title="Lotes que exigem decisão" description="Selecione um lote para analisar validade e definir uma ação operacional." search={search} onSearchChange={onSearchChange} syncing={syncing} onSync={onSync} /><div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(390px,0.85fr)]"><Card className="min-w-0 overflow-hidden border-[#CBD8E3]"><CardContent className="p-0"><div className="max-h-[68vh] overflow-auto"><Table className="min-w-[760px]"><TableHeader className="sticky top-0 z-10 bg-[#EDF3F7]"><TableRow><SortableTableHead label="Produto" sortKey="PRODUTO" sort={reviewSort} onSort={(key) => setReviewSort((current) => nextTableSort(current, key))} /><SortableTableHead label="Lote" sortKey="LOTE" sort={reviewSort} onSort={(key) => setReviewSort((current) => nextTableSort(current, key))} /><SortableTableHead label="Produção" sortKey="DATA" sort={reviewSort} onSort={(key) => setReviewSort((current) => nextTableSort(current, key))} /><SortableTableHead label="Peso livre" sortKey="PESO" sort={reviewSort} onSort={(key) => setReviewSort((current) => nextTableSort(current, key))} align="right" /><SortableTableHead label="Contratos" sortKey="CONTRATOS" sort={reviewSort} onSort={(key) => setReviewSort((current) => nextTableSort(current, key))} align="center" /><SortableTableHead label="Motivo" sortKey="MOTIVO" sort={reviewSort} onSort={(key) => setReviewSort((current) => nextTableSort(current, key))} /><TableHead className="text-center">Ação</TableHead></TableRow></TableHeader><TableBody>{sortedReviewRows.map(({ item, lot }) => { const key = lot.CHAVE_LOTE || `${item.SEQPRODUTO}-${lot.DTAPRODUCAO}-${lot.LOTE}-${lot.SEQEMBALAGEM}`; const compatible = compatibleContractsForLot(item.SEQPRODUTO, lot.DTAPRODUCAO, contracts); return <TableRow key={key} onClick={() => setSelectedReviewKey(key)} className={`cursor-pointer ${key === selectedReviewKey ? "bg-red-50 ring-1 ring-inset ring-red-200" : "hover:bg-[#F7FAFC]"}`}><TableCell><p className="font-mono text-xs font-black text-[#173D6E]">{item.SEQPRODUTO}</p><p className="max-w-[180px] truncate text-[10px] font-bold text-[#526A80]">{item.DESCRPRODUTO}</p><LotDecisionBadge decision={lot.DECISAO_LOTE} /></TableCell><TableCell className="text-xs font-bold">{lot.LOTE || "Sem lote"}</TableCell><TableCell className="text-xs font-bold">{formatDate(lot.DTAPRODUCAO)}</TableCell><TableCell className="text-right text-xs font-black">{formatKg(lot.PESO_LIVRE_ESTIMADO)}</TableCell><TableCell className="text-center text-xs font-black">{compatible.length}</TableCell><TableCell><ValidityBadge status={lot.SITUACAO_VALIDADE} /></TableCell><TableCell className="text-center"><Eye className="mx-auto h-4 w-4 text-[#174A78]" /></TableCell></TableRow>; })}</TableBody></Table></div></CardContent></Card><ReviewDecisionPanel selected={selectedReview} contracts={contracts} decision={reviewDecision} onDecisionChange={setReviewDecision} reprocessDate={reviewReprocessDate} onReprocessDateChange={setReviewReprocessDate} saving={lotSaving} onSave={onSaveLotTreatment} /></div></div>;
}

function WorkspaceToolbar({ title, description, search, onSearchChange, syncing, onSync }: { title: string; description: string; search: string; onSearchChange: (value: string) => void; syncing: boolean; onSync: () => Promise<void> }) {
  return <Card className="border-[#CBD8E3] shadow-sm"><CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between"><div><h2 className="text-lg font-black text-[#102F53]">{title}</h2><p className="text-xs text-[#667B90]">{description}</p></div><div className="flex flex-col gap-2 sm:flex-row"><div className="relative min-w-[280px]"><Search className="absolute left-3 top-2.5 h-4 w-4 text-[#8396A9]" /><Input value={search} onChange={(event) => onSearchChange(event.target.value)} className="pl-9" placeholder="Produto, contrato ou cliente" /></div><Button variant="outline" onClick={() => void onSync()} disabled={syncing} className="border-[#AFC1D1] text-[#174A78]"><RefreshCw className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />{syncing ? "Atualizando..." : "Atualizar análise"}</Button></div></CardContent></Card>;
}

function AllocationEditor({ candidate, selectedStock, configured, saving, reservationInputs, setReservationInputs, onSave, onReviewDates }: { candidate: { contract: ExportContract; product: ContractProduct } | null; selectedStock: ContractStock; configured: boolean; saving: string | null; reservationInputs: Record<string, string>; setReservationInputs: React.Dispatch<React.SetStateAction<Record<string, string>>>; onSave: ModernStockOperationsLayoutProps["onSaveReservation"]; onReviewDates: () => void }) {
  if (!candidate) return <Card className="h-fit border-[#CBD8E3]"><CardContent className="py-14 text-center"><PackageSearch className="mx-auto h-10 w-10 text-[#A3B3C1]" /><p className="mt-3 text-sm font-bold text-[#60758A]">Selecione um contrato candidato.</p></CardContent></Card>;
  const { contract, product } = candidate;
  const key = `${contract.SEQCONTRATO}-${product.SEQPRODUTO}`;
  const suggestion = suggestedManualAddition(product);
  const input = reservationInputs[key] ?? allocationInputValue(suggestion);
  const addition = Math.max(0, Number(String(input).replace(",", ".")) || 0);
  const currentManual = Number(product.PESO_RESERVADO_MANUAL || 0);
  const newManual = currentManual + addition;
  const remaining = Math.max(0, Number(product.SALDO_CONTRATO || 0) - addition);
  const freeAfter = Math.max(0, Number(selectedStock.PESO_LIVRE_VERTICE || 0) - addition);
  const validityBlocked = Boolean(product.REGRA_VALIDADE_CONFIGURADA)
    && Number(product.PESO_ESTOQUE_ELEGIVEL || 0) <= 0
    && Number(product.PESO_ESTOQUE_INCOMPATIVEL || 0) > 0;
  return <Card className="h-fit border-[#CBD8E3] shadow-sm xl:sticky xl:top-4"><CardContent className="space-y-4 p-4"><div><h2 className="text-lg font-black text-[#102F53]">Painel de alocação</h2><p className="text-xs text-[#667B90]">Defina o peso que será adicionado neste contrato.</p></div><div className="rounded-xl border border-blue-200 bg-blue-50 p-3"><p className="font-mono text-sm font-black text-blue-700">Contrato {contract.NROCONTRATO}</p><p className="mt-1 text-xs font-bold text-[#304D68]">{contract.NOMERAZAO}</p><p className="mt-1 text-[10px] font-semibold text-[#60758A]">Produto {product.SEQPRODUTO} · embarque {formatDate(contract.DTA_EMBARQUE_PLANEJADA || contract.DTA_EMBARQUE_ERP)}</p></div><div className="space-y-2"><SummaryLine label="Saldo do contrato" value={formatKg(product.SALDO_CONTRATO)} /><SummaryLine label="Estoque global livre" value={formatKg(selectedStock.PESO_LIVRE_VERTICE)} /><SummaryLine label="Estoque elegível livre" value={formatKg(product.PESO_ESTOQUE_ELEGIVEL)} /></div><div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3"><div className="flex items-center justify-between"><span className="text-xs font-black text-emerald-800">Sugestão de alocação</span><strong className="text-xl text-emerald-800">{formatKg(suggestion)}</strong></div></div>{validityBlocked && <Button type="button" variant="outline" onClick={onReviewDates} className="h-11 w-full border-orange-300 bg-orange-50 font-black text-orange-900 hover:bg-orange-100"><CalendarDays className="mr-2 h-4 w-4" />Revisar datas deste produto</Button>}<FilterField label="Peso a adicionar (kg)"><Input type="number" min="0" step="0.001" value={input} onChange={(event) => setReservationInputs((current) => ({ ...current, [key]: event.target.value }))} className="h-12 text-lg font-black" /></FilterField><div className="rounded-lg border border-[#D5E0E9] bg-[#F7F9FB] p-3"><SummaryLine label="Manual atual" value={formatKg(currentManual)} /><SummaryLine label="Novo total manual" value={formatKg(newManual)} /></div><div><h3 className="mb-2 text-sm font-black text-[#102F53]">Prévia do resultado</h3><div className="space-y-2 rounded-lg border border-[#D5E0E9] p-3"><SummaryLine label="Saldo restante do contrato" value={formatKg(remaining)} /><SummaryLine label="Estoque livre após operação" value={formatKg(freeAfter)} /></div></div><Button type="button" disabled={!configured || addition <= 0 || saving === key || validityBlocked} onClick={() => void onSave(contract, product, addition, "ADDITION")} className="h-12 w-full bg-emerald-700 text-white hover:bg-emerald-800"><CheckCircle2 className="mr-2 h-5 w-5" />{saving === key ? "Confirmando..." : validityBlocked ? "Revisar validade antes de alocar" : "Confirmar alocação"}</Button></CardContent></Card>;
}

function ManualAllocationEditor({ allocation, totalFreeStock, configured, saving, reservationInputs, setReservationInputs, onSave, onReviewDates }: { allocation: { contract: ExportContract; product: ContractProduct } | null; totalFreeStock: number; configured: boolean; saving: string | null; reservationInputs: Record<string, string>; setReservationInputs: React.Dispatch<React.SetStateAction<Record<string, string>>>; onSave: ModernStockOperationsLayoutProps["onSaveReservation"]; onReviewDates?: () => void }) {
  if (!allocation) return <Card className="h-fit border-[#CBD8E3]"><CardContent className="py-14 text-center"><Pencil className="mx-auto h-9 w-9 text-[#A3B3C1]" /><p className="mt-3 text-sm font-bold text-[#60758A]">Selecione uma alocação para ajustar.</p></CardContent></Card>;
  const { contract, product } = allocation;
  totalFreeStock = Math.max(0, Number(product.PESO_LIVRE_VERTICE || 0));
  const key = `${contract.SEQCONTRATO}-${product.SEQPRODUTO}`;
  const currentManual = Number(product.PESO_RESERVADO_MANUAL || 0);
  const input = reservationInputs[key] ?? allocationInputValue(currentManual);
  const nextManual = Math.max(0, Number(String(input).replace(",", ".")) || 0);
  const delta = nextManual - currentManual;
  const newTotal = Math.max(0, Number(product.PESO_ATRELADO_TOTAL || 0) + delta);
  const shipped = Number(product.PESO_EXPEDIDO || 0);
  const currentAttended = shipped + Number(product.PESO_ATRELADO_TOTAL || 0);
  const newAttended = shipped + newTotal;
  const increaseBlockedByValidity = delta > 0
    && Boolean(product.REGRA_VALIDADE_CONFIGURADA)
    && Number(product.PESO_ESTOQUE_ELEGIVEL || 0) <= 0
    && Number(product.PESO_ESTOQUE_INCOMPATIVEL || 0) > 0;
  return (
    <Card className="h-fit border-[#CBD8E3] shadow-sm xl:sticky xl:top-4">
      <CardContent className="space-y-4 p-4">
        <div><h2 className="flex items-center gap-2 text-lg font-black text-[#102F53]"><Pencil className="h-5 w-5" />Ajustar alocação manual</h2><p className="text-xs text-[#667B90]">Produto {product.SEQPRODUTO} · {product.DESCRICAO}</p></div>
        <div className="grid grid-cols-2 gap-2 border-y border-[#DCE5ED] py-3">
          <MiniFact label="Contrato" value={contract.NROCONTRATO} />
          <MiniFact label="Contratado" value={formatKg(product.PESOCONTRATO)} />
          <MiniFact label="Já expedido" value={formatKg(shipped)} />
          <MiniFact label="Situação" value={Number(product.SALDO_CONTRATO || 0) <= 0 ? "Atendido" : "Parcial"} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <SummaryValue label="Manual atual" value={formatKg(currentManual)} />
          <SummaryValue label="Novo total manual" value={formatKg(nextManual)} tone={nextManual <= currentManual ? "green" : "blue"} />
        </div>
        <FilterField label="Novo total manual"><Input type="number" min="0" step="0.001" value={input} onChange={(event) => setReservationInputs((current) => ({ ...current, [key]: event.target.value }))} className="h-12 text-lg font-black" /></FilterField>
        {increaseBlockedByValidity && onReviewDates && <Button type="button" variant="outline" onClick={onReviewDates} className="h-11 w-full border-orange-300 bg-orange-50 font-black text-orange-900 hover:bg-orange-100"><CalendarDays className="mr-2 h-4 w-4" />Revisar datas deste produto</Button>}
        <div>
          <h3 className="mb-2 text-sm font-black text-[#102F53]">Prévia do impacto</h3>
          <div className="space-y-2 rounded-lg border border-[#D5E0E9] p-3">
            <SummaryLine label={delta <= 0 ? "Peso devolvido ao disponível" : "Peso retirado do disponível"} value={formatKg(Math.abs(delta))} />
            <SummaryLine label="Estoque livre global" value={`${formatKg(totalFreeStock)} → ${formatKg(totalFreeStock - delta)}`} />
            <SummaryLine label="Saldo pendente" value={`${formatKg(product.SALDO_CONTRATO)} → ${formatKg(Math.max(0, Number(product.SALDO_CONTRATO || 0) - delta))}`} />
            <SummaryLine label="Total ainda reservado" value={formatKg(newTotal)} />
            <SummaryLine label="Total atendido" value={`${formatKg(currentAttended)} → ${formatKg(newAttended)}`} />
          </div>
        </div>
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs font-semibold text-blue-900"><LockKeyhole className="mr-2 inline h-4 w-4" />O saldo considera o que já foi expedido e o que permanece reservado. Esta operação altera somente a reserva manual; OP e pedido permanecem protegidos.</div>
        <Button type="button" disabled={!configured || saving === key || nextManual === currentManual || increaseBlockedByValidity} onClick={() => void onSave(contract, product, nextManual, "TOTAL")} className="h-12 w-full bg-emerald-700 hover:bg-emerald-800"><CheckCircle2 className="mr-2 h-5 w-5" />{saving === key ? "Salvando..." : increaseBlockedByValidity ? "Revisar validade antes de aumentar" : "Confirmar alteração"}</Button>
      </CardContent>
    </Card>
  );
}

function ReviewDecisionPanel({ selected, contracts, decision, onDecisionChange, reprocessDate, onReprocessDateChange, saving, onSave }: { selected: { item: ContractStock; lot: ContractStockLot } | null; contracts: ExportContract[]; decision: "SEPARADO" | "DISPONIVEL" | "REPROCESSO" | "ALOCAR"; onDecisionChange: (value: "SEPARADO" | "DISPONIVEL" | "REPROCESSO" | "ALOCAR") => void; reprocessDate: string; onReprocessDateChange: (value: string) => void; saving: string | null; onSave: ModernStockOperationsLayoutProps["onSaveLotTreatment"] }) {
  if (!selected) return <Card className="h-fit border-[#CBD8E3]"><CardContent className="py-14 text-center"><CalendarDays className="mx-auto h-10 w-10 text-[#A3B3C1]" /><p className="mt-3 text-sm font-bold text-[#60758A]">Selecione um lote para revisar.</p></CardContent></Card>;
  const { item, lot } = selected;
  const compatible = compatibleContractsForLot(item.SEQPRODUTO, lot.DTAPRODUCAO, contracts);
  const productContracts = contracts.filter((contract) => contract.PRODUTOS.some((product) => product.SEQPRODUTO === item.SEQPRODUTO));
  const key = lot.CHAVE_LOTE || `${item.SEQPRODUTO}-${lot.DTAPRODUCAO}-${lot.LOTE}-${lot.SEQEMBALAGEM}`;
  if (lot.SINTETICO_SEM_RASTREIO) {
    return <Card className="h-fit border-orange-300 shadow-sm xl:sticky xl:top-4">
      <CardContent className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-[#102F53]">Peso sem rastreio no ERP</h2>
            <p className="text-xs text-[#667B90]">{item.SEQPRODUTO} - {item.DESCRPRODUTO}</p>
          </div>
          <span className="rounded-full bg-orange-100 px-2 py-1 text-[9px] font-black uppercase text-orange-800">Revisar origem</span>
        </div>
        <div className="grid grid-cols-2 gap-2 rounded-xl border border-orange-200 bg-orange-50 p-3">
          <MiniFact label="Peso livre informado" value={formatKg(lot.PESO_LIVRE_ESTIMADO)} />
          <MiniFact label="Data de produção" value="Não identificada" />
        </div>
        <div className="rounded-lg border border-orange-300 bg-orange-50 p-3 text-xs font-semibold leading-5 text-orange-950">
          O estoque consolidado informa este peso como livre, mas ele não foi associado a um lote e a uma data de produção na consulta analítica. Sem essa correspondência, o sistema não consegue comprovar a validade exigida pelo contrato.
        </div>
        <div>
          <h3 className="mb-2 text-sm font-black text-[#102F53]">Contratos que exigem o produto</h3>
          <div className="space-y-2">
            {productContracts.map((contract) => {
              const product = contract.PRODUTOS.find((entry) => entry.SEQPRODUTO === item.SEQPRODUTO)!;
              return <div key={contract.SEQCONTRATO} className="flex items-center justify-between gap-3 rounded-lg border border-[#D5E0E9] px-3 py-2">
                <div className="min-w-0"><p className="font-mono text-xs font-black text-[#173D6E]">{contract.NROCONTRATO}</p><p className="truncate text-[10px] font-semibold text-[#60758A]">{contract.NOMERAZAO}</p></div>
                <div className="text-right"><p className="text-[9px] font-black uppercase text-[#71869A]">Produção mínima</p><p className="text-xs font-black text-red-700">{formatDate(product.DATA_MINIMA_PRODUCAO)}</p></div>
              </div>;
            })}
          </div>
        </div>
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs font-semibold leading-5 text-blue-950">
          Este registro é informativo e não representa um lote editável. Corrija a rastreabilidade na origem do ERP; depois de atualizar a análise, os lotes reais aparecerão aqui para decisão.
        </div>
      </CardContent>
    </Card>;
  }
  return <ReviewDecisionDetails
    key={key}
    item={item}
    lot={lot}
    contracts={productContracts}
    compatibleContracts={compatible}
    decision={decision}
    onDecisionChange={onDecisionChange}
    reprocessDate={reprocessDate}
    onReprocessDateChange={onReprocessDateChange}
    saving={saving === key}
    onSave={onSave}
  />;
}

function ReviewDecisionDetails({ item, lot, contracts, compatibleContracts, decision, onDecisionChange, reprocessDate, onReprocessDateChange, saving, onSave }: {
  item: ContractStock;
  lot: ContractStockLot;
  contracts: ExportContract[];
  compatibleContracts: ExportContract[];
  decision: "SEPARADO" | "DISPONIVEL" | "REPROCESSO" | "ALOCAR";
  onDecisionChange: (value: "SEPARADO" | "DISPONIVEL" | "REPROCESSO" | "ALOCAR") => void;
  reprocessDate: string;
  onReprocessDateChange: (value: string) => void;
  saving: boolean;
  onSave: ModernStockOperationsLayoutProps["onSaveLotTreatment"];
}) {
  const suggestedWeight = (contract: ExportContract | null) => {
    const product = contract?.PRODUTOS.find((entry) => entry.SEQPRODUTO === item.SEQPRODUTO);
    return Math.max(0, Math.min(
      Number(lot.PESO_LIVRE_ESTIMADO || lot.PESO_DISPONIVEL_ESTIMADO || 0),
      Number(product?.SALDO_CONTRATO || 0),
    ));
  };
  const firstCompatibleContract = compatibleContracts[0] || null;
  const [targetContractId, setTargetContractId] = useState<number | null>(firstCompatibleContract?.SEQCONTRATO ?? null);
  const [targetWeight, setTargetWeight] = useState(() => allocationInputValue(suggestedWeight(firstCompatibleContract)));
  const selectedContract = compatibleContracts.find((contract) => contract.SEQCONTRATO === targetContractId) || null;
  const selectTargetContract = (contract: ExportContract) => {
    setTargetContractId(contract.SEQCONTRATO);
    setTargetWeight(allocationInputValue(suggestedWeight(contract)));
  };
  const numericWeight = Math.max(0, Number(String(targetWeight).replace(",", ".")) || 0);
  const currentDecision = lot.DECISAO_LOTE;
  return <Card className="h-fit border-[#CBD8E3] shadow-sm xl:sticky xl:top-4">
    <CardContent className="space-y-4 p-4">
      <div className="flex items-start justify-between gap-3">
        <div><h2 className="text-lg font-black text-[#102F53]">Detalhes do lote</h2><div className="mt-1 flex flex-wrap items-center gap-2"><p className="text-xs font-bold text-[#667B90]">{item.SEQPRODUTO} · {item.DESCRPRODUTO}</p><LotDecisionBadge decision={currentDecision} /></div></div>
        <ValidityBadge status={lot.SITUACAO_VALIDADE} />
      </div>
      <div className="grid grid-cols-3 gap-2 rounded-xl border border-[#D5E0E9] bg-[#F7F9FB] p-3"><MiniFact label="Peso físico" value={formatKg(lot.PESO_FISICO)} /><MiniFact label="Peso livre" value={formatKg(lot.PESO_LIVRE_ESTIMADO)} /><MiniFact label="Produção" value={formatDate(lot.DTAPRODUCAO)} /></div>
      <div><h3 className="mb-2 text-sm font-black text-[#102F53]">Contratos que possuem este produto</h3><div className="max-h-52 overflow-auto rounded-lg border border-[#D5E0E9]"><Table><TableHeader className="sticky top-0 bg-[#EDF3F7]"><TableRow><TableHead>Contrato</TableHead><TableHead>Cliente</TableHead><TableHead>Data mínima</TableHead><TableHead>Situação</TableHead></TableRow></TableHeader><TableBody>{contracts.map((contract) => { const product = contract.PRODUTOS.find((entry) => entry.SEQPRODUTO === item.SEQPRODUTO)!; const accepted = compatibleContracts.some((entry) => entry.SEQCONTRATO === contract.SEQCONTRATO); return <TableRow key={contract.SEQCONTRATO}><TableCell className="font-mono text-xs font-black">{contract.NROCONTRATO}</TableCell><TableCell className="max-w-[130px] truncate text-xs font-bold">{contract.NOMERAZAO}</TableCell><TableCell className="text-xs font-bold">{formatDate(product.DATA_MINIMA_PRODUCAO)}</TableCell><TableCell><span className={`rounded-full px-2 py-1 text-[9px] font-black ${accepted ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-700"}`}>{accepted ? "Compatível" : "Não compatível"}</span></TableCell></TableRow>; })}</TableBody></Table></div></div>
      <div className={`rounded-lg border p-3 text-xs font-semibold ${compatibleContracts.length > 0 ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-900"}`}><p className="font-black">Resultado da análise</p><p className="mt-1">{compatibleContracts.length > 0 ? `${compatibleContracts.length} contrato(s) aceitam a data deste lote.` : "Nenhum contrato ativo aceita a data deste lote."}</p></div>
      <div><h3 className="mb-2 text-sm font-black text-[#102F53]">Ação operacional</h3><select value={decision} onChange={(event) => onDecisionChange(event.target.value as typeof decision)} className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm font-bold"><option value="SEPARADO">Manter separado</option><option value="DISPONIVEL">Disponibilizar mesmo com data antiga</option><option value="REPROCESSO">Encaminhar para reprocesso</option><option value="ALOCAR">Alocar em contrato compatível</option></select></div>
      {decision === "DISPONIVEL" && <div className="rounded-lg border border-orange-300 bg-orange-50 p-3 text-xs font-semibold leading-5 text-orange-950"><strong>Exceção de validade:</strong> este lote será liberado para qualquer contrato que use o produto e aparecerá como “Produto antigo aceito”. A decisão poderá ser revertida depois.</div>}
      {decision === "REPROCESSO" && <div className="space-y-2"><FilterField label="Data prevista de reprocesso"><Input type="date" value={reprocessDate} onChange={(event) => onReprocessDateChange(event.target.value)} /></FilterField><p className="text-xs font-semibold text-orange-800">O lote continuará nesta revisão, identificado como “Em reprocesso”.</p></div>}
      {decision === "ALOCAR" && <div className="space-y-3 rounded-xl border border-blue-200 bg-blue-50 p-3"><div><p className="text-xs font-black text-[#173D6E]">Escolha o contrato compatível</p><p className="mt-1 text-[10px] font-semibold text-[#60758A]">A tela de alocação abrirá com o contrato e o peso já preenchidos.</p></div><div className="max-h-44 space-y-2 overflow-auto">{compatibleContracts.map((contract) => { const product = contract.PRODUTOS.find((entry) => entry.SEQPRODUTO === item.SEQPRODUTO)!; const checked = contract.SEQCONTRATO === targetContractId; return <button key={contract.SEQCONTRATO} type="button" onClick={() => selectTargetContract(contract)} className={`flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left ${checked ? "border-blue-500 bg-white ring-1 ring-blue-200" : "border-blue-200 bg-blue-50 hover:bg-white"}`}><div><p className="font-mono text-xs font-black text-[#173D6E]">{contract.NROCONTRATO}</p><p className="max-w-[230px] truncate text-[10px] font-semibold text-[#60758A]">{contract.NOMERAZAO}</p></div><div className="text-right"><p className="text-[9px] font-black uppercase text-[#71869A]">Saldo</p><p className="text-xs font-black text-orange-700">{formatKg(product.SALDO_CONTRATO)}</p></div></button>; })}</div><FilterField label="Peso que deseja alocar"><Input type="number" min="0" step="0.001" value={targetWeight} onChange={(event) => setTargetWeight(event.target.value)} className="h-11 text-base font-black" /></FilterField></div>}
      <Button type="button" disabled={saving || (decision === "REPROCESSO" && !reprocessDate) || (decision === "ALOCAR" && (!selectedContract || numericWeight <= 0))} onClick={() => void onSave(item, lot, decision, decision === "REPROCESSO" ? reprocessDate : undefined, targetContractId ?? undefined, numericWeight)} className="h-11 w-full bg-[#173D6E] hover:bg-[#102F53]">{saving ? "Salvando..." : decision === "ALOCAR" ? "Salvar e abrir alocação" : "Confirmar decisão"}</Button>
    </CardContent>
  </Card>;
}

function LotDecisionBadge({ decision }: { decision?: ContractStockLot["DECISAO_LOTE"] }) {
  if (!decision) return null;
  const config = decision === "REPROCESSO"
    ? ["Em reprocesso", "border-orange-300 bg-orange-50 text-orange-800"]
    : decision === "DISPONIVEL"
      ? ["Produto antigo aceito", "border-orange-300 bg-orange-50 text-orange-800"]
      : decision === "ALOCAR"
        ? ["Aguardando alocação", "border-blue-300 bg-blue-50 text-blue-800"]
        : ["Separado", "border-slate-300 bg-slate-50 text-slate-700"];
  return <span className={`inline-flex rounded-full border px-2 py-1 text-[9px] font-black uppercase ${config[1]}`}>{config[0]}</span>;
}

function ReviewMetric({ title, rows, tone }: { title: string; rows: Array<{ lot: ContractStockLot }>; tone: "red" | "green" | "orange" | "blue" }) {
  const weight = rows.reduce((sum, row) => sum + Number(row.lot.PESO_LIVRE_ESTIMADO || 0), 0);
  const styles = tone === "red" ? "border-l-red-500 text-red-700" : tone === "green" ? "border-l-emerald-500 text-emerald-700" : tone === "orange" ? "border-l-orange-500 text-orange-700" : "border-l-blue-500 text-blue-700";
  return <Card className={`border-[#CBD8E3] border-l-4 ${styles}`}><CardContent className="p-4"><p className="text-xs font-black text-[#263F58]">{title}</p><div className="mt-2 flex items-end justify-between"><p className="text-2xl font-black">{rows.length} lotes</p><p className="text-sm font-black text-[#304D68]">{formatKg(weight)}</p></div></CardContent></Card>;
}

function ValidityBadge({ status }: { status?: ContractStockLot["SITUACAO_VALIDADE"] }) {
  const config = status === "ELEGIVEL"
    ? ["Elegível", "bg-emerald-100 text-emerald-800"]
    : status === "ACEITO_EXCECAO"
      ? ["Produto antigo aceito", "bg-orange-100 text-orange-800"]
      : status === "ATENCAO"
        ? ["Atenção", "bg-amber-100 text-amber-800"]
        : status === "SEM_DATA"
          ? ["Sem data", "bg-blue-100 text-blue-800"]
          : status === "SEM_REGRA"
            ? ["Sem regra", "bg-slate-100 text-slate-700"]
            : ["Incompatível", "bg-red-100 text-red-700"];
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-1 text-[9px] font-black uppercase ${config[1]}`}>{config[0]}</span>;
}

function CoverageBadge({ product }: { product: ContractProduct }) {
  const overflow = Number(product.PESO_TRANSBORDADO || 0) > 0;
  const covered = Number(product.SALDO_CONTRATO || 0) <= 0;
  return <span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${overflow ? "bg-red-100 text-red-700" : covered ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{overflow ? "Transbordo" : covered ? "Atendido" : "Parcial"}</span>;
}

function MiniFact({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><p className="text-[9px] font-black uppercase tracking-wider text-[#71869A]">{label}</p><p className="mt-1 truncate text-xs font-black text-[#173D6E]" title={value}>{value}</p></div>;
}

function StockLotsDialog({ stock, contracts, onClose }: { stock: ContractStock | null; contracts: ExportContract[]; onClose: () => void }) {
  const lots = stock?.LOTES_LIVRES || [];
  const unresolved = Number(stock?.PESO_LIVRE_SEM_DATA || 0) + Number(stock?.PESO_LIVRE_SEM_RASTREIO || 0);
  return <Dialog open={Boolean(stock)} onOpenChange={(open) => !open && onClose()}>
    <DialogContent className="max-h-[90vh] max-w-[96vw] overflow-hidden border-[#CBD8E3] xl:max-w-4xl">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-[#173D6E]"><CalendarDays className="h-5 w-5" />Estoque livre por data</DialogTitle>
        <DialogDescription>{stock ? `${stock.SEQPRODUTO} - ${stock.DESCRPRODUTO}. Distribuição estimada sobre o saldo livre oficial do ERP.` : "Detalhamento do estoque"}</DialogDescription>
      </DialogHeader>
      {stock && <div className="min-h-0 space-y-4 overflow-hidden">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><AllocationSummary label="Livre total" value={stock.PESO_LIVRE_VERTICE} className="border-[#C8D7E3] bg-[#F5F8FA] text-[#173D6E]" /><AllocationSummary label="Com data" value={stock.PESO_LIVRE_COM_DATA || 0} className="border-emerald-200 bg-emerald-50 text-emerald-800" /><AllocationSummary label="Sem data física" value={stock.PESO_LIVRE_SEM_DATA || 0} className="border-amber-200 bg-amber-50 text-amber-800" /><AllocationSummary label="Sem correspondência" value={stock.PESO_LIVRE_SEM_RASTREIO || 0} className="border-red-200 bg-red-50 text-red-800" /></div>
        {unresolved > 0 && <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-xs font-bold leading-5 text-red-900">Há {formatKg(unresolved)} que o ERP informa como livre, mas que não possuem data física suficiente para validar. Esse peso não poderá ser alocado até a origem ser identificada.</div>}
        <div className="max-h-[54vh] overflow-auto rounded-lg border border-[#D5E0E9]">
          <Table className="min-w-[900px]"><TableHeader className="sticky top-0 z-10 bg-[#EDF3F7]"><TableRow><Header>Produção</Header><Header>Lote</Header><Header>Embalagem</Header><Header className="text-right">Quantidade física</Header><Header className="text-right">Peso físico</Header><Header className="text-right">Saldo livre</Header><Header className="w-[200px]">Contratos que aceitam</Header></TableRow></TableHeader><TableBody>{lots.length === 0 ? <TableRow><TableCell colSpan={7} className="h-28 text-center text-sm font-semibold text-red-700">Nenhum lote livre com data foi identificado.</TableCell></TableRow> : lots.map((lot, index) => { const compatible = compatibleContractsForLot(stock.SEQPRODUTO, lot.DTAPRODUCAO, contracts); return <TableRow key={`${lot.DTAPRODUCAO}-${lot.LOTE}-${lot.SEQEMBALAGEM}-${index}`} className={compatible.length ? "" : "bg-amber-50"}><TableCell className="whitespace-nowrap text-xs font-black text-[#173D6E]">{formatDate(lot.DTAPRODUCAO)}</TableCell><TableCell className="text-xs font-bold text-[#304D68]">{lot.LOTE || "Sem lote"}</TableCell><TableCell className="text-xs font-semibold text-[#536B82]">{lot.SEQEMBALAGEM || "—"}</TableCell><TableCell className="text-right text-xs font-semibold">{kgFormatter.format(Number(lot.QUANTIDADE || 0))}</TableCell><TableCell className="text-right text-xs font-semibold">{formatKg(lot.PESO_FISICO)}</TableCell><TableCell className="text-right text-xs font-black text-emerald-700">{formatKg(lot.PESO_LIVRE_ESTIMADO)}</TableCell><TableCell>{compatible.length ? <div className="flex flex-wrap gap-1">{compatible.slice(0, 3).map((contract) => <span key={contract.SEQCONTRATO} className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[9px] font-black text-emerald-800">{contract.NROCONTRATO}</span>)}{compatible.length > 3 && <span className="text-[9px] font-bold text-[#536B82]">+{compatible.length - 3}</span>}</div> : <span className="text-[10px] font-black text-amber-800">Nenhum contrato aceita esta data</span>}</TableCell></TableRow>; })}</TableBody></Table>
        </div>
        <p className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs leading-5 text-blue-900">Como as reservas manuais ainda são feitas por produto, o sistema aplica o saldo livre às produções mais recentes. O total nunca ultrapassa o disponível consolidado do ERP.</p>
      </div>}
    </DialogContent>
  </Dialog>;
}

function ValidityLotsDialog({
  detail,
  onClose,
  onSeparateLot,
  lotSaving,
  lotTreatmentConfigured,
}: {
  detail: { contract: ExportContract; product: ContractProduct } | null;
  onClose: () => void;
  onSeparateLot: (lot: ContractStockLot) => Promise<void>;
  lotSaving: string | null;
  lotTreatmentConfigured: boolean;
}) {
  const product = detail?.product;
  const lots = product?.LOTES_ESTOQUE || [];
  return <Dialog open={Boolean(detail)} onOpenChange={(open) => !open && onClose()}>
    <DialogContent className="max-h-[90vh] max-w-[96vw] overflow-hidden border-[#CBD8E3] xl:max-w-5xl">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-[#173D6E]"><CalendarDays className="h-5 w-5" />Validade para o contrato {detail?.contract.NROCONTRATO}</DialogTitle>
        <DialogDescription>{product ? `${product.SEQPRODUTO} - ${product.DESCRICAO}. A validade é avaliada na data prevista de embarque.` : "Detalhes da validade"}</DialogDescription>
      </DialogHeader>
      {product && <div className="min-h-0 space-y-4 overflow-hidden">
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-6">
          <div className="rounded-lg border border-[#C8D7E3] bg-[#F5F8FA] p-3"><p className="text-[9px] font-black uppercase text-[#71869A]">Regra</p><p className="mt-1 text-sm font-black text-[#173D6E]">{validityRuleLabel(product)}</p></div>
          <div className="rounded-lg border border-[#C8D7E3] bg-[#F5F8FA] p-3"><p className="text-[9px] font-black uppercase text-[#71869A]">Embarque</p><p className="mt-1 text-sm font-black text-[#173D6E]">{formatDate(product.DATA_REFERENCIA_VALIDADE)}</p></div>
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3"><p className="text-[9px] font-black uppercase text-blue-700">Produção mínima</p><p className="mt-1 text-sm font-black text-blue-900">{formatDate(product.DATA_MINIMA_PRODUCAO)}</p></div>
          <AllocationSummary label="Elegível" value={product.PESO_ESTOQUE_ELEGIVEL || 0} className="border-emerald-200 bg-emerald-50 text-emerald-800" />
          <AllocationSummary label="Próximo do limite" value={product.PESO_ESTOQUE_ATENCAO || 0} className="border-amber-200 bg-amber-50 text-amber-800" />
          <AllocationSummary label="Incompatível" value={product.PESO_ESTOQUE_INCOMPATIVEL || 0} className="border-red-200 bg-red-50 text-red-800" />
        </div>
        {!product.REGRA_VALIDADE_CONFIGURADA && <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs font-bold text-amber-900">Este produto não possui uma regra de validade configurada no contrato. O estoque não será bloqueado, mas deve ser revisado antes da alocação.</div>}
        <div className="max-h-[52vh] overflow-auto rounded-lg border border-[#D5E0E9]">
          <Table className="min-w-[820px] table-fixed [&_td]:px-3 [&_th]:px-3">
            <TableHeader className="sticky top-0 z-10 bg-[#EDF3F7]"><TableRow><Header className="w-[130px]">Produção</Header><Header>Lote</Header><Header className="w-[130px] text-right">Peso físico</Header><Header className="w-[155px] text-right">Disponível estimado</Header><Header className="w-[135px] text-center">Margem</Header><Header className="w-[155px]">Situação</Header><Header className="w-[150px] text-center">Ação</Header></TableRow></TableHeader>
            <TableBody>
              {lots.length === 0 && <TableRow><TableCell colSpan={7} className="h-28 text-center text-sm font-semibold text-[#6B7F92]">Nenhum lote livre foi identificado para este produto.</TableCell></TableRow>}
              {lots.map((lot, index) => {
                const status = lot.SITUACAO_VALIDADE || "SEM_DATA";
                const statusClass = status === "ELEGIVEL" ? "border-emerald-300 bg-emerald-50 text-emerald-800" : status === "ATENCAO" ? "border-amber-300 bg-amber-50 text-amber-800" : status === "SEM_REGRA" ? "border-slate-300 bg-slate-50 text-slate-700" : "border-red-300 bg-red-50 text-red-700";
                const statusLabel = status === "ELEGIVEL" ? "Elegível" : status === "ATENCAO" ? "Próximo do limite" : status === "SEM_REGRA" ? "Sem regra" : status === "SEM_DATA" ? "Sem data" : "Incompatível";
                const lotKey = lot.CHAVE_LOTE || `${lot.SEQPRODUTO}-${lot.DTAPRODUCAO}-${lot.LOTE}-${lot.SEQEMBALAGEM}`;
                return <TableRow key={`${lot.DTAPRODUCAO || "sem-data"}-${lot.LOTE || "sem-lote"}-${lot.SEQEMBALAGEM || index}`}><TableCell className="text-xs font-black text-[#173D6E]">{formatDate(lot.DTAPRODUCAO)}</TableCell><TableCell className="text-xs font-bold text-[#304D68]">{lot.LOTE || "Sem lote"}</TableCell><NumberCell value={lot.PESO_FISICO} /><TableCell className="text-right text-xs font-black text-blue-700">{formatKg(lot.PESO_DISPONIVEL_ESTIMADO)}</TableCell><TableCell className="text-center text-xs font-bold text-[#47627D]">{lot.MARGEM_DIAS == null ? "—" : `${lot.MARGEM_DIAS} dias`}</TableCell><TableCell><span className={`inline-flex rounded-full border px-2 py-1 text-[9px] font-black uppercase ${statusClass}`}>{statusLabel}</span></TableCell><TableCell className="text-center">{status === "INCOMPATIVEL" ? <Button type="button" size="sm" variant="outline" disabled={!lotTreatmentConfigured || lotSaving === lotKey} onClick={() => void onSeparateLot(lot)} className="h-8 border-red-200 px-2 text-[10px] font-black text-red-700 hover:bg-red-50"><Minus className="mr-1 h-3.5 w-3.5" />{lotSaving === lotKey ? "Retirando..." : "Retirar do disponível"}</Button> : <span className="text-[10px] font-semibold text-[#8192A2]">Sem ação</span>}</TableCell></TableRow>;
              })}
            </TableBody>
          </Table>
        </div>
        <p className="text-[10px] font-semibold text-[#667B90]">O saldo disponível por data é estimado de forma conservadora sobre o total livre informado pelo ERP. A ordenação FEFO prioriza o lote válido mais antigo na operação.</p>
      </div>}
    </DialogContent>
  </Dialog>;
}

function ExpeditionDetailsDialog({ contract, onClose }: { contract: ExportContract | null; onClose: () => void }) {
  const shipped = Number(contract?.PESO_EXPEDIDO || 0);
  const manual = (contract?.PRODUTOS || []).reduce((sum, product) => sum + Number(product.PESO_RESERVADO_MANUAL || 0), 0);
  const productionOrders = (contract?.PRODUTOS || []).reduce((sum, product) => sum + Number(product.PESO_ATRELADO_ORDEM || 0), 0);
  const orderReservations = (contract?.PRODUTOS || []).reduce((sum, product) => sum + Number(product.PESO_RESERVADO_PEDIDO || 0), 0);
  const pendingReserved = (contract?.PRODUTOS || []).reduce((sum, product) => sum + Number(product.PESO_ATRELADO_TOTAL || 0), 0);

  return <Dialog open={Boolean(contract)} onOpenChange={(open) => !open && onClose()}>
    <DialogContent className="max-h-[90vh] max-w-[96vw] overflow-hidden border-[#CBD8E3] xl:max-w-5xl">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-[#173D6E]"><PackageSearch className="h-5 w-5 text-cyan-700" />Expedição do contrato {contract?.NROCONTRATO}</DialogTitle>
        <DialogDescription>A barra do contrato considera somente o peso efetivamente carregado. As reservas abaixo continuam protegidas no estoque para completar a expedição.</DialogDescription>
      </DialogHeader>
      {contract && <div className="min-h-0 space-y-4 overflow-hidden">
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-6">
          <AllocationSummary label="Peso contratado" value={contract.PESO_TOTAL} className="border-[#C8D7E3] bg-[#F5F8FA] text-[#173D6E]" />
          <AllocationSummary label="Peso carregado" value={shipped} className="border-cyan-200 bg-cyan-50 text-cyan-800" />
          <AllocationSummary label="Reservado por OP" value={productionOrders} className="border-blue-200 bg-blue-50 text-blue-800" />
          <AllocationSummary label="Reservado em pedido" value={orderReservations} className="border-emerald-200 bg-emerald-50 text-emerald-800" />
          <AllocationSummary label="Reservado manual" value={manual} className="border-amber-200 bg-amber-50 text-amber-800" />
          <AllocationSummary label="Reserva pendente" value={pendingReserved} className="border-emerald-200 bg-emerald-50 text-emerald-800" />
        </div>
        <div className="max-h-[55vh] overflow-auto rounded-lg border border-[#D5E0E9]">
          <Table className="min-w-[1065px] table-fixed [&_td]:px-3 [&_th]:px-3">
            <TableHeader className="sticky top-0 z-10 bg-[#EDF3F7]"><TableRow><Header className="w-[90px]">Produto</Header><Header>Descrição</Header><Header className="w-[125px] text-right">Contratado</Header><Header className="w-[125px] text-right">Carregado</Header><Header className="w-[125px] text-right">OP protegida</Header><Header className="w-[125px] text-right">Pedido reservado</Header><Header className="w-[125px] text-right">Manual</Header><Header className="w-[135px] text-right">Ainda reservado</Header></TableRow></TableHeader>
            <TableBody>{contract.PRODUTOS.map((product) => {
              const reserved = Number(product.PESO_ATRELADO_TOTAL || 0);
              return <TableRow key={product.SEQPRODUTO} className={reserved > 0 ? "bg-emerald-50/40" : ""}><TableCell className="font-mono text-xs font-black text-[#244B70]">{product.SEQPRODUTO}</TableCell><TableCell><p className="truncate text-xs font-bold text-[#304D68]" title={product.DESCRICAO}>{product.DESCRICAO}</p></TableCell><NumberCell value={product.PESOCONTRATO} /><TableCell className="text-right text-xs font-black text-cyan-800">{formatKg(product.PESO_EXPEDIDO)}</TableCell><NumberCell value={product.PESO_ATRELADO_ORDEM} /><NumberCell value={product.PESO_RESERVADO_PEDIDO} /><NumberCell value={product.PESO_RESERVADO_MANUAL} /><TableCell className="text-right text-xs font-black text-emerald-700">{formatKg(reserved)}</TableCell></TableRow>;
            })}</TableBody>
          </Table>
        </div>
        {pendingReserved <= 0 && <div className="rounded-lg border border-dashed border-[#B9CAD8] bg-[#F8FAFC] p-4 text-center text-xs font-semibold text-[#667B90]">Este contrato está em expedição, mas não possui peso adicional reservado por OP, pedido ou manualmente.</div>}
      </div>}
    </DialogContent>
  </Dialog>;
}

function ProductionForecastDialog({
  contract,
  recommendation,
  onClose,
}: {
  contract: ExportContract | null;
  recommendation: PcpRecommendation | null;
  onClose: () => void;
}) {
  const bottleneck = recommendation?.PRODUTO_GARGALO;
  return <Dialog open={Boolean(contract)} onOpenChange={(open) => !open && onClose()}>
    <DialogContent className="max-h-[90vh] max-w-[96vw] overflow-hidden border-[#CBD8E3] xl:max-w-6xl">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-[#173D6E]"><CalendarDays className="h-5 w-5" />Previsão de término do contrato {contract?.NROCONTRATO}</DialogTitle>
        <DialogDescription>A data considera o peso já alocado, o estoque livre e produz somente o saldo ainda descoberto.</DialogDescription>
      </DialogHeader>
      {contract && recommendation ? <div className="min-h-0 space-y-4 overflow-hidden">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-blue-800"><p className="text-[9px] font-black uppercase tracking-wider">Previsão de término</p><p className="mt-1 whitespace-nowrap text-sm font-black">{formatDate(contract.PREVISAO_TERMINO_PRODUCAO)}</p></div>
          <AllocationSummary label="Peso contratado" value={contract.PESO_TOTAL} className="border-[#C8D7E3] bg-[#F5F8FA] text-[#173D6E]" />
          <AllocationSummary label="Peso já alocado" value={contract.PESO_RESERVADO} className="border-emerald-200 bg-emerald-50 text-emerald-800" />
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800"><p className="text-[9px] font-black uppercase tracking-wider">Produto gargalo</p><p className="mt-1 truncate text-sm font-black" title={bottleneck || "Sem gargalo"}>{bottleneck || "Sem gargalo"}</p></div>
        </div>
        <div className="max-h-[55vh] overflow-auto rounded-lg border border-[#D5E0E9]">
          <Table className="min-w-[1180px] table-fixed [&_td]:px-3 [&_th]:px-3">
            <TableHeader className="sticky top-0 z-10 bg-[#EDF3F7]"><TableRow><Header>Produto</Header><Header className="w-[120px] text-right">Contrato</Header><Header className="w-[120px] text-right">Alocado</Header><Header className="w-[130px] text-right">Estoque livre usado</Header><Header className="w-[125px] text-right">A produzir</Header><Header className="w-[100px] text-right">Meta</Header><Header className="w-[125px] text-right">Produção/dia</Header><Header className="w-[90px] text-center">Dias</Header></TableRow></TableHeader>
            <TableBody>{recommendation.PRODUTOS.map((product) => {
              const isBottleneck = product.DESCRICAO === bottleneck;
              return <TableRow key={product.SEQPRODUTO} className={isBottleneck ? "bg-amber-50" : ""}><TableCell><p className="truncate text-xs font-black text-[#173D6E]" title={product.DESCRICAO}>{product.SEQPRODUTO} · {product.DESCRICAO}</p>{isBottleneck && <span className="mt-1 inline-flex rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[9px] font-black uppercase text-amber-800">Maior prazo do contrato</span>}</TableCell><NumberCell value={product.PESOCONTRATO} /><NumberCell value={product.PESO_ATRELADO_TOTAL} /><TableCell className="text-right text-xs font-black text-blue-700">{formatKg(product.PESO_DISPONIVEL_CONSIDERADO)}</TableCell><TableCell className="text-right text-xs font-black text-orange-700">{formatKg(product.FALTANTE_PRODUZIR)}</TableCell><TableCell className="text-right text-xs font-black text-[#304D68]">{Number(product.META_PRODUTO || 0).toLocaleString("pt-BR", { maximumFractionDigits: 3 })}%</TableCell><NumberCell value={product.PRODUCAO_DIA} /><TableCell className="text-center text-xs font-black text-[#173D6E]">{product.DIAS_PRODUCAO ?? "—"}</TableCell></TableRow>;
            })}</TableBody>
          </Table>
        </div>
        <p className="rounded-lg border border-[#D6E1EA] bg-[#F7F9FB] p-3 text-xs leading-5 text-[#536B82]">A previsão termina quando o produto com maior número de dias fica pronto. Produtos totalmente cobertos pelo peso alocado e pelo estoque livre ficam com zero dia de produção.</p>
      </div> : <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">Não foi possível localizar o detalhamento desta previsão. Atualize os dados do painel.</div>}
    </DialogContent>
  </Dialog>;
}

interface ContractDetailsProps {
  contract: ExportContract;
  configured: boolean;
  saving: string | null;
  notes: Record<number, string>;
  setNotes: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  onSaveConfig: (contract: ExportContract, changes: Partial<ExportContract>) => Promise<void>;
}

function ContractDetails({ contract, configured, saving, notes, setNotes, onSaveConfig }: ContractDetailsProps) {
  const [detailProduct, setDetailProduct] = useState<ContractProduct | null>(null);

  return (
    <div className="border-l-4 border-[#315F88] p-4">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div><p className="text-xs font-black uppercase tracking-wider text-[#315F88]">Produtos do contrato</p><p className="mt-1 text-xs text-[#667B90]">{contract.EM_EXPEDICAO ? "Contrato em expedição: a barra considera o peso carregado, enquanto manual e OP permanecem reservados para o saldo pendente." : "Consulta dos pesos contratados, alocados e ainda pendentes. As alocações são feitas na aba Alocação de estoque."}</p></div>
        <div className="flex w-full max-w-xl gap-2"><Textarea value={notes[contract.SEQCONTRATO] ?? contract.OBSERVACAO ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [contract.SEQCONTRATO]: event.target.value }))} placeholder="Observação operacional" className="min-h-16 text-xs" disabled={!configured} /><Button variant="outline" disabled={!configured || saving === `config-${contract.SEQCONTRATO}`} onClick={() => void onSaveConfig(contract, { OBSERVACAO: notes[contract.SEQCONTRATO] ?? contract.OBSERVACAO ?? "" })}>Salvar nota</Button></div>
      </div>
      <div className="overflow-x-auto rounded-md border border-[#D5E0E9]">
        <Table className="w-full min-w-[1100px] table-fixed [&_td]:px-2 [&_th]:px-2">
          <TableHeader className="bg-white"><TableRow><Header className="w-[82px]">Produto</Header><Header>Descrição</Header><Header className="w-[115px] text-right">Peso contrato</Header><Header className="w-[115px] text-right">Disponível ERP</Header><Header className="w-[175px]">Validade do estoque</Header><Header className="w-[145px] text-right">Peso alocado</Header><Header className="w-[115px] text-right">Saldo contrato</Header></TableRow></TableHeader>
          <TableBody>{contract.PRODUTOS.map((product) => {
            const key = `${contract.SEQCONTRATO}-${product.SEQPRODUTO}`;
            return (
              <TableRow key={key} className={reservationCoverageClass(product)}>
                <TableCell className="font-mono text-xs font-black text-[#244B70]">{product.SEQPRODUTO}</TableCell>
                <TableCell><p className="truncate text-xs font-bold text-[#304D68]" title={product.DESCRICAO}>{product.DESCRICAO}</p></TableCell>
                <NumberCell value={product.PESOCONTRATO} />
                <NumberCell value={product.PESO_DISPONIVEL_ERP} />
                <TableCell>{(() => { const validity = validityStatus(product); return <div><span className={`inline-flex rounded-full border px-2 py-1 text-[9px] font-black uppercase ${validity.className}`}>{validity.label}</span><p className="mt-1 whitespace-nowrap text-[9px] font-semibold text-[#667B90]">{formatKg(product.PESO_ESTOQUE_ELEGIVEL)} elegíveis</p></div>; })()}</TableCell>
                <TableCell className="text-right">
                  <button type="button" onClick={() => setDetailProduct(product)} className="ml-auto block rounded-md border border-[#B9CAD8] bg-white/80 px-2 py-1 text-right hover:border-[#315F88] hover:bg-white" title="Ver origem do peso atrelado">
                    <span className="block whitespace-nowrap text-xs font-black text-[#173D6E]">{formatKg(product.PESO_ATRELADO_TOTAL)}</span>
                    {Number(product.PESO_TRANSBORDADO || 0) > 0 && <span className="mt-0.5 block whitespace-nowrap text-[9px] font-black text-red-700">Transbordou {formatKg(product.PESO_TRANSBORDADO)}</span>}
                    {Number(product.PESO_RESERVADO_6_MESES || 0) > 0 && <span className="mt-0.5 block whitespace-nowrap text-[9px] font-black text-amber-700">+6 meses: {formatKg(product.PESO_RESERVADO_6_MESES)}</span>}
                  </button>
                </TableCell>
                <TableCell className="whitespace-nowrap text-right text-sm font-black text-[#173D6E]">{formatKg(product.SALDO_CONTRATO)}</TableCell>
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
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
                <AllocationSummary label={detailProduct.EM_EXPEDICAO ? "Ainda reservado" : "Total atrelado"} value={detailProduct.PESO_ATRELADO_TOTAL} className="border-[#AFC4D6] bg-[#F3F7FA] text-[#173D6E]" />
                <AllocationSummary label="Peso carregado" value={Number(detailProduct.PESO_EXPEDIDO || 0)} className="border-cyan-200 bg-cyan-50 text-cyan-800" />
                <AllocationSummary label="Ordens de produção" value={detailProduct.PESO_ATRELADO_ORDEM} className="border-blue-200 bg-blue-50 text-blue-800" />
                <AllocationSummary label="Reserva do pedido" value={detailProduct.PESO_RESERVADO_PEDIDO || 0} className="border-emerald-200 bg-emerald-50 text-emerald-800" />
                <AllocationSummary label="Bloqueado no ERP" value={detailProduct.PESO_BLOQUEADO_ERP || 0} className="border-red-200 bg-red-50 text-red-800" />
                <AllocationSummary label="Alocação manual" value={detailProduct.PESO_RESERVADO_MANUAL} className="border-amber-200 bg-amber-50 text-amber-800" />
                <AllocationSummary label="Estoque +6 meses" value={detailProduct.PESO_RESERVADO_6_MESES || 0} className="border-orange-200 bg-orange-50 text-orange-800" />
              </div>
              {Number(detailProduct.PESO_SOBREPOSTO_ORDEM_PEDIDO || 0) > 0 && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900">
                  {formatKg(detailProduct.PESO_SOBREPOSTO_ORDEM_PEDIDO)} da reserva do pedido já está coberta pela OP e não foi somada novamente.
                </div>
              )}
              {Number(detailProduct.PESO_TRANSBORDADO || 0) > 0 && (
                <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-3 text-xs font-semibold leading-5 text-red-900">
                  <p className="font-black">Peso acima do contratado: {formatKg(detailProduct.PESO_TRANSBORDADO)}</p>
                  <p>Origens envolvidas: {(detailProduct.ORIGENS_TRANSBORDO || []).map((origin) => origin === "ORDEM_PRODUCAO" ? "ordem de produção" : origin === "RESERVA_PEDIDO" ? "reserva de pedido" : origin === "MAIS_6_MESES" ? "estoque +6 meses" : "manual").join(", ") || "não identificadas"}.</p>
                </div>
              )}
              <div className="max-h-[430px] space-y-2 overflow-y-auto pr-1">
                {detailProduct.DETALHES_ATRELAMENTO.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-[#BCCAD6] p-6 text-center text-sm text-[#6B7F92]">Nenhum peso atrelado a este produto.</div>
                ) : detailProduct.DETALHES_ATRELAMENTO.map((detail, index) => (
                  <div key={`${detail.ORIGEM}-${detail.NUMERO_ORDEM || detail.NROPEDIDO || "manual"}-${index}`} className={`rounded-lg border p-3 ${detail.ORIGEM === "EXPEDICAO" ? "border-cyan-200 bg-cyan-50/60" : detail.ORIGEM === "ORDEM_PRODUCAO" ? "border-blue-200 bg-blue-50/60" : detail.ORIGEM === "RESERVA_PEDIDO" ? "border-emerald-200 bg-emerald-50/60" : "border-amber-200 bg-amber-50/60"}`}>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-2">
                        {detail.ORIGEM === "ORDEM_PRODUCAO" ? <Factory className="h-4 w-4 text-blue-700" /> : <LockKeyhole className={`h-4 w-4 ${detail.ORIGEM === "RESERVA_PEDIDO" ? "text-emerald-700" : "text-amber-700"}`} />}
                        <div><p className="text-xs font-black text-[#173D6E]">{detail.ORIGEM === "EXPEDICAO" || detail.ORIGEM === "RESERVA_PEDIDO" ? `Pedido ${detail.NROPEDIDO || "não informado"}` : detail.ORIGEM === "ORDEM_PRODUCAO" ? `Ordem de produção ${detail.NUMERO_ORDEM}` : detail.ORIGEM === "MAIS_6_MESES" ? "Alocação de estoque +6 meses" : "Alocação manual sem vínculo de ordem"}</p><p className="text-[10px] text-[#6B7F92]">{detail.ORIGEM === "EXPEDICAO" ? `Carga ${detail.NROCARGA || "não informada"} • peso efetivamente expedido` : detail.ORIGEM === "RESERVA_PEDIDO" ? `Reserva no ERP • embarque ${formatDate(detail.DATA_EMBARQUE)}` : detail.ORIGEM === "ORDEM_PRODUCAO" ? `Contrato industrial ${detail.CODCONTRATO} • vínculo protegido` : `Incluído por ${detail.USUARIO || "usuário não informado"}`}</p></div>
                      </div>
                      <p className="whitespace-nowrap text-sm font-black text-[#173D6E]">{formatKg(detail.PESO)}</p>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] text-[#526A80] sm:grid-cols-3">
                      <p><span className="block font-black uppercase">Início produção</span>{formatDate(detail.DATA_INICIO)}</p>
                      <p><span className="block font-black uppercase">Data rendimento</span>{formatDate(detail.DATA_RENDIMENTO)}</p>
                      <p><span className="block font-black uppercase">Origem</span>{detail.ORIGEM === "EXPEDICAO" ? "Expedição no ERP" : detail.ORIGEM === "RESERVA_PEDIDO" ? "Reserva de pedido no ERP" : detail.ORIGEM === "ORDEM_PRODUCAO" ? "Automática pelo ERP" : detail.ORIGEM === "MAIS_6_MESES" ? "Estoque +6 meses" : "Manual no Vértice"}</p>
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

function AllocationSummary({ label, value, className, onClick, title }: { label: string; value: number; className: string; onClick?: () => void; title?: string }) {
  const content = <><p className="text-[9px] font-black uppercase tracking-wider">{label}</p><p className="mt-1 whitespace-nowrap text-sm font-black">{formatKg(value)}</p></>;
  return onClick
    ? <button type="button" onClick={onClick} title={title} className={`rounded-lg border p-3 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${className}`}>{content}</button>
    : <div className={`rounded-lg border p-3 ${className}`}>{content}</div>;
}

function MetricCard({ icon: Icon, label, value }: { icon: typeof FileSignature; label: string; value: string }) {
  return <div className="rounded-lg border border-[#CFDAE4] bg-white p-4 shadow-sm"><div className="flex items-center gap-2 text-[#61778C]"><Icon className="h-4 w-4" /><span className="text-[10px] font-black uppercase tracking-wider">{label}</span></div><p className="mt-2 whitespace-nowrap text-lg font-black text-[#173D6E] sm:text-xl">{value}</p></div>;
}

function Header({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <TableHead className={`whitespace-nowrap text-[10px] font-black uppercase tracking-wider text-[#47627D] ${className}`}>{children}</TableHead>;
}

function SortableTableHead<K extends string>({
  label,
  sortKey,
  sort,
  onSort,
  align = "left",
  className = "",
}: {
  label: string;
  sortKey: K;
  sort: TableSortState<K>;
  onSort: (key: K) => void;
  align?: "left" | "center" | "right";
  className?: string;
}) {
  const active = sort.key === sortKey;
  const Icon = !active ? ArrowUpDown : sort.direction === "asc" ? ArrowUp : ArrowDown;
  const alignment = align === "right" ? "justify-end text-right" : align === "center" ? "justify-center text-center" : "justify-start text-left";
  return <TableHead aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"} className={`whitespace-nowrap p-0 text-[10px] font-black uppercase tracking-wider text-[#47627D] ${className}`}>
    <button type="button" onClick={() => onSort(sortKey)} className={`flex h-full w-full items-center gap-1.5 px-3 py-3 transition-colors hover:bg-[#DDE9F2] hover:text-[#173D6E] ${alignment}`} title={`Ordenar por ${label}`}>
      <span>{label}</span><Icon className={`h-3.5 w-3.5 shrink-0 ${active ? "text-[#173D6E]" : "text-[#8A9BAA]"}`} />
    </button>
  </TableHead>;
}

function CandidateSortButton<K extends string>({ label, sortKey, sort, onSort, align = "left" }: {
  label: string;
  sortKey: K;
  sort: TableSortState<K>;
  onSort: (key: K) => void;
  align?: "left" | "right";
}) {
  const active = sort.key === sortKey;
  const Icon = !active ? ArrowUpDown : sort.direction === "asc" ? ArrowUp : ArrowDown;
  return <button type="button" onClick={() => onSort(sortKey)} className={`flex items-center gap-1 py-2 hover:text-[#173D6E] ${align === "right" ? "justify-end text-right" : "justify-start text-left"}`} title={`Ordenar por ${label}`}>
    <span>{label}</span><Icon className={`h-3 w-3 ${active ? "text-[#173D6E]" : "text-[#8A9BAA]"}`} />
  </button>;
}

function CompactSortableHeader<K extends string>({
  label,
  sortKey,
  activeSort,
  onSort,
  numeric = false,
  className = "",
}: {
  label: string;
  sortKey: K;
  activeSort: { key: K; direction: SortDirection };
  onSort: (key: K) => void;
  numeric?: boolean;
  className?: string;
}) {
  const active = activeSort.key === sortKey;
  const Icon = !active ? ArrowUpDown : activeSort.direction === "asc" ? ArrowUp : ArrowDown;
  return <TableHead aria-sort={active ? (activeSort.direction === "asc" ? "ascending" : "descending") : "none"} className={`whitespace-nowrap p-0 text-[10px] font-black uppercase tracking-wider text-[#47627D] ${className}`}>
    <button type="button" onClick={() => onSort(sortKey)} className={`flex h-full w-full items-center gap-1 px-2.5 py-3 hover:bg-[#DDE9F2] ${numeric ? "justify-end text-right" : "justify-start text-left"}`}>
      <span>{label}</span><Icon className={`h-3.5 w-3.5 shrink-0 ${active ? "text-[#173D6E]" : "text-[#8A9BAA]"}`} />
    </button>
  </TableHead>;
}

function SortableContractHeader({
  label,
  sortKey,
  activeSort,
  onSort,
  numeric = false,
  centered = false,
  className = "",
}: {
  label: string;
  sortKey: ContractSortKey;
  activeSort: { key: ContractSortKey; direction: SortDirection };
  onSort: (key: ContractSortKey) => void;
  numeric?: boolean;
  centered?: boolean;
  className?: string;
}) {
  const active = activeSort.key === sortKey;
  const Icon = !active ? ArrowUpDown : activeSort.direction === "asc" ? ArrowUp : ArrowDown;
  const alignment = centered ? "justify-center text-center" : numeric ? "justify-end text-right" : "justify-start text-left";
  return <TableHead aria-sort={active ? (activeSort.direction === "asc" ? "ascending" : "descending") : "none"} className={`whitespace-nowrap p-0 text-[10px] font-black uppercase tracking-wider text-[#47627D] ${className}`}>
    <button type="button" onClick={() => onSort(sortKey)} className={`flex h-full w-full items-center gap-1.5 px-2 py-3 transition-colors hover:bg-[#DDE9F2] hover:text-[#173D6E] ${alignment}`} title={`Ordenar por ${label}`}>
      <span>{label}</span><Icon className={`h-3.5 w-3.5 shrink-0 ${active ? "text-[#173D6E]" : "text-[#8A9BAA]"}`} />
    </button>
  </TableHead>;
}

function SortableStockHeader({
  label,
  sortKey,
  activeSort,
  onSort,
  numeric = false,
  className = "",
}: {
  label: string;
  sortKey: StockSortKey;
  activeSort: { key: StockSortKey; direction: SortDirection };
  onSort: (key: StockSortKey) => void;
  numeric?: boolean;
  className?: string;
}) {
  const active = activeSort.key === sortKey;
  const Icon = !active ? ArrowUpDown : activeSort.direction === "asc" ? ArrowUp : ArrowDown;
  return (
    <TableHead
      aria-sort={active ? (activeSort.direction === "asc" ? "ascending" : "descending") : "none"}
      className={`whitespace-nowrap p-0 text-[10px] font-black uppercase tracking-wider text-[#47627D] ${className}`}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`flex h-full w-full items-center gap-1.5 px-2 py-3 hover:bg-[#DDE9F2] hover:text-[#173D6E] ${numeric ? "justify-end text-right" : "justify-start text-left"}`}
        title={`Ordenar por ${label}`}
      >
        <span>{label}</span>
        <Icon className={`h-3.5 w-3.5 shrink-0 ${active ? "text-[#173D6E]" : "text-[#8A9BAA]"}`} />
      </button>
    </TableHead>
  );
}

function NumberCell({ value }: { value: number }) {
  return <TableCell className="whitespace-nowrap text-right text-xs font-bold text-[#304D68]">{formatKg(value)}</TableCell>;
}

function Deadline({ days }: { days?: number | null }) {
  if (days == null) return <span className="text-xs font-semibold text-[#8192A2]">Indefinido</span>;
  const className = days < 0 ? "text-red-700" : days <= 7 ? "text-orange-700" : "text-[#405B74]";
  return <span className={`inline-flex items-center gap-1 text-xs font-black ${className}`}><CalendarDays className="h-3.5 w-3.5" />{days < 0 ? `${Math.abs(days)}d atrasado` : days === 0 ? "Hoje" : `${days} dias`}</span>;
}
