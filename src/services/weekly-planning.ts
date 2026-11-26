import { getAuthHeaders, getBackendUrl } from "@/services/api";

export interface WeeklyPlanningConfig {
  ID_PCP_CONFIG?: number | null;
  VIGENCIA?: string | null;
  ARROBA_MEDIA: number;
  QTD_ANIMAIS_DIA: number;
  QUEBRA_FRIO_PCT: number;
  PCT_TRASEIRO: number;
  PCT_DIANTEIRO: number;
  PCT_PONTA_AGULHA: number;
  PCT_EXPORTACAO: number;
  PCT_PRODUCAO_CONGELADO: number;
  PCT_PRODUCAO_RESFRIADO: number;
  ALERTA_CONGELADO_KG: number;
  LIMITE_CONGELADO_KG: number;
  ALERTA_RESFRIADO_KG: number;
  LIMITE_RESFRIADO_KG: number;
  VERSAO?: number | null;
}

export interface WeeklyPlanningConfiguredProduct {
  SEQPRODUTO: number;
  PRODUTO: string;
  MACRO: "DT DESOS" | "TR DESOS" | string;
  SUBGRUPO_GER_REND: string;
  MAT_PRIMA?: string | null;
  RENDIMENTO_PCT: number;
  SELECIONADO: "S" | "N";
}

export interface WeeklyPlanningProduct {
  SEQPRODUTO: number;
  DESCRICAO: string;
  PESO_CONTRATO: number;
  SUBGRUPO_GER_REND?: string | null;
  MAT_PRIMA?: string | null;
  RESFCONG?: string | null;
  RENDIMENTO_PCT: number;
}

export interface WeeklyPlanningContract {
  SEQCONTRATO: number;
  NROCONTRATO: string;
  CLIENTE: string;
  DTA_EMBARQUE?: string | null;
  PRODUTOS: WeeklyPlanningProduct[];
}

export interface WeeklyPlanningDay {
  DATA: string;
  ANIMAIS_ESCALA: number;
  ARROBA_MEDIA_ESCALA: number;
  ANIMAIS_SIMULADOS: number;
  ARROBA_MEDIA_SIMULACAO: number;
  ANIMAIS_TOTAL: number;
  ARROBA_MEDIA_TOTAL: number;
  PECAS_DISPONIVEIS: number;
  PESO_CARCACA_BRUTO_KG: number;
  PESO_CARCACA_LIQUIDO_KG: number;
}

export interface WeeklyPlanningItem {
  ID_ITEM: number;
  ID_SEMANA: number;
  SEQCONTRATO: number;
  NROCONTRATO: string;
  CLIENTE: string;
  SEQPRODUTO: number;
  DESCRICAO_PRODUTO: string;
  SUBGRUPO_GER_REND: string;
  PESO_CONTRATO: number;
  PESO_PLANEJADO: number;
  RENDIMENTO_PCT: number;
  PECAS_SEG: number;
  PECAS_TER: number;
  PECAS_QUA: number;
  PECAS_QUI: number;
  PECAS_SEX: number;
  PECAS_SAB: number;
  PECAS_DOM: number;
  PESO_SEG: number;
  PESO_TER: number;
  PESO_QUA: number;
  PESO_QUI: number;
  PESO_SEX: number;
  PESO_SAB: number;
  PESO_DOM: number;
  TOTAL_PECAS: number;
  PESO_PROJETADO: number;
  DIAS_UTEIS: number;
  PECAS_DISPONIVEIS_SEMANA: number;
  PESO_POTENCIAL_SEMANA: number;
  SALDO_APOS_PLANEJAMENTO: number;
  OBSERVACAO?: string | null;
  VERSAO: number;
}

export interface WeeklyPlanningWeek {
  ID_SEMANA: number;
  NOME: string;
  DATA_INICIO: string;
  DATA_FIM: string;
  NROEMPRESA: number;
  STATUS: "RASCUNHO" | "EM_PLANEJAMENTO" | "FECHADO" | "CANCELADO";
  OBSERVACAO?: string | null;
  ARROBA_MEDIA: number;
  QTD_ANIMAIS_DIA: number;
  SIMULACAO_ARROBA_MEDIA: number;
  SIMULACAO_QTD_DIAS: number;
  SIMULACAO_ANIMAIS_DIA: number;
  QUEBRA_FRIO_PCT: number;
  PCT_TRASEIRO: number;
  PCT_DIANTEIRO: number;
  PCT_PONTA_AGULHA: number;
  VERSAO: number;
  DIAS_PRODUCAO: WeeklyPlanningDay[];
  ITENS: WeeklyPlanningItem[];
}

export interface WeeklyPlanningSubgroup {
  SUBGRUPO_GER_REND: string;
  MACRO?: string | null;
  MAT_PRIMA?: string | null;
  RENDIMENTO_REFERENCIA_PCT: number;
  QTD_PRODUTOS: number;
}

export interface WeeklyPlanningPanel {
  estrutura_configurada: boolean;
  semanas: WeeklyPlanningWeek[];
  contratos: WeeklyPlanningContract[];
  subgrupos: WeeklyPlanningSubgroup[];
  produtos_configuracao: WeeklyPlanningConfiguredProduct[];
  configuracao_desossa: WeeklyPlanningConfig;
}

