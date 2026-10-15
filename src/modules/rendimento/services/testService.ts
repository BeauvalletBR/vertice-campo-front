import type {
  DiscardType,
  Product,
  TestDiscard,
  TestFlow,
  TestFlowSetupInput,
  TestSetupInput,
  TestStep,
  TraceableStepItem,
  YieldTest,
} from "../types/domain";
import {
  calculateAverageWeight,
  calculateCleanWeight,
  calculateInputYield,
  calculateYield,
} from "../utils/calculations";
import { rendimentoApi } from "./rendimentoApi";

const temporaryId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function blankDiscards(
  productId: string,
  products: Product[],
  types: DiscardType[],
): TestDiscard[] {
  const product = products.find((item) => item.id === productId);
  return (product?.applicableDiscardIds || []).map((typeId) => {
    const type = types.find((item) => item.id === typeId);
    return {
      id: temporaryId("discard"),
      discardTypeId: typeId,
      name: type?.name || "Descarte",
      weightKg: 0,
      manual: false,
    };
  });
}

function newSteps(
  productIds: string[],
  firstStepWeightKg: number,
  inputWeightKg: number,
  products: Product[],
  types: DiscardType[],
): TestStep[] {
  return productIds.map((productId, index) => ({
    id: temporaryId("step"),
    productId,
    initialWeightKg: index === 0 ? firstStepWeightKg : 0,
    discards:
      index === productIds.length - 1
        ? []
        : blankDiscards(productId, products, types),
    cleanWeightKg: index === 0 ? firstStepWeightKg : 0,
    yieldPercent: index === 0 && firstStepWeightKg ? 100 : 0,
    inputYieldPercent:
      index === 0 ? calculateInputYield(firstStepWeightKg, inputWeightKg) : 0,
    outputInputYieldPercent:
      index === 0 ? calculateInputYield(firstStepWeightKg, inputWeightKg) : 0,
    confirmed: false,
  }));
}

function createOrUpdateFlow(
  input: TestFlowSetupInput,
  before: TestFlow | undefined,
  inputWeightKg: number,
  now: string,
  products: Product[],
  types: DiscardType[],
): TestFlow {
  const sequenceChanged =
    !before ||
    before.productIds.join("|") !== input.productIds.join("|") ||
    Math.abs(
      (before.steps[0]?.initialWeightKg || 0) - input.firstStepWeightKg,
    ) > 0.0001;
  const steps = sequenceChanged
    ? newSteps(
        input.productIds,
        input.firstStepWeightKg,
        inputWeightKg,
        products,
        types,
      ).map((freshStep, index) => {
        const savedStep = before?.steps.find(
          (step) => step.productId === freshStep.productId,
        );
        if (!savedStep) return freshStep;
        const initialWeightKg =
          index === 0 ? input.firstStepWeightKg : savedStep.initialWeightKg;
        return {
          ...savedStep,
          initialWeightKg,
          inputYieldPercent: calculateInputYield(
            initialWeightKg,
            inputWeightKg,
          ),
          outputInputYieldPercent: calculateInputYield(
            savedStep.cleanWeightKg,
            inputWeightKg,
          ),
        };
      })
    : before.steps.map((step) => ({
        ...step,
        inputYieldPercent: calculateInputYield(
          step.initialWeightKg,
          inputWeightKg,
        ),
        outputInputYieldPercent: calculateInputYield(
          step.cleanWeightKg,
          inputWeightKg,
        ),
      }));
  const firstPendingStep = steps.findIndex((step) => !step.confirmed);
  return {
    id: before?.id || input.id || temporaryId("flow"),
    rootProductId: input.rootProductId,
    productIds: input.productIds,
    steps,
    currentStepIndex: sequenceChanged
      ? Math.max(0, firstPendingStep)
      : before.currentStepIndex,
    status: sequenceChanged ? "PENDENTE" : before.status,
    updatedAt: now,
  };
}

function syncLegacy(test: YieldTest): YieldTest {
  const first = test.flows[0];
  return {
    ...test,
    groupProductId: first?.rootProductId || "",
    steps: first?.steps || [],
    currentStepIndex: first?.currentStepIndex || 0,
  };
}

