import type { EscalaLinha } from "@/types/escala";

export type EscalaAnimalSex = "VACA" | "BOI";

const toFiniteNumberOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined || String(value).trim() === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const getAnimalBasePrice = (
  row: EscalaLinha,
  sex: EscalaAnimalSex,
): number | null =>
  sex === "BOI"
    ? toFiniteNumberOrNull(row.PRECO_BOI) ??
      toFiniteNumberOrNull(row.VLRUNITARIO_BOI)
    : toFiniteNumberOrNull(row.PRECO_VACA) ??
      toFiniteNumberOrNull(row.VLRUNITARIO_VACA);

export const getEffectivePremium = (row: EscalaLinha): number | null =>
  toFiniteNumberOrNull(row.VLRUNITARIO_PREMIO) ??
  toFiniteNumberOrNull(row.VALOR_PREMIO);

export const getScaleCalculationPrice = (
  row: EscalaLinha,
  sex: EscalaAnimalSex,
): number | null =>
  sex === "BOI"
    ? getEffectivePremium(row) ?? getAnimalBasePrice(row, "BOI")
    : getAnimalBasePrice(row, "VACA");

export interface ScaleMacroAverages {
  totalAnimals: number;
  totalArrobas: number;
  totalValue: number;
  averageArrobas: number | null;
  averageValue: number | null;
}

export const calculateScaleMacroAverages = (
  rows: EscalaLinha[],
): ScaleMacroAverages => {
  let totalAnimals = 0;
  let totalArrobas = 0;
  let totalValue = 0;

  for (const row of rows) {
    for (const sex of ["BOI", "VACA"] as const) {
      const quantity = Math.max(
        0,
        toFiniteNumberOrNull(sex === "BOI" ? row.QTD_BOI : row.QTD_VACA) ?? 0,
      );
      if (quantity <= 0) continue;

      const arrobas = Math.max(
        0,
        toFiniteNumberOrNull(
          sex === "BOI" ? row.ARROBAS_BOI : row.ARROBAS_VACA,
        ) ?? 0,
      );
      const unitValue = getScaleCalculationPrice(row, sex);
      const rowArrobas = quantity * arrobas;

      totalAnimals += quantity;
      totalArrobas += rowArrobas;
      totalValue += rowArrobas * Math.max(0, unitValue ?? 0);
    }
  }

  return {
    totalAnimals,
    totalArrobas,
    totalValue,
    averageArrobas: totalAnimals > 0 ? totalArrobas / totalAnimals : null,
    averageValue: totalArrobas > 0 ? totalValue / totalArrobas : null,
  };
};

export const calculateBaseWeightedPrice = (
  row: EscalaLinha,
): number | null => {
  const quantities = {
    BOI: Math.max(0, toFiniteNumberOrNull(row.QTD_BOI) ?? 0),
    VACA: Math.max(0, toFiniteNumberOrNull(row.QTD_VACA) ?? 0),
  };

  let weightedValue = 0;
  let pricedAnimals = 0;

  for (const sex of ["BOI", "VACA"] as const) {
    const quantity = quantities[sex];
    const price = getAnimalBasePrice(row, sex);
    if (quantity <= 0 || price === null || price <= 0) continue;

    weightedValue += quantity * price;
    pricedAnimals += quantity;
  }

  return pricedAnimals > 0 ? weightedValue / pricedAnimals : null;
};

export const calculateRowsWeightedBasePrice = (
  rows: EscalaLinha[],
): number | null => {
  let weightedValue = 0;
  let pricedAnimals = 0;

  for (const row of rows) {
    for (const sex of ["BOI", "VACA"] as const) {
      const quantity = Math.max(
        0,
        toFiniteNumberOrNull(
          sex === "BOI" ? row.QTD_BOI : row.QTD_VACA,
        ) ?? 0,
      );
      const price = getAnimalBasePrice(row, sex);
      if (quantity <= 0 || price === null || price <= 0) continue;

      weightedValue += quantity * price;
      pricedAnimals += quantity;
    }
  }

  return pricedAnimals > 0 ? weightedValue / pricedAnimals : null;
};
