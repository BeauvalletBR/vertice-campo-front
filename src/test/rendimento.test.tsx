import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { MemoryRouter } from "react-router-dom";

import RendimentoModule from "@/modules/rendimento/RendimentoModule";
import { catalogService } from "@/modules/rendimento/services/catalogService";
import { testService } from "@/modules/rendimento/services/testService";
import { mapYieldTest, rendimentoApi } from "@/modules/rendimento/services/rendimentoApi";
import {
  InputWeightFields,
  type WeightEntryMode,
} from "@/modules/rendimento/components/InputWeightFields";
import {
  calculateCleanWeight,
  calculateTotalDiscard,
  calculateYield,
  consolidateDiscards,
  resolveTraceInitialWeight,
} from "@/modules/rendimento/utils/calculations";
import {
  formatPercent,
  parseDecimal,
  sanitizeWeightInput,
} from "@/modules/rendimento/utils/format";
import { buildTraceabilityMatrices } from "@/modules/rendimento/utils/traceabilityReport";

const catalogResponse = {
  PRODUTOS: [
    {
      ID_PRODUTO: 10,
      VERSAO: 1,
      CODIGO: "CF",
      NOME: "CONTRA FILÉ",
      TIPO: "PRODUTO",
      ID_PRODUTO_PAI: null,
      NIVEL: 0,
      IDS_TIPOS_DESCARTE: [20],
      ATIVO: "S",
      CRIADO_POR_NOME: "TESTE",
      CRIADO_EM: "2026-10-09T10:00:00",
    },
    {
      ID_PRODUTO: 11,
      VERSAO: 1,
      CODIGO: "CFMI",
      NOME: "CONTRA FILÉ MI",
      TIPO: "PRODUTO",
      ID_PRODUTO_PAI: 10,
      IDS_PRODUTOS_ORIGEM: [10],
      NIVEL: 1,
      IDS_TIPOS_DESCARTE: [20],
      ATIVO: "S",
      CRIADO_POR_NOME: "TESTE",
      CRIADO_EM: "2026-10-09T10:00:00",
    },
    {
      ID_PRODUTO: 12,
      VERSAO: 1,
      CODIGO: "FM",
      NOME: "FILÉ MIGNON",
      TIPO: "PRODUTO",
      ID_PRODUTO_PAI: null,
      IDS_PRODUTOS_ORIGEM: [],
      NIVEL: 0,
      IDS_TIPOS_DESCARTE: [],
      ATIVO: "S",
      CRIADO_POR_NOME: "TESTE",
      CRIADO_EM: "2026-10-09T10:00:00",
    },
  ],
  TIPOS_DESCARTE: [
    {
      ID_TIPO_DESCARTE: 20,
      VERSAO: 1,
      CODIGO: "MEM",
      NOME: "MEMBRANA",
      DESCRICAO: "Membrana retirada no corte",
      ORDEM: 1,
      ATIVO: "S",
      CRIADO_POR_NOME: "TESTE",
      CRIADO_EM: "2026-10-09T10:00:00",
    },
  ],
};

const openTest = {
  ID_TESTE: 7,
  VERSAO: 2,
  NUMERO_TESTE: 7,
  NOME: "TESTE ABERTO",
  DATA_TESTE: "2026-10-09",
  ID_PRODUTO_ENTRADA: 10,
  QTD_ENTRADA: 12,
  PESO_ENTRADA: 240,
  PESO_MEDIO_ENTRADA: 20,
  PESOS_ENTRADA: [],
  STATUS: "ABERTO",
  FLUXOS: [],
  CRIADO_POR_NOME: "TESTE",
  CRIADO_EM: "2026-10-09T10:00:00",
  ATUALIZADO_EM: "2026-10-09T11:00:00",
};

const openTestWithProgress = {
  ...openTest,
  FLUXOS: [
    {
      ID_FLUXO: 70,
      ID_PRODUTO_RAIZ: 10,
      STATUS: "EM_EXECUCAO",
      ETAPA_ATUAL: 1,
      ATUALIZADO_EM: "2026-10-09T11:00:00",
      ETAPAS: [
        {
          ID_ETAPA: 700,
          ID_PRODUTO: 10,
          PESO_INICIAL: 120,
          PESO_LIQUIDO_SAIDA: 115,
          RENDIMENTO_ETAPA: 95.833,
          RENDIMENTO_ENTRADA_BRUTO: 50,
          RENDIMENTO_ENTRADA_LIQUIDO: 47.917,
          CONFIRMADA: "S",
          DESCARTES: [
            {
              ID_ETAPA_DESCARTE: 900,
              ID_TIPO_DESCARTE: 20,
              NOME_DESCARTE_SNAPSHOT: "MEMBRANA",
              PESO: 5,
              MANUAL: "N",
            },
          ],
        },
        {
          ID_ETAPA: 701,
          ID_PRODUTO: 10,
          PESO_INICIAL: 115,
          PESO_LIQUIDO_SAIDA: 115,
          RENDIMENTO_ETAPA: 100,
          RENDIMENTO_ENTRADA_BRUTO: 47.917,
          RENDIMENTO_ENTRADA_LIQUIDO: 47.917,
          CONFIRMADA: "S",
          DESCARTES: [],
        },
      ],
    },
  ],
};

