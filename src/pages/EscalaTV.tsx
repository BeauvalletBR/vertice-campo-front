import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  Maximize,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  Tv,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { consultarEscala } from "@/services/escala";
import { api, type ApiUsuario } from "@/services/api";
import type { EscalaLinha } from "@/types/escala";
import { useAuth } from "@/contexts/AuthContext";
import {
  addDays,
  formatDate,
  formatDayTitle,
  getEmpresaLogada,
  getPlanningKey,
  getOrderTotal,
  getStartDateFromWeek,
  getUniquePlanningRecords,
  parseLocalDate,
  toNumber,
  toOptionalNumber,
} from "@/lib/escala-planning";
import {
  buildBuyerDirectory,
  resolvePlanningBuyerName,
} from "@/lib/buyer-display";
import {
  calculateBaseWeightedPrice,
  calculateRowsWeightedBasePrice,
  getEffectivePremium,
} from "@/lib/escala-pricing";

const currencyFormat = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const numberFormat = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 0,
});

const getChinaTotal = (row: EscalaLinha) =>
  Number(row.QTD_CHINA_VACA || 0) + Number(row.QTD_CHINA_BOI || 0);

const getAgrotoolsTotal = (row: EscalaLinha) =>
  Number(row.QTD_AGROTOOLS_VACA || 0) + Number(row.QTD_AGROTOOLS_BOI || 0);

const getRowAveragePrice = (row: EscalaLinha) =>
  calculateBaseWeightedPrice(row) ?? 0;

const calculateTvDaySubtotal = (rows: EscalaLinha[]) => {
  const subtotal = rows.reduce(
    (accumulator, row) => {
      const quantity = getOrderTotal(row);
      accumulator.quantity += quantity;
      accumulator.china += getChinaTotal(row);
      accumulator.agrotools += getAgrotoolsTotal(row);

      return accumulator;
    },
    {
      quantity: 0,
      china: 0,
      agrotools: 0,
    },
  );

  return {
    quantity: subtotal.quantity,
    averagePrice: calculateRowsWeightedBasePrice(rows),
    china: subtotal.china,
    agrotools: subtotal.agrotools,
  };
};

const getDisplayBuyer = (row: EscalaLinha) =>
  String(
    row.COMPRADOR_ESCALA ||
      row.COMPRADOR_EXIBICAO ||
      row.COMPRADOR_ERP ||
      row.COMPRADOR ||
      "NÃO INFORMADO",
  )
    .trim()
    .toUpperCase();

const getDisplayProducer = (row: EscalaLinha) =>
  String(row.PRODUTOR || "PRODUTOR NÃO INFORMADO")
    .trim()
    .toUpperCase();

const getDisplayFarm = (row: EscalaLinha) =>
  String(row.DESC_PROPRIEDADE || "PROPRIEDADE NÃO INFORMADA")
    .trim()
    .toUpperCase();

const sortPlanningRows = (rows: EscalaLinha[]) =>
  [...rows].sort((a, b) => {
    const aOrder = Number(a.ORDEM_EXIBICAO) || Number.MAX_SAFE_INTEGER;
    const bOrder = Number(b.ORDEM_EXIBICAO) || Number.MAX_SAFE_INTEGER;
    if (aOrder !== bOrder) return aOrder - bOrder;

    const aBuyer = getDisplayBuyer(a);
    const bBuyer = getDisplayBuyer(b);
    return aBuyer.localeCompare(bBuyer);
  });

