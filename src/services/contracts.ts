import { getAuthHeaders, getBackendUrl } from "@/services/api";

export interface ContractAllocationDetail {
  ORIGEM: "ORDEM_PRODUCAO" | "MANUAL" | "PLANILHA";
  NUMERO_ORDEM?: number | string | null;
  SEQCONTRATO_INDUSTRIA?: number | null;
  CODCONTRATO?: string | null;
  DATA_INICIO?: string | null;
  DATA_RENDIMENTO?: string | null;
  PESO: number;
  USUARIO?: string | null;
  EDITAVEL: boolean;
}

export interface ContractProduct {
  SEQPRODUTO: number; DESCRICAO: string; PESOCONTRATO: number;
  VLRUNITARIO?: number | null; PTAX?: number | null; VLRUNITREAL?: number | null;
  PESO_DISPONIVEL_ERP: number; PESO_RESERVADO_TOTAL_VERTICE: number;
  PESO_RESERVADO_CONTRATO: number; PESO_RESERVADO_MANUAL: number;
  PESO_ATRELADO_ORDEM: number; PESO_ATRELADO_TOTAL: number;
  DETALHES_ATRELAMENTO: ContractAllocationDetail[]; PESO_LIVRE_VERTICE: number;
  LIMITE_RESERVA: number; SALDO_CONTRATO: number; VERSAO_RESERVA?: number | null;
  ORIGEM_RESERVA?: "MANUAL" | "PLANILHA"; SUBGRUPO_GER_REND?: string | null;
  MAT_PRIMA?: string | null; RESFCONG?: string | null; PROPORCAO_CORTE?: number | null;
  META_PRODUTO?: number | null;
}

export interface ExportContract {
  SEQCONTRATO: number; NROCONTRATO: string; DTACONTRATO: string;
  SEQCLIENTE?: number | null; NOMERAZAO: string; SITUACAO?: number | null;
  STATUS_ERP: string; PAISDESTINO?: string | null;
  PRIORIDADE: "BAIXA" | "MEDIA" | "ALTA" | "URGENTE";
  DTA_EMBARQUE_PLANEJADA?: string | null;
  STATUS_OPERACIONAL: "PENDENTE" | "PROGRAMADO" | "EM_SEPARACAO" | "PRONTO" | "EMBARCADO";
  OBSERVACAO?: string | null; DESCONSIDERADO: boolean;
  OBSERVACAO_DESCONSIDERACAO?: string | null; VERSAO_CONFIG?: number | null;
  PESO_TOTAL: number; PESO_RESERVADO: number; SALDO_TOTAL: number;
  PRAZO_DIAS?: number | null; PRODUTOS: ContractProduct[];
}

export interface ContractStock {
  SEQPRODUTO: number; DESCRPRODUTO: string; PESODISPONIVEL: number;
  PESO_VENDIDO_ATIVO: number; PESO_RESERVADO_VERTICE: number;
  PESO_ATRELADO_ORDEM: number; PESO_ATRELADO_TOTAL: number;
  PESO_LIVRE_VERTICE: number; ESTOQUE_SEM_VENDA: number;
}

export interface PcpConfig {
  ID_PCP_CONFIG?: number | null; VIGENCIA?: string | null;
  ARROBA_MEDIA: number; QTD_ANIMAIS_DIA: number; QUEBRA_FRIO_PCT: number;
  PCT_TRASEIRO: number; PCT_DIANTEIRO: number; PCT_PONTA_AGULHA: number;
  ALERTA_CONGELADO_KG: number; LIMITE_CONGELADO_KG: number;
  ALERTA_RESFRIADO_KG: number; LIMITE_RESFRIADO_KG: number; VERSAO?: number | null;
}

export interface PcpProductProjection extends ContractProduct {
  FALTANTE_PRODUZIR: number; ENTRADA_MATERIA_PRIMA_DIA: number;
  PRODUCAO_DIA: number; DIAS_PRODUCAO?: number | null; TIPO_ESTOQUE: string;
  ESPERA_DIAS?: number | null; EXCESSO_PROJETADO: number;
}

export interface PcpRecommendation {
  SEQCONTRATO: number; NROCONTRATO: string; CLIENTE: string; PAIS?: string | null;
  PRIORIDADE: string; DATA_EMBARQUE?: string | null; PRAZO_DIAS?: number | null;
  PESO_TOTAL: number; PESO_COBERTO: number; PESO_ATRELADO_BRUTO: number;
  PESO_EXCEDENTE_VINCULADO: number; FALTANTE_PRODUZIR: number;
  COBERTURA_PCT: number; DIAS_ESTIMADOS?: number | null;
  CONCLUSAO_INDIVIDUAL?: string | null; ATRASO_DIAS: number;
  PRODUTO_GARGALO?: string | null; EXCESSO_PROJETADO: number;
  DECISAO: "INICIAR" | "PROXIMO" | "PROGRAMAR" | "CRITICO" | "SEGURAR" | "COBERTO" | "REVISAR_DADOS";
  MOTIVO: string; ALERTAS: string[]; POSICAO: number;
  INICIO_SEQUENCIA?: string | null; FIM_SEQUENCIA?: string | null;
  EXCESSO_CONGELADO: number; EXCESSO_RESFRIADO: number; SCORE: number;
  PRODUTOS: PcpProductProjection[];
}

