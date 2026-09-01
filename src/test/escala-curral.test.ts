import { describe, expect, it } from "vitest";

import {
  ESCALA_DAILY_CURRAL_LIMIT,
  getPlanningCurralTotal,
  getProjectedPlanningCurralTotal,
} from "@/lib/escala-planning";
import type { EscalaLinha } from "@/types/escala";

const row = (id: string, curral: number): EscalaLinha =>
  ({
    ID_PLANEJAMENTO: id,
    CURRAL: curral,
  }) as EscalaLinha;

describe("daily scale curral capacity", () => {
  it("does not count the same planning record twice", () => {
    expect(
      getPlanningCurralTotal([row("PEDIDO-1", 10), row("PEDIDO-1", 10), row("PEDIDO-2", 9)]),
    ).toBe(19);
  });

  it("replaces the edited value when calculating the projected total", () => {
    const rows = [row("PEDIDO-1", 10), row("PEDIDO-2", 9)];
    const projectedTotal = getProjectedPlanningCurralTotal(rows, 10, 13);

    expect(projectedTotal).toBe(22);
    expect(projectedTotal).toBeGreaterThan(ESCALA_DAILY_CURRAL_LIMIT);
  });
});
