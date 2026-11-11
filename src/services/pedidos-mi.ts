import { getAuthHeaders, getBackendUrl } from "@/services/api";

export type PedidoMiStatus = "PENDENTE" | "PROGRAMADO" | "CARREGADO" | "CANCELADO";

export interface PedidoMiItem {
  ID_PEDIDO_MI_ITEM?: number;
  SEQPRODUTO?: number | null;
  PRODUTO: string;
  UNIDADE: string;
  PESO_PEDIDO: number;
  PRECO_PEDIDO?: number | null;
  ORDEM: number;
  PESO_SISTEMA: number;
  PRECO_SISTEMA?: number | null;
  DIFERENCA_PESO: number;
  DIFERENCA_PRECO?: number | null;
}

export interface PedidoMi {
  ID_PEDIDO_MI: number;
  NROEMPRESA: number;
  NOME_CARGA: string;
  NROPEDIDO?: number | null;
  NROCARGA?: string | null;
  DTA_EMBARQUE: string;
  SEQCLIENTE?: number | null;
  CLIENTE: string;
  UF?: string | null;
  STATUS: PedidoMiStatus;
  OBSERVACAO?: string | null;
  VERSAO: number;
  STATUS_PEDIDO_ERP?: string | null;
  STATUSCARREG_ERP?: string | number | null;
  DTAEXPEDICAO_ERP?: string | null;
  DTASAIDA_ERP?: string | null;
  ITENS: PedidoMiItem[];
}

export interface PedidoMiErpItem {
  SEQPRODUTO: number;
  PRODUTO: string;
  UNIDADE: string;
  PESO_SISTEMA: number;
  PRECO_SISTEMA?: number | null;
}

export interface PedidoMiErp {
  NROPEDIDO: number;
  NROEMPRESA: number;
  NROCARGA?: string | null;
  DTAEMBARQUE?: string | null;
  SEQCLIENTE?: number | null;
  CLIENTE: string;
  UF?: string | null;
  STATUS_PEDIDO?: string | null;
  STATUSCARREG?: string | number | null;
  DTAEXPEDICAO?: string | null;
  DTASAIDA?: string | null;
  ITENS: PedidoMiErpItem[];
}

export interface PedidoMiPanel {
  estrutura_configurada: boolean;
  view_erp_configurada: boolean;
  pedidos: PedidoMi[];
  resumo: {
    CARGAS: number;
    PEDIDOS: number;
    LANCAMENTOS: number;
    PESO_PLANEJADO: number;
    PESO_SISTEMA: number;
    DIFERENCA_PESO: number;
  };
}

export interface PedidoMiItemPayload {
  id_item?: number;
  seqproduto?: number | null;
  produto: string;
  unidade?: string;
  peso_pedido: number;
  preco_pedido?: number | null;
  ordem?: number;
}

export interface PedidoMiPayload {
  nroempresa?: number;
  nome_carga: string;
  nropedido?: number | null;
  nrocarga?: string | null;
  dta_embarque?: string | null;
  seqcliente?: number | null;
  cliente?: string | null;
  uf?: string | null;
  status: PedidoMiStatus;
  observacao?: string | null;
  versao?: number | null;
  itens: PedidoMiItemPayload[];
}

const parseResponse = async <T>(response: Response): Promise<T> => {
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) window.dispatchEvent(new Event("sessao-expirada"));
  if (!response.ok) {
    const detail = data?.detail;
    const validation = Array.isArray(detail)
      ? detail.map((item) => item?.msg || "Dado inválido.").join(" ")
      : null;
    throw new Error(
      typeof detail === "string"
        ? detail
        : validation || "Não foi possível concluir a operação.",
    );
  }
  return data as T;
};

const request = async <T>(path: string, init?: RequestInit) =>
  parseResponse<T>(
    await fetch(getBackendUrl(path), {
      ...init,
      headers: getAuthHeaders(Boolean(init?.body)),
    }),
  );

export const pedidosMiApi = {
  getPanel: (filters?: {
    dataInicio?: string;
    dataFim?: string;
    busca?: string;
    status?: string;
  }) => {
    const params = new URLSearchParams();
    if (filters?.dataInicio) params.set("data_inicio", filters.dataInicio);
    if (filters?.dataFim) params.set("data_fim", filters.dataFim);
    if (filters?.busca?.trim()) params.set("busca", filters.busca.trim());
    if (filters?.status) params.set("status", filters.status);
    const query = params.toString();
    return request<PedidoMiPanel>(`/pedidos-mi/painel${query ? `?${query}` : ""}`);
  },
  getErpOrder: (nropedido: number, nroempresa?: number) =>
    request<PedidoMiErp>(
      `/pedidos-mi/erp/${nropedido}${nroempresa ? `?nroempresa=${nroempresa}` : ""}`,
    ),
  create: (payload: PedidoMiPayload) =>
    request<{ success: boolean; id_pedido_mi: number; message: string }>("/pedidos-mi", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  update: (id: number, payload: PedidoMiPayload) =>
    request<{ success: boolean; message: string }>(`/pedidos-mi/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  remove: (id: number, versao?: number | null) =>
    request<{ success: boolean; message: string }>(`/pedidos-mi/${id}`, {
      method: "DELETE",
      body: JSON.stringify({ versao }),
    }),
};
