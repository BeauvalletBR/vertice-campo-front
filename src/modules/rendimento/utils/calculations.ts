import type { TestDiscard } from "../types/domain";

export const round3 = (value: number) => Math.round((value + Number.EPSILON) * 1000) / 1000;

export const calculateAverageWeight = (weight: number, quantity: number) =>
  quantity > 0 ? round3(weight / quantity) : 0;

export const calculateTotalDiscard = (discards: TestDiscard[]) =>
  round3(discards.reduce((total, discard) => total + Math.max(0, discard.weightKg || 0), 0));

export const consolidateDiscards = (discards: TestDiscard[]) => {
  const consolidated = new Map<string, TestDiscard>();
  discards.forEach((discard) => {
    if (discard.weightKg <= 0) return;
    const key = discard.name.trim().toLocaleUpperCase("pt-BR");
    const current = consolidated.get(key);
    if (current) {
      current.weightKg = round3(current.weightKg + discard.weightKg);
      return;
    }
    consolidated.set(key, { ...discard });
  });
  return [...consolidated.values()];
};

export const calculateCleanWeight = (initialWeight: number, discards: TestDiscard[]) =>
  round3(Math.max(0, initialWeight - calculateTotalDiscard(discards)));

export const calculateYield = (finalWeight: number, initialWeight: number) =>
  initialWeight > 0 ? round3((finalWeight / initialWeight) * 100) : 0;

export const calculateInputYield = (weight: number, inputWeight: number) =>
  inputWeight > 0 ? round3((weight / inputWeight) * 100) : 0;
