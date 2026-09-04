import { describe, expect, it } from "vitest";

import {
  buildScaleExcelReportLines,
  calculateScaleExcelLineTotals,
  countScaleExcelDaysWithAnimals,
} from "@/lib/escala-excel";
import type { EscalaLinha } from "@/types/escala";

const createRow = (overrides: Partial<EscalaLinha> = {}): EscalaLinha => ({
  ORIGEM_REGISTRO: "ERP",
  ID_PLANEJAMENTO: "ERP-100",
  NROEMPRESA: 1,
  DATA_ABATE: "2026-08-31",
  STATUS_CONFIGURACAO: "COMPLETO",
  NROPEDIDO: 100,
  PRODUTOR: "PECUARISTA TESTE",
  ...overrides,
});

describe("escala excel", () => {
  it("separa vaca e boi do mesmo pedido em linhas distintas", () => {
    const lines = buildScaleExcelReportLines([
      createRow({
        QTD_VACA: 50,
        ARROBAS_VACA: 14,
        PRECO_VACA: 280,
        QTD_BOI: 100,
        ARROBAS_BOI: 20,
        VLRUNITARIO_PREMIO: 7,
      }),
    ]);

    expect(lines).toEqual([
      expect.objectContaining({
        sex: "VACA",
        animals: 50,
        arrobasPerAnimal: 14,
        unitPrice: 280,
      }),
      expect.objectContaining({
        sex: "BOI",
        animals: 100,
        arrobasPerAnimal: 20,
        unitPrice: 7,
      }),
    ]);
  });

  it("usa o valor do boi no Excel quando o prêmio não foi informado", () => {
    const lines = buildScaleExcelReportLines([
      createRow({
        QTD_BOI: 100,
        ARROBAS_BOI: 20,
        PRECO_BOI: 320,
        VLRUNITARIO_PREMIO: null,
        VALOR_PREMIO: null,
      }),
    ]);

    expect(lines).toEqual([
      expect.objectContaining({
        sex: "BOI",
        animals: 100,
        unitPrice: 320,
      }),
    ]);
  });

  it("calcula quantidade de arrobas e R$ usando os dados de cada sexo", () => {
    const lines = buildScaleExcelReportLines([
      createRow({
        QTD_VACA: 50,
        ARROBAS_VACA: 14,
        PRECO_VACA: 280,
        QTD_BOI: 100,
        ARROBAS_BOI: 20,
        VLRUNITARIO_PREMIO: 7,
      }),
    ]);

    expect(calculateScaleExcelLineTotals(lines[0])).toEqual({
      totalArrobas: 700,
      totalValue: 196_000,
    });
    expect(calculateScaleExcelLineTotals(lines[1])).toEqual({
      totalArrobas: 2_000,
      totalValue: 14_000,
    });
  });

  it("conta somente as datas distintas que possuem animais", () => {
    const lines = buildScaleExcelReportLines([
      createRow({ NROPEDIDO: 100, DATA_ABATE: "2026-08-31", QTD_BOI: 20 }),
      createRow({
        ID_PLANEJAMENTO: "ERP-101",
        NROPEDIDO: 101,
        DATA_ABATE: "2026-08-31",
        QTD_VACA: 10,
      }),
      createRow({
        ID_PLANEJAMENTO: "ERP-102",
        NROPEDIDO: 102,
        DATA_ABATE: "2026-09-02",
        QTD_BOI: 30,
      }),
    ]);

    expect(countScaleExcelDaysWithAnimals(lines)).toBe(2);
  });
});