export interface WeekPayload {
  nome: string;
  data_inicio: string;
  data_fim: string;
  nroempresa?: number;
  status: WeeklyPlanningWeek["STATUS"];
  observacao?: string | null;
  simulacao_arroba_media?: number;
  simulacao_qtd_dias?: number;
  simulacao_animais_dia?: number;
  versao?: number | null;
}

export type DistributionPayload = Pick<WeeklyPlanningItem,
  "PECAS_SEG" | "PECAS_TER" | "PECAS_QUA" | "PECAS_QUI" |
  "PECAS_SEX" | "PECAS_SAB" | "PECAS_DOM"
> & { observacao?: string | null; versao?: number | null };

const parseResponse = async <T>(response: Response): Promise<T> => {
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) window.dispatchEvent(new Event("sessao-expirada"));
  if (!response.ok) {
    const detail = data?.detail;
    const validation = Array.isArray(detail)
      ? detail.map((item) => item?.msg || "Dado inválido.").join(" ")
      : null;
    throw new Error(typeof detail === "string" ? detail : validation || "Não foi possível concluir a operação.");
  }
  return data as T;
};

const request = async <T>(path: string, init?: RequestInit) =>
  parseResponse<T>(await fetch(getBackendUrl(path), {
    ...init,
    headers: getAuthHeaders(Boolean(init?.body)),
  }));

const distributionBody = (payload: DistributionPayload) => ({
  pecas_seg: payload.PECAS_SEG,
  pecas_ter: payload.PECAS_TER,
  pecas_qua: payload.PECAS_QUA,
  pecas_qui: payload.PECAS_QUI,
  pecas_sex: payload.PECAS_SEX,
  pecas_sab: payload.PECAS_SAB,
  pecas_dom: payload.PECAS_DOM,
  observacao: payload.observacao,
  versao: payload.versao,
});

const company = () => {
  const stored = Number(localStorage.getItem("empresa_logada"));
  return Number.isFinite(stored) && stored > 0 ? stored : 1;
};

const weekBody = (payload: WeekPayload) => ({
  ...payload,
  nroempresa: payload.nroempresa || company(),
  simulacao_arroba_media: payload.simulacao_arroba_media || 0,
  simulacao_qtd_dias: payload.simulacao_qtd_dias || 0,
  simulacao_animais_dia: payload.simulacao_animais_dia || 0,
});

export const weeklyPlanningApi = {
  getPanel: () => request<WeeklyPlanningPanel>(`/planejamento-semanal/painel?nroempresa=${company()}`),
  createWeek: (payload: WeekPayload) => request<{ success: boolean; id_semana: number; message: string }>(
    "/planejamento-semanal/semanas",
    { method: "POST", body: JSON.stringify(weekBody(payload)) },
  ),
  updateWeek: (id: number, payload: WeekPayload) => request<{ success: boolean; message: string }>(
    `/planejamento-semanal/semanas/${id}`,
    { method: "PUT", body: JSON.stringify(weekBody(payload)) },
  ),
  addItem: (weekId: number, contractId: number, productId: number, pesoPlanejado: number, distribution: DistributionPayload) => request<{ success: boolean; id_item: number; message: string }>(
    `/planejamento-semanal/semanas/${weekId}/itens`,
    { method: "POST", body: JSON.stringify({ seqcontrato: contractId, seqproduto: productId, peso_planejado: pesoPlanejado, ...distributionBody(distribution) }) },
  ),
  updateItem: (id: number, payload: DistributionPayload) => request<{ success: boolean; message: string }>(
    `/planejamento-semanal/itens/${id}`,
    { method: "PUT", body: JSON.stringify(distributionBody(payload)) },
  ),
  deleteItem: (id: number) => request<{ success: boolean; message: string }>(
    `/planejamento-semanal/itens/${id}`,
    { method: "DELETE" },
  ),
  saveProducts: (seqprodutos: number[]) => request<{ success: boolean; message: string }>(
    "/planejamento-semanal/configuracao/produtos",
    { method: "PUT", body: JSON.stringify({ seqprodutos }) },
  ),
  saveConfiguration: (payload: WeeklyPlanningConfig) => request<{ success: boolean; message: string }>(
    "/planejamento-semanal/configuracao",
    {
      method: "PUT",
      body: JSON.stringify({
        vigencia: payload.VIGENCIA,
        arroba_media: payload.ARROBA_MEDIA,
        qtd_animais_dia: payload.QTD_ANIMAIS_DIA,
        quebra_frio_pct: payload.QUEBRA_FRIO_PCT,
        pct_traseiro: payload.PCT_TRASEIRO,
        pct_dianteiro: payload.PCT_DIANTEIRO,
        pct_ponta_agulha: payload.PCT_PONTA_AGULHA,
        pct_exportacao: payload.PCT_EXPORTACAO,
        pct_producao_congelado: payload.PCT_PRODUCAO_CONGELADO,
        pct_producao_resfriado: payload.PCT_PRODUCAO_RESFRIADO,
        alerta_congelado_kg: payload.ALERTA_CONGELADO_KG,
        limite_congelado_kg: payload.LIMITE_CONGELADO_KG,
        alerta_resfriado_kg: payload.ALERTA_RESFRIADO_KG,
        limite_resfriado_kg: payload.LIMITE_RESFRIADO_KG,
        versao: payload.VERSAO,
      }),
    },
  ),
};
