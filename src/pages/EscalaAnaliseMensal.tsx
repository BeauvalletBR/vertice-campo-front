import { useEffect, useMemo, useState } from "react";
import {
  CalendarRange,
  ClipboardList,
  Loader2,
  RefreshCw,
  ShoppingCart,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import {
  getEmpresaLogada,
  getOrderTotal,
  getUniquePlanningRecords,
  toNumber,
} from "@/lib/escala-planning";
import { consultarEscala } from "@/services/escala";
import type { EscalaLinha } from "@/types/escala";

type DateBasis = "scale" | "order";

interface DailyMetrics {
  date: string;
  animals: number;
  bulls: number;
  cows: number;
  china: number;
  agrotools: number;
}

interface WeeklyMetrics extends DailyMetrics {
  key: string;
  week: number;
  start: string;
  end: string;
  days: DailyMetrics[];
}

const numberFormat = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 0,
});

const getCurrentMonth = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

const parseLocalDate = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
};

const formatDate = (value: string) =>
  parseLocalDate(value).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

const formatDay = (value: string) =>
  parseLocalDate(value).toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });

const formatMonth = (value: string) => {
  const [year, month] = value.split("-").map(Number);
  const label = new Date(year, month - 1, 1, 12).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
};

const getReferenceDate = (row: EscalaLinha, basis: DateBasis) =>
  (basis === "scale" ? row.DATA_ABATE : row.DTAPEDIDO)?.split("T")[0] || "";

const getIsoWeek = (value: string) => {
  const localDate = parseLocalDate(value);
  const date = new Date(
    Date.UTC(localDate.getFullYear(), localDate.getMonth(), localDate.getDate()),
  );
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  const monday = new Date(date);
  monday.setUTCDate(date.getUTCDate() - 3);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  const toIso = (item: Date) => item.toISOString().slice(0, 10);

  return {
    key: `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`,
    week,
    start: toIso(monday),
    end: toIso(sunday),
  };
};

const buildWeeklyMetrics = (
  sourceRows: EscalaLinha[],
  basis: DateBasis,
  selectedMonth: string,
) => {
  const dailyMap = new Map<string, DailyMetrics>();

  for (const row of getUniquePlanningRecords(sourceRows)) {
    const date = getReferenceDate(row, basis);
    if (!date.startsWith(`${selectedMonth}-`)) continue;

    const current = dailyMap.get(date) || {
      date,
      animals: 0,
      bulls: 0,
      cows: 0,
      china: 0,
      agrotools: 0,
    };
    current.animals += getOrderTotal(row);
    current.bulls += toNumber(row.QTD_BOI);
    current.cows += toNumber(row.QTD_VACA);
    current.china +=
      toNumber(row.QTD_CHINA_VACA) + toNumber(row.QTD_CHINA_BOI);
    current.agrotools +=
      toNumber(row.QTD_AGROTOOLS_VACA) + toNumber(row.QTD_AGROTOOLS_BOI);
    dailyMap.set(date, current);
  }

  const weeklyMap = new Map<string, WeeklyMetrics>();
  const days = Array.from(dailyMap.values()).sort((first, second) =>
    first.date.localeCompare(second.date),
  );

  for (const day of days) {
    const week = getIsoWeek(day.date);
    const current = weeklyMap.get(week.key) || {
      ...week,
      date: day.date,
      animals: 0,
      bulls: 0,
      cows: 0,
      china: 0,
      agrotools: 0,
      days: [],
    };
    current.animals += day.animals;
    current.bulls += day.bulls;
    current.cows += day.cows;
    current.china += day.china;
    current.agrotools += day.agrotools;
    current.days.push(day);
    weeklyMap.set(week.key, current);
  }

  return Array.from(weeklyMap.values()).sort((first, second) =>
    first.start.localeCompare(second.start),
  );
};

const getMonthlyTotals = (weeks: WeeklyMetrics[]) =>
  weeks.reduce(
    (total, week) => ({
      animals: total.animals + week.animals,
      bulls: total.bulls + week.bulls,
      cows: total.cows + week.cows,
      china: total.china + week.china,
      agrotools: total.agrotools + week.agrotools,
    }),
    { animals: 0, bulls: 0, cows: 0, china: 0, agrotools: 0 },
  );

