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
  FileSpreadsheet,
  ListPlus,
  Loader2,
  MapPin,
  MapPinOff,
  Navigation,
  Play,
  Pencil,
  Plus,
  RefreshCw,
  Settings2,
  Sparkles,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
  consultarEscala,
  consultarResumoEscala,
  criarVinculoPedidoEscala,
  criarVinculosPedidosDiaEscala,
  editarRegistroManualEscala,
  editarVinculoPedidoEscala,
  inativarEscala,
  inativarRegistroManualEscala,
} from "@/services/escala";
import {
  api,
  fetchPecuaristasAgendamento,
  fetchUsuarios,
  type ApiHistoricoCompra,
  type ApiRancher,
  type ApiUsuario,
} from "@/services/api";
import type {
  EscalaLinha,
  EscalaResumo,
  EscalaStatus,
} from "@/types/escala";
import { EscalaPlaybackDialog } from "@/components/EscalaPlaybackDialog";
import {
  getAnimalBasePrice,
  getEffectivePremium,
} from "@/lib/escala-pricing";
import { exportScalePlanningToExcel } from "@/lib/escala-excel";
import {
  addDays,
  formatDateInput,
  getAgrotoolsPlannedQuantity,
  getAgrotoolsPlannedTotal,
  getInitialPlanningWeek,
  getISOWeekValue,
  getNextISOWeekValue,
  getStartDateFromWeek,
  getWeekCatalogRange,
  getWeekValueFromDate,
  hasPlanningSummaryData,
  parseLocalDate,
} from "@/lib/escala-planning";
import {
  buildManualUpdatePayload,
  buildOrderUpdatePayload,
} from "@/lib/escala-update";

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
type ChinaPeriodPreset = "2m" | "3m" | "6m" | "12m" | "manual";

interface ChinaPeriodConfig {
  startMonth: string;
  endMonth: string;
  buttonLabel: string;
  descriptionLabel: string;
}

interface ChinaSuggestionMeta {
  suggestedQuantity: number;
  chinaAnimals: number;
  totalAnimals: number;
  chinaPercent: number;
  periodLabel: string;
}

interface PlanningSexRow {
  key: string;
  row: EscalaLinha;
  sex: AnimalSex;
  quantity: number;
  arrobas: number | null;
  unitValue: number | null;
  chinaQuantity: number;
  chinaSuggestedQuantity: number | null;
  chinaSuggestionMeta: ChinaSuggestionMeta | null;
  agrotoolsQuantity: number;
}

interface ChinaSuggestionState {
  item: PlanningSexRow;
  day: string;
  scaleId: number | null;
}

interface InclusionChoiceState {
  day: string;
  scaleId: number;
  selectedRow: EscalaLinha | null;
  pendingOrders: EscalaLinha[];
  returnToScale?: boolean;
}

interface PlanningLocation {
  latitude: number;
  longitude: number;
  producer: string;
  farm: string;
}

interface PlanningLocationDirectory {
  byCodeAndFarm: Map<string, PlanningLocation>;
  byNameAndFarm: Map<string, PlanningLocation>;
  byUniqueCode: Map<number, PlanningLocation>;
}

type InlineEditableField =
  | "nome_produtor"
  | "comprador"
  | "vlrunitario_vaca"
  | "vlrunitario_boi"
  | "vlrunitario_premio"
  | "arrobas_vaca"
  | "arrobas_boi"
  | "prazo_dias"
  | "curral"
  | "observacao";

