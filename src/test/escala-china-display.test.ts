import { describe, expect, it } from "vitest";

import { hasStoredPlanningChinaQuantity } from "@/lib/escala-planning";
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
