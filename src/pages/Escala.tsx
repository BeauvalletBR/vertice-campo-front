import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  BadgeCheck,
  CalendarDays,
  CalendarPlus,
  CalendarRange,
  CircleDollarSign,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ClipboardList,
  FilePlus2,
  ListPlus,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  consultarEscala,
  consultarResumoEscala,
  criarVinculosPedidosDiaEscala,
  inativarEscala,
  inativarRegistroManualEscala,
} from "@/services/escala";
import type {
  EscalaLinha,
  EscalaResumo,
  EscalaStatus,
} from "@/types/escala";

const numberFormat = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 0,
});

const currencyFormat = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const decimalFormat = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 2,
});

const percentFormat = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const WEEKS_PER_PAGE = 5;

type AnimalSex = "VACA" | "BOI";

interface PlanningSexRow {
  key: string;
  row: EscalaLinha;
  sex: AnimalSex;
  quantity: number;
  arrobas: number | null;
  unitValue: number | null;
  chinaQuantity: number;
  agrotoolsQuantity: number;
}

interface InclusionChoiceState {
  day: string;
  scaleId: number;
  selectedRow: EscalaLinha | null;
  pendingOrders: EscalaLinha[];
  returnToScale?: boolean;
}

interface PlanningTotals {
  erpOrders: number;
  manualRecords: number;
  pendingInclusion: number;
  pendingComplement: number;
  plannedHeads: number;
  cows: number;
  bulls: number;
  china: number;
  agrotools: number;
  daysWithAnimals: number;
  averageHeadsPerDay: number;
  averagePaid: number;
  cowsPercent: number;
  bullsPercent: number;
  chinaPercent: number;
  agrotoolsPercent: number;
}

const toNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toOptionalNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || String(value).trim() === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeText = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toUpperCase();

const formatDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseLocalDate = (value: string) => {
  const normalized = value.split("T")[0];
  const [year, month, day] = normalized.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0);
};

const addDays = (value: string, days: number) => {
  const date = parseLocalDate(value);
  date.setDate(date.getDate() + days);
  return formatDateInput(date);
};

