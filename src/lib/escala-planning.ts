import type {
  EscalaLinha,
  EscalaResumo,
  EscalaStatus,
} from "@/types/escala";
import {
  calculateRowsWeightedBasePrice,
  calculateScaleMacroAverages,
} from "@/lib/escala-pricing";

export interface PlanningTotals {
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
  averageArrobas: number;
  averagePaid: number;
  cowsPercent: number;
  bullsPercent: number;
  chinaPercent: number;
  agrotoolsPercent: number;
}

export interface WeekOption {
  key: string;
  week: number;
  year: number;
}

export const toNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const toOptionalNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || String(value).trim() === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const normalizeText = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toUpperCase();

export const formatDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const parseLocalDate = (value: string) => {
  const normalized = value.split("T")[0];
  const [year, month, day] = normalized.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0);
};

export const addDays = (value: string, days: number) => {
  const date = parseLocalDate(value);
  date.setDate(date.getDate() + days);
  return formatDateInput(date);
};

export const getISOWeekValue = (date = new Date()) => {
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

export const getNextISOWeekValue = () => {
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  return getISOWeekValue(nextWeek);
};

export const getInitialPlanningWeek = (
  rows: EscalaLinha[],
  referenceDate = new Date(),
) => {
  const currentWeek = getISOWeekValue(referenceDate);
  const nextDate = new Date(referenceDate);
  nextDate.setDate(nextDate.getDate() + 7);
  const nextWeek = getISOWeekValue(nextDate);
  const nextWeekStart = getStartDateFromWeek(nextWeek);
  const nextWeekEnd = addDays(nextWeekStart, 6);

  const hasNextWeekRecords = rows.some((row) => {
    const slaughterDate = row.DATA_ABATE?.split("T")[0];
    return Boolean(
      slaughterDate &&
        slaughterDate >= nextWeekStart &&
        slaughterDate <= nextWeekEnd &&
        getOrderTotal(row) > 0,
    );
  });

  return hasNextWeekRecords ? nextWeek : currentWeek;
};

export const getWeekValueFromDate = (value: string) =>
  getISOWeekValue(parseLocalDate(value));

export const getWeekCatalogRange = () => {
  const currentYear = new Date().getFullYear();
  return {
    data_inicio: `${currentYear - 2}-01-01`,
    data_fim: `${currentYear + 1}-12-31`,
  };
};

export const getStartDateFromWeek = (weekValue: string) => {
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

export const getCompleteMonthWeekRange = (monthValue: string) => {
  const [year, month] = monthValue.split("-").map(Number);
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    const currentWeekStart = getStartDateFromWeek(getISOWeekValue());
    return { start: currentWeekStart, end: addDays(currentWeekStart, 6) };
  }

  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const monthEnd = formatDateInput(new Date(year, month, 0, 12));
  const firstWeekStart = getStartDateFromWeek(
    getISOWeekValue(parseLocalDate(monthStart)),
  );
  const lastWeekStart = getStartDateFromWeek(
    getISOWeekValue(parseLocalDate(monthEnd)),
  );

  return {
    start: firstWeekStart,
    end: addDays(lastWeekStart, 6),
  };
};

export const formatDate = (value?: string | null) => {
  if (!value) return "—";
  return parseLocalDate(value).toLocaleDateString("pt-BR");
};

export const formatDayTitle = (value: string) => {
  const date = parseLocalDate(value);
  const weekday = date
    .toLocaleDateString("pt-BR", { weekday: "long" })
    .toUpperCase();
  return `${weekday} - ${date.toLocaleDateString("pt-BR")}`;
};

export const getEmpresaLogada = (user: unknown) => {
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

export const getPlanningKey = (row: EscalaLinha) =>
  row.ID_PLANEJAMENTO ||
  `${row.ORIGEM_REGISTRO}-${
    row.ID_ESCALA_PEDIDO_VINCULO ||
    row.ID_ESCALA_ITEM_MANUAL ||
    row.SEQPEDIDO ||
    row.NROPEDIDO ||
    row.PRODUTOR
  }`;

export const getUniquePlanningRecords = (rows: EscalaLinha[]) => {
  const map = new Map<string, EscalaLinha>();
  for (const row of rows) map.set(getPlanningKey(row), row);
  return Array.from(map.values());
};

export const getOrderTotal = (row: EscalaLinha) => {
  const total = toNumber(row.QTD_PEDIDA_TOTAL);
  return total > 0 ? total : toNumber(row.QTD_VACA) + toNumber(row.QTD_BOI);
};

export const getChinaPlannedTotal = (row: EscalaLinha) =>
  toNumber(row.QTD_CHINA_VACA) + toNumber(row.QTD_CHINA_BOI);

export const hasStoredPlanningChinaQuantity = (
  row: EscalaLinha,
  sex: "VACA" | "BOI",
) => {
  const storedValue =
    sex === "VACA" ? row.QTD_CHINA_VACA : row.QTD_CHINA_BOI;

  if (storedValue === null || storedValue === undefined) return false;

  return (
    row.ORIGEM_REGISTRO === "MANUAL" ||
    toNumber(row.ID_ESCALA_PEDIDO_VINCULO) > 0
  );
};

export const getAgrotoolsPlannedQuantity = (
  row: EscalaLinha,
  sex: "VACA" | "BOI",
) => {
  const storedQuantity =
    sex === "VACA"
      ? toNumber(row.QTD_AGROTOOLS_VACA)
      : toNumber(row.QTD_AGROTOOLS_BOI);
  const currentAnimalQuantity =
    sex === "VACA" ? toNumber(row.QTD_VACA) : toNumber(row.QTD_BOI);

  return storedQuantity > 0 ? currentAnimalQuantity : 0;
};

export const getAgrotoolsPlannedTotal = (row: EscalaLinha) =>
  getAgrotoolsPlannedQuantity(row, "VACA") +
  getAgrotoolsPlannedQuantity(row, "BOI");

export const hasPlanningSummaryData = (summary: EscalaResumo) =>
  [
    summary.QTD_PEDIDOS,
    summary.QTD_PEDIDOS_INCLUIDOS,
    summary.QTD_PEDIDOS_PENDENTES,
    summary.QTD_MANUAIS,
    summary.QTD_ITENS,
    summary.QTD_TOTAL,
    summary.TOTAL_CABECAS,
    summary.QTD_TOTAL_PLANEJADO,
  ].some((value) => toNumber(value) > 0);

export const getPlanningCurralTotal = (rows: EscalaLinha[]) =>
  getUniquePlanningRecords(rows).reduce(
    (total, row) => total + toNumber(row.CURRAL),
    0,
  );

export const ESCALA_DAILY_CURRAL_LIMIT = 21;

export const getProjectedPlanningCurralTotal = (
  rows: EscalaLinha[],
  currentCurral: unknown,
  nextCurral: unknown,
) =>
  getPlanningCurralTotal(rows) -
  toNumber(currentCurral) +
  toNumber(nextCurral);

export const getScaleId = (
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

export const getStatusClass = (status?: EscalaStatus | null) => {
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

export const getPlanningRowClass = (row: EscalaLinha) => {
  if (
    row.STATUS_CONFIGURACAO === "PENDENTE_CRIAR_ESCALA" ||
    row.STATUS_CONFIGURACAO === "PENDENTE_INCLUSAO"
  ) {
    return "bg-white hover:bg-[#FAFBFC] [&>td:first-child]:border-l-4 [&>td:first-child]:border-l-[#EE7218]";
  }

  if (row.STATUS_CONFIGURACAO === "PENDENTE_COMPLEMENTO") {
    return "bg-white hover:bg-[#FAFBFC] [&>td:first-child]:border-l-4 [&>td:first-child]:border-l-[#E30613]";
  }

  if (row.ORIGEM_REGISTRO === "MANUAL") {
    return "bg-[#FFF8F0] hover:bg-[#FFF0DF] [&>td:first-child]:border-l-4 [&>td:first-child]:border-l-[#C96A1B]";
  }

  return "bg-white hover:bg-[#F7F9FC] [&>td:first-child]:border-l-4 [&>td:first-child]:border-l-[#173D6E]";
};

export const calculatePlanningTotals = (rows: EscalaLinha[]): PlanningTotals => {
  const records = getUniquePlanningRecords(rows);
  const daysWithAnimals = new Set<string>();
  const macroAverages = calculateScaleMacroAverages(records);

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

  const percentage = (value: number) =>
    base.plannedHeads > 0 ? (value / base.plannedHeads) * 100 : 0;

  return {
    ...base,
    daysWithAnimals: daysWithAnimals.size,
    averageHeadsPerDay: base.plannedHeads / 5,
    averageArrobas: macroAverages.averageArrobas ?? 0,
    averagePaid: calculateRowsWeightedBasePrice(records) ?? 0,
    cowsPercent: percentage(base.cows),
    bullsPercent: percentage(base.bulls),
    chinaPercent: percentage(base.china),
    agrotoolsPercent: percentage(base.agrotools),
  };
};

export const buildWeekOptions = (
  availableSummaries: EscalaResumo[],
  latestPlanningWeek: string,
  selectedWeek: string,
): WeekOption[] => {
  const map = new Map<string, WeekOption>();

  for (const summary of availableSummaries) {
    if (!hasPlanningSummaryData(summary)) continue;

    const key = getWeekValueFromDate(summary.DATA_ABATE);
    if (key > latestPlanningWeek) continue;

    const [yearText, weekText] = key.split("-W");
    map.set(key, {
      key,
      week: Number(weekText),
      year: Number(yearText),
    });
  }

  if (!map.has(selectedWeek)) {
    const [yearText, weekText] = selectedWeek.split("-W");
    map.set(selectedWeek, {
      key: selectedWeek,
      week: Number(weekText),
      year: Number(yearText),
    });
  }

  return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
};
