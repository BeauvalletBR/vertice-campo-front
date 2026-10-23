import { describe, expect, it } from "vitest";

import {
  getAgrotoolsCars,
  normalizeAgrotoolsText,
} from "@/lib/escala-agrotools-report";

describe("relatório Agrotools da escala", () => {
  it("lista os CARs únicos preservados pela análise", () => {
    expect(
      getAgrotoolsCars({
        status: "APTO",
        cars: ["GO-123-ABC", "GO-123-ABC"],
        fazendas: [
          { car: "GO-456-DEF" },
          { car: null },
        ],
      }),
    ).toEqual(["GO-123-ABC", "GO-456-DEF"]);
  });

  it("retorna vazio quando a Agrotools não informou CAR", () => {
    expect(getAgrotoolsCars({ status: "NAO_ENCONTRADO" })).toEqual([]);
  });

  it("corrige acentos quebrados sem alterar textos válidos", () => {
    expect(normalizeAgrotoolsText("CritÃ©rio inapto")).toBe("Critério inapto");
    expect(normalizeAgrotoolsText("Inscrição estadual válida")).toBe(
      "Inscrição estadual válida",
    );
  });
});