function aggregateTraceStep(step: TestStep, inputWeightKg: number, pieceOrders: number[]): TestStep {
  const items = step.traceItems || [];
  const initialWeightKg = items.reduce((sum, item) => sum + item.initialWeightKg, 0);
  const cleanWeightKg = items.reduce((sum, item) => sum + item.cleanWeightKg, 0);
  return {
    ...step,
    initialWeightKg,
    pieceWeightsKg: items.map((item) => item.initialWeightKg),
    discards: items.flatMap((item) => item.discards),
    cleanWeightKg,
    yieldPercent: calculateYield(cleanWeightKg, initialWeightKg),
    inputYieldPercent: calculateInputYield(initialWeightKg, inputWeightKg),
    outputInputYieldPercent: calculateInputYield(cleanWeightKg, inputWeightKg),
    confirmed: pieceOrders.length > 0 && pieceOrders.every((order) =>
      items.some((item) => item.inputPieceOrder === order && item.confirmed),
    ),
  };
}

export const testService = {
  list: () => rendimentoApi.listTests(),
  get: (id: string) => rendimentoApi.getTest(id),

  async saveSetup(input: TestSetupInput) {
    const [before, catalogs] = await Promise.all([
      input.id ? rendimentoApi.getTest(input.id) : Promise.resolve(undefined),
      rendimentoApi.catalogs(),
    ]);
    const now = new Date().toISOString();
    const flows = input.flows.map((flowInput) =>
      createOrUpdateFlow(
        flowInput,
        before?.flows.find((flow) => flow.id === flowInput.id),
        input.inputWeightKg,
        now,
        catalogs.products,
        catalogs.discardTypes,
      ),
    );
    const requestedStatus = input.status;
    const initialStatus =
      !before && requestedStatus === "EM_EXECUCAO"
        ? "ABERTO"
        : before &&
            requestedStatus === "RASCUNHO" &&
            before.status !== "RASCUNHO"
          ? before.status
          : requestedStatus;
    const test = syncLegacy({
      id: before?.id || "",
      version: before?.version || 0,
      number: before?.number || 0,
      name: input.name.trim() || before?.name || "Novo teste",
      date: input.date,
      inputProductId: input.inputProductId,
      inputQuantity: input.inputQuantity,
      inputWeightKg: input.inputWeightKg,
      inputTotalWeightKg: input.inputTotalWeightKg,
      inputWeightMode: input.inputWeightMode,
      inputPieceWeightsKg: input.inputPieceWeightsKg || [],
      executionMode: input.executionMode || before?.executionMode || "consolidated",
      averageWeightKg: calculateAverageWeight(
        input.inputWeightKg,
        input.inputQuantity,
      ),
      groupProductId: flows[0]?.rootProductId || "",
      status: initialStatus,
      flows,
      steps: flows[0]?.steps || [],
      currentStepIndex: flows[0]?.currentStepIndex || 0,
      createdBy: before?.createdBy || "",
      createdAt: before?.createdAt || now,
      updatedBy: before?.updatedBy || "",
      updatedAt: now,
      startedBy: before?.startedBy,
      startedAt: before?.startedAt,
      finalizedBy: before?.finalizedBy,
      finalizedAt: before?.finalizedAt,
      reopenedAt: before?.reopenedAt,
    });
    const saved = await rendimentoApi.saveTest(test, !before);
    return requestedStatus === "EM_EXECUCAO" && !before
      ? rendimentoApi.changeStatus(saved, "INICIAR")
      : saved;
  },

  async start(id: string) {
    const test = await rendimentoApi.getTest(id);
    if (test.inputQuantity <= 0 || test.inputWeightKg <= 0) return undefined;
    return rendimentoApi.changeStatus(test, "INICIAR");
  },

  async updateInput(
    id: string,
    input: {
      name: string;
      date: string;
      inputProductId: string;
      inputQuantity: number;
      inputWeightKg: number;
      inputTotalWeightKg: number;
      inputWeightMode: "total" | "pieces";
      inputPieceWeightsKg?: number[];
    },
  ) {
    const before = await rendimentoApi.getTest(id);
    const now = new Date().toISOString();
    const flows = before.flows.map((flow) => ({
      ...flow,
      steps: flow.steps.map((step) => ({
        ...step,
        inputYieldPercent: calculateInputYield(
          step.initialWeightKg,
          input.inputWeightKg,
        ),
        outputInputYieldPercent: calculateInputYield(
          step.cleanWeightKg,
          input.inputWeightKg,
        ),
      })),
      updatedAt: now,
    }));
    return rendimentoApi.saveTest(
      syncLegacy({
        ...before,
        name: input.name.trim() || before.name,
        date: input.date,
        inputProductId: input.inputProductId,
        inputQuantity: Math.max(0, input.inputQuantity),
        inputWeightKg: Math.max(0, input.inputWeightKg),
        inputTotalWeightKg: Math.max(0, input.inputTotalWeightKg),
        inputWeightMode: input.inputWeightMode,
        inputPieceWeightsKg: input.inputPieceWeightsKg || [],
        averageWeightKg: calculateAverageWeight(
          input.inputWeightKg,
          input.inputQuantity,
        ),
        flows,
        updatedAt: now,
      }),
      false,
    );
  },

  async saveFlowStep(
    id: string,
    flowId: string,
    stepIndex: number,
    input: {
      initialWeightKg: number;
      pieceWeightsKg?: number[];
      discards: TestDiscard[];
    },
    confirm = false,
  ) {
    const before = await rendimentoApi.getTest(id);
    const targetFlow = before.flows.find((flow) => flow.id === flowId);
    const canEditFinishedFlow =
      targetFlow?.status === "FINALIZADO" && before.status === "EM_EXECUCAO";
    if (
      !targetFlow ||
      before.inputQuantity <= 0 ||
      before.inputWeightKg <= 0 ||
      (targetFlow.status === "FINALIZADO" && !canEditFinishedFlow)
    )
      return before;
    const terminalIndex = targetFlow.steps.length - 1;
    if (stepIndex < 0 || stepIndex >= terminalIndex) return before;
    const cleanWeightKg = calculateCleanWeight(
      input.initialWeightKg,
      input.discards,
    );
    const step: TestStep = {
      ...targetFlow.steps[stepIndex],
      initialWeightKg: input.initialWeightKg,
      pieceWeightsKg: input.pieceWeightsKg || [],
      discards: input.discards,
      cleanWeightKg,
      yieldPercent: calculateYield(cleanWeightKg, input.initialWeightKg),
      inputYieldPercent: calculateInputYield(
        input.initialWeightKg,
        before.inputWeightKg,
      ),
      outputInputYieldPercent: calculateInputYield(
        cleanWeightKg,
        before.inputWeightKg,
      ),
      confirmed: confirm || targetFlow.steps[stepIndex].confirmed,
    };
    const steps = targetFlow.steps.map((item, index) =>
      index === stepIndex ? step : item,
    );
    if (confirm && steps[stepIndex + 1]) {
      const nextIsFinalProduct = stepIndex + 1 === terminalIndex;
      steps[stepIndex + 1] = {
        ...steps[stepIndex + 1],
        initialWeightKg: cleanWeightKg,
        cleanWeightKg,
        yieldPercent: cleanWeightKg ? 100 : 0,
        inputYieldPercent: calculateInputYield(
          cleanWeightKg,
          before.inputWeightKg,
        ),
        outputInputYieldPercent: calculateInputYield(
          cleanWeightKg,
          before.inputWeightKg,
        ),
        ...(nextIsFinalProduct ? { discards: [], confirmed: true } : {}),
      };
    }
    const now = new Date().toISOString();
    const flowFinished = confirm && stepIndex === terminalIndex - 1;
    const flows = before.flows.map((flow) =>
      flow.id === flowId
        ? {
            ...flow,
            steps,
            currentStepIndex: confirm ? stepIndex + 1 : stepIndex,
            status: flowFinished
              ? ("FINALIZADO" as const)
              : ("EM_EXECUCAO" as const),
            updatedAt: now,
          }
        : flow,
    );
    const allFinished =
      flows.length > 0 && flows.every((flow) => flow.status === "FINALIZADO");
    const saved = await rendimentoApi.saveTest(
      syncLegacy({
        ...before,
        status: "EM_EXECUCAO",
        flows,
        startedBy: before.startedBy,
        startedAt: before.startedAt,
        updatedAt: now,
      }),
      false,
    );
    return allFinished ? rendimentoApi.changeStatus(saved, "FINALIZAR") : saved;
  },

  async saveTracePiece(
    id: string,
    flowId: string,
    stepIndex: number,
    inputPieceOrder: number,
    input: { initialWeightKg: number; discards: TestDiscard[] },
    confirm = false,
  ) {
    const before = await rendimentoApi.getTest(id);
    const targetFlow = before.flows.find((flow) => flow.id === flowId);
    const inputPiece = before.inputPieces?.find((piece) => piece.order === inputPieceOrder);
    if (!targetFlow || !inputPiece || before.executionMode !== "traceable") return before;
    const terminalIndex = targetFlow.steps.length - 1;
    if (stepIndex < 0 || stepIndex >= terminalIndex) return before;

    const cleanWeightKg = calculateCleanWeight(input.initialWeightKg, input.discards);
    const traceItem: TraceableStepItem = {
      inputPieceId: inputPiece.id,
      inputPieceOrder,
      initialWeightKg: input.initialWeightKg,
      discards: input.discards,
      cleanWeightKg,
      confirmed: confirm,
    };
    const steps = targetFlow.steps.map((step) => ({
      ...step,
      traceItems: [...(step.traceItems || []).filter((item) => item.inputPieceOrder !== inputPieceOrder)],
    }));
    steps[stepIndex].traceItems = [...(steps[stepIndex].traceItems || []), traceItem]
      .sort((a, b) => a.inputPieceOrder - b.inputPieceOrder);

    if (confirm && steps[stepIndex + 1]) {
      const nextIsFinal = stepIndex + 1 === terminalIndex;
      const nextItem: TraceableStepItem = {
        inputPieceId: inputPiece.id,
        inputPieceOrder,
        initialWeightKg: cleanWeightKg,
        discards: [],
        cleanWeightKg,
        confirmed: nextIsFinal,
      };
      steps[stepIndex + 1].traceItems = [
        ...(steps[stepIndex + 1].traceItems || []).filter((item) => item.inputPieceOrder !== inputPieceOrder),
        nextItem,
      ].sort((a, b) => a.inputPieceOrder - b.inputPieceOrder);
    }

    const pieceOrders = before.inputPieces?.map((piece) => piece.order) || [];
    const aggregatedSteps = steps.map((step) => aggregateTraceStep(step, before.inputWeightKg, pieceOrders));
    const flowFinished = pieceOrders.length > 0 && pieceOrders.every((order) =>
      aggregatedSteps.slice(0, terminalIndex).every((item) =>
        item.traceItems?.some((trace) => trace.inputPieceOrder === order && trace.confirmed),
      ),
    );
    const firstPendingStep = aggregatedSteps.slice(0, terminalIndex).findIndex((item) => !item.confirmed);
    const now = new Date().toISOString();
    const flows = before.flows.map((flow) => flow.id === flowId ? {
      ...flow,
      steps: aggregatedSteps,
      currentStepIndex: firstPendingStep < 0 ? terminalIndex : firstPendingStep,
      status: flowFinished ? "FINALIZADO" as const : "EM_EXECUCAO" as const,
      updatedAt: now,
    } : flow);
    const allFinished = flows.length > 0 && flows.every((flow) => flow.status === "FINALIZADO");
    const saved = await rendimentoApi.saveTest(syncLegacy({
      ...before,
      status: "EM_EXECUCAO",
      flows,
      updatedAt: now,
    }), false);
    return allFinished ? rendimentoApi.changeStatus(saved, "FINALIZAR") : saved;
  },

  async saveStep(
    id: string,
    stepIndex: number,
    input: {
      initialWeightKg: number;
      pieceWeightsKg?: number[];
      discards: TestDiscard[];
    },
    confirm = false,
  ) {
    const test = await rendimentoApi.getTest(id);
    if (!test.flows[0]) return undefined;
    return this.saveFlowStep(id, test.flows[0].id, stepIndex, input, confirm);
  },

  async finalize(id: string) {
    const test = await rendimentoApi.getTest(id);
    return rendimentoApi.changeStatus(test, "FINALIZAR");
  },

  async remove(id: string) {
    const test = await rendimentoApi.getTest(id);
    if (!["RASCUNHO", "ABERTO"].includes(test.status)) return false;
    await rendimentoApi.deleteTest(test);
    return true;
  },

  async inactivate(id: string) {
    const test = await rendimentoApi.getTest(id);
    if (test.status !== "FINALIZADO") return undefined;
    return rendimentoApi.changeStatus(test, "CANCELAR");
  },

  async restore(id: string) {
    const test = await rendimentoApi.getTest(id);
    if (test.status !== "CANCELADO") return undefined;
    return rendimentoApi.changeStatus(test, "RESTAURAR");
  },

  async reopen(id: string) {
    const test = await rendimentoApi.getTest(id);
    if (test.status !== "FINALIZADO") return undefined;
    return rendimentoApi.changeStatus(test, "REABRIR");
  },
};
