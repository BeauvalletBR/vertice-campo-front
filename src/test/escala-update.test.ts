import { describe, expect, it } from "vitest";

import {
  buildWeekOptions,
  getAgrotoolsPlannedQuantity,
  getAgrotoolsPlannedTotal,
  getInitialPlanningWeek,
} from "@/lib/escala-planning";
import { buildOrderUpdatePayload } from "@/lib/escala-update";
import type { EscalaLinha } from "@/types/escala";

const createRow = (overrides: Partial<EscalaLinha> = {}): EscalaLinha => ({
  ORIGEM_REGISTRO: "ERP",
  ID_PLANEJAMENTO: "ERP-1",
  NROEMPRESA: 1,
  DATA_ABATE: "2026-08-31",
  STATUS_CONFIGURACAO: "COMPLETO",
  ...overrides,
});

describe("escala update safety", () => {
  it("altera China sem apagar os demais dados do vínculo", () => {
    const row = createRow({
      ID_ESCALA_PEDIDO_VINCULO: 77,
      VERSAO_REGISTRO: 4,
      ID_COMPRADOR_ESCALA: 123,
      COMPRADOR_ESCALA: "João",
      VLRUNITARIO_PREMIO: 5,
      PRAZO_DIAS: 30,
      CURRAL: 8,
      ARROBAS_VACA: 14,
      ARROBAS_BOI: 20,
      QTD_CHINA_VACA: 10,
      QTD_CHINA_BOI: 20,
      QTD_VACA: 12,
      QTD_BOI: 18,
      QTD_AGROTOOLS_VACA: 7,
      QTD_AGROTOOLS_BOI: 9,
      OBSERVACAO_PEDIDO_ESCALA: "Manter observação",
    });

    const payload = buildOrderUpdatePayload(row, 1, {
      qtd_china_vaca: 15,
      qtd_china_boi: 15,
    });

    expect(payload).toMatchObject({
      id_comprador: 123,
      vlrunitario_premio: 5,
      prazo_dias: 30,
      curral: 8,
      arrobas_vaca: 14,
      arrobas_boi: 20,
      qtd_china_vaca: 15,
      qtd_china_boi: 15,
      qtd_agrotools_vaca: 12,
      qtd_agrotools_boi: 18,
      observacao: "Manter observação",
    });
  });

  it("usa o comprador automatico do ERP quando o codigo e maior que um", () => {
    const row = createRow({
      ID_ESCALA_PEDIDO_VINCULO: 78,
      VERSAO_REGISTRO: 2,
      SEQCOMPRADOR_ERP: 45,
      COMPRADOR_ERP: "COMPRADOR AUTOMATICO",
      ID_COMPRADOR_ESCALA: null,
      COMPRADOR_ESCALA: null,
      PRAZO_DIAS: null,
      CURRAL: null,
    });

    expect(buildOrderUpdatePayload(row, 1)).toMatchObject({
      id_comprador: 45,
      comprador_nome_snapshot: "COMPRADOR AUTOMATICO",
      prazo_dias: null,
      curral: null,
    });
  });
});

describe("initial planning week", () => {
  const referenceDate = new Date(2026, 7, 31, 12);

  it("abre a próxima semana quando ela possui pedido", () => {
    const rows = [
      createRow({ DATA_ABATE: "2026-08-31", QTD_BOI: 20 }),
      createRow({
        ID_PLANEJAMENTO: "ERP-2",
        DATA_ABATE: "2026-09-07",
        QTD_BOI: 30,
      }),
    ];

    expect(getInitialPlanningWeek(rows, referenceDate)).toBe("2026-W37");
  });

  it("permanece na semana atual quando a próxima está vazia", () => {
    expect(
      getInitialPlanningWeek(
        [createRow({ DATA_ABATE: "2026-08-31", QTD_BOI: 20 })],
        referenceDate,
      ),
    ).toBe("2026-W36");
  });

  it("considera registro manual válido na próxima semana", () => {
    const manualRow = createRow({
      ORIGEM_REGISTRO: "MANUAL",
      ID_PLANEJAMENTO: "MANUAL-1",
      DATA_ABATE: "2026-09-10",
      QTD_VACA: 15,
    });

    expect(getInitialPlanningWeek([manualRow], referenceDate)).toBe("2026-W37");
  });

  it("ignora a proxima semana quando ela nao possui animais", () => {
    const emptyNextWeek = createRow({ DATA_ABATE: "2026-09-07" });

    expect(getInitialPlanningWeek([emptyNextWeek], referenceDate)).toBe(
      "2026-W36",
    );
  });
});

describe("planning Agrotools quantities", () => {
  it("acompanha a quantidade atual quando ja existe Agrotools salvo", () => {
    const row = createRow({
      QTD_VACA: 40,
      QTD_BOI: 65,
      QTD_AGROTOOLS_VACA: 50,
      QTD_AGROTOOLS_BOI: 50,
    });

    expect(getAgrotoolsPlannedQuantity(row, "VACA")).toBe(40);
    expect(getAgrotoolsPlannedQuantity(row, "BOI")).toBe(65);
    expect(getAgrotoolsPlannedTotal(row)).toBe(105);
  });

  it("mantem zero quando o sexo ainda nao possui Agrotools salvo", () => {
    const row = createRow({
      QTD_VACA: 40,
      QTD_BOI: 65,
      QTD_AGROTOOLS_VACA: 0,
      QTD_AGROTOOLS_BOI: null,
    });

    expect(getAgrotoolsPlannedTotal(row)).toBe(0);
  });
});

describe("planning week options", () => {
  it("nao inclui a proxima semana vazia no filtro", () => {
    const options = buildWeekOptions(
      [
        {
          NROEMPRESA: 1,
          DATA_ABATE: "2026-08-31",
          QTD_TOTAL_PLANEJADO: 100,
        },
        {
          NROEMPRESA: 1,
          DATA_ABATE: "2026-09-07",
          QTD_TOTAL_PLANEJADO: 0,
        },
      ],
      "2026-W37",
      "2026-W36",
    );

    expect(options.map((option) => option.key)).toEqual(["2026-W36"]);
  });
});
