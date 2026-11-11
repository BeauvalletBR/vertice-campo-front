import { getAuthHeaders, getBackendUrl } from "@/services/api";

export interface ContractAllocationDetail {
  ORIGEM: "ORDEM_PRODUCAO" | "RESERVA_PEDIDO" | "MANUAL" | "PLANILHA" | "EXPEDICAO" | "MAIS_6_MESES";
  NUMERO_ORDEM?: number | string | null;
  NROCARGA?: number | string | null;
  NROPEDIDO?: number | string | null;
  SEQPEDIDO?: number | string | null;
  SEQCONTRATO_INDUSTRIA?: number | null;
  CODCONTRATO?: string | null;
  DATA_INICIO?: string | null;
  DATA_RENDIMENTO?: string | null;
  DATA_EMBARQUE?: string | null;
  STATUS_PEDIDO?: number | string | null;
  QUANTIDADE?: number | null;
  PESO: number;
  USUARIO?: string | null;
  EDITAVEL: boolean;
}

export interface ContractStockLot {
  SEQPRODUTO: number; DESCRPRODUTO?: string | null;
  DTAPRODUCAO?: string | null; LOTE?: string | null; SEQEMBALAGEM?: number | null;
  QUANTIDADE: number; PESO_FISICO: number; PESO_DISPONIVEL_ESTIMADO: number;
  PESO_LIVRE_ESTIMADO?: number;
  SITUACAO_VALIDADE?: "ELEGIVEL" | "ATENCAO" | "INCOMPATIVEL" | "SEM_REGRA" | "SEM_DATA" | "ACEITO_EXCECAO";
  SITUACAO_VALIDADE_ORIGINAL?: "INCOMPATIVEL" | null;
  MARGEM_DIAS?: number | null;
  CHAVE_LOTE?: string;
  DECISAO_LOTE?: "SEPARADO" | "DISPONIVEL" | "REPROCESSO" | "ALOCAR" | null;
  DTA_REPROCESSO_LOTE?: string | null; OBSERVACAO_LOTE?: string | null;
  VERSAO_DECISAO_LOTE?: number | null; DECISAO_ATUALIZADA_POR?: string | null;
  DECISAO_ATUALIZADA_EM?: string | null;
  SINTETICO_SEM_RASTREIO?: boolean;
}

export interface ContractProduct {
  SEQPRODUTO: number; DESCRICAO: string; PESOCONTRATO: number;
  VLRUNITARIO?: number | null; PTAX?: number | null; VLRUNITREAL?: number | null;
  PESO_DISPONIVEL_ERP: number; PESO_RESERVADO_TOTAL_VERTICE: number;
  PESO_RESERVADO_CONTRATO: number; PESO_RESERVADO_MANUAL: number;
  PESO_RESERVADO_6_MESES?: number;
  PESO_ATRELADO_ORDEM: number; PESO_RESERVADO_PEDIDO?: number;
  PESO_RESERVADO_PEDIDO_LIQUIDO?: number; PESO_SOBREPOSTO_ORDEM_PEDIDO?: number;
  PESO_BLOQUEADO_ERP?: number; QTD_BLOQUEADA_ERP?: number;
  PESO_ATRELADO_TOTAL: number;
  PESO_TRANSBORDADO?: number;
  ORIGENS_TRANSBORDO?: Array<"ORDEM_PRODUCAO" | "RESERVA_PEDIDO" | "MANUAL" | "MAIS_6_MESES">;
  PESO_EXPEDIDO?: number; EM_EXPEDICAO?: boolean;
  DETALHES_ATRELAMENTO: ContractAllocationDetail[]; PESO_LIVRE_VERTICE: number;
  LIMITE_RESERVA: number; SALDO_CONTRATO: number; VERSAO_RESERVA?: number | null;
  VERSAO_RESERVA_6_MESES?: number | null;
  PESO_MAIS_6_MESES_ERP?: number; PESO_DISPONIVEL_REGULAR?: number;
  ORIGEM_RESERVA?: "MANUAL" | "PLANILHA"; SUBGRUPO_GER_REND?: string | null;
  MAT_PRIMA?: string | null; RESFCONG?: string | null; PROPORCAO_CORTE?: number | null;
  META_PRODUTO?: number | null;
  VALIDADE?: number | null; TIPOVALIDADE?: "D" | "M" | "A" | null;
  DATA_REFERENCIA_VALIDADE?: string | null; DATA_MINIMA_PRODUCAO?: string | null;
  PESO_ESTOQUE_ELEGIVEL?: number; PESO_ESTOQUE_ATENCAO?: number;
  PESO_ESTOQUE_INCOMPATIVEL?: number; PESO_ESTOQUE_SEM_RASTREIO?: number;
  PESO_ESTOQUE_ACEITO_EXCECAO?: number;
  REGRA_VALIDADE_CONFIGURADA?: boolean;
  LOTES_ESTOQUE?: ContractStockLot[];
}

