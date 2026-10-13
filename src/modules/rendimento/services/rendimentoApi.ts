import { getAuthHeaders, getBackendUrl } from "../../../services/api";
import type {
  DiscardType,
  Product,
  TestDiscard,
  TestFlow,
  TestStep,
  YieldTest,
} from "../types/domain";

type ApiRow = Record<string, unknown>;

const company = () => {
  const value = Number(localStorage.getItem("empresa_logada"));
  return Number.isFinite(value) && value > 0 ? value : 1;
};

const asNumber = (value: unknown) => Number(value || 0);
const asString = (value: unknown) => (value == null ? "" : String(value));
const asOptionalString = (value: unknown) =>
  value == null || value === "" ? undefined : String(value);
const asBoolean = (value: unknown) =>
  value === true || String(value).toUpperCase() === "S";

const errorMessage = (body: unknown, status: number) => {
  if (typeof body === "object" && body !== null) {
    const detail =
      "detail" in body ? (body as { detail?: unknown }).detail : undefined;
    if (Array.isArray(detail))
      return detail
        .map((item) =>
          typeof item === "object" && item !== null && "msg" in item
            ? String((item as { msg?: unknown }).msg)
            : String(item),
        )
        .join("; ");
    if (detail && typeof detail === "object") return JSON.stringify(detail);
    if (detail) return String(detail);
  }
  return typeof body === "string" && body ? body : `Erro HTTP ${status}.`;
};

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(getBackendUrl(path), {
    ...init,
    cache: "no-store",
    headers: {
      ...getAuthHeaders(init.body !== undefined),
      ...(init.headers || {}),
    },
  });
  if (response.status === 401)
    window.dispatchEvent(new Event("sessao-expirada"));
  const contentType = response.headers.get("content-type") || "";
  const body: unknown = contentType.includes("application/json")
    ? await response.json()
    : await response.text();
  if (!response.ok) throw new Error(errorMessage(body, response.status));
  return body as T;
}

const mapProduct = (row: ApiRow): Product => ({
  id: asString(row.ID_PRODUTO),
  version: asNumber(row.VERSAO),
  code: asString(row.CODIGO),
  name: asString(row.NOME),
  type: asString(row.TIPO) === "ENTRADA" ? "ENTRADA" : "PRODUTO",
  parentId: row.ID_PRODUTO_PAI == null ? null : asString(row.ID_PRODUTO_PAI),
  level: asNumber(row.NIVEL),
  originProductIds: Array.isArray(row.IDS_PRODUTOS_ORIGEM)
    ? row.IDS_PRODUTOS_ORIGEM.map(asString)
    : row.ID_PRODUTO_PAI == null
      ? []
      : [asString(row.ID_PRODUTO_PAI)],
  applicableDiscardIds: Array.isArray(row.IDS_TIPOS_DESCARTE)
    ? row.IDS_TIPOS_DESCARTE.map(asString)
    : [],
  active: asBoolean(row.ATIVO),
  createdBy: asString(row.CRIADO_POR_NOME || row.CRIADO_POR_ID),
  createdAt: asString(row.CRIADO_EM),
  updatedBy: asString(
    row.ATUALIZADO_POR_NOME ||
      row.ATUALIZADO_POR_ID ||
      row.CRIADO_POR_NOME ||
      row.CRIADO_POR_ID,
  ),
  updatedAt: asString(row.ATUALIZADO_EM || row.CRIADO_EM),
});

const mapDiscardType = (row: ApiRow): DiscardType => ({
  id: asString(row.ID_TIPO_DESCARTE),
  version: asNumber(row.VERSAO),
  code: asString(row.CODIGO),
  name: asString(row.NOME),
  description: asString(row.DESCRICAO),
  order: asNumber(row.ORDEM),
  active: asBoolean(row.ATIVO),
  createdBy: asString(row.CRIADO_POR_NOME || row.CRIADO_POR_ID),
  createdAt: asString(row.CRIADO_EM),
  updatedBy: asString(
    row.ATUALIZADO_POR_NOME ||
      row.ATUALIZADO_POR_ID ||
      row.CRIADO_POR_NOME ||
      row.CRIADO_POR_ID,
  ),
  updatedAt: asString(row.ATUALIZADO_EM || row.CRIADO_EM),
});

const mapTestDiscard = (row: ApiRow): TestDiscard => ({
  id: asString(row.ID_ETAPA_DESCARTE),
  discardTypeId:
    row.ID_TIPO_DESCARTE == null ? null : asString(row.ID_TIPO_DESCARTE),
  name: asString(row.NOME_DESCARTE_SNAPSHOT || row.DESCRICAO_MANUAL),
  weightKg: asNumber(row.PESO),
  manual: asBoolean(row.MANUAL),
});

