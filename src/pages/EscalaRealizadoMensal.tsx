import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  BadgeCheck,
  CalendarRange,
  CircleDollarSign,
  ClipboardList,
  Loader2,
  TrendingUp,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { getEmpresaLogada } from "@/lib/escala-planning";
import { consultarRealizadoMensalEscala } from "@/services/escala";
import type { EscalaRealizadoMensal } from "@/types/escala";

const MONTHS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
] as const;

const numberFormat = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 0,
});

const decimalFormat = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const currencyFormat = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const compactNumberFormat = new Intl.NumberFormat("pt-BR", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const toNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

interface RealizedMonth {
  month: number;
  monthName: string;
  shortMonth: string;
  quantity: number;
  bulls: number;
  cows: number;
  liquidWeight: number;
  averageArrobas: number | null;
  commission: number;
}

interface MetricCardProps {
  label: string;
  value: string;
  detail: string;
  icon: ReactNode;
  accent: string;
}

function MetricCard({ label, value, detail, icon, accent }: MetricCardProps) {
  return (
    <Card className="min-w-[210px] flex-1 overflow-hidden rounded-2xl border border-[#D5E0EA] bg-white shadow-[0_6px_20px_rgba(23,61,110,0.06)]">
      <CardContent className="p-0">
        <div className="h-1" style={{ backgroundColor: accent }} />
        <div className="flex items-start justify-between gap-3 p-4">
          <div className="min-w-0">
            <p className="whitespace-nowrap text-[10px] font-black uppercase tracking-[0.12em] text-[#687E93]">
              {label}
            </p>
            <p className="mt-2 whitespace-nowrap text-xl font-black tracking-tight text-[#173D6E]">
              {value}
            </p>
            <p className="mt-1 truncate text-[10px] font-semibold text-[#71869A]" title={detail}>
              {detail}
            </p>
          </div>
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundColor: `${accent}18`, color: accent }}
          >
            {icon}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export default function EscalaRealizadoMensal() {
  const { user } = useAuth();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [records, setRecords] = useState<EscalaRealizadoMensal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const nroempresa = getEmpresaLogada(user);

  const yearOptions = useMemo(() => {
    const firstYear = Math.min(2025, currentYear);
    return Array.from(
      { length: currentYear - firstYear + 1 },
      (_, index) => currentYear - index,
    );
  }, [currentYear]);

  useEffect(() => {
    let cancelled = false;

    const loadRealized = async () => {
      setLoading(true);
      setError(null);

      try {
        const data = await consultarRealizadoMensalEscala({
          nroempresa,
          ano: selectedYear,
        });
        if (!cancelled) setRecords(Array.isArray(data) ? data : []);
      } catch (loadError) {
        if (!cancelled) {
          setRecords([]);
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Não foi possível carregar o realizado mensal.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadRealized();
    return () => {
      cancelled = true;
    };
  }, [nroempresa, selectedYear]);

  const months = useMemo<RealizedMonth[]>(() => {
    const byMonth = new Map(
      records.map((record) => [toNumber(record.MES_NUM), record]),
    );

    return MONTHS.map((monthName, index) => {
      const month = index + 1;
      const record = byMonth.get(month);
      const quantity = toNumber(record?.QTD);
      const liquidWeight = toNumber(record?.PESO_LIQUIDO_TOTAL);

      return {
        month,
        monthName,
        shortMonth: monthName.slice(0, 3).toUpperCase(),
        quantity,
        bulls: toNumber(record?.QTDBOI),
        cows: toNumber(record?.QTDVACA),
        liquidWeight,
        averageArrobas:
          quantity > 0
            ? liquidWeight / quantity / 15
            : record?.MEDIA_ARROBA == null
              ? null
              : toNumber(record.MEDIA_ARROBA),
        commission: toNumber(record?.COMISSAO),
      };
    });
  }, [records]);

  const totals = useMemo(() => {
    const total = months.reduce(
      (accumulator, month) => {
        accumulator.quantity += month.quantity;
        accumulator.bulls += month.bulls;
        accumulator.cows += month.cows;
        accumulator.liquidWeight += month.liquidWeight;
        accumulator.commission += month.commission;
        return accumulator;
      },
      { quantity: 0, bulls: 0, cows: 0, liquidWeight: 0, commission: 0 },
    );

    return {
      ...total,
      averageArrobas:
        total.quantity > 0
          ? total.liquidWeight / total.quantity / 15
          : null,
    };
  }, [months]);

  const cards: MetricCardProps[] = [
    {
      label: "Total realizado",
      value: numberFormat.format(totals.quantity),
      detail: `animais abatidos em ${selectedYear}`,
      icon: <TrendingUp className="h-5 w-5" />,
      accent: "#173D6E",
    },
    {
      label: "Bois",
      value: numberFormat.format(totals.bulls),
      detail: `${totals.quantity ? ((totals.bulls / totals.quantity) * 100).toFixed(1) : "0,0"}% do realizado`,
      icon: <BadgeCheck className="h-5 w-5" />,
      accent: "#1B67AA",
    },
    {
      label: "Vacas",
      value: numberFormat.format(totals.cows),
      detail: `${totals.quantity ? ((totals.cows / totals.quantity) * 100).toFixed(1) : "0,0"}% do realizado`,
      icon: <ClipboardList className="h-5 w-5" />,
      accent: "#D98218",
    },
    {
      label: "Média de @",
      value:
        totals.averageArrobas === null
          ? "—"
          : `${decimalFormat.format(totals.averageArrobas)} @`,
      detail: "média ponderada anual",
      icon: <CalendarRange className="h-5 w-5" />,
      accent: "#2B7A63",
    },
    {
      label: "Comissão",
      value: currencyFormat.format(totals.commission),
      detail: `total acumulado em ${selectedYear}`,
      icon: <CircleDollarSign className="h-5 w-5" />,
      accent: "#9A5B13",
    },
  ];

  const hasData = totals.quantity > 0 || totals.commission !== 0;

  return (
    <main className="min-h-full bg-[radial-gradient(circle_at_top_right,#E8F3F7_0,transparent_28%),linear-gradient(180deg,#F6F9FC_0%,#EEF3F7_100%)] p-3 sm:p-5 lg:p-6">
      <div className="mx-auto max-w-[1680px] space-y-5">
        <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#1B67AA]">
              Escala · desempenho industrial
            </p>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-[#173D6E] sm:text-3xl">
              Realizado mensal
            </h1>
            <p className="mt-2 max-w-3xl text-sm font-medium text-[#60758A]">
              Visão anual dos animais efetivamente abatidos, separada do planejamento e dos pedidos.
            </p>
          </div>

          <label className="flex w-full flex-col gap-1.5 rounded-2xl border border-[#D2DFEA] bg-white p-3 shadow-sm sm:w-[220px]">
            <span className="text-[10px] font-black uppercase tracking-[0.12em] text-[#60758A]">
              Ano analisado
            </span>
            <Select
              value={String(selectedYear)}
              onValueChange={(value) => setSelectedYear(Number(value))}
            >
              <SelectTrigger className="h-10 rounded-xl border-[#C7D6E3] font-black text-[#173D6E]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((year) => (
                  <SelectItem key={year} value={String(year)}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        </header>

        {loading ? (
          <Card className="rounded-2xl border border-[#D3DEE9] bg-white">
            <CardContent className="flex min-h-[360px] flex-col items-center justify-center">
              <Loader2 className="mb-3 h-8 w-8 animate-spin text-[#1B58A0]" />
              <p className="text-sm font-bold text-[#60758A]">
                Carregando realizado de {selectedYear}...
              </p>
            </CardContent>
          </Card>
        ) : error ? (
          <Card className="rounded-2xl border border-[#E9B68B] bg-[#FFF8F1]">
            <CardContent className="p-8 text-center">
              <p className="font-black text-[#A84A15]">Não foi possível carregar o painel.</p>
              <p className="mt-2 text-sm font-medium text-[#7B5A42]">{error}</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="flex gap-3 overflow-x-auto pb-2 xl:grid xl:grid-cols-5 xl:overflow-visible">
              {cards.map((card) => (
                <MetricCard key={card.label} {...card} />
              ))}
            </div>

            {!hasData ? (
              <Card className="rounded-2xl border border-dashed border-[#BFCFDF] bg-white/80">
                <CardContent className="p-12 text-center text-sm font-semibold text-[#60758A]">
                  Nenhum abate realizado foi encontrado para {selectedYear}.
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[1.65fr_1fr]">
                <Card className="overflow-hidden rounded-2xl border border-[#D3DEE9] bg-white shadow-[0_5px_18px_rgba(23,61,110,0.05)]">
                  <CardHeader className="border-b border-[#E2EAF1] bg-[#F8FBFD]">
                    <CardTitle className="text-lg font-black text-[#173D6E]">
                      Animais realizados por mês
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="overflow-x-auto p-3 sm:p-5">
                    <div className="h-[360px] min-w-[920px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={months} barGap={4} margin={{ top: 24, right: 10, left: 0 }}>
                          <CartesianGrid stroke="#E4EBF2" strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="shortMonth" tick={{ fill: "#526B82", fontSize: 11, fontWeight: 800 }} />
                          <YAxis tickFormatter={(value) => compactNumberFormat.format(value)} tick={{ fill: "#71869A", fontSize: 10 }} />
                          <Tooltip
                            formatter={(value: number, name: string) => [
                              numberFormat.format(value),
                              name,
                            ]}
                            labelFormatter={(_, payload) => payload?.[0]?.payload?.monthName || ""}
                            contentStyle={{ borderRadius: 12, borderColor: "#C9D6E2" }}
                          />
                          <Legend />
                          <Bar dataKey="quantity" name="Total" fill="#173D6E" radius={[4, 4, 0, 0]}>
                            <LabelList dataKey="quantity" position="top" formatter={(value: number) => value > 0 ? compactNumberFormat.format(value) : ""} fill="#173D6E" fontSize={9} fontWeight={800} />
                          </Bar>
                          <Bar dataKey="bulls" name="Bois" fill="#2C7DB8" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="cows" name="Vacas" fill="#D98218" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card className="overflow-hidden rounded-2xl border border-[#D3DEE9] bg-white shadow-[0_5px_18px_rgba(23,61,110,0.05)]">
                  <CardHeader className="border-b border-[#E2EAF1] bg-[#F8FBFD]">
                    <CardTitle className="text-lg font-black text-[#173D6E]">
                      Comissão mensal
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="overflow-x-auto p-3 sm:p-5">
                    <div className="h-[360px] min-w-[620px] 2xl:min-w-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={months} margin={{ top: 24, right: 18, left: 8 }}>
                          <CartesianGrid stroke="#E4EBF2" strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="shortMonth" tick={{ fill: "#526B82", fontSize: 10, fontWeight: 800 }} />
                          <YAxis tickFormatter={(value) => compactNumberFormat.format(value)} tick={{ fill: "#71869A", fontSize: 10 }} />
                          <Tooltip formatter={(value: number) => [currencyFormat.format(value), "Comissão"]} contentStyle={{ borderRadius: 12, borderColor: "#C9D6E2" }} />
                          <Line type="monotone" dataKey="commission" name="Comissão" stroke="#D98218" strokeWidth={3} dot={{ r: 4, fill: "#D98218" }} activeDot={{ r: 6 }}>
                            <LabelList dataKey="commission" position="top" formatter={(value: number) => value ? compactNumberFormat.format(value) : ""} fill="#8A4B08" fontSize={9} fontWeight={800} />
                          </Line>
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            <Card className="overflow-hidden rounded-2xl border border-[#D3DEE9] bg-white shadow-[0_5px_18px_rgba(23,61,110,0.05)]">
              <CardHeader className="border-b border-[#E2EAF1] bg-[#F8FBFD]">
                <CardTitle className="text-lg font-black text-[#173D6E]">
                  Fechamento mensal de {selectedYear}
                </CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto p-0">
                <table className="w-full min-w-[820px] border-collapse text-sm">
                  <thead>
                    <tr className="bg-[#173D6E] text-left text-[10px] font-black uppercase tracking-[0.09em] text-white">
                      <th className="px-4 py-3">Mês</th>
                      <th className="px-4 py-3 text-right">Qnt. animal</th>
                      <th className="px-4 py-3 text-right">Bois</th>
                      <th className="px-4 py-3 text-right">Vacas</th>
                      <th className="px-4 py-3 text-right">Média @</th>
                      <th className="px-4 py-3 text-right">Comissão</th>
                    </tr>
                  </thead>
                  <tbody>
                    {months.map((month) => (
                      <tr key={month.month} className="border-b border-[#E2EAF1] transition-colors hover:bg-[#F4F8FC]">
                        <td className="px-4 py-3 font-black uppercase text-[#173D6E]">{month.monthName}</td>
                        <td className="px-4 py-3 text-right font-extrabold tabular-nums text-[#173D6E]">{month.quantity ? numberFormat.format(month.quantity) : "—"}</td>
                        <td className="px-4 py-3 text-right font-bold tabular-nums text-[#2C638F]">{month.bulls ? numberFormat.format(month.bulls) : "—"}</td>
                        <td className="px-4 py-3 text-right font-bold tabular-nums text-[#A85B15]">{month.cows ? numberFormat.format(month.cows) : "—"}</td>
                        <td className="px-4 py-3 text-right font-bold tabular-nums text-[#425B73]">{month.averageArrobas === null ? "—" : decimalFormat.format(month.averageArrobas)}</td>
                        <td className="px-4 py-3 text-right font-bold tabular-nums text-[#425B73]">{month.commission ? currencyFormat.format(month.commission) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-[#9FB7CD] bg-[#EDF3F8] font-black text-[#173D6E]">
                      <td className="px-4 py-3 uppercase">Totais</td>
                      <td className="px-4 py-3 text-right tabular-nums">{numberFormat.format(totals.quantity)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{numberFormat.format(totals.bulls)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{numberFormat.format(totals.cows)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{totals.averageArrobas === null ? "—" : decimalFormat.format(totals.averageArrobas)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{currencyFormat.format(totals.commission)}</td>
                    </tr>
                  </tfoot>
                </table>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </main>
  );
}