export interface PcpPlanning {
  CONFIGURADO: boolean; ENTRADA_DESOSSA: Record<string, number>;
  OCUPACAO: Array<{ TIPO: string; PESO_ATUAL: number; ALERTA: number; LIMITE: number; PERCENTUAL: number; SITUACAO: string }>;
  RECOMENDACOES: PcpRecommendation[];
  RESUMO: { CONTRATOS_ANALISADOS: number; CONTRATOS_CRITICOS: number; PESO_FALTANTE: number; EXCESSO_PROJETADO: number };
}

export interface ContractsPanelResponse {
  estrutura_configurada: boolean; pcp_estrutura_configurada: boolean;
  contratos: ExportContract[]; estoque: ContractStock[]; pcp_config: PcpConfig;
  planejamento: PcpPlanning; atualizado_em: string;
}

export interface ContractConfigPayload {
  seqcontrato: number; prioridade: ExportContract["PRIORIDADE"];
  dta_embarque_planejada: string | null;
  status_operacional: ExportContract["STATUS_OPERACIONAL"];
  observacao: string | null; versao: number | null;
}

export interface SpreadsheetImportResult {
  success: boolean; aplicado: boolean; nome_arquivo: string; hash_arquivo: string;
  id_importacao?: number;
  RESUMO: { LINHAS_LIDAS: number; LINHAS_SEM_ESTOQUE: number; RESERVAS_APLICAVEIS: number; PESO_APLICAVEL: number; DATAS_APLICAVEIS: number; IGNORADOS: number; RESERVAS_SUBSTITUIDAS: number };
  ITENS: Array<{ LINHA: number; NROCONTRATO: string; SEQCONTRATO?: number; SEQPRODUTO: number; DESCRICAO?: string; PESO_ESTOQUE_PLANILHA: number; PESO_APLICADO: number; SITUACAO: string; MENSAGEM: string }>;
  DATAS: Array<{ NROCONTRATO: string; SEQCONTRATO?: number; DATA_ATUAL?: string | null; DATA_IMPORTADA?: string | null; SITUACAO: string }>;
}

const parseResponse = async <T>(response: Response): Promise<T> => {
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) window.dispatchEvent(new Event("sessao-expirada"));
  if (!response.ok) {
    const detail = data?.detail;
    const validation = Array.isArray(detail) ? detail.map((item) => item?.msg || "Dado inválido.").join(" ") : null;
    throw new Error(typeof detail === "string" ? detail : validation || "Não foi possível concluir a operação.");
  }
  return data as T;
};

const request = async <T>(path: string, init?: RequestInit) =>
  parseResponse<T>(await fetch(getBackendUrl(path), { ...init, headers: getAuthHeaders(Boolean(init?.body)) }));

export const contractsApi = {
  getPanel: (refreshStock = false) => request<ContractsPanelResponse>(`/contratos/painel${refreshStock ? "?atualizar=true" : ""}`),
  saveConfig: (payload: ContractConfigPayload) => request<{ success: boolean; message: string }>("/contratos/configuracao", { method: "PUT", body: JSON.stringify(payload) }),
  savePcpConfig: (payload: PcpConfig) => request<{ success: boolean; message: string }>("/contratos/pcp/configuracao", {
    method: "PUT", body: JSON.stringify({
      vigencia: payload.VIGENCIA, arroba_media: payload.ARROBA_MEDIA,
      qtd_animais_dia: payload.QTD_ANIMAIS_DIA, quebra_frio_pct: payload.QUEBRA_FRIO_PCT,
      pct_traseiro: payload.PCT_TRASEIRO, pct_dianteiro: payload.PCT_DIANTEIRO,
      pct_ponta_agulha: payload.PCT_PONTA_AGULHA,
      alerta_congelado_kg: payload.ALERTA_CONGELADO_KG, limite_congelado_kg: payload.LIMITE_CONGELADO_KG,
      alerta_resfriado_kg: payload.ALERTA_RESFRIADO_KG, limite_resfriado_kg: payload.LIMITE_RESFRIADO_KG,
      versao: payload.VERSAO,
    }),
  }),
  importSpreadsheet: async (file: File, apply = false) => {
    const headers = getAuthHeaders(false) as Record<string, string>;
    headers["Content-Type"] = "application/octet-stream";
    headers["X-Filename"] = encodeURIComponent(file.name);
    return parseResponse<SpreadsheetImportResult>(await fetch(getBackendUrl(`/contratos/importacao/planilha?aplicar=${apply}`), { method: "POST", headers, body: file }));
  },
  setDisregarded: (payload: { seqcontrato: number; desconsiderado: boolean; observacao?: string | null; versao: number | null }) => request<{ success: boolean; message: string }>("/contratos/desconsiderar", { method: "PUT", body: JSON.stringify(payload) }),
  saveReservation: (payload: { seqcontrato: number; seqproduto: number; peso_reservado: number; versao: number | null }) => request<{ success: boolean; message: string }>("/contratos/reserva", { method: "PUT", body: JSON.stringify(payload) }),
};