export interface ExportContract {
  SEQCONTRATO: number; NROCONTRATO: string; DTACONTRATO: string;
  DTA_EMBARQUE_ERP?: string | null;
  SEQCLIENTE?: number | null; NOMERAZAO: string; SITUACAO?: number | null;
  STATUS_ERP: string; PAISDESTINO?: string | null;
  PRIORIDADE: "BAIXA" | "MEDIA" | "ALTA" | "URGENTE";
  DTA_EMBARQUE_PLANEJADA?: string | null;
  STATUS_OPERACIONAL: "PENDENTE" | "PROGRAMADO" | "EM_SEPARACAO" | "PRONTO" | "EMBARCADO" | "EM_EXPEDICAO";
  OBSERVACAO?: string | null; DESCONSIDERADO: boolean;
  OBSERVACAO_DESCONSIDERACAO?: string | null; VERSAO_CONFIG?: number | null;
  PESO_TOTAL: number; PESO_RESERVADO: number; SALDO_TOTAL: number;
  PESO_EXPEDIDO?: number; EM_EXPEDICAO?: boolean; COBERTURA_EXPEDICAO_PCT?: number;
  PRAZO_DIAS?: number | null; PREVISAO_TERMINO_PRODUCAO?: string | null;
  DIAS_PREVISTOS_PRODUCAO?: number | null; PRODUTOS: ContractProduct[];
}

export interface ContractStock {
  SEQPRODUTO: number; DESCRPRODUTO: string; PESODISPONIVEL: number;
  PESODISPONIVEL6MESES?: number; PESO_DISPONIVEL_REGULAR?: number;
  PESO_VENDIDO_ATIVO: number; PESO_RESERVADO_VERTICE: number;
  PESO_RESERVADO_6_MESES?: number;
  PESO_ATRELADO_ORDEM: number; PESO_RESERVADO_PEDIDO?: number;
  PESO_RESERVADO_PEDIDO_LIQUIDO?: number; PESO_SOBREPOSTO_ORDEM_PEDIDO?: number;
  PESO_ATRELADO_TOTAL: number;
  PESO_BLOQUEADO_ERP?: number; QTD_BLOQUEADA_ERP?: number;
  PESO_LIVRE_VERTICE: number; ESTOQUE_SEM_VENDA: number;
  PESO_MAIS_6_MESES?: number; PESO_MAIS_6_MESES_LIVRE?: number;
  SITUACAO_6_MESES?: "SEPARADO" | "DISPONIVEL" | "REPROCESSO";
  DTA_REPROCESSO?: string | null; SEM_VENDA?: boolean;
  VERSAO_TRATAMENTO?: number | null;
  LOTES_ESTOQUE?: ContractStockLot[]; QTD_LOTES_ESTOQUE?: number;
  LOTES_LIVRES?: ContractStockLot[]; QTD_LOTES_LIVRES?: number;
  PESO_LIVRE_COM_DATA?: number; PESO_LIVRE_SEM_DATA?: number;
  PESO_LIVRE_SEM_RASTREIO?: number;
  DTA_PRODUCAO_MAIS_ANTIGA?: string | null; DTA_PRODUCAO_MAIS_RECENTE?: string | null;
}

export interface PcpConfig {
  ID_PCP_CONFIG?: number | null; VIGENCIA?: string | null;
  ARROBA_MEDIA: number; QTD_ANIMAIS_DIA: number; QUEBRA_FRIO_PCT: number;
  PCT_TRASEIRO: number; PCT_DIANTEIRO: number; PCT_PONTA_AGULHA: number;
  PCT_EXPORTACAO: number;
  PCT_PRODUCAO_CONGELADO: number; PCT_PRODUCAO_RESFRIADO: number;
  ALERTA_CONGELADO_KG: number; LIMITE_CONGELADO_KG: number;
  ALERTA_RESFRIADO_KG: number; LIMITE_RESFRIADO_KG: number; VERSAO?: number | null;
}

