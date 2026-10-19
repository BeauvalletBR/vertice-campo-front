"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import { AlertTriangle, ArrowDown, ArrowLeft, ArrowRight, Check, PackageCheck, Save, Trash2 } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { TestInputDataCard } from "../components/TestInputDataCard";
import { Button, Modal } from "../components/ui";
import { useRendimentoData } from "../context/RendimentoDataContext";
import { testService } from "../services/testService";
import type { TestDiscard, TestStep } from "../types/domain";
import type { NavigationTarget } from "../types/navigation";
import { calculateCleanWeight, calculateTotalDiscard, calculateYield, resolveTraceInitialWeight } from "../utils/calculations";
import { formatPercent, formatWeight, parseDecimal, sanitizeWeightInput, toInputDecimal } from "../utils/format";
import { isBranchedFlow, isLeafStep, orderTreeSteps, stepChildren, stepDepth } from "../utils/flowTree";

interface TraceDraft {
  weight: string;
  discards: Array<TestDiscard & { input: string }>;
  autoWeight: boolean;
  recoveredFromNext: boolean;
}

interface BranchBalanceIssue {
  stepId: string;
  productName: string;
  available: number;
  distributed: number;
  difference: number;
  adjustment: "increase-discard" | "decrease-discard" | "increase-input";
  discardTypeId?: string;
  discardName?: string;
  discardId?: string;
}

const DISCARD_PRIORITY = ["6", "4", "5"];

const propagateAutomaticWeights = (
  drafts: Record<string, TraceDraft>,
  steps: TestStep[],
) => {
  const next = { ...drafts };
  for (const step of steps) {
    if (!step.parentStepId) continue;
    const parentStep = steps.find((candidate) => candidate.id === step.parentStepId);
    if (!parentStep || stepChildren(steps, parentStep.id).length !== 1) continue;
    const previous = next[parentStep.id];
    const current = next[step.id];
    if (!previous || !current?.autoWeight) continue;
    const previousWeight = parseDecimal(previous.weight);
    const previousDiscards = previous.discards.map(({ input, ...discard }) => ({
      ...discard,
      weightKg: parseDecimal(input),
    }));
    next[step.id] = {
      ...current,
      weight: toInputDecimal(calculateCleanWeight(previousWeight, previousDiscards)),
    };
  }
  return next;
};

const cloneTraceDrafts = (drafts: Record<string, TraceDraft>) => Object.fromEntries(
  Object.entries(drafts).map(([stepId, draft]) => [stepId, {
    ...draft,
    discards: draft.discards.map((discard) => ({ ...discard })),
  }]),
);

