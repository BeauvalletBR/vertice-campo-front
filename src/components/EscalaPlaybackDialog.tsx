import { useEffect, useMemo, useState } from "react";
import { Copy, ExternalLink, Link2, Loader2, Play, Tv } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { criarLinkReproducaoEscala } from "@/services/escala";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  addDays,
  formatDate,
  getNextISOWeekValue,
  getStartDateFromWeek,
  type WeekOption,
} from "@/lib/escala-planning";

interface EscalaPlaybackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialWeek: string;
  weekOptions: WeekOption[];
  nroempresa: number;
  onStart: (config: {
    week: string;
    scrollDurationSeconds: number;
    showFinancial: boolean;
  }) => void;
}

const SCROLL_OPTIONS = [30, 60, 90, 120] as const;

const formatScrollDuration = (seconds: number) =>
  `${seconds} segundos`;

const getWeekLabel = (week: WeekOption) => {
  const start = getStartDateFromWeek(week.key);
  const end = addDays(start, 6);
  return `Semana ${String(week.week).padStart(2, "0")} • ${formatDate(start)} a ${formatDate(end)}`;
};

export function EscalaPlaybackDialog({
  open,
  onOpenChange,
  initialWeek,
  weekOptions,
  nroempresa,
  onStart,
}: EscalaPlaybackDialogProps) {
  const [selectedWeek, setSelectedWeek] = useState(initialWeek);
  const [scrollDurationSeconds, setScrollDurationSeconds] = useState(90);
  const [showFinancial, setShowFinancial] = useState(false);
  const [expirationDays, setExpirationDays] = useState(7);
  const [publicUrl, setPublicUrl] = useState("");
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);

  useEffect(() => {
    if (!open) return;
    const nextWeek = getNextISOWeekValue();
    setSelectedWeek(
      weekOptions.some((option) => option.key === nextWeek)
        ? nextWeek
        : initialWeek,
    );
    setScrollDurationSeconds(90);
    setShowFinancial(false);
    setExpirationDays(7);
    setPublicUrl("");
  }, [initialWeek, open, weekOptions]);

  const selectedWeekDescription = useMemo(() => {
    const current = weekOptions.find((option) => option.key === selectedWeek);
    return current ? getWeekLabel(current) : "";
  }, [selectedWeek, weekOptions]);

  const copyPublicUrl = async (url = publicUrl) => {
    if (!url) return false;

    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard indisponível");
      await navigator.clipboard.writeText(url);
      toast.success("Link público copiado.");
      return true;
    } catch {
      const textArea = document.createElement("textarea");
      textArea.value = url;
      textArea.setAttribute("readonly", "");
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      document.body.appendChild(textArea);
      textArea.select();

      let copied = false;
      try {
        copied = document.execCommand("copy");
      } catch {
        copied = false;
      } finally {
        document.body.removeChild(textArea);
      }

      if (copied) {
        toast.success("Link público copiado.");
        return true;
      }

      toast.info("Link gerado. Use o campo abaixo para copiar manualmente.");
      return false;
    }
  };

  const generatePublicLink = async () => {
    if (!selectedWeek) {
      toast.warning("Selecione uma semana para gerar o link.");
      return;
    }

    setIsGeneratingLink(true);
    try {
      const dataStart = getStartDateFromWeek(selectedWeek);
      const response = await criarLinkReproducaoEscala({
        nroempresa,
        data_inicio: dataStart,
        data_fim: addDays(dataStart, 6),
        duracao_segundos: scrollDurationSeconds,
        validade_dias: expirationDays,
      });
      const appBaseUrl = String(
        import.meta.env.VITE_PUBLIC_APP_URL || window.location.origin,
      ).replace(/\/+$/, "");
      const url = `${appBaseUrl}/escala/reproducao?token=${encodeURIComponent(response.token)}`;
      setPublicUrl(url);
      await copyPublicUrl(url);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível gerar o link público.",
      );
    } finally {
      setIsGeneratingLink(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto border-[#D3DEE9]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#173D6E]">
            <Tv className="h-5 w-5" />
            Configuração da Reprodução
          </DialogTitle>
          <DialogDescription>
            Ajuste a semana, o tempo de rolagem e quais informações financeiras
            devem aparecer na TV.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-2">
            <p className="text-sm font-extrabold text-[#173D6E]">
              Semana a exibir
            </p>
            <Select
              value={selectedWeek}
              onValueChange={(value) => {
                setSelectedWeek(value);
                setPublicUrl("");
              }}
            >
              <SelectTrigger className="h-11 border-[#C9D6E2] text-left font-bold text-[#173D6E]">
                <SelectValue placeholder="Selecione a semana" />
              </SelectTrigger>
              <SelectContent>
                {weekOptions.map((option) => (
                  <SelectItem key={option.key} value={option.key}>
                    {getWeekLabel(option)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedWeekDescription && (
              <p className="text-xs font-medium text-[#60758A]">
                {selectedWeekDescription}
              </p>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-extrabold text-[#173D6E]">
                Tempo de rolagem
              </p>
              <span className="rounded-full border border-[#D6E3EF] bg-[#F3F8FC] px-2.5 py-1 text-xs font-extrabold text-[#5A728A]">
                {formatScrollDuration(scrollDurationSeconds)}
              </span>
            </div>
            <Slider
              value={[scrollDurationSeconds]}
              min={SCROLL_OPTIONS[0]}
              max={SCROLL_OPTIONS[SCROLL_OPTIONS.length - 1]}
              step={30}
              onValueChange={(value) => {
                setScrollDurationSeconds(value[0] ?? 90);
                setPublicUrl("");
              }}
            />
            <div className="flex items-center justify-between text-[11px] font-bold text-[#6B7F93]">
              {SCROLL_OPTIONS.map((value) => (
                <span key={value}>{value}s</span>
              ))}
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-2xl border border-[#D6E1EB] bg-[#F8FBFD] p-4">
            <Checkbox
              id="escala-tv-show-financial"
              checked={showFinancial}
              onCheckedChange={(checked) => setShowFinancial(Boolean(checked))}
              className="mt-0.5"
            />
            <div className="space-y-1">
              <label
                htmlFor="escala-tv-show-financial"
                className="cursor-pointer text-sm font-extrabold text-[#173D6E]"
              >
                Exibir Preço Médio e Prêmio
              </label>
              <p className="text-xs font-medium text-[#60758A]">
                Por padrão essa opção começa desmarcada e esconde as colunas
                financeiras no Modo TV.
              </p>
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-[#D6E1EB] bg-white p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="space-y-1">
                <p className="flex items-center gap-2 text-sm font-extrabold text-[#173D6E]">
                  <Link2 className="h-4 w-4" />
                  Link público da reprodução
                </p>
                <p className="text-xs font-medium text-[#60758A]">
                  O link exibe a semana escolhida sem valores financeiros.
                </p>
              </div>
              <div className="w-full space-y-1 sm:w-32">
                <label
                  htmlFor="escala-tv-expiration-days"
                  className="text-[11px] font-extrabold uppercase tracking-wide text-[#60758A]"
                >
                  Validade (dias)
                </label>
                <Input
                  id="escala-tv-expiration-days"
                  type="number"
                  min={1}
                  max={30}
                  value={expirationDays}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    setExpirationDays(
                      Number.isFinite(value)
                        ? Math.min(30, Math.max(1, Math.trunc(value)))
                        : 7,
                    );
                    setPublicUrl("");
                  }}
                  className="h-10 border-[#C9D6E2] font-extrabold text-[#173D6E]"
                />
              </div>
            </div>

            {publicUrl && (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  readOnly
                  value={publicUrl}
                  onFocus={(event) => event.currentTarget.select()}
                  className="min-w-0 flex-1 border-[#C9D6E2] text-xs"
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => void copyPublicUrl()}
                    title="Copiar link"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => window.open(publicUrl, "_blank", "noopener,noreferrer")}
                    title="Abrir link"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            className="border-[#C9D6E2] text-[#173D6E]"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="outline"
            className="gap-2 border-[#86B9E5] text-[#1B58A0] hover:bg-[#EFF7FF]"
            disabled={isGeneratingLink}
            onClick={() => void generatePublicLink()}
          >
            {isGeneratingLink ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Link2 className="h-4 w-4" />
            )}
            Gerar link público
          </Button>
          <Button
            className="gap-2 bg-[#173D6E] hover:bg-[#214C83]"
            onClick={() =>
              onStart({
                week: selectedWeek,
                scrollDurationSeconds,
                showFinancial,
              })
            }
          >
            <Play className="h-4 w-4" />
            Iniciar Reprodução
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
