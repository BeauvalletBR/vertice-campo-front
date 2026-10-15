"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, Check, PackageCheck, Save, Trash2 } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { TestInputDataCard } from "../components/TestInputDataCard";
import { Button } from "../components/ui";
import { useRendimentoData } from "../context/RendimentoDataContext";
import { testService } from "../services/testService";
import type { TestDiscard } from "../types/domain";
import type { NavigationTarget } from "../types/navigation";
import { calculateCleanWeight, calculateTotalDiscard, calculateYield } from "../utils/calculations";
import { formatPercent, formatWeight, parseDecimal, sanitizeWeightInput, toInputDecimal } from "../utils/format";

interface TraceDraft {
  weight: string;
  discards: Array<TestDiscard & { input: string }>;
}

export function TraceableExecutionPage({ testId, onNavigate }: { testId?: string; onNavigate: (target: NavigationTarget) => void }) {
  const { products, discardTypes, tests, refreshTests } = useRendimentoData();
  const test = tests.find((item) => item.id === testId);
  const [flowId, setFlowId] = useState(test?.flows[0]?.id || "");
  const flow = test?.flows.find((item) => item.id === flowId) || test?.flows[0];
  const pieces = test?.inputPieces?.length
    ? test.inputPieces
    : (test?.inputPieceWeightsKg || []).map((weightKg, index) => ({ id: `piece-${index + 1}`, order: index + 1, weightKg }));
  const [pieceOrder, setPieceOrder] = useState(pieces[0]?.order || 1);
  const [drafts, setDrafts] = useState<Record<string, TraceDraft>>({});
  const [message, setMessage] = useState("");
  const [savingStepId, setSavingStepId] = useState("");
  const operationSteps = flow?.steps.slice(0, -1) || [];
  const finalStep = flow?.steps.at(-1);
  const productName = (id?: string) => products.find((item) => item.id === id)?.name || "—";
  const draftSnapshot = JSON.stringify({ flowId: flow?.id, pieceOrder, steps: flow?.steps });

  useEffect(() => {
    if (!flow) return;
    const next: Record<string, TraceDraft> = {};
    flow.steps.slice(0, -1).forEach((step, index) => {
      const trace = step.traceItems?.find((item) => item.inputPieceOrder === pieceOrder);
      const previousTrace = index > 0
        ? flow.steps[index - 1].traceItems?.find((item) => item.inputPieceOrder === pieceOrder)
        : undefined;
      const product = products.find((item) => item.id === step.productId);
      const existingDiscards = trace?.discards || [];
      const defaults = (product?.applicableDiscardIds || [])
        .filter((id) => !existingDiscards.some((discard) => discard.discardTypeId === id))
        .map((id) => {
          const type = discardTypes.find((item) => item.id === id);
          return { id: `trace-${step.id}-${pieceOrder}-${id}`, discardTypeId: id, name: type?.name || "Descarte", weightKg: 0, manual: false };
        });
      next[step.id] = {
        weight: toInputDecimal(trace?.initialWeightKg || previousTrace?.cleanWeightKg || (index === 0 ? pieces.find((piece) => piece.order === pieceOrder)?.weightKg || 0 : 0)),
        discards: [...existingDiscards, ...defaults].map((discard) => ({ ...discard, input: toInputDecimal(discard.weightKg) })),
      };
    });
    setDrafts(next);
  }, [draftSnapshot]);

  if (!test || !flow) return <div className="empty-state"><strong>Teste não encontrado</strong><Button onClick={() => onNavigate({ route: "tests" })}>Voltar</Button></div>;

  const pieceStatus = (order: number) => {
    const traces = operationSteps.map((step) => step.traceItems?.find((item) => item.inputPieceOrder === order));
    if (traces.length > 0 && traces.every((item) => item?.confirmed)) return "complete";
    if (traces.some((item) => item && (item.initialWeightKg > 0 || item.discards.some((discard) => discard.weightKg > 0)))) return "progress";
    return "empty";
  };

  const updateWeight = (stepId: string, value: string) => setDrafts((current) => ({
    ...current,
    [stepId]: { ...current[stepId], weight: sanitizeWeightInput(value) },
  }));
  const updateDiscard = (stepId: string, discardId: string, value: string) => setDrafts((current) => ({
    ...current,
    [stepId]: {
      ...current[stepId],
      discards: current[stepId].discards.map((discard) => discard.id === discardId ? { ...discard, input: sanitizeWeightInput(value) } : discard),
    },
  }));
  const addDiscard = (stepId: string, discardId: string) => {
    if (!discardId) return;
    const type = discardTypes.find((item) => item.id === discardId);
    if (!type) return;
    setDrafts((current) => ({
      ...current,
      [stepId]: {
        ...current[stepId],
        discards: [...current[stepId].discards, { id: `trace-${stepId}-${pieceOrder}-${discardId}`, discardTypeId: discardId, name: type.name, weightKg: 0, manual: false, input: "" }],
      },
    }));
  };
  const removeDiscard = (stepId: string, discardId: string) => setDrafts((current) => ({
    ...current,
    [stepId]: { ...current[stepId], discards: current[stepId].discards.filter((discard) => discard.id !== discardId) },
  }));

  const saveStage = async (stepIndex: number) => {
    const step = operationSteps[stepIndex];
    const draft = drafts[step.id];
    const weight = parseDecimal(draft?.weight || "0");
    const discards = (draft?.discards || []).map(({ input, ...discard }) => ({ ...discard, weightKg: parseDecimal(input) }));
    const totalDiscard = calculateTotalDiscard(discards);
    if (weight <= 0) { setMessage("Informe o peso do produto desta peça."); return; }
    if (totalDiscard >= weight) { setMessage("O total dos descartes deve ser menor que o peso do produto."); return; }
    setSavingStepId(step.id); setMessage("");
    try {
      const saved = await testService.saveTracePiece(test.id, flow.id, stepIndex, pieceOrder, { initialWeightKg: weight, discards }, true);
      await refreshTests();
      if (saved.status === "FINALIZADO") { onNavigate({ route: "detail", id: test.id }); return; }
      const finalOperation = stepIndex === operationSteps.length - 1;
      const nextPiece = pieces.find((piece) => piece.order > pieceOrder && pieceStatus(piece.order) !== "complete");
      if (finalOperation && nextPiece) setPieceOrder(nextPiece.order);
      setMessage(finalOperation ? `Peça ${pieceOrder} concluída.` : `Etapa da peça ${pieceOrder} confirmada.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível salvar a peça.");
    } finally { setSavingStepId(""); }
  };

  const selectedPiece = pieces.find((piece) => piece.order === pieceOrder);
  const finalTrace = finalStep?.traceItems?.find((item) => item.inputPieceOrder === pieceOrder);

  return <>
    <button className="back-link" onClick={() => onNavigate({ route: "tests" })}><ArrowLeft size={16} /> Voltar para testes</button>
    <PageHeader eyebrow={`Teste ${test.number} · Rastreável por peça`} title={test.name || "Execução do Teste"} description="Acompanhe cada entrada individualmente até o produto final." actions={<Button variant="secondary" onClick={() => onNavigate({ route: "new-test", id: test.id })}>Editar teste inteiro</Button>} />
    <TestInputDataCard test={test} onSaved={refreshTests} />

    <section className="trace-flow-selector">
      <span>Grupo de produto</span>
      <div>{test.flows.map((item) => <button type="button" key={item.id} className={item.id === flow.id ? "active" : ""} onClick={() => setFlowId(item.id)}>{productName(item.rootProductId)}</button>)}</div>
    </section>

    <section className="trace-piece-navigation">
      <header><div><PackageCheck size={18} /><span>Peças de entrada</span></div><small>Selecione qualquer número para consultar ou corrigir</small></header>
      <div className="trace-piece-tabs">{pieces.map((piece) => {
        const status = pieceStatus(piece.order);
        return <button type="button" key={piece.id || piece.order} className={`${status} ${piece.order === pieceOrder ? "active" : ""}`} onClick={() => setPieceOrder(piece.order)}><i>{status === "complete" ? <Check size={14} /> : piece.order}</i><span><strong>Peça {piece.order}</strong><small>{formatWeight(piece.weightKg)}</small></span></button>;
      })}</div>
    </section>

    <div className="trace-selected-piece"><span>Rastreabilidade selecionada</span><strong>Peça {pieceOrder}</strong><small>Entrada original: {formatWeight(selectedPiece?.weightKg || 0)}</small></div>
    <div className="trace-vertical-flow">
      {operationSteps.map((step, index) => {
        const draft = drafts[step.id] || { weight: "", discards: [] };
        const weight = parseDecimal(draft.weight);
        const discards = draft.discards.map(({ input, ...discard }) => ({ ...discard, weightKg: parseDecimal(input) }));
        const total = calculateTotalDiscard(discards);
        const clean = calculateCleanWeight(weight, discards);
        const trace = step.traceItems?.find((item) => item.inputPieceOrder === pieceOrder);
        const available = discardTypes.filter((type) => type.active && !draft.discards.some((discard) => discard.discardTypeId === type.id));
        return <div className="trace-stage-wrap" key={step.id}>
          <article className={`trace-stage-card ${trace?.confirmed ? "confirmed" : ""}`}>
            <header><div><span>Etapa {index + 1}</span><h2>{productName(step.productId)}</h2></div>{trace?.confirmed && <b><Check size={13} /> Confirmada</b>}</header>
            <div className="trace-stage-weight"><label>Peso desta peça<input inputMode="decimal" placeholder="0,000" value={draft.weight} onChange={(event) => updateWeight(step.id, event.target.value)} /></label><div><span>Peso líquido</span><strong>{formatWeight(clean)}</strong><small>{formatPercent(calculateYield(clean, weight))} de aproveitamento</small></div></div>
            <div className="trace-stage-discards"><span>Descartes da peça {pieceOrder}</span>{draft.discards.map((discard) => <div key={discard.id}><div><Trash2 size={14} /><strong>{discard.name}</strong></div><label><input inputMode="decimal" placeholder="0,000" value={discard.input} onChange={(event) => updateDiscard(step.id, discard.id, event.target.value)} /><span>kg</span></label><button type="button" aria-label={`Remover ${discard.name}`} onClick={() => removeDiscard(step.id, discard.id)}>×</button></div>)}</div>
            {available.length > 0 && <select className="trace-add-discard" defaultValue="" onChange={(event) => { addDiscard(step.id, event.target.value); event.currentTarget.value = ""; }}><option value="">+ Adicionar outro descarte</option>{available.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select>}
            <footer><div><span>Total retirado</span><strong>− {formatWeight(total)}</strong></div><Button disabled={savingStepId === step.id} onClick={() => void saveStage(index)}><Save size={15} /> {savingStepId === step.id ? "Salvando..." : trace?.confirmed ? "Atualizar esta etapa" : "Confirmar e continuar"}</Button></footer>
          </article>
          <div className="trace-flow-arrow"><ArrowDown size={19} /><span>{formatWeight(clean)} segue para o próximo produto</span></div>
        </div>;
      })}
      <article className={`trace-final-card ${finalTrace?.confirmed ? "confirmed" : ""}`}><span>Produto final da peça {pieceOrder}</span><h2>{productName(finalStep?.productId)}</h2><div><strong>{formatWeight(finalTrace?.initialWeightKg || 0)}</strong><small>Resultado rastreado desde a entrada {pieceOrder}</small></div></article>
    </div>
    {message && <div className={`inline-message ${message.includes("concluída") || message.includes("confirmada") ? "success" : ""}`}>{message}</div>}
    <footer className="trace-piece-footer"><Button variant="ghost" disabled={pieceOrder === pieces[0]?.order} onClick={() => setPieceOrder((order) => Math.max(pieces[0]?.order || 1, order - 1))}><ArrowLeft size={15} /> Peça anterior</Button><Button variant="secondary" disabled={pieceOrder === pieces.at(-1)?.order} onClick={() => setPieceOrder((order) => Math.min(pieces.at(-1)?.order || order, order + 1))}>Próxima peça <ArrowRight size={15} /></Button></footer>
  </>;
}
