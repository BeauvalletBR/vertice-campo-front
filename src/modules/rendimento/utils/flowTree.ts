import type { TestStep } from "../types/domain";

export const stepChildren = (steps: TestStep[], stepId: string) =>
  steps
    .filter((step) => step.parentStepId === stepId)
    .sort((a, b) => a.branchOrder - b.branchOrder);

export const isBranchedFlow = (steps: TestStep[]) =>
  steps.some((step) => stepChildren(steps, step.id).length > 1);

export const isLeafStep = (steps: TestStep[], stepId: string) =>
  !steps.some((step) => step.parentStepId === stepId);

export const stepDepth = (steps: TestStep[], step: TestStep) => {
  let depth = 0;
  let parentId = step.parentStepId;
  const visited = new Set<string>();
  while (parentId && !visited.has(parentId)) {
    visited.add(parentId);
    depth += 1;
    parentId = steps.find((candidate) => candidate.id === parentId)?.parentStepId || null;
  }
  return depth;
};

export const orderTreeSteps = (steps: TestStep[]) => {
  const ordered: TestStep[] = [];
  const visit = (step: TestStep) => {
    if (ordered.some((item) => item.id === step.id)) return;
    ordered.push(step);
    stepChildren(steps, step.id).forEach(visit);
  };
  steps.filter((step) => !step.parentStepId).sort((a, b) => a.branchOrder - b.branchOrder).forEach(visit);
  steps.forEach(visit);
  return ordered;
};

export const validateBranchBalance = (
  steps: TestStep[],
  weightFor: (step: TestStep) => number,
  tolerance = 0.005,
) => {
  for (const parent of steps) {
    const children = stepChildren(steps, parent.id);
    if (children.length < 2) continue;
    const distributed = children.reduce((sum, child) => sum + weightFor(child), 0);
    if (distributed > parent.cleanWeightKg + tolerance) {
      return `As saídas ultrapassam o peso líquido de ${parent.productId}.`;
    }
  }
  return "";
};