export interface PcpProductProjection extends ContractProduct {
  FALTANTE_PRODUZIR: number; ENTRADA_MATERIA_PRIMA_DIA: number;
  PESO_DISPONIVEL_CONSIDERADO?: number; PESO_COBERTO_PREVISAO?: number;
  PRODUCAO_DIA: number; DIAS_PRODUCAO?: number | null; TIPO_ESTOQUE: string;
  ESPERA_DIAS?: number | null; EXCESSO_PROJETADO: number;
  PENDENCIAS_DADOS?: string[];
}

export interface PcpDataIssue {
  ESCOPO: "CONFIGURACAO" | "PRODUTO"; SEQPRODUTO?: number | null;
  DESCRICAO: string; CAMPOS: string[]; MENSAGEM: string;
}

export interface PcpRecommendation {
  SEQCONTRATO: number; NROCONTRATO: string; CLIENTE: string; PAIS?: string | null;
  PRIORIDADE: string; STATUS_OPERACIONAL?: string | null;
  DATA_EMBARQUE?: string | null; PRAZO_DIAS?: number | null;
  PESO_TOTAL: number; PESO_COBERTO: number; PESO_ATRELADO_BRUTO: number;
  PESO_EXCEDENTE_VINCULADO: number; FALTANTE_PRODUZIR: number;
  COBERTURA_PCT: number; DIAS_ESTIMADOS?: number | null;
  CONCLUSAO_INDIVIDUAL?: string | null; ATRASO_DIAS: number;
  PRODUTO_GARGALO?: string | null; EXCESSO_PROJETADO: number;
  DECISAO: "INICIAR" | "PROXIMO" | "ENCAMINHADO" | "PROGRAMAR" | "CRITICO" | "AGUARDAR_ESTOQUE" | "COBERTO" | "REVISAR_DADOS" | "EM_EXPEDICAO";
  MOTIVO: string; ALERTAS: string[]; POSICAO: number;
  PENDENCIAS_DADOS?: PcpDataIssue[];
  INICIO_SEQUENCIA?: string | null; FIM_SEQUENCIA?: string | null;
  EXCESSO_CONGELADO: number; EXCESSO_RESFRIADO: number; SCORE: number;
  ESTOQUE_PROJETADO_TIPO?: string | null;
  ESTOQUE_PROJETADO_SITUACAO?: "NORMAL" | "ALERTA" | "LIMITE";
  ESTOQUE_PROJETADO_PCT?: number; ESTOQUE_PROJETADO_DATA?: string | null;
  ENTRADA_EXPORTAVEL_DIA?: number;
  DIAS_DESCOMPASSO?: number;
  MEDIA_ESPERA_PRODUTOS_DIAS?: number;
  ESTOQUE_GATILHO_PRODUTO?: string | null;
  ESTOQUE_GATILHO_ATUAL_KG?: number;
  ESTOQUE_GATILHO_KG?: number;
  FALTA_PARA_GATILHO_KG?: number;
  DIAS_ESPERA_GARGALO?: number;
  DATA_RECOMENDADA_INICIO?: string | null;
  PRODUTOS: PcpProductProjection[];
}

export interface PcpStockProjection {
  DATA: string; DIA_UTIL: boolean; CONTRATO_PRODUCAO?: string | null;
  ENTRADA_EXPORTAVEL_KG: number; MOTIVO_ENTRADA?: string; CONTRATOS_EXPEDIDOS: string[];
  CONTRATOS_EXPEDIDOS_CONGELADO?: string[]; CONTRATOS_EXPEDIDOS_RESFRIADO?: string[];
  SALDO_ANTERIOR_CONGELADO_KG: number; ENTRADA_CONGELADO_KG: number;
  SAIDA_CONGELADO_KG: number; SALDO_CONGELADO_KG: number;
  PERCENTUAL_CONGELADO: number; SITUACAO_CONGELADO: "NORMAL" | "ALERTA" | "LIMITE";
  SALDO_ANTERIOR_RESFRIADO_KG: number; ENTRADA_RESFRIADO_KG: number;
  SAIDA_RESFRIADO_KG: number; SALDO_RESFRIADO_KG: number;
  PERCENTUAL_RESFRIADO: number; SITUACAO_RESFRIADO: "NORMAL" | "ALERTA" | "LIMITE";
}