export default function EscalaTV() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const week = searchParams.get("week") || "";
  const scrollSeconds = Math.max(
    30,
    Math.min(120, Number(searchParams.get("duration")) || 60),
  );
  const showFinancial = searchParams.get("financial") === "1";
  const requestFullscreenOnStart = searchParams.get("fullscreen") === "1";

  const [loading, setLoading] = useState(true);
  const [lines, setLines] = useState<EscalaLinha[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [playbackCycle, setPlaybackCycle] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(
    Boolean(document.fullscreenElement),
  );

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const timeoutIdsRef = useRef<number[]>([]);
  const controlsHideTimeoutRef = useRef<number | null>(null);
  const pauseRef = useRef(isPaused);

  const nroempresa = getEmpresaLogada(user);
  const dateStart = useMemo(() => getStartDateFromWeek(week), [week]);
  const dateEnd = useMemo(() => addDays(dateStart, 6), [dateStart]);

  useEffect(() => {
    pauseRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);

      try {
        const data = await consultarEscala({
          nroempresa,
          data_inicio: dateStart,
          data_fim: dateEnd,
        });
        setLines(Array.isArray(data) ? data : []);
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, [dateEnd, dateStart, nroempresa]);

  const orderedLines = useMemo(
    () => sortPlanningRows(getUniquePlanningRecords(lines)),
    [lines],
  );

  const rowsByDay = useMemo(() => {
    const map = new Map<string, EscalaLinha[]>();
    for (const row of orderedLines) {
      const day = row.DATA_ABATE?.split("T")[0];
      if (!day) continue;
      const current = map.get(day) || [];
      current.push(row);
      map.set(day, current);
    }
    return map;
  }, [orderedLines]);

  const visibleDays = useMemo(
    () => Array.from(rowsByDay.keys()).sort(),
    [rowsByDay],
  );

  const weekNumber = useMemo(() => {
    const match = week.match(/W(\d{2})$/);
    return match?.[1] || "--";
  }, [week]);

  const totalAnimals = useMemo(
    () => orderedLines.reduce((total, row) => total + getOrderTotal(row), 0),
    [orderedLines],
  );

  const clearPlaybackTimers = () => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    timeoutIdsRef.current.forEach((id) => window.clearTimeout(id));
    timeoutIdsRef.current = [];
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    if (!requestFullscreenOnStart) return;

    const root = document.documentElement;
    if (!root.requestFullscreen || document.fullscreenElement) return;

    void root.requestFullscreen().catch(() => undefined);
  }, [requestFullscreenOnStart]);

  useEffect(() => {
    clearPlaybackTimers();

    if (loading || isPaused) return;

    const container = scrollContainerRef.current;
    if (!container) return;

    const introPauseMs = 2500;
    const endPauseMs = 3000;
    const resetPauseMs = 1200;
    const resetDurationMs = 1100;

    const runLoop = () => {
      if (!scrollContainerRef.current || pauseRef.current) return;

      const currentContainer = scrollContainerRef.current;
      currentContainer.scrollTop = 0;
      const maxScroll = Math.max(
        0,
        currentContainer.scrollHeight - currentContainer.clientHeight,
      );

      if (maxScroll <= 0) return;

      const startTimeout = window.setTimeout(() => {
        const startAt = performance.now();

        const animateDown = (now: number) => {
          if (!scrollContainerRef.current || pauseRef.current) return;

          const progress = Math.min(
            1,
            (now - startAt) / (scrollSeconds * 1000),
          );

          scrollContainerRef.current.scrollTop = maxScroll * progress;

          if (progress < 1) {
            animationFrameRef.current = requestAnimationFrame(animateDown);
            return;
          }

          const endTimeout = window.setTimeout(() => {
            const from = scrollContainerRef.current?.scrollTop || 0;
            const resetStart = performance.now();

            const animateUp = (resetNow: number) => {
              if (!scrollContainerRef.current || pauseRef.current) return;

              const resetProgress = Math.min(
                1,
                (resetNow - resetStart) / resetDurationMs,
              );

              scrollContainerRef.current.scrollTop =
                from * (1 - resetProgress);

              if (resetProgress < 1) {
                animationFrameRef.current = requestAnimationFrame(animateUp);
                return;
              }

              const restartTimeout = window.setTimeout(runLoop, resetPauseMs);
              timeoutIdsRef.current.push(restartTimeout);
            };

            animationFrameRef.current = requestAnimationFrame(animateUp);
          }, endPauseMs);

          timeoutIdsRef.current.push(endTimeout);
        };

        animationFrameRef.current = requestAnimationFrame(animateDown);
      }, introPauseMs);

      timeoutIdsRef.current.push(startTimeout);
    };

    runLoop();

    return clearPlaybackTimers;
  }, [isPaused, loading, orderedLines, playbackCycle, scrollSeconds, showFinancial]);

  useEffect(() => {
    const showControls = () => {
      setControlsVisible(true);

      if (controlsHideTimeoutRef.current !== null) {
        window.clearTimeout(controlsHideTimeoutRef.current);
      }

      controlsHideTimeoutRef.current = window.setTimeout(() => {
        if (!pauseRef.current) {
          setControlsVisible(false);
        }
      }, 2500);
    };

    showControls();
    window.addEventListener("mousemove", showControls);
    return () => {
      window.removeEventListener("mousemove", showControls);
      if (controlsHideTimeoutRef.current !== null) {
        window.clearTimeout(controlsHideTimeoutRef.current);
      }
    };
  }, []);

  const toggleFullscreen = async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => undefined);
      return;
    }

    await document.documentElement.requestFullscreen?.().catch(() => undefined);
  };

  const restartPlayback = () => {
    const container = scrollContainerRef.current;
    if (container) {
      container.scrollTop = 0;
    }

    clearPlaybackTimers();
    setIsPaused(false);
    setPlaybackCycle((current) => current + 1);
  };

  const contentHeightClass = isFullscreen
    ? "h-screen"
    : "h-[calc(100vh-3rem)]";

  return (
    <div className="min-h-screen bg-[#0C2340] text-white">
      <div className="mx-auto flex max-w-[1920px] flex-col">
        <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0C2340]/95 px-6 py-5 backdrop-blur">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#F59E0B]">
                Modo TV
              </p>
              <h1 className="mt-2 flex items-center gap-3 text-3xl font-black">
                <Tv className="h-8 w-8 text-[#9CC4F2]" />
                Planejamento de Escala
              </h1>
              <p className="mt-2 text-lg font-semibold text-white/75">
                Semana {weekNumber} • {formatDate(dateStart)} a {formatDate(dateEnd)}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-sm font-bold text-white/80">
              <span className="rounded-full border border-white/15 bg-white/5 px-4 py-2">
                {numberFormat.format(totalAnimals)} animais
              </span>
              <span className="rounded-full border border-white/15 bg-white/5 px-4 py-2">
                Rolagem em {scrollSeconds}s
              </span>
              <span className="rounded-full border border-white/15 bg-white/5 px-4 py-2">
                {showFinancial ? "Financeiro visível" : "Financeiro oculto"}
              </span>
            </div>
          </div>
        </header>

        <div className="relative">
          <div
            className={`pointer-events-none fixed right-6 top-20 z-30 transition-all ${
              controlsVisible ? "opacity-100" : "opacity-0"
            }`}
          >
            <div className="pointer-events-auto flex items-center gap-2 rounded-2xl border border-white/10 bg-[#102C4F]/90 p-2 shadow-[0_12px_30px_rgba(0,0,0,0.28)] backdrop-blur">
              <Button
                size="icon"
                variant="ghost"
                className="text-white hover:bg-white/10 hover:text-white"
                onClick={() => setIsPaused((current) => !current)}
                title={isPaused ? "Continuar" : "Pausar"}
              >
                {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              </Button>

              <Button
                size="icon"
                variant="ghost"
                className="text-white hover:bg-white/10 hover:text-white"
                onClick={restartPlayback}
                title="Reiniciar"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>

              <Button
                size="icon"
                variant="ghost"
                className="text-white hover:bg-white/10 hover:text-white"
                onClick={() => void toggleFullscreen()}
                title={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
              >
                {isFullscreen ? (
                  <Minimize className="h-4 w-4" />
                ) : (
                  <Maximize className="h-4 w-4" />
                )}
              </Button>

              <Button
                size="icon"
                variant="ghost"
                className="text-white hover:bg-white/10 hover:text-white"
                onClick={() => navigate("/escala")}
                title="Sair do Modo TV"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div
            ref={scrollContainerRef}
            className={`${contentHeightClass} overflow-y-auto px-6 py-6`}
          >
            {loading ? (
              <div className="flex h-full items-center justify-center text-lg font-bold text-white/80">
                Carregando escala...
              </div>
            ) : visibleDays.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-4 text-center text-white/80">
                <Tv className="h-12 w-12 text-white/50" />
                <p className="text-xl font-black">
                  Nenhuma escala encontrada para a semana selecionada.
                </p>
                <Button
                  className="gap-2 bg-white text-[#173D6E] hover:bg-white/90"
                  onClick={() => navigate("/escala")}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Voltar ao Planejamento
                </Button>
              </div>
            ) : (
              <div className="space-y-8">
                {visibleDays.map((day) => {
                  const dayRows = rowsByDay.get(day) || [];
                  const daySubtotal = calculateTvDaySubtotal(dayRows);

                  return (
                    <section
                      key={day}
                      className="overflow-hidden rounded-[28px] border border-white/10 bg-white/95 text-[#173D6E] shadow-[0_20px_55px_rgba(0,0,0,0.22)]"
                    >
                      <div className="border-b border-[#D8E3EE] bg-[#F4F8FC] px-6 py-5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#1B58A0]">
                              Dia de abate
                            </p>
                            <h2 className="mt-1 text-2xl font-black">
                              {formatDayTitle(day)}
                            </h2>
                          </div>

                          <div className="flex flex-wrap gap-3 text-sm font-bold">
                            <span className="rounded-full border border-[#D6E3EF] bg-white px-4 py-2">
                              {numberFormat.format(
                                dayRows.reduce(
                                  (total, row) => total + getOrderTotal(row),
                                  0,
                                ),
                              )} animais
                            </span>
                            <span className="rounded-full border border-[#F6D7AB] bg-[#FFF8EA] px-4 py-2 text-[#A45D00]">
                              {numberFormat.format(
                                dayRows.reduce(
                                  (total, row) => total + getChinaTotal(row),
                                  0,
                                ),
                              )} China
                            </span>
                            <span className="rounded-full border border-[#CBE9D4] bg-[#F0FFF4] px-4 py-2 text-[#167A59]">
                              {numberFormat.format(
                                dayRows.reduce(
                                  (total, row) => total + getAgrotoolsTotal(row),
                                  0,
                                ),
                              )} Agrotools
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="overflow-hidden">
                        <table className="w-full min-w-[1200px] table-fixed border-collapse">
                          <thead>
                            <tr className="bg-[#EAF1F7] text-[#173D6E]">
                              <th className="border-b border-r border-[#D7E2EC] px-3 py-4 text-left text-[11px] font-extrabold uppercase tracking-[0.05em]">
                                Comprador
                              </th>
                              <th className="border-b border-r border-[#D7E2EC] px-3 py-4 text-left text-[11px] font-extrabold uppercase tracking-[0.05em]">
                                Produtor / Fazenda
                              </th>
                              <th className="border-b border-r border-[#D7E2EC] px-3 py-4 text-right text-[11px] font-extrabold uppercase tracking-[0.05em]">
                                Animais
                              </th>
                              {showFinancial && (
                                <>
                                  <th className="border-b border-r border-[#D7E2EC] px-3 py-4 text-right text-[11px] font-extrabold uppercase tracking-[0.05em]">
                                    Preço Médio
                                  </th>
                                  <th className="border-b border-r border-[#D7E2EC] px-3 py-4 text-right text-[11px] font-extrabold uppercase tracking-[0.05em]">
                                    Prêmio
                                  </th>
                                </>
                              )}
                              <th className="border-b border-r border-[#D7E2EC] px-3 py-4 text-right text-[11px] font-extrabold uppercase tracking-[0.05em]">
                                China
                              </th>
                              <th className="border-b border-r border-[#D7E2EC] px-3 py-4 text-right text-[11px] font-extrabold uppercase tracking-[0.05em]">
                                Agrotools
                              </th>
                              <th className="border-b px-3 py-4 text-left text-[11px] font-extrabold uppercase tracking-[0.05em]">
                                Observação
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {dayRows.map((row) => {
                              const avgPrice = getRowAveragePrice(row);
                              const premium = getEffectivePremium(row) ?? 0;

                              return (
                                <tr
                                  key={`${row.ID_PLANEJAMENTO}-${row.ORDEM_EXIBICAO ?? "SEM"}`}
                                  className="border-b border-[#E5EDF5] bg-white"
                                >
                                  <td className="border-r border-[#E5EDF5] px-3 py-4 align-top text-[15px] font-black leading-tight">
                                    {getDisplayBuyer(row)}
                                  </td>
                                  <td className="border-r border-[#E5EDF5] px-3 py-4 align-top">
                                    <div className="space-y-1">
                                      <p className="text-[15px] font-extrabold leading-tight">
                                        {getDisplayProducer(row)}
                                      </p>
                                      <p className="text-[13px] font-bold text-[#52677E]">
                                        {getDisplayFarm(row)}
                                      </p>
                                    </div>
                                  </td>
                                  <td className="border-r border-[#E5EDF5] px-3 py-4 text-right align-top text-[18px] font-black">
                                    {numberFormat.format(getOrderTotal(row))}
                                  </td>
                                  {showFinancial && (
                                    <>
                                      <td className="border-r border-[#E5EDF5] px-3 py-4 text-right align-top text-[16px] font-black">
                                        {avgPrice > 0
                                          ? currencyFormat.format(avgPrice)
                                          : "—"}
                                      </td>
                                      <td className="border-r border-[#E5EDF5] px-3 py-4 text-right align-top text-[16px] font-black">
                                        {premium > 0
                                          ? currencyFormat.format(premium)
                                          : "—"}
                                      </td>
                                    </>
                                  )}
                                  <td className="border-r border-[#E5EDF5] px-3 py-4 text-right align-top text-[16px] font-black text-[#A45D00]">
                                    {numberFormat.format(getChinaTotal(row))}
                                  </td>
                                  <td className="border-r border-[#E5EDF5] px-3 py-4 text-right align-top text-[16px] font-black text-[#167A59]">
                                    {numberFormat.format(getAgrotoolsTotal(row))}
                                  </td>
                                  <td className="px-3 py-4 align-top text-[14px] font-semibold text-[#52677E]">
                                    {row.OBSERVACAO_PEDIDO_ESCALA ||
                                      row.OBSERVACAO_REGISTRO ||
                                      "—"}
                                  </td>
                                </tr>
                              );
                            })}
                            <tr className="border-t-2 border-[#BFD1E2] bg-[#F4F8FC]">
                              <td
                                colSpan={2}
                                className="border-r border-[#D7E2EC] px-3 py-4 text-left text-[12px] font-black uppercase tracking-[0.05em] text-[#173D6E]"
                              >
                                Subtotal do dia
                              </td>
                              <td className="border-r border-[#D7E2EC] px-3 py-4 text-right text-[16px] font-black text-[#173D6E]">
                                {numberFormat.format(daySubtotal.quantity)}
                              </td>
                              {showFinancial && (
                                <>
                                  <td className="border-r border-[#D7E2EC] px-3 py-4 text-right text-[14px] font-black text-[#173D6E]">
                                    {daySubtotal.averagePrice !== null
                                      ? currencyFormat.format(daySubtotal.averagePrice)
                                      : "—"}
                                  </td>
                                  <td className="border-r border-[#D7E2EC] px-3 py-4 text-right text-[14px] font-black text-[#718297]">
                                    —
                                  </td>
                                </>
                              )}
                              <td className="border-r border-[#D7E2EC] px-3 py-4 text-right text-[14px] font-black text-[#A45D00]">
                                {numberFormat.format(daySubtotal.china)}
                              </td>
                              <td className="border-r border-[#D7E2EC] px-3 py-4 text-right text-[14px] font-black text-[#167A59]">
                                {numberFormat.format(daySubtotal.agrotools)}
                              </td>
                              <td className="px-3 py-4 text-left text-[13px] font-semibold text-[#60758A]">
                                Total consolidado do dia
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </section>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