const mapTestDiscards = (rows: ApiRow[]): TestDiscard[] => {
  const grouped = new Map<string, TestDiscard>();
  rows.map(mapTestDiscard).forEach((discard) => {
    const key = discard.discardTypeId
      ? `catalog-${discard.discardTypeId}`
      : `manual-${discard.name.trim().toLocaleUpperCase("pt-BR")}`;
    const current = grouped.get(key);
    if (!current) {
      grouped.set(key, discard);
      return;
    }
    current.pieceWeightsKg = current.pieceWeightsKg?.length
      ? [...current.pieceWeightsKg, discard.weightKg]
      : [current.weightKg, discard.weightKg];
    current.weightKg += discard.weightKg;
  });
  return [...grouped.values()];
};

const mapTestStep = (row: ApiRow): TestStep => ({
  id: asString(row.ID_ETAPA),
  productId: asString(row.ID_PRODUTO),
  initialWeightKg: asNumber(row.PESO_INICIAL),
  pieceWeightsKg: Array.isArray(row.PESOS)
    ? (row.PESOS as ApiRow[]).map((item) => asNumber(item.PESO))
    : [],
  discards: Array.isArray(row.DESCARTES)
    ? mapTestDiscards(row.DESCARTES as ApiRow[])
    : [],
  cleanWeightKg: asNumber(row.PESO_LIQUIDO_SAIDA),
  yieldPercent: asNumber(row.RENDIMENTO_ETAPA),
  inputYieldPercent: asNumber(row.RENDIMENTO_ENTRADA_BRUTO),
  outputInputYieldPercent: asNumber(row.RENDIMENTO_ENTRADA_LIQUIDO),
  confirmed: asBoolean(row.CONFIRMADA),
});

const mapTestFlow = (row: ApiRow): TestFlow => {
  const steps = Array.isArray(row.ETAPAS)
    ? (row.ETAPAS as ApiRow[]).map(mapTestStep)
    : [];
  return {
    id: asString(row.ID_FLUXO),
    rootProductId: asString(row.ID_PRODUTO_RAIZ),
    productIds: steps.map((step) => step.productId),
    steps,
    currentStepIndex: asNumber(row.ETAPA_ATUAL),
    status: asString(row.STATUS) as TestFlow["status"],
    updatedAt: asString(row.ATUALIZADO_EM || row.CRIADO_EM),
  };
};

export const mapYieldTest = (row: ApiRow): YieldTest => {
  const flows = Array.isArray(row.FLUXOS)
    ? (row.FLUXOS as ApiRow[]).map(mapTestFlow)
    : [];
  const first = flows[0];
  return {
    id: asString(row.ID_TESTE),
    version: asNumber(row.VERSAO),
    number: asNumber(row.NUMERO_TESTE),
    name: asString(row.NOME),
    date: asString(row.DATA_TESTE).slice(0, 10),
    inputProductId:
      row.ID_PRODUTO_ENTRADA == null ? "" : asString(row.ID_PRODUTO_ENTRADA),
    inputQuantity: asNumber(row.QTD_ENTRADA),
    inputWeightKg: asNumber(row.PESO_ENTRADA),
    inputWeightMode:
      asString(row.MODO_PESO_ENTRADA) === "PECAS" ? "pieces" : "total",
    inputTotalWeightKg: asNumber(row.PESO_TOTAL_CACHE ?? row.PESO_ENTRADA),
    inputPieceWeightsKg: Array.isArray(row.PESOS_ENTRADA)
      ? (row.PESOS_ENTRADA as ApiRow[]).map((item) => asNumber(item.PESO))
      : [],
    averageWeightKg: asNumber(row.PESO_MEDIO_ENTRADA),
    groupProductId: first?.rootProductId || "",
    status: asString(row.STATUS) as YieldTest["status"],
    flows,
    steps: first?.steps || [],
    currentStepIndex: first?.currentStepIndex || 0,
    createdBy: asString(row.CRIADO_POR_NOME || row.CRIADO_POR_ID),
    createdAt: asString(row.CRIADO_EM),
    updatedBy: asString(
      row.ATUALIZADO_POR_NOME ||
        row.ATUALIZADO_POR_ID ||
        row.CRIADO_POR_NOME ||
        row.CRIADO_POR_ID,
    ),
    updatedAt: asString(row.ATUALIZADO_EM || row.CRIADO_EM),
    startedBy: asOptionalString(row.INICIADO_POR_NOME || row.INICIADO_POR_ID),
    startedAt: asOptionalString(row.INICIADO_EM),
    finalizedBy: asOptionalString(
      row.FINALIZADO_POR_NOME || row.FINALIZADO_POR_ID,
    ),
    finalizedAt: asOptionalString(row.FINALIZADO_EM),
    reopenedAt: asOptionalString(row.REABERTO_EM),
  };
};

const testPayload = (test: YieldTest) => ({
  nroempresa: company(),
  nome: test.name,
  data_teste: test.date || null,
  id_produto_entrada: test.inputProductId ? Number(test.inputProductId) : null,
  qtd_entrada: test.inputQuantity,
  peso_entrada: test.inputWeightKg,
  modo_peso_entrada: test.inputWeightMode === "pieces" ? "PECAS" : "TOTAL",
  peso_total_cache: test.inputTotalWeightKg,
  status: test.status,
  versao: test.version || undefined,
  pesos_entrada: (test.inputPieceWeightsKg || []).map((peso, index) => ({
    ordem: index + 1,
    peso,
  })),
  fluxos: test.flows.map((flow, flowIndex) => ({
    id_produto_raiz: Number(flow.rootProductId),
    ordem: flowIndex + 1,
    status: flow.status,
    etapa_atual: flow.currentStepIndex,
    etapas: flow.steps.map((step, stepIndex) => ({
      sequencia: stepIndex + 1,
      id_produto: Number(step.productId),
      tipo_etapa:
        stepIndex === flow.steps.length - 1
          ? "RESULTADO_FINAL"
          : "PROCESSAMENTO",
      peso_inicial: step.initialWeightKg,
      confirmada: step.confirmed,
      pesos: (step.pieceWeightsKg || []).map((peso, index) => ({
        ordem: index + 1,
        peso,
      })),
      descartes: step.discards.flatMap((discard) =>
        (discard.pieceWeightsKg?.length
          ? discard.pieceWeightsKg
          : [discard.weightKg]
        ).map((peso) => ({
          id_tipo_descarte: discard.discardTypeId
            ? Number(discard.discardTypeId)
            : null,
          nome: discard.name,
          manual: discard.manual,
          descricao_manual: discard.manual ? discard.name : null,
          peso,
        })),
      ),
    })),
  })),
});

export const rendimentoApi = {
  async catalogs() {
    const data = await request<{
      PRODUTOS: ApiRow[];
      TIPOS_DESCARTE: ApiRow[];
    }>(`/rendimento/catalogos?nroempresa=${company()}`);
    return {
      products: data.PRODUTOS.map(mapProduct),
      discardTypes: data.TIPOS_DESCARTE.map(mapDiscardType),
    };
  },
  async saveProduct(
    product: Partial<Product> & Pick<Product, "name" | "type">,
  ) {
    const editing = Boolean(product.id);
    const body = {
      nroempresa: company(),
      nome: product.name,
      tipo: product.type,
      id_produto_pai: product.parentId ? Number(product.parentId) : null,
      ids_produtos_origem: (product.originProductIds || []).map(Number),
      ids_tipos_descarte: (product.applicableDiscardIds || []).map(Number),
      ativo: product.active ?? true,
      versao: product.version,
    };
    await request(
      editing ? `/rendimento/produtos/${product.id}` : "/rendimento/produtos",
      { method: editing ? "PUT" : "POST", body: JSON.stringify(body) },
    );
  },
  async saveDiscard(discard: Partial<DiscardType> & Pick<DiscardType, "name">) {
    const editing = Boolean(discard.id);
    const body = {
      nroempresa: company(),
      nome: discard.name,
      descricao: discard.description || null,
      ordem: discard.order || null,
      ativo: discard.active ?? true,
      versao: discard.version,
    };
    await request(
      editing ? `/rendimento/descartes/${discard.id}` : "/rendimento/descartes",
      { method: editing ? "PUT" : "POST", body: JSON.stringify(body) },
    );
  },
  async listTests() {
    const data = await request<{ TESTES: ApiRow[] }>(
      `/rendimento/testes?nroempresa=${company()}&detalhado=true`,
    );
    return data.TESTES.map(mapYieldTest).sort((a, b) => b.number - a.number);
  },
  async getTest(id: string) {
    const data = await request<{ TESTE: ApiRow }>(
      `/rendimento/testes/${encodeURIComponent(id)}?nroempresa=${company()}`,
    );
    return mapYieldTest(data.TESTE);
  },
  async saveTest(test: YieldTest, create: boolean) {
    const result = await request<{ ID_TESTE: number }>(
      create
        ? "/rendimento/testes"
        : `/rendimento/testes/${encodeURIComponent(test.id)}`,
      {
        method: create ? "POST" : "PUT",
        body: JSON.stringify(testPayload(test)),
      },
    );
    return this.getTest(String(result.ID_TESTE));
  },
  async changeStatus(
    test: YieldTest,
    action: "INICIAR" | "FINALIZAR" | "CANCELAR" | "REABRIR" | "RESTAURAR",
  ) {
    await request(`/rendimento/testes/${encodeURIComponent(test.id)}/status`, {
      method: "POST",
      body: JSON.stringify({
        nroempresa: company(),
        acao: action,
        versao: test.version,
      }),
    });
    return this.getTest(test.id);
  },
  async deleteTest(test: YieldTest) {
    const params = new URLSearchParams({
      nroempresa: String(company()),
      versao: String(test.version),
    });
    await request(
      `/rendimento/testes/${encodeURIComponent(test.id)}?${params}`,
      { method: "DELETE" },
    );
  },
};
