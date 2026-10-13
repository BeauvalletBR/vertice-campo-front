"use client";

import { useEffect, useState } from "react";
import { Check, PackageCheck } from "lucide-react";
import { testService } from "../services/testService";
import { useRendimentoData } from "../context/RendimentoDataContext";
import type { YieldTest } from "../types/domain";
import { calculateAverageWeight } from "../utils/calculations";
import { formatWeight, parseDecimal, toInputDecimal } from "../utils/format";
import { Button, Field } from "./ui";
import { InputWeightFields, type WeightEntryMode } from "./InputWeightFields";

export function TestInputDataCard({ test, onSaved }: { test: YieldTest; onSaved?: () => void | Promise<void> }) {
  const { products } = useRendimentoData();
  const inputProducts = products.filter((item) => item.active).sort((a, b) => {
    const typeOrder = (a.type === "ENTRADA" ? 0 : 1) - (b.type === "ENTRADA" ? 0 : 1);
    return typeOrder || a.name.localeCompare(b.name, "pt-BR");
  });
  const inputEntries = inputProducts.filter((item) => item.type === "ENTRADA");
  const inputCuts = inputProducts.filter((item) => item.type === "PRODUTO");
  const [name, setName] = useState(test.name || "");
  const [date, setDate] = useState(test.date || "");
  const [inputProductId, setInputProductId] = useState(test.inputProductId || "");
  const [quantity, setQuantity] = useState(test.inputQuantity ? String(test.inputQuantity) : "");
  const [weight, setWeight] = useState(test.inputTotalWeightKg ? toInputDecimal(test.inputTotalWeightKg) : test.inputWeightKg ? toInputDecimal(test.inputWeightKg) : "");
  const [pieceWeights, setPieceWeights] = useState<string[]>(() => (test.inputPieceWeightsKg || []).map((value) => toInputDecimal(value)));
  const [weightMode, setWeightMode] = useState<WeightEntryMode>(test.inputWeightMode || "total");
  const [savedMessage, setSavedMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const pieceWeightTotal = pieceWeights.reduce((sum, value) => sum + parseDecimal(value), 0);
  const activeWeight = weightMode === "pieces" ? pieceWeightTotal : parseDecimal(weight);
  const average = calculateAverageWeight(activeWeight, Number(quantity));

  useEffect(() => {
    setName(test.name || "");
    setDate(test.date || "");
    setInputProductId(test.inputProductId || "");
    setQuantity(test.inputQuantity ? String(test.inputQuantity) : "");
    setWeight(test.inputTotalWeightKg ? toInputDecimal(test.inputTotalWeightKg) : test.inputWeightKg ? toInputDecimal(test.inputWeightKg) : "");
    setPieceWeights((test.inputPieceWeightsKg || []).map((value) => toInputDecimal(value)));
    setWeightMode(test.inputWeightMode || "total");
  }, [test.id, test.version]);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setSavedMessage("");
    try {
      await testService.updateInput(test.id, {
        name,
        date,
        inputProductId,
        inputQuantity: Number(quantity) || 0,
        inputWeightKg: activeWeight,
        inputTotalWeightKg: parseDecimal(weight),
        inputWeightMode: weightMode,
        inputPieceWeightsKg: pieceWeights.map(parseDecimal).slice(0, Number(quantity) || 0),
      });
      await onSaved?.();
      setSavedMessage("Dados de entrada atualizados.");
    } catch (saveError) {
      setSavedMessage(saveError instanceof Error ? saveError.message : "Não foi possível atualizar os dados.");
    } finally {
      setSaving(false);
    }
  };

  return <section className="test-input-card editing direct-input-card">
    <header><div><span><PackageCheck size={19} /></span><div><h2>Dados de entrada</h2><p>Edite diretamente a quantidade e o peso. Use a chave para alternar entre peso total e peso por peça.</p></div></div><Button disabled={saving} onClick={() => void save()}><Check size={15} /> {saving ? "Salvando..." : "Salvar dados"}</Button></header>
    <div className="test-input-edit"><div className="form-grid form-grid--4">
      <div className="form-grid__wide"><Field label="Nome do teste"><input value={name} maxLength={150} placeholder="Ex.: Contra Filé — lote manhã" onChange={(event) => setName(event.target.value)} /></Field></div>
      <Field label="Data" hint="opcional"><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></Field>
      <Field label="Matéria-prima" hint="opcional"><select value={inputProductId} onChange={(event) => setInputProductId(event.target.value)}><option value="">Não informada</option>{inputEntries.length > 0 && <optgroup label="Matérias-primas cadastradas">{inputEntries.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</optgroup>}{inputCuts.length > 0 && <optgroup label="Produtos / cortes">{inputCuts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</optgroup>}</select></Field>
      <InputWeightFields quantity={quantity} weight={weight} pieceWeights={pieceWeights} mode={weightMode} onQuantityChange={setQuantity} onWeightChange={setWeight} onPieceWeightsChange={setPieceWeights} onModeChange={setWeightMode} />
    </div><div className="input-edit-footer"><span>Peso médio calculado: <strong>{formatWeight(average)}</strong></span><Button disabled={saving} onClick={() => void save()}><Check size={15} /> {saving ? "Salvando..." : "Salvar dados de entrada"}</Button></div>{savedMessage && <div className={`inline-message ${savedMessage.includes("atualizados") ? "success" : ""}`}>{savedMessage}</div>}</div>
  </section>;
}
