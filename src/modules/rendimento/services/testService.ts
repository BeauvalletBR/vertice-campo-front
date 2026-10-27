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
  calculateTotalDiscard,
  calculateYield,
  resolveTraceInitialWeight,
} from "../utils/calculations";
import { rendimentoApi } from "./rendimentoApi";
import { isBranchedFlow, orderTreeSteps, stepChildren } from "../utils/flowTree";

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
  nodes: NonNullable<TestFlowSetupInput["nodes"]>,
  firstStepWeightKg: number,
  inputWeightKg: number,
  products: Product[],
  types: DiscardType[],
): TestStep[] {
  return nodes.map((node, index) => ({
    id: node.id || temporaryId("step"),
    parentStepId: node.parentNodeId,
    branchOrder: node.branchOrder,
    productId: node.productId,
    initialWeightKg: index === 0 ? firstStepWeightKg : 0,
    discards:
      nodes.some((candidate) => candidate.parentNodeId === node.id)
        ? blankDiscards(node.productId, products, types)
        : [],
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
  const nodes = input.nodes?.length
    ? input.nodes
    : input.productIds.map((productId, index) => ({
        id: before?.steps[index]?.id || temporaryId("step"),
        productId,
        parentNodeId: index > 0 ? before?.steps[index - 1]?.id || null : null,
        branchOrder: 1,
      }));
  const topology = nodes.map((node) => `${node.id}:${node.productId}:${node.parentNodeId || "root"}:${node.branchOrder}`).join("|");
  const previousTopology = before?.steps.map((step) => `${step.id}:${step.productId}:${step.parentStepId || "root"}:${step.branchOrder}`).join("|");
  const sequenceChanged =
    !before ||
    previousTopology !== topology ||
    Math.abs(
      (before.steps[0]?.initialWeightKg || 0) - input.firstStepWeightKg,
    ) > 0.0001;
  const steps = sequenceChanged
    ? newSteps(
        nodes,
        input.firstStepWeightKg,
        inputWeightKg,
        products,
        types,
      ).map((freshStep, index) => {
        const savedStep = before?.steps.find(
          (step) => step.id === freshStep.id || (
            step.productId === freshStep.productId &&
            step.parentStepId === freshStep.parentStepId
          ),
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
    productIds: nodes.map((node) => node.productId),
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
  history: (limit = 300) => rendimentoApi.listTestHistory(limit),
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
      executionMode: input.executionMode || before?.executionMode || "traceable",
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
    const branched = isBranchedFlow(targetFlow.steps);
    if (stepIndex < 0 || stepIndex >= targetFlow.steps.length || (!branched && stepIndex >= terminalIndex)) return before;
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
    const children = stepChildren(steps, step.id);
    if (confirm && children.length === 1) {
      const childIndex = steps.findIndex((candidate) => candidate.id === children[0].id);
      const nextIsFinalProduct = !branched && childIndex === terminalIndex;
      steps[childIndex] = {
        ...steps[childIndex],
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
    const firstPendingStep = steps.findIndex((item) => !item.confirmed);
    const flowFinished = branched
      ? steps.length > 0 && steps.every((item) => item.confirmed)
      : confirm && stepIndex === terminalIndex - 1;
    const flows = before.flows.map((flow) =>
      flow.id === flowId
        ? {
            ...flow,
            steps,
            currentStepIndex: confirm ? (firstPendingStep < 0 ? steps.length - 1 : firstPendingStep) : stepIndex,
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
    flowRootProductId: string,
    stepIndex: number,
    inputPieceOrder: number,
    input: { initialWeightKg: number; discards: TestDiscard[] },
    confirm = false,
  ) {
    const before = await rendimentoApi.getTest(id);
    const targetFlow = before.flows.find((flow) => flow.id === flowId)
      || before.flows.find((flow) => flow.rootProductId === flowRootProductId);
    const inputPiece = before.inputPieces?.find((piece) => piece.order === inputPieceOrder);
    if (!targetFlow || !inputPiece || before.executionMode !== "traceable") return before;
    const terminalIndex = targetFlow.steps.length - 1;
    const branched = isBranchedFlow(targetFlow.steps);
    if (stepIndex < 0 || stepIndex >= targetFlow.steps.length || (!branched && stepIndex >= terminalIndex)) return before;

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
      traceItems: [...(step.traceItems || [])],
    }));
    steps[stepIndex].traceItems = [
      ...(steps[stepIndex].traceItems || []).filter((item) => item.inputPieceOrder !== inputPieceOrder),
      traceItem,
    ]
      .sort((a, b) => a.inputPieceOrder - b.inputPieceOrder);

    const children = stepChildren(steps, steps[stepIndex].id);
    if (confirm && children.length === 1) {
      const childIndex = steps.findIndex((step) => step.id === children[0].id);
      const nextIsFinal = !branched && childIndex === terminalIndex;
      const existingNext = steps[childIndex].traceItems?.find(
        (item) => item.inputPieceOrder === inputPieceOrder,
      );
      const nextWeight = nextIsFinal
        ? cleanWeightKg
        : existingNext?.initialWeightKg || cleanWeightKg;
      const nextDiscards = nextIsFinal ? [] : existingNext?.discards || [];
      const nextItem: TraceableStepItem = existingNext
        ? {
            ...existingNext,
            initialWeightKg: nextWeight,
            discards: nextDiscards,
            cleanWeightKg: calculateCleanWeight(nextWeight, nextDiscards),
            confirmed: nextIsFinal || existingNext.confirmed,
          }
        : {
            inputPieceId: inputPiece.id,
            inputPieceOrder,
            initialWeightKg: nextWeight,
            discards: nextDiscards,
            cleanWeightKg: calculateCleanWeight(nextWeight, nextDiscards),
            confirmed: nextIsFinal,
          };
      steps[childIndex].traceItems = [
        ...(steps[childIndex].traceItems || []).filter((item) => item.inputPieceOrder !== inputPieceOrder),
        nextItem,
      ].sort((a, b) => a.inputPieceOrder - b.inputPieceOrder);
    }

    const pieceOrders = before.inputPieces?.map((piece) => piece.order) || [];
    let aggregatedSteps = steps.map((step) => aggregateTraceStep(step, before.inputWeightKg, pieceOrders));
    const requiredSteps = branched ? aggregatedSteps : aggregatedSteps.slice(0, terminalIndex);
    const flowFinished = pieceOrders.length > 0 && pieceOrders.every((order) =>
      requiredSteps.every((item) =>
        item.traceItems?.some((trace) => trace.inputPieceOrder === order && trace.confirmed),
      ),
    );
    if (!branched && flowFinished && terminalIndex > 0) {
      const previousStep = aggregatedSteps[terminalIndex - 1];
      const terminalStep = aggregatedSteps[terminalIndex];
      const terminalItems = pieceOrders.map((order) => {
        const previous = previousStep.traceItems?.find((item) => item.inputPieceOrder === order);
        const existing = terminalStep.traceItems?.find((item) => item.inputPieceOrder === order);
        const finalWeight = previous?.cleanWeightKg || existing?.initialWeightKg || 0;
        return {
          ...(existing || {
            inputPieceId: previous?.inputPieceId || before.inputPieces?.find((piece) => piece.order === order)?.id || "",
            inputPieceOrder: order,
            discards: [],
          }),
          initialWeightKg: finalWeight,
          discards: [],
          cleanWeightKg: finalWeight,
          confirmed: true,
        } as TraceableStepItem;
      });
      aggregatedSteps = aggregatedSteps.map((step, index) => index === terminalIndex
        ? aggregateTraceStep({ ...step, traceItems: terminalItems }, before.inputWeightKg, pieceOrders)
        : step);
    }
    const firstPendingStep = (branched ? aggregatedSteps : aggregatedSteps.slice(0, terminalIndex)).findIndex((item) => !item.confirmed);
    const now = new Date().toISOString();
    const flows = before.flows.map((flow) => flow.id === targetFlow.id ? {
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

  async saveTracePiecesBatch(
    id: string,
    flowId: string,
    flowRootProductId: string,
    pieces: Array<{
      inputPieceOrder: number;
      inputs: Array<{
        stepId: string;
        stepIndex?: number;
        initialWeightKg: number;
        discards: TestDiscard[];
      }>;
    }>,
  ) {
    const before = await rendimentoApi.getTest(id);
    const targetFlow = before.flows.find((flow) => flow.id === flowId)
      || before.flows.find((flow) => flow.rootProductId === flowRootProductId);
    if (!targetFlow || before.executionMode !== "traceable") return before;

    const terminalIndex = targetFlow.steps.length - 1;
    const branched = isBranchedFlow(targetFlow.steps);
    let steps = targetFlow.steps.map((step) => ({
      ...step,
      traceItems: [...(step.traceItems || [])],
    }));

    for (const piece of pieces) {
      const inputPiece = before.inputPieces?.find((item) => item.order === piece.inputPieceOrder);
      if (!inputPiece) continue;
      for (const input of piece.inputs) {
        const stepIndex = input.stepIndex ?? steps.findIndex((step) => step.id === input.stepId);
        if (stepIndex < 0 || stepIndex >= steps.length || (!branched && stepIndex >= terminalIndex)) continue;
        const cleanWeightKg = calculateCleanWeight(input.initialWeightKg, input.discards);
        const traceItem: TraceableStepItem = {
          inputPieceId: inputPiece.id,
          inputPieceOrder: piece.inputPieceOrder,
          initialWeightKg: input.initialWeightKg,
          discards: input.discards,
          cleanWeightKg,
          confirmed: true,
        };
        steps[stepIndex].traceItems = [
          ...(steps[stepIndex].traceItems || []).filter(
            (item) => item.inputPieceOrder !== piece.inputPieceOrder,
          ),
          traceItem,
        ].sort((a, b) => a.inputPieceOrder - b.inputPieceOrder);
      }
    }

    const pieceOrders = before.inputPieces?.map((piece) => piece.order) || [];
    let aggregatedSteps = steps.map((step) =>
      aggregateTraceStep(step, before.inputWeightKg, pieceOrders),
    );
    const requiredSteps = branched ? aggregatedSteps : aggregatedSteps.slice(0, terminalIndex);
    const flowFinished = pieceOrders.length > 0 && pieceOrders.every((order) =>
      requiredSteps.every((step) =>
        step.traceItems?.some((trace) => trace.inputPieceOrder === order && trace.confirmed),
      ),
    );

    if (!branched && flowFinished && terminalIndex > 0) {
      const previousStep = aggregatedSteps[terminalIndex - 1];
      const terminalStep = aggregatedSteps[terminalIndex];
      const terminalItems = pieceOrders.map((order) => {
        const previous = previousStep.traceItems?.find((item) => item.inputPieceOrder === order);
        const existing = terminalStep.traceItems?.find((item) => item.inputPieceOrder === order);
        const finalWeight = previous?.cleanWeightKg || existing?.initialWeightKg || 0;
        return {
          ...(existing || {
            inputPieceId: previous?.inputPieceId
              || before.inputPieces?.find((piece) => piece.order === order)?.id
              || "",
            inputPieceOrder: order,
            discards: [],
          }),
          initialWeightKg: finalWeight,
          discards: [],
          cleanWeightKg: finalWeight,
          confirmed: true,
        } as TraceableStepItem;
      });
      aggregatedSteps = aggregatedSteps.map((step, index) => index === terminalIndex
        ? aggregateTraceStep({ ...step, traceItems: terminalItems }, before.inputWeightKg, pieceOrders)
        : step);
    }

    const firstPendingStep = requiredSteps.findIndex((step) => !step.confirmed);
    const now = new Date().toISOString();
    const flows = before.flows.map((flow) => flow.id === targetFlow.id ? {
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

  async saveTracePieceBatch(
    id: string,
    flowId: string,
    flowRootProductId: string,
    inputPieceOrder: number,
    inputs: Array<{
      stepId: string;
      stepIndex?: number;
      initialWeightKg: number;
      discards: TestDiscard[];
    }>,
  ) {
    return this.saveTracePiecesBatch(id, flowId, flowRootProductId, [{ inputPieceOrder, inputs }]);
  },

  async finalizeTraceableTest(id: string) {
    let current = await rendimentoApi.getTest(id);
    if (current.executionMode !== "traceable") return current;
    const flowRoots = current.flows.map((flow) => flow.rootProductId);
    const pieceOrders = current.inputPieces?.map((piece) => piece.order) || [];

    for (const flowRootProductId of flowRoots) {
      for (const inputPieceOrder of pieceOrders) {
        const initialFlow = current.flows.find((flow) => flow.rootProductId === flowRootProductId);
        const ordered = initialFlow ? orderTreeSteps(initialFlow.steps) : [];
        const operations = initialFlow && isBranchedFlow(initialFlow.steps) ? ordered : ordered.slice(0, -1);
        for (const initialStep of operations) {
          const liveFlow = current.flows.find((flow) => flow.rootProductId === flowRootProductId);
          const stepIndex = liveFlow?.steps.findIndex((item) => item.id === initialStep.id) ?? -1;
          const step = stepIndex >= 0 ? liveFlow?.steps[stepIndex] : undefined;
          if (!liveFlow || !step) throw new Error("Fluxo rastreável não encontrado para finalização.");
          const parentStep = step.parentStepId ? liveFlow.steps.find((item) => item.id === step.parentStepId) : undefined;
          const canInheritParent = parentStep ? stepChildren(liveFlow.steps, parentStep.id).length === 1 : false;
          const onlyChild = stepChildren(liveFlow.steps, step.id).length === 1 ? stepChildren(liveFlow.steps, step.id)[0] : undefined;
          const trace = step.traceItems?.find((item) => item.inputPieceOrder === inputPieceOrder);
          const previousTrace = canInheritParent
            ? parentStep?.traceItems?.find((item) => item.inputPieceOrder === inputPieceOrder)
            : undefined;
          const nextTrace = onlyChild?.traceItems?.find((item) => item.inputPieceOrder === inputPieceOrder);
          const discards = trace?.discards || [];
          const weight = resolveTraceInitialWeight({
            currentWeight: trace?.initialWeightKg || 0,
            previousCleanWeight: previousTrace?.cleanWeightKg || 0,
            nextWeight: nextTrace?.initialWeightKg || 0,
            currentDiscards: discards,
          });
          if (weight <= 0) throw new Error(`Peça ${inputPieceOrder}: informe o peso da etapa ${stepIndex + 1}.`);
          if (calculateTotalDiscard(discards) >= weight) throw new Error(`Peça ${inputPieceOrder}: os descartes da etapa ${stepIndex + 1} devem ser menores que o peso.`);
          current = await this.saveTracePiece(
            id,
            liveFlow.id,
            flowRootProductId,
            stepIndex,
            inputPieceOrder,
            { initialWeightKg: weight, discards },
            true,
          );
          if (current.status === "FINALIZADO") return current;
        }
      }
    }

    if (current.status === "FINALIZADO") return current;
    current = await rendimentoApi.getTest(id);
    const pending = current.flows.flatMap((flow, flowIndex) => flow.steps
      .map((step, stepIndex) => ({ flowIndex, stepIndex, step }))
      .filter((item) => !item.step.confirmed));
    if (pending.length > 0) {
      const details = pending
        .map((item) => `grupo ${item.flowIndex + 1}, etapa ${item.stepIndex + 1}`)
        .join("; ");
      throw new Error(`Não foi possível finalizar. Etapas ainda pendentes: ${details}.`);
    }
    return rendimentoApi.changeStatus(current, "FINALIZAR");
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
    if (!["RASCUNHO", "ABERTO", "EM_EXECUCAO"].includes(test.status)) {
      throw new Error("Somente testes pendentes podem ser apagados.");
    }
    await rendimentoApi.deleteTest(test);
    return true;
  },

  async removeInactive() {
    return rendimentoApi.deleteInactiveTests();
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
