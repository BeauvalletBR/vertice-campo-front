import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { MemoryRouter } from "react-router-dom";

import RendimentoModule from "@/modules/rendimento/RendimentoModule";
import { catalogService } from "@/modules/rendimento/services/catalogService";
import { testService } from "@/modules/rendimento/services/testService";
import {
  InputWeightFields,
  type WeightEntryMode,
} from "@/modules/rendimento/components/InputWeightFields";
import {
  calculateCleanWeight,
  calculateTotalDiscard,
  calculateYield,
  consolidateDiscards,
} from "@/modules/rendimento/utils/calculations";
import { shiftWeightInput } from "@/modules/rendimento/utils/format";

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

  it("define um produto principal e limita os cards à mesma ramificação", async () => {
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

    const productSelect = await screen.findByRole("combobox", {
      name: "Produto principal 1",
    });
    fireEvent.change(productSelect, { target: { value: "10" } });
    expect(
      screen.getByRole("button", { name: /CONTRA FILÉ MI/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /FILÉ MIGNON/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Início fixo")).toBeInTheDocument();
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
      within(dialog).getByRole("button", { name: /Adicionar à soma/i }),
    );

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
    expect(screen.getByText("Rendimento do processo")).toBeInTheDocument();
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

  it("digita pesos sequencialmente mantendo três casas decimais", () => {
    const first = shiftWeightInput("0,000", "5");
    const second = shiftWeightInput(first || "", "0");
    const third = shiftWeightInput(second || "", "0");
    expect(first).toBe("0,005");
    expect(second).toBe("0,050");
    expect(third).toBe("0,500");
    expect(shiftWeightInput(third || "", "Backspace")).toBe("0,050");
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
});
