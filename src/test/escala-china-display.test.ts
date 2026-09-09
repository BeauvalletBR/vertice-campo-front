import { describe, expect, it } from "vitest";

import {
  getPlanningChinaDivergence,
  hasStoredPlanningChinaQuantity,
} from "@/lib/escala-planning";
import type { EscalaLinha } from "@/types/escala";

const row = (overrides: Partial<EscalaLinha>): EscalaLinha =>
  ({
    ORIGEM_REGISTRO: "ERP",
    ID_ESCALA_PEDIDO_VINCULO: null,
    QTD_CHINA_VACA: null,
    QTD_CHINA_BOI: null,
    ...overrides,
  }) as EscalaLinha;

describe("planning China stored values", () => {
  it("prioritizes a manually entered quantity on a linked order", () => {
    expect(
      hasStoredPlanningChinaQuantity(
        row({ ID_ESCALA_PEDIDO_VINCULO: 10, QTD_CHINA_BOI: 7 }),
        "BOI",
      ),
    ).toBe(true);
  });

  it("recognizes a confirmed zero as a stored quantity", () => {
    expect(
      hasStoredPlanningChinaQuantity(
        row({ ID_ESCALA_PEDIDO_VINCULO: 10, QTD_CHINA_VACA: 0 }),
        "VACA",
      ),
    ).toBe(true);
  });

  it("keeps zero available as a suggestion before the order is linked", () => {
    expect(
      hasStoredPlanningChinaQuantity(row({ QTD_CHINA_BOI: 0 }), "BOI"),
    ).toBe(false);
  });
});

describe("planning China divergence", () => {
  it("detects a stored quantity that no longer matches the current order", () => {
    expect(
      getPlanningChinaDivergence({
        animalQuantity: 120,
        storedChinaQuantity: 20,
        suggestedChinaQuantity: 24,
        hasStoredQuantity: true,
      }),
    ).toEqual({
      storedQuantity: 20,
      suggestedQuantity: 24,
      difference: 4,
      storedPercent: 20 / 120,
    });
  });

  it("does not warn when the confirmed quantity still matches", () => {
    expect(
      getPlanningChinaDivergence({
        animalQuantity: 120,
        storedChinaQuantity: 24,
        suggestedChinaQuantity: 24,
        hasStoredQuantity: true,
      }),
    ).toBeNull();
  });

  it("does not compare values that have not been confirmed", () => {
    expect(
      getPlanningChinaDivergence({
        animalQuantity: 120,
        storedChinaQuantity: 0,
        suggestedChinaQuantity: 24,
        hasStoredQuantity: false,
      }),
    ).toBeNull();
  });
});
