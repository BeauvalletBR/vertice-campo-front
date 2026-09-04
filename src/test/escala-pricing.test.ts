import { describe, expect, it } from "vitest";

import {
  calculateBaseWeightedPrice,
  calculateRowsWeightedBasePrice,
  calculateScaleMacroAverages,
  getAnimalBasePrice,
  getEffectivePremium,
  getScaleCalculationPrice,
} from "@/lib/escala-pricing";
import type { EscalaLinha } from "@/types/escala";

const row = (values: Partial<EscalaLinha>): EscalaLinha =>
  values as EscalaLinha;

describe("escala pricing", () => {
  it("prioritizes the new animal price columns", () => {
    const item = row({
      PRECO_BOI: 320,
      VLRUNITARIO_BOI: 999,
      PRECO_VACA: 290,
      VLRUNITARIO_VACA: 999,
    });

    expect(getAnimalBasePrice(item, "BOI")).toBe(320);
    expect(getAnimalBasePrice(item, "VACA")).toBe(290);
  });

  it("falls back to legacy animal prices for old records", () => {
    const item = row({ VLRUNITARIO_BOI: 315, VLRUNITARIO_VACA: 285 });

    expect(getAnimalBasePrice(item, "BOI")).toBe(315);
    expect(getAnimalBasePrice(item, "VACA")).toBe(285);
  });

  it("calculates only-boi and only-vaca prices", () => {
    expect(calculateBaseWeightedPrice(row({ QTD_BOI: 100, PRECO_BOI: 320 }))).toBe(320);
    expect(calculateBaseWeightedPrice(row({ QTD_VACA: 100, PRECO_VACA: 290 }))).toBe(290);
  });

  it("weights mixed animal prices by their quantities", () => {
    const item = row({
      QTD_BOI: 100,
      PRECO_BOI: 320,
      QTD_VACA: 50,
      PRECO_VACA: 290,
    });

    expect(calculateBaseWeightedPrice(item)).toBe(310);
    expect(calculateRowsWeightedBasePrice([item])).toBe(310);
  });

  it("keeps premium separate and prioritizes a manual override", () => {
    const automatic = row({
      QTD_BOI: 100,
      PRECO_BOI: 320,
      VALOR_PREMIO: 5,
    });
    const overridden = row({ VALOR_PREMIO: 5, VLRUNITARIO_PREMIO: 7 });

    expect(calculateBaseWeightedPrice(automatic)).toBe(320);
    expect(getEffectivePremium(automatic)).toBe(5);
    expect(getEffectivePremium(overridden)).toBe(7);
  });

  it("uses the bull price when premium is not available", () => {
    const withoutPremium = row({ PRECO_BOI: 320 });
    const withPremium = row({ PRECO_BOI: 320, VLRUNITARIO_PREMIO: 7 });

    expect(getScaleCalculationPrice(withoutPremium, "BOI")).toBe(320);
    expect(getScaleCalculationPrice(withPremium, "BOI")).toBe(7);
  });

  it("ignores invalid prices without turning them into zero-priced animals", () => {
    const item = row({
      QTD_BOI: 100,
      PRECO_BOI: null,
      QTD_VACA: 50,
      PRECO_VACA: 290,
    });

    expect(calculateBaseWeightedPrice(item)).toBe(290);
  });

  it("does not include zero-priced animals in the weighted denominator", () => {
    const item = row({
      QTD_BOI: 100,
      PRECO_BOI: 0,
      QTD_VACA: 50,
      PRECO_VACA: 290,
    });

    expect(calculateBaseWeightedPrice(item)).toBe(290);
  });

  it("calculates scale macros with the same arroba logic used by the spreadsheet", () => {
    const item = row({
      QTD_BOI: 20,
      ARROBAS_BOI: 20,
      VLRUNITARIO_PREMIO: 7,
      QTD_VACA: 10,
      ARROBAS_VACA: 14,
      PRECO_VACA: 280,
    });

    expect(calculateScaleMacroAverages([item])).toEqual({
      totalAnimals: 30,
      totalArrobas: 540,
      totalValue: 42000,
      averageArrobas: 18,
      averageValue: 42000 / 540,
    });
  });

  it("includes the bull base price in macros when premium is null", () => {
    const item = row({
      QTD_BOI: 20,
      ARROBAS_BOI: 20,
      PRECO_BOI: 320,
      VLRUNITARIO_PREMIO: null,
      VALOR_PREMIO: null,
    });

    expect(calculateScaleMacroAverages([item])).toEqual({
      totalAnimals: 20,
      totalArrobas: 400,
      totalValue: 128000,
      averageArrobas: 20,
      averageValue: 320,
    });
  });
});