export function TraceableExecutionPage({ testId, onNavigate }: { testId?: string; onNavigate: (target: NavigationTarget) => void }) {
  const { products, discardTypes, tests, refreshTests, updateTest } = useRendimentoData();
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
  const [balanceIssue, setBalanceIssue] = useState<BranchBalanceIssue | null>(null);
  const autoSaveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const persistedDrafts = useRef<Record<string, string>>({});
  const queuedDrafts = useRef<Record<string, string>>({});
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve());
  const draftCacheRef = useRef<Record<string, Record<string, TraceDraft>>>({});
  const draftSelectionRef = useRef("");
  const pageTopRef = useRef<HTMLButtonElement | null>(null);
  const weightInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const discardInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const branched = Boolean(flow && isBranchedFlow(flow.steps));
  const orderedSteps = flow ? orderTreeSteps(flow.steps) : [];
  const operationSteps = branched ? orderedSteps : orderedSteps.slice(0, -1);
  const finalSteps = flow ? orderedSteps.filter((step) => isLeafStep(flow.steps, step.id)) : [];
  const finalStep = branched ? undefined : orderedSteps.at(-1);
  const productName = (id?: string) => products.find((item) => item.id === id)?.name || "—";
  const draftSnapshot = JSON.stringify({ flowId: flow?.id, pieceOrder, steps: flow?.steps });

  const focusInput = (key: string, discard = false) => {
    window.setTimeout(() => {
      const input = discard ? discardInputRefs.current[key] : weightInputRefs.current[key];
      input?.scrollIntoView({ behavior: "smooth", block: "center" });
      input?.focus({ preventScroll: true });
      input?.select();
    }, 80);
  };

  const advanceOnEnter = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
    const current = event.target;
    if (!(current instanceof HTMLInputElement) || current.dataset.traceEntry !== "true") return;
    event.preventDefault();
    const entries = Array.from(
      event.currentTarget.querySelectorAll<HTMLInputElement>('input[data-trace-entry="true"]:not(:disabled)'),
    ).filter((input) => input.offsetParent !== null);
    const next = entries[entries.indexOf(current) + 1];
    if (next) {
      next.scrollIntoView?.({ behavior: "smooth", block: "center" });
      next.focus({ preventScroll: true });
      next.select();
      return;
    }
    current.blur();
  };

  const prioritizedTypes = (step: TestStep) => {
    const product = products.find((item) => item.id === step.productId);
    const configured = new Set(product?.applicableDiscardIds || []);
    return discardTypes
      .filter((type) => type.active && configured.has(type.id))
      .sort((a, b) => {
        const priorityA = DISCARD_PRIORITY.indexOf(a.id);
        const priorityB = DISCARD_PRIORITY.indexOf(b.id);
        const rankA = priorityA < 0 ? DISCARD_PRIORITY.length + a.order : priorityA;
        const rankB = priorityB < 0 ? DISCARD_PRIORITY.length + b.order : priorityB;
        return rankA - rankB || a.order - b.order;
      });
  };

  useEffect(() => {
    if (!flow) return;
    const selectionKey = `${flow.id}:${pieceOrder}`;
    const next: Record<string, TraceDraft> = {};
    operationSteps.forEach((step, index) => {
      const trace = step.traceItems?.find((item) => item.inputPieceOrder === pieceOrder);
      const parentStep = step.parentStepId ? flow.steps.find((item) => item.id === step.parentStepId) : undefined;
      const canInheritParent = parentStep ? stepChildren(flow.steps, parentStep.id).length === 1 : false;
      const previousTrace = canInheritParent
        ? parentStep?.traceItems?.find((item) => item.inputPieceOrder === pieceOrder)
        : undefined;
      const onlyChild = stepChildren(flow.steps, step.id).length === 1 ? stepChildren(flow.steps, step.id)[0] : undefined;
      const nextTrace = onlyChild?.traceItems?.find((item) => item.inputPieceOrder === pieceOrder);
      const product = products.find((item) => item.id === step.productId);
      const existingDiscards = trace?.discards || [];
      const defaults = (product?.applicableDiscardIds || [])
        .filter((id) => !existingDiscards.some((discard) => discard.discardTypeId === id))
        .map((id) => {
          const type = discardTypes.find((item) => item.id === id);
          return { id: `trace-${step.id}-${pieceOrder}-${id}`, discardTypeId: id, name: type?.name || "Descarte", weightKg: 0, manual: false };
        });
      const resolvedWeight = resolveTraceInitialWeight({
        currentWeight: trace?.initialWeightKg || 0,
        previousCleanWeight: previousTrace?.cleanWeightKg || 0,
        nextWeight: nextTrace?.initialWeightKg || 0,
        currentDiscards: existingDiscards,
      });
      const recoveredFromNext = !trace?.initialWeightKg
        && !previousTrace?.cleanWeightKg
        && Boolean(nextTrace?.initialWeightKg);
      next[step.id] = {
        weight: toInputDecimal(resolvedWeight),
        discards: [...existingDiscards, ...defaults].map((discard) => ({ ...discard, input: toInputDecimal(discard.weightKg) })),
        autoWeight: Boolean(parentStep && canInheritParent && !trace?.confirmed),
        recoveredFromNext,
      };
      persistedDrafts.current[`${flow.id}:${pieceOrder}:${step.id}`] = JSON.stringify({
        weight: trace?.initialWeightKg || 0,
        discards: existingDiscards.map((discard) => [discard.discardTypeId, discard.name, discard.weightKg]),
      });
    });
    // The selection changes one render before its drafts do. Keep autosave paused
    // until this piece's draft state has replaced the previous piece's values.
    draftSelectionRef.current = "";
    const cached = draftCacheRef.current[selectionKey];
    setDrafts(cached
      ? Object.fromEntries(operationSteps.map((step) => [
          step.id,
          cached[step.id] ? cloneTraceDrafts({ [step.id]: cached[step.id] })[step.id] : next[step.id],
        ]))
      : next);
  }, [draftSnapshot]);

  useEffect(() => {
    if (!flow) return;
    const selectionKey = `${flow.id}:${pieceOrder}`;
    if (draftSelectionRef.current !== selectionKey) {
      draftSelectionRef.current = selectionKey;
      return;
    }
    draftCacheRef.current[selectionKey] = cloneTraceDrafts(drafts);
    operationSteps.forEach((step) => {
      const draft = drafts[step.id];
      if (!draft) return;
      const weight = parseDecimal(draft.weight);
      const discards = draft.discards.map(({ input, ...discard }) => ({ ...discard, weightKg: parseDecimal(input) }));
      const signature = JSON.stringify({
        weight,
        discards: discards.map((discard) => [discard.discardTypeId, discard.name, discard.weightKg]),
      });
      const key = `${flow.id}:${pieceOrder}:${step.id}`;
      if (weight <= 0 || calculateTotalDiscard(discards) >= weight || persistedDrafts.current[key] === signature || queuedDrafts.current[key] === signature) return;
      if (autoSaveTimers.current[key]) clearTimeout(autoSaveTimers.current[key]);
      autoSaveTimers.current[key] = setTimeout(() => {
        queuedDrafts.current[key] = signature;
        setMessage("Salvando automaticamente...");
        saveQueue.current = saveQueue.current.catch(() => undefined).then(async () => {
          const stepIndex = flow.steps.findIndex((candidate) => candidate.id === step.id);
          await testService.saveTracePiece(test.id, flow.id, flow.rootProductId, stepIndex, pieceOrder, { initialWeightKg: weight, discards }, false);
          persistedDrafts.current[key] = signature;
          delete queuedDrafts.current[key];
          setMessage("Alterações salvas automaticamente.");
        }).catch((error) => {
          delete queuedDrafts.current[key];
          setMessage(error instanceof Error ? error.message : "Não foi possível salvar automaticamente.");
        });
      }, 700);
    });
  }, [drafts, flow?.id, pieceOrder]);

  if (!test || !flow) return <div className="empty-state"><strong>Teste não encontrado</strong><Button onClick={() => onNavigate({ route: "tests" })}>Voltar</Button></div>;

  const pieceStatus = (order: number) => {
    const traces = operationSteps.map((step) => step.traceItems?.find((item) => item.inputPieceOrder === order));
    if (traces.length > 0 && traces.every((item) => item?.confirmed)) return "complete";
    if (traces.some((item) => item && (item.initialWeightKg > 0 || item.discards.some((discard) => discard.weightKg > 0)))) return "progress";
    return "empty";
  };

  const updateWeight = (stepId: string, value: string) => setDrafts((current) => propagateAutomaticWeights({
    ...current,
    [stepId]: { ...current[stepId], weight: sanitizeWeightInput(value), autoWeight: false, recoveredFromNext: false },
  }, operationSteps));
  const updateDiscard = (stepId: string, discardId: string, value: string) => setDrafts((current) => propagateAutomaticWeights({
    ...current,
    [stepId]: {
      ...current[stepId],
      discards: current[stepId].discards.map((discard) => discard.id === discardId ? { ...discard, input: sanitizeWeightInput(value) } : discard),
    },
  }, operationSteps));
  const addDiscard = (stepId: string, discardId: string) => {
    if (!discardId) return;
    const type = discardTypes.find((item) => item.id === discardId);
    if (!type) return;
    setDrafts((current) => propagateAutomaticWeights({
      ...current,
      [stepId]: {
        ...current[stepId],
        discards: [...current[stepId].discards, { id: `trace-${stepId}-${pieceOrder}-${discardId}`, discardTypeId: discardId, name: type.name, weightKg: 0, manual: false, input: "" }],
      },
    }, operationSteps));
  };
  const removeDiscard = (stepId: string, discardId: string) => setDrafts((current) => propagateAutomaticWeights({
    ...current,
    [stepId]: { ...current[stepId], discards: current[stepId].discards.filter((discard) => discard.id !== discardId) },
  }, operationSteps));

  const findBalanceIssue = (payloads: Array<{
    step: TestStep;
    weight: number;
    discards: TestDiscard[];
    totalDiscard: number;
  }>) => {
    for (const parent of operationSteps) {
      const children = stepChildren(flow.steps, parent.id);
      if (children.length < 2) continue;
      const parentPayload = payloads.find((item) => item.step.id === parent.id);
      if (!parentPayload) continue;
      const available = calculateCleanWeight(parentPayload.weight, parentPayload.discards);
      const distributed = children.reduce(
        (sum, child) => sum + (payloads.find((item) => item.step.id === child.id)?.weight || 0),
        0,
      );
      const difference = available - distributed;
      if (Math.abs(difference) <= 0.005) continue;

      const draft = drafts[parent.id];
      const configuredTypes = prioritizedTypes(parent);
      const currentDiscards = [...(draft?.discards || [])].sort((a, b) => {
        const priorityA = DISCARD_PRIORITY.indexOf(a.discardTypeId || "");
        const priorityB = DISCARD_PRIORITY.indexOf(b.discardTypeId || "");
        const rankA = priorityA < 0 ? DISCARD_PRIORITY.length : priorityA;
        const rankB = priorityB < 0 ? DISCARD_PRIORITY.length : priorityB;
        return rankA - rankB;
      });

      if (difference > 0) {
        const onlyConfigured = configuredTypes.length === 1 ? configuredTypes[0] : undefined;
        const suggestedType = onlyConfigured
          || configuredTypes[0]
          || discardTypes.find((type) => type.active && type.id === "6")
          || discardTypes.filter((type) => type.active).sort((a, b) => a.order - b.order)[0];
        const existing = currentDiscards.find((discard) => discard.discardTypeId === suggestedType?.id);
        return {
          stepId: parent.id,
          productName: productName(parent.productId),
          available,
          distributed,
          difference,
          adjustment: "increase-discard" as const,
          discardTypeId: suggestedType?.id,
          discardName: suggestedType?.name,
          discardId: existing?.id,
        };
      }

      const excess = Math.abs(difference);
      const reducible = currentDiscards.find((discard) => parseDecimal(discard.input) >= excess);
      return {
        stepId: parent.id,
        productName: productName(parent.productId),
        available,
        distributed,
        difference,
        adjustment: reducible ? "decrease-discard" as const : "increase-input" as const,
        discardTypeId: reducible?.discardTypeId || undefined,
        discardName: reducible?.name,
        discardId: reducible?.id,
      };
    }
    return null;
  };

  const applyBalanceSuggestion = () => {
    if (!balanceIssue) return;
    const amount = Math.abs(balanceIssue.difference);
    if (balanceIssue.adjustment === "increase-input") {
      setDrafts((current) => ({
        ...current,
        [balanceIssue.stepId]: {
          ...current[balanceIssue.stepId],
          weight: toInputDecimal(parseDecimal(current[balanceIssue.stepId].weight) + amount),
          autoWeight: false,
          recoveredFromNext: false,
        },
      }));
      setBalanceIssue(null);
      focusInput(balanceIssue.stepId);
      return;
    }

    setDrafts((current) => {
      const draft = current[balanceIssue.stepId];
      const existing = draft.discards.find((discard) => discard.id === balanceIssue.discardId);
      const nextValue = existing
        ? Math.max(0, parseDecimal(existing.input) + (balanceIssue.adjustment === "increase-discard" ? amount : -amount))
        : amount;
      const discards = existing
        ? draft.discards.map((discard) => discard.id === existing.id
          ? { ...discard, input: toInputDecimal(nextValue) }
          : discard)
        : [...draft.discards, {
            id: `trace-${balanceIssue.stepId}-${pieceOrder}-${balanceIssue.discardTypeId}`,
            discardTypeId: balanceIssue.discardTypeId || null,
            name: balanceIssue.discardName || "Ajuste de rendimento",
            weightKg: 0,
            manual: !balanceIssue.discardTypeId,
            input: toInputDecimal(nextValue),
          }];
      return propagateAutomaticWeights({
        ...current,
        [balanceIssue.stepId]: { ...draft, discards },
      }, operationSteps);
    });
    const inputKey = balanceIssue.discardId
      || `trace-${balanceIssue.stepId}-${pieceOrder}-${balanceIssue.discardTypeId}`;
    setBalanceIssue(null);
    focusInput(inputKey, true);
  };

  const completePiece = async (skipBalanceReview = false) => {
    const payloads = operationSteps.map((step) => {
      const draft = drafts[step.id];
      const weight = parseDecimal(draft?.weight || "0");
      const discards = (draft?.discards || []).map(({ input, ...discard }) => ({ ...discard, weightKg: parseDecimal(input) }));
      return { step, weight, discards, totalDiscard: calculateTotalDiscard(discards) };
    });
    const invalid = payloads.find((payload) => payload.weight <= 0 || payload.totalDiscard >= payload.weight);
    if (invalid?.weight <= 0) { setMessage(`Informe o peso de ${productName(invalid.step.productId)}.`); return; }
    if (invalid) { setMessage(`Os descartes de ${productName(invalid.step.productId)} devem ser menores que o peso do produto.`); return; }
    if (!skipBalanceReview) {
      const issue = findBalanceIssue(payloads);
      if (issue) {
        setBalanceIssue(issue);
        focusInput(issue.stepId);
        return;
      }
    }
    const finalWeight = payloads.length > 0
      ? calculateCleanWeight(payloads.at(-1)!.weight, payloads.at(-1)!.discards)
      : 0;
    if (finalWeight <= 0) { setMessage("O produto final precisa ter peso maior que zero."); return; }
    const finalizingTest = isLastVisiblePiece || isLastTestPiece;
    const pieceBatches: Array<{
      inputPieceOrder: number;
      inputs: Array<{ stepId: string; stepIndex: number; initialWeightKg: number; discards: TestDiscard[] }>;
    }> = [];
    if (finalizingTest) {
      for (const piece of pieces) {
        const source = piece.order === pieceOrder
          ? drafts
          : draftCacheRef.current[`${flow.id}:${piece.order}`];
        if (!source) continue;
        const piecePayloads = operationSteps.map((step) => {
          const draft = source[step.id];
          const weight = parseDecimal(draft?.weight || "0");
          const discards = (draft?.discards || []).map(({ input, ...discard }) => ({
            ...discard,
            weightKg: parseDecimal(input),
          }));
          return { step, weight, discards, totalDiscard: calculateTotalDiscard(discards) };
        });
        const hasDraftData = piecePayloads.some((payload) => payload.weight > 0 || payload.totalDiscard > 0);
        if (!hasDraftData) continue;
        const pending = piecePayloads.find((payload) => payload.weight <= 0 || payload.totalDiscard >= payload.weight);
        if (pending) {
          setPieceOrder(piece.order);
          setMessage(pending.weight <= 0
            ? `Peça ${piece.order}: informe o peso de ${productName(pending.step.productId)}.`
            : `Peça ${piece.order}: os descartes de ${productName(pending.step.productId)} devem ser menores que o peso.`);
          window.requestAnimationFrame(() => pageTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
          return;
        }
        pieceBatches.push({
          inputPieceOrder: piece.order,
          inputs: piecePayloads.map((payload) => ({
            stepId: payload.step.id,
            stepIndex: flow.steps.findIndex((step) => step.id === payload.step.id),
            initialWeightKg: payload.weight,
            discards: payload.discards,
          })),
        });
      }
    }
    Object.values(autoSaveTimers.current).forEach((timer) => clearTimeout(timer));
    setSavingStepId(`piece-${pieceOrder}`); setMessage("");
    try {
      await saveQueue.current.catch(() => undefined);
      let saved = finalizingTest
        ? await testService.saveTracePiecesBatch(test.id, flow.id, flow.rootProductId, pieceBatches)
        : await testService.saveTracePieceBatch(
            test.id,
            flow.id,
            flow.rootProductId,
            pieceOrder,
            payloads.map((payload) => ({
              stepId: payload.step.id,
              stepIndex: flow.steps.findIndex((step) => step.id === payload.step.id),
              initialWeightKg: payload.weight,
              discards: payload.discards,
            })),
          );
      if (finalizingTest && saved.status !== "FINALIZADO") {
        saved = await testService.finalizeTraceableTest(test.id);
      }
      updateTest(saved);
      if (saved.status === "FINALIZADO") { onNavigate({ route: "detail", id: test.id }); return; }
      const nextPiece = pieces.find((piece) => piece.order > pieceOrder && pieceStatus(piece.order) !== "complete");
      if (nextPiece) {
        setPieceOrder(nextPiece.order);
        window.requestAnimationFrame(() => {
          pageTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
      setMessage(`Peça ${pieceOrder} concluída.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível concluir a peça.");
    } finally { setSavingStepId(""); }
  };

  const selectedPiece = pieces.find((piece) => piece.order === pieceOrder);
  const finalTrace = finalStep?.traceItems?.find((item) => item.inputPieceOrder === pieceOrder);
  const lastDraft = drafts[operationSteps.at(-1)?.id || ""];
  const liveFinalWeight = lastDraft
    ? calculateCleanWeight(
        parseDecimal(lastDraft.weight),
        lastDraft.discards.map(({ input, ...discard }) => ({ ...discard, weightKg: parseDecimal(input) })),
      )
    : finalTrace?.initialWeightKg || 0;
  const currentPieceValid = operationSteps.length > 0 && operationSteps.every((step) => {
    const draft = drafts[step.id];
    const weight = parseDecimal(draft?.weight || "0");
    const discards = (draft?.discards || []).map(({ input, ...discard }) => ({ ...discard, weightKg: parseDecimal(input) }));
    return weight > 0 && calculateTotalDiscard(discards) < weight;
  }) && (branched || liveFinalWeight > 0);
  const isLastTestPiece = test.flows.every((item) => item.id === flow.id
    ? pieces.every((piece) => piece.order === pieceOrder || pieceStatus(piece.order) === "complete")
    : item.status === "FINALIZADO");
  const isLastVisiblePiece = pieceOrder === pieces.at(-1)?.order;

  return <>
    <button ref={pageTopRef} className="back-link" onClick={() => onNavigate({ route: "tests" })}><ArrowLeft size={16} /> Voltar para testes</button>
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

    <div className="trace-selected-piece">
      <div><span>Rastreabilidade selecionada</span><strong>Peça {pieceOrder}</strong></div>
      <div className="trace-input-reference"><span>Peso da peça na entrada</span><strong>{formatWeight(selectedPiece?.weightKg || 0)}</strong><small>Referência da entrada; não preenche o peso do produto.</small></div>
    </div>
    <div className="trace-vertical-flow" onKeyDown={advanceOnEnter}>
      {operationSteps.map((step, index) => {
        const draft = drafts[step.id] || { weight: "", discards: [], autoWeight: index > 0, recoveredFromNext: false };
        const weight = parseDecimal(draft.weight);
        const discards = draft.discards.map(({ input, ...discard }) => ({ ...discard, weightKg: parseDecimal(input) }));
        const total = calculateTotalDiscard(discards);
        const clean = calculateCleanWeight(weight, discards);
        const trace = step.traceItems?.find((item) => item.inputPieceOrder === pieceOrder);
        const available = discardTypes.filter((type) => type.active && !draft.discards.some((discard) => discard.discardTypeId === type.id));
        const children = stepChildren(flow.steps, step.id);
        const distributed = children.reduce((sum, child) => sum + parseDecimal(drafts[child.id]?.weight || "0"), 0);
        const balanceDifference = clean - distributed;
        return <div className={`trace-stage-wrap ${branched ? "trace-stage-wrap--branch" : ""}`} style={branched ? { "--trace-depth": stepDepth(flow.steps, step) } as CSSProperties : undefined} key={step.id}>
          <article className={`trace-stage-card ${trace?.confirmed ? "confirmed" : ""}`}>
            <header><div><span>Etapa {index + 1}</span><h2>{productName(step.productId)}</h2></div>{trace?.confirmed && <b><Check size={13} /> Confirmada</b>}</header>
            <div className="trace-stage-weight"><label>Peso inicial deste produto{draft.recoveredFromNext ? <small>Recuperado pela etapa seguinte e salvo automaticamente</small> : draft.autoWeight && <small>Calculado pelo produto anterior</small>}<input data-trace-entry="true" ref={(node) => { weightInputRefs.current[step.id] = node; }} inputMode="decimal" placeholder="0,000" value={draft.weight} onChange={(event) => updateWeight(step.id, event.target.value)} /></label><div><span>Peso líquido</span><strong>{formatWeight(clean)}</strong><small>{formatPercent(calculateYield(clean, weight))} de aproveitamento</small></div></div>
            {children.length > 1 && Math.abs(balanceDifference) > 0.005 && <div className={`trace-balance-warning ${balanceDifference < 0 ? "danger" : ""}`}><AlertTriangle size={16} /><div><strong>{distributed <= 0.005 ? `Distribua ${formatWeight(clean)} entre as ${children.length} saídas` : balanceDifference > 0 ? `Faltam distribuir ${formatWeight(balanceDifference)}` : `As saídas excedem ${formatWeight(Math.abs(balanceDifference))}`}</strong><span>{distributed <= 0.005 ? "Informe abaixo o peso de cada produto resultante. Esse valor não é um descarte." : balanceDifference > 0 ? "Revise os produtos resultantes. Se a diferença for perda real, registre-a em um descarte." : "Revise o peso inicial ou reduza os pesos das saídas."}</span></div></div>}
            <div className="trace-stage-discards"><span>Descartes da peça {pieceOrder}</span>{draft.discards.map((discard) => <div key={discard.id}><div><Trash2 size={14} /><strong>{discard.name}</strong></div><label><input data-trace-entry="true" ref={(node) => { discardInputRefs.current[discard.id] = node; }} inputMode="decimal" placeholder="0,000" value={discard.input} onChange={(event) => updateDiscard(step.id, discard.id, event.target.value)} /><span>kg</span></label><button type="button" aria-label={`Remover ${discard.name}`} onClick={() => removeDiscard(step.id, discard.id)}>×</button></div>)}</div>
            {available.length > 0 && <select className="trace-add-discard" defaultValue="" onChange={(event) => { addDiscard(step.id, event.target.value); event.currentTarget.value = ""; }}><option value="">+ Adicionar outro descarte</option>{available.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select>}
            <footer><div><span>Total retirado</span><strong>− {formatWeight(total)}</strong></div><small>{draft.autoWeight ? "Peso recebido automaticamente da etapa anterior" : "Salvamento automático ativo"}</small></footer>
          </article>
          {children.length > 0 && <div className="trace-flow-arrow"><ArrowDown size={19} /><span>{children.length > 1 ? `${formatWeight(clean)} disponível para ${children.length} saídas` : `${formatWeight(clean)} segue para o próximo produto`}</span></div>}
        </div>;
      })}
      {!branched && <article className={`trace-final-card ${finalTrace?.confirmed ? "confirmed" : ""}`}><span>Produto final da peça {pieceOrder}</span><h2>{productName(finalStep?.productId)}</h2><div><strong>{formatWeight(liveFinalWeight)}</strong><small>Peso inicial calculado: produto anterior menos descartes</small></div></article>}
      {branched && <section className="trace-final-products"><header>Produtos finais da peça {pieceOrder}</header><div>{finalSteps.map((leaf) => { const draft = drafts[leaf.id]; const weight = parseDecimal(draft?.weight || "0"); const discards = (draft?.discards || []).map(({ input, ...discard }) => ({ ...discard, weightKg: parseDecimal(input) })); return <article key={leaf.id}><Check size={14} /><span>{productName(leaf.productId)}</span><strong>{formatWeight(calculateCleanWeight(weight, discards))}</strong></article>; })}</div></section>}
    </div>
    {message && <div className={`inline-message ${message.includes("concluída") || message.includes("salvas automaticamente") ? "success" : ""}`}>{message}</div>}
    <Modal
      open={Boolean(balanceIssue)}
      title="Conferir rendimento das saídas"
      subtitle={balanceIssue ? `${balanceIssue.productName} não fecha com os produtos resultantes.` : undefined}
      onClose={() => {
        const stepId = balanceIssue?.stepId;
        setBalanceIssue(null);
        if (stepId) focusInput(stepId);
      }}
      footer={<>
        <Button variant="ghost" onClick={() => {
          const stepId = balanceIssue?.stepId;
          setBalanceIssue(null);
          if (stepId) focusInput(stepId);
        }}>Revisar manualmente</Button>
        {balanceIssue && balanceIssue.difference > 0 && <Button variant="secondary" onClick={() => { setBalanceIssue(null); void completePiece(true); }}>Continuar sem ajustar</Button>}
        <Button onClick={applyBalanceSuggestion}>Aplicar sugestão</Button>
      </>}
    >
      {balanceIssue && <div className="trace-balance-dialog">
        <div><span>Peso líquido disponível</span><strong>{formatWeight(balanceIssue.available)}</strong></div>
        <div><span>Total dos produtos resultantes</span><strong>{formatWeight(balanceIssue.distributed)}</strong></div>
        <section className={balanceIssue.difference < 0 ? "danger" : ""}>
          <AlertTriangle size={20} />
          <div>
            <strong>{balanceIssue.difference > 0 ? `Falta retirar ${formatWeight(balanceIssue.difference)}` : `As saídas excedem ${formatWeight(Math.abs(balanceIssue.difference))}`}</strong>
            <p>{balanceIssue.adjustment === "increase-discard"
              ? `Sugestão: adicionar a diferença no descarte ${balanceIssue.discardName || "disponível"}.`
              : balanceIssue.adjustment === "decrease-discard"
                ? `Sugestão: reduzir a diferença do descarte ${balanceIssue.discardName}.`
                : "Não há descarte suficiente para reduzir. A sugestão é acrescentar a diferença ao peso inicial e conferir a pesagem."}</p>
          </div>
        </section>
      </div>}
    </Modal>
    <footer className="trace-piece-footer"><Button variant="ghost" disabled={pieceOrder === pieces[0]?.order || Boolean(savingStepId)} onClick={() => setPieceOrder((order) => Math.max(pieces[0]?.order || 1, order - 1))}><ArrowLeft size={15} /> Peça anterior</Button><Button className={`trace-complete-piece ${currentPieceValid ? "ready" : ""}`} disabled={Boolean(savingStepId)} onClick={() => void completePiece()}><Save size={15} /> {savingStepId ? "Finalizando..." : isLastVisiblePiece || isLastTestPiece ? "Finalizar teste" : "Concluir peça"}</Button><Button variant="secondary" disabled={pieceOrder === pieces.at(-1)?.order || Boolean(savingStepId)} onClick={() => setPieceOrder((order) => Math.min(pieces.at(-1)?.order || order, order + 1))}>Próxima peça <ArrowRight size={15} /></Button></footer>
  </>;
}
