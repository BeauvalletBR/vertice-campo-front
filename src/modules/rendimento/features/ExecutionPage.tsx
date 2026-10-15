"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CirclePlus,
  PackageCheck,
  Plus,
  Save,
  SquarePen,
  Trash2,
  Weight,
} from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { TestInputDataCard } from "../components/TestInputDataCard";
import { Button, Field, Modal } from "../components/ui";
import { testService } from "../services/testService";
import { useRendimentoData } from "../context/RendimentoDataContext";
import type { TestDiscard } from "../types/domain";
import type { NavigationTarget } from "../types/navigation";
import {
  calculateCleanWeight,
  calculateInputYield,
  calculateTotalDiscard,
  calculateYield,
} from "../utils/calculations";
import {
  formatPercent,
  formatWeight,
  parseDecimal,
  sanitizeWeightInput,
  toInputDecimal,
} from "../utils/format";

export function ExecutionPage({
  testId,
  onNavigate,
}: {
  testId?: string;
  onNavigate: (target: NavigationTarget) => void;
}) {
  const [revision, setRevision] = useState(0);
  const {
    products,
    discardTypes: catalogDiscards,
    tests,
    refreshTests,
  } = useRendimentoData();
  const test = testId ? tests.find((item) => item.id === testId) : undefined;
  const discardTypes = catalogDiscards.filter((item) => item.active);
  const firstFlow =
    test?.flows.find((flow) => flow.status !== "FINALIZADO") || test?.flows[0];
  const [flowId, setFlowId] = useState(firstFlow?.id || "");
  const flow = test?.flows.find((item) => item.id === flowId) || firstFlow;
  const [stepIndex, setStepIndex] = useState(flow?.currentStepIndex || 0);
  const step = flow?.steps[stepIndex];
  const [initialWeight, setInitialWeight] = useState("");
  const [pieceWeights, setPieceWeights] = useState<number[]>([]);
  const [weightModalOpen, setWeightModalOpen] = useState(false);
  const [pieceWeightInput, setPieceWeightInput] = useState("");
  const pieceWeightInputRef = useRef<HTMLInputElement>(null);
  const [discardWeightModalId, setDiscardWeightModalId] = useState<string | null>(null);
  const [discardPieceWeightInput, setDiscardPieceWeightInput] = useState("");
  const discardPieceWeightInputRef = useRef<HTMLInputElement>(null);
  const [draftDiscards, setDraftDiscards] = useState<TestDiscard[]>([]);
  const [discardInputs, setDiscardInputs] = useState<Record<string, string>>(
    {},
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [addMode, setAddMode] = useState<"registered" | "manual">("registered");
  const [selectedDiscardId, setSelectedDiscardId] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualWeight, setManualWeight] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const discardIdCounter = useRef(0);
  const stepDraft = JSON.stringify({
    flowId: flow?.id,
    stepId: step?.id,
    initialWeightKg: step?.initialWeightKg || 0,
    pieceWeightsKg: step?.pieceWeightsKg || [],
    discards: step?.discards || [],
  });

  useEffect(() => {
    const refresh = window.setTimeout(() => {
      const draft = JSON.parse(stepDraft) as {
        initialWeightKg: number;
        pieceWeightsKg: number[];
        discards: TestDiscard[];
      };
      setInitialWeight(toInputDecimal(draft.initialWeightKg));
      setPieceWeights(draft.pieceWeightsKg);
      setDraftDiscards(draft.discards);
      setDiscardInputs(
        Object.fromEntries(
          draft.discards.map((item) => [
            item.id,
            toInputDecimal(item.weightKg),
          ]),
        ),
      );
    }, 0);
    return () => window.clearTimeout(refresh);
  }, [stepDraft, revision]);

  const numericInitial = parseDecimal(initialWeight);
  const calculatedDiscards = draftDiscards.map((item) => ({
    ...item,
    weightKg: parseDecimal(discardInputs[item.id] || "0"),
  }));
  const total = calculateTotalDiscard(calculatedDiscards);
  const clean = calculateCleanWeight(numericInitial, calculatedDiscards);
  const stageYield = calculateYield(clean, numericInitial);
  const inputYield = calculateInputYield(
    numericInitial,
    test?.inputWeightKg || 0,
  );
  const outputInputYield = calculateInputYield(clean, test?.inputWeightKg || 0);
  const productName = (id?: string) =>
    products.find((item) => item.id === id)?.name || "—";
  const operationCount = Math.max(0, (flow?.steps.length || 0) - 1);
  const isLastOperation = Boolean(flow && stepIndex === flow.steps.length - 2);
  const nextStep = flow?.steps[stepIndex + 1];
  const availableTypes = discardTypes.filter(
    (type) => !draftDiscards.some((item) => item.discardTypeId === type.id),
  );
  const editingReopenedTest = Boolean(test?.reopenedAt);
  const editingCompletedFlow =
    flow?.status === "FINALIZADO" && test?.status === "EM_EXECUCAO";
  const weightEditable =
    editingReopenedTest || editingCompletedFlow || !step?.confirmed;
  const basePieceWeights =
    pieceWeights.length > 0
      ? pieceWeights
      : numericInitial > 0
        ? [numericInitial]
        : [];
  const newPieceWeight = parseDecimal(pieceWeightInput);
  const previewPieceTotal =
    basePieceWeights.reduce((sum, value) => sum + value, 0) + newPieceWeight;

  const selectFlow = (nextFlowId: string) => {
    const nextFlow = test?.flows.find((item) => item.id === nextFlowId);
    if (!nextFlow) return;
    const lastOperationIndex = Math.max(0, nextFlow.steps.length - 2);
    const nextStepIndex =
      nextFlow.status === "FINALIZADO"
        ? lastOperationIndex
        : Math.min(nextFlow.currentStepIndex, lastOperationIndex);
    setFlowId(nextFlowId);
    setStepIndex(nextStepIndex);
    setMessage(
      nextFlow.status === "FINALIZADO"
        ? "Produto concluído aberto para correção. Confirme novamente após ajustar os dados."
        : "",
    );
  };
  const updateWeight = (discardId: string, value: string) => {
    setDraftDiscards((current) =>
      current.map((item) =>
        item.id === discardId ? { ...item, pieceWeightsKg: [] } : item,
      ),
    );
    setDiscardInputs((current) => ({
      ...current,
      [discardId]: sanitizeWeightInput(value),
    }));
  };
  const saveProgress = async () => {
    if (!test || !flow || !step) return;
    setSaving(true);
    setMessage("");
    try {
      const updated = await testService.saveFlowStep(
        test.id,
        flow.id,
        stepIndex,
        {
          initialWeightKg: numericInitial,
          pieceWeightsKg: pieceWeights,
          discards: calculatedDiscards,
        },
        false,
      );
      const updatedFlow = updated.flows.find(
        (item) => item.rootProductId === flow.rootProductId,
      );
      if (updatedFlow) {
        setFlowId(updatedFlow.id);
        setStepIndex(updatedFlow.currentStepIndex);
      }
      await refreshTests();
      setRevision((value) => value + 1);
      setMessage(`Progresso de ${productName(flow.rootProductId)} salvo.`);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar o progresso.",
      );
    } finally {
      setSaving(false);
    }
  };
  const confirmStep = async () => {
    if (!test || !flow || !step || numericInitial <= 0) {
      setMessage("Informe um peso inicial válido.");
      return;
    }
    if (total >= numericInitial) {
      setMessage("O total retirado deve ser menor que o peso inicial.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const updated = await testService.saveFlowStep(
        test.id,
        flow.id,
        stepIndex,
        {
          initialWeightKg: numericInitial,
          pieceWeightsKg: pieceWeights,
          discards: calculatedDiscards,
        },
        true,
      );
      await refreshTests();
      if (updated.status === "FINALIZADO") {
        onNavigate({ route: "detail", id: test.id });
        return;
      }
      if (isLastOperation) {
        const nextFlow = updated.flows.find(
          (item) => item.status !== "FINALIZADO",
        );
        if (nextFlow) {
          setFlowId(nextFlow.id);
          setStepIndex(nextFlow.currentStepIndex);
          setMessage(
            `${productName(flow.rootProductId)} finalizado. Continue no próximo produto.`,
          );
        }
      } else {
        const updatedFlow = updated.flows.find(
          (item) => item.rootProductId === flow.rootProductId,
        );
        if (updatedFlow) {
          setFlowId(updatedFlow.id);
          setStepIndex(updatedFlow.currentStepIndex);
        }
      }
      setRevision((value) => value + 1);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível confirmar a transformação.",
      );
    } finally {
      setSaving(false);
    }
  };
  const addDiscard = () => {
    const weightKg = parseDecimal(manualWeight);
    let added: TestDiscard | undefined;
    if (addMode === "registered") {
      const type = discardTypes.find((item) => item.id === selectedDiscardId);
      if (!type) return;
      added = {
        id: `td-${flow?.id || "flow"}-${++discardIdCounter.current}`,
        discardTypeId: type.id,
        name: type.name,
        weightKg,
        manual: false,
      };
    } else {
      if (!manualName.trim()) return;
      added = {
        id: `td-${flow?.id || "flow"}-${++discardIdCounter.current}`,
        discardTypeId: null,
        name: manualName.trim(),
        weightKg,
        manual: true,
      };
    }
    setDraftDiscards((current) => [...current, added!]);
    setDiscardInputs((current) => ({
      ...current,
      [added!.id]: manualWeight || "0,000",
    }));
    setModalOpen(false);
    setSelectedDiscardId("");
    setManualName("");
    setManualWeight("");
  };
  const removeDiscard = (discardId: string) => {
    setDraftDiscards((current) =>
      current.filter((item) => item.id !== discardId),
    );
    setDiscardInputs((current) => {
      const next = { ...current };
      delete next[discardId];
      return next;
    });
  };
  const addPieceWeight = () => {
    if (newPieceWeight <= 0) return;
    const next = [...basePieceWeights, newPieceWeight];
    setPieceWeights(next);
    setInitialWeight(
      toInputDecimal(
        next.reduce((sum, value) => sum + value, 0),
        true,
      ),
    );
    setPieceWeightInput("");
    window.requestAnimationFrame(() => pieceWeightInputRef.current?.focus());
  };
  const removePieceWeight = (index: number) => {
    const next = pieceWeights.filter((_, itemIndex) => itemIndex !== index);
    setPieceWeights(next);
    setInitialWeight(
      toInputDecimal(
        next.reduce((sum, value) => sum + value, 0),
        true,
      ),
    );
  };
  const useTotalWeight = () => {
    setPieceWeights([]);
    setPieceWeightInput("");
    setWeightModalOpen(false);
  };
  const selectedDiscardForWeight = draftDiscards.find(
    (item) => item.id === discardWeightModalId,
  );
  const selectedDiscardTotal = selectedDiscardForWeight
    ? parseDecimal(discardInputs[selectedDiscardForWeight.id] || "0")
    : 0;
  const discardPieceWeights = selectedDiscardForWeight?.pieceWeightsKg?.length
    ? selectedDiscardForWeight.pieceWeightsKg
    : selectedDiscardTotal > 0
      ? [selectedDiscardTotal]
      : [];
  const newDiscardPieceWeight = parseDecimal(discardPieceWeightInput);
  const previewDiscardTotal =
    discardPieceWeights.reduce((sum, value) => sum + value, 0) +
    newDiscardPieceWeight;
  const setDiscardPieces = (values: number[]) => {
    if (!selectedDiscardForWeight) return;
    setDraftDiscards((current) =>
      current.map((item) =>
        item.id === selectedDiscardForWeight.id
          ? { ...item, pieceWeightsKg: values }
          : item,
      ),
    );
    setDiscardInputs((current) => ({
      ...current,
      [selectedDiscardForWeight.id]: toInputDecimal(
        values.reduce((sum, value) => sum + value, 0),
        true,
      ),
    }));
  };
  const addDiscardPieceWeight = () => {
    if (newDiscardPieceWeight <= 0) return;
    setDiscardPieces([...discardPieceWeights, newDiscardPieceWeight]);
    setDiscardPieceWeightInput("");
    window.requestAnimationFrame(() => discardPieceWeightInputRef.current?.focus());
  };
  const removeDiscardPieceWeight = (index: number) => {
    setDiscardPieces(
      (selectedDiscardForWeight?.pieceWeightsKg || []).filter(
        (_, itemIndex) => itemIndex !== index,
      ),
    );
  };
  const useDiscardTotalWeight = () => {
    if (!selectedDiscardForWeight) return;
    setDraftDiscards((current) =>
      current.map((item) =>
        item.id === selectedDiscardForWeight.id
          ? { ...item, pieceWeightsKg: [] }
          : item,
      ),
    );
    setDiscardPieceWeightInput("");
    setDiscardWeightModalId(null);
  };

  if (!test || !flow || !step)
    return (
      <div className="empty-state">
        <strong>Teste não encontrado</strong>
        <Button onClick={() => onNavigate({ route: "tests" })}>Voltar</Button>
      </div>
    );
  if (test.inputQuantity <= 0 || test.inputWeightKg <= 0)
    return (
      <>
        <button
          className="back-link"
          onClick={() => onNavigate({ route: "tests" })}
        >
          <ArrowLeft size={16} /> Voltar para testes
        </button>
        <PageHeader
          eyebrow={`Teste ${test.number}`}
          title={test.name || "Execução do Teste"}
          description="Complete os dados de entrada para liberar os produtos e iniciar a execução."
        />
        <TestInputDataCard test={test} onSaved={refreshTests} />
        <section className="product-flows-locked">
          <span>
            <PackageCheck size={22} />
          </span>
          <div>
            <strong>Execução bloqueada</strong>
            <p>
              Informe uma quantidade maior que zero e o peso de entrada. Depois
              de salvar, os produtos e suas etapas aparecerão aqui.
            </p>
          </div>
        </section>
      </>
    );

  return (
    <>
      <button
        className="back-link"
        onClick={() => onNavigate({ route: "tests" })}
      >
        <ArrowLeft size={16} /> Voltar para testes
      </button>
      <PageHeader
        eyebrow={`Teste ${test.number}`}
        title={test.name || "Execução do Teste"}
        description={
          editingReopenedTest
            ? "Teste reaberto: edite pesos, descartes e informações antes de finalizar novamente."
            : `${test.flows.length} ${test.flows.length === 1 ? "produto vinculado" : "produtos vinculados"} · progresso salvo separadamente`
        }
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => onNavigate({ route: "new-test", id: test.id })}
            >
              <SquarePen size={16} /> Editar teste inteiro
            </Button>
            <Button
              variant="secondary"
              disabled={saving}
              onClick={() => void saveProgress()}
            >
              <Save size={16} />{" "}
              {saving ? "Salvando..." : "Salvar este produto"}
            </Button>
          </>
        }
      />
      <TestInputDataCard test={test} onSaved={refreshTests} />
      <section className="attached-products">
        <header>
          <div>
            <PackageCheck size={18} />
            <span>Produtos deste teste</span>
          </div>
          <small>Selecione qualquer produto para executar ou corrigir</small>
        </header>
        <div>
          {test.flows.map((item, index) => (
            <button
              key={item.id}
              className={`${item.id === flow.id ? "active" : ""} ${item.status === "FINALIZADO" ? "completed-editable" : ""}`}
              title={
                item.status === "FINALIZADO"
                  ? "Clique para revisar este produto"
                  : undefined
              }
              onClick={() => selectFlow(item.id)}
            >
              <i>
                {item.status === "FINALIZADO" ? <Check size={14} /> : index + 1}
              </i>
              <p>
                <strong>{productName(item.rootProductId)}</strong>
                <small>{item.productIds.map(productName).join(" → ")}</small>
              </p>
              <span
                className={`flow-status flow-status--${item.status.toLowerCase()}`}
              >
                {item.status === "FINALIZADO"
                  ? "Finalizado"
                  : item.status === "EM_EXECUCAO"
                    ? "Em execução"
                    : "Pendente"}
              </span>
            </button>
          ))}
        </div>
      </section>
      {editingCompletedFlow && (
        <div className="inline-message completed-flow-editing">
          <SquarePen size={16} />
          <span>
            Este produto já foi concluído. Você pode corrigir seus dados e
            confirmá-lo novamente sem perder o andamento dos outros produtos.
          </span>
        </div>
      )}
      <div className="step-progress">
        {flow.steps.map((item, index) => {
          const finalProduct = index === flow.steps.length - 1;
          return (
            <button
              key={item.id}
              className={`${index === stepIndex && !finalProduct ? "active" : ""} ${item.confirmed ? "complete" : ""} ${finalProduct ? "terminal" : ""}`}
              disabled={finalProduct || index > flow.currentStepIndex}
              onClick={() =>
                !finalProduct &&
                index <= flow.currentStepIndex &&
                setStepIndex(index)
              }
            >
              <span>
                {item.confirmed ? (
                  <Check size={14} />
                ) : finalProduct ? (
                  <Check size={14} />
                ) : (
                  index + 1
                )}
              </span>
              <p>
                <small>
                  {finalProduct
                    ? "Produto final"
                    : `Transformação ${index + 1}`}
                </small>
                <strong>{productName(item.productId)}</strong>
              </p>
              {index < flow.steps.length - 1 && <i />}
            </button>
          );
        })}
      </div>
      <div className="execution-layout">
        <section className="step-card">
          <header>
            <div>
              <span>
                {productName(flow.rootProductId)} · transformação{" "}
                {stepIndex + 1} de {operationCount}
              </span>
              <h2>
                {productName(step.productId)} →{" "}
                {productName(nextStep?.productId)}
              </h2>
            </div>
            <div className="step-weight">
              <small>
                {weightEditable ? "Peso inicial · editável" : "Peso inicial"}
              </small>
              {weightEditable ? (
                <div className="step-weight-editor">
                  {pieceWeights.length > 0 && (
                    <span className="piece-weight-count">
                      {pieceWeights.length} valores somados
                    </span>
                  )}
                  <div>
                    <input
                      value={initialWeight}
                      readOnly={pieceWeights.length > 0}
                      aria-label="Peso inicial do produto"
                      placeholder="0,000"
                      onChange={(event) =>
                        setInitialWeight(
                          sanitizeWeightInput(event.target.value),
                        )
                      }
                      inputMode="decimal"
                    />
                    <button
                      type="button"
                      className="add-piece-weight-button"
                      title="Somar uma pesagem individual"
                      aria-label="Adicionar pesagem individual"
                      onClick={() => setWeightModalOpen(true)}
                    >
                      <Plus size={18} />
                    </button>
                  </div>
                </div>
              ) : (
                <strong>{formatWeight(numericInitial)}</strong>
              )}
            </div>
          </header>
          <div className="discard-heading">
            <div>
              <Trash2 size={17} />
              <span>Descartes desta etapa</span>
            </div>
            <small>Use vírgula e até três casas decimais</small>
          </div>
          <div className="discard-inputs">
            {draftDiscards.map((item) => {
              const filled = parseDecimal(discardInputs[item.id] || "0") > 0;
              return (
                <div
                  className={`discard-row ${filled ? "filled" : ""}`}
                  key={item.id}
                >
                  <div>
                    <span className={item.manual ? "manual-tag" : ""}>
                      {item.manual ? "Manual" : "Cadastrado"}
                    </span>
                    <strong>{item.name}</strong>
                    {item.pieceWeightsKg && item.pieceWeightsKg.length > 0 && (
                      <span className="discard-piece-count">
                        {item.pieceWeightsKg.length} valores somados
                      </span>
                    )}
                  </div>
                  <label className="discard-weight-editor">
                    <input
                      inputMode="decimal"
                      value={discardInputs[item.id] ?? ""}
                      readOnly={Boolean(item.pieceWeightsKg?.length)}
                      placeholder="0,000"
                      onChange={(event) =>
                        updateWeight(item.id, event.target.value)
                      }
                    />
                    <span>kg</span>
                    <button
                      type="button"
                      title="Somar uma pesagem ao descarte"
                      aria-label={`Adicionar pesagem em ${item.name}`}
                      onClick={() => setDiscardWeightModalId(item.id)}
                    >
                      <Plus size={17} />
                    </button>
                  </label>
                  {item.manual && (
                    <button
                      className="icon-button icon-button--danger"
                      onClick={() => removeDiscard(item.id)}
                      aria-label={`Remover ${item.name}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <button className="add-discard" onClick={() => setModalOpen(true)}>
            <CirclePlus size={17} /> Adicionar outro descarte
          </button>
          <div className="inline-clean-summary" aria-label="Resultado líquido da transformação">
            <div>
              <span>Peso líquido após limpeza</span>
              <strong>{formatWeight(clean)}</strong>
              <small>Peso inicial menos todos os descartes</small>
            </div>
            <div>
              <span>Rendimento sobre a entrada</span>
              <strong>{formatPercent(outputInputYield)}</strong>
              <small>Peso líquido do item ÷ peso total da entrada</small>
            </div>
          </div>
          {message && (
            <div
              className={`inline-message ${message.includes("salvo") || message.includes("finalizado") ? "success" : ""}`}
            >
              {message}
            </div>
          )}
          <footer>
            <Button
              variant="ghost"
              disabled={stepIndex === 0 || saving}
              onClick={() => setStepIndex((value) => Math.max(0, value - 1))}
            >
              <ArrowLeft size={16} /> Etapa anterior
            </Button>
            <Button disabled={saving} onClick={() => void confirmStep()}>
              {saving ? (
                "Salvando..."
              ) : editingCompletedFlow && isLastOperation ? (
                <>
                  <Check size={16} /> Salvar correção e concluir produto
                </>
              ) : isLastOperation ? (
                <>
                  <Check size={16} />{" "}
                  {test.flows.length > 1
                    ? "Gerar produto final"
                    : "Gerar produto final e finalizar"}
                </>
              ) : (
                <>
                  Confirmar transformação e avançar <ArrowRight size={16} />
                </>
              )}
            </Button>
          </footer>
        </section>
        <aside className="calculation-card">
          <header>
            <Weight size={18} />
            <h3>Resumo do cálculo</h3>
          </header>
          <div className="calculation-line">
            <span>Peso inicial do item</span>
            <strong>{formatWeight(numericInitial)}</strong>
          </div>
          <div className="calculation-line negative">
            <span>Total retirado</span>
            <strong>− {formatWeight(total)}</strong>
          </div>
          <div className="calculation-result">
            <span>
              Peso líquido <small>após descartes</small>
            </span>
            <strong>{formatWeight(clean)}</strong>
          </div>
          <div className="yield-grid">
            <div>
              <span>Aproveitamento da transformação</span>
              <strong>{formatPercent(stageYield)}</strong>
              <small>Peso líquido ÷ peso do item</small>
            </div>
            <div>
              <span>Sobre a entrada sem descartes</span>
              <strong>{formatPercent(inputYield)}</strong>
              <small>Peso do item ÷ entrada geral</small>
            </div>
          </div>
          <div className="yield-after-discards">
            <span>Rendimento sobre a entrada</span>
            <strong>{formatPercent(outputInputYield)}</strong>
            <small>
              Peso líquido do item ÷ peso total da entrada.
            </small>
          </div>
          <div className="next-pattern">
            <span>
              {isLastOperation ? "Produto final gerado" : "Próximo padrão"}
            </span>
            <strong>{productName(nextStep?.productId)}</strong>
            <p>
              {isLastOperation
                ? `${formatWeight(clean)} · resultado final, sem nova etapa de descartes`
                : `${formatWeight(clean)} · segue para a próxima transformação`}
            </p>
          </div>
        </aside>
      </div>
      <Modal
        open={modalOpen}
        title="Adicionar descarte"
        subtitle="Use um tipo cadastrado ou descreva uma retirada específica."
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={addDiscard}>Adicionar</Button>
          </>
        }
      >
        <div className="segmented">
          <button
            className={addMode === "registered" ? "active" : ""}
            onClick={() => setAddMode("registered")}
          >
            Descarte cadastrado
          </button>
          <button
            className={addMode === "manual" ? "active" : ""}
            onClick={() => setAddMode("manual")}
          >
            Descrição manual
          </button>
        </div>
        {addMode === "registered" ? (
          <Field label="Tipo de descarte">
            <select
              value={selectedDiscardId}
              onChange={(event) => setSelectedDiscardId(event.target.value)}
            >
              <option value="">Selecione...</option>
              {availableTypes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <Field label="Descrição">
            <input
              value={manualName}
              onChange={(event) => setManualName(event.target.value)}
              placeholder="Ex.: Apara lateral"
            />
          </Field>
        )}
        <Field label="Peso" hint="kg">
          <input
            value={manualWeight}
            onChange={(event) =>
              setManualWeight(sanitizeWeightInput(event.target.value))
            }
            inputMode="decimal"
            placeholder="0,125"
          />
        </Field>
      </Modal>
      <Modal
        open={weightModalOpen}
        title="Adicionar pesagem ao produto"
        subtitle="Informe somente o novo valor. Ele será somado ao peso atual."
        onClose={() => {
          setWeightModalOpen(false);
          setPieceWeightInput("");
        }}
        footer={
          <>
            {pieceWeights.length > 0 && (
              <Button variant="ghost" onClick={useTotalWeight}>
                Voltar para peso total
              </Button>
            )}
            <Button
              variant="ghost"
              onClick={() => {
                setWeightModalOpen(false);
                setPieceWeightInput("");
              }}
            >
              Concluir
            </Button>
            <Button disabled={newPieceWeight <= 0} onClick={addPieceWeight}>
              <Plus size={16} /> Adicionar e continuar
            </Button>
          </>
        }
      >
        <div className="piece-weight-modal-summary">
          <span>
            {basePieceWeights.length}{" "}
            {basePieceWeights.length === 1 ? "valor atual" : "valores atuais"}
          </span>
          <strong>
            {formatWeight(
              basePieceWeights.reduce((sum, value) => sum + value, 0),
            )}
          </strong>
        </div>
        <Field label="Nova pesagem" hint="kg">
          <input
            ref={pieceWeightInputRef}
            autoFocus
            value={pieceWeightInput}
            inputMode="decimal"
            placeholder="0,000"
            onChange={(event) =>
              setPieceWeightInput(sanitizeWeightInput(event.target.value))
            }
            onKeyDown={(event) => {
              if (event.key === "Enter" && newPieceWeight > 0) {
                event.preventDefault();
                addPieceWeight();
              }
            }}
          />
        </Field>
        <div className="piece-weight-preview">
          <span>Total após adicionar</span>
          <strong>{formatWeight(previewPieceTotal)}</strong>
          <small>
            {basePieceWeights.length + (newPieceWeight > 0 ? 1 : 0)} valores
            somados
          </small>
        </div>
        {pieceWeights.length > 0 && (
          <div className="piece-weight-list">
            <span>Pesagens que formam o total</span>
            {pieceWeights.map((value, index) => (
              <div key={`${index}-${value}`}>
                <span>Valor {index + 1}</span>
                <strong>{formatWeight(value)}</strong>
                <button
                  type="button"
                  className="icon-button icon-button--danger"
                  aria-label={`Remover valor ${index + 1}`}
                  onClick={() => removePieceWeight(index)}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </Modal>
      <Modal
        open={Boolean(discardWeightModalId)}
        title={`Somar peso em ${selectedDiscardForWeight?.name || "descarte"}`}
        subtitle="Informe o novo valor. Ele será somado ao total deste descarte."
        onClose={() => {
          setDiscardWeightModalId(null);
          setDiscardPieceWeightInput("");
        }}
        footer={
          <>
            {selectedDiscardForWeight?.pieceWeightsKg?.length ? (
              <Button variant="ghost" onClick={useDiscardTotalWeight}>
                Voltar para peso total
              </Button>
            ) : null}
            <Button
              variant="ghost"
              onClick={() => {
                setDiscardWeightModalId(null);
                setDiscardPieceWeightInput("");
              }}
            >
              Concluir
            </Button>
            <Button
              disabled={newDiscardPieceWeight <= 0}
              onClick={addDiscardPieceWeight}
            >
              <Plus size={16} /> Adicionar e continuar
            </Button>
          </>
        }
      >
        <div className="piece-weight-modal-summary">
          <span>
            {discardPieceWeights.length}{" "}
            {discardPieceWeights.length === 1 ? "valor atual" : "valores atuais"}
          </span>
          <strong>
            {formatWeight(
              discardPieceWeights.reduce((sum, value) => sum + value, 0),
            )}
          </strong>
        </div>
        <Field label="Novo peso de descarte" hint="kg">
          <input
            ref={discardPieceWeightInputRef}
            autoFocus
            value={discardPieceWeightInput}
            inputMode="decimal"
            placeholder="0,000"
            onChange={(event) =>
              setDiscardPieceWeightInput(sanitizeWeightInput(event.target.value))
            }
            onKeyDown={(event) => {
              if (event.key === "Enter" && newDiscardPieceWeight > 0) {
                event.preventDefault();
                addDiscardPieceWeight();
              }
            }}
          />
        </Field>
        <div className="piece-weight-preview">
          <span>Total após adicionar</span>
          <strong>{formatWeight(previewDiscardTotal)}</strong>
          <small>
            {discardPieceWeights.length + (newDiscardPieceWeight > 0 ? 1 : 0)} valores somados
          </small>
        </div>
        {selectedDiscardForWeight?.pieceWeightsKg?.length ? (
          <div className="piece-weight-list">
            <span>Pesagens que formam o descarte</span>
            {selectedDiscardForWeight.pieceWeightsKg.map((value, index) => (
              <div key={`${index}-${value}`}>
                <span>Valor {index + 1}</span>
                <strong>{formatWeight(value)}</strong>
                <button
                  type="button"
                  className="icon-button icon-button--danger"
                  aria-label={`Remover peso de descarte ${index + 1}`}
                  onClick={() => removeDiscardPieceWeight(index)}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </Modal>
    </>
  );
}