export interface PcpPlanning {
  CONFIGURADO: boolean; ENTRADA_DESOSSA: Record<string, number>;
  OCUPACAO: Array<{ TIPO: string; PESO_ATUAL: number; ALERTA: number; LIMITE: number; PERCENTUAL: number; SITUACAO: string }>;
  PROJECAO_ESTOQUE: PcpStockProjection[];
  RECOMENDACOES: PcpRecommendation[];
  RESUMO: { CONTRATOS_ANALISADOS: number; CONTRATOS_CRITICOS: number; PESO_FALTANTE: number; EXCESSO_PROJETADO: number };
}

export interface ContractsPanelResponse {
  estrutura_configurada: boolean; pcp_estrutura_configurada: boolean;
  estoque_6m_configurado?: boolean;
  estoque_lote_acao_configurado?: boolean;
  contratos: ExportContract[]; estoque: ContractStock[]; pcp_config: PcpConfig;
  planejamento: PcpPlanning; atualizado_em: string;
  expedicao_configurada?: boolean;
  reservas_pedidos_configurada?: boolean;
  pesos_analiticos_configurados?: boolean;
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
  ITENS: Array<{ LINHA: number; NROCONTRATO: string; SEQCONTRATO?: number; SEQPRODUTO: number; DESCRICAO?: string; PESO_ESTOQUE_PLANILHA: number; PESO_ORDEM_PRODUCAO?: number; PESO_RESERVA_ANTERIOR?: number; PESO_COMPLEMENTO_NECESSARIO?: number; PESO_MOVIMENTADO_ESTOQUE?: number; PESO_APLICADO: number; SITUACAO: string; MENSAGEM: string }>;
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
  getPanel: (refreshStock = false, recalculate = false) => {
    const query = new URLSearchParams();
    if (refreshStock) query.set("atualizar", "true");
    if (recalculate) query.set("recalcular", "true");
    const suffix = query.toString();
    return request<ContractsPanelResponse>(`/contratos/painel${suffix ? `?${suffix}` : ""}`);
  },
  saveConfig: (payload: ContractConfigPayload) => request<{ success: boolean; message: string }>("/contratos/configuracao", { method: "PUT", body: JSON.stringify(payload) }),
  savePcpConfig: (payload: PcpConfig) => request<{ success: boolean; message: string }>("/contratos/pcp/configuracao", {
    method: "PUT", body: JSON.stringify({
      vigencia: payload.VIGENCIA, arroba_media: payload.ARROBA_MEDIA,
      qtd_animais_dia: payload.QTD_ANIMAIS_DIA, quebra_frio_pct: payload.QUEBRA_FRIO_PCT,
      pct_traseiro: payload.PCT_TRASEIRO, pct_dianteiro: payload.PCT_DIANTEIRO,
      pct_ponta_agulha: payload.PCT_PONTA_AGULHA,
      pct_exportacao: payload.PCT_EXPORTACAO,
      pct_producao_congelado: payload.PCT_PRODUCAO_CONGELADO,
      pct_producao_resfriado: payload.PCT_PRODUCAO_RESFRIADO,
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
  saveAgedReservation: (payload: { seqcontrato: number; seqproduto: number; peso_reservado: number; versao: number | null }) => request<{ success: boolean; message: string }>("/contratos/reserva-6-meses", { method: "PUT", body: JSON.stringify(payload) }),
  saveStockTreatment: (payload: { seqproduto: number; situacao?: "SEPARADO" | "DISPONIVEL" | "REPROCESSO"; data_reprocesso?: string | null; sem_venda?: boolean; versao?: number | null }) => request<{ success: boolean; message: string }>("/contratos/estoque/tratamento", { method: "PUT", body: JSON.stringify(payload) }),
  saveStockLotTreatment: (payload: { seqproduto: number; data_producao: string; lote?: string | null; seqembalagem?: string | number | null; peso_referencia: number; situacao: "SEPARADO" | "DISPONIVEL" | "REPROCESSO" | "ALOCAR"; data_reprocesso?: string | null; observacao?: string | null; versao?: number | null }) => request<{ success: boolean; message: string; chave_lote: string }>("/contratos/estoque/lote/tratamento", { method: "PUT", body: JSON.stringify(payload) }),
};
