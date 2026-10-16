"use client";

import { useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  CalendarDays,
  FileDown,
  PackageCheck,
  Scale,
  SquarePen,
  UserRound,
} from "lucide-react";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { TestInputDataCard } from "../components/TestInputDataCard";
import { Button } from "../components/ui";
import { TraceabilityMatrix } from "../components/TraceabilityMatrix";
import { ReportExportDialog } from "../components/ReportExportDialog";
import { ResultFlowTree } from "../components/ResultFlowTree";
import { testService } from "../services/testService";
import { useRendimentoData } from "../context/RendimentoDataContext";
import type { NavigationTarget } from "../types/navigation";
import { calculateTotalDiscard, consolidateDiscards } from "../utils/calculations";
import { isBranchedFlow, isLeafStep, orderTreeSteps, stepChildren, stepDepth } from "../utils/flowTree";
import {
  formatDate,
  formatDateTime,
  formatPercent,
  formatWeight,
} from "../utils/format";

export function TestDetailPage({
  testId,
  onNavigate,
}: {
  testId?: string;
  onNavigate: (target: NavigationTarget) => void;
}) {
  const [confirmReopen, setConfirmReopen] = useState(false);
  const [actionError, setActionError] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const { products, tests, refreshTests } = useRendimentoData();
  const test = testId ? tests.find((item) => item.id === testId) : undefined;
  const productName = (id?: string) =>
    products.find((item) => item.id === id)?.name || "—";
  if (!test)
    return (
      <div className="empty-state">
        <strong>Teste não encontrado</strong>
        <Button onClick={() => onNavigate({ route: "tests" })}>Voltar</Button>
      </div>
    );
  const productNames = test.flows
    .map((flow) => productName(flow.rootProductId))
    .join(" + ");
  const finalWeight = test.flows.reduce(
    (sum, flow) =>
      sum +
      ([...flow.steps].reverse().find((step) => step.confirmed)
        ?.cleanWeightKg || 0),
    0,
  );
  const finalInputYield =
    test.inputWeightKg > 0 ? (finalWeight / test.inputWeightKg) * 100 : 0;
  const reopen = async () => {
    setActionError("");
    try {
      const reopened = await testService.reopen(test.id);
      if (!reopened) {
        setActionError("Este teste não está disponível para reabertura.");
        return;
      }
      await refreshTests();
      onNavigate({ route: "execute", id: test.id });
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Não foi possível reabrir o teste.",
      );
    }
  };

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
        title={test.name || `Teste ${test.number}`}
        description={`${productNames} · criado por ${test.createdBy}`}
        actions={
          <div className="detail-actions">
            <StatusBadge status={test.status} />
            {test.status === "FINALIZADO" ? (
              <>
                <Button
                  variant="secondary"
                  onClick={() => setConfirmReopen(true)}
                >
                  <SquarePen size={17} /> Reabrir e editar valores
                </Button>
                <Button onClick={() => setReportOpen(true)}><FileDown size={17} /> Exportar relatório</Button>
              </>
            ) : (
              <>
                {["RASCUNHO", "ABERTO"].includes(test.status) && (
                  <Button
                    variant="secondary"
                    onClick={() =>
                      onNavigate({ route: "new-test", id: test.id })
                    }
                  >
                    <SquarePen size={17} /> Editar teste inteiro
                  </Button>
                )}
                <Button
                  onClick={() =>
                    onNavigate({
                      route:
                        test.status === "RASCUNHO" ? "new-test" : "execute",
                      id: test.id,
                    })
                  }
                >
                  Continuar teste
                </Button>
              </>
            )}
          </div>
        }
      />
      {actionError && <div className="inline-message">{actionError}</div>}
      <section className="detail-summary detail-summary--compact">
        <div>
          <CalendarDays size={17} />
          <p>
            <span>Data</span>
            <strong>
              {test.date ? formatDate(test.date) : "Não informada"}
            </strong>
          </p>
        </div>
        <div>
          <PackageCheck size={17} />
          <p>
            <span>Produtos</span>
            <strong>{test.flows.length}</strong>
            <small>{productNames}</small>
          </p>
        </div>
        <div>
          <Scale size={17} />
          <p>
            <span>Peso de entrada</span>
            <strong>
              {test.inputWeightKg
                ? formatWeight(test.inputWeightKg)
                : "Não informado"}
            </strong>
            <small>{test.inputQuantity} peças</small>
          </p>
        </div>
        <div>
          <UserRound size={17} />
          <p>
            <span>Responsável</span>
            <strong>
              {test.finalizedBy || test.startedBy || test.createdBy}
            </strong>
            <small>
              {test.finalizedAt
                ? formatDateTime(test.finalizedAt)
                : "Em execução"}
            </small>
          </p>
        </div>
      </section>
      {test.status !== "FINALIZADO" && (
        <TestInputDataCard test={test} onSaved={refreshTests} />
      )}
      {test.executionMode === "traceable" ? (
        <section className="yield-process-section result-flow-section">
          <header><div><span>Processo</span><h2>Fluxo de transformação</h2><p>Produtos, valores e descartes organizados conforme as ramificações do teste.</p></div><div className="final-yield"><span>Final sobre a entrada</span><strong>{formatPercent(finalInputYield)}</strong></div></header>
          <div className="result-flow-list">{test.flows.map((flow, flowIndex) => <ResultFlowTree key={flow.id} flow={flow} flowIndex={flowIndex} products={products} />)}</div>
          <details className="trace-matrix-details"><summary>Ver detalhamento por peça</summary><TraceabilityMatrix test={test} products={products} /></details>
        </section>
      ) : <section className="yield-process-section">
        <header>
          <div>
            <span>Processo</span>
            <h2>Fluxo de rendimento</h2>
            <p>
              Os descartes estão agrupados no produto em que foram retirados.
            </p>
          </div>
          <div className="final-yield">
            <span>Final sobre a entrada</span>
            <strong>{formatPercent(finalInputYield)}</strong>
          </div>
        </header>
        <div className="yield-processes">
          {test.flows.map((flow, flowIndex) => {
            const visibleSteps = orderTreeSteps(flow.steps);
            const branched = isBranchedFlow(flow.steps);
            const operationSteps = branched ? visibleSteps : visibleSteps.slice(0, -1);
            const finalStep = branched ? undefined : visibleSteps.at(-1);
            const firstWeight = operationSteps[0]?.initialWeightKg || 0;
            const finalDiscards = consolidateDiscards(
              operationSteps.flatMap((step) => step.discards),
            );
            return (
              <article className="yield-process" key={flow.id}>
                <header>
                  <div>
                    <span>Produto {flowIndex + 1}</span>
                    <h3>{productName(flow.rootProductId)}</h3>
                  </div>
                  <StatusBadge
                    status={flow.status === "PENDENTE" ? "ABERTO" : flow.status}
                  />
                </header>

                <div className="yield-process-columns" aria-hidden="true">
                  <span>Produto / descarte</span>
                  <span>Peso</span>
                  <span>Sobre a entrada</span>
                  <span>Aproveitamento no fluxo</span>
                </div>

                <div className="yield-process-body">
                  {operationSteps.map((step, stepIndex) => {
                    const discards = step.discards.filter(
                      (discard) => discard.weightKg > 0,
                    );
                    const processYield = firstWeight
                      ? (step.initialWeightKg / firstWeight) * 100
                      : 0;
                    return (
                      <div className={`yield-process-stage ${branched ? "yield-process-stage--branch" : ""}`} style={branched ? { marginLeft: `${stepDepth(flow.steps, step) * 30}px` } : undefined} key={step.id}>
                        <div className={`yield-product-row ${branched && isLeafStep(flow.steps, step.id) ? "yield-product-row--final" : ""}`}>
                          <span className="yield-product-marker">
                            {stepIndex + 1}
                          </span>
                          <strong>{productName(step.productId)}</strong>
                          <b>{formatWeight(step.initialWeightKg)}</b>
                          <b>{formatPercent(step.inputYieldPercent)}</b>
                          <b>
                            {stepIndex === 0
                              ? "Entrada"
                              : formatPercent(processYield)}
                          </b>
                        </div>

                        {discards.length > 0 && (
                          <div className="yield-discard-group">
                            {discards.map((discard) => (
                              <div
                                className="yield-discard-row"
                                key={discard.id}
                              >
                                <span>{discard.name}</span>
                                <strong>
                                  − {formatWeight(discard.weightKg)}
                                </strong>
                              </div>
                            ))}
                          </div>
                        )}

                        {stepChildren(flow.steps, step.id).length > 0 && <div
                          className="yield-product-connector"
                          aria-hidden="true"
                        >
                          <ArrowDown size={18} />
                        </div>}
                      </div>
                    );
                  })}

                  {finalStep && (
                    <>
                      <div className="yield-product-row yield-product-row--final">
                        <span className="yield-product-marker">
                          <PackageCheck size={15} />
                        </span>
                        <strong>{productName(finalStep.productId)}</strong>
                        <b>{formatWeight(finalStep.cleanWeightKg)}</b>
                        <b>{formatPercent(finalStep.inputYieldPercent)}</b>
                        <b>
                          {formatPercent(
                            firstWeight
                              ? (finalStep.cleanWeightKg / firstWeight) * 100
                              : 0,
                          )}
                        </b>
                      </div>
                      {finalDiscards.length > 0 && (
                        <div className="yield-final-discards">
                          {finalDiscards.map((discard) => (
                            <div key={`${discard.discardTypeId}-${discard.name}`}>
                              <span>{discard.name}</span>
                              <b>− {formatWeight(discard.weightKg)}</b>
                            </div>
                          ))}
                          <div className="yield-final-discards__total">
                            <span>Total retirado</span>
                            <b>− {formatWeight(calculateTotalDiscard(finalDiscards))}</b>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>}
      <ConfirmDialog
        open={confirmReopen}
        title={`Reabrir teste ${test.number}?`}
        description="O teste voltará para execução e poderá ter seus valores alterados antes de uma nova finalização."
        confirmLabel="Reabrir teste"
        onCancel={() => setConfirmReopen(false)}
        onConfirm={async () => {
          setConfirmReopen(false);
          await reopen();
        }}
      />
      <ReportExportDialog open={reportOpen} test={test} products={products} onClose={() => setReportOpen(false)} />
    </>
  );
}