const multiProductTest = {
  ...openTestWithProgress,
  STATUS: "EM_EXECUCAO",
  FLUXOS: [
    {
      ...openTestWithProgress.FLUXOS[0],
      STATUS: "FINALIZADO",
    },
    {
      ID_FLUXO: 71,
      ID_PRODUTO_RAIZ: 12,
      STATUS: "EM_EXECUCAO",
      ETAPA_ATUAL: 0,
      ATUALIZADO_EM: "2026-10-09T11:00:00",
      ETAPAS: [
        {
          ID_ETAPA: 710,
          ID_PRODUTO: 12,
          PESO_INICIAL: 120,
          PESO_LIQUIDO_SAIDA: 120,
          RENDIMENTO_ETAPA: 100,
          RENDIMENTO_ENTRADA_BRUTO: 50,
          RENDIMENTO_ENTRADA_LIQUIDO: 50,
          CONFIRMADA: "N",
          DESCARTES: [],
        },
        {
          ID_ETAPA: 711,
          ID_PRODUTO: 12,
          PESO_INICIAL: 0,
          PESO_LIQUIDO_SAIDA: 0,
          RENDIMENTO_ETAPA: 0,
          RENDIMENTO_ENTRADA_BRUTO: 0,
          RENDIMENTO_ENTRADA_LIQUIDO: 0,
          CONFIRMADA: "N",
          DESCARTES: [],
        },
      ],
    },
  ],
};

const finalizedFlowTest = {
  ...openTestWithProgress,
  STATUS: "FINALIZADO",
  FINALIZADO_POR_NOME: "TESTE",
  FINALIZADO_EM: "2026-10-09T12:00:00",
  FLUXOS: openTestWithProgress.FLUXOS.map((flow) => ({
    ...flow,
    STATUS: "FINALIZADO",
  })),
};

const jsonResponse = (body: unknown, status = 200) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (name: string) =>
        name.toLowerCase() === "content-type" ? "application/json" : null,
    },
    json: async () => body,
    text: async () => JSON.stringify(body),
  }) as Response;

describe("módulo Teste de Rendimento integrado ao backend", () => {
  beforeEach(() => {
    window.localStorage.setItem("empresa_logada", "1");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("carrega produtos e descartes exclusivamente pela API", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/rendimento/catalogos"))
        return jsonResponse(catalogResponse);
      if (url.includes("/rendimento/testes"))
        return jsonResponse({ TESTES: [] });
      return jsonResponse({ detail: "Rota inesperada" }, 404);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <MemoryRouter initialEntries={["/rendimento/cadastros/produtos"]}>
        <RendimentoModule />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("heading", { name: "Produtos / Cortes" }),
    ).toBeInTheDocument();
    expect(screen.getByText("CONTRA FILÉ")).toBeInTheDocument();
    expect(screen.getByText("MEMBRANA")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/rendimento/catalogos"),
      expect.any(Object),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/rendimento/testes"),
      expect.any(Object),
    );
  });

  it("envia novos produtos ao Oracle pela API, sem persistência local", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ ID_PRODUTO: 11, VERSAO: 1 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await catalogService.saveProduct({
      name: "Contra filé teste",
      type: "PRODUTO",
      parentId: "10",
      applicableDiscardIds: ["20"],
      active: true,
    });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toContain("/rendimento/produtos");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toMatchObject({
      nroempresa: 1,
      nome: "Contra filé teste",
      id_produto_pai: 10,
      ids_tipos_descarte: [20],
    });
    expect(JSON.parse(String(init.body))).not.toHaveProperty("codigo");
    expect(window.localStorage.getItem("@Rendimento:database:v1")).toBeNull();
  });

  it("cria novos testes somente como abertos, sem opção de rascunho", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/rendimento/catalogos"))
          return jsonResponse(catalogResponse);
        return jsonResponse({ TESTES: [] });
      }),
    );

    render(
      <MemoryRouter initialEntries={["/rendimento/testes/novo"]}>
        <RendimentoModule />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("heading", { name: "Novo Teste de Rendimento" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Deixar aberto/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Salvar rascunho/i }),
    ).not.toBeInTheDocument();
  });

  it("define um produto principal e monta suas saídas como árvore", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/rendimento/catalogos"))
          return jsonResponse(catalogResponse);
        return jsonResponse({ TESTES: [] });
      }),
    );

    render(
      <MemoryRouter initialEntries={["/rendimento/testes/novo"]}>
        <RendimentoModule />
      </MemoryRouter>,
    );

    const productSelect = await screen.findByRole("button", {
      name: "Produto principal 1",
    });
    fireEvent.click(productSelect);
    fireEvent.click(screen.getByRole("button", { name: /^CONTRA FILÉ$/i }));
    const outputSelect = screen.getByRole("combobox", { name: /Adicionar saída de CONTRA FILÉ/i });
    expect(within(outputSelect).getByRole("option", { name: /CONTRA FILÉ MI/i })).toBeInTheDocument();
    expect(within(outputSelect).queryByRole("option", { name: /^FILÉ MIGNON$/i })).not.toBeInTheDocument();
    fireEvent.change(outputSelect, { target: { value: "11" } });
    expect(screen.getByText("Produto inicial")).toBeInTheDocument();
    expect(screen.getByText("Produto final")).toBeInTheDocument();
  });

  it("permite iniciar o fluxo com todas as ramificações irmãs do grupo", async () => {
    const branchedCatalog = {
      ...catalogResponse,
      PRODUTOS: [
        ...catalogResponse.PRODUTOS,
        {
          ID_PRODUTO: 13,
          VERSAO: 1,
          CODIGO: "CFA",
          NOME: "CONTRA FILÉ A",
          TIPO: "PRODUTO",
          ID_PRODUTO_PAI: 10,
          IDS_PRODUTOS_ORIGEM: [10],
          NIVEL: 1,
          IDS_TIPOS_DESCARTE: [],
          ATIVO: "S",
          CRIADO_POR_NOME: "TESTE",
          CRIADO_EM: "2026-10-09T10:00:00",
        },
      ],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/rendimento/catalogos")) return jsonResponse(branchedCatalog);
        return jsonResponse({ TESTES: [] });
      }),
    );

    render(
      <MemoryRouter initialEntries={["/rendimento/testes/novo"]}>
        <RendimentoModule />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Produto principal 1" }));
    fireEvent.click(screen.getByRole("button", { name: /^CONTRA FILÉ$/i }));
    fireEvent.click(screen.getByRole("button", { name: /Adicionar todas as 2 saídas/i }));

    expect(screen.getAllByText("CONTRA FILÉ MI").some((element) => element.tagName === "STRONG")).toBe(true);
    expect(screen.getAllByText("CONTRA FILÉ A").some((element) => element.tagName === "STRONG")).toBe(true);
    expect(screen.getAllByText("Produto final")).toHaveLength(2);
  });

  it("oferece edição completa e dados de entrada diretamente editáveis no teste aberto", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/rendimento/catalogos"))
          return jsonResponse(catalogResponse);
        return jsonResponse({ TESTES: [openTest] });
      }),
    );

    render(
      <MemoryRouter initialEntries={["/rendimento/testes/7"]}>
        <RendimentoModule />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("button", { name: /Editar teste inteiro/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("switch", { name: /Informar peso por peça/i }),
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("12")).toBeInTheDocument();
    expect(screen.getByDisplayValue("240,000")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Editar dados/i }),
    ).not.toBeInTheDocument();
  });

  it("preserva etapas e descartes preenchidos ao editar o teste inteiro", async () => {
    let savedBody = "";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes("/rendimento/catalogos"))
          return jsonResponse(catalogResponse);
        if (url.includes("/rendimento/testes/7") && init?.method === "PUT") {
          savedBody = String(init.body);
          return jsonResponse({ ID_TESTE: 7 });
        }
        if (url.includes("/rendimento/testes/7"))
          return jsonResponse({ TESTE: openTestWithProgress });
        return jsonResponse({ detail: "Rota inesperada" }, 404);
      }),
    );

    await testService.saveSetup({
      id: "7",
      name: "TESTE ABERTO EDITADO",
      date: "2026-10-09",
      inputProductId: "10",
      inputQuantity: 12,
      inputWeightKg: 240,
      inputTotalWeightKg: 240,
      inputWeightMode: "total",
      inputPieceWeightsKg: [],
      flows: [
        {
          id: "70",
          rootProductId: "10",
          productIds: ["10", "10"],
          firstStepWeightKg: 120,
        },
      ],
      status: "ABERTO",
    });

    const saved = JSON.parse(savedBody);
    expect(saved.fluxos[0].etapas).toHaveLength(2);
    expect(saved.fluxos[0].etapas[0]).toMatchObject({
      confirmada: true,
      descartes: [{ peso: 5 }],
    });
    expect(saved.fluxos[0].etapas[1]).toMatchObject({
      confirmada: true,
      peso_inicial: 115,
    });
  });

  it("deixa aberto um teste ramificado sem perder a referência dos produtos", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(catalogResponse)));
    const save = vi.spyOn(rendimentoApi, "saveTest").mockImplementation(async (value) => value);

    const saved = await testService.saveSetup({
      name: "TESTE DIANTEIRO RAMIFICADO",
      date: "2026-10-15",
      inputProductId: "10",
      inputQuantity: 0,
      inputWeightKg: 0,
      inputTotalWeightKg: 0,
      inputWeightMode: "total",
      flows: [{
        rootProductId: "21",
        productIds: ["21", "22", "24"],
        nodes: [
          { id: "root", productId: "21", parentNodeId: null, branchOrder: 1 },
          { id: "child-a", productId: "22", parentNodeId: "root", branchOrder: 1 },
          { id: "child-b", productId: "24", parentNodeId: "root", branchOrder: 2 },
        ],
        firstStepWeightKg: 0,
      }],
      status: "ABERTO",
    });

    expect(save).toHaveBeenCalledOnce();
    expect(saved.flows[0].steps.map((step) => [step.productId, step.parentStepId])).toEqual([
      ["21", null],
      ["22", "root"],
      ["24", "root"],
    ]);
  });

  it("permite voltar a um produto finalizado e corrigir seus dados", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/rendimento/catalogos"))
          return jsonResponse(catalogResponse);
        if (url.includes("/rendimento/testes"))
          return jsonResponse({ TESTES: [multiProductTest] });
        return jsonResponse({ detail: "Rota inesperada" }, 404);
      }),
    );

    render(
      <MemoryRouter initialEntries={["/rendimento/testes/7/executar"]}>
        <RendimentoModule />
      </MemoryRouter>,
    );

    const completedProduct = await screen.findByTitle(
      "Clique para revisar este produto",
    );
    expect(completedProduct).toBeEnabled();
    fireEvent.click(completedProduct);

    expect(
      await screen.findByText(/Este produto já foi concluído/i),
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("120,000")).toBeInTheDocument();
    expect(screen.getByText("Peso inicial · editável")).toBeInTheDocument();
  });

  it("soma pesagens individuais pelo botão ao lado do peso do produto", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/rendimento/catalogos"))
          return jsonResponse(catalogResponse);
        if (url.includes("/rendimento/testes"))
          return jsonResponse({ TESTES: [multiProductTest] });
        return jsonResponse({ detail: "Rota inesperada" }, 404);
      }),
    );

    render(
      <MemoryRouter initialEntries={["/rendimento/testes/7/executar"]}>
        <RendimentoModule />
      </MemoryRouter>,
    );

    fireEvent.click(
      await screen.findByLabelText("Adicionar pesagem individual"),
    );
    const dialog = screen.getByRole("dialog", {
      name: "Adicionar pesagem ao produto",
    });
    expect(
      within(dialog).getByRole("heading", {
        name: "Adicionar pesagem ao produto",
      }),
    ).toBeInTheDocument();
    fireEvent.change(within(dialog).getByPlaceholderText("0,000"), {
      target: { value: "5,000" },
    });
    expect(within(dialog).getByText("2 valores somados")).toBeInTheDocument();
    fireEvent.click(
      within(dialog).getByRole("button", { name: /Adicionar e continuar/i }),
    );

    expect(within(dialog).getByText("2 valores somados")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Concluir" }));

    expect(screen.getByLabelText("Peso inicial do produto")).toHaveValue(
      "125,000",
    );
    expect(screen.getByText("2 valores somados")).toBeInTheDocument();
  });

  it("envia a ação de reabrir e retorna o teste novamente em execução", async () => {
    let detailReads = 0;
    let statusBody = "";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes("/status") && init?.method === "POST") {
          statusBody = String(init.body);
          return jsonResponse({
            success: true,
            ID_TESTE: 7,
            STATUS: "EM_EXECUCAO",
          });
        }
        if (url.includes("/rendimento/testes/7")) {
          detailReads += 1;
          return jsonResponse({
            TESTE:
              detailReads === 1
                ? finalizedFlowTest
                : {
                    ...finalizedFlowTest,
                    STATUS: "EM_EXECUCAO",
                    REABERTO_EM: "2026-10-10T08:00:00",
                  },
          });
        }
        return jsonResponse({ detail: "Rota inesperada" }, 404);
      }),
    );

    const reopened = await testService.reopen("7");

    expect(JSON.parse(statusBody)).toMatchObject({ acao: "REABRIR" });
    expect(reopened?.status).toBe("EM_EXECUCAO");
    expect(reopened?.reopenedAt).toBe("2026-10-10T08:00:00");
  });

  it("mostra o resultado como fluxo compacto com descartes agrupados", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/rendimento/catalogos"))
          return jsonResponse(catalogResponse);
        if (url.includes("/rendimento/testes"))
          return jsonResponse({ TESTES: [finalizedFlowTest] });
        return jsonResponse({ detail: "Rota inesperada" }, 404);
      }),
    );

    render(
      <MemoryRouter initialEntries={["/rendimento/testes/7"]}>
        <RendimentoModule />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("heading", { name: "Fluxo de rendimento" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Produto / descarte")).toBeInTheDocument();
    expect(screen.getByText("Aproveitamento no fluxo")).toBeInTheDocument();
    expect(screen.getAllByText("MEMBRANA")).toHaveLength(2);
    expect(screen.getByText("Total retirado")).toBeInTheDocument();
    expect(screen.queryByText("Transformação 1")).not.toBeInTheDocument();
  });

  it("mantém os cálculos de rendimento no front para conferência imediata", () => {
    const removals = [
      {
        id: "1",
        discardTypeId: null,
        name: "Apara",
        weightKg: 0.5,
        manual: true,
      },
    ];
    expect(calculateTotalDiscard(removals)).toBe(0.5);
    expect(calculateCleanWeight(60, removals)).toBe(59.5);
    expect(calculateYield(59.5, 60)).toBe(99.167);
  });

  it("recupera uma etapa antiga vazia pelo peso seguinte mais seus descartes", () => {
    expect(resolveTraceInitialWeight({
      currentWeight: 0,
      previousCleanWeight: 0,
      nextWeight: 7,
      currentDiscards: [{ id: "1", discardTypeId: null, name: "Recorte", weightKg: 0.5, manual: true }],
    })).toBe(7.5);
    expect(resolveTraceInitialWeight({
      currentWeight: 0,
      previousCleanWeight: 0,
      nextWeight: 0,
      currentDiscards: [],
    })).toBe(0);
  });

  it("consolida os descartes de todas as etapas por nome", () => {
    const consolidated = consolidateDiscards([
      { id: "1", discardTypeId: "20", name: "Sebo", weightKg: 0.1, manual: false },
      { id: "2", discardTypeId: "20", name: "SEBO", weightKg: 0.5, manual: false },
      { id: "3", discardTypeId: null, name: "Recorte", weightKg: 0.05, manual: true },
    ]);
    expect(consolidated).toHaveLength(2);
    expect(consolidated.find((item) => item.name === "Sebo")?.weightKg).toBe(0.6);
    expect(consolidated.find((item) => item.name === "Recorte")?.weightKg).toBe(0.05);
  });

  it("aceita pesos com digitação decimal livre e percentuais com duas casas", () => {
    expect(sanitizeWeightInput("5")).toBe("5");
    expect(sanitizeWeightInput("5,")).toBe("5,");
    expect(sanitizeWeightInput("5,25")).toBe("5,25");
    expect(sanitizeWeightInput("5,2579")).toBe("5,257");
    expect(parseDecimal("5,257")).toBe(5.257);
    expect(formatPercent(47.916)).toBe("47,92%");
  });

  it("mantém pesos e descartes vinculados à peça de entrada rastreável", () => {
    const test = mapYieldTest({
      ID_TESTE: 90,
      MODO_EXECUCAO: "RASTREAVEL",
      MODO_PESO_ENTRADA: "PECAS",
      PESOS_ENTRADA: [{ ID_TESTE_PESO_ITEM: 501, ORDEM: 1, PESO: 12.5 }],
      FLUXOS: [{
        ID_FLUXO: 10,
        ID_PRODUTO_RAIZ: 10,
        STATUS: "EM_EXECUCAO",
        ETAPAS: [{
          ID_ETAPA: 20,
          ID_PRODUTO: 10,
          PESO_INICIAL: 12.5,
          PESOS: [{ ID_TESTE_PESO_ITEM: 501, ORDEM: 1, ORDEM_PECA: 1, PESO: 12.5, CONFIRMADA: "S" }],
          DESCARTES: [{ ID_ETAPA_DESCARTE: 30, ID_TESTE_PESO_ITEM: 501, ID_TIPO_DESCARTE: 20, NOME_DESCARTE_SNAPSHOT: "SEBO", PESO: 0.5, MANUAL: "N" }],
        }],
      }],
    });

    expect(test.executionMode).toBe("traceable");
    expect(test.inputPieces?.[0]).toMatchObject({ id: "501", order: 1, weightKg: 12.5 });
    expect(test.flows[0].steps[0].traceItems?.[0]).toMatchObject({
      inputPieceId: "501",
      inputPieceOrder: 1,
      initialWeightKg: 12.5,
      cleanWeightKg: 12,
      confirmed: true,
    });
    expect(test.flows[0].steps[0].traceItems?.[0].discards[0].name).toBe("SEBO");
  });

  it("salva a peça pelo produto raiz quando o backend recria o id do fluxo", async () => {
    const test = mapYieldTest({
      ID_TESTE: 92,
      VERSAO: 4,
      STATUS: "EM_EXECUCAO",
      MODO_EXECUCAO: "RASTREAVEL",
      MODO_PESO_ENTRADA: "PECAS",
      PESO_ENTRADA: 10,
      PESOS_ENTRADA: [{ ID_TESTE_PESO_ITEM: 501, ORDEM: 1, PESO: 10 }],
      FLUXOS: [{
        ID_FLUXO: 999,
        ID_PRODUTO_RAIZ: 10,
        ORDEM: 1,
        STATUS: "EM_EXECUCAO",
        ETAPAS: [
          { ID_ETAPA: 20, ID_PRODUTO: 10, SEQUENCIA: 1, PESO_INICIAL: 0, PESOS: [], DESCARTES: [] },
          { ID_ETAPA: 21, ID_PRODUTO: 11, SEQUENCIA: 2, PESO_INICIAL: 0, PESOS: [], DESCARTES: [] },
        ],
      }],
    });
    vi.spyOn(rendimentoApi, "getTest").mockResolvedValue(test);
    const save = vi.spyOn(rendimentoApi, "saveTest").mockImplementation(async (value) => value);

    await testService.saveTracePiece("92", "id-antigo", "10", 0, 1, {
      initialWeightKg: 8.5,
      discards: [],
    }, false);

    const savedTest = save.mock.calls[0][0];
    expect(savedTest.flows[0].steps[0].traceItems?.[0]).toMatchObject({
      inputPieceOrder: 1,
      initialWeightKg: 8.5,
      confirmed: false,
    });
  });

  it("preserva a etapa anterior ao confirmar a etapa seguinte da mesma peça", async () => {
    const test = mapYieldTest({
      ID_TESTE: 93,
      VERSAO: 5,
      STATUS: "EM_EXECUCAO",
      MODO_EXECUCAO: "RASTREAVEL",
      MODO_PESO_ENTRADA: "PECAS",
      PESO_ENTRADA: 10,
      PESOS_ENTRADA: [{ ID_TESTE_PESO_ITEM: 501, ORDEM: 1, PESO: 10 }],
      FLUXOS: [{
        ID_FLUXO: 999,
        ID_PRODUTO_RAIZ: 10,
        ORDEM: 1,
        STATUS: "EM_EXECUCAO",
        ETAPAS: [
          { ID_ETAPA: 20, ID_PRODUTO: 10, SEQUENCIA: 1, PESOS: [{ ID_TESTE_PESO_ITEM: 501, ORDEM_PECA: 1, PESO: 9, CONFIRMADA: "S" }], DESCARTES: [] },
          { ID_ETAPA: 21, ID_PRODUTO: 11, SEQUENCIA: 2, PESOS: [{ ID_TESTE_PESO_ITEM: 501, ORDEM_PECA: 1, PESO: 8, CONFIRMADA: "N" }], DESCARTES: [] },
          { ID_ETAPA: 22, ID_PRODUTO: 12, SEQUENCIA: 3, PESOS: [], DESCARTES: [] },
        ],
      }],
    });
    vi.spyOn(rendimentoApi, "getTest").mockResolvedValue(test);
    const save = vi.spyOn(rendimentoApi, "saveTest").mockImplementation(async (value) => value);
    vi.spyOn(rendimentoApi, "changeStatus").mockImplementation(async (value) => ({ ...value, status: "FINALIZADO" }));

    await testService.saveTracePiece("93", "999", "10", 1, 1, {
      initialWeightKg: 8,
      discards: [],
    }, true);

    const savedFlow = save.mock.calls[0][0].flows[0];
    expect(savedFlow.steps[0].traceItems?.[0]).toMatchObject({
      inputPieceOrder: 1,
      initialWeightKg: 9,
      confirmed: true,
    });
    expect(savedFlow.steps[1].traceItems?.[0].confirmed).toBe(true);
    expect(savedFlow.steps[2].traceItems?.[0].confirmed).toBe(true);
  });

  it("finaliza todas as peças preenchidas em um único lote", async () => {
    const test = mapYieldTest({
      ID_TESTE: 94,
      VERSAO: 1,
      STATUS: "EM_EXECUCAO",
      MODO_EXECUCAO: "RASTREAVEL",
      MODO_PESO_ENTRADA: "PECAS",
      PESO_ENTRADA: 21,
      PESOS_ENTRADA: [
        { ID_TESTE_PESO_ITEM: 501, ORDEM: 1, PESO: 10 },
        { ID_TESTE_PESO_ITEM: 502, ORDEM: 2, PESO: 11 },
      ],
      FLUXOS: [{
        ID_FLUXO: 999,
        ID_PRODUTO_RAIZ: 10,
        ORDEM: 1,
        STATUS: "EM_EXECUCAO",
        ETAPAS: [
          { ID_ETAPA: 20, ID_PRODUTO: 10, SEQUENCIA: 1, PESOS: [], DESCARTES: [] },
          { ID_ETAPA: 21, ID_PRODUTO: 11, SEQUENCIA: 2, PESOS: [], DESCARTES: [] },
          { ID_ETAPA: 22, ID_PRODUTO: 12, SEQUENCIA: 3, PESOS: [], DESCARTES: [] },
        ],
      }],
    });
    vi.spyOn(rendimentoApi, "getTest").mockResolvedValue(test);
    const save = vi.spyOn(rendimentoApi, "saveTest").mockImplementation(async (value) => value);
    vi.spyOn(rendimentoApi, "changeStatus").mockImplementation(async (value) => ({ ...value, status: "FINALIZADO" }));

    const saved = await testService.saveTracePiecesBatch("94", "999", "10", [
      {
        inputPieceOrder: 1,
        inputs: [
          { stepId: "20", stepIndex: 0, initialWeightKg: 9, discards: [] },
          { stepId: "21", stepIndex: 1, initialWeightKg: 8, discards: [] },
        ],
      },
      {
        inputPieceOrder: 2,
        inputs: [
          { stepId: "20", stepIndex: 0, initialWeightKg: 10, discards: [] },
          { stepId: "21", stepIndex: 1, initialWeightKg: 9, discards: [] },
        ],
      },
    ]);

    const savedFlow = save.mock.calls[0][0].flows[0];
    expect(save).toHaveBeenCalledOnce();
    expect(savedFlow.steps[0].traceItems).toHaveLength(2);
    expect(savedFlow.steps[1].traceItems?.every((item) => item.confirmed)).toBe(true);
    expect(savedFlow.steps[2].traceItems).toHaveLength(2);
    expect(saved.status).toBe("FINALIZADO");
  });

  it("separa entrada, produtos e descartes no relatório rastreável por peça", () => {
    const test = mapYieldTest({
      ID_TESTE: 91,
      MODO_EXECUCAO: "RASTREAVEL",
      MODO_PESO_ENTRADA: "PECAS",
      PESOS_ENTRADA: [
        { ID_TESTE_PESO_ITEM: 501, ORDEM: 1, PESO: 10 },
        { ID_TESTE_PESO_ITEM: 502, ORDEM: 2, PESO: 20 },
      ],
      FLUXOS: [{
        ID_FLUXO: 10,
        ID_PRODUTO_RAIZ: 10,
        STATUS: "FINALIZADO",
        ETAPAS: [
          {
            ID_ETAPA: 20,
            ID_PRODUTO: 10,
            PESO_INICIAL: 27,
            PESOS: [
              { ID_TESTE_PESO_ITEM: 501, ORDEM_PECA: 1, PESO: 9, CONFIRMADA: "S" },
              { ID_TESTE_PESO_ITEM: 502, ORDEM_PECA: 2, PESO: 18, CONFIRMADA: "S" },
            ],
            DESCARTES: [
              { ID_ETAPA_DESCARTE: 30, ID_TESTE_PESO_ITEM: 501, ID_TIPO_DESCARTE: 20, NOME_DESCARTE_SNAPSHOT: "SEBO", PESO: 1, MANUAL: "N" },
              { ID_ETAPA_DESCARTE: 31, ID_TESTE_PESO_ITEM: 502, ID_TIPO_DESCARTE: 20, NOME_DESCARTE_SNAPSHOT: "SEBO", PESO: 2, MANUAL: "N" },
            ],
          },
          {
            ID_ETAPA: 21,
            ID_PRODUTO: 11,
            PESO_INICIAL: 24,
            PESOS: [
              { ID_TESTE_PESO_ITEM: 501, ORDEM_PECA: 1, PESO: 8, CONFIRMADA: "S" },
              { ID_TESTE_PESO_ITEM: 502, ORDEM_PECA: 2, PESO: 16, CONFIRMADA: "S" },
            ],
            DESCARTES: [],
          },
        ],
      }],
    });
    const matrix = buildTraceabilityMatrices(test, [
      { id: "10", name: "ACÉM COMPLETO", code: "10", type: "PRODUTO", parentId: null, originProductIds: [], level: 0, applicableDiscardIds: [], active: true, version: 1, createdBy: "T", createdAt: "", updatedBy: "T", updatedAt: "" },
      { id: "11", name: "ACÉM MI", code: "11", type: "PRODUTO", parentId: "10", originProductIds: ["10"], level: 1, applicableDiscardIds: [], active: true, version: 1, createdBy: "T", createdAt: "", updatedBy: "T", updatedAt: "" },
    ])[0];

    expect(matrix.rows.map((row) => row.kind)).toEqual(["input", "product", "discard", "final"]);
    expect(matrix.rows[0]).toMatchObject({ values: [10, 20], total: 30 });
    expect(matrix.rows[1]).toMatchObject({ values: [9, 18], total: 27, yieldPercent: 90 });
    expect(matrix.rows[2]).toMatchObject({ label: "SEBO", values: [1, 2], total: 3 });
    expect(matrix.rows[3]).toMatchObject({ values: [8, 16], total: 24, yieldPercent: 80 });
  });

  it("usa o primeiro produto como base do rendimento quando a entrada não foi informada", () => {
    const test = mapYieldTest({
      ID_TESTE: 1023,
      MODO_EXECUCAO: "RASTREAVEL",
      MODO_PESO_ENTRADA: "PECAS",
      QTD_ENTRADA: 2,
      PESO_ENTRADA: 0,
      PESOS_ENTRADA: [
        { ID_TESTE_PESO_ITEM: 601, ORDEM: 1, PESO: 0 },
        { ID_TESTE_PESO_ITEM: 602, ORDEM: 2, PESO: 0 },
      ],
      FLUXOS: [{
        ID_FLUXO: 20,
        ID_PRODUTO_RAIZ: 10,
        STATUS: "FINALIZADO",
        ETAPAS: [
          {
            ID_ETAPA: 30,
            ID_PRODUTO: 10,
            PESO_INICIAL: 30,
            PESOS: [
              { ID_TESTE_PESO_ITEM: 601, ORDEM_PECA: 1, PESO: 10, CONFIRMADA: "S" },
              { ID_TESTE_PESO_ITEM: 602, ORDEM_PECA: 2, PESO: 20, CONFIRMADA: "S" },
            ],
            DESCARTES: [],
          },
          {
            ID_ETAPA: 31,
            ID_PRODUTO: 11,
            PESO_INICIAL: 12,
            PESOS: [
              { ID_TESTE_PESO_ITEM: 601, ORDEM_PECA: 1, PESO: 4, CONFIRMADA: "S" },
              { ID_TESTE_PESO_ITEM: 602, ORDEM_PECA: 2, PESO: 8, CONFIRMADA: "S" },
            ],
            DESCARTES: [],
          },
        ],
      }],
    });
    const matrix = buildTraceabilityMatrices(test, [
      { id: "10", name: "MÚSCULO", code: "10", type: "PRODUTO", parentId: null, originProductIds: [], level: 0, applicableDiscardIds: [], active: true, version: 1, createdBy: "T", createdAt: "", updatedBy: "T", updatedAt: "" },
      { id: "11", name: "MÚSCULO A", code: "11", type: "PRODUTO", parentId: "10", originProductIds: ["10"], level: 1, applicableDiscardIds: [], active: true, version: 1, createdBy: "T", createdAt: "", updatedBy: "T", updatedAt: "" },
    ])[0];

    expect(matrix.rows[0]).toMatchObject({ values: [0, 0], total: 0, yieldPercent: null });
    expect(matrix.rows[1]).toMatchObject({ total: 30, yieldPercent: 100 });
    expect(matrix.rows[2]).toMatchObject({ total: 12, yieldPercent: 40 });
  });

  it("confirma a troca de modo e preserva os dois conjuntos de pesos", () => {
    function WeightHarness() {
      const [mode, setMode] = useState<WeightEntryMode>("total");
      const [weight, setWeight] = useState("120,000");
      const [pieces, setPieces] = useState(["", ""]);
      return (
        <InputWeightFields
          quantity="2"
          weight={weight}
          pieceWeights={pieces}
          mode={mode}
          onQuantityChange={() => undefined}
          onWeightChange={setWeight}
          onPieceWeightsChange={setPieces}
          onModeChange={setMode}
        />
      );
    }

    render(<WeightHarness />);
    fireEvent.click(
      screen.getByRole("switch", { name: /Informar peso por peça/i }),
    );
    expect(
      screen.getByRole("heading", {
        name: /Alterar forma de informar o peso/i,
      }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Alterar forma/i }));
    fireEvent.change(screen.getByLabelText("Peça 1"), {
      target: { value: "58,500" },
    });
    fireEvent.click(
      screen.getByRole("switch", { name: /Informar peso por peça/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: /Alterar forma/i }));
    expect(screen.getByDisplayValue("120,000")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("switch", { name: /Informar peso por peça/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: /Alterar forma/i }));
    expect(screen.getByDisplayValue("58,500")).toBeInTheDocument();
  });

  it("preserva pesos ao aumentar a quantidade e confirma antes de perder peças preenchidas", () => {
    function QuantityHarness() {
      const [quantity, setQuantity] = useState("4");
      const [pieces, setPieces] = useState([
        "10,000",
        "11,000",
        "12,000",
        "13,000",
      ]);
      return (
        <InputWeightFields
          quantity={quantity}
          weight=""
          pieceWeights={pieces}
          mode="pieces"
          onQuantityChange={setQuantity}
          onWeightChange={() => undefined}
          onPieceWeightsChange={setPieces}
          onModeChange={() => undefined}
        />
      );
    }

    render(<QuantityHarness />);
    const quantityInput = screen.getByRole("spinbutton");

    fireEvent.change(quantityInput, { target: { value: "" } });
    fireEvent.change(quantityInput, { target: { value: "5" } });
    expect(screen.getByLabelText("Peça 1")).toHaveValue("10,000");
    expect(screen.getByLabelText("Peça 4")).toHaveValue("13,000");
    expect(screen.getByLabelText("Peça 5")).toHaveValue("");

    fireEvent.change(quantityInput, { target: { value: "3" } });
    expect(
      screen.getByRole("heading", { name: /Reduzir a quantidade de peças/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/peça 4 \(13,000 kg\)/i)).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: /Reduzir quantidade/i }),
    );

    expect(screen.queryByLabelText("Peça 4")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Peça 3")).toHaveValue("12,000");
  });

  it("avança pelos pesos de entrada ao pressionar Enter", () => {
    render(
      <InputWeightFields
        quantity="3"
        weight=""
        pieceWeights={["10,000", "11,000", "12,000"]}
        mode="pieces"
        onQuantityChange={() => undefined}
        onWeightChange={() => undefined}
        onPieceWeightsChange={() => undefined}
        onModeChange={() => undefined}
      />,
    );

    const first = screen.getByLabelText("Peça 1");
    const second = screen.getByLabelText("Peça 2");
    const third = screen.getByLabelText("Peça 3");
    first.focus();
    fireEvent.keyDown(first, { key: "Enter" });
    expect(second).toHaveFocus();
    fireEvent.keyDown(second, { key: "Enter" });
    expect(third).toHaveFocus();
    fireEvent.keyDown(third, { key: "Enter" });
    expect(third).not.toHaveFocus();
  });
});