const getISOWeekValue = (date = new Date()) => {
  const temporary = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const day = temporary.getUTCDay() || 7;
  temporary.setUTCDate(temporary.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(temporary.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((temporary.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  return `${temporary.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
};

const getNextISOWeekValue = () => {
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  return getISOWeekValue(nextWeek);
};

const getWeekValueFromDate = (value: string) =>
  getISOWeekValue(parseLocalDate(value));

const getWeekCatalogRange = () => {
  const currentYear = new Date().getFullYear();
  return {
    data_inicio: `${currentYear - 2}-01-01`,
    data_fim: `${currentYear + 1}-12-31`,
  };
};

const getStartDateFromWeek = (weekValue: string) => {
  const [yearText, weekText] = weekValue.split("-W");
  const year = Number(yearText);
  const week = Number(weekText);

  if (!Number.isFinite(year) || !Number.isFinite(week)) {
    return formatDateInput(new Date());
  }

  const januaryFourth = new Date(year, 0, 4, 12, 0, 0);
  const januaryFourthDay = januaryFourth.getDay() || 7;
  const monday = new Date(januaryFourth);
  monday.setDate(
    januaryFourth.getDate() - januaryFourthDay + 1 + (week - 1) * 7,
  );
  return formatDateInput(monday);
};

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  return parseLocalDate(value).toLocaleDateString("pt-BR");
};

const formatDayTitle = (value: string) => {
  const date = parseLocalDate(value);
  const weekday = date
    .toLocaleDateString("pt-BR", { weekday: "long" })
    .toUpperCase();
  return `${weekday} - ${date.toLocaleDateString("pt-BR")}`;
};

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

const getPlanningKey = (row: EscalaLinha) =>
  row.ID_PLANEJAMENTO ||
  `${row.ORIGEM_REGISTRO}-${
    row.ID_ESCALA_PEDIDO_VINCULO ||
    row.ID_ESCALA_ITEM_MANUAL ||
    row.SEQPEDIDO ||
    row.NROPEDIDO ||
    row.PRODUTOR
  }`;

const getUniquePlanningRecords = (rows: EscalaLinha[]) => {
  const map = new Map<string, EscalaLinha>();
  for (const row of rows) map.set(getPlanningKey(row), row);
  return Array.from(map.values());
};

const getOrderTotal = (row: EscalaLinha) => {
  const total = toNumber(row.QTD_PEDIDA_TOTAL);
  return total > 0 ? total : toNumber(row.QTD_VACA) + toNumber(row.QTD_BOI);
};

const getScaleId = (
  rows: EscalaLinha[],
  summary?: EscalaResumo | null,
): number | null => {
  const candidates = [
    summary?.ID_ESCALA,
    ...rows.flatMap((row) => [row.ID_ESCALA, row.ID_ESCALA_SUGERIDA]),
  ];

  for (const candidate of candidates) {
    const parsed = Number(candidate);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }

  return null;
};

const getStatusClass = (status?: EscalaStatus | null) => {
  const classes: Record<EscalaStatus, string> = {
    RASCUNHO: "border-[#CBD7E4] bg-[#F3F6F9] text-[#52677E]",
    ABERTA: "border-[#B9CCE0] bg-[#EDF4FB] text-[#173D6E]",
    CONFIRMADA: "border-[#A7D4C1] bg-[#EEF8F3] text-[#2E6D54]",
    ENCERRADA: "border-[#C8C4DC] bg-[#F4F2F8] text-[#514C72]",
    CANCELADA: "border-[#F0B8BC] bg-[#FFF1F2] text-[#A51D29]",
  };

  return status
    ? classes[status]
    : "border-[#F2C79F] bg-[#FFF7EE] text-[#A84A15]";
};

const getPlanningRowClass = (row: EscalaLinha) => {
  /*
   * Pedidos aguardando criação ou inclusão:
   * fundo branco e identificação somente pela lateral laranja.
   */
  if (
    row.STATUS_CONFIGURACAO === "PENDENTE_CRIAR_ESCALA" ||
    row.STATUS_CONFIGURACAO === "PENDENTE_INCLUSAO"
  ) {
    return "bg-white hover:bg-[#FAFBFC] [&>td:first-child]:border-l-4 [&>td:first-child]:border-l-[#EE7218]";
  }

  /*
   * Registros com campos faltando:
   * fundo branco e identificação somente pela lateral vermelha.
   */
  if (row.STATUS_CONFIGURACAO === "PENDENTE_COMPLEMENTO") {
    return "bg-white hover:bg-[#FAFBFC] [&>td:first-child]:border-l-4 [&>td:first-child]:border-l-[#E30613]";
  }

  /*
   * Registro manual completo:
   * mantém o laranja muito claro para diferenciar da origem ERP.
   */
  if (row.ORIGEM_REGISTRO === "MANUAL") {
    return "bg-[#FFF8F0] hover:bg-[#FFF0DF] [&>td:first-child]:border-l-4 [&>td:first-child]:border-l-[#C96A1B]";
  }

  /*
   * Pedido ERP completo:
   * fundo branco com lateral azul-marinho.
   */
  return "bg-white hover:bg-[#F7F9FC] [&>td:first-child]:border-l-4 [&>td:first-child]:border-l-[#173D6E]";
};





const splitRecordsBySex = (records: EscalaLinha[]): PlanningSexRow[] =>
  records.flatMap((row) => {
    const rows: PlanningSexRow[] = [];

    const add = (sex: AnimalSex) => {
      const quantity =
        sex === "VACA" ? toNumber(row.QTD_VACA) : toNumber(row.QTD_BOI);
      if (quantity <= 0) return;

      rows.push({
        key: `${getPlanningKey(row)}-${sex}`,
        row,
        sex,
        quantity,
        arrobas:
          sex === "VACA"
            ? toOptionalNumber(row.ARROBAS_VACA)
            : toOptionalNumber(row.ARROBAS_BOI),
        unitValue:
          sex === "VACA"
            ? toOptionalNumber(row.VLRUNITARIO_VACA)
            : toOptionalNumber(row.VLRUNITARIO_BOI),
        chinaQuantity:
          sex === "VACA"
            ? toNumber(row.QTD_CHINA_VACA)
            : toNumber(row.QTD_CHINA_BOI),
        agrotoolsQuantity:
          sex === "VACA"
            ? toNumber(row.QTD_AGROTOOLS_VACA)
            : toNumber(row.QTD_AGROTOOLS_BOI),
      });
    };

    add("VACA");
    add("BOI");
    return rows;
  });

const calculateTotals = (rows: EscalaLinha[]): PlanningTotals => {
  const records = getUniquePlanningRecords(rows);
  const daysWithAnimals = new Set<string>();

  const base = records.reduce(
    (totals, row) => {
      if (row.ORIGEM_REGISTRO === "ERP") totals.erpOrders += 1;
      if (row.ORIGEM_REGISTRO === "MANUAL") totals.manualRecords += 1;

      if (
        row.STATUS_CONFIGURACAO === "PENDENTE_CRIAR_ESCALA" ||
        row.STATUS_CONFIGURACAO === "PENDENTE_INCLUSAO"
      ) {
        totals.pendingInclusion += 1;
      }

      if (row.STATUS_CONFIGURACAO === "PENDENTE_COMPLEMENTO") {
        totals.pendingComplement += 1;
      }

      const total = getOrderTotal(row);
      totals.plannedHeads += total;
      totals.cows += toNumber(row.QTD_VACA);
      totals.bulls += toNumber(row.QTD_BOI);
      totals.china += toNumber(row.QTD_CHINA_TOTAL ?? row.QTD_CHINA);
      totals.agrotools +=
        toNumber(row.QTD_AGROTOOLS_VACA) +
        toNumber(row.QTD_AGROTOOLS_BOI);

      const day = row.DATA_ABATE?.split("T")[0];
      if (day && total > 0) daysWithAnimals.add(day);

      return totals;
    },
    {
      erpOrders: 0,
      manualRecords: 0,
      pendingInclusion: 0,
      pendingComplement: 0,
      plannedHeads: 0,
      cows: 0,
      bulls: 0,
      china: 0,
      agrotools: 0,
    },
  );

  let paidValueSum = 0;
  let pricedAnimals = 0;

  for (const item of splitRecordsBySex(records)) {
    if (item.unitValue !== null && item.quantity > 0) {
      paidValueSum += item.unitValue * item.quantity;
      pricedAnimals += item.quantity;
    }
  }

  const percentage = (value: number) =>
    base.plannedHeads > 0 ? (value / base.plannedHeads) * 100 : 0;

  return {
    ...base,
    daysWithAnimals: daysWithAnimals.size,
    averageHeadsPerDay:
      daysWithAnimals.size > 0
        ? base.plannedHeads / daysWithAnimals.size
        : 0,
    averagePaid: pricedAnimals > 0 ? paidValueSum / pricedAnimals : 0,
    cowsPercent: percentage(base.cows),
    bullsPercent: percentage(base.bulls),
    chinaPercent: percentage(base.china),
    agrotoolsPercent: percentage(base.agrotools),
  };
};

export default function Escala() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [selectedWeek, setSelectedWeek] = useState(getNextISOWeekValue);
  const [availableSummaries, setAvailableSummaries] = useState<EscalaResumo[]>(
    [],
  );
  const [lines, setLines] = useState<EscalaLinha[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingWeeks, setLoadingWeeks] = useState(true);
  const [openDays, setOpenDays] = useState<Record<string, boolean>>({});
  const [weekPage, setWeekPage] = useState(0);
  const [deletingScaleId, setDeletingScaleId] = useState<number | null>(null);
  const [deletingManualId, setDeletingManualId] = useState<number | null>(null);
  const [inclusionChoice, setInclusionChoice] =
    useState<InclusionChoiceState | null>(null);
  const [includingDay, setIncludingDay] = useState(false);

  useEffect(() => {
    if (!inclusionChoice) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [inclusionChoice]);

  const dateStart = useMemo(
    () => getStartDateFromWeek(selectedWeek),
    [selectedWeek],
  );
  const dateEnd = useMemo(() => addDays(dateStart, 6), [dateStart]);

  const modules = useMemo(
    () =>
      ((user as { modulos?: string[] } | null)?.modulos || []).map((module) =>
        normalizeText(module),
      ),
    [user],
  );

  const canManage =
    normalizeText((user as { role?: string } | null)?.role) === "ADMIN" ||
    modules.some((module) => ["ADMIN", "ESCALA"].includes(module));

  const nroempresa = getEmpresaLogada(user);

  const loadWeekCatalog = async () => {
    setLoadingWeeks(true);

    try {
      const data = await consultarResumoEscala({
        nroempresa,
        ...getWeekCatalogRange(),
      });

      const safe = (Array.isArray(data) ? data : []).filter((summary) =>
        Boolean(summary.DATA_ABATE),
      );
      setAvailableSummaries(safe);

    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar as semanas do planejamento.",
      );
      setAvailableSummaries([]);
    } finally {
      setLoadingWeeks(false);
    }
  };

  const loadData = async () => {
    setLoading(true);

    try {
      const data = await consultarEscala({
        nroempresa,
        data_inicio: dateStart,
        data_fim: dateEnd,
      });

      const safe = Array.isArray(data) ? data : [];
      setLines(safe);
      setOpenDays((current) => {
        const next = { ...current };
        for (const row of safe) {
          const day = row.DATA_ABATE?.split("T")[0];
          if (day && next[day] === undefined) next[day] = true;
        }
        return next;
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar o planejamento da escala.",
      );
      setLines([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadWeekCatalog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nroempresa]);

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateStart, dateEnd, nroempresa]);

  const summaries = useMemo(
    () =>
      availableSummaries.filter((summary) => {
        const date = summary.DATA_ABATE?.split("T")[0];
        return Boolean(date && date >= dateStart && date <= dateEnd);
      }),
    [availableSummaries, dateEnd, dateStart],
  );

  const summaryByDay = useMemo(() => {
    const map = new Map<string, EscalaResumo>();
    for (const summary of summaries) {
      const day = summary.DATA_ABATE?.split("T")[0];
      if (day) map.set(day, summary);
    }
    return map;
  }, [summaries]);

  const rowsByDay = useMemo(() => {
    const map = new Map<string, EscalaLinha[]>();
    for (const line of lines) {
      const day = line.DATA_ABATE?.split("T")[0];
      if (!day) continue;
      const current = map.get(day) || [];
      current.push(line);
      map.set(day, current);
    }
    return map;
  }, [lines]);

  const visibleDays = useMemo(() => {
    const dates = new Set<string>();
    for (const row of lines) {
      const day = row.DATA_ABATE?.split("T")[0];
      if (day) dates.add(day);
    }
    for (const summary of summaries) {
      const day = summary.DATA_ABATE?.split("T")[0];
      if (day) dates.add(day);
    }
    return Array.from(dates).sort();
  }, [lines, summaries]);

  const weekTotals = useMemo(() => calculateTotals(lines), [lines]);

  /*
   * A próxima semana é o limite mais recente do seletor.
   * Ela sempre aparece como a última opção do lado direito.
   */
  const latestPlanningWeek = useMemo(() => getNextISOWeekValue(), []);

  const weekOptions = useMemo(() => {
    const map = new Map<string, { key: string; week: number; year: number }>();

    for (const summary of availableSummaries) {
      const key = getWeekValueFromDate(summary.DATA_ABATE);

      /*
       * Não mostra semanas posteriores à próxima semana no filtro padrão.
       * Assim, a próxima semana permanece sempre como a mais recente.
       */
      if (key > latestPlanningWeek) continue;

      const [yearText, weekText] = key.split("-W");
      map.set(key, {
        key,
        week: Number(weekText),
        year: Number(yearText),
      });
    }

    /*
     * Garante que a próxima semana exista no seletor mesmo que ainda
     * não tenha escala ou pedidos cadastrados.
     */
    if (!map.has(latestPlanningWeek)) {
      const [yearText, weekText] = latestPlanningWeek.split("-W");
      map.set(latestPlanningWeek, {
        key: latestPlanningWeek,
        week: Number(weekText),
        year: Number(yearText),
      });
    }

    /*
     * Mantém uma semana antiga selecionada caso ela não tenha vindo
     * no catálogo retornado pelo backend.
     */
    if (!map.has(selectedWeek)) {
      const [yearText, weekText] = selectedWeek.split("-W");
      map.set(selectedWeek, {
        key: selectedWeek,
        week: Number(weekText),
        year: Number(yearText),
      });
    }

    return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
  }, [availableSummaries, latestPlanningWeek, selectedWeek]);

  const totalWeekPages = Math.max(
    1,
    Math.ceil(weekOptions.length / WEEKS_PER_PAGE),
  );

  /*
   * weekPage representa quantos grupos o usuário voltou.
   * Página 0 = cinco semanas mais recentes.
   */
  const visibleWeekOptions = useMemo(() => {
    const end = Math.max(
      0,
      weekOptions.length - weekPage * WEEKS_PER_PAGE,
    );
    const start = Math.max(0, end - WEEKS_PER_PAGE);

    return weekOptions.slice(start, end);
  }, [weekOptions, weekPage]);

  /*
   * Quando existirem menos de cinco semanas, adiciona os espaços vazios
   * antes das opções. Dessa forma, a semana mais recente continua à direita.
   */
  const visibleWeekSlots = useMemo(
    () => [
      ...Array(
        Math.max(0, WEEKS_PER_PAGE - visibleWeekOptions.length),
      ).fill(null),
      ...visibleWeekOptions,
    ],
    [visibleWeekOptions],
  );

  useEffect(() => {
    setWeekPage((current) =>
      Math.min(current, Math.max(0, totalWeekPages - 1)),
    );
  }, [totalWeekPages]);

  const refreshAll = async () => {
    await Promise.all([loadWeekCatalog(), loadData()]);
  };

  const handleInactivateScale = async (
    idEscala: number,
    version: number,
    day: string,
  ) => {
    if (
      !window.confirm(
        `Inativar a escala de ${formatDate(day)} e todos os vínculos ativos?`,
      )
    ) {
      return;
    }

    setDeletingScaleId(idEscala);

    try {
      const result = await inativarEscala({
        id_escala: idEscala,
        nroempresa,
        versao: version,
      });
      toast.success(result.message || "Escala inativada.");
      await refreshAll();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível inativar a escala.",
      );
    } finally {
      setDeletingScaleId(null);
    }
  };

  const handleDeleteManual = async (row: EscalaLinha) => {
    const id = toNumber(row.ID_ESCALA_ITEM_MANUAL);
    const version = toNumber(row.VERSAO_REGISTRO) || 1;

    if (!id) {
      toast.error("O identificador do registro manual não foi retornado.");
      return;
    }

    if (!window.confirm(`Apagar o registro manual de ${row.PRODUTOR || "produtor"}?`)) {
      return;
    }

    setDeletingManualId(id);

    try {
      const result = await inativarRegistroManualEscala({
        id_escala_item_manual: id,
        nroempresa,
        versao: version,
      });
      toast.success(result.message || "Registro manual removido.");
      await refreshAll();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível remover o registro manual.",
      );
    } finally {
      setDeletingManualId(null);
    }
  };

  const openInclusionChoice = (
    day: string,
    scaleId: number,
    pendingOrders: EscalaLinha[],
    selectedRow: EscalaLinha | null = null,
    returnToScale = false,
  ) => {
    if (pendingOrders.length === 0) {
      toast.info("Não há pedidos pendentes de inclusão neste dia.");
      return;
    }

    setInclusionChoice({
      day,
      scaleId,
      selectedRow,
      pendingOrders,
      returnToScale,
    });
  };

  const handleIncludeSingleOrder = () => {
    if (!inclusionChoice?.selectedRow) return;

    const row = inclusionChoice.selectedRow;
    setInclusionChoice(null);

    navigate(
      `/escala/gerenciar/${inclusionChoice.scaleId}?novoPedido=1&nroPedido=${toNumber(
        row.NROPEDIDO,
      )}&seqPedido=${toNumber(row.SEQPEDIDO)}${
        inclusionChoice.returnToScale ? "&voltarEscala=1" : ""
      }`,
    );
  };

  const handleIncludeAllOrdersDay = async () => {
    if (!inclusionChoice) return;

    setIncludingDay(true);

    try {
      const result = await criarVinculosPedidosDiaEscala({
        id_escala: inclusionChoice.scaleId,
        nroempresa,
      });

      toast.success(
        result.message || "Todos os pedidos pendentes do dia foram incluídos.",
      );
      setInclusionChoice(null);
      await refreshAll();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível incluir todos os pedidos do dia.",
      );
    } finally {
      setIncludingDay(false);
    }
  };

  const openRequiredField = (
    row: EscalaLinha,
    day: string,
    rowScaleId: number,
    pendingOrders: EscalaLinha[],
    focusField: string,
  ) => {
    if (!canManage) return;

    if (row.STATUS_CONFIGURACAO === "PENDENTE_CRIAR_ESCALA") {
      navigate(`/escala/gerenciar?data=${day}&incluirPendentes=1`);
      return;
    }

    if (
      row.STATUS_CONFIGURACAO === "PENDENTE_INCLUSAO" &&
      rowScaleId > 0
    ) {
      openInclusionChoice(day, rowScaleId, pendingOrders, row, true);
      return;
    }

    if (rowScaleId <= 0) return;

    if (
      row.ORIGEM_REGISTRO === "MANUAL" &&
      toNumber(row.ID_ESCALA_ITEM_MANUAL) > 0
    ) {
      navigate(
        `/escala/gerenciar/${rowScaleId}?editarManual=${toNumber(
          row.ID_ESCALA_ITEM_MANUAL,
        )}&foco=${encodeURIComponent(focusField)}&voltarEscala=1`,
      );
      return;
    }

    if (toNumber(row.ID_ESCALA_PEDIDO_VINCULO) > 0) {
      navigate(
        `/escala/gerenciar/${rowScaleId}?editarPedido=${toNumber(
          row.ID_ESCALA_PEDIDO_VINCULO,
        )}&foco=${encodeURIComponent(focusField)}&voltarEscala=1`,
      );
    }
  };

  return (
    <div className="min-h-screen bg-[#F3F6FA] p-3 pb-20 lg:p-4">
      <div className="mx-auto max-w-[1900px] space-y-4">
        <header className="overflow-hidden rounded-2xl border border-[#D3DEE9] bg-white shadow-[0_4px_18px_rgba(23,61,110,0.06)]">
          <div
            className="grid h-1.5 grid-cols-[1fr_1fr_0.38fr]"
            aria-label="Cores institucionais Beauvallet"
          >
            <span className="bg-[#173D6E]" />
            <span className="bg-[#1B58A0]" />
            <span className="bg-[#E30613]" />
          </div>

          <div className="flex items-start gap-4 px-5 py-4 sm:px-6">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#D7E3EF] bg-[#EEF4FA]">
              <CalendarRange className="h-6 w-6 text-[#173D6E]" />
            </div>

            <div className="min-w-0">
              <p className="mb-0.5 text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#1B58A0]">
                Planejamento operacional
              </p>
              <h1 className="text-2xl font-extrabold tracking-tight text-[#173D6E]">
                Planejamento da Escala
              </h1>
              <p className="mt-1 text-xs font-medium text-[#60758A]">
                Acompanhe pedidos, pendências e informações operacionais pela data de abate.
              </p>
            </div>
          </div>
        </header>

        <Card className="overflow-hidden rounded-2xl border border-[#D3DEE9] bg-white shadow-[0_4px_18px_rgba(23,61,110,0.05)]">
          <div className="h-1 bg-[#173D6E]" />
          <CardContent className="p-4 sm:p-5">
            <div className="mx-auto flex max-w-full flex-col items-center justify-center gap-4 xl:flex-row xl:gap-6">
              <div className="shrink-0 text-center xl:min-w-[190px] xl:text-left">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#173D6E]">
                  Semana do planejamento
                </p>
                <p className="mt-1 text-sm font-bold text-[#526B82]">
                  {formatDate(dateStart)} a {formatDate(dateEnd)}
                </p>
              </div>

              <div className="flex max-w-full items-center justify-center gap-2.5">
                {loadingWeeks ? (
                  <div className="flex h-20 w-[520px] max-w-full items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-[#1B58A0]" />
                  </div>
                ) : (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-10 w-10 shrink-0 rounded-xl border-[#CBD9E7] text-[#173D6E] hover:border-[#1B58A0] hover:bg-[#EEF4FA]"
                      disabled={weekPage >= totalWeekPages - 1}
                      onClick={() =>
                        setWeekPage((current) =>
                          Math.min(totalWeekPages - 1, current + 1),
                        )
                      }
                      title="Ver semanas anteriores"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>

                    <div className="flex max-w-full items-center justify-center gap-2 overflow-hidden">
                      {Array.from({ length: WEEKS_PER_PAGE }, (_, index) => {
                        const option = visibleWeekSlots[index];

                        if (!option) {
                          return (
                            <div
                              key={`EMPTY-${index}`}
                              className="invisible h-20 w-24 shrink-0"
                            />
                          );
                        }

                        const selected = option.key === selectedWeek;

                        return (
                          <button
                            key={option.key}
                            type="button"
                            onClick={() => setSelectedWeek(option.key)}
                            className={`h-20 w-24 shrink-0 rounded-xl border px-2 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B58A0]/40 ${
                              selected
                                ? "border-[#173D6E] bg-[#173D6E] text-white shadow-[0_5px_14px_rgba(23,61,110,0.18)] ring-2 ring-[#1B58A0]/15"
                                : "border-[#CBD9E7] bg-white text-[#173D6E] hover:border-[#1B58A0] hover:bg-[#F4F8FC]"
                            }`}
                          >
                            <span className="block text-[9px] font-extrabold uppercase tracking-[0.1em] opacity-75">
                              Semana
                            </span>
                            <span className="block text-2xl font-extrabold leading-none">
                              {String(option.week).padStart(2, "0")}
                            </span>
                            <span className="mt-1 block text-[11px] font-bold">
                              {option.year}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {weekPage > 0 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-10 w-10 shrink-0 rounded-xl border-[#CBD9E7] text-[#173D6E] hover:border-[#1B58A0] hover:bg-[#EEF4FA]"
                        onClick={() =>
                          setWeekPage((current) => Math.max(0, current - 1))
                        }
                        title="Voltar para as semanas mais recentes"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    )}
                  </>
                )}
              </div>

              <Button
                variant="outline"
                size="sm"
                className="h-10 shrink-0 gap-2 rounded-xl border-[#BFCFDF] px-4 text-xs font-bold text-[#173D6E] hover:border-[#1B58A0] hover:bg-[#EEF4FA]"
                onClick={() => void refreshAll()}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Atualizar
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-[repeat(7,minmax(0,1fr))] gap-1 lg:gap-1.5 xl:gap-2">
          <WeekMetric
            icon={<CalendarDays />}
            label="Total de animais"
            value={numberFormat.format(weekTotals.plannedHeads)}
            helper={`${numberFormat.format(weekTotals.erpOrders)} pedidos ERP + ${numberFormat.format(weekTotals.manualRecords)} manuais`}
            accent="#173D6E"
          />
          <WeekMetric
            icon={<CalendarRange />}
            label="Média de animais/dia"
            value={decimalFormat.format(weekTotals.averageHeadsPerDay)}
            helper={`${numberFormat.format(weekTotals.daysWithAnimals)} dias com animais`}
            accent="#173D6E"
          />
          <WeekMetric
            icon={<ClipboardList />}
            label="Bois"
            value={numberFormat.format(weekTotals.bulls)}
            secondaryValue={`${percentFormat.format(weekTotals.bullsPercent)}%`}
            accent="#173D6E"
          />
          <WeekMetric
            icon={<ClipboardList />}
            label="Vacas"
            value={numberFormat.format(weekTotals.cows)}
            secondaryValue={`${percentFormat.format(weekTotals.cowsPercent)}%`}
            accent="#173D6E"
          />
          <WeekMetric
            icon={<CircleDollarSign />}
            label="Valor médio pago"
            value={currencyFormat.format(weekTotals.averagePaid)}
            helper="Média ponderada por animal"
            accent="#173D6E"
          />
          <WeekMetric
            icon={<BadgeCheck />}
            label="China"
            value={numberFormat.format(weekTotals.china)}
            secondaryValue={`${percentFormat.format(weekTotals.chinaPercent)}%`}
            accent="#173D6E"
          />
          <WeekMetric
            icon={<BadgeCheck />}
            label="Agrotools"
            value={numberFormat.format(weekTotals.agrotools)}
            secondaryValue={`${percentFormat.format(weekTotals.agrotoolsPercent)}%`}
            accent="#173D6E"
          />
        </div>

        {loading ? (
          <div className="flex min-h-[360px] flex-col items-center justify-center rounded-2xl border border-[#D3DEE9] bg-white shadow-[0_4px_18px_rgba(23,61,110,0.04)]">
            <Loader2 className="mb-3 h-8 w-8 animate-spin text-[#1B58A0]" />
            <p className="text-sm font-bold text-[#52677E]">
              Carregando pedidos e escalas...
            </p>
          </div>
        ) : visibleDays.length === 0 ? (
          <Card className="rounded-2xl border border-[#D3DEE9] bg-white shadow-[0_4px_18px_rgba(23,61,110,0.04)]">
            <CardContent className="p-10 text-center text-sm font-medium text-[#728398]">
              Nenhum pedido com data de abate nesta semana.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {visibleDays.map((day) => {
              const dayRows = getUniquePlanningRecords(rowsByDay.get(day) || []);
              const summary = summaryByDay.get(day);
              const idEscala = getScaleId(dayRows, summary);
              const scaleExists = Boolean(idEscala);
              const opened = openDays[day] !== false;
              const sexRows = splitRecordsBySex(dayRows).sort((a, b) => {
                const orderA = toNumber(a.row.NROPEDIDO);
                const orderB = toNumber(b.row.NROPEDIDO);
                if (orderA !== orderB) return orderA - orderB;
                return a.sex.localeCompare(b.sex);
              });
              const totals = calculateTotals(dayRows);
              const pendingDayOrders = dayRows.filter(
                (row) =>
                  row.ORIGEM_REGISTRO === "ERP" &&
                  row.STATUS_CONFIGURACAO === "PENDENTE_INCLUSAO",
              );
              const pendingInclusion = dayRows.filter((row) =>
                ["PENDENTE_CRIAR_ESCALA", "PENDENTE_INCLUSAO"].includes(
                  row.STATUS_CONFIGURACAO,
                ),
              ).length;
              const pendingComplement = dayRows.filter(
                (row) => row.STATUS_CONFIGURACAO === "PENDENTE_COMPLEMENTO",
              ).length;
              const scaleStatus = summary?.STATUS_ESCALA || dayRows[0]?.STATUS_ESCALA;
              const scaleVersion =
                toNumber(summary?.VERSAO) ||
                toNumber(dayRows[0]?.VERSAO_ESCALA) ||
                1;

              return (
                <Card
                  key={day}
                  className="overflow-hidden rounded-2xl border border-[#D3DEE9] bg-white shadow-[0_4px_18px_rgba(23,61,110,0.045)]"
                >
                  <div className="flex flex-col gap-3 border-b border-[#D6E1EB] bg-[#F7F9FC] p-3.5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="inline-flex items-center gap-2.5 rounded-lg border border-[#CBD9E7] bg-white px-3 py-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#EEF4FA] text-[#173D6E]">
                          <CalendarDays className="h-4 w-4" />
                        </span>
                        <h2 className="text-sm font-extrabold tracking-tight text-[#173D6E]">
                          {formatDayTitle(day)}
                        </h2>
                      </div>

                      {(pendingInclusion > 0 || pendingComplement > 0) && (
                        <span
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#F2C79F] bg-[#FFF7EE] px-2.5 text-[11px] font-extrabold text-[#A84A15]"
                          title={`${pendingInclusion} aguardando inclusão e ${pendingComplement} aguardando informações complementares`}
                        >
                          <AlertTriangle className="h-4 w-4 shrink-0" />
                          <span>{pendingInclusion + pendingComplement}</span>
                          <span className="hidden 2xl:inline">pendências</span>
                        </span>
                      )}

                      {scaleExists ? (
                        <Badge variant="outline" className={getStatusClass(scaleStatus)}>
                          {scaleStatus || "ABERTA"}
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-[#F2C79F] bg-[#FFF7EE] text-[#A84A15]"
                        >
                          Escala não criada
                        </Badge>
                      )}

                      <Badge
                        variant="outline"
                        className="inline-flex h-7 items-center rounded-md border-[#C3D0DC] bg-white px-2.5 text-[10px] font-extrabold text-[#334E68] shadow-none"
                      >
                        {dayRows.filter((row) => row.ORIGEM_REGISTRO === "ERP").length} pedidos ERP
                      </Badge>

                      <DayInlineMetric
                        label="Animais"
                        value={numberFormat.format(totals.plannedHeads)}
                      />
                      <DayInlineMetric
                        label="Bois"
                        value={`${numberFormat.format(totals.bulls)} • ${percentFormat.format(
                          totals.bullsPercent,
                        )}%`}
                      />
                      <DayInlineMetric
                        label="Vacas"
                        value={`${numberFormat.format(totals.cows)} • ${percentFormat.format(
                          totals.cowsPercent,
                        )}%`}
                      />
                      <DayInlineMetric
                        label="Preço médio"
                        value={currencyFormat.format(totals.averagePaid)}
                      />
                      <DayInlineMetric
                        label="Agrotools"
                        value={`${numberFormat.format(
                          totals.agrotools,
                        )} • ${percentFormat.format(totals.agrotoolsPercent)}%`}
                      />
                      <DayInlineMetric
                        label="China"
                        value={`${numberFormat.format(totals.china)} • ${percentFormat.format(
                          totals.chinaPercent,
                        )}%`}
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {canManage && !scaleExists && (
                        <Button
                          size="sm"
                          className="h-8 gap-2 rounded-lg bg-[#1B58A0] text-xs font-extrabold text-white hover:bg-[#173D6E]"
                          onClick={() =>
                            navigate(
                              `/escala/gerenciar?data=${day}&incluirPendentes=1`,
                            )
                          }
                        >
                          <CalendarPlus className="h-3.5 w-3.5" />
                          Criar escala
                        </Button>
                      )}

                      {canManage && scaleExists && idEscala && (
                        <>
                          {pendingDayOrders.length > 0 && (
                            <Button
                              size="sm"
                              className="h-8 gap-2 rounded-lg bg-[#1B58A0] text-xs font-extrabold text-white hover:bg-[#173D6E]"
                              onClick={() =>
                                openInclusionChoice(
                                  day,
                                  idEscala,
                                  pendingDayOrders,
                                )
                              }
                            >
                              <ListPlus className="h-3.5 w-3.5" />
                              Incluir pendentes ({pendingDayOrders.length})
                            </Button>
                          )}

                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 rounded-lg border-[#BFCFDF] text-xs font-extrabold text-[#173D6E] hover:border-[#1B58A0] hover:bg-[#EEF4FA]"
                            onClick={() => navigate(`/escala/gerenciar/${idEscala}`)}
                          >
                            Gerenciar
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 gap-2 rounded-lg border-[#9EC5D2] text-xs font-extrabold text-[#09759D] hover:bg-[#EFF8FA]"
                            onClick={() =>
                              navigate(`/escala/gerenciar/${idEscala}?novoManual=1`)
                            }
                          >
                            <FilePlus2 className="h-3.5 w-3.5" />
                            Adicionar manual
                          </Button>

                          <Button
                            size="icon"
                            variant="outline"
                            className="h-8 w-8 rounded-lg border-[#F0B8BC] text-[#C61F2A] hover:bg-[#FFF1F2]"
                            disabled={deletingScaleId === idEscala}
                            onClick={() =>
                              void handleInactivateScale(idEscala, scaleVersion, day)
                            }
                          >
                            {deletingScaleId === idEscala ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </>
                      )}

                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 rounded-lg text-[#52677E] hover:bg-[#EAF1F8] hover:text-[#173D6E]"
                        onClick={() =>
                          setOpenDays((current) => ({
                            ...current,
                            [day]: !opened,
                          }))
                        }
                      >
                        {opened ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {opened && (
                    <CardContent className="p-0">
                      <div className="w-full overflow-hidden">
                        <Table className="w-full table-fixed text-[12px]">
                          <TableHeader>
                            <TableRow className="border-b border-[#C9D7E5] bg-[#EAF1F7] hover:bg-[#EAF1F7]">
                              <TableHead className="w-[3%] h-12 border-r border-[#D7E2EC] px-1.5 text-[10px] font-extrabold uppercase leading-tight tracking-[0.03em] text-[#173D6E] text-center">
                                Editar
                              </TableHead>
                              <TableHead className="w-[7%] h-12 border-r border-[#D7E2EC] px-1.5 text-[10px] font-extrabold uppercase leading-tight tracking-[0.03em] text-[#173D6E]">
                                Data / pedido
                              </TableHead>
                              <TableHead className="w-[18%] h-12 border-r border-[#D7E2EC] px-1.5 text-[10px] font-extrabold uppercase leading-tight tracking-[0.03em] text-[#173D6E]">
                                Produtor / fazenda
                              </TableHead>
                              <TableHead className="w-[10%] h-12 border-r border-[#D7E2EC] px-1.5 text-[10px] font-extrabold uppercase leading-tight tracking-[0.03em] text-[#173D6E]">
                                Comprador
                              </TableHead>
                              <TableHead className="w-[4%] h-12 border-r border-[#D7E2EC] px-1.5 text-[10px] font-extrabold uppercase leading-tight tracking-[0.03em] text-[#173D6E] text-center">
                                Sexo
                              </TableHead>
                              <TableHead className="w-[4%] h-12 border-r border-[#D7E2EC] px-1.5 text-[10px] font-extrabold uppercase leading-tight tracking-[0.03em] text-[#173D6E] text-right">
                                Qtde
                              </TableHead>
                              <TableHead className="w-[7%] h-12 border-r border-[#D7E2EC] px-1.5 text-[10px] font-extrabold uppercase leading-tight tracking-[0.03em] text-[#173D6E] text-right">
                                Preço
                              </TableHead>
                              <TableHead className="w-[6%] h-12 border-r border-[#D7E2EC] px-1.5 text-[10px] font-extrabold uppercase leading-tight tracking-[0.03em] text-[#173D6E] text-right">
                                Prêmio
                              </TableHead>
                              <TableHead className="w-[5%] h-12 border-r border-[#D7E2EC] px-1.5 text-[10px] font-extrabold uppercase leading-tight tracking-[0.03em] text-[#173D6E] text-right">
                                Peso @
                              </TableHead>
                              <TableHead className="w-[4%] h-12 border-r border-[#D7E2EC] px-1.5 text-[10px] font-extrabold uppercase leading-tight tracking-[0.03em] text-[#173D6E] text-right">
                                Prazo
                              </TableHead>
                              <TableHead className="w-[4%] h-12 border-r border-[#D7E2EC] px-1.5 text-[10px] font-extrabold uppercase leading-tight tracking-[0.03em] text-[#173D6E] text-center">
                                Curral
                              </TableHead>
                              <TableHead className="w-[4%] h-12 border-r border-[#D7E2EC] px-1.5 text-[10px] font-extrabold uppercase leading-tight tracking-[0.03em] text-[#173D6E] text-right">
                                China
                              </TableHead>
                              <TableHead className="w-[6%] h-12 border-r border-[#D7E2EC] px-1.5 text-[10px] font-extrabold uppercase leading-tight tracking-[0.03em] text-[#173D6E] text-right">
                                Agrotools
                              </TableHead>
                              <TableHead className="w-[18%] h-12 px-2 text-[10px] font-extrabold uppercase leading-tight tracking-[0.03em] text-[#173D6E]">
                                Observação
                              </TableHead>
                            </TableRow>
                          </TableHeader>

                          <TableBody>
                            {sexRows.map((item) => {
                              const row = item.row;
                              const property = [
                                row.DESC_PROPRIEDADE,
                                row.CIDADE_PROPRIEDADE,
                                row.UF_PROPRIEDADE,
                              ]
                                .filter(Boolean)
                                .join(" • ");
                              const rowScaleId =
                                toNumber(row.ID_ESCALA) ||
                                toNumber(row.ID_ESCALA_SUGERIDA) ||
                                toNumber(idEscala);
                              const purchaseDate =
                                row.DTAPEDIDO || row.DATA_ABATE;
                              const observation =
                                row.OBSERVACAO_REGISTRO ||
                                row.OBSERVACAO_PEDIDO_ESCALA ||
                                "";
                              const seqCompradorErp = toNumber(
                                row.SEQCOMPRADOR_ERP,
                              );
                              const registroErp =
                                row.ORIGEM_REGISTRO === "ERP";
                              const compradorAutomaticoErp =
                                registroErp &&
                                seqCompradorErp > 0 &&
                                seqCompradorErp !== 1;
                              const compradorErpDaView =
                                String(row.COMPRADOR_ERP || "").trim();
                              const compradorEditado =
                                toNumber(row.ID_COMPRADOR_ESCALA) > 0
                                  ? String(row.COMPRADOR_ESCALA || "").trim()
                                  : "";

                              const compradorExibido = registroErp
                                ? compradorAutomaticoErp
                                  ? compradorErpDaView
                                  : compradorEditado
                                : String(
                                    row.COMPRADOR_ESCALA ||
                                      row.COMPRADOR_EXIBICAO ||
                                      "",
                                  ).trim();

                              const compradorErpNaoRetornado =
                                compradorAutomaticoErp &&
                                !compradorErpDaView;

                              return (
                                <TableRow
                                  key={item.key}
                                  className={`${getPlanningRowClass(
                                    row,
                                  )} border-b border-[#DCE5ED] transition-colors`}
                                >
                                  <TableCell className="px-1 py-2.5 text-center align-top">
                                    {canManage && (
                                      <div className="flex flex-col items-center justify-center gap-0.5">
                                        {row.STATUS_CONFIGURACAO ===
                                          "PENDENTE_CRIAR_ESCALA" && (
                                          <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-7 w-7 rounded-md text-[#D45B17] hover:bg-[#FFF2E5]"
                                            title="Criar escala para este dia"
                                            onClick={() =>
                                              navigate(`/escala/gerenciar?data=${day}&incluirPendentes=1`)
                                            }
                                          >
                                            <CalendarPlus className="h-3.5 w-3.5" />
                                          </Button>
                                        )}

                                        {row.STATUS_CONFIGURACAO ===
                                          "PENDENTE_INCLUSAO" &&
                                          rowScaleId > 0 && (
                                            <Button
                                              size="icon"
                                              variant="ghost"
                                              className="h-7 w-7 rounded-md text-[#1B58A0] hover:bg-[#EAF1F8]"
                                              title="Adicionar pedido à escala"
                                              onClick={() =>
                                                openInclusionChoice(
                                                  day,
                                                  rowScaleId,
                                                  pendingDayOrders,
                                                  row,
                                                )
                                              }
                                            >
                                              <Plus className="h-3.5 w-3.5" />
                                            </Button>
                                          )}

                                        {row.ORIGEM_REGISTRO === "ERP" &&
                                          toNumber(
                                            row.ID_ESCALA_PEDIDO_VINCULO,
                                          ) > 0 &&
                                          rowScaleId > 0 && (
                                            <Button
                                              size="icon"
                                              variant="ghost"
                                              className="h-7 w-7 rounded-md text-[#60758A] hover:bg-[#EAF1F8] hover:text-[#173D6E]"
                                              title="Editar informações do pedido"
                                              onClick={() =>
                                                navigate(
                                                  `/escala/gerenciar/${rowScaleId}?editarPedido=${toNumber(
                                                    row.ID_ESCALA_PEDIDO_VINCULO,
                                                  )}`,
                                                )
                                              }
                                            >
                                              <Pencil className="h-3.5 w-3.5" />
                                            </Button>
                                          )}

                                        {row.ORIGEM_REGISTRO === "MANUAL" &&
                                          rowScaleId > 0 && (
                                            <>
                                              <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-7 w-7 rounded-md text-[#60758A] hover:bg-[#EAF1F8] hover:text-[#173D6E]"
                                                title="Editar registro manual"
                                                onClick={() =>
                                                  navigate(
                                                    `/escala/gerenciar/${rowScaleId}?editarManual=${toNumber(
                                                      row.ID_ESCALA_ITEM_MANUAL,
                                                    )}`,
                                                  )
                                                }
                                              >
                                                <Pencil className="h-3.5 w-3.5" />
                                              </Button>

                                              <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-7 w-7 rounded-md text-[#C61F2A] hover:bg-[#FFF1F2] hover:text-[#A51D29]"
                                                disabled={
                                                  deletingManualId ===
                                                  toNumber(
                                                    row.ID_ESCALA_ITEM_MANUAL,
                                                  )
                                                }
                                                title="Apagar registro manual"
                                                onClick={() =>
                                                  void handleDeleteManual(row)
                                                }
                                              >
                                                {deletingManualId ===
                                                toNumber(
                                                  row.ID_ESCALA_ITEM_MANUAL,
                                                ) ? (
                                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                ) : (
                                                  <Trash2 className="h-3.5 w-3.5" />
                                                )}
                                              </Button>
                                            </>
                                          )}
                                      </div>
                                    )}
                                  </TableCell>

                                  <TableCell className="px-1.5 py-2.5 align-top">
                                    <p className="font-extrabold leading-tight text-[#173D6E]">
                                      {formatDate(purchaseDate)}
                                    </p>
                                    <p className="mt-1 truncate text-[10px] font-semibold text-[#667B91]">
                                      {row.ORIGEM_REGISTRO === "MANUAL"
                                        ? "REGISTRO MANUAL"
                                        : `Pedido ${toNumber(row.NROPEDIDO)}`}
                                    </p>
                                  </TableCell>

                                  <TableCell className="px-1.5 py-2.5 align-top">
                                    {row.PRODUTOR ? (
                                      <p
                                        className="truncate text-[12px] font-extrabold leading-tight text-[#173D6E]"
                                        title={row.PRODUTOR}
                                      >
                                        {row.PRODUTOR}
                                      </p>
                                    ) : row.ORIGEM_REGISTRO === "MANUAL" ? (
                                      <MissingFieldButton
                                        label="Nome do produtor não informado"
                                        onClick={() =>
                                          openRequiredField(
                                            row,
                                            day,
                                            rowScaleId,
                                            pendingDayOrders,
                                            "nome_produtor",
                                          )
                                        }
                                      />
                                    ) : (
                                      <span className="text-slate-400">—</span>
                                    )}
                                    <p
                                      className="mt-1 truncate text-[11px] font-semibold leading-tight text-[#526B82]"
                                      title={property}
                                    >
                                      {property || "—"}
                                    </p>
                                  </TableCell>

                                  <TableCell className="px-1.5 py-2.5 align-top font-bold leading-tight text-[#425B73]">
                                    {compradorExibido ? (
                                      <p
                                        className="line-clamp-3 break-words"
                                        title={compradorExibido}
                                      >
                                        {compradorExibido}
                                      </p>
                                    ) : compradorErpNaoRetornado ? (
                                      <span
                                        className="inline-flex w-full justify-center text-amber-600"
                                        title="O SEQCOMPRADOR_ERP é diferente de 1, mas o nome do comprador não foi retornado pela VCOV_ESCALAPLANEJAMENTO."
                                      >
                                        <AlertTriangle className="h-4 w-4" />
                                      </span>
                                    ) : (
                                      <MissingFieldButton
                                        label="Comprador responsável não informado"
                                        onClick={() =>
                                          openRequiredField(
                                            row,
                                            day,
                                            rowScaleId,
                                            pendingDayOrders,
                                            "comprador",
                                          )
                                        }
                                      />
                                    )}
                                  </TableCell>

                                  <TableCell className="px-1 py-2.5 text-center align-top">
                                    <span
                                      className={`inline-flex rounded-full border px-1.5 py-0.5 text-[10px] font-black ${
                                        item.sex === "VACA"
                                          ? "border-amber-200 bg-amber-50 text-amber-700"
                                          : "border-blue-200 bg-blue-50 text-blue-700"
                                      }`}
                                    >
                                      {item.sex}
                                    </span>
                                  </TableCell>

                                  <TableCell className="px-1.5 py-2.5 text-right align-top font-extrabold text-[#173D6E]">
                                    {numberFormat.format(item.quantity)}
                                  </TableCell>

                                  <TableCell className="px-1.5 py-2.5 text-right align-top font-extrabold text-[#173D6E]">
                                    {item.unitValue === null ? (
                                      row.ORIGEM_REGISTRO === "MANUAL" ? (
                                        <MissingFieldButton
                                          label={`Valor unitário de ${item.sex.toLowerCase()} não informado`}
                                          align="right"
                                          onClick={() =>
                                            openRequiredField(
                                              row,
                                              day,
                                              rowScaleId,
                                              pendingDayOrders,
                                              item.sex === "VACA"
                                                ? "vlrunitario_vaca"
                                                : "vlrunitario_boi",
                                            )
                                          }
                                        />
                                      ) : (
                                        <span
                                          className="text-amber-600"
                                          title="Preço não retornado pelo ERP"
                                        >
                                          <AlertTriangle className="ml-auto h-4 w-4" />
                                        </span>
                                      )
                                    ) : (
                                      currencyFormat.format(item.unitValue)
                                    )}
                                  </TableCell>

                                  <TableCell className="px-1.5 py-2.5 text-right align-top font-extrabold text-[#173D6E]">
                                    {row.VLRUNITARIO_PREMIO === null ||
                                    row.VLRUNITARIO_PREMIO === undefined ? (
                                      <MissingFieldButton
                                        label="Prêmio unitário não informado"
                                        align="right"
                                        onClick={() =>
                                          openRequiredField(
                                            row,
                                            day,
                                            rowScaleId,
                                            pendingDayOrders,
                                            "vlrunitario_premio",
                                          )
                                        }
                                      />
                                    ) : (
                                      currencyFormat.format(
                                        toNumber(row.VLRUNITARIO_PREMIO),
                                      )
                                    )}
                                  </TableCell>

                                  <TableCell className="px-1.5 py-2.5 text-right align-top font-bold text-[#334E68]">
                                    {item.arrobas === null ? (
                                      <MissingFieldButton
                                        label={`Peso em arrobas de ${item.sex.toLowerCase()} não informado`}
                                        align="right"
                                        onClick={() =>
                                          openRequiredField(
                                            row,
                                            day,
                                            rowScaleId,
                                            pendingDayOrders,
                                            item.sex === "VACA"
                                              ? "arrobas_vaca"
                                              : "arrobas_boi",
                                          )
                                        }
                                      />
                                    ) : (
                                      decimalFormat.format(item.arrobas)
                                    )}
                                  </TableCell>

                                  <TableCell className="px-1.5 py-2.5 text-right align-top font-bold text-[#334E68]">
                                    {row.PRAZO_DIAS === null ||
                                    row.PRAZO_DIAS === undefined ? (
                                      <MissingFieldButton
                                        label="Prazo não informado"
                                        align="right"
                                        onClick={() =>
                                          openRequiredField(
                                            row,
                                            day,
                                            rowScaleId,
                                            pendingDayOrders,
                                            "prazo_dias",
                                          )
                                        }
                                      />
                                    ) : (
                                      numberFormat.format(
                                        toNumber(row.PRAZO_DIAS),
                                      )
                                    )}
                                  </TableCell>

                                  <TableCell className="px-1 py-2.5 text-center align-top font-bold text-[#425B73]">
                                    {row.CURRAL ? (
                                      <p className="truncate" title={row.CURRAL}>
                                        {row.CURRAL}
                                      </p>
                                    ) : (
                                      <MissingFieldButton
                                        label="Curral não informado"
                                        align="center"
                                        onClick={() =>
                                          openRequiredField(
                                            row,
                                            day,
                                            rowScaleId,
                                            pendingDayOrders,
                                            "curral",
                                          )
                                        }
                                      />
                                    )}
                                  </TableCell>

                                  <TableCell className="px-1 py-2.5 text-right align-top font-bold text-[#334E68]">
                                    {numberFormat.format(item.chinaQuantity)}
                                  </TableCell>

                                  <TableCell className="px-1.5 py-2.5 text-right align-top font-extrabold text-[#173D6E]">
                                    {numberFormat.format(item.agrotoolsQuantity)}
                                  </TableCell>

                                  <TableCell className="border-l border-[#D4E0EA] bg-white/35 px-2 py-2.5 align-top text-[#425B73]">
                                    <p
                                      className="line-clamp-3 break-words text-[11px] font-medium leading-[1.35]"
                                      title={observation || "Sem observação"}
                                    >
                                      {observation || "—"}
                                    </p>
                                  </TableCell>

                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {inclusionChoice && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#102A43]/55 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="inclusion-choice-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !includingDay) {
              setInclusionChoice(null);
            }
          }}
        >
          <Card className="w-full max-w-lg overflow-hidden rounded-2xl border border-[#D3DEE9] bg-white shadow-2xl">
            <CardContent className="space-y-5 p-5">
              <div>
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-[#EEF4FA] text-[#173D6E]">
                  <ListPlus className="h-5 w-5" />
                </div>
                <h2
                  id="inclusion-choice-title"
                  className="text-lg font-extrabold text-[#173D6E]"
                >
                  Como deseja incluir?
                </h2>
                <p className="mt-1 text-sm text-[#60758A]">
                  Data de abate: {formatDate(inclusionChoice.day)}. Existem{" "}
                  <strong>
                    {inclusionChoice.pendingOrders.length} pedidos pendentes
                  </strong>{" "}
                  neste dia.
                </p>
              </div>

              <div className="rounded-xl border border-[#F2C79F] bg-[#FFF7EE] p-3 text-xs text-[#8F4317]">
                Os pedidos serão vinculados sem comprador e sem prêmio. Depois
                continuarão destacados como <strong>Faltam informações</strong>
                até o preenchimento desses campos.
              </div>

              <div className="grid gap-2">
                {inclusionChoice.selectedRow && (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-auto min-h-11 justify-start gap-3 px-4 py-3 text-left"
                    disabled={includingDay}
                    onClick={handleIncludeSingleOrder}
                  >
                    <Plus className="h-4 w-4 shrink-0" />
                    <span>
                      <strong className="block">
                        Incluir somente o pedido {toNumber(
                          inclusionChoice.selectedRow.NROPEDIDO,
                        )}
                      </strong>
                      <span className="text-xs font-normal text-slate-500">
                        Abre o formulário para confirmar a inclusão individual.
                      </span>
                    </span>
                  </Button>
                )}

                <Button
                  type="button"
                  className="h-auto min-h-11 justify-start gap-3 px-4 py-3 text-left"
                  disabled={includingDay}
                  onClick={() => void handleIncludeAllOrdersDay()}
                >
                  {includingDay ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                  ) : (
                    <ListPlus className="h-4 w-4 shrink-0" />
                  )}
                  <span>
                    <strong className="block">
                      Incluir todos os {inclusionChoice.pendingOrders.length}{" "}
                      pedidos do dia
                    </strong>
                    <span className="text-xs font-normal opacity-80">
                      Vincula todos de uma só vez à escala deste dia.
                    </span>
                  </span>
                </Button>
              </div>

              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={includingDay}
                  onClick={() => setInclusionChoice(null)}
                >
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function MissingFieldButton({
  label,
  onClick,
  align = "left",
}: {
  label: string;
  onClick: () => void;
  align?: "left" | "center" | "right";
}) {
  const alignment =
    align === "right"
      ? "justify-end"
      : align === "center"
        ? "justify-center"
        : "justify-start";

  return (
    <button
      type="button"
      className={`flex w-full ${alignment} text-[#D44315] transition hover:text-[#A93A15] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EE7218]/50`}
      title={`${label}. Clique para preencher.`}
      aria-label={`${label}. Clique para preencher.`}
      onClick={onClick}
    >
      <AlertTriangle className="h-4 w-4 shrink-0" />
    </button>
  );
}

function WeekMetric({
  icon,
  label,
  value,
  secondaryValue,
  helper,
  accent,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  secondaryValue?: string;
  helper?: string;
  accent: string;
}) {
  return (
    <Card
      className="min-w-0 overflow-hidden rounded-lg border border-[#C9D7E5] bg-white shadow-[0_2px_9px_rgba(23,61,110,0.04)] transition-shadow hover:shadow-[0_4px_14px_rgba(23,61,110,0.07)]"
      title={`${label}: ${value}${secondaryValue ? ` — ${secondaryValue}` : ""}${
        helper ? ` — ${helper}` : ""
      }`}
    >
      <div className="h-1 w-full" style={{ backgroundColor: accent }} />

      <CardContent className="flex min-w-0 items-center gap-1 p-1.5 min-[1180px]:gap-1.5 min-[1180px]:p-2 xl:p-2.5">
        <div className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[#DCE6EF] bg-[#F0F5FA] text-[#173D6E] min-[1280px]:flex xl:h-8 xl:w-8 [&>svg]:h-3.5 [&>svg]:w-3.5">
          {icon}
        </div>

        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 min-h-[24px] break-words text-[clamp(0.5rem,0.62vw,0.72rem)] font-black leading-[1.08] tracking-[-0.01em] text-[#173D6E]">
            {label}
          </p>

          <div className="mt-0.5 flex min-w-0 flex-nowrap items-baseline gap-[clamp(0.1rem,0.25vw,0.35rem)]">
            <p className="whitespace-nowrap text-[clamp(0.62rem,0.92vw,1.15rem)] font-black leading-none text-[#173D6E]">
              {value}
            </p>

            {secondaryValue && (
              <p className="whitespace-nowrap text-[clamp(0.58rem,0.86vw,1.08rem)] font-black leading-none text-[#173D6E]">
                {secondaryValue}
              </p>
            )}
          </div>

          {helper && (
            <p className="mt-0.5 hidden truncate text-[8px] font-semibold leading-tight text-[#718297] min-[1540px]:block">
              {helper}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function DayInlineMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <span
      className="inline-flex h-7 items-center gap-1.5 rounded-md border border-[#C3D0DC] bg-white px-2.5 shadow-none"
      title={`${label}: ${value}`}
    >
      <span className="whitespace-nowrap text-[9px] font-extrabold uppercase tracking-[0.04em] text-[#52677E]">
        {label}
      </span>

      <span className="whitespace-nowrap text-[12px] font-black leading-none text-[#173D6E]">
        {value}
      </span>
    </span>
  );
}