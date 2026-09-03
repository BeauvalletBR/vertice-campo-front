import { describe, expect, it } from "vitest";

import { calculatePlanningTotals } from "@/lib/escala-planning";
import type { EscalaLinha } from "@/types/escala";

const createRow = (overrides: Partial<EscalaLinha>): EscalaLinha =>
  ({
    ORIGEM_REGISTRO: "ERP",
    STATUS_CONFIGURACAO: "COMPLETO",
    NROEMPRESA: 1,
    ...overrides,
  }) as EscalaLinha;

describe("planning totals", () => {
  it("divide a quantidade somente pelos dias distintos com animais", () => {
    const totals = calculatePlanningTotals([
      createRow({ ID_PLANEJAMENTO: "1", DATA_ABATE: "2026-08-31", QTD_BOI: 20 }),
      createRow({ ID_PLANEJAMENTO: "2", DATA_ABATE: "2026-08-31", QTD_BOI: 10 }),
      createRow({ ID_PLANEJAMENTO: "3", DATA_ABATE: "2026-09-02", QTD_VACA: 30 }),
      createRow({ ID_PLANEJAMENTO: "4", DATA_ABATE: "2026-09-04", QTD_BOI: 30 }),
    ]);

    expect(totals.daysWithAnimals).toBe(3);
    expect(totals.plannedHeads).toBe(90);
    expect(totals.averageHeadsPerDay).toBe(30);
  });

  it("calcula o valor médio com a mesma regra de prêmio e arrobas do Excel", () => {
    const totals = calculatePlanningTotals([
      createRow({
        ID_PLANEJAMENTO: "1",
        DATA_ABATE: "2026-08-31",
        QTD_BOI: 20,
        ARROBAS_BOI: 20,
        PRECO_BOI: 320,
        VLRUNITARIO_PREMIO: 7,
        QTD_VACA: 10,
        ARROBAS_VACA: 14,
        PRECO_VACA: 280,
      }),
    ]);

    expect(totals.averagePaid).toBe(42_000 / 540);
  });
});
