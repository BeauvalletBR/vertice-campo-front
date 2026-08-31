import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  BadgeCheck,
  CalendarDays,
  CalendarRange,
  CircleDollarSign,
  ClipboardList,
  Loader2,
  ShieldCheck,
  TrendingUp,
  UserRound,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { consultarEscala } from "@/services/escala";
import type { EscalaLinha } from "@/types/escala";
import {
  calculatePlanningTotals,
  getAgrotoolsPlannedTotal,
  getEmpresaLogada,
  getOrderTotal,
  getUniquePlanningRecords,
  parseLocalDate,
} from "@/lib/escala-planning";

const numberFormat = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 0,
});

const decimalFormat = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const currencyFormat = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const percentFormat = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const MONTH_OPTIONS = [
  { value: "01", label: "Janeiro" },
  { value: "02", label: "Fevereiro" },
  { value: "03", label: "Março" },
  { value: "04", label: "Abril" },
  { value: "05", label: "Maio" },
  { value: "06", label: "Junho" },
  { value: "07", label: "Julho" },
  { value: "08", label: "Agosto" },
  { value: "09", label: "Setembro" },
  { value: "10", label: "Outubro" },
  { value: "11", label: "Novembro" },
  { value: "12", label: "Dezembro" },
] as const;

const BUYER_COLORS = [
  "#F97316",
  "#173D6E",
  "#0F766E",
  "#2563EB",
  "#CA8A04",
  "#7C3AED",
  "#0EA5E9",
  "#D9485F",
] as const;

type DashboardDateBasis = "scale" | "order";

interface DailyAggregate {
  day: string;
  label: string;
  totalAnimals: number;
  china: number;
  agrotools: number;
}

interface PeriodBucket {
  key: string;
  label: string;
  shortLabel: string;
  rangeLabel: string;
  totalAnimals: number;
  china: number;
  agrotools: number;
  averageAnimalsPerDay: number;
  averageChinaPerDay: number;
  averageAgrotoolsPerDay: number;
  days: DailyAggregate[];
}

interface BuyerAggregate {
  code: number | null;
  buyer: string;
  china: number;
  agrotools: number;
  animals: number;
}

const toNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getReferenceDate = (
  row: EscalaLinha,
  dateBasis: DashboardDateBasis,
) => {
  const value = dateBasis === "order" ? row.DTAPEDIDO : row.DATA_ABATE;
  return value?.split("T")[0] || "";
};

const getMonthKey = (value: string) => value.slice(0, 7);

const formatShortDate = (value: string) => {
  const date = parseLocalDate(value);
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
};

const getChinaTotal = (row: EscalaLinha) =>
  toNumber(row.QTD_CHINA_VACA) + toNumber(row.QTD_CHINA_BOI);

const getWeightedArrobas = (row: EscalaLinha) =>
  toNumber(row.ARROBAS_VACA) * toNumber(row.QTD_VACA) +
  toNumber(row.ARROBAS_BOI) * toNumber(row.QTD_BOI);

const getArrobasHeads = (row: EscalaLinha) =>
  (toNumber(row.ARROBAS_VACA) > 0 ? toNumber(row.QTD_VACA) : 0) +
  (toNumber(row.ARROBAS_BOI) > 0 ? toNumber(row.QTD_BOI) : 0);