function MonthlyAnalysisSection({
  title,
  description,
  basis,
  weeks,
}: {
  title: string;
  description: string;
  basis: DateBasis;
  weeks: WeeklyMetrics[];
}) {
  const totals = getMonthlyTotals(weeks);
  const scaleBasis = basis === "scale";
  const accent = scaleBasis ? "bg-[#173D6E]" : "bg-[#D96B1A]";
  const softAccent = scaleBasis
    ? "border-[#C7D7E7] bg-[#EDF4FB] text-[#173D6E]"
    : "border-[#F0C8A8] bg-[#FFF5E9] text-[#A84A15]";

  return (
    <section className="space-y-3">
      <Card className="overflow-hidden rounded-2xl border border-[#D3DEE9] bg-white shadow-[0_4px_18px_rgba(23,61,110,0.05)]">
        <div className={`h-1.5 ${accent}`} />
        <CardContent className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${accent} text-white`}>
              {scaleBasis ? (
                <CalendarRange className="h-5 w-5" />
              ) : (
                <ShoppingCart className="h-5 w-5" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-black text-[#173D6E]">{title}</h2>
              <p className="mt-1 text-xs font-semibold text-[#60758A]">
                {description}
              </p>
            </div>
          </div>

          <div className="-mx-1 flex max-w-full gap-2 overflow-x-auto px-1 pb-1">
            {[
              ["Animais", totals.animals],
              ["Bois", totals.bulls],
              ["Vacas", totals.cows],
              ["China", totals.china],
              ["Agrotools", totals.agrotools],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                className={`min-w-[92px] shrink-0 rounded-xl border px-3 py-2 ${softAccent}`}
              >
                <p className="text-[9px] font-black uppercase tracking-[0.08em] opacity-75">
                  {label}
                </p>
                <p className="mt-1 text-lg font-black leading-none">
                  {numberFormat.format(Number(value))}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {weeks.length === 0 ? (
        <Card className="rounded-2xl border border-dashed border-[#C9D6E2] bg-white">
          <CardContent className="p-8 text-center text-sm font-semibold text-[#718297]">
            Nenhum registro encontrado neste mês.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
          {weeks.map((week) => (
            <Card
              key={`${basis}-${week.key}`}
              className="overflow-hidden rounded-2xl border border-[#D3DEE9] bg-white shadow-[0_5px_18px_rgba(23,61,110,0.05)]"
            >
              <div className="grid grid-cols-1 sm:grid-cols-[128px_minmax(0,1fr)]">
                <div className={`flex items-center justify-between gap-3 px-4 py-3 text-white sm:flex-col sm:items-start sm:justify-center sm:py-5 ${accent}`}>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.14em] text-white/75">
                      Semana
                    </p>
                    <p className="mt-1 text-3xl font-black leading-none">
                      {String(week.week).padStart(2, "0")}
                    </p>
                  </div>
                  <div className="text-right sm:text-left">
                    <p className="text-[11px] font-bold text-white/85">
                      {formatDate(week.start)}
                    </p>
                    <p className="text-[11px] font-bold text-white/85">
                      a {formatDate(week.end)}
                    </p>
                    <p className="mt-2 text-sm font-black">
                      {numberFormat.format(week.animals)} animais
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto overscroll-x-contain">
                  <table className="w-full min-w-[620px] border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#F7FAFC] text-[#173D6E]">
                        {[
                          "Data",
                          "Animais",
                          "Bois",
                          "Vacas",
                          "China",
                          "Agrotools",
                        ].map((label) => (
                          <th
                            key={label}
                            className="border-b border-r border-[#D7E2EC] px-3 py-2.5 text-right text-[9px] font-extrabold uppercase tracking-[0.06em] first:text-left last:border-r-0"
                          >
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {week.days.map((day) => (
                        <tr key={day.date} className="border-b border-[#EDF2F7]">
                          <td className="border-r border-[#EDF2F7] px-3 py-2.5 font-bold capitalize text-[#425B73]">
                            {formatDay(day.date)}
                          </td>
                          {[day.animals, day.bulls, day.cows, day.china, day.agrotools].map(
                            (value, index) => (
                              <td
                                key={`${day.date}-${index}`}
                                className="border-r border-[#EDF2F7] px-3 py-2.5 text-right font-extrabold text-[#173D6E] last:border-r-0"
                              >
                                {numberFormat.format(value)}
                              </td>
                            ),
                          )}
                        </tr>
                      ))}
                      <tr className="bg-[#F0F4F8] font-black text-[#173D6E]">
                        <td className="border-r border-[#D7E2EC] px-3 py-2.5 text-[10px] uppercase tracking-[0.08em]">
                          Total
                        </td>
                        {[week.animals, week.bulls, week.cows, week.china, week.agrotools].map(
                          (value, index) => (
                            <td
                              key={`${week.key}-total-${index}`}
                              className="border-r border-[#D7E2EC] px-3 py-2.5 text-right last:border-r-0"
                            >
                              {numberFormat.format(value)}
                            </td>
                          ),
                        )}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}

export default function EscalaAnaliseMensal() {
  const { user } = useAuth();
  const nroempresa = getEmpresaLogada(user);
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth);
  const [rows, setRows] = useState<EscalaLinha[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshVersion, setRefreshVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const loadMonthlyData = async () => {
      setLoading(true);
      const year = Number(selectedMonth.split("-")[0]);

      try {
        const response = await consultarEscala({
          nroempresa,
          data_inicio: `${year}-01-01`,
          data_fim: `${year + 1}-12-31`,
        });
        if (!cancelled) setRows(Array.isArray(response) ? response : []);
      } catch (error) {
        if (!cancelled) {
          setRows([]);
          toast.error(
            error instanceof Error
              ? error.message
              : "Não foi possível carregar a análise mensal.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadMonthlyData();
    return () => {
      cancelled = true;
    };
  }, [nroempresa, refreshVersion, selectedMonth]);

  const scaleWeeks = useMemo(
    () => buildWeeklyMetrics(rows, "scale", selectedMonth),
    [rows, selectedMonth],
  );
  const orderWeeks = useMemo(
    () => buildWeeklyMetrics(rows, "order", selectedMonth),
    [rows, selectedMonth],
  );

  return (
    <div className="min-h-screen bg-[#F3F6FA] p-3 pb-20 sm:p-5 lg:p-6">
      <div className="mx-auto max-w-[1800px] space-y-5">
        <header className="overflow-hidden rounded-2xl border border-[#D3DEE9] bg-white shadow-[0_4px_18px_rgba(23,61,110,0.06)]">
          <div className="grid h-1.5 grid-cols-[1fr_1fr_0.38fr]">
            <span className="bg-[#173D6E]" />
            <span className="bg-[#D96B1A]" />
            <span className="bg-[#E30613]" />
          </div>
          <div className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#D7E3EF] bg-[#EEF4FA]">
                <ClipboardList className="h-6 w-6 text-[#173D6E]" />
              </div>
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#D96B1A]">
                  Módulo Escala
                </p>
                <h1 className="mt-1 text-2xl font-black tracking-tight text-[#173D6E] sm:text-3xl">
                  Análise mensal da Escala
                </h1>
                <p className="mt-1 text-sm font-medium text-[#60758A]">
                  Comparação semanal pela data da escala e pela data de compra do pedido.
                </p>
              </div>
            </div>

            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-end">
              <label className="flex flex-col gap-1.5">
                <span className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#60758A]">
                  Mês analisado
                </span>
                <Input
                  type="month"
                  value={selectedMonth}
                  onChange={(event) => {
                    if (event.target.value) setSelectedMonth(event.target.value);
                  }}
                  className="h-10 min-w-[190px] rounded-xl border-[#C9D6E2] font-bold text-[#173D6E]"
                />
              </label>
              <Button
                variant="outline"
                className="h-10 gap-2 rounded-xl border-[#BFCFDF] font-bold text-[#173D6E] hover:border-[#1B58A0] hover:bg-[#EEF4FA]"
                disabled={loading}
                onClick={() => setRefreshVersion((current) => current + 1)}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                Atualizar
              </Button>
            </div>
          </div>
        </header>

        <div className="flex flex-wrap items-center gap-2">
          <Badge className="bg-[#173D6E] text-white hover:bg-[#173D6E]">
            {formatMonth(selectedMonth)}
          </Badge>
          <span className="text-xs font-semibold text-[#60758A]">
            As semanas exibidas possuem registros dentro do mês selecionado.
          </span>
        </div>

        {loading ? (
          <Card className="rounded-2xl border border-[#D3DEE9] bg-white">
            <CardContent className="flex min-h-[320px] flex-col items-center justify-center">
              <Loader2 className="mb-3 h-8 w-8 animate-spin text-[#1B58A0]" />
              <p className="text-sm font-bold text-[#60758A]">
                Carregando análise mensal...
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-7">
            <MonthlyAnalysisSection
              title="Por data da escala"
              description="Agrupamento pela data de abate informada no planejamento."
              basis="scale"
              weeks={scaleWeeks}
            />
            <MonthlyAnalysisSection
              title="Por data do pedido (compra)"
              description="Agrupamento pela data em que cada pedido foi comprado."
              basis="order"
              weeks={orderWeeks}
            />
          </div>
        )}
      </div>
    </div>
  );
}
