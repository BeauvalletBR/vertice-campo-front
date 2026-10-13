export interface ContractAllocationDetail {
  ORIGEM: "ORDEM_PRODUCAO" | "MANUAL";
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
  SEQPRODUTO: number;
  DESCRICAO: string;
  PESOCONTRATO: number;
  VLRUNITARIO?: number | null;
  PTAX?: number | null;
  VLRUNITREAL?: number | null;
  PESO_DISPONIVEL_ERP: number;
  PESO_RESERVADO_TOTAL_VERTICE: number;
  PESO_RESERVADO_CONTRATO: number;
  PESO_RESERVADO_MANUAL: number;
  PESO_ATRELADO_ORDEM: number;
  PESO_ATRELADO_TOTAL: number;
  DETALHES_ATRELAMENTO: ContractAllocationDetail[];
  PESO_LIVRE_VERTICE: number;
  LIMITE_RESERVA: number;
  SALDO_CONTRATO: number;
  VERSAO_RESERVA?: number | null;
}

export interface ExportContract {
  SEQCONTRATO: number;
  NROCONTRATO: string;
  DTACONTRATO: string;
  SEQCLIENTE?: number | null;
  NOMERAZAO: string;
  SITUACAO?: number | null;
  STATUS_ERP: string;
  PAISDESTINO?: string | null;
  PRIORIDADE: "BAIXA" | "MEDIA" | "ALTA" | "URGENTE";
  DTA_EMBARQUE_PLANEJADA?: string | null;
  STATUS_OPERACIONAL: "PENDENTE" | "PROGRAMADO" | "EM_SEPARACAO" | "PRONTO" | "EMBARCADO";
  OBSERVACAO?: string | null;
  VERSAO_CONFIG?: number | null;
  PESO_TOTAL: number;
  PESO_RESERVADO: number;
  SALDO_TOTAL: number;
  PRAZO_DIAS?: number | null;
  PRODUTOS: ContractProduct[];
}

export interface ContractStock {
  SEQPRODUTO: number;
  DESCRPRODUTO: string;
  PESODISPONIVEL: number;
  PESO_VENDIDO_ATIVO: number;
  PESO_RESERVADO_VERTICE: number;
  PESO_ATRELADO_ORDEM: number;
  PESO_ATRELADO_TOTAL: number;
  PESO_LIVRE_VERTICE: number;
  ESTOQUE_SEM_VENDA: number;
}

export interface ContractsPanelResponse {
  estrutura_configurada: boolean;
  contratos: ExportContract[];
  estoque: ContractStock[];
  atualizado_em: string;
}

export interface ContractConfigPayload {
  seqcontrato: number;
  prioridade: ExportContract["PRIORIDADE"];
  dta_embarque_planejada: string | null;
  status_operacional: ExportContract["STATUS_OPERACIONAL"];
  observacao: string | null;
  versao: number | null;
}

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(getBackendUrl(path), {
    ...init,
    headers: getAuthHeaders(Boolean(init?.body)),
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) window.dispatchEvent(new Event("sessao-expirada"));
  if (!response.ok) {
    const detail = data?.detail;
    const validationMessage = Array.isArray(detail)
      ? detail.map((item) => item?.msg || "Dado inválido.").join(" ")
      : null;
    throw new Error(
      typeof detail === "string"
        ? detail
        : validationMessage || "Não foi possível concluir a operação.",
    );
  }
  return data as T;
};

export const contractsApi = {
  getPanel: (refreshStock = false) =>
    request<ContractsPanelResponse>(
      `/contratos/painel${refreshStock ? "?atualizar=true" : ""}`,
    ),
  saveConfig: (payload: ContractConfigPayload) =>
    request<{ success: boolean; message: string }>("/contratos/configuracao", {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  saveReservation: (payload: {
    seqcontrato: number;
    seqproduto: number;
    peso_reservado: number;
    versao: number | null;
  }) =>
    request<{ success: boolean; message: string }>("/contratos/reserva", {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
};
import { getAuthHeaders, getBackendUrl } from "@/services/api";