interface InlineEditState {
  row: EscalaLinha;
  day: string;
  rowScaleId: number;
  pendingOrders: EscalaLinha[];
  focusField: InlineEditableField;
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

interface PlanningDaySubtotal {
  quantity: number;
  averagePrice: number | null;
  curral: number;
  china: number;
  agrotools: number;
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

const toCoordinate = (value: unknown, limit: number): number | null => {
  if (value === null || value === undefined || String(value).trim() === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && Math.abs(parsed) <= limit ? parsed : null;
};

const getLocationPairKey = (first: unknown, second: unknown) =>
  `${normalizeText(first)}|${normalizeText(second)}`;

const buildPlanningLocationDirectory = (
  ranchers: ApiRancher[],
): PlanningLocationDirectory => {
  const byCodeAndFarm = new Map<string, PlanningLocation>();
  const byNameAndFarm = new Map<string, PlanningLocation>();
  const locationsByCode = new Map<number, PlanningLocation[]>();

  for (const rancher of ranchers) {
    const latitude = toCoordinate(rancher.LATITUDE, 90);
    const longitude = toCoordinate(rancher.LONGITUDE, 180);
    if (latitude === null || longitude === null) continue;

    const location: PlanningLocation = {
      latitude,
      longitude,
      producer: String(rancher.NOME_PRODUTOR || "Produtor").trim(),
      farm: String(rancher.NOME_FAZENDA || "Propriedade").trim(),
    };
    const producerCode = Number(rancher.COD_PRODUTOR);

    if (Number.isFinite(producerCode) && producerCode > 0) {
      byCodeAndFarm.set(
        getLocationPairKey(producerCode, rancher.NOME_FAZENDA),
        location,
      );
      const candidates = locationsByCode.get(producerCode) || [];
      candidates.push(location);
      locationsByCode.set(producerCode, candidates);
    }

    byNameAndFarm.set(
      getLocationPairKey(rancher.NOME_PRODUTOR, rancher.NOME_FAZENDA),
      location,
    );
  }

  const byUniqueCode = new Map<number, PlanningLocation>();
  for (const [producerCode, locations] of locationsByCode) {
    const uniqueCoordinates = new Set(
      locations.map(
        (location) => `${location.latitude}|${location.longitude}`,
      ),
    );
    if (uniqueCoordinates.size === 1) {
      byUniqueCode.set(producerCode, locations[0]);
    }
  }

  return { byCodeAndFarm, byNameAndFarm, byUniqueCode };
};

const resolvePlanningLocation = (
  row: EscalaLinha,
  directory: PlanningLocationDirectory,
): PlanningLocation | null => {
  const producerCode = toNumber(row.SEQPRODUTOR);
  const farm = row.DESC_PROPRIEDADE;

  if (producerCode > 0 && farm) {
    const exact = directory.byCodeAndFarm.get(
      getLocationPairKey(producerCode, farm),
    );
    if (exact) return exact;
  }

  if (row.PRODUTOR && farm) {
    const exact = directory.byNameAndFarm.get(
      getLocationPairKey(row.PRODUTOR, farm),
    );
    if (exact) return exact;
  }

  return producerCode > 0
    ? directory.byUniqueCode.get(producerCode) || null
    : null;
};

const getInlineFieldLabel = (field: InlineEditableField) => {
  switch (field) {
    case "nome_produtor":
      return "nome do produtor";
    case "comprador":
      return "comprador responsável";
    case "vlrunitario_vaca":
      return "valor unitário das vacas";
    case "vlrunitario_boi":
      return "valor unitário dos bois";
    case "vlrunitario_premio":
      return "prêmio unitário";
    case "arrobas_vaca":
      return "arrobas das vacas";
    case "arrobas_boi":
      return "arrobas dos bois";
    case "prazo_dias":
      return "prazo em dias";
    case "curral":
      return "curral";
    case "observacao":
      return "observação";
    default:
      return "campo";
  }
};

const getInlineFieldValue = (
  row: EscalaLinha,
  field: InlineEditableField,
): string => {
  switch (field) {
    case "nome_produtor":
      return String(row.PRODUTOR || "");
    case "curral":
      return row.CURRAL == null ? "" : String(row.CURRAL);
    case "observacao":
      return String(
        row.OBSERVACAO_PEDIDO_ESCALA || row.OBSERVACAO_REGISTRO || "",
      );
    case "vlrunitario_vaca":
      return getAnimalBasePrice(row, "VACA") === null
        ? ""
        : String(getAnimalBasePrice(row, "VACA"));
    case "vlrunitario_boi":
      return getAnimalBasePrice(row, "BOI") === null
        ? ""
        : String(getAnimalBasePrice(row, "BOI"));
    case "vlrunitario_premio":
      return getEffectivePremium(row) === null
        ? ""
        : String(getEffectivePremium(row));
    case "arrobas_vaca":
      return row.ARROBAS_VACA === null || row.ARROBAS_VACA === undefined
        ? ""
        : String(row.ARROBAS_VACA);
    case "arrobas_boi":
      return row.ARROBAS_BOI === null || row.ARROBAS_BOI === undefined
        ? ""
        : String(row.ARROBAS_BOI);
    case "prazo_dias":
      return row.PRAZO_DIAS === null || row.PRAZO_DIAS === undefined
        ? ""
        : String(row.PRAZO_DIAS);
    default:
      return "";
  }
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

const CHINA_PERIOD_OPTIONS: Array<{
  value: ChinaPeriodPreset;
  label: string;
  description: string;
}> = [
  { value: "2m", label: "2 meses", description: "Janela curta e mais recente." },
  { value: "3m", label: "3 meses", description: "Equilíbrio entre volume e recência." },
  { value: "6m", label: "6 meses", description: "Base semestral para suavizar oscilações." },
  { value: "12m", label: "1 ano", description: "Padrão da tela para histórico anual." },
  { value: "manual", label: "Manual", description: "Escolha a data inicial e final." },
];

const getMonthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const parseDateValue = (value: string) => {
  if (!value) return null;

  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getChinaPeriodConfig = (
  preset: ChinaPeriodPreset,
  manualStart: string,
  manualEnd: string,
): ChinaPeriodConfig | null => {
  if (preset === "manual") {
    const start = parseDateValue(manualStart);
    const end = parseDateValue(manualEnd);

    if (!start || !end || start > end) {
      return null;
    }

    return {
      startMonth: getMonthKey(start),
      endMonth: getMonthKey(end),
      buttonLabel: "Manual",
      descriptionLabel: `${start.toLocaleDateString("pt-BR")} a ${end.toLocaleDateString("pt-BR")}`,
    };
  }

  const monthsMap: Record<Exclude<ChinaPeriodPreset, "manual">, number> = {
    "2m": 2,
    "3m": 3,
    "6m": 6,
    "12m": 12,
  };

  const labels: Record<Exclude<ChinaPeriodPreset, "manual">, string> = {
    "2m": "2 meses",
    "3m": "3 meses",
    "6m": "6 meses",
    "12m": "1 ano",
  };

  const descriptions: Record<Exclude<ChinaPeriodPreset, "manual">, string> = {
    "2m": "2 meses",
    "3m": "3 meses",
    "6m": "6 meses",
    "12m": "12 meses",
  };

  const today = new Date();
  const months = monthsMap[preset];
  const start = new Date(today.getFullYear(), today.getMonth() - (months - 1), 1, 12);

  return {
    startMonth: getMonthKey(start),
    endMonth: getMonthKey(today),
    buttonLabel: labels[preset],
    descriptionLabel: descriptions[preset],
  };
};

const buildChinaSuggestion = (
  item: Pick<PlanningSexRow, "row" | "quantity">,
  history: ApiHistoricoCompra[],
  periodConfig: ChinaPeriodConfig | null,
): ChinaSuggestionMeta | null => {
  const producerId = toNumber(item.row.SEQPRODUTOR);

  if (
    item.row.ORIGEM_REGISTRO !== "ERP" ||
    producerId <= 0 ||
    item.quantity <= 0 ||
    !periodConfig
  ) {
    return null;
  }

  const relevantHistory = history.filter(
    (entry) =>
      Number(entry.COD_PRODUTOR) === producerId &&
      entry.MES_ANO >= periodConfig.startMonth &&
      entry.MES_ANO <= periodConfig.endMonth,
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
  const suggestedQuantity = Math.max(
    0,
    Math.min(item.quantity, Math.round(item.quantity * chinaPercent)),
  );

  return {
    suggestedQuantity,
    chinaAnimals,
    totalAnimals,
    chinaPercent,
    periodLabel: periodConfig.descriptionLabel,
  };
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

const getChinaPlannedTotal = (row: EscalaLinha) =>
  toNumber(row.QTD_CHINA_VACA) + toNumber(row.QTD_CHINA_BOI);

const getDisplayedChinaQuantity = (item: PlanningSexRow) =>
  item.chinaSuggestionMeta &&
  item.chinaSuggestionMeta.suggestedQuantity !== item.chinaQuantity
    ? item.chinaSuggestionMeta.suggestedQuantity
    : item.chinaQuantity;

const calculatePlanningDaySubtotal = (
  rows: PlanningSexRow[],
  records: EscalaLinha[],
): PlanningDaySubtotal => {
  const subtotal = rows.reduce(
    (accumulator, item) => {
      accumulator.quantity += item.quantity;
      accumulator.china += getDisplayedChinaQuantity(item);
      accumulator.agrotools += item.agrotoolsQuantity;

      if (item.unitValue !== null && item.unitValue > 0) {
        accumulator.weightedValue += item.unitValue * item.quantity;
        accumulator.weightedQuantity += item.quantity;
      }

      return accumulator;
    },
    {
      quantity: 0,
      china: 0,
      agrotools: 0,
      weightedValue: 0,
      weightedQuantity: 0,
    },
  );

  return {
    quantity: subtotal.quantity,
    averagePrice:
      subtotal.weightedQuantity > 0
        ? subtotal.weightedValue / subtotal.weightedQuantity
        : null,
    curral: getUniquePlanningRecords(records).reduce(
      (total, row) => total + toNumber(row.CURRAL),
      0,
    ),
    china: subtotal.china,
    agrotools: subtotal.agrotools,
  };
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

const resolvePlanningBuyerName = (row: EscalaLinha) => {
  const seqCompradorErp = toNumber(row.SEQCOMPRADOR_ERP);
  const registroErp = row.ORIGEM_REGISTRO === "ERP";
  const compradorAutomaticoErp =
    registroErp &&
    seqCompradorErp > 0 &&
    seqCompradorErp !== 1;
  const compradorErpDaView = String(row.COMPRADOR_ERP || "").trim();
  const compradorEditado =
    toNumber(row.ID_COMPRADOR_ESCALA) > 0
      ? String(row.COMPRADOR_ESCALA || "").trim()
      : "";

  return registroErp
    ? compradorAutomaticoErp
      ? compradorErpDaView
      : compradorEditado
    : String(row.COMPRADOR_ESCALA || row.COMPRADOR_EXIBICAO || "").trim();
};

const shouldWarnMissingPlanningBuyer = (row: EscalaLinha) => {
  const seqCompradorErp = toNumber(row.SEQCOMPRADOR_ERP);
  const registroErp = row.ORIGEM_REGISTRO === "ERP";
  const compradorAutomaticoErp =
    registroErp &&
    seqCompradorErp > 0 &&
    seqCompradorErp !== 1;
  const compradorErpDaView = String(row.COMPRADOR_ERP || "").trim();

  return compradorAutomaticoErp && !compradorErpDaView;
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
          getAnimalBasePrice(row, sex),
        chinaQuantity:
          sex === "VACA"
            ? toNumber(row.QTD_CHINA_VACA)
            : toNumber(row.QTD_CHINA_BOI),
        chinaSuggestedQuantity: null,
        chinaSuggestionMeta: null,
        agrotoolsQuantity:
          getAgrotoolsPlannedQuantity(row, sex),
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
      totals.china += getChinaPlannedTotal(row);
      totals.agrotools += getAgrotoolsPlannedTotal(row);

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
  const today = useMemo(() => new Date(), []);
  const defaultManualStart = useMemo(
    () =>
      formatDateInput(
        new Date(today.getFullYear(), today.getMonth() - 11, 1, 12),
      ),
    [today],
  );
  const defaultManualEnd = useMemo(() => formatDateInput(today), [today]);

  const [selectedWeek, setSelectedWeek] = useState(getISOWeekValue);
  const [initialWeekResolved, setInitialWeekResolved] = useState(false);
  const [availableSummaries, setAvailableSummaries] = useState<EscalaResumo[]>(
    [],
  );
  const [lines, setLines] = useState<EscalaLinha[]>([]);
  const [historicoCompras, setHistoricoCompras] = useState<ApiHistoricoCompra[]>(
    [],
  );
  const [ranchers, setRanchers] = useState<ApiRancher[]>([]);
  const [locationDialog, setLocationDialog] =
    useState<PlanningLocation | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingWeeks, setLoadingWeeks] = useState(true);
  const [loadingChinaHistory, setLoadingChinaHistory] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [openDays, setOpenDays] = useState<Record<string, boolean>>({});
  const [weekPage, setWeekPage] = useState(0);
  const [deletingScaleId, setDeletingScaleId] = useState<number | null>(null);
  const [deletingManualId, setDeletingManualId] = useState<number | null>(null);
  const [inclusionChoice, setInclusionChoice] =
    useState<InclusionChoiceState | null>(null);
  const [includingDay, setIncludingDay] = useState(false);
  const [chinaConfigOpen, setChinaConfigOpen] = useState(false);
  const [chinaPeriodPreset, setChinaPeriodPreset] =
    useState<ChinaPeriodPreset>("12m");
  const [chinaManualStart, setChinaManualStart] = useState(defaultManualStart);
  const [chinaManualEnd, setChinaManualEnd] = useState(defaultManualEnd);
  const [chinaSuggestionState, setChinaSuggestionState] =
    useState<ChinaSuggestionState | null>(null);
  const [savingChinaSuggestionKey, setSavingChinaSuggestionKey] = useState<
    string | null
  >(null);
  const [playbackDialogOpen, setPlaybackDialogOpen] = useState(false);
  const [inlineEditState, setInlineEditState] =
    useState<InlineEditState | null>(null);
  const [inlineEditValue, setInlineEditValue] = useState("");
  const [inlineBuyerUsers, setInlineBuyerUsers] = useState<ApiUsuario[]>([]);
  const [inlineBuyerSearch, setInlineBuyerSearch] = useState("");
  const [inlineSelectedBuyerId, setInlineSelectedBuyerId] = useState<
    number | null
  >(null);
  const [loadingInlineBuyers, setLoadingInlineBuyers] = useState(false);
  const [inlineConfirmOpen, setInlineConfirmOpen] = useState(false);
  const [savingInlineEdit, setSavingInlineEdit] = useState(false);

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
  const chinaPeriodConfig = useMemo(
    () =>
      getChinaPeriodConfig(chinaPeriodPreset, chinaManualStart, chinaManualEnd),
    [chinaManualEnd, chinaManualStart, chinaPeriodPreset],
  );
  const locationDirectory = useMemo(
    () => buildPlanningLocationDirectory(ranchers),
    [ranchers],
  );
  const inlineSelectedBuyer = useMemo(
    () =>
      inlineBuyerUsers.find(
        (buyer) => Number(buyer.SEQUSUARIO) === inlineSelectedBuyerId,
      ) || null,
    [inlineBuyerUsers, inlineSelectedBuyerId],
  );
  const inlineBuyerSuggestions = useMemo(() => {
    if (inlineEditState?.focusField !== "comprador") return [];

    const term = normalizeText(inlineBuyerSearch);

    return inlineBuyerUsers
      .filter((buyer) => {
        if (!term) return true;
        return (
          normalizeText(buyer.CODUSUARIO).includes(term) ||
          String(buyer.SEQUSUARIO).includes(term)
        );
      })
      .slice(0, 30);
  }, [inlineBuyerSearch, inlineBuyerUsers, inlineEditState]);

  useEffect(() => {
    if (!inlineEditState) return;

    setInlineEditValue(
      getInlineFieldValue(inlineEditState.row, inlineEditState.focusField),
    );

    if (inlineEditState.focusField !== "comprador") return;

    const currentBuyerId =
      toNumber(inlineEditState.row.ID_COMPRADOR_ESCALA) > 0
        ? toNumber(inlineEditState.row.ID_COMPRADOR_ESCALA)
        : null;

    setInlineSelectedBuyerId(currentBuyerId);
    setInlineBuyerSearch(
      currentBuyerId
        ? String(inlineEditState.row.COMPRADOR_ESCALA || "").trim()
        : "",
    );

    if (inlineBuyerUsers.length > 0) return;

    let cancelled = false;

    const loadBuyers = async () => {
      setLoadingInlineBuyers(true);
      try {
        const data = await fetchUsuarios();
        const safe = (Array.isArray(data) ? data : [])
          .filter(
            (buyer) =>
              Number(buyer.SEQUSUARIO) > 0 &&
              normalizeText(buyer.CODUSUARIO),
          )
          .sort((a, b) =>
            normalizeText(a.CODUSUARIO).localeCompare(
              normalizeText(b.CODUSUARIO),
              "pt-BR",
            ),
          );

        if (!cancelled) {
          setInlineBuyerUsers(safe);
        }
      } catch {
        if (!cancelled) {
          setInlineBuyerUsers([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingInlineBuyers(false);
        }
      }
    };

    void loadBuyers();

    return () => {
      cancelled = true;
    };
  }, [inlineBuyerUsers.length, inlineEditState]);

  const loadChinaHistory = async (forceRefresh = false) => {
    setLoadingChinaHistory(true);

    try {
      const data = await api.fetchHistoricoCompras(forceRefresh);
      setHistoricoCompras(Array.isArray(data) ? data : []);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar o histórico de China.",
      );
      setHistoricoCompras([]);
    } finally {
      setLoadingChinaHistory(false);
    }
  };

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

  const loadData = async (showLoading = true) => {
    if (showLoading) setLoading(true);

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
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    void loadWeekCatalog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nroempresa]);

  useEffect(() => {
    let cancelled = false;
    const referenceDate = new Date();
    const currentWeek = getISOWeekValue(referenceDate);
    const nextReferenceDate = new Date(referenceDate);
    nextReferenceDate.setDate(nextReferenceDate.getDate() + 7);
    const nextWeek = getISOWeekValue(nextReferenceDate);

    setInitialWeekResolved(false);

    const resolveInitialWeek = async () => {
      try {
        const data = await consultarEscala({
          nroempresa,
          data_inicio: getStartDateFromWeek(currentWeek),
          data_fim: addDays(getStartDateFromWeek(nextWeek), 6),
        });

        if (!cancelled) {
          setSelectedWeek(
            getInitialPlanningWeek(
              Array.isArray(data) ? data : [],
              referenceDate,
            ),
          );
        }
      } catch {
        if (!cancelled) setSelectedWeek(currentWeek);
      } finally {
        if (!cancelled) setInitialWeekResolved(true);
      }
    };

    void resolveInitialWeek();
    return () => {
      cancelled = true;
    };
  }, [nroempresa]);

  useEffect(() => {
    void loadChinaHistory();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadRancherLocations = async () => {
      try {
        const data = await fetchPecuaristasAgendamento(true);
        if (!cancelled) setRanchers(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setRanchers([]);
      }
    };

    void loadRancherLocations();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!initialWeekResolved) return;
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateStart, dateEnd, initialWeekResolved, nroempresa]);

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

  const firstScaleShortcut = useMemo(() => {
    for (const day of visibleDays) {
      const dayRows = getUniquePlanningRecords(rowsByDay.get(day) || []);
      const summary = summaryByDay.get(day);
      const idEscala = getScaleId(dayRows, summary);

      if (idEscala) {
        return { day, idEscala };
      }
    }

    return null;
  }, [rowsByDay, summaryByDay, visibleDays]);

  const inlineEditPreview = useMemo(() => {
    if (!inlineEditState) return "";

    if (inlineEditState.focusField === "comprador") {
      return inlineSelectedBuyer
        ? inlineSelectedBuyer.CODUSUARIO
        : inlineBuyerSearch.trim();
    }

    return inlineEditValue.trim();
  }, [
    inlineBuyerSearch,
    inlineEditState,
    inlineEditValue,
    inlineSelectedBuyer,
  ]);
  const inlineEditRowKey = useMemo(
    () => (inlineEditState ? getPlanningKey(inlineEditState.row) : ""),
    [inlineEditState],
  );
  const isInlineEditing = (
    row: EscalaLinha,
    field: InlineEditableField,
  ) =>
    Boolean(
      inlineEditState &&
        inlineEditState.focusField === field &&
        inlineEditRowKey === getPlanningKey(row),
    );
  const inlineNumericField =
    inlineEditState &&
    [
      "vlrunitario_vaca",
      "vlrunitario_boi",
      "vlrunitario_premio",
      "arrobas_vaca",
      "arrobas_boi",
      "prazo_dias",
      "curral",
    ].includes(inlineEditState.focusField);

  const weekTotals = useMemo(() => calculateTotals(lines), [lines]);

  // Semanas além da próxima continuam fora do planejamento operacional.
  const latestPlanningWeek = useMemo(() => getNextISOWeekValue(), []);

  const weekOptions = useMemo(() => {
    const map = new Map<string, { key: string; week: number; year: number }>();

    for (const summary of availableSummaries) {
      if (!hasPlanningSummaryData(summary)) continue;

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

  const refreshAll = async (
    options: { preserveScroll?: boolean; background?: boolean } = {},
  ) => {
    const scrollPosition = options.preserveScroll
      ? { left: window.scrollX, top: window.scrollY }
      : null;

    try {
      await Promise.all([
        loadWeekCatalog(),
        loadData(!options.background),
        loadChinaHistory(true),
      ]);
    } finally {
      if (scrollPosition) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            window.scrollTo({ ...scrollPosition, behavior: "auto" });
          });
        });
      }
    }
  };

  const handleExportExcel = async () => {
    if (lines.length === 0) {
      toast.warning("Não existem dados na semana selecionada para exportar.");
      return;
    }

    setExportingExcel(true);
    try {
      await exportScalePlanningToExcel({
        rows: lines,
        selectedWeek,
        dateStart,
        dateEnd,
      });
      toast.success("Relatório Excel gerado com sucesso.");
    } catch (error) {
      console.error("Erro ao exportar a escala para Excel:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível gerar o relatório Excel.",
      );
    } finally {
      setExportingExcel(false);
    }
  };

  const applyChinaSuggestion = async () => {
    if (!chinaSuggestionState) return;

    const { item, scaleId } = chinaSuggestionState;
    const suggestion = item.chinaSuggestionMeta;
    const row = item.row;
    const recordManualId = toNumber(row.ID_ESCALA_ITEM_MANUAL);
    const recordPedidoId = toNumber(row.ID_ESCALA_PEDIDO_VINCULO);
    const recordPedidoVersion =
      toNumber(row.VERSAO_REGISTRO || row.VERSAO_VINCULO) || 1;

    if (!suggestion) return;

    setSavingChinaSuggestionKey(item.key);

    try {
      const nextChinaVaca =
        item.sex === "VACA"
          ? suggestion.suggestedQuantity
          : toNumber(row.QTD_CHINA_VACA);
      const nextChinaBoi =
        item.sex === "BOI"
          ? suggestion.suggestedQuantity
          : toNumber(row.QTD_CHINA_BOI);

      if (row.ORIGEM_REGISTRO === "MANUAL" && recordManualId > 0) {
        const result = await editarRegistroManualEscala(
          buildManualUpdatePayload(row, nroempresa, scaleId, {
            qtd_china_vaca: nextChinaVaca,
            qtd_china_boi: nextChinaBoi,
          }),
        );

        toast.success(result.message || "Quantidade China atualizada.");
      } else if (recordPedidoId > 0) {
        const result = await editarVinculoPedidoEscala(
          buildOrderUpdatePayload(row, nroempresa, {
            versao: recordPedidoVersion,
            qtd_china_vaca: nextChinaVaca,
            qtd_china_boi: nextChinaBoi,
          }),
        );

        toast.success(result.message || "Quantidade China atualizada.");
      } else {
        const orderNumber = toNumber(row.NROPEDIDO);

        if (!scaleId || scaleId <= 0) {
          throw new Error("Crie a escala do dia antes de salvar a sugestão de China.");
        }

        if (orderNumber <= 0) {
          throw new Error("Pedido não encontrado para salvar a sugestão de China.");
        }

        const result = await criarVinculoPedidoEscala({
          id_escala: scaleId,
          nroempresa,
          nro_pedido: orderNumber,
          seqpedido:
            toNumber(row.SEQPEDIDO) > 0 ? toNumber(row.SEQPEDIDO) : undefined,
          observacao:
            String(
              row.OBSERVACAO_PEDIDO_ESCALA || row.OBSERVACAO_REGISTRO || "",
            ).trim() || null,
          ordem_exibicao:
            toNumber(row.ORDEM_EXIBICAO) > 0
              ? toNumber(row.ORDEM_EXIBICAO)
              : undefined,
          qtd_china_vaca: nextChinaVaca,
          qtd_china_boi: nextChinaBoi,
        });

        toast.success(result.message || "Pedido incluído com a sugestão de China.");
      }

      setChinaSuggestionState(null);
      await loadData(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível aplicar a sugestão de China.",
      );
    } finally {
      setSavingChinaSuggestionKey(null);
    }
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

  const closeInlineEdit = () => {
    if (savingInlineEdit) return;

    setInlineConfirmOpen(false);
    setInlineEditState(null);
    setInlineEditValue("");
    setInlineBuyerSearch("");
    setInlineSelectedBuyerId(null);
  };

  const closeInlineConfirm = () => {
    if (savingInlineEdit) return;
    setInlineConfirmOpen(false);
  };

  const requestInlineEditConfirmation = () => {
    if (!inlineEditState) return;

    if (
      inlineEditState.focusField === "comprador" &&
      !inlineSelectedBuyerId
    ) {
      toast.warning("Selecione o comprador responsável.");
      return;
    }

    if (
      inlineEditState.focusField !== "comprador" &&
      inlineEditState.focusField !== "observacao" &&
      !inlineEditValue.trim()
    ) {
      toast.warning(
        `Informe ${getInlineFieldLabel(inlineEditState.focusField)}.`,
      );
      return;
    }

    setInlineConfirmOpen(true);
  };

  const handleInlineEditSave = async () => {
    if (!inlineEditState) return;

    const { row, rowScaleId, focusField } = inlineEditState;
    const rawValue = inlineEditValue.trim();
    const recordManualId = toNumber(row.ID_ESCALA_ITEM_MANUAL);
    const recordPedidoId = toNumber(row.ID_ESCALA_PEDIDO_VINCULO);
    const recordPedidoVersion =
      toNumber(row.VERSAO_REGISTRO || row.VERSAO_VINCULO) || 1;
    const recordIsManual =
      row.ORIGEM_REGISTRO === "MANUAL" && recordManualId > 0;

    const parseNumberField = (
      label: string,
      options?: {
        allowZero?: boolean;
        integer?: boolean;
      },
    ) => {
      const normalized = rawValue.replace(",", ".");
      const parsed = Number(normalized);

      if (!Number.isFinite(parsed)) {
        throw new Error(`Informe ${label} com um número válido.`);
      }

      if (options?.integer && !Number.isInteger(parsed)) {
        throw new Error(`Informe ${label} com um número inteiro.`);
      }

      if (options?.allowZero ? parsed < 0 : parsed <= 0) {
        throw new Error(
          `Informe ${label} ${options?.allowZero ? "maior ou igual a zero" : "maior que zero"}.`,
        );
      }

      return parsed;
    };

    const parseTextField = (label: string, allowEmpty = false) => {
      if (!allowEmpty && !rawValue) {
        throw new Error(`Informe ${label}.`);
      }

      return rawValue;
    };

    setSavingInlineEdit(true);

    try {
      if (!recordIsManual && recordPedidoId <= 0) {
        throw new Error("Registro inválido para atualização inline.");
      }

      if (recordIsManual) {
        const payload = buildManualUpdatePayload(row, nroempresa, rowScaleId);

        switch (focusField) {
          case "nome_produtor":
            payload.nome_produtor = normalizeText(
              parseTextField("o nome do produtor"),
            );
            break;
          case "comprador":
            if (!inlineSelectedBuyer) {
              throw new Error("Selecione o comprador responsável.");
            }
            payload.id_comprador = Number(inlineSelectedBuyer.SEQUSUARIO);
            payload.comprador_nome_snapshot = normalizeText(
              inlineSelectedBuyer.CODUSUARIO,
            );
            break;
          case "vlrunitario_vaca":
            payload.vlrunitario_vaca = parseNumberField(
              "o valor unitário das vacas",
            );
            break;
          case "vlrunitario_boi":
            payload.vlrunitario_boi = parseNumberField(
              "o valor unitário dos bois",
            );
            break;
          case "vlrunitario_premio":
            payload.vlrunitario_premio = parseNumberField(
              "o prêmio unitário",
              { allowZero: true },
            );
            break;
          case "arrobas_vaca":
            payload.arrobas_vaca = parseNumberField("as arrobas das vacas");
            break;
          case "arrobas_boi":
            payload.arrobas_boi = parseNumberField("as arrobas dos bois");
            break;
          case "prazo_dias":
            payload.prazo_dias = parseNumberField("o prazo em dias", {
              allowZero: true,
              integer: true,
            });
            break;
          case "curral":
            payload.curral = parseNumberField("o curral", {
              allowZero: true,
              integer: true,
            });
            break;
          case "observacao":
            payload.observacao = parseTextField("a observação", true) || null;
            break;
        }

        const result = await editarRegistroManualEscala(payload);

        toast.success(result.message || "Registro manual atualizado.");
      } else {
        const payload = buildOrderUpdatePayload(row, nroempresa, {
          versao: recordPedidoVersion,
        });

        switch (focusField) {
          case "comprador":
            if (!inlineSelectedBuyer) {
              throw new Error("Selecione o comprador responsável.");
            }
            payload.id_comprador = Number(inlineSelectedBuyer.SEQUSUARIO);
            payload.comprador_nome_snapshot = normalizeText(
              inlineSelectedBuyer.CODUSUARIO,
            );
            break;
          case "vlrunitario_premio":
            payload.vlrunitario_premio = parseNumberField(
              "o prêmio unitário",
              { allowZero: true },
            );
            break;
          case "arrobas_vaca":
            payload.arrobas_vaca = parseNumberField("as arrobas das vacas");
            break;
          case "arrobas_boi":
            payload.arrobas_boi = parseNumberField("as arrobas dos bois");
            break;
          case "prazo_dias":
            payload.prazo_dias = parseNumberField("o prazo em dias", {
              allowZero: true,
              integer: true,
            });
            break;
          case "curral":
            payload.curral = parseNumberField("o curral", {
              allowZero: true,
              integer: true,
            });
            break;
          case "observacao":
            payload.observacao = parseTextField("a observação", true) || null;
            break;
          default:
            throw new Error(
              "Esse campo continua disponível apenas na edição completa.",
            );
        }

        const result = await editarVinculoPedidoEscala(payload);

        toast.success(result.message || "Informações do pedido atualizadas.");
      }

      closeInlineEdit();
      await refreshAll({ preserveScroll: true, background: true });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar a atualização inline.",
      );
    } finally {
      setSavingInlineEdit(false);
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

    setInlineConfirmOpen(false);
    setInlineEditState({
      row,
      day,
      rowScaleId,
      pendingOrders,
      focusField: focusField as InlineEditableField,
    });
  };

  const renderInlineEditor = (
    field: InlineEditableField,
    options?: {
      align?: "left" | "center" | "right";
      multiline?: boolean;
      placeholder?: string;
    },
  ) => {
    const align = options?.align || "left";
    const justifyClass =
      align === "right"
        ? "items-end"
        : align === "center"
          ? "items-center"
          : "items-start";
    const actionClass =
      align === "right"
        ? "justify-end"
        : align === "center"
          ? "justify-center"
          : "justify-start";
    const textAlignClass =
      align === "right"
        ? "text-right"
        : align === "center"
          ? "text-center"
          : "text-left";
    const confirmDisabled =
      savingInlineEdit ||
      (field === "comprador" ? !inlineSelectedBuyerId : false);

    return (
      <div className={`flex flex-col gap-2 ${justifyClass}`}>
        {field === "comprador" ? (
          <>
            <Input
              value={inlineBuyerSearch}
              className={`h-8 text-[11px] font-semibold ${textAlignClass}`}
              placeholder={
                loadingInlineBuyers ? "Carregando compradores..." : "Nome ou código"
              }
             onChange={(event) => {
               setInlineBuyerSearch(event.target.value);
               setInlineSelectedBuyerId(null);
             }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && inlineSelectedBuyerId) {
                  event.preventDefault();
                  requestInlineEditConfirmation();
                }
              }}
            />

            <div className="max-h-36 w-full overflow-y-auto rounded-lg border border-[#D7E2EC] bg-white">
              {loadingInlineBuyers ? (
                <div className="flex items-center justify-center py-4 text-[11px] font-semibold text-[#60758A]">
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  Carregando...
                </div>
              ) : inlineBuyerSuggestions.length === 0 ? (
                <div className="py-4 text-center text-[11px] font-semibold text-[#718297]">
                  Nenhum comprador encontrado.
                </div>
              ) : (
                inlineBuyerSuggestions.map((buyer) => {
                  const selected =
                    Number(buyer.SEQUSUARIO) === inlineSelectedBuyerId;

                  return (
                    <button
                      key={buyer.SEQUSUARIO}
                      type="button"
                      className={`flex w-full items-center justify-between px-2 py-1.5 text-left text-[11px] transition ${
                        selected
                          ? "bg-[#EEF4FA] text-[#173D6E]"
                          : "text-[#425B73] hover:bg-[#F7FAFD]"
                      }`}
                      onClick={() => {
                        setInlineSelectedBuyerId(Number(buyer.SEQUSUARIO));
                        setInlineBuyerSearch(String(buyer.CODUSUARIO || ""));
                      }}
                    >
                      <span className="font-extrabold">{buyer.CODUSUARIO}</span>
                    </button>
                  );
                })
              )}
            </div>
          </>
        ) : options?.multiline ? (
          <textarea
            className={`min-h-[84px] w-full rounded-lg border border-[#C5D4E2] bg-white px-2.5 py-2 text-[11px] font-medium text-[#173D6E] outline-none transition focus:border-[#1B58A0] focus:ring-2 focus:ring-[#1B58A0]/20 ${textAlignClass}`}
            value={inlineEditValue}
            onChange={(event) => setInlineEditValue(event.target.value)}
            placeholder={options.placeholder || "Digite a informação"}
          />
        ) : (
          <Input
            type="text"
            inputMode={
              field === "prazo_dias"
                ? "numeric"
                : inlineNumericField
                  ? "decimal"
                  : "text"
            }
            value={inlineEditValue}
            className={`h-8 text-[11px] font-semibold ${textAlignClass}`}
            onChange={(event) => setInlineEditValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                requestInlineEditConfirmation();
              }
            }}
            placeholder={
              options?.placeholder || `Informe ${getInlineFieldLabel(field)}`
            }
          />
        )}

        <div className={`flex flex-wrap gap-1.5 ${actionClass}`}>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2 text-[10px] font-extrabold"
            disabled={savingInlineEdit}
            onClick={closeInlineEdit}
          >
            <X className="mr-1 h-3.5 w-3.5" />
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-7 px-2 text-[10px] font-extrabold"
            disabled={confirmDisabled}
            onClick={requestInlineEditConfirmation}
          >
            <BadgeCheck className="mr-1 h-3.5 w-3.5" />
            Confirmar
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#F3F6FA] p-2.5 pb-20 sm:p-3 lg:p-4">
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

          <div className="flex flex-col gap-4 px-3.5 py-4 sm:px-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#D7E3EF] bg-[#EEF4FA]">
                <CalendarRange className="h-6 w-6 text-[#173D6E]" />
              </div>

              <div className="min-w-0">
                <p className="mb-0.5 text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#1B58A0]">
                  Planejamento operacional
                </p>
                <h1 className="text-xl font-extrabold tracking-tight text-[#173D6E] sm:text-2xl">
                  Planejamento da Escala
                </h1>
                <p className="mt-1 text-xs font-medium text-[#60758A]">
                  Acompanhe pedidos, pendências e informações operacionais pela data de abate.
                </p>
              </div>
            </div>

            {canManage && (
              <Button
                variant="outline"
                size="sm"
                disabled={!firstScaleShortcut}
                title={
                  firstScaleShortcut
                    ? `Adicionar manual em ${formatDate(firstScaleShortcut.day)}`
                    : "Crie uma escala nesta semana para adicionar manual"
                }
                className="h-11 w-full shrink-0 gap-2 rounded-xl border-[#8EC7D9] bg-[#EFF8FA] px-4 text-sm font-black text-[#09759D] shadow-sm hover:border-[#57AFCB] hover:bg-[#E2F6FB] disabled:border-[#D4DFE8] disabled:bg-[#F5F8FB] disabled:text-[#90A3B7] sm:w-auto"
                onClick={() => {
                  if (!firstScaleShortcut) return;
                  navigate(
                    `/escala/gerenciar/${firstScaleShortcut.idEscala}?novoManual=1`,
                  );
                }}
              >
                <FilePlus2 className="h-4 w-4" />
                Adicionar manual
              </Button>
            )}
          </div>
        </header>

        <Card className="overflow-hidden rounded-2xl border border-[#D3DEE9] bg-white shadow-[0_4px_18px_rgba(23,61,110,0.05)]">
          <div className="h-1 bg-[#173D6E]" />
          <CardContent className="p-3 sm:p-5">
            <div className="mx-auto flex max-w-full flex-col items-center justify-center gap-4 xl:flex-row xl:gap-6">
              <div className="shrink-0 text-center xl:min-w-[190px] xl:text-left">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#173D6E]">
                  Semana do planejamento
                </p>
                <p className="mt-1 text-sm font-bold text-[#526B82]">
                  {formatDate(dateStart)} a {formatDate(dateEnd)}
                </p>
              </div>

              <div className="flex w-full max-w-full items-center gap-2.5 overflow-x-auto pb-1 xl:w-auto xl:justify-center">
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

                    <div className="flex min-w-max items-center justify-center gap-2">
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

              <div className="flex w-full shrink-0 flex-wrap items-center justify-center gap-2 xl:w-auto xl:justify-end">

                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 gap-2 rounded-xl border-[#BFCFDF] px-4 text-xs font-bold text-[#173D6E] hover:border-[#1B58A0] hover:bg-[#EEF4FA]"
                  onClick={() => setPlaybackDialogOpen(true)}
                >
                  <Play className="h-3.5 w-3.5" />
                  Reproduzir
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className={`h-10 gap-2 rounded-xl px-4 text-xs font-bold hover:bg-[#EEF4FA] ${
                    chinaPeriodPreset === "manual" && !chinaPeriodConfig
                      ? "border-[#F0B8BC] text-[#A51D29] hover:border-[#D96A74]"
                      : "border-[#BFCFDF] text-[#173D6E] hover:border-[#1B58A0]"
                  }`}
                  onClick={() => setChinaConfigOpen(true)}
                >
                  <Settings2 className="h-3.5 w-3.5" />
                  China: {chinaPeriodConfig?.buttonLabel || "Manual"}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 gap-2 rounded-xl border-[#BFCFDF] px-4 text-xs font-bold text-[#173D6E] hover:border-[#1B58A0] hover:bg-[#EEF4FA]"
                  onClick={() => void refreshAll()}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Atualizar
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  disabled={loading || exportingExcel}
                  className="h-10 gap-2 rounded-xl border-[#7FB89E] bg-[#F0F8F4] px-4 text-xs font-extrabold text-[#216E4E] shadow-sm hover:border-[#3E8F6A] hover:bg-[#E2F3EA] disabled:border-[#D4DFE8] disabled:bg-[#F5F8FB] disabled:text-[#90A3B7]"
                  onClick={() => void handleExportExcel()}
                >
                  {exportingExcel ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                  )}
                  {exportingExcel ? "Gerando Excel..." : "Exportar Excel"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <EscalaPlaybackDialog
          open={playbackDialogOpen}
          onOpenChange={setPlaybackDialogOpen}
          initialWeek={selectedWeek}
          weekOptions={weekOptions}
          onStart={({ week, scrollDurationSeconds, showFinancial }) => {
            setPlaybackDialogOpen(false);
            navigate(
              `/escala/tv?week=${encodeURIComponent(week)}&duration=${scrollDurationSeconds}&financial=${
                showFinancial ? "1" : "0"
              }&fullscreen=1`,
            );
          }}
        />

        <div className="-mx-2.5 grid snap-x snap-mandatory grid-flow-col auto-cols-[minmax(155px,1fr)] gap-2 overflow-x-auto px-2.5 pb-2 sm:-mx-3 sm:px-3 lg:mx-0 lg:grid-flow-row lg:grid-cols-[repeat(7,minmax(0,1fr))] lg:overflow-visible lg:px-0 lg:pb-0 xl:gap-2">
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
              const sexRows = splitRecordsBySex(dayRows)
                .map((item) => {
                  const suggestion = buildChinaSuggestion(
                    item,
                    historicoCompras,
                    chinaPeriodConfig,
                  );

                  return {
                    ...item,
                    chinaSuggestedQuantity: suggestion?.suggestedQuantity ?? null,
                    chinaSuggestionMeta: suggestion,
                  };
                })
                .sort((a, b) => {
                  const orderA = toNumber(a.row.NROPEDIDO);
                  const orderB = toNumber(b.row.NROPEDIDO);
                  if (orderA !== orderB) return orderA - orderB;
                  return a.sex.localeCompare(b.sex);
                });
              const totals = calculateTotals(dayRows);
              const daySubtotal = calculatePlanningDaySubtotal(sexRows, dayRows);
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
                    <div className="flex w-full flex-nowrap items-center gap-2 overflow-x-auto pb-1 [&>*]:shrink-0 lg:w-auto lg:flex-wrap lg:overflow-visible lg:pb-0">
                      <div className="inline-flex items-center gap-2.5 rounded-lg border border-[#CBD9E7] bg-white px-3 py-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#EEF4FA] text-[#173D6E]">
                          <CalendarDays className="h-4 w-4" />
                        </span>
                        <h2 className="text-sm font-extrabold tracking-tight text-[#173D6E]">
                          {formatDayTitle(day)}
                        </h2>
                      </div>

                      <span
                        className="inline-flex items-center text-sm font-extrabold tracking-tight text-[#173D6E]"
                        title={`${numberFormat.format(totals.plannedHeads)} animais no dia`}
                      >
                        {numberFormat.format(totals.plannedHeads)} animais
                      </span>

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
                            className="order-first h-10 w-full gap-2 rounded-lg border-[#8EC7D9] bg-[#EFF8FA] px-4 text-sm font-black text-[#09759D] shadow-sm hover:border-[#57AFCB] hover:bg-[#E2F6FB] sm:h-9 sm:w-auto sm:min-w-[172px] sm:px-3 sm:text-xs"
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
                      <p className="border-b border-[#E1E8EF] bg-[#F8FBFD] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.08em] text-[#60758A] sm:hidden">
                        Deslize para o lado para ver e editar todos os campos
                      </p>
                      <div className="w-full overflow-x-auto overscroll-x-contain">
                        <Table className="w-full min-w-[1380px] table-fixed text-[11px]">
                          <TableHeader>
                            <TableRow className="border-b border-[#C9D7E5] bg-[#EAF1F7] hover:bg-[#EAF1F7]">
                              <TableHead className="w-[3%] h-11 border-r border-[#D7E2EC] px-1 text-[9px] font-extrabold uppercase leading-tight tracking-[0.03em] text-[#173D6E] text-center">
                                Editar
                              </TableHead>
                              <TableHead className="w-[7%] h-11 border-r border-[#D7E2EC] px-1 text-[9px] font-extrabold uppercase leading-tight tracking-[0.03em] text-[#173D6E]">
                                Data / pedido
                              </TableHead>
                              <TableHead className="w-[17%] h-11 border-r border-[#D7E2EC] px-1 text-[9px] font-extrabold uppercase leading-tight tracking-[0.03em] text-[#173D6E]">
                                Produtor / fazenda
                              </TableHead>
                              <TableHead className="w-[12%] h-11 border-r border-[#D7E2EC] px-1 text-[9px] font-extrabold uppercase leading-tight tracking-[0.03em] text-[#173D6E]">
                                Comprador
                              </TableHead>
                              <TableHead className="w-[4%] h-11 border-r border-[#D7E2EC] px-1 text-[9px] font-extrabold uppercase leading-tight tracking-[0.03em] text-[#173D6E] text-center">
                                Sexo
                              </TableHead>
                              <TableHead className="w-[4%] h-11 border-r border-[#D7E2EC] px-1 text-[9px] font-extrabold uppercase leading-tight tracking-[0.03em] text-[#173D6E] text-right">
                                Qtde
                              </TableHead>
                              <TableHead className="w-[6%] h-11 border-r border-[#D7E2EC] px-1 text-[9px] font-extrabold uppercase leading-tight tracking-[0.03em] text-[#173D6E] text-right">
                                Preço
                              </TableHead>
                              <TableHead className="w-[5%] h-11 border-r border-[#D7E2EC] px-1 text-[9px] font-extrabold uppercase leading-tight tracking-[0.03em] text-[#173D6E] text-right">
                                Prêmio
                              </TableHead>
                              <TableHead className="w-[5%] h-11 border-r border-[#D7E2EC] px-1 text-[9px] font-extrabold uppercase leading-tight tracking-[0.03em] text-[#173D6E] text-right">
                                Peso @
                              </TableHead>
                              <TableHead className="w-[4%] h-11 border-r border-[#D7E2EC] px-1 text-[9px] font-extrabold uppercase leading-tight tracking-[0.03em] text-[#173D6E] text-right">
                                Prazo
                              </TableHead>
                              <TableHead className="w-[4%] h-11 border-r border-[#D7E2EC] px-1 text-[9px] font-extrabold uppercase leading-tight tracking-[0.03em] text-[#173D6E] text-center">
                                Curral
                              </TableHead>
                              <TableHead className="w-[4%] h-11 border-r border-[#D7E2EC] px-1 text-[9px] font-extrabold uppercase leading-tight tracking-[0.03em] text-[#173D6E] text-right">
                                China
                              </TableHead>
                              <TableHead className="w-[5%] h-11 border-r border-[#D7E2EC] px-1 text-[9px] font-extrabold uppercase leading-tight tracking-[0.03em] text-[#173D6E] text-right">
                                Agrotools
                              </TableHead>
                              <TableHead className="w-[16%] h-11 px-1.5 text-[9px] font-extrabold uppercase leading-tight tracking-[0.03em] text-[#173D6E]">
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
                              const compradorPreenchido =
                                toNumber(row.ID_COMPRADOR_ESCALA) > 0 ||
                                String(row.COMPRADOR_ESCALA || "").trim().length > 0 ||
                                String(row.COMPRADOR_ERP || "").trim().length > 0 ||
                                String(row.COMPRADOR_EXIBICAO || "").trim().length >
                                  0;
                              const seqCompradorErp = toNumber(
                                row.SEQCOMPRADOR_ERP,
                              );
                              const registroErp = row.ORIGEM_REGISTRO === "ERP";
                              const compradorAutomaticoErp =
                                registroErp &&
                                seqCompradorErp > 0 &&
                                seqCompradorErp !== 1;
                              const compradorPrecisaSelecionar =
                                (row.ORIGEM_REGISTRO === "MANUAL" &&
                                  !compradorPreenchido) ||
                                (registroErp &&
                                  !compradorAutomaticoErp &&
                                  toNumber(row.ID_COMPRADOR_ESCALA) <= 0 &&
                                  !String(row.COMPRADOR_ESCALA || "").trim());
                              const compradorExibido = compradorPreenchido
                                ? resolvePlanningBuyerName(row)
                                : !compradorPrecisaSelecionar &&
                                    row.ORIGEM_REGISTRO !== "MANUAL"
                                  ? "—"
                                  : "";
                              const compradorErpNaoRetornado =
                                shouldWarnMissingPlanningBuyer(row) &&
                                !compradorPrecisaSelecionar;
                              const chinaSuggestionPending = Boolean(
                                item.chinaSuggestionMeta &&
                                  item.chinaSuggestionMeta.suggestedQuantity !==
                                    item.chinaQuantity,
                              );
                              const displayedChinaQuantity =
                                chinaSuggestionPending &&
                                item.chinaSuggestionMeta
                                  ? item.chinaSuggestionMeta.suggestedQuantity
                                  : item.chinaQuantity;
                              const effectivePremium = getEffectivePremium(row);
                              const planningLocation = resolvePlanningLocation(
                                row,
                                locationDirectory,
                              );

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
                                                    )}&voltarEscala=1`,
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
                                                    )}&voltarEscala=1`,
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
                                    {isInlineEditing(row, "nome_produtor") ? (
                                      renderInlineEditor("nome_produtor")
                                    ) : row.PRODUTOR ? (
                                      row.ORIGEM_REGISTRO === "MANUAL" &&
                                      canManage &&
                                      rowScaleId > 0 ? (
                                        <button
                                          type="button"
                                          className="w-full rounded-md px-1 py-0.5 text-left transition hover:bg-[#EEF4FA] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B58A0]/30"
                                          title={`Editar nome do produtor: ${row.PRODUTOR}`}
                                          onClick={() =>
                                            openRequiredField(
                                              row,
                                              day,
                                              rowScaleId,
                                              pendingDayOrders,
                                              "nome_produtor",
                                            )
                                          }
                                        >
                                          <span className="block truncate text-[12px] font-extrabold leading-tight text-[#173D6E]">
                                            {row.PRODUTOR}
                                          </span>
                                        </button>
                                      ) : (
                                        <p
                                          className="truncate text-[12px] font-extrabold leading-tight text-[#173D6E]"
                                          title={row.PRODUTOR}
                                        >
                                          {row.PRODUTOR}
                                        </p>
                                      )
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
                                    <div className="mt-1 flex min-w-0 items-center gap-1.5">
                                      <p
                                        className="min-w-0 flex-1 truncate text-[11px] font-semibold leading-tight text-[#526B82]"
                                        title={property}
                                      >
                                        {property || "—"}
                                      </p>
                                      <button
                                        type="button"
                                        disabled={!planningLocation}
                                        className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors ${
                                          planningLocation
                                            ? "border-[#B9D5EE] bg-[#EAF4FD] text-[#1B67AA] hover:border-[#1B67AA] hover:bg-[#1B67AA] hover:text-white"
                                            : "cursor-not-allowed border-[#DDE4EA] bg-[#F5F7F9] text-[#AAB6C1]"
                                        }`}
                                        title={
                                          planningLocation
                                            ? "Abrir localização da propriedade"
                                            : "Propriedade sem GPS cadastrado"
                                        }
                                        aria-label={
                                          planningLocation
                                            ? `Abrir localização de ${planningLocation.farm}`
                                            : "Propriedade sem GPS cadastrado"
                                        }
                                        onClick={() => {
                                          if (planningLocation) {
                                            setLocationDialog(planningLocation);
                                          }
                                        }}
                                      >
                                        {planningLocation ? (
                                          <MapPin className="h-3.5 w-3.5" />
                                        ) : (
                                          <MapPinOff className="h-3.5 w-3.5" />
                                        )}
                                      </button>
                                    </div>
                                  </TableCell>

                                  <TableCell className="px-1.5 py-2.5 align-top font-bold leading-tight text-[#425B73]">
                                    {isInlineEditing(row, "comprador") ? (
                                      renderInlineEditor("comprador")
                                    ) : compradorPrecisaSelecionar ? (
                                      <MissingFieldButton
                                        label="Selecione o comprador responsável"
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
                                    ) : compradorExibido ? (
                                      canManage && rowScaleId > 0 ? (
                                        <button
                                          type="button"
                                          className="w-full rounded-md px-1 py-0.5 text-left transition hover:bg-[#EEF4FA] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B58A0]/30"
                                          title={`Editar comprador: ${compradorExibido}`}
                                          onClick={() =>
                                            openRequiredField(
                                              row,
                                              day,
                                              rowScaleId,
                                              pendingDayOrders,
                                              "comprador",
                                            )
                                          }
                                        >
                                          <span className="block truncate pr-1">
                                            {compradorExibido}
                                          </span>
                                        </button>
                                      ) : (
                                        <p
                                          className="truncate pr-1"
                                          title={compradorExibido}
                                        >
                                          {compradorExibido}
                                        </p>
                                      )
                                    ) : compradorErpNaoRetornado ? (
                                      <MissingFieldButton
                                        label="Comprador responsável não retornado pela view"
                                        align="center"
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
                                    {isInlineEditing(
                                      row,
                                      item.sex === "VACA"
                                        ? "vlrunitario_vaca"
                                        : "vlrunitario_boi",
                                    ) ? (
                                      renderInlineEditor(
                                        item.sex === "VACA"
                                          ? "vlrunitario_vaca"
                                          : "vlrunitario_boi",
                                        {
                                          align: "right",
                                        },
                                      )
                                    ) : item.unitValue === null ? (
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
                                    ) : row.ORIGEM_REGISTRO === "MANUAL" &&
                                      canManage &&
                                      rowScaleId > 0 ? (
                                      <button
                                        type="button"
                                        className="w-full rounded-md px-1 py-0.5 text-right transition hover:bg-[#EEF4FA] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B58A0]/30"
                                        title={`Editar valor unitário de ${item.sex.toLowerCase()}`}
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
                                      >
                                        {currencyFormat.format(item.unitValue)}
                                      </button>
                                    ) : (
                                      currencyFormat.format(item.unitValue)
                                    )}
                                  </TableCell>

                                  <TableCell className="px-1.5 py-2.5 text-right align-top font-extrabold text-[#173D6E]">
                                    {isInlineEditing(row, "vlrunitario_premio") ? (
                                      renderInlineEditor("vlrunitario_premio", {
                                        align: "right",
                                      })
                                    ) : effectivePremium === null ? (
                                      canManage && rowScaleId > 0 ? (
                                        <button
                                          type="button"
                                          className="w-full rounded-md px-1 py-0.5 text-right text-[#718297] transition hover:bg-[#EEF4FA] hover:text-[#173D6E] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B58A0]/30"
                                          title="Adicionar prêmio unitário"
                                          onClick={() =>
                                            openRequiredField(
                                              row,
                                              day,
                                              rowScaleId,
                                              pendingDayOrders,
                                              "vlrunitario_premio",
                                            )
                                          }
                                        >
                                          —
                                        </button>
                                      ) : (
                                        "—"
                                      )
                                    ) : canManage && rowScaleId > 0 ? (
                                      <button
                                        type="button"
                                        className="w-full rounded-md px-1 py-0.5 text-right transition hover:bg-[#EEF4FA] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B58A0]/30"
                                        title="Editar prêmio unitário"
                                        onClick={() =>
                                          openRequiredField(
                                            row,
                                            day,
                                            rowScaleId,
                                            pendingDayOrders,
                                            "vlrunitario_premio",
                                          )
                                        }
                                      >
                                        {currencyFormat.format(
                                          effectivePremium,
                                        )}
                                      </button>
                                    ) : (
                                      currencyFormat.format(
                                        effectivePremium,
                                      )
                                    )}
                                  </TableCell>

                                  <TableCell className="px-1.5 py-2.5 text-right align-top font-bold text-[#334E68]">
                                    {isInlineEditing(
                                      row,
                                      item.sex === "VACA" ? "arrobas_vaca" : "arrobas_boi",
                                    ) ? (
                                      renderInlineEditor(
                                        item.sex === "VACA" ? "arrobas_vaca" : "arrobas_boi",
                                        {
                                          align: "right",
                                        },
                                      )
                                    ) : item.arrobas === null ? (
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
                                    ) : canManage && rowScaleId > 0 ? (
                                      <button
                                        type="button"
                                        className="w-full rounded-md px-1 py-0.5 text-right transition hover:bg-[#EEF4FA] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B58A0]/30"
                                        title={`Editar peso em arrobas de ${item.sex.toLowerCase()}`}
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
                                      >
                                        {decimalFormat.format(item.arrobas)}
                                      </button>
                                    ) : (
                                      decimalFormat.format(item.arrobas)
                                    )}
                                  </TableCell>

                                  <TableCell className="px-1.5 py-2.5 text-right align-top font-bold text-[#334E68]">
                                    {isInlineEditing(row, "prazo_dias") ? (
                                      renderInlineEditor("prazo_dias", {
                                        align: "right",
                                      })
                                    ) : row.PRAZO_DIAS === null ||
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
                                    ) : canManage && rowScaleId > 0 ? (
                                      <button
                                        type="button"
                                        className="w-full rounded-md px-1 py-0.5 text-right transition hover:bg-[#EEF4FA] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B58A0]/30"
                                        title="Editar prazo em dias"
                                        onClick={() =>
                                          openRequiredField(
                                            row,
                                            day,
                                            rowScaleId,
                                            pendingDayOrders,
                                            "prazo_dias",
                                          )
                                        }
                                      >
                                        {numberFormat.format(
                                          toNumber(row.PRAZO_DIAS),
                                        )}
                                      </button>
                                    ) : (
                                      numberFormat.format(
                                        toNumber(row.PRAZO_DIAS),
                                      )
                                    )}
                                  </TableCell>

                                  <TableCell className="px-1 py-2.5 text-center align-top font-bold text-[#425B73]">
                                    {isInlineEditing(row, "curral") ? (
                                      renderInlineEditor("curral", {
                                        align: "center",
                                      })
                                    ) : row.CURRAL !== null && row.CURRAL !== undefined ? (
                                      canManage && rowScaleId > 0 ? (
                                        <button
                                          type="button"
                                          className="w-full rounded-md px-1 py-0.5 text-center transition hover:bg-[#EEF4FA] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B58A0]/30"
                                          title={`Editar curral: ${row.CURRAL}`}
                                          onClick={() =>
                                            openRequiredField(
                                              row,
                                              day,
                                              rowScaleId,
                                              pendingDayOrders,
                                              "curral",
                                            )
                                          }
                                        >
                                          <span className="block truncate">{row.CURRAL}</span>
                                        </button>
                                      ) : (
                                        <p className="truncate" title={String(row.CURRAL)}>
                                          {row.CURRAL}
                                        </p>
                                      )
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
                                    <div className="flex items-center justify-end gap-1.5">
                                      <span
                                        className={`inline-flex min-w-[38px] items-center justify-center rounded-md px-2 py-1 text-right text-[12px] font-extrabold tabular-nums ${
                                          chinaSuggestionPending
                                            ? "border border-[#F2B176] bg-[#FFF4E8] text-[#B85B00] shadow-[inset_0_0_0_1px_rgba(245,158,11,0.08)]"
                                            : "text-[#334E68]"
                                        }`}
                                      >
                                        {numberFormat.format(displayedChinaQuantity)}
                                      </span>

                                      {chinaSuggestionPending ? (
                                        <button
                                          type="button"
                                          className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[#F2B176] bg-[#FFF4E8] text-[#B85B00] transition hover:border-[#E28A2E] hover:bg-[#FFEBD6] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F59E0B]/30"
                                          title="Ver cálculo da sugestão de China"
                                          onClick={() =>
                                            setChinaSuggestionState({
                                              item,
                                              day,
                                              scaleId: rowScaleId > 0 ? rowScaleId : null,
                                            })
                                          }
                                        >
                                          <Sparkles className="h-3.5 w-3.5" />
                                        </button>
                                      ) : row.ORIGEM_REGISTRO === "ERP" &&
                                        loadingChinaHistory ? (
                                        <span className="text-[10px] font-semibold text-[#7B8EA3]">
                                          IA...
                                        </span>
                                      ) : null}
                                    </div>
                                  </TableCell>

                                  <TableCell className="px-1.5 py-2.5 text-right align-top font-extrabold text-[#173D6E]">
                                    {numberFormat.format(item.agrotoolsQuantity)}
                                  </TableCell>

                                  <TableCell className="border-l border-[#D4E0EA] bg-white/35 px-2 py-2.5 align-top text-[#425B73]">
                                    {isInlineEditing(row, "observacao") ? (
                                      renderInlineEditor("observacao", {
                                        multiline: true,
                                        placeholder: "Digite a observação",
                                      })
                                    ) : canManage && rowScaleId > 0 ? (
                                      <button
                                        type="button"
                                        className="w-full rounded-md px-1 py-0.5 text-left transition hover:bg-[#EEF4FA] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B58A0]/30"
                                        title={
                                          observation
                                            ? `Editar observação: ${observation}`
                                            : "Adicionar observação"
                                        }
                                        onClick={() =>
                                          openRequiredField(
                                            row,
                                            day,
                                            rowScaleId,
                                            pendingDayOrders,
                                            "observacao",
                                          )
                                        }
                                      >
                                        <span className="line-clamp-3 break-words text-[11px] font-medium leading-[1.35] text-[#425B73]">
                                          {observation || "—"}
                                        </span>
                                      </button>
                                    ) : (
                                      <p
                                        className="line-clamp-3 break-words text-[11px] font-medium leading-[1.35]"
                                        title={observation || "Sem observação"}
                                      >
                                        {observation || "—"}
                                      </p>
                                    )}
                                  </TableCell>

                                </TableRow>
                              );
                            })}
                            <TableRow className="border-t-2 border-[#BFD1E2] bg-[#F4F8FC] hover:bg-[#F4F8FC]">
                              <TableCell
                                colSpan={5}
                                className="px-2 py-3 text-[11px] font-black uppercase tracking-[0.04em] text-[#173D6E]"
                              >
                                Subtotal do dia
                              </TableCell>
                              <TableCell className="px-1.5 py-3 text-right text-[12px] font-black text-[#173D6E]">
                                {numberFormat.format(daySubtotal.quantity)}
                              </TableCell>
                              <TableCell className="px-1.5 py-3 text-right text-[12px] font-black text-[#173D6E]">
                                {daySubtotal.averagePrice !== null
                                  ? currencyFormat.format(daySubtotal.averagePrice)
                                  : "—"}
                              </TableCell>
                              <TableCell className="px-1.5 py-3 text-right text-[12px] font-black text-[#718297]">
                                —
                              </TableCell>
                              <TableCell className="px-1.5 py-3 text-right text-[12px] font-black text-[#718297]">
                                —
                              </TableCell>
                              <TableCell className="px-1.5 py-3 text-right text-[12px] font-black text-[#718297]">
                                —
                              </TableCell>
                              <TableCell className="px-1.5 py-3 text-center text-[12px] font-black text-[#718297]">
                                {numberFormat.format(daySubtotal.curral)}
                              </TableCell>
                              <TableCell className="px-1.5 py-3 text-right text-[12px] font-black text-[#B85B00]">
                                {numberFormat.format(daySubtotal.china)}
                              </TableCell>
                              <TableCell className="px-1.5 py-3 text-right text-[12px] font-black text-[#167A59]">
                                {numberFormat.format(daySubtotal.agrotools)}
                              </TableCell>
                              <TableCell className="px-2 py-3 text-[11px] font-semibold text-[#60758A]">
                                Total consolidado do dia
                              </TableCell>
                            </TableRow>
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

      <Dialog open={inlineConfirmOpen} onOpenChange={setInlineConfirmOpen}>
        <DialogContent
          className="sm:max-w-lg"
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              !event.repeat &&
              !savingInlineEdit &&
              inlineEditState
            ) {
              event.preventDefault();
              void handleInlineEditSave();
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {inlineEditState
                ? `Confirmar ${getInlineFieldLabel(inlineEditState.focusField)}`
                : "Confirmar atualização"}
            </DialogTitle>
            <DialogDescription>
              Revise o valor informado no planejamento e confirme a gravação.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-xl border border-[#CFE0EF] bg-[#EEF6FD] p-3 text-sm text-[#1B4D80]">
            Confirme a atualização de{" "}
            <strong>
              {inlineEditState
                ? getInlineFieldLabel(inlineEditState.focusField)
                : "campo"}
            </strong>{" "}
            para{" "}
            <strong>
              {inlineEditPreview || "valor informado"}
            </strong>
            .
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={savingInlineEdit}
              onClick={closeInlineConfirm}
            >
              Voltar
            </Button>
            <Button
              type="button"
              autoFocus
              disabled={savingInlineEdit || !inlineEditState}
              onClick={() => void handleInlineEditSave()}
            >
              {savingInlineEdit ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Confirmar atualização"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={chinaConfigOpen} onOpenChange={setChinaConfigOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Configuração China</DialogTitle>
            <DialogDescription>
              Escolha o período usado para calcular a sugestão histórica da
              coluna China. O padrão atual é{" "}
              <strong>{chinaPeriodConfig?.buttonLabel || "Manual"}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2 sm:grid-cols-2">
            {CHINA_PERIOD_OPTIONS.map((option) => {
              const selected = chinaPeriodPreset === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  className={`rounded-xl border px-3 py-3 text-left transition ${
                    selected
                      ? "border-[#173D6E] bg-[#173D6E] text-white"
                      : "border-[#D3DEE9] bg-white text-[#173D6E] hover:border-[#1B58A0] hover:bg-[#F4F8FC]"
                  }`}
                  onClick={() => setChinaPeriodPreset(option.value)}
                >
                  <span className="block text-sm font-extrabold">
                    {option.label}
                  </span>
                  <span
                    className={`mt-1 block text-[11px] ${
                      selected ? "text-white/80" : "text-[#60758A]"
                    }`}
                  >
                    {option.description}
                  </span>
                </button>
              );
            })}
          </div>

          {chinaPeriodPreset === "manual" && (
            <div className="grid gap-3 rounded-xl border border-[#D8E3ED] bg-[#F8FBFD] p-3 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#52677E]">
                  Data inicial
                </span>
                <Input
                  type="date"
                  value={chinaManualStart}
                  onChange={(event) => setChinaManualStart(event.target.value)}
                />
              </label>

              <label className="space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#52677E]">
                  Data final
                </span>
                <Input
                  type="date"
                  value={chinaManualEnd}
                  onChange={(event) => setChinaManualEnd(event.target.value)}
                />
              </label>

              {!chinaPeriodConfig && (
                <p className="sm:col-span-2 text-xs font-semibold text-[#A51D29]">
                  Informe uma faixa manual válida para liberar a sugestão.
                </p>
              )}
            </div>
          )}

          <div className="rounded-xl border border-[#D7E2EC] bg-[#F7FAFC] p-3 text-xs text-[#60758A]">
            A sugestão usa o histórico do produtor em{" "}
            <strong>{chinaPeriodConfig?.descriptionLabel || "período manual"}</strong>
            . Ao clicar no valor sugerido, a tela mostra o cálculo e permite
            confirmar a gravação.
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setChinaConfigOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(chinaSuggestionState)}
        onOpenChange={(open) => {
          if (!open && !savingChinaSuggestionKey) {
            setChinaSuggestionState(null);
          }
        }}
      >
        <DialogContent
          className="sm:max-w-lg"
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              !event.repeat &&
              !savingChinaSuggestionKey &&
              canManage &&
              chinaSuggestionState?.item.chinaSuggestionMeta
            ) {
              event.preventDefault();
              void applyChinaSuggestion();
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>Sugestão histórica de China</DialogTitle>
            <DialogDescription>
              {chinaSuggestionState?.item.chinaSuggestionMeta
                ? `Nos últimos ${chinaSuggestionState.item.chinaSuggestionMeta.periodLabel} esse produtor matou ${numberFormat.format(
                    chinaSuggestionState.item.chinaSuggestionMeta.totalAnimals,
                  )} animais. Destes, ${numberFormat.format(
                    chinaSuggestionState.item.chinaSuggestionMeta.chinaAnimals,
                  )} foram China, gerando ${percentFormat.format(
                    chinaSuggestionState.item.chinaSuggestionMeta.chinaPercent * 100,
                  )}%.`
                : "Sem histórico suficiente para montar a sugestão."}
            </DialogDescription>
          </DialogHeader>

          {chinaSuggestionState?.item.chinaSuggestionMeta && (
            <>
              <div className="grid gap-3 rounded-xl border border-[#D7E2EC] bg-[#F8FBFD] p-4 sm:grid-cols-3">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#60758A]">
                    Produtor
                  </p>
                  <p className="mt-1 text-sm font-bold text-[#173D6E]">
                    {chinaSuggestionState.item.row.PRODUTOR || "Sem nome"}
                  </p>
                </div>

                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#60758A]">
                    Sexo / lote
                  </p>
                  <p className="mt-1 text-sm font-bold text-[#173D6E]">
                    {chinaSuggestionState.item.sex} •{" "}
                    {numberFormat.format(chinaSuggestionState.item.quantity)}
                  </p>
                </div>

                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#60758A]">
                    China sugerido
                  </p>
                  <p className="mt-1 text-sm font-bold text-[#173D6E]">
                    {numberFormat.format(
                      chinaSuggestionState.item.chinaSuggestionMeta
                        .suggestedQuantity,
                    )}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-[#CFE0EF] bg-[#EEF6FD] p-3 text-sm text-[#1B4D80]">
                Aplicando {percentFormat.format(
                  chinaSuggestionState.item.chinaSuggestionMeta.chinaPercent * 100,
                )}
                % sobre {numberFormat.format(chinaSuggestionState.item.quantity)}{" "}
                {chinaSuggestionState.item.sex.toLowerCase()}, a sugestão fica em{" "}
                <strong>
                  {numberFormat.format(
                    chinaSuggestionState.item.chinaSuggestionMeta
                      .suggestedQuantity,
                  )}{" "}
                  China
                </strong>
                .
              </div>
            </>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={Boolean(savingChinaSuggestionKey)}
              onClick={() => setChinaSuggestionState(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              autoFocus
              disabled={
                !canManage ||
                !chinaSuggestionState?.item.chinaSuggestionMeta ||
                Boolean(savingChinaSuggestionKey)
              }
              onClick={() => void applyChinaSuggestion()}
            >
              {savingChinaSuggestionKey ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Confirmar sugestão"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(locationDialog)}
        onOpenChange={(open) => {
          if (!open) setLocationDialog(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mb-1 flex h-11 w-11 items-center justify-center rounded-xl border border-[#B9D5EE] bg-[#EAF4FD] text-[#1B67AA]">
              <MapPin className="h-5 w-5" />
            </div>
            <DialogTitle>Abrir localização</DialogTitle>
            <DialogDescription>
              {locationDialog
                ? `${locationDialog.producer} • ${locationDialog.farm}`
                : "Escolha o aplicativo de navegação."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              type="button"
              variant="outline"
              className="h-12 justify-start gap-3 border-[#C9D8E5] font-extrabold text-[#173D6E] hover:bg-[#F3F8FC]"
              disabled={!locationDialog}
              onClick={() => {
                if (!locationDialog) return;
                window.open(
                  `https://www.google.com/maps/search/?api=1&query=${locationDialog.latitude},${locationDialog.longitude}`,
                  "_blank",
                  "noopener,noreferrer",
                );
                setLocationDialog(null);
              }}
            >
              <MapPin className="h-4 w-4 text-[#1B67AA]" />
              Google Maps
            </Button>

            <Button
              type="button"
              className="h-12 justify-start gap-3 bg-[#1B67AA] font-extrabold text-white hover:bg-[#14558E]"
              disabled={!locationDialog}
              onClick={() => {
                if (!locationDialog) return;
                window.open(
                  `https://www.waze.com/ul?ll=${locationDialog.latitude},${locationDialog.longitude}&navigate=yes`,
                  "_blank",
                  "noopener,noreferrer",
                );
                setLocationDialog(null);
              }}
            >
              <Navigation className="h-4 w-4" />
              Waze
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
      className="min-w-0 snap-start overflow-hidden rounded-lg border border-[#C9D7E5] bg-white shadow-[0_2px_9px_rgba(23,61,110,0.04)] transition-shadow hover:shadow-[0_4px_14px_rgba(23,61,110,0.07)]"
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
          <p className="line-clamp-2 min-h-[24px] break-words text-[11px] font-black leading-[1.08] tracking-[-0.01em] text-[#173D6E] lg:text-[clamp(0.5rem,0.62vw,0.72rem)]">
            {label}
          </p>

          <div className="mt-0.5 flex min-w-0 flex-nowrap items-baseline gap-[clamp(0.1rem,0.25vw,0.35rem)]">
            <p className="whitespace-nowrap text-lg font-black leading-none text-[#173D6E] lg:text-[clamp(0.62rem,0.92vw,1.15rem)]">
              {value}
            </p>

            {secondaryValue && (
              <p className="inline-flex whitespace-nowrap rounded-full border border-[#CFE0EF] bg-[#F3F8FC] px-2 py-0.5 text-[10px] font-extrabold leading-none text-[#5A728A] lg:text-[clamp(0.46rem,0.72vw,0.78rem)]">
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
  const normalizedValue = value.replace("•", "•");
  const [primaryValue, secondaryValue] = normalizedValue.split(" • ");

  return (
    <span
      className="inline-flex h-7 items-center gap-1.5 rounded-md border border-[#C3D0DC] bg-white px-2.5 shadow-none"
      title={`${label}: ${normalizedValue}`}
    >
      <span className="whitespace-nowrap text-[9px] font-extrabold uppercase tracking-[0.04em] text-[#52677E]">
        {label}
      </span>

      <span className="whitespace-nowrap text-[12px] font-black leading-none text-[#173D6E]">
        {primaryValue}
      </span>

      {secondaryValue && (
        <span className="inline-flex whitespace-nowrap rounded-full border border-[#D6E3EF] bg-[#F3F8FC] px-1.5 py-0.5 text-[10px] font-extrabold leading-none text-[#5A728A]">
          {secondaryValue}
        </span>
      )}
    </span>
  );
}