const getBuyerCode = (row: EscalaLinha) => {
  const candidates = [
    row.ID_COMPRADOR_ESCALA,
    row.SEQCOMPRADOR_ERP,
    row.SEQCOMPRADOR,
  ];

  for (const candidate of candidates) {
    const parsed = Number(candidate);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return null;
};

const getBuyerName = (row: EscalaLinha) =>
  String(
    row.COMPRADOR_ESCALA ||
      row.COMPRADOR_EXIBICAO ||
      row.COMPRADOR_ERP ||
      row.COMPRADOR ||
      "NÃO INFORMADO",
  )
    .trim()
    .toUpperCase();

const getIsoWeekInfo = (value: string) => {
  const date = parseLocalDate(value);
  const temporary = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const day = temporary.getUTCDay() || 7;
  temporary.setUTCDate(temporary.getUTCDate() + 4 - day);
  const isoYear = temporary.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const isoWeek = Math.ceil(
    ((temporary.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );

  const monday = new Date(temporary);
  monday.setUTCDate(temporary.getUTCDate() - 3);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);

  return {
    isoYear,
    isoWeek,
    key: `${isoYear}-W${String(isoWeek).padStart(2, "0")}`,
    start: `${monday.getUTCFullYear()}-${String(monday.getUTCMonth() + 1).padStart(2, "0")}-${String(monday.getUTCDate()).padStart(2, "0")}`,
    end: `${sunday.getUTCFullYear()}-${String(sunday.getUTCMonth() + 1).padStart(2, "0")}-${String(sunday.getUTCDate()).padStart(2, "0")}`,
  };
};

const buildDailyAggregates = (
  records: EscalaLinha[],
  dateBasis: DashboardDateBasis,
) => {
  const map = new Map<string, DailyAggregate>();

  for (const row of records) {
    const day = getReferenceDate(row, dateBasis);
    if (!day) continue;

    const current = map.get(day) || {
      day,
      label: formatShortDate(day),
      totalAnimals: 0,
      china: 0,
      agrotools: 0,
    };

    current.totalAnimals += getOrderTotal(row);
    current.china += getChinaTotal(row);
    current.agrotools += getAgrotoolsPlannedTotal(row);
    map.set(day, current);
  }

  return Array.from(map.values()).sort((a, b) => a.day.localeCompare(b.day));
};

const groupDailyByWeek = (
  days: DailyAggregate[],
  useMonthOrder: boolean,
): PeriodBucket[] => {
  const map = new Map<string, PeriodBucket>();

  for (const day of days) {
    const weekInfo = getIsoWeekInfo(day.day);
    const current = map.get(weekInfo.key) || {
      key: weekInfo.key,
      label: `Semana ${String(weekInfo.isoWeek).padStart(2, "0")}`,
      shortLabel: `S${String(weekInfo.isoWeek).padStart(2, "0")}`,
      rangeLabel: `${formatShortDate(weekInfo.start)} - ${formatShortDate(
        weekInfo.end,
      )}`,
      totalAnimals: 0,
      china: 0,
      agrotools: 0,
      averageAnimalsPerDay: 0,
      averageChinaPerDay: 0,
      averageAgrotoolsPerDay: 0,
      days: [],
    };

    current.totalAnimals += day.totalAnimals;
    current.china += day.china;
    current.agrotools += day.agrotools;
    current.days.push(day);
    map.set(weekInfo.key, current);
  }

  const buckets = Array.from(map.values()).sort((a, b) =>
    a.days[0].day.localeCompare(b.days[0].day),
  );

  return buckets.map((bucket, index) => {
    const size = bucket.days.length || 1;
    return {
      ...bucket,
      label: useMonthOrder
        ? `${index + 1}ª Semana`
        : `Semana ${bucket.shortLabel.replace("S", "")}`,
      averageAnimalsPerDay: bucket.totalAnimals / size,
      averageChinaPerDay: bucket.china / size,
      averageAgrotoolsPerDay: bucket.agrotools / size,
    };
  });
};

const buildBuyerAggregates = (records: EscalaLinha[]) => {
  const map = new Map<string, BuyerAggregate>();

  for (const row of records) {
    const code = getBuyerCode(row);
    const buyer = getBuyerName(row);
    const key = `${code ?? "SEM"}-${buyer}`;
    const current = map.get(key) || {
      code,
      buyer,
      china: 0,
      agrotools: 0,
      animals: 0,
    };

    current.china += getChinaTotal(row);
    current.agrotools += getAgrotoolsPlannedTotal(row);
    current.animals += getOrderTotal(row);
    map.set(key, current);
  }

  return Array.from(map.values()).sort((a, b) => b.animals - a.animals);
};

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#60758A]">
        {label}
      </span>
      <div className="relative">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-10 w-full appearance-none rounded-xl border border-[#C9D6E2] bg-white px-3 pr-9 text-sm font-bold text-[#173D6E] shadow-sm outline-none transition focus:border-[#1B58A0] focus:ring-2 focus:ring-[#1B58A0]/15"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-[#8797A8]">
          ▼
        </span>
      </div>
    </label>
  );
}

function MetricCard({
  title,
  value,
  icon,
  accentClass,
  secondary,
}: {
  title: string;
  value: string;
  icon: ReactNode;
  accentClass: string;
  secondary?: string;
}) {
  return (
    <Card className="w-[240px] min-w-0 shrink-0 snap-start overflow-hidden rounded-2xl border border-[#D6E1EB] bg-white shadow-[0_6px_20px_rgba(23,61,110,0.06)] sm:w-full">
      <div className={`h-1.5 ${accentClass}`} />
      <CardContent className="p-3.5">
        <div className="flex items-start gap-3">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${accentClass} text-white shadow-sm`}
          >
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate whitespace-nowrap text-[10px] font-extrabold uppercase tracking-[0.06em] text-[#60758A]">
              {title}
            </p>
            <div className="mt-2 flex items-baseline gap-1.5 overflow-hidden">
              <p className="shrink-0 whitespace-nowrap text-[28px] font-black leading-none text-[#173D6E]">
                {value}
              </p>
              {secondary && (
                <span className="inline-flex shrink-0 whitespace-nowrap rounded-full border border-[#D6E3EF] bg-[#F3F8FC] px-2 py-0.5 text-[10px] font-extrabold text-[#5A728A]">
                  {secondary}
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const renderBarLabel = ({ value }: { value?: number | string }) => (
  <text
    x={0}
    y={0}
    dy={-8}
    fill="#173D6E"
    fontSize={11}
    fontWeight={800}
    textAnchor="middle"
  >
    {numberFormat.format(Number(value ?? 0))}
  </text>
);

const renderPieLabel = ({
  value,
  x,
  y,
}: {
  value?: number | string;
  x?: number;
  y?: number;
}) => (
  <text
    x={x}
    y={y}
    fill="#173D6E"
    fontSize={11}
    fontWeight={800}
    textAnchor="middle"
    dominantBaseline="central"
  >
    {numberFormat.format(Number(value ?? 0))}
  </text>
);

export default function EscalaDashboardScreen() {
  const { user } = useAuth();
  const [dateBasis, setDateBasis] = useState<DashboardDateBasis>("scale");
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));
  const [selectedMonth, setSelectedMonth] = useState(
    String(new Date().getMonth() + 1).padStart(2, "0"),
  );
  const [loading, setLoading] = useState(true);
  const [yearLines, setYearLines] = useState<EscalaLinha[]>([]);

  const nroempresa = getEmpresaLogada(user);

  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, index) => {
      const year = String(currentYear - 2 + index);
      return { value: year, label: year };
    });
  }, []);

  useEffect(() => {
    const loadYearLines = async () => {
      setLoading(true);

      try {
        const queryEndYear =
          dateBasis === "order" ? Number(selectedYear) + 1 : selectedYear;
        const data = await consultarEscala({
          nroempresa,
          data_inicio: `${selectedYear}-01-01`,
          data_fim: `${queryEndYear}-12-31`,
        });
        setYearLines(Array.isArray(data) ? data : []);
      } finally {
        setLoading(false);
      }
    };

    void loadYearLines();
  }, [dateBasis, nroempresa, selectedYear]);

  const insertedRecords = useMemo(
    () =>
      getUniquePlanningRecords(yearLines).filter((row) => {
        const scaleId = Number(row.ID_ESCALA);
        return Number.isFinite(scaleId) && scaleId > 0;
      }),
    [yearLines],
  );

  const referenceYearRecords = useMemo(
    () =>
      insertedRecords.filter((row) =>
        getReferenceDate(row, dateBasis).startsWith(`${selectedYear}-`),
      ),
    [dateBasis, insertedRecords, selectedYear],
  );

  const monthOptions = useMemo(() => {
    const availableMonths = new Set(
      referenceYearRecords
        .map((row) => getReferenceDate(row, dateBasis))
        .filter(Boolean)
        .map(getMonthKey),
    );

    if (availableMonths.size === 0) return [...MONTH_OPTIONS];
    return MONTH_OPTIONS.filter((month) =>
      availableMonths.has(`${selectedYear}-${month.value}`),
    );
  }, [dateBasis, referenceYearRecords, selectedYear]);

  useEffect(() => {
    if (!monthOptions.some((option) => option.value === selectedMonth)) {
      setSelectedMonth(monthOptions[0]?.value || "01");
    }
  }, [monthOptions, selectedMonth]);

  const filteredRecords = useMemo(
    () =>
      referenceYearRecords.filter(
      (row) =>
        getMonthKey(getReferenceDate(row, dateBasis)) ===
        `${selectedYear}-${selectedMonth}`,
      ),
    [dateBasis, referenceYearRecords, selectedMonth, selectedYear],
  );

  const dailyAggregates = useMemo(
    () => buildDailyAggregates(filteredRecords, dateBasis),
    [dateBasis, filteredRecords],
  );

  const periodBuckets = useMemo(
    () => groupDailyByWeek(dailyAggregates, true),
    [dailyAggregates],
  );

  const buyerAggregates = useMemo(
    () => buildBuyerAggregates(filteredRecords),
    [filteredRecords],
  );

  const displayBuyerAggregates = useMemo(
    () => buyerAggregates.filter((item) => item.code !== 1 && item.animals > 0),
    [buyerAggregates],
  );

  const pieBuyerData = useMemo(
    () => displayBuyerAggregates.slice(0, 8),
    [displayBuyerAggregates],
  );

  const dashboardTotals = useMemo(
    () => calculatePlanningTotals(filteredRecords),
    [filteredRecords],
  );

  const totalAnimals = dailyAggregates.reduce(
    (total, item) => total + item.totalAnimals,
    0,
  );
  const totalChina = dailyAggregates.reduce((total, item) => total + item.china, 0);
  const totalNonChina = Math.max(0, totalAnimals - totalChina);
  const totalAgrotools = dailyAggregates.reduce(
    (total, item) => total + item.agrotools,
    0,
  );
  const averageArrobasBase = filteredRecords.reduce(
    (total, row) => total + getWeightedArrobas(row),
    0,
  );
  const averageArrobasHeads = filteredRecords.reduce(
    (total, row) => total + getArrobasHeads(row),
    0,
  );
  const averageArrobas =
    averageArrobasHeads > 0 ? averageArrobasBase / averageArrobasHeads : 0;

  const chartData = useMemo(
    () =>
      periodBuckets.map((bucket) => ({
        label: bucket.shortLabel,
        range: bucket.rangeLabel,
        china: bucket.china,
        nonChina: Math.max(0, bucket.totalAnimals - bucket.china),
      })),
    [periodBuckets],
  );

  const dateBasisLabel =
    dateBasis === "order" ? "data do pedido (compra)" : "data da escala";

  const rangeDescription = useMemo(() => {
    const suffix = ` • Por ${dateBasisLabel}`;
    const monthLabel =
      MONTH_OPTIONS.find((option) => option.value === selectedMonth)?.label ||
      selectedMonth;
    return `${monthLabel} de ${selectedYear} agrupado por semana${suffix}`;
  }, [dateBasisLabel, selectedMonth, selectedYear]);

  const cards = [
    {
      title: dateBasis === "order" ? "Animais comprados" : "Animais escalados",
      value: numberFormat.format(totalAnimals),
      icon: <ClipboardList className="h-6 w-6" />,
      accentClass: "bg-[#173D6E]",
    },
    {
      title: "China",
      value: numberFormat.format(totalChina),
      secondary:
        totalAnimals > 0
          ? `${percentFormat.format((totalChina / totalAnimals) * 100)}%`
          : "0,0%",
      icon: <BadgeCheck className="h-6 w-6" />,
      accentClass: "bg-[#F59E0B]",
    },
    {
      title: "Não China",
      value: numberFormat.format(totalNonChina),
      secondary:
        totalAnimals > 0
          ? `${percentFormat.format((totalNonChina / totalAnimals) * 100)}%`
          : "0,0%",
      icon: <ShieldCheck className="h-6 w-6" />,
      accentClass: "bg-[#173D6E]",
    },
    {
      title: "Agrotools",
      value: numberFormat.format(totalAgrotools),
      secondary:
        totalAnimals > 0
          ? `${percentFormat.format((totalAgrotools / totalAnimals) * 100)}%`
          : "0,0%",
      icon: <ShieldCheck className="h-6 w-6" />,
      accentClass: "bg-[#0F9F6E]",
    },
    {
      title: "Valor Médio do Gado",
      value: currencyFormat.format(dashboardTotals.averagePaid),
      icon: <CircleDollarSign className="h-6 w-6" />,
      accentClass: "bg-[#7C3AED]",
    },
    {
      title: "Média por Dia",
      value: decimalFormat.format(totalAnimals / Math.max(1, dailyAggregates.length)),
      icon: <CalendarDays className="h-6 w-6" />,
      accentClass: "bg-[#2563EB]",
      secondary: `${dailyAggregates.length} dias`,
    },
    {
      title: "@ Médio",
      value: averageArrobas > 0 ? decimalFormat.format(averageArrobas) : "0,0",
      icon: <CalendarRange className="h-6 w-6" />,
      accentClass: "bg-[#D9485F]",
      secondary: "@",
    },
    {
      title: "% Boi",
      value:
        totalAnimals > 0
          ? `${percentFormat.format((dashboardTotals.bulls / totalAnimals) * 100)}%`
          : "0,0%",
      icon: <TrendingUp className="h-6 w-6" />,
      accentClass: "bg-[#0F766E]",
      secondary: `${numberFormat.format(dashboardTotals.bulls)} bois`,
    },
  ];

  return (
    <div className="min-h-screen bg-[#F5F8FB] p-3 sm:p-5 lg:p-8">
      <div className="mx-auto max-w-[1680px] space-y-4 sm:space-y-6">
        <header className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#E27A1D]">
              Módulo Escala
            </p>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-[#173D6E] sm:text-3xl">
              Dashboard da Escala
            </h1>
            <p className="mt-2 max-w-3xl text-sm font-medium text-[#60758A]">
              Acompanhamento macro do mês por data da escala ou pela data em que
              o pedido foi comprado.
            </p>
          </div>

          <div className="w-full rounded-2xl border border-[#D6E1EB] bg-white px-4 py-3 text-xs font-semibold text-[#60758A] shadow-sm xl:w-auto">
            {rangeDescription}
          </div>
        </header>

        <Card className="overflow-hidden rounded-2xl border border-[#D3DEE9] bg-white shadow-[0_4px_18px_rgba(23,61,110,0.05)]">
          <div className="h-1 bg-[#173D6E]" />
          <CardContent className="space-y-4 p-3 sm:p-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <FilterSelect
                label="Data-base"
                value={dateBasis}
                onChange={(value) =>
                  setDateBasis(value as DashboardDateBasis)
                }
                options={[
                  { value: "scale", label: "Data da escala" },
                  { value: "order", label: "Data do pedido (compra)" },
                ]}
              />

              <FilterSelect
                label="Ano"
                value={selectedYear}
                onChange={setSelectedYear}
                options={yearOptions}
              />

              <FilterSelect
                label="Mês"
                value={selectedMonth}
                onChange={setSelectedMonth}
                options={monthOptions.map((option) => ({
                  value: option.value,
                  label: option.label,
                }))}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#60758A]">
              <Badge
                variant="outline"
                className="border-[#C9D6E2] bg-[#F7FAFC] text-[#173D6E]"
              >
                Filtrando por {dateBasisLabel}
              </Badge>
              {dateBasis === "order" && (
                <span>
                  Pedidos sem <strong>DTAPEDIDO</strong> não entram no cálculo.
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <Card className="rounded-2xl border border-[#D3DEE9] bg-white shadow-[0_4px_18px_rgba(23,61,110,0.04)]">
            <CardContent className="flex min-h-[320px] flex-col items-center justify-center">
              <Loader2 className="mb-3 h-8 w-8 animate-spin text-[#1B58A0]" />
              <p className="text-sm font-bold text-[#60758A]">
                Carregando painel da escala...
              </p>
            </CardContent>
          </Card>
        ) : dailyAggregates.length === 0 ? (
          <Card className="rounded-2xl border border-[#D3DEE9] bg-white shadow-[0_4px_18px_rgba(23,61,110,0.04)]">
            <CardContent className="p-10 text-center text-sm font-semibold text-[#718297]">
              Nenhum registro com {dateBasisLabel} foi encontrado para os filtros
              selecionados.
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="-mx-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-3 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:px-0 lg:grid-cols-3 xl:grid-cols-6">
              {cards.map((card) => (
                <MetricCard key={card.title} {...card} />
              ))}
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.55fr_1fr]">
              <Card className="overflow-hidden rounded-2xl border border-[#D3DEE9] bg-white shadow-[0_4px_18px_rgba(23,61,110,0.05)]">
                <CardHeader className="border-b border-[#E3EAF1] bg-[#F8FBFD]">
                  <CardTitle className="text-lg font-black text-[#173D6E]">
                    China x Não China no período
                  </CardTitle>
                  <CardDescription className="font-medium text-[#60758A]">
                    Comparativo por {dateBasisLabel} no agrupamento selecionado.
                  </CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto p-3 sm:p-4">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.08em] text-[#60758A] sm:hidden">
                    Deslize para visualizar todo o gráfico
                  </p>
                  <div className="h-[280px] min-w-[540px] sm:h-[320px] sm:min-w-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} barGap={10} margin={{ top: 20, right: 8, left: -12 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#D9E2EC" />
                        <XAxis dataKey="label" stroke="#60758A" tickLine={false} />
                        <YAxis stroke="#60758A" tickLine={false} />
                        <Tooltip
                          formatter={(value: number, name: string) => [
                            numberFormat.format(value),
                            name === "china" ? "China" : "Não China",
                          ]}
                          labelFormatter={(label) => {
                            const item = chartData.find((entry) => entry.label === label);
                            return item?.range || label;
                          }}
                        />
                        <Legend
                          formatter={(value) =>
                            value === "china" ? "China" : "Não China"
                          }
                        />
                        <Bar dataKey="china" name="china" radius={[6, 6, 0, 0]} fill="#F59E0B">
                          <LabelList dataKey="china" content={renderBarLabel} />
                        </Bar>
                        <Bar dataKey="nonChina" name="nonChina" radius={[6, 6, 0, 0]} fill="#173D6E">
                          <LabelList dataKey="nonChina" content={renderBarLabel} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card className="overflow-hidden rounded-2xl border border-[#D3DEE9] bg-white shadow-[0_4px_18px_rgba(23,61,110,0.05)]">
                <CardHeader className="border-b border-[#E3EAF1] bg-[#FFF9F1]">
                  <CardTitle className="text-base font-black text-[#9A580B]">
                    Compradores com mais animais
                  </CardTitle>
                  <CardDescription className="font-medium text-[#8A6C3A]">
                    Considera apenas compradores com código diferente de 1.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-3 sm:p-4">
                  <div className="h-[280px] w-full sm:h-[320px]">
                    {pieBuyerData.length === 0 ? (
                      <div className="flex h-full items-center justify-center text-sm font-semibold text-[#8A6C3A]">
                        Nenhum comprador elegível no recorte atual.
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Tooltip
                            formatter={(value: number) => [
                              numberFormat.format(value),
                              "Animais",
                            ]}
                          />
                          <Legend />
                          <Pie
                            data={pieBuyerData}
                            dataKey="animals"
                            nameKey="buyer"
                            cx="50%"
                            cy="50%"
                            innerRadius={62}
                            outerRadius={108}
                            paddingAngle={2}
                            labelLine={false}
                            label={renderPieLabel}
                          >
                            {pieBuyerData.map((entry, index) => (
                              <Cell
                                key={`${entry.buyer}-animals`}
                                fill={BUYER_COLORS[index % BUYER_COLORS.length]}
                              />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <section className="-mt-2 space-y-3">
              <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <h2 className="text-xl font-black text-[#173D6E]">
                    Semanas do mês
                  </h2>
                  <p className="mt-1 text-sm font-medium text-[#60758A]">
                    Resumo operacional agrupado por {dateBasisLabel}.
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className="border-[#C9D6E2] bg-white px-3 py-1 text-xs font-extrabold text-[#173D6E]"
                >
                  {periodBuckets.length} agrupamentos
                </Badge>
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                {periodBuckets.map((bucket) => (
                  <Card
                    key={bucket.key}
                    className="overflow-hidden rounded-2xl border border-[#D3DEE9] bg-white shadow-[0_5px_18px_rgba(23,61,110,0.05)]"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-[116px_minmax(0,1fr)]">
                      <div className="flex flex-row items-center justify-between gap-4 bg-[#446DB5] px-4 py-3 text-white sm:flex-col sm:items-start sm:justify-center sm:gap-0 sm:py-5">
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/75">
                          {dateBasis === "order" ? "Compra" : "Escala"}
                        </p>
                        <p className="mt-2 text-2xl font-black leading-none">
                          {bucket.shortLabel}
                        </p>
                        <p className="mt-1 text-xs font-bold uppercase tracking-[0.1em]">
                          {bucket.label}
                        </p>
                        <p className="mt-4 text-[11px] font-semibold text-white/80">
                          {bucket.rangeLabel}
                        </p>
                      </div>

                      <div className="min-w-0">
                        <table className="w-full table-fixed border-collapse text-xs xl:text-sm">
                          <colgroup>
                            <col className="w-[31%]" />
                            <col className="w-[23%]" />
                            <col className="w-[23%]" />
                            <col className="w-[23%]" />
                          </colgroup>
                          <thead>
                            <tr className="bg-[#F7FAFC] text-[#173D6E]">
                              <th className="border-b border-r border-[#D7E2EC] px-2 py-2 text-left text-[9px] font-extrabold uppercase tracking-[0.04em]">
                                Data
                              </th>
                              <th className="border-b border-r border-[#D7E2EC] px-2 py-2 text-right text-[9px] font-extrabold uppercase tracking-[0.04em]">
                                {dateBasis === "order" ? "Comprados" : "Animais"}
                              </th>
                              <th className="border-b border-r border-[#D7E2EC] bg-[#FFF3D7] px-2 py-2 text-right text-[9px] font-extrabold uppercase tracking-[0.04em]">
                                China
                              </th>
                              <th className="border-b border-[#D7E2EC] bg-[#E3F8E9] px-2 py-2 text-right text-[9px] font-extrabold uppercase tracking-[0.04em]">
                                Agrotools
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {bucket.days.map((day) => (
                              <tr key={day.day} className="border-b border-[#EDF2F7]">
                                <td className="truncate border-r border-[#EDF2F7] px-2 py-2 font-bold text-[#425B73]" title={day.label}>
                                  {day.label}
                                </td>
                                <td className="border-r border-[#EDF2F7] px-2 py-2 text-right font-extrabold text-[#173D6E]">
                                  {numberFormat.format(day.totalAnimals)}
                                </td>
                                <td className="border-r border-[#EDF2F7] bg-[#FFF8EA] px-2 py-2 text-right font-extrabold text-[#B85B00]">
                                  {numberFormat.format(day.china)}
                                </td>
                                <td className="bg-[#F0FFF4] px-2 py-2 text-right font-extrabold text-[#13795B]">
                                  {numberFormat.format(day.agrotools)}
                                </td>
                              </tr>
                            ))}
                            <tr className="bg-[#F8FAFC]">
                              <td className="border-r border-[#D7E2EC] px-3 py-2 text-[11px] font-black uppercase tracking-[0.08em] text-[#52677E]">
                                Média
                              </td>
                              <td className="border-r border-[#D7E2EC] px-3 py-2 text-right font-extrabold text-[#173D6E]">
                                {decimalFormat.format(bucket.averageAnimalsPerDay)}
                              </td>
                              <td className="border-r border-[#D7E2EC] bg-[#FFF3D7] px-3 py-2 text-right font-extrabold text-[#B85B00]">
                                {decimalFormat.format(bucket.averageChinaPerDay)}
                              </td>
                              <td className="bg-[#E3F8E9] px-3 py-2 text-right font-extrabold text-[#13795B]">
                                {decimalFormat.format(bucket.averageAgrotoolsPerDay)}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </section>

            <Card className="overflow-hidden rounded-2xl border border-[#D3DEE9] bg-white shadow-[0_4px_18px_rgba(23,61,110,0.05)]">
              <CardHeader className="border-b border-[#E3EAF1] bg-[#F8FBFD]">
                <CardTitle className="text-lg font-black text-[#173D6E]">
                  Compradores no recorte
                </CardTitle>
                <CardDescription className="font-medium text-[#60758A]">
                  Consolidação por comprador usando {dateBasisLabel}.
                </CardDescription>
              </CardHeader>
              <CardContent className="min-w-0 p-0">
                <table className="w-full table-fixed border-collapse text-xs sm:text-sm">
                  <colgroup>
                    <col className="w-[55%]" />
                    <col className="w-[15%]" />
                    <col className="w-[15%]" />
                    <col className="w-[15%]" />
                  </colgroup>
                  <thead>
                    <tr className="bg-[#F8FBFD] text-[#173D6E]">
                      <th className="border-b border-r border-[#D7E2EC] px-4 py-3 text-left text-[10px] font-extrabold uppercase tracking-[0.08em]">
                        Comprador
                      </th>
                      <th className="border-b border-r border-[#D7E2EC] px-4 py-3 text-right text-[10px] font-extrabold uppercase tracking-[0.08em]">
                        Animais
                      </th>
                      <th className="border-b border-r border-[#D7E2EC] px-4 py-3 text-right text-[10px] font-extrabold uppercase tracking-[0.08em]">
                        China
                      </th>
                      <th className="border-b px-4 py-3 text-right text-[10px] font-extrabold uppercase tracking-[0.08em]">
                        Agrotools
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayBuyerAggregates.length === 0 ? (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-4 py-10 text-center text-sm font-semibold text-[#718297]"
                        >
                          Nenhum comprador elegível encontrado para o filtro atual.
                        </td>
                      </tr>
                    ) : (
                      displayBuyerAggregates.map((buyer) => (
                        <tr
                          key={`${buyer.code ?? "SEM"}-${buyer.buyer}`}
                          className="border-b border-[#EDF2F7] last:border-b-0"
                        >
                          <td className="border-r border-[#EDF2F7] px-2 py-3 font-extrabold text-[#173D6E] sm:px-4">
                            <div className="flex min-w-0 items-center gap-2">
                              <UserRound className="h-4 w-4 text-[#1B58A0]" />
                              <span className="truncate" title={buyer.buyer}>
                                {buyer.buyer}
                              </span>
                            </div>
                          </td>
                          <td className="border-r border-[#EDF2F7] px-4 py-3 text-right font-extrabold text-[#173D6E]">
                            {numberFormat.format(buyer.animals)}
                          </td>
                          <td className="border-r border-[#EDF2F7] px-4 py-3 text-right font-extrabold text-[#B85B00]">
                            {numberFormat.format(buyer.china)}
                          </td>
                          <td className="px-4 py-3 text-right font-extrabold text-[#13795B]">
                            {numberFormat.format(buyer.agrotools)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
