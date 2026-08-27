import { useEffect, useMemo, useState } from "react";
import { Play, Tv } from "lucide-react";

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
  getStartDateFromWeek,
  type WeekOption,
} from "@/lib/escala-planning";

interface EscalaPlaybackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialWeek: string;
  weekOptions: WeekOption[];
  onStart: (config: {
    week: string;
    scrollDurationSeconds: number;
    showFinancial: boolean;
  }) => void;
}

const SCROLL_OPTIONS = [30, 60, 90, 120] as const;

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
  onStart,
}: EscalaPlaybackDialogProps) {
  const [selectedWeek, setSelectedWeek] = useState(initialWeek);
  const [scrollDurationSeconds, setScrollDurationSeconds] = useState(60);
  const [showFinancial, setShowFinancial] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelectedWeek(initialWeek);
    setScrollDurationSeconds(60);
    setShowFinancial(false);
  }, [initialWeek, open]);

  const selectedWeekDescription = useMemo(() => {
    const current = weekOptions.find((option) => option.key === selectedWeek);
    return current ? getWeekLabel(current) : "";
  }, [selectedWeek, weekOptions]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl border-[#D3DEE9]">
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
            <Select value={selectedWeek} onValueChange={setSelectedWeek}>
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
                {scrollDurationSeconds} segundos
              </span>
            </div>
            <Slider
              value={[scrollDurationSeconds]}
              min={SCROLL_OPTIONS[0]}
              max={SCROLL_OPTIONS[SCROLL_OPTIONS.length - 1]}
              step={30}
              onValueChange={(value) => setScrollDurationSeconds(value[0] ?? 60)}
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
