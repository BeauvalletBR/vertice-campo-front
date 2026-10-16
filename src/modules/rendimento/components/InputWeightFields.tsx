"use client";

import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { ChevronDown, ChevronUp, Scale } from "lucide-react";
import { parseDecimal, sanitizeWeightInput, toInputDecimal } from "../utils/format";
import { Field } from "./ui";
import { ConfirmDialog } from "./ConfirmDialog";

export type WeightEntryMode = "total" | "pieces";

interface InputWeightFieldsProps {
  quantity: string;
  weight: string;
  pieceWeights: string[];
  mode: WeightEntryMode;
  onQuantityChange: (value: string) => void;
  onWeightChange: (value: string) => void;
  onPieceWeightsChange: (values: string[]) => void;
  onModeChange: (mode: WeightEntryMode) => void;
  onBlur?: () => void;
  lockPieceMode?: boolean;
}

export function InputWeightFields({ quantity, weight, pieceWeights, mode, onQuantityChange, onWeightChange, onPieceWeightsChange, onModeChange, onBlur, lockPieceMode = false }: InputWeightFieldsProps) {
  const [expanded, setExpanded] = useState(true);
  const [pendingMode, setPendingMode] = useState<WeightEntryMode | null>(null);
  const [quantityDraft, setQuantityDraft] = useState(quantity);
  const [pendingQuantity, setPendingQuantity] = useState<{
    value: string;
    count: number;
    removed: Array<{ position: number; value: string }>;
  } | null>(null);
  const committedCount = useRef(
    Math.max(0, Math.min(200, Math.trunc(Number(quantity) || 0))),
  );
  const count = Math.max(
    0,
    Math.min(200, Math.trunc(Number(quantityDraft) || 0)),
  );
  const totalPieces = pieceWeights.slice(0, count).reduce((sum, value) => sum + parseDecimal(value), 0);

  useEffect(() => {
    setQuantityDraft(quantity);
    committedCount.current = Math.max(
      0,
      Math.min(200, Math.trunc(Number(quantity) || 0)),
    );
  }, [quantity]);

  const applyQuantity = (value: string, nextCount: number) => {
    const next = Array.from(
      { length: nextCount },
      (_, index) => pieceWeights[index] || "",
    );
    committedCount.current = nextCount;
    setQuantityDraft(value);
    onQuantityChange(value);
    onPieceWeightsChange(next);
  };

  const changeQuantity = (value: string) => {
    setQuantityDraft(value);
    if (value === "") return;

    const nextCount = Math.max(0, Math.min(200, Math.trunc(Number(value) || 0)));
    const removed = pieceWeights
      .slice(nextCount, committedCount.current)
      .map((pieceValue, index) => ({
        position: nextCount + index + 1,
        value: pieceValue,
      }))
      .filter((item) => parseDecimal(item.value) > 0);

    if (nextCount < committedCount.current && removed.length > 0) {
      setPendingQuantity({ value, count: nextCount, removed });
      return;
    }

    applyQuantity(value, nextCount);
  };
  const changePiece = (index: number, value: string) => {
    const next = Array.from({ length: count }, (_, itemIndex) => itemIndex === index ? sanitizeWeightInput(value) : pieceWeights[itemIndex] || "");
    onPieceWeightsChange(next);
  };
  const applyMode = (nextMode: WeightEntryMode) => {
    if (nextMode === "total") {
      onModeChange("total");
      return;
    }
    const next = Array.from({ length: count }, (_, index) => pieceWeights[index] || "");
    onPieceWeightsChange(next);
    onModeChange("pieces");
    setExpanded(true);
  };
  const requestMode = (nextMode: WeightEntryMode) => {
    if (nextMode === mode) return;
    const hasCurrentData = mode === "pieces"
      ? pieceWeights.some((value) => parseDecimal(value) > 0)
      : parseDecimal(weight) > 0;
    if (hasCurrentData) {
      setPendingMode(nextMode);
      return;
    }
    applyMode(nextMode);
  };
  const advancePieceWeight = (event: KeyboardEvent<HTMLInputElement>, index: number) => {
    if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    const panel = event.currentTarget.closest(".piece-weight-grid");
    const inputs = panel
      ? Array.from(panel.querySelectorAll<HTMLInputElement>('input[data-piece-weight="true"]:not(:disabled)'))
      : [];
    const next = inputs[index + 1];
    if (next) {
      next.scrollIntoView?.({ behavior: "smooth", block: "center" });
      next.focus({ preventScroll: true });
      next.select();
      return;
    }
    event.currentTarget.blur();
  };

  return <>
    <Field label="Quantidade" hint="necessária somente na execução"><input type="number" min="0" max="200" placeholder="Ex.: 10" value={quantityDraft} onChange={(event) => changeQuantity(event.target.value)} onBlur={() => { if (quantityDraft === "") setQuantityDraft(quantity); onBlur?.(); }} /></Field>
    {!lockPieceMode && <div className="weight-entry-field">
      <span>Forma de informar o peso</span>
      <label className={`weight-mode-switch ${!count ? "disabled" : ""}`}><input type="checkbox" role="switch" aria-label="Informar peso por peça" checked={mode === "pieces"} disabled={!count} onChange={(event) => requestMode(event.target.checked ? "pieces" : "total")} /><i><span /></i><div><strong>Peso por peça</strong><small>{mode === "pieces" ? "Ligado · informe cada peça abaixo" : "Desligado · informe o peso total"}</small></div></label>
    </div>}
    <Field label="Peso de entrada" hint={mode === "pieces" ? "soma automática · kg" : "necessário somente na execução · kg"} calculated={mode === "pieces"}>
      {mode === "pieces" ? <div className="calculated-value"><Scale size={16} />{toInputDecimal(totalPieces, true)} kg</div> : <input inputMode="decimal" placeholder="0,000" value={weight} onChange={(event) => onWeightChange(sanitizeWeightInput(event.target.value))} onBlur={onBlur} />}
    </Field>
    {mode === "pieces" && count > 0 && <div className="piece-weights-panel form-grid__full">
      <header><div><strong>Pesos individuais</strong><span>{count} {count === 1 ? "peça" : "peças"} · soma automática</span></div><button type="button" onClick={() => setExpanded((value) => !value)}>{expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}{expanded ? "Recolher" : `Exibir ${count} pesos`}</button></header>
      {expanded && <div className="piece-weight-grid">{Array.from({ length: count }, (_, index) => <label key={index}><span>Peça {index + 1}</span><div><input data-piece-weight="true" aria-label={`Peça ${index + 1}`} inputMode="decimal" placeholder="0,000" value={pieceWeights[index] || ""} onChange={(event) => changePiece(index, event.target.value)} onKeyDown={(event) => advancePieceWeight(event, index)} onBlur={onBlur} /><small>kg</small></div></label>)}</div>}
    </div>}
    <ConfirmDialog open={pendingMode !== null} title="Alterar forma de informar o peso?" description={pendingMode === "pieces" ? "O peso total digitado será mantido. Ao voltar para peso total, ele reaparecerá." : "Os pesos informados por peça serão mantidos. Ao ligar novamente, todos reaparecerão."} confirmLabel="Alterar forma" onCancel={() => setPendingMode(null)} onConfirm={() => { if (pendingMode) applyMode(pendingMode); setPendingMode(null); }} />
    <ConfirmDialog
      open={pendingQuantity !== null}
      title="Reduzir a quantidade de peças?"
      description={pendingQuantity ? `Ao reduzir de ${committedCount.current} para ${pendingQuantity.count}, você perderá ${pendingQuantity.removed.map((item) => `o valor da peça ${item.position} (${toInputDecimal(parseDecimal(item.value))} kg)`).join(", ")}.` : ""}
      confirmLabel="Reduzir quantidade"
      danger
      onCancel={() => {
        setQuantityDraft(String(committedCount.current));
        setPendingQuantity(null);
      }}
      onConfirm={() => {
        if (pendingQuantity) applyQuantity(pendingQuantity.value, pendingQuantity.count);
        setPendingQuantity(null);
      }}
    />
  </>;
}
