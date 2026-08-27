import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Building2,
  CalendarRange,
  CircleDollarSign,
  ClipboardList,
  FilePlus2,
  Loader2,
  Pencil,
  Plus,
  Save,
  Search,
  Sparkles,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { fetchHistoricoCompras, fetchUsuarios } from "@/services/api";
import type { ApiHistoricoCompra, ApiUsuario } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  buscarPedidoErpEscala,
  consultarEscala,
  criarEscala,
  criarRegistroManualEscala,
  criarVinculoPedidoEscala,
  editarEscala,
  editarRegistroManualEscala,
  editarVinculoPedidoEscala,
  inativarEscala,
  inativarRegistroManualEscala,
  inativarVinculoPedidoEscala,
} from "@/services/escala";
import type {
  AgrotoolsAnaliseStatus,
  EscalaLinha,
  EscalaPedidoErp,
  EscalaStatus,
  EscalaTurno,
} from "@/types/escala";
import {
  getAnimalBasePrice,
  getEffectivePremium,
} from "@/lib/escala-pricing";

const today = new Date().toISOString().split("T")[0];

const numberFormat = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 0,
});

const currencyFormat = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const percentFormat = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});
const getEmpresaLogada = (user: unknown) => {
  const userCompany = Number(
    (user as { nroempresa?: number } | null)?.nroempresa,
  );

  if (Number.isFinite(userCompany) && userCompany > 0) {
    return userCompany;
  }

  const storedCompany = Number(localStorage.getItem("empresa_logada"));
  return Number.isFinite(storedCompany) && storedCompany > 0
    ? storedCompany
    : 1;
};

const normalizeText = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toUpperCase();

const toNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toNullableNumber = (value: string | number | null | undefined) => {
  if (value === null || value === undefined || String(value).trim() === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  const normalized = value.split("T")[0];
  const [year, month, day] = normalized.split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Date(year, month - 1, day, 12, 0, 0).toLocaleDateString("pt-BR");
};

const getOrderNumber = (row: EscalaLinha | EscalaPedidoErp) =>
  toNumber(row.NROPEDIDO || (row as EscalaLinha).NROPEDIDO_SNAPSHOT);

const getOrderTotal = (row: EscalaLinha | EscalaPedidoErp) => {
  const total = toNumber(row.QTD_PEDIDA_TOTAL);
  return total > 0 ? total : toNumber(row.QTD_VACA) + toNumber(row.QTD_BOI);
};

const getOrderProperty = (row: EscalaLinha | EscalaPedidoErp) => {
  const city = [row.CIDADE_PROPRIEDADE, row.UF_PROPRIEDADE]
    .filter(Boolean)
    .join("/");
  return [row.DESC_PROPRIEDADE, city].filter(Boolean).join(" • ") || "—";
};

const agrotoolsClass: Record<AgrotoolsAnaliseStatus, string> = {
  PENDENTE: "border-slate-200 bg-slate-100 text-slate-700",
  EM_ANALISE: "border-blue-200 bg-blue-50 text-blue-700",
  APTO: "border-emerald-200 bg-emerald-50 text-emerald-700",
  APTO_COM_RESSALVAS: "border-amber-200 bg-amber-50 text-amber-700",
  INAPTO: "border-red-200 bg-red-50 text-red-700",
  ERRO: "border-rose-200 bg-rose-50 text-rose-700",
};

const agrotoolsLabel: Record<AgrotoolsAnaliseStatus, string> = {
  PENDENTE: "Pendente",
  EM_ANALISE: "Em análise",
  APTO: "Apto",
  APTO_COM_RESSALVAS: "Apto com ressalvas",
  INAPTO: "Inapto",
  ERRO: "Erro",
};

type ModalMode =
  | "insert-order"
  | "edit-order"
  | "insert-manual"
  | "edit-manual"
  | null;

interface InsertOrderForm {
  nro_pedido: string;
  seqpedido: number | null;
  observacao: string;
}

interface EditOrderForm {
  id_escala_pedido_vinculo: number;
  versao: number;
  nro_pedido: number;
  id_comprador: number | null;
  comprador_nome_snapshot: string;
  observacao: string;
  vlrunitario_premio: string;
  prazo_dias: string;
  curral: string;
  arrobas_vaca: string;
  arrobas_boi: string;
  qtd_china_vaca: string;
  qtd_china_boi: string;
  qtd_agrotools_vaca: string;
  qtd_agrotools_boi: string;
  status_agrotools_analise: AgrotoolsAnaliseStatus;
  id_analise_agrotools: string;
  ordem_exibicao: string;
}

interface ManualForm {
  id_escala_item_manual: number;
  versao: number;
  nome_produtor: string;
  nome_fazenda: string;
  municipio: string;
  uf: string;
  id_comprador: number | null;
  comprador_nome_snapshot: string;
  qtd_vaca: string;
  qtd_boi: string;
  arrobas_vaca: string;
  arrobas_boi: string;
  vlrunitario_vaca: string;
  vlrunitario_boi: string;
  vlrunitario_premio: string;
  prazo_dias: string;
  curral: string;
  qtd_china_vaca: string;
  qtd_china_boi: string;
  qtd_agrotools_vaca: string;
  qtd_agrotools_boi: string;
  status_agrotools_analise: AgrotoolsAnaliseStatus;
  id_analise_agrotools: string;
  observacao: string;
  ordem_exibicao: string;
}

interface ChinaEditSuggestion {
  suggestedQuantity: number;
  chinaAnimals: number;
  totalAnimals: number;
  chinaPercent: number;
  periodLabel: string;
}

const emptyInsertOrderForm = (): InsertOrderForm => ({
  nro_pedido: "",
  seqpedido: null,
  observacao: "",
});

const emptyEditOrderForm = (): EditOrderForm => ({
  id_escala_pedido_vinculo: 0,
  versao: 1,
  nro_pedido: 0,
  id_comprador: null,
  comprador_nome_snapshot: "",
  observacao: "",
  vlrunitario_premio: "",
  prazo_dias: "2",
  curral: "",
  arrobas_vaca: "",
  arrobas_boi: "",
  qtd_china_vaca: "",
  qtd_china_boi: "",
  qtd_agrotools_vaca: "",
  qtd_agrotools_boi: "",
  status_agrotools_analise: "PENDENTE",
  id_analise_agrotools: "",
  ordem_exibicao: "0",
});

const emptyManualForm = (): ManualForm => ({
  id_escala_item_manual: 0,
  versao: 1,
  nome_produtor: "",
  nome_fazenda: "",
  municipio: "",
  uf: "GO",
  id_comprador: null,
  comprador_nome_snapshot: "",
  qtd_vaca: "0",
  qtd_boi: "0",
  arrobas_vaca: "14",
  arrobas_boi: "20",
  vlrunitario_vaca: "",
  vlrunitario_boi: "",
  vlrunitario_premio: "",
  prazo_dias: "2",
  curral: "",
  qtd_china_vaca: "0",
  qtd_china_boi: "0",
  qtd_agrotools_vaca: "0",
  qtd_agrotools_boi: "0",
  status_agrotools_analise: "PENDENTE",
  id_analise_agrotools: "",
  observacao: "",
  ordem_exibicao: "0",
});

const getMonthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const getTwelveMonthPeriod = () => {
  const todayDate = new Date();
  const startDate = new Date(
    todayDate.getFullYear(),
    todayDate.getMonth() - 11,
    1,
    12,
  );

  return {
    startMonth: getMonthKey(startDate),
    endMonth: getMonthKey(todayDate),
    label: "12 meses",
  };
};

const buildChinaEditSuggestion = (
  row: EscalaLinha | undefined,
  sex: "VACA" | "BOI",
  history: ApiHistoricoCompra[],
): ChinaEditSuggestion | null => {
  const producerId = toNumber(row?.SEQPRODUTOR);
  const quantity =
    sex === "VACA" ? toNumber(row?.QTD_VACA) : toNumber(row?.QTD_BOI);

  if (!row || producerId <= 0 || quantity <= 0) {
    return null;
  }

  const period = getTwelveMonthPeriod();
  const relevantHistory = history.filter(
    (entry) =>
      Number(entry.COD_PRODUTOR) === producerId &&
      entry.MES_ANO >= period.startMonth &&
      entry.MES_ANO <= period.endMonth,
  );

  const chinaAnimals = relevantHistory.reduce(
    (total, entry) => total + toNumber(entry.QTD_CHINA),
    0,
  );
  const nonChinaAnimals = relevantHistory.reduce(
    (total, entry) => total + toNumber(entry.QTD_NAO_CHINA),
    0,
  );
  const totalAnimals = chinaAnimals + nonChinaAnimals;

  if (totalAnimals <= 0) {
    return null;
  }

  const chinaPercent = chinaAnimals / totalAnimals;

  return {
    suggestedQuantity: Math.max(
      0,
      Math.min(quantity, Math.round(quantity * chinaPercent)),
    ),
    chinaAnimals,
    totalAnimals,
    chinaPercent,
    periodLabel: period.label,
  };
};

export default function EscalaGerenciador() {
  const { idEscala } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const nroempresa = getEmpresaLogada(user);
  const scaleId = idEscala ? Number(idEscala) : null;
  const includePendingOnCreate =
    !scaleId && searchParams.get("incluirPendentes") === "1";
  const requestedFocusField = searchParams.get("foco") || "";
  const returnToScaleAfterSave =
    searchParams.get("voltarEscala") === "1";

  const [loading, setLoading] = useState(Boolean(scaleId));
  const [savingScale, setSavingScale] = useState(false);
  const [savingRecord, setSavingRecord] = useState(false);
  const [searchingOrder, setSearchingOrder] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [autoHandled, setAutoHandled] = useState("");
  const [focusHandled, setFocusHandled] = useState("");

  const [lines, setLines] = useState<EscalaLinha[]>([]);
  const [buyers, setBuyers] = useState<ApiUsuario[]>([]);
  const [historicoCompras, setHistoricoCompras] = useState<ApiHistoricoCompra[]>(
    [],
  );
  const [loadingBuyers, setLoadingBuyers] = useState(false);
  const [buyerSearch, setBuyerSearch] = useState("");
  const [buyerOpen, setBuyerOpen] = useState(false);

  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [insertOrderForm, setInsertOrderForm] = useState<InsertOrderForm>(
    emptyInsertOrderForm(),
  );
  const [orderResults, setOrderResults] = useState<EscalaPedidoErp[]>([]);
  const [editOrderForm, setEditOrderForm] = useState<EditOrderForm>(
    emptyEditOrderForm(),
  );
  const [manualForm, setManualForm] = useState<ManualForm>(emptyManualForm());

  const [scaleForm, setScaleForm] = useState({
    data_abate: searchParams.get("data") || today,
    turno: "UNICO" as EscalaTurno,
    meta_cabecas: 480,
    status_escala: "ABERTA" as EscalaStatus,
    observacao_geral: "",
    versao: 1,
  });

  const records = useMemo(() => {
    const map = new Map<string, EscalaLinha>();
    for (const row of lines) map.set(row.ID_PLANEJAMENTO, row);
    return Array.from(map.values()).sort((a, b) => {
      const orderA = toNumber(a.ORDEM_EXIBICAO);
      const orderB = toNumber(b.ORDEM_EXIBICAO);
      if (orderA !== orderB) return orderA - orderB;
      return toNumber(a.NROPEDIDO) - toNumber(b.NROPEDIDO);
    });
  }, [lines]);

  const pendingOrders = useMemo(
    () =>
      records.filter(
        (row) =>
          row.ORIGEM_REGISTRO === "ERP" &&
          !toNumber(row.ID_ESCALA_PEDIDO_VINCULO),
      ),
    [records],
  );

  const linkedOrders = useMemo(
    () =>
      records.filter(
        (row) =>
          row.ORIGEM_REGISTRO === "ERP" &&
          toNumber(row.ID_ESCALA_PEDIDO_VINCULO) > 0,
      ),
    [records],
  );

  const manualRecords = useMemo(
    () => records.filter((row) => row.ORIGEM_REGISTRO === "MANUAL"),
    [records],
  );

  const buyerSuggestions = useMemo(() => {
    if (!buyerOpen) return [];
    const term = normalizeText(buyerSearch);

    return buyers
      .filter((buyer) => {
        if (!term) return true;
        return (
          normalizeText(buyer.CODUSUARIO).includes(term) ||
          String(buyer.SEQUSUARIO).includes(term)
        );
      })
      .slice(0, 30);
  }, [buyerOpen, buyerSearch, buyers]);

  const editingOrderRow = useMemo(
    () =>
      linkedOrders.find(
        (row) =>
          toNumber(row.ID_ESCALA_PEDIDO_VINCULO) ===
          editOrderForm.id_escala_pedido_vinculo,
      ),
    [editOrderForm.id_escala_pedido_vinculo, linkedOrders],
  );

  const chinaSuggestionVaca = useMemo(
    () => buildChinaEditSuggestion(editingOrderRow, "VACA", historicoCompras),
    [editingOrderRow, historicoCompras],
  );
  const chinaSuggestionBoi = useMemo(
    () => buildChinaEditSuggestion(editingOrderRow, "BOI", historicoCompras),
    [editingOrderRow, historicoCompras],
  );

  const showChinaVacaSuggestion =
    Boolean(chinaSuggestionVaca) &&
    toNumber(editOrderForm.qtd_china_vaca) !==
      chinaSuggestionVaca?.suggestedQuantity;
  const showChinaBoiSuggestion =
    Boolean(chinaSuggestionBoi) &&
    toNumber(editOrderForm.qtd_china_boi) !== chinaSuggestionBoi?.suggestedQuantity;

  const loadScale = async () => {
    if (!scaleId) return;
    setLoading(true);

    try {
      const data = await consultarEscala({
        nroempresa,
        id_escala: scaleId,
      });

      const safe = Array.isArray(data) ? data : [];
      setLines(safe);

      const first = safe[0];
      if (first) {
        setScaleForm({
          data_abate: first.DATA_ABATE?.split("T")[0] || today,
          turno: first.TURNO || "UNICO",
          meta_cabecas: toNumber(first.META_CABECAS),
          status_escala: first.STATUS_ESCALA || "ABERTA",
          observacao_geral: first.OBSERVACAO_GERAL || "",
          versao: toNumber(first.VERSAO_ESCALA) || 1,
        });
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao carregar a escala.",
      );
      setLines([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadScale();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scaleId, nroempresa]);

  useEffect(() => {
    let cancelled = false;

    const loadBuyers = async () => {
      setLoadingBuyers(true);
      try {
        const data = await fetchUsuarios();
        const safe = (Array.isArray(data) ? data : [])
          .filter(
            (buyer) =>
              Number(buyer.SEQUSUARIO) > 0 && normalizeText(buyer.CODUSUARIO),
          )
          .sort((a, b) =>
            normalizeText(a.CODUSUARIO).localeCompare(
              normalizeText(b.CODUSUARIO),
              "pt-BR",
            ),
          );
        if (!cancelled) setBuyers(safe);
      } catch {
        if (!cancelled) setBuyers([]);
      } finally {
        if (!cancelled) setLoadingBuyers(false);
      }
    };

    void loadBuyers();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadHistory = async () => {
      try {
        const data = await fetchHistoricoCompras();
        if (!cancelled) {
          setHistoricoCompras(Array.isArray(data) ? data : []);
        }
      } catch {
        if (!cancelled) {
          setHistoricoCompras([]);
        }
      }
    };

    void loadHistory();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!modalMode) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [modalMode]);

  const focusModalField = (field: string) => {
    window.setTimeout(() => {
      const safeField = field.replace(/[^a-zA-Z0-9_-]/g, "");
      const element = document.querySelector<HTMLElement>(
        `[data-focus-field="${safeField}"]`,
      );

      if (!element) return;

      element.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      element.focus({ preventScroll: true });
      element.animate(
        [
          { boxShadow: "0 0 0 0 rgba(245, 158, 11, 0)" },
          { boxShadow: "0 0 0 4px rgba(245, 158, 11, 0.35)" },
          { boxShadow: "0 0 0 0 rgba(245, 158, 11, 0)" },
        ],
        {
          duration: 1200,
          easing: "ease-out",
        },
      );
    }, 120);
  };

  const showChinaSuggestionDetails = (
    suggestion: ChinaEditSuggestion | null,
    sexLabel: string,
    quantity: number,
  ) => {
    if (!suggestion) return;

    toast.info(
      `Nos últimos ${suggestion.periodLabel}, esse produtor matou ${numberFormat.format(
        suggestion.totalAnimals,
      )} animais. Destes, ${numberFormat.format(
        suggestion.chinaAnimals,
      )} foram China, gerando ${percentFormat.format(
        suggestion.chinaPercent * 100,
      )}%. Para ${numberFormat.format(quantity)} ${sexLabel.toLowerCase()}, a sugestão fica em ${numberFormat.format(
        suggestion.suggestedQuantity,
      )}.`,
      {
        duration: 7000,
      },
    );
  };

  useEffect(() => {
    if (!modalMode || !requestedFocusField) return;

    const key = `${modalMode}-${requestedFocusField}`;
    if (focusHandled === key) return;

    setFocusHandled(key);
    focusModalField(requestedFocusField);
  }, [
    focusHandled,
    modalMode,
    requestedFocusField,
  ]);

  const closeModal = () => {
    setModalMode(null);
    setInsertOrderForm(emptyInsertOrderForm());
    setEditOrderForm(emptyEditOrderForm());
    setManualForm(emptyManualForm());
    setOrderResults([]);
    setBuyerSearch("");
    setBuyerOpen(false);
  };

  const finishRecordSave = async () => {
    if (returnToScaleAfterSave) {
      navigate(-1);
      return;
    }

    closeModal();
    await loadScale();
  };

  const openInsertOrderModal = (row?: EscalaLinha) => {
    setInsertOrderForm({
      nro_pedido: row?.NROPEDIDO ? String(row.NROPEDIDO) : "",
      seqpedido: row?.SEQPEDIDO ? Number(row.SEQPEDIDO) : null,
      observacao: "",
    });
    setOrderResults([]);
    setModalMode("insert-order");
  };

  const openEditOrderModal = (row: EscalaLinha) => {
    const id = toNumber(row.ID_ESCALA_PEDIDO_VINCULO);
    if (!id) return;

    const buyerName = row.COMPRADOR_ESCALA || "";
    setEditOrderForm({
      id_escala_pedido_vinculo: id,
      versao: toNumber(row.VERSAO_REGISTRO || row.VERSAO_VINCULO) || 1,
      nro_pedido: toNumber(row.NROPEDIDO),
      id_comprador: toNumber(row.ID_COMPRADOR_ESCALA) || null,
      comprador_nome_snapshot: buyerName,
      observacao: row.OBSERVACAO_REGISTRO || "",
      vlrunitario_premio:
        getEffectivePremium(row) === null
          ? ""
          : String(getEffectivePremium(row)),
      prazo_dias:
        row.PRAZO_DIAS === null || row.PRAZO_DIAS === undefined
          ? "2"
          : String(row.PRAZO_DIAS),
      curral: row.CURRAL == null ? "" : String(row.CURRAL),
      arrobas_vaca:
        row.ARROBAS_VACA === null || row.ARROBAS_VACA === undefined
          ? ""
          : String(row.ARROBAS_VACA),
      arrobas_boi:
        row.ARROBAS_BOI === null || row.ARROBAS_BOI === undefined
          ? ""
          : String(row.ARROBAS_BOI),
      qtd_china_vaca:
        row.QTD_CHINA_VACA === null || row.QTD_CHINA_VACA === undefined
          ? ""
          : String(row.QTD_CHINA_VACA),
      qtd_china_boi:
        row.QTD_CHINA_BOI === null || row.QTD_CHINA_BOI === undefined
          ? ""
          : String(row.QTD_CHINA_BOI),
      qtd_agrotools_vaca:
        row.QTD_AGROTOOLS_VACA === null ||
        row.QTD_AGROTOOLS_VACA === undefined
          ? ""
          : String(row.QTD_AGROTOOLS_VACA),
      qtd_agrotools_boi:
        row.QTD_AGROTOOLS_BOI === null ||
        row.QTD_AGROTOOLS_BOI === undefined
          ? ""
          : String(row.QTD_AGROTOOLS_BOI),
      status_agrotools_analise:
        row.STATUS_AGROTOOLS_ANALISE || "PENDENTE",
      id_analise_agrotools: row.ID_ANALISE_AGROTOOLS || "",
      ordem_exibicao: String(toNumber(row.ORDEM_EXIBICAO)),
    });
    setBuyerSearch(buyerName);
    setModalMode("edit-order");
  };

  const openInsertManualModal = () => {
    setManualForm({
      ...emptyManualForm(),
      ordem_exibicao: String(records.length + 1),
    });
    setModalMode("insert-manual");
  };

  const openEditManualModal = (row: EscalaLinha) => {
    const id = toNumber(row.ID_ESCALA_ITEM_MANUAL);
    if (!id) return;

    const buyerName = row.COMPRADOR_ESCALA || "";
    setManualForm({
      id_escala_item_manual: id,
      versao: toNumber(row.VERSAO_REGISTRO) || 1,
      nome_produtor: row.PRODUTOR || "",
      nome_fazenda: row.DESC_PROPRIEDADE || "",
      municipio: row.CIDADE_PROPRIEDADE || "",
      uf: row.UF_PROPRIEDADE || "GO",
      id_comprador: toNumber(row.ID_COMPRADOR_ESCALA) || null,
      comprador_nome_snapshot: buyerName,
      qtd_vaca: String(toNumber(row.QTD_VACA)),
      qtd_boi: String(toNumber(row.QTD_BOI)),
      arrobas_vaca: row.ARROBAS_VACA == null ? "" : String(row.ARROBAS_VACA),
      arrobas_boi: row.ARROBAS_BOI == null ? "" : String(row.ARROBAS_BOI),
      vlrunitario_vaca:
        getAnimalBasePrice(row, "VACA") == null
          ? ""
          : String(getAnimalBasePrice(row, "VACA")),
      vlrunitario_boi:
        getAnimalBasePrice(row, "BOI") == null
          ? ""
          : String(getAnimalBasePrice(row, "BOI")),
      vlrunitario_premio:
        getEffectivePremium(row) === null
          ? ""
          : String(getEffectivePremium(row)),
      prazo_dias:
        row.PRAZO_DIAS == null ? "2" : String(row.PRAZO_DIAS),
      curral: row.CURRAL == null ? "" : String(row.CURRAL),
      qtd_china_vaca: String(toNumber(row.QTD_CHINA_VACA)),
      qtd_china_boi: String(toNumber(row.QTD_CHINA_BOI)),
      qtd_agrotools_vaca: String(toNumber(row.QTD_AGROTOOLS_VACA)),
      qtd_agrotools_boi: String(toNumber(row.QTD_AGROTOOLS_BOI)),
      status_agrotools_analise:
        row.STATUS_AGROTOOLS_ANALISE || "PENDENTE",
      id_analise_agrotools: row.ID_ANALISE_AGROTOOLS || "",
      observacao: row.OBSERVACAO_REGISTRO || "",
      ordem_exibicao: String(toNumber(row.ORDEM_EXIBICAO)),
    });
    setBuyerSearch(buyerName);
    setModalMode("edit-manual");
  };

  useEffect(() => {
    if (!scaleId || loading || autoHandled) return;

    const editarPedido = Number(searchParams.get("editarPedido"));
    const editarManual = Number(searchParams.get("editarManual"));
    const novoManual = searchParams.get("novoManual") === "1";
    const novoPedido = searchParams.get("novoPedido") === "1";

    if (Number.isFinite(editarPedido) && editarPedido > 0) {
      const row = linkedOrders.find(
        (item) =>
          toNumber(item.ID_ESCALA_PEDIDO_VINCULO) === editarPedido,
      );
      if (row) {
        setAutoHandled(`PEDIDO-${editarPedido}`);
        openEditOrderModal(row);
      }
      return;
    }

    if (Number.isFinite(editarManual) && editarManual > 0) {
      const row = manualRecords.find(
        (item) => toNumber(item.ID_ESCALA_ITEM_MANUAL) === editarManual,
      );
      if (row) {
        setAutoHandled(`MANUAL-${editarManual}`);
        openEditManualModal(row);
      }
      return;
    }

    if (novoManual) {
      setAutoHandled("NOVO-MANUAL");
      openInsertManualModal();
      return;
    }

    if (novoPedido) {
      const nroPedido = Number(searchParams.get("nroPedido"));
      const seqPedido = Number(searchParams.get("seqPedido"));
      const row = pendingOrders.find(
        (item) =>
          (!nroPedido || toNumber(item.NROPEDIDO) === nroPedido) &&
          (!seqPedido || toNumber(item.SEQPEDIDO) === seqPedido),
      );
      setAutoHandled(`NOVO-PEDIDO-${nroPedido || 0}-${seqPedido || 0}`);
      openInsertOrderModal(row);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    autoHandled,
    linkedOrders,
    loading,
    manualRecords,
    pendingOrders,
    scaleId,
    searchParams,
  ]);

  const selectBuyer = (buyer: ApiUsuario) => {
    const id = Number(buyer.SEQUSUARIO);
    const name = normalizeText(buyer.CODUSUARIO);

    if (modalMode === "edit-order") {
      setEditOrderForm((current) => ({
        ...current,
        id_comprador: id,
        comprador_nome_snapshot: name,
      }));
    } else if (modalMode === "insert-manual" || modalMode === "edit-manual") {
      setManualForm((current) => ({
        ...current,
        id_comprador: id,
        comprador_nome_snapshot: name,
      }));
    }

    setBuyerSearch(name);
    setBuyerOpen(false);
  };

  const clearBuyer = () => {
    if (modalMode === "edit-order") {
      setEditOrderForm((current) => ({
        ...current,
        id_comprador: null,
        comprador_nome_snapshot: "",
      }));
    } else {
      setManualForm((current) => ({
        ...current,
        id_comprador: null,
        comprador_nome_snapshot: "",
      }));
    }

    setBuyerSearch("");
    setBuyerOpen(false);
  };

  const searchOrder = async () => {
    const orderNumber = Number(insertOrderForm.nro_pedido);
    if (!Number.isFinite(orderNumber) || orderNumber <= 0) {
      toast.warning("Informe um número de pedido válido.");
      return [] as EscalaPedidoErp[];
    }

    setSearchingOrder(true);
    try {
      const data = await buscarPedidoErpEscala({
        nroempresa,
        nro_pedido: orderNumber,
      });
      const results = Array.isArray(data) ? data : [];
      setOrderResults(results);

      if (results.length === 1) {
        setInsertOrderForm((current) => ({
          ...current,
          seqpedido: results[0].SEQPEDIDO,
        }));
      } else if (results.length === 0) {
        toast.warning("Pedido não encontrado.");
      } else {
        toast.warning("Há mais de um SEQPEDIDO. Selecione o registro correto.");
      }

      return results;
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao buscar o pedido.",
      );
      setOrderResults([]);
      return [] as EscalaPedidoErp[];
    } finally {
      setSearchingOrder(false);
    }
  };

  const handleSaveScale = async () => {
    if (!scaleForm.data_abate || Number(scaleForm.meta_cabecas) < 0) {
      toast.warning("Confira a data e a meta da escala.");
      return;
    }

    setSavingScale(true);
    try {
      if (scaleId) {
        const result = await editarEscala({
          id_escala: scaleId,
          nroempresa,
          data_abate: scaleForm.data_abate,
          turno: scaleForm.turno,
          meta_cabecas: Number(scaleForm.meta_cabecas),
          status_escala: scaleForm.status_escala,
          observacao_geral: scaleForm.observacao_geral.trim() || null,
          versao: scaleForm.versao,
        });
        toast.success(result.message || "Escala atualizada.");
        await loadScale();
      } else {
        const result = await criarEscala({
          nroempresa,
          data_abate: scaleForm.data_abate,
          turno: scaleForm.turno,
          meta_cabecas: Number(scaleForm.meta_cabecas),
          status_escala: scaleForm.status_escala,
          observacao_geral: scaleForm.observacao_geral.trim() || null,
          incluir_pedidos_pendentes: includePendingOnCreate,
        });
        toast.success(
          result.message ||
            (includePendingOnCreate
              ? "Escala criada e pedidos pendentes incluídos."
              : "Escala criada."),
        );
        navigate("/escala");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao salvar a escala.",
      );
    } finally {
      setSavingScale(false);
    }
  };

  const handleInactivateScale = async () => {
    if (!scaleId) return;
    if (!window.confirm("Inativar esta escala e seus registros ativos?")) return;

    try {
      const result = await inativarEscala({
        id_escala: scaleId,
        nroempresa,
        versao: scaleForm.versao,
      });
      toast.success(result.message || "Escala inativada.");
      navigate("/escala");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao inativar a escala.",
      );
    }
  };

  const handleCreateLink = async () => {
    if (!scaleId) return;

    const orderNumber = Number(insertOrderForm.nro_pedido);
    if (!Number.isFinite(orderNumber) || orderNumber <= 0) {
      toast.warning("Informe o número do pedido.");
      return;
    }

    setSavingRecord(true);
    try {
      let seqpedido = insertOrderForm.seqpedido;
      if (!seqpedido) {
        const results = await searchOrder();
        if (results.length !== 1) return;
        seqpedido = results[0].SEQPEDIDO;
      }

      const result = await criarVinculoPedidoEscala({
        id_escala: scaleId,
        nroempresa,
        nro_pedido: orderNumber,
        seqpedido,
        observacao: insertOrderForm.observacao.trim() || null,
        ordem_exibicao: linkedOrders.length + manualRecords.length + 1,
      });

      toast.success(result.message || "Pedido incluído na escala.");
      await finishRecordSave();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao incluir o pedido.",
      );
    } finally {
      setSavingRecord(false);
    }
  };

  const handleEditOrder = async () => {
    const premium = toNullableNumber(editOrderForm.vlrunitario_premio);
    const prazoDias = toNullableNumber(editOrderForm.prazo_dias);
    const editingRow = linkedOrders.find(
      (row) =>
        toNumber(row.ID_ESCALA_PEDIDO_VINCULO) ===
        editOrderForm.id_escala_pedido_vinculo,
    );

    if (!editOrderForm.id_comprador) {
      toast.warning("Informe o comprador responsável.");
      focusModalField("comprador");
      return;
    }

    if (premium !== null && premium < 0) {
      toast.warning("O prêmio unitário não pode ser negativo.");
      focusModalField("vlrunitario_premio");
      return;
    }

    if (
      prazoDias === null ||
      prazoDias < 0 ||
      !Number.isInteger(prazoDias)
    ) {
      toast.warning("Informe um prazo inteiro maior ou igual a zero.");
      focusModalField("prazo_dias");
      return;
    }

    const curral = toNullableNumber(editOrderForm.curral);
    if (curral === null || curral < 0 || !Number.isInteger(curral)) {
      toast.warning("Informe o curral com um número inteiro maior ou igual a zero.");
      focusModalField("curral");
      return;
    }

    if (
      toNumber(editingRow?.QTD_VACA) > 0 &&
      (toNullableNumber(editOrderForm.arrobas_vaca) ?? 0) <= 0
    ) {
      toast.warning("Informe o peso em arrobas das vacas.");
      focusModalField("arrobas_vaca");
      return;
    }

    if (
      toNumber(editingRow?.QTD_BOI) > 0 &&
      (toNullableNumber(editOrderForm.arrobas_boi) ?? 0) <= 0
    ) {
      toast.warning("Informe o peso em arrobas dos bois.");
      focusModalField("arrobas_boi");
      return;
    }

    const order = toNumber(editOrderForm.ordem_exibicao);

    setSavingRecord(true);
    try {
      const result = await editarVinculoPedidoEscala({
        id_escala_pedido_vinculo:
          editOrderForm.id_escala_pedido_vinculo,
        nroempresa,
        versao: editOrderForm.versao,
        id_comprador: editOrderForm.id_comprador,
        comprador_nome_snapshot:
          normalizeText(editOrderForm.comprador_nome_snapshot) || null,
        observacao: editOrderForm.observacao.trim() || null,
        vlrunitario_premio: premium,
        prazo_dias: toNullableNumber(editOrderForm.prazo_dias),
        curral,
        arrobas_vaca: toNullableNumber(editOrderForm.arrobas_vaca),
        arrobas_boi: toNullableNumber(editOrderForm.arrobas_boi),
        qtd_china_vaca: toNullableNumber(editOrderForm.qtd_china_vaca),
        qtd_china_boi: toNullableNumber(editOrderForm.qtd_china_boi),
        qtd_agrotools_vaca: toNullableNumber(
          editOrderForm.qtd_agrotools_vaca,
        ),
        qtd_agrotools_boi: toNullableNumber(
          editOrderForm.qtd_agrotools_boi,
        ),
        status_agrotools_analise:
          editOrderForm.status_agrotools_analise,
        id_analise_agrotools:
          editOrderForm.id_analise_agrotools.trim() || null,
        ordem_exibicao: order,
      });

      toast.success(result.message || "Informações do pedido atualizadas.");
      await finishRecordSave();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao editar o pedido.",
      );
    } finally {
      setSavingRecord(false);
    }
  };

  const validateManualForm = () => {
    if (!normalizeText(manualForm.nome_produtor)) {
      toast.warning("Informe o nome do produtor.");
      focusModalField("nome_produtor");
      return false;
    }

    if (!manualForm.id_comprador) {
      toast.warning("Informe o comprador responsável.");
      focusModalField("comprador");
      return false;
    }

    const qtdVaca = toNumber(manualForm.qtd_vaca);
    const qtdBoi = toNumber(manualForm.qtd_boi);

    if (qtdVaca + qtdBoi <= 0) {
      toast.warning("Informe ao menos uma quantidade de animais.");
      focusModalField("qtd_boi");
      return false;
    }

    if (qtdVaca > 0) {
      if ((toNullableNumber(manualForm.arrobas_vaca) ?? 0) <= 0) {
        toast.warning("Informe o peso em arrobas das vacas.");
        focusModalField("arrobas_vaca");
        return false;
      }

      if ((toNullableNumber(manualForm.vlrunitario_vaca) ?? 0) <= 0) {
        toast.warning("Informe o valor unitário das vacas.");
        focusModalField("vlrunitario_vaca");
        return false;
      }
    }

    if (qtdBoi > 0) {
      if ((toNullableNumber(manualForm.arrobas_boi) ?? 0) <= 0) {
        toast.warning("Informe o peso em arrobas dos bois.");
        focusModalField("arrobas_boi");
        return false;
      }

      if ((toNullableNumber(manualForm.vlrunitario_boi) ?? 0) <= 0) {
        toast.warning("Informe o valor unitário dos bois.");
        focusModalField("vlrunitario_boi");
        return false;
      }
    }

    const premium = toNullableNumber(manualForm.vlrunitario_premio);
    if (premium !== null && premium < 0) {
      toast.warning("O prêmio unitário não pode ser negativo.");
      focusModalField("vlrunitario_premio");
      return false;
    }

    const prazoDias = toNullableNumber(manualForm.prazo_dias);
    if (
      prazoDias === null ||
      prazoDias < 0 ||
      !Number.isInteger(prazoDias)
    ) {
      toast.warning("Informe um prazo inteiro maior ou igual a zero.");
      focusModalField("prazo_dias");
      return false;
    }

    const curral = toNullableNumber(manualForm.curral);
    if (curral === null || curral < 0 || !Number.isInteger(curral)) {
      toast.warning("Informe o curral com um número inteiro maior ou igual a zero.");
      focusModalField("curral");
      return false;
    }

    const validations = [
      [toNumber(manualForm.qtd_china_vaca), qtdVaca, "China de vacas"],
      [toNumber(manualForm.qtd_china_boi), qtdBoi, "China de bois"],
      [toNumber(manualForm.qtd_agrotools_vaca), qtdVaca, "Agrotools de vacas"],
      [toNumber(manualForm.qtd_agrotools_boi), qtdBoi, "Agrotools de bois"],
    ] as const;

    for (const [value, maximum, label] of validations) {
      if (value < 0 || value > maximum) {
        toast.warning(`${label} não pode superar a quantidade do sexo.`);
        return false;
      }
    }

    return true;
  };

  const handleSaveManual = async () => {
    if (!scaleId || !validateManualForm()) return;

    const curral = toNullableNumber(manualForm.curral);
    const payload = {
      nroempresa,
      id_escala: scaleId,
      nome_produtor: normalizeText(manualForm.nome_produtor),
      nome_fazenda: normalizeText(manualForm.nome_fazenda) || null,
      municipio: normalizeText(manualForm.municipio) || null,
      uf: normalizeText(manualForm.uf) || null,
      id_comprador: manualForm.id_comprador,
      comprador_nome_snapshot:
        normalizeText(manualForm.comprador_nome_snapshot) || null,
      qtd_vaca: toNumber(manualForm.qtd_vaca),
      qtd_boi: toNumber(manualForm.qtd_boi),
      arrobas_vaca: toNullableNumber(manualForm.arrobas_vaca),
      arrobas_boi: toNullableNumber(manualForm.arrobas_boi),
      vlrunitario_vaca: toNullableNumber(manualForm.vlrunitario_vaca),
      vlrunitario_boi: toNullableNumber(manualForm.vlrunitario_boi),
      vlrunitario_premio: toNullableNumber(
        manualForm.vlrunitario_premio,
      ),
      prazo_dias: toNullableNumber(manualForm.prazo_dias),
      curral,
      qtd_china_vaca: toNumber(manualForm.qtd_china_vaca),
      qtd_china_boi: toNumber(manualForm.qtd_china_boi),
      qtd_agrotools_vaca: toNumber(manualForm.qtd_agrotools_vaca),
      qtd_agrotools_boi: toNumber(manualForm.qtd_agrotools_boi),
      status_agrotools_analise: manualForm.status_agrotools_analise,
      id_analise_agrotools:
        manualForm.id_analise_agrotools.trim() || null,
      observacao: manualForm.observacao.trim() || null,
      ordem_exibicao: toNumber(manualForm.ordem_exibicao),
    };

    setSavingRecord(true);
    try {
      const result =
        modalMode === "edit-manual"
          ? await editarRegistroManualEscala({
              ...payload,
              id_escala_item_manual: manualForm.id_escala_item_manual,
              versao: manualForm.versao,
            })
          : await criarRegistroManualEscala(payload);

      toast.success(
        result.message ||
          (modalMode === "edit-manual"
            ? "Registro manual atualizado."
            : "Registro manual incluído."),
      );
      await finishRecordSave();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Erro ao salvar o registro manual.",
      );
    } finally {
      setSavingRecord(false);
    }
  };

  const handleDeleteOrder = async (row: EscalaLinha) => {
    const id = toNumber(row.ID_ESCALA_PEDIDO_VINCULO);
    if (!id) return;
    if (!window.confirm(`Remover o pedido ${row.NROPEDIDO} da escala?`)) return;

    setDeletingId(id);
    try {
      const result = await inativarVinculoPedidoEscala({
        id_escala_pedido_vinculo: id,
        nroempresa,
        versao: toNumber(row.VERSAO_REGISTRO || row.VERSAO_VINCULO) || 1,
      });
      toast.success(result.message || "Pedido removido da escala.");
      await loadScale();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao remover o pedido.",
      );
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteManual = async (row: EscalaLinha) => {
    const id = toNumber(row.ID_ESCALA_ITEM_MANUAL);
    if (!id) return;
    if (!window.confirm(`Apagar o registro manual de ${row.PRODUTOR}?`)) return;

    setDeletingId(id);
    try {
      const result = await inativarRegistroManualEscala({
        id_escala_item_manual: id,
        nroempresa,
        versao: toNumber(row.VERSAO_REGISTRO) || 1,
      });
      toast.success(result.message || "Registro manual removido.");
      await loadScale();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Erro ao remover o registro manual.",
      );
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-[#F3F6FA]">
        <Loader2 className="h-9 w-9 animate-spin text-[#1B58A0]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F3F6FA] p-3 pb-20 lg:p-5">
      <div className="mx-auto max-w-[1700px] space-y-4">
        <header className="overflow-hidden rounded-2xl border border-[#D3DEE9] bg-white shadow-[0_4px_18px_rgba(23,61,110,0.06)]">
          <div
            className="grid h-1.5 grid-cols-[1fr_1fr_0.38fr]"
            aria-label="Cores institucionais Beauvallet"
          >
            <span className="bg-[#173D6E]" />
            <span className="bg-[#1B58A0]" />
            <span className="bg-[#E30613]" />
          </div>

          <div className="flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-6">
            <div className="min-w-0">
              <Button
                variant="ghost"
                size="sm"
                className="mb-2 -ml-2 gap-2 rounded-lg text-xs font-bold text-[#526B82] hover:bg-[#EEF4FA] hover:text-[#173D6E]"
                onClick={() => navigate("/escala")}
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar para o planejamento
              </Button>

              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#D7E3EF] bg-[#EEF4FA]">
                  <CalendarRange className="h-6 w-6 text-[#173D6E]" />
                </div>
                <div>
                  <p className="mb-0.5 text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#1B58A0]">
                    Operação da escala
                  </p>
                  <h1 className="text-2xl font-extrabold tracking-tight text-[#173D6E]">
                    {scaleId ? "Gerenciar escala" : "Criar escala"}
                  </h1>
                  <p className="mt-1 text-xs font-medium text-[#60758A]">
                    Pedidos do ERP e inclusões manuais do dia de abate.
                  </p>
                </div>
              </div>
            </div>

            {scaleId && (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  className="h-10 gap-2 rounded-xl border-[#BFCFDF] text-xs font-extrabold text-[#173D6E] hover:border-[#1B58A0] hover:bg-[#EEF4FA]"
                  onClick={() => openInsertOrderModal()}
                >
                  <Plus className="h-4 w-4" />
                  Adicionar pedido
                </Button>

                <Button
                  variant="outline"
                  className="h-10 gap-2 rounded-xl border-[#9EC5D2] text-xs font-extrabold text-[#09759D] hover:bg-[#EFF8FA]"
                  onClick={openInsertManualModal}
                >
                  <FilePlus2 className="h-4 w-4" />
                  Adicionar manual
                </Button>

                <Button
                  variant="outline"
                  className="h-10 gap-2 rounded-xl border-[#F0B8BC] text-xs font-extrabold text-[#C61F2A] hover:bg-[#FFF1F2]"
                  onClick={() => void handleInactivateScale()}
                >
                  <Trash2 className="h-4 w-4" />
                  Inativar escala
                </Button>
              </div>
            )}
          </div>
        </header>

        <Card className="overflow-hidden rounded-2xl border border-[#D3DEE9] bg-white shadow-[0_4px_18px_rgba(23,61,110,0.045)]">
          <><div className="h-1 bg-[#173D6E]" /><CardHeader className="border-b border-[#D6E1EB] bg-[#F8FAFC] p-4">
            <CardTitle className="text-base font-extrabold text-[#173D6E]">
              Dados da escala
            </CardTitle>
          </CardHeader></>
          <CardContent className="p-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <Field label="Data de abate">
                <Input
                  type="date"
                  value={scaleForm.data_abate}
                  onChange={(event) =>
                    setScaleForm((current) => ({
                      ...current,
                      data_abate: event.target.value,
                    }))
                  }
                />
              </Field>

              <Field label="Turno">
                <select
                  value={scaleForm.turno}
                  onChange={(event) =>
                    setScaleForm((current) => ({
                      ...current,
                      turno: event.target.value as EscalaTurno,
                    }))
                  }
                  className="flex h-10 w-full rounded-lg border border-[#C5D4E2] bg-white px-3 py-2 text-sm font-semibold text-[#173D6E] outline-none focus:border-[#1B58A0] focus:ring-2 focus:ring-[#1B58A0]/15"
                >
                  <option value="UNICO">Único</option>
                  <option value="MANHA">Manhã</option>
                  <option value="TARDE">Tarde</option>
                  <option value="NOITE">Noite</option>
                </select>
              </Field>

              <Field label="Meta de cabeças">
                <Input
                  type="number"
                  min={0}
                  value={scaleForm.meta_cabecas}
                  onChange={(event) =>
                    setScaleForm((current) => ({
                      ...current,
                      meta_cabecas: Number(event.target.value || 0),
                    }))
                  }
                />
              </Field>

              <Field label="Status">
                <select
                  value={scaleForm.status_escala}
                  onChange={(event) =>
                    setScaleForm((current) => ({
                      ...current,
                      status_escala: event.target.value as EscalaStatus,
                    }))
                  }
                  className="flex h-10 w-full rounded-lg border border-[#C5D4E2] bg-white px-3 py-2 text-sm font-semibold text-[#173D6E] outline-none focus:border-[#1B58A0] focus:ring-2 focus:ring-[#1B58A0]/15"
                >
                  <option value="RASCUNHO">Rascunho</option>
                  <option value="ABERTA">Aberta</option>
                  <option value="CONFIRMADA">Confirmada</option>
                  <option value="ENCERRADA">Encerrada</option>
                  <option value="CANCELADA">Cancelada</option>
                </select>
              </Field>

              <div className="flex items-end">
                <Button
                  className="h-10 w-full gap-2 rounded-xl bg-[#173D6E] text-xs font-extrabold text-white hover:bg-[#1B58A0]"
                  disabled={savingScale}
                  onClick={() => void handleSaveScale()}
                >
                  {savingScale ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {scaleId ? "Salvar escala" : "Criar escala"}
                </Button>
              </div>
            </div>

            <Field label="Observação geral" className="mt-4">
              <textarea
                value={scaleForm.observacao_geral}
                onChange={(event) =>
                  setScaleForm((current) => ({
                    ...current,
                    observacao_geral: event.target.value,
                  }))
                }
                rows={3}
                className="flex w-full rounded-lg border border-[#C5D4E2] bg-white px-3 py-2 text-sm font-medium text-[#334E68] outline-none focus:border-[#1B58A0] focus:ring-2 focus:ring-[#1B58A0]/15"
              />
            </Field>
          </CardContent>
        </Card>

        {scaleId && pendingOrders.length > 0 && (
          <Card className="overflow-hidden rounded-2xl border border-[#F2C79F] bg-white shadow-[0_4px_18px_rgba(238,114,24,0.06)]">
            <><div className="h-1 bg-[#EE7218]" /><CardHeader className="border-b border-[#F3D5B8] bg-[#FFF8F0] p-4">
              <CardTitle className="flex items-center gap-2 text-base font-extrabold text-[#A84A15]">
                <AlertTriangle className="h-5 w-5" />
                Pedidos previstos ainda não incluídos
              </CardTitle>
            </CardHeader></>
            <CardContent className="space-y-2 p-4">
              {pendingOrders.map((row) => (
                <div
                  key={row.ID_PLANEJAMENTO}
                  className="flex flex-col gap-3 rounded-xl border-2 border-[#E5C09B] bg-white p-3 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <p className="text-sm font-extrabold text-[#173D6E]">
                      Pedido {row.NROPEDIDO} — {row.PRODUTOR || "Produtor não retornado"}
                    </p>
                    <p className="text-xs font-semibold text-[#526B82]">
                      {getOrderProperty(row)} • {numberFormat.format(getOrderTotal(row))} animais
                    </p>
                  </div>
                  <Button
                    size="sm"
                    className="gap-2 rounded-lg bg-[#173D6E] text-xs font-extrabold text-white hover:bg-[#1B58A0]"
                    onClick={() => openInsertOrderModal(row)}
                  >
                    <Plus className="h-4 w-4" />
                    Incluir na escala
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {scaleId && (
          <div className="grid gap-4 xl:grid-cols-2">
            <RecordSection
              title="Pedidos incluídos"
              empty="Nenhum pedido incluído."
              records={linkedOrders}
              render={(row) => (
                <RecordCard
                  row={row}
                  onEdit={() => openEditOrderModal(row)}
                  onDelete={() => void handleDeleteOrder(row)}
                  deleting={
                    deletingId === toNumber(row.ID_ESCALA_PEDIDO_VINCULO)
                  }
                />
              )}
            />

            <RecordSection
              title="Registros manuais"
              empty="Nenhum registro manual."
              records={manualRecords}
              render={(row) => (
                <RecordCard
                  row={row}
                  manual
                  onEdit={() => openEditManualModal(row)}
                  onDelete={() => void handleDeleteManual(row)}
                  deleting={deletingId === toNumber(row.ID_ESCALA_ITEM_MANUAL)}
                />
              )}
            />
          </div>
        )}
      </div>

      {modalMode === "insert-order" && (
        <Modal title="Adicionar pedido à escala" onClose={closeModal}>
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
              <Field label="Número do pedido">
                <Input
                  inputMode="numeric"
                  value={insertOrderForm.nro_pedido}
                  onChange={(event) =>
                    setInsertOrderForm((current) => ({
                      ...current,
                      nro_pedido: event.target.value.replace(/\D/g, ""),
                      seqpedido: null,
                    }))
                  }
                />
              </Field>
              <Button
                variant="outline"
                className="h-10 gap-2 text-xs font-black"
                disabled={searchingOrder}
                onClick={() => void searchOrder()}
              >
                {searchingOrder ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                Buscar
              </Button>
            </div>

            {orderResults.length > 1 && (
              <div className="space-y-2">
                {orderResults.map((order) => (
                  <button
                    key={order.SEQPEDIDO}
                    type="button"
                    onClick={() =>
                      setInsertOrderForm((current) => ({
                        ...current,
                        seqpedido: order.SEQPEDIDO,
                      }))
                    }
                    className={`w-full rounded-lg border p-3 text-left ${
                      insertOrderForm.seqpedido === order.SEQPEDIDO
                        ? "border-primary bg-primary/5"
                        : "border-slate-200"
                    }`}
                  >
                    <p className="text-xs font-black">SEQPEDIDO {order.SEQPEDIDO}</p>
                    <p className="text-xs text-slate-500">
                      {order.PRODUTOR} • {getOrderProperty(order)}
                    </p>
                  </button>
                ))}
              </div>
            )}

            <Field label="Observação">
              <textarea
                value={insertOrderForm.observacao}
                onChange={(event) =>
                  setInsertOrderForm((current) => ({
                    ...current,
                    observacao: event.target.value,
                  }))
                }
                rows={4}
                className="flex w-full rounded-lg border border-[#C5D4E2] bg-white px-3 py-2 text-sm font-medium text-[#334E68] outline-none focus:border-[#1B58A0] focus:ring-2 focus:ring-[#1B58A0]/15"
              />
            </Field>

            <ModalActions
              saving={savingRecord}
              saveLabel="Incluir pedido"
              onCancel={closeModal}
              onSave={() => void handleCreateLink()}
            />
          </div>
        </Modal>
      )}

      {modalMode === "edit-order" && (
        <Modal
          title={`Editar pedido ${editOrderForm.nro_pedido}`}
          onClose={closeModal}
          wide
        >
          <div className="space-y-5">
            {renderBuyerSelector({
              buyerSearch,
              setBuyerSearch,
              buyerOpen,
              setBuyerOpen,
              loadingBuyers,
              buyerSuggestions,
              selectBuyer,
              clearBuyer,
              required: true,
              focusField: "comprador",
            })}

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
              <Field label="Prêmio unitário">
                <Input
                  data-focus-field="vlrunitario_premio"
                  type="number"
                  min={0}
                  step="0.01"
                  value={editOrderForm.vlrunitario_premio}
                  onChange={(event) =>
                    setEditOrderForm((current) => ({
                      ...current,
                      vlrunitario_premio: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="Prazo (dias)" required>
                <Input
                  data-focus-field="prazo_dias"
                  type="number"
                  min={0}
                  step={1}
                  value={editOrderForm.prazo_dias}
                  onChange={(event) =>
                    setEditOrderForm((current) => ({
                      ...current,
                      prazo_dias: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="Curral" required>
                <Input
                  data-focus-field="curral"
                  type="number"
                  min={0}
                  step={1}
                  value={editOrderForm.curral}
                  onChange={(event) =>
                    setEditOrderForm((current) => ({
                      ...current,
                      curral: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="@ vaca" required>
                <Input
                  data-focus-field="arrobas_vaca"
                  type="number"
                  min={0}
                  step="0.01"
                  value={editOrderForm.arrobas_vaca}
                  onChange={(event) =>
                    setEditOrderForm((current) => ({
                      ...current,
                      arrobas_vaca: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="@ boi" required>
                <Input
                  data-focus-field="arrobas_boi"
                  type="number"
                  min={0}
                  step="0.01"
                  value={editOrderForm.arrobas_boi}
                  onChange={(event) =>
                    setEditOrderForm((current) => ({
                      ...current,
                      arrobas_boi: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="Ordem">
                <Input
                  type="number"
                  min={0}
                  value={editOrderForm.ordem_exibicao}
                  onChange={(event) =>
                    setEditOrderForm((current) => ({
                      ...current,
                      ordem_exibicao: event.target.value,
                    }))
                  }
                />
              </Field>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <NumericField
                label={
                  <span className="inline-flex items-center gap-1.5">
                    <span>China vaca</span>
                    {showChinaVacaSuggestion && chinaSuggestionVaca && (
                      <button
                        type="button"
                        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-[#F2B176] bg-[#FFF4E8] text-[#B85B00] transition hover:border-[#E28A2E] hover:bg-[#FFEBD6]"
                        title="Ver cálculo da sugestão de China vaca"
                        onClick={() =>
                          showChinaSuggestionDetails(
                            chinaSuggestionVaca,
                            "Vacas",
                            toNumber(editingOrderRow?.QTD_VACA),
                          )
                        }
                      >
                        <Sparkles className="h-2.5 w-2.5" />
                      </button>
                    )}
                  </span>
                }
                value={editOrderForm.qtd_china_vaca}
                onChange={(value) =>
                  setEditOrderForm((current) => ({
                    ...current,
                    qtd_china_vaca: value,
                  }))
                }
              />
              <NumericField
                label={
                  <span className="inline-flex items-center gap-1.5">
                    <span>China boi</span>
                    {showChinaBoiSuggestion && chinaSuggestionBoi && (
                      <button
                        type="button"
                        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-[#F2B176] bg-[#FFF4E8] text-[#B85B00] transition hover:border-[#E28A2E] hover:bg-[#FFEBD6]"
                        title="Ver cálculo da sugestão de China boi"
                        onClick={() =>
                          showChinaSuggestionDetails(
                            chinaSuggestionBoi,
                            "Bois",
                            toNumber(editingOrderRow?.QTD_BOI),
                          )
                        }
                      >
                        <Sparkles className="h-2.5 w-2.5" />
                      </button>
                    )}
                  </span>
                }
                value={editOrderForm.qtd_china_boi}
                onChange={(value) =>
                  setEditOrderForm((current) => ({
                    ...current,
                    qtd_china_boi: value,
                  }))
                }
              />
              <NumericField label="Agrotools vaca" value={editOrderForm.qtd_agrotools_vaca} onChange={(value) => setEditOrderForm((current) => ({ ...current, qtd_agrotools_vaca: value }))} />
              <NumericField label="Agrotools boi" value={editOrderForm.qtd_agrotools_boi} onChange={(value) => setEditOrderForm((current) => ({ ...current, qtd_agrotools_boi: value }))} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Status da análise Agrotools">
                <AgrotoolsSelect
                  value={editOrderForm.status_agrotools_analise}
                  onChange={(value) =>
                    setEditOrderForm((current) => ({
                      ...current,
                      status_agrotools_analise: value,
                    }))
                  }
                />
              </Field>
              <Field label="ID da análise Agrotools">
                <Input
                  value={editOrderForm.id_analise_agrotools}
                  onChange={(event) =>
                    setEditOrderForm((current) => ({
                      ...current,
                      id_analise_agrotools: event.target.value,
                    }))
                  }
                />
              </Field>
            </div>

            <Field label="Observação">
              <textarea
                rows={4}
                value={editOrderForm.observacao}
                onChange={(event) =>
                  setEditOrderForm((current) => ({
                    ...current,
                    observacao: event.target.value,
                  }))
                }
                className="flex w-full rounded-lg border border-[#C5D4E2] bg-white px-3 py-2 text-sm font-medium text-[#334E68] outline-none focus:border-[#1B58A0] focus:ring-2 focus:ring-[#1B58A0]/15"
              />
            </Field>

            <ModalActions
              saving={savingRecord}
              saveLabel="Salvar informações"
              onCancel={closeModal}
              onSave={() => void handleEditOrder()}
            />
          </div>
        </Modal>
      )}

      {(modalMode === "insert-manual" || modalMode === "edit-manual") && (
        <Modal
          title={
            modalMode === "edit-manual"
              ? "Editar registro manual"
              : "Adicionar registro manual"
          }
          onClose={closeModal}
          wide
        >
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Field label="Nome do produtor" className="lg:col-span-2" required>
                <Input
                  data-focus-field="nome_produtor"
                  value={manualForm.nome_produtor}
                  onChange={(event) =>
                    setManualForm((current) => ({
                      ...current,
                      nome_produtor: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="Fazenda">
                <Input
                  value={manualForm.nome_fazenda}
                  onChange={(event) =>
                    setManualForm((current) => ({
                      ...current,
                      nome_fazenda: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="Município / UF">
                <div className="grid grid-cols-[1fr_80px] gap-2">
                  <Input
                    value={manualForm.municipio}
                    onChange={(event) =>
                      setManualForm((current) => ({
                        ...current,
                        municipio: event.target.value,
                      }))
                    }
                  />
                  <Input
                    maxLength={2}
                    value={manualForm.uf}
                    onChange={(event) =>
                      setManualForm((current) => ({
                        ...current,
                        uf: event.target.value.toUpperCase(),
                      }))
                    }
                  />
                </div>
              </Field>
            </div>

            {renderBuyerSelector({
              buyerSearch,
              setBuyerSearch,
              buyerOpen,
              setBuyerOpen,
              loadingBuyers,
              buyerSuggestions,
              selectBuyer,
              clearBuyer,
              required: true,
              focusField: "comprador",
            })}

            <div className="grid gap-4 xl:grid-cols-2">
              <AnimalBlock
                title="Vacas"
                required
                quantity={manualForm.qtd_vaca}
                arrobas={manualForm.arrobas_vaca}
                unitValue={manualForm.vlrunitario_vaca}
                china={manualForm.qtd_china_vaca}
                agrotools={manualForm.qtd_agrotools_vaca}
                onChange={(field, value) =>
                  setManualForm((current) => ({
                    ...current,
                    [field]: value,
                  }))
                }
                fieldMap={{
                  quantity: "qtd_vaca",
                  arrobas: "arrobas_vaca",
                  unitValue: "vlrunitario_vaca",
                  china: "qtd_china_vaca",
                  agrotools: "qtd_agrotools_vaca",
                }}
              />

              <AnimalBlock
                title="Bois"
                required
                quantity={manualForm.qtd_boi}
                arrobas={manualForm.arrobas_boi}
                unitValue={manualForm.vlrunitario_boi}
                china={manualForm.qtd_china_boi}
                agrotools={manualForm.qtd_agrotools_boi}
                onChange={(field, value) =>
                  setManualForm((current) => ({
                    ...current,
                    [field]: value,
                  }))
                }
                fieldMap={{
                  quantity: "qtd_boi",
                  arrobas: "arrobas_boi",
                  unitValue: "vlrunitario_boi",
                  china: "qtd_china_boi",
                  agrotools: "qtd_agrotools_boi",
                }}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
              <Field label="Prêmio unitário">
                <Input
                  data-focus-field="vlrunitario_premio"
                  type="number"
                  min={0}
                  step="0.01"
                  value={manualForm.vlrunitario_premio}
                  onChange={(event) =>
                    setManualForm((current) => ({
                      ...current,
                      vlrunitario_premio: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="Prazo (dias)" required>
                <Input
                  data-focus-field="prazo_dias"
                  type="number"
                  min={0}
                  step={1}
                  value={manualForm.prazo_dias}
                  onChange={(event) =>
                    setManualForm((current) => ({
                      ...current,
                      prazo_dias: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="Curral" required>
                <Input
                  data-focus-field="curral"
                  type="number"
                  min={0}
                  step={1}
                  value={manualForm.curral}
                  onChange={(event) =>
                    setManualForm((current) => ({
                      ...current,
                      curral: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="Status Agrotools">
                <AgrotoolsSelect
                  value={manualForm.status_agrotools_analise}
                  onChange={(value) =>
                    setManualForm((current) => ({
                      ...current,
                      status_agrotools_analise: value,
                    }))
                  }
                />
              </Field>
              <Field label="ID análise Agrotools">
                <Input
                  value={manualForm.id_analise_agrotools}
                  onChange={(event) =>
                    setManualForm((current) => ({
                      ...current,
                      id_analise_agrotools: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="Ordem">
                <Input
                  type="number"
                  min={0}
                  value={manualForm.ordem_exibicao}
                  onChange={(event) =>
                    setManualForm((current) => ({
                      ...current,
                      ordem_exibicao: event.target.value,
                    }))
                  }
                />
              </Field>
            </div>

            <Field label="Observação">
              <textarea
                rows={4}
                value={manualForm.observacao}
                onChange={(event) =>
                  setManualForm((current) => ({
                    ...current,
                    observacao: event.target.value,
                  }))
                }
                className="flex w-full rounded-lg border border-[#C5D4E2] bg-white px-3 py-2 text-sm font-medium text-[#334E68] outline-none focus:border-[#1B58A0] focus:ring-2 focus:ring-[#1B58A0]/15"
              />
            </Field>

            <ModalActions
              saving={savingRecord}
              saveLabel={
                modalMode === "edit-manual"
                  ? "Salvar registro"
                  : "Adicionar registro"
              }
              onCancel={closeModal}
              onSave={() => void handleSaveManual()}
            />
          </div>
        </Modal>
      )}
    </div>
  );
}

function Field({
  label,
  children,
  className = "",
  required = false,
}: {
  label: ReactNode;
  children: ReactNode;
  className?: string;
  required?: boolean;
}) {
  return (
    <div
      className={`space-y-1.5
        [&_label]:text-[11px]
        [&_label]:font-extrabold
        [&_label]:uppercase
        [&_label]:tracking-[0.06em]
        [&_label]:text-[#52677E]
        [&_input]:rounded-lg
        [&_input]:border-[#C5D4E2]
        [&_input]:bg-white
        [&_input]:font-semibold
        [&_input]:text-[#173D6E]
        [&_input:focus-visible]:border-[#1B58A0]
        [&_input:focus-visible]:ring-[#1B58A0]/20
        ${className}`}
    >
      <Label>
        {label}
        {required && (
          <span className="ml-0.5 font-black text-[#E30613]" aria-hidden="true">
            *
          </span>
        )}
      </Label>
      {children}
    </div>
  );
}

function NumericField({
  label,
  value,
  onChange,
  required = false,
  focusField,
}: {
  label: ReactNode;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  focusField?: string;
}) {
  return (
    <Field label={label} required={required}>
      <Input
        data-focus-field={focusField}
        type="number"
        min={0}
        step="1"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}

function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-[#102A43]/55 p-3 backdrop-blur-[2px] lg:p-6"
      role="dialog"
      aria-modal="true"
    >
      <Card
        className={`my-auto w-full overflow-hidden rounded-2xl border border-[#D3DEE9] bg-white shadow-2xl ${
          wide ? "max-w-6xl" : "max-w-3xl"
        }`}
      >
        <div className="grid h-1.5 grid-cols-[1fr_1fr_0.38fr]">
          <span className="bg-[#173D6E]" />
          <span className="bg-[#1B58A0]" />
          <span className="bg-[#E30613]" />
        </div>
        <CardHeader className="flex flex-row items-start justify-between gap-3 border-b border-[#D6E1EB] bg-[#F8FAFC] p-4">
          <CardTitle className="text-lg font-extrabold text-[#173D6E]">
            {title}
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-lg text-[#526B82] hover:bg-[#EAF1F8] hover:text-[#173D6E]"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="p-4 sm:p-5">{children}</CardContent>
      </Card>
    </div>
  );
}

function ModalActions({
  saving,
  saveLabel,
  onCancel,
  onSave,
}: {
  saving: boolean;
  saveLabel: string;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <div className="flex justify-end gap-2 border-t border-[#D6E1EB] pt-4">
      <Button variant="outline" className="rounded-lg border-[#BFCFDF] font-bold text-[#52677E] hover:bg-[#EEF4FA]" onClick={onCancel}>
        Cancelar
      </Button>
      <Button className="gap-2 rounded-lg bg-[#173D6E] font-extrabold text-white hover:bg-[#1B58A0]" disabled={saving} onClick={onSave}>
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Save className="h-4 w-4" />
        )}
        {saveLabel}
      </Button>
    </div>
  );
}

function AgrotoolsSelect({
  value,
  onChange,
}: {
  value: AgrotoolsAnaliseStatus;
  onChange: (value: AgrotoolsAnaliseStatus) => void;
}) {
  return (
    <select
      value={value}
      onChange={(event) =>
        onChange(event.target.value as AgrotoolsAnaliseStatus)
      }
      className="flex h-10 w-full rounded-lg border border-[#C5D4E2] bg-white px-3 py-2 text-sm font-semibold text-[#173D6E] outline-none focus:border-[#1B58A0] focus:ring-2 focus:ring-[#1B58A0]/15"
    >
      <option value="PENDENTE">Pendente</option>
      <option value="EM_ANALISE">Em análise</option>
      <option value="APTO">Apto</option>
      <option value="APTO_COM_RESSALVAS">Apto com ressalvas</option>
      <option value="INAPTO">Inapto</option>
      <option value="ERRO">Erro</option>
    </select>
  );
}

function renderBuyerSelector({
  buyerSearch,
  setBuyerSearch,
  buyerOpen,
  setBuyerOpen,
  loadingBuyers,
  buyerSuggestions,
  selectBuyer,
  clearBuyer,
  required = false,
  focusField,
}: {
  buyerSearch: string;
  setBuyerSearch: (value: string) => void;
  buyerOpen: boolean;
  setBuyerOpen: (value: boolean) => void;
  loadingBuyers: boolean;
  buyerSuggestions: ApiUsuario[];
  selectBuyer: (buyer: ApiUsuario) => void;
  clearBuyer: () => void;
  required?: boolean;
  focusField?: string;
}) {
  return (
    <Field label="Comprador responsável" required={required}>
      <div className="relative">
        <div className="flex gap-2">
          <Input
            data-focus-field={focusField}
            value={buyerSearch}
            onFocus={() => setBuyerOpen(true)}
            onChange={(event) => {
              setBuyerSearch(event.target.value);
              setBuyerOpen(true);
            }}
            placeholder={loadingBuyers ? "Carregando compradores..." : "Pesquisar comprador"}
          />
          <Button type="button" variant="outline" size="icon" className="rounded-lg border-[#BFCFDF] text-[#526B82] hover:bg-[#EEF4FA]" onClick={clearBuyer}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {buyerOpen && (
          <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-[#C5D4E2] bg-white p-1 shadow-xl">
            {buyerSuggestions.length === 0 ? (
              <p className="p-3 text-xs text-slate-400">Nenhum comprador encontrado.</p>
            ) : (
              buyerSuggestions.map((buyer) => (
                <button
                  key={buyer.CODUSUARIO}
                  type="button"
                  className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-xs hover:bg-[#EEF4FA]"
                  onClick={() => selectBuyer(buyer)}
                >
                  <span className="font-extrabold text-[#173D6E]">{buyer.CODUSUARIO}</span>
                  <span className="font-semibold text-[#718297]">ID {buyer.SEQUSUARIO}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </Field>
  );
}

function AnimalBlock({
  title,
  quantity,
  arrobas,
  unitValue,
  china,
  agrotools,
  onChange,
  fieldMap,
  required = false,
}: {
  title: string;
  quantity: string;
  arrobas: string;
  unitValue: string;
  china: string;
  agrotools: string;
  onChange: (field: string, value: string) => void;
  required?: boolean;
  fieldMap: {
    quantity: string;
    arrobas: string;
    unitValue: string;
    china: string;
    agrotools: string;
  };
}) {
  return (
    <div className="overflow-hidden rounded-xl border-2 border-[#C5D4E2] bg-white">
      <div className="h-1 bg-[#173D6E]" />
      <div className="p-4">
      <h3 className="mb-3 text-sm font-extrabold text-[#173D6E]">{title}</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <NumericField
          label="Quantidade"
          value={quantity}
          required={required}
          focusField={fieldMap.quantity}
          onChange={(value) => onChange(fieldMap.quantity, value)}
        />
        <Field
          label="@ viva"
          required={required && toNumber(quantity) > 0}
        >
          <Input
            data-focus-field={fieldMap.arrobas}
            type="number"
            min={0}
            step="0.01"
            value={arrobas}
            onChange={(event) =>
              onChange(fieldMap.arrobas, event.target.value)
            }
          />
        </Field>
        <Field
          label="Valor unitário"
          required={required && toNumber(quantity) > 0}
        >
          <Input
            data-focus-field={fieldMap.unitValue}
            type="number"
            min={0}
            step="0.01"
            value={unitValue}
            onChange={(event) =>
              onChange(fieldMap.unitValue, event.target.value)
            }
          />
        </Field>
        <NumericField
          label="China"
          value={china}
          focusField={fieldMap.china}
          onChange={(value) => onChange(fieldMap.china, value)}
        />
        <NumericField
          label="Agrotools"
          value={agrotools}
          focusField={fieldMap.agrotools}
          onChange={(value) => onChange(fieldMap.agrotools, value)}
        />
      </div>
      </div>
    </div>
  );
}

function RecordSection({
  title,
  empty,
  records,
  render,
}: {
  title: string;
  empty: string;
  records: EscalaLinha[];
  render: (row: EscalaLinha) => ReactNode;
}) {
  return (
    <Card className="overflow-hidden rounded-2xl border border-[#D3DEE9] bg-white shadow-[0_4px_18px_rgba(23,61,110,0.045)]">
      <div className="h-1 bg-[#173D6E]" />
      <CardHeader className="border-b border-[#D6E1EB] bg-[#F8FAFC] p-4">
        <CardTitle className="text-base font-extrabold text-[#173D6E]">
          {title} ({records.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-4">
        {records.length === 0 ? (
          <p className="py-8 text-center text-sm font-semibold text-[#718297]">{empty}</p>
        ) : (
          records.map(render)
        )}
      </CardContent>
    </Card>
  );
}

function RecordCard({
  row,
  manual = false,
  onEdit,
  onDelete,
  deleting,
}: {
  row: EscalaLinha;
  manual?: boolean;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  const status = row.STATUS_AGROTOOLS_ANALISE || "PENDENTE";

  return (
    <div className="rounded-xl border-2 border-[#B8C9D9] bg-white p-4 shadow-[0_2px_9px_rgba(23,61,110,0.04)]">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-[#B9CCE0] bg-[#EDF4FB] font-extrabold text-[#173D6E]">
              {manual ? "MANUAL" : `Pedido ${row.NROPEDIDO}`}
            </Badge>
            <Badge variant="outline" className={agrotoolsClass[status]}>
              {agrotoolsLabel[status]}
            </Badge>
            {row.STATUS_CONFIGURACAO === "PENDENTE_COMPLEMENTO" && (
              <Badge variant="outline" className="border-[#F2C79F] bg-[#FFF7EE] font-bold text-[#A84A15]">
                <AlertTriangle className="mr-1 h-3 w-3" />
                {row.CAMPOS_PENDENTES || "Faltam informações"}
              </Badge>
            )}
          </div>

          <p className="mt-2 text-sm font-extrabold text-[#173D6E]">
            {row.PRODUTOR || "Produtor não informado"}
          </p>
          <p className="text-xs font-bold text-[#526B82]">{getOrderProperty(row)}</p>

          <div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold text-[#425B73]">
            <span>{numberFormat.format(getOrderTotal(row))} animais</span>
            <span>{numberFormat.format(toNumber(row.QTD_VACA))} vacas</span>
            <span>{numberFormat.format(toNumber(row.QTD_BOI))} bois</span>
            <span>
              Prêmio: {getEffectivePremium(row) == null ? "não informado" : currencyFormat.format(getEffectivePremium(row) ?? 0)}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" className="gap-2 rounded-lg border-[#BFCFDF] text-xs font-extrabold text-[#173D6E] hover:bg-[#EEF4FA]" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" />
            Editar
          </Button>
          <Button variant="outline" size="icon" className="rounded-lg border-[#F0B8BC] text-[#C61F2A] hover:bg-[#FFF1F2]" disabled={deleting} onClick={onDelete}>
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

function InfoBox({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-[#C5D4E2] bg-[#F8FAFC] p-3">
      <div className="text-[#1B58A0]">{icon}</div>
      <div>
        <p className="text-[9px] font-extrabold uppercase text-[#718297]">{label}</p>
        <p className="text-xs font-extrabold text-[#173D6E]">{value}</p>
      </div>
    </div>
  );
}
