import { describe, expect, it } from "vitest";

import {
  createPaymentTermMap,
  getEffectivePaymentTermDays,
  getMappedPaymentTerm,
} from "@/lib/escala-prazo";
import { buildOrderUpdatePayload } from "@/lib/escala-update";
import type { EscalaLinha, PrazoPagamento } from "@/types/escala";

const paymentTerms: PrazoPagamento[] = [
  { CODCONDPAGTO: 20, DESCRICAO: "30 DIAS", PRAZO: 30 },
  { CODCONDPAGTO: 1, DESCRICAO: "À VISTA", PRAZO: 0 },
];

const paymentTermsByCode = createPaymentTermMap(paymentTerms);

const createRow = (overrides: Partial<EscalaLinha> = {}): EscalaLinha => ({
  ORIGEM_REGISTRO: "ERP",
  ID_PLANEJAMENTO: "ERP-1",
  NROEMPRESA: 1,
  DATA_ABATE: "2026-08-31",
  STATUS_CONFIGURACAO: "COMPLETO",
  ...overrides,
});

describe("automatic scale payment term", () => {
  it("maps CODCONDPAGTO to the API prazo", () => {
    const row = createRow({ CODCONDPAGTO: 20 });

    expect(getEffectivePaymentTermDays(row, paymentTermsByCode)).toBe(30);
    expect(getMappedPaymentTerm(row, paymentTermsByCode)?.DESCRICAO).toBe(
      "30 DIAS",
    );
  });

  it("keeps zero as a valid prazo", () => {
    expect(
      getEffectivePaymentTermDays(
        createRow({ CODCONDPAGTO: 1 }),
        paymentTermsByCode,
      ),
    ).toBe(0);
  });

  it("uses the legacy prazo when the condition is not mapped", () => {
    expect(
      getEffectivePaymentTermDays(
        createRow({ CODCONDPAGTO: 999, PRAZO_DIAS: 15 }),
        paymentTermsByCode,
      ),
    ).toBe(15);
  });

  it("returns null when neither condition nor legacy prazo exists", () => {
    expect(
      getEffectivePaymentTermDays(
        createRow({ CODCONDPAGTO: null, PRAZO_DIAS: null }),
        paymentTermsByCode,
      ),
    ).toBeNull();
  });

  it("keeps manual records independent from the ERP mapping", () => {
    const manual = createRow({
      ORIGEM_REGISTRO: "MANUAL",
      CODCONDPAGTO: 20,
      PRAZO_DIAS: 12,
    });

    expect(getEffectivePaymentTermDays(manual, paymentTermsByCode)).toBe(12);
  });

  it("preserves other fields while persisting automatic prazo on China edit", () => {
    const row = createRow({
      ID_ESCALA_PEDIDO_VINCULO: 77,
      VERSAO_REGISTRO: 4,
      CODCONDPAGTO: 20,
      PRAZO_DIAS: null,
      ID_COMPRADOR_ESCALA: 123,
      COMPRADOR_ESCALA: "COMPRADOR",
      VLRUNITARIO_PREMIO: 7,
      CURRAL: 5,
      ARROBAS_VACA: 14,
      ARROBAS_BOI: 20,
      QTD_VACA: 12,
      QTD_BOI: 18,
      QTD_CHINA_VACA: 10,
      QTD_CHINA_BOI: 20,
      QTD_AGROTOOLS_VACA: 7,
      QTD_AGROTOOLS_BOI: 9,
      OBSERVACAO_PEDIDO_ESCALA: "Manter observação",
    });

    const payload = buildOrderUpdatePayload(
      row,
      1,
      { qtd_china_vaca: 15 },
      paymentTermsByCode,
    );

    expect(payload).toMatchObject({
      id_comprador: 123,
      vlrunitario_premio: 7,
      prazo_dias: 30,
      curral: 5,
      arrobas_vaca: 14,
      arrobas_boi: 20,
      qtd_china_vaca: 15,
      qtd_china_boi: 20,
      qtd_agrotools_vaca: 12,
      qtd_agrotools_boi: 18,
      observacao: "Manter observação",
    });
  });
});
