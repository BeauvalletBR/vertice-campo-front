import { n8nPost } from "./api";
import type {
  ApiMessage,
  BuscarPedidoErpPayload,
  CriarEscalaPayload,
  CriarVinculoPedidoPayload,
  CriarVinculosPedidosDiaPayload,
  EditarEscalaPayload,
  EditarRegistroManualPayload,
  EditarVinculoPedidoPayload,
  EscalaFiltro,
  EscalaLinha,
  EscalaOcorrencia,
  EscalaPedidoErp,
  EscalaResumo,
  InativarEscalaPayload,
  InativarRegistroManualPayload,
  InativarVinculoPedidoPayload,
  PrazoPagamento,
  RegistroManualPayload,
} from "../types/escala";

const env = import.meta.env;

const urls = {
  // Os mesmos nomes do frontend passam a apontar para o planejamento.
  select: env.VITE_N8N_WEBHOOK_URL_ESCALA_SELECT,
  resumo: env.VITE_N8N_WEBHOOK_URL_ESCALA_RESUMO,

  insert: env.VITE_N8N_WEBHOOK_URL_ESCALA_INSERT,
  editar: env.VITE_N8N_WEBHOOK_URL_ESCALA_EDITAR,
  inativar: env.VITE_N8N_WEBHOOK_URL_ESCALA_INATIVAR,
  ocorrencias: env.VITE_N8N_WEBHOOK_URL_ESCALA_OCORRENCIAS_SELECT,

  pedidoErpBuscar: env.VITE_N8N_WEBHOOK_URL_ESCALA_PEDIDO_ERP_BUSCAR,
  pedidoVinculoInsert:
    env.VITE_N8N_WEBHOOK_URL_ESCALA_PEDIDO_VINCULO_INSERT,
  pedidoVinculoInsertDia:
    env.VITE_N8N_WEBHOOK_URL_ESCALA_PEDIDO_VINCULO_INSERT_DIA,
  pedidoVinculoEditar:
    env.VITE_N8N_WEBHOOK_URL_ESCALA_PEDIDO_VINCULO_EDITAR,
  pedidoVinculoInativar:
    env.VITE_N8N_WEBHOOK_URL_ESCALA_PEDIDO_VINCULO_INATIVAR,
  prazoPagamentoSelect:
    env.VITE_N8N_WEBHOOK_URL_ESCALA_PRAZO_PAGTO_SELECT,

  manualInsert: env.VITE_N8N_WEBHOOK_URL_ESCALA_MANUAL_INSERT,
  manualEditar: env.VITE_N8N_WEBHOOK_URL_ESCALA_MANUAL_EDITAR,
  manualInativar: env.VITE_N8N_WEBHOOK_URL_ESCALA_MANUAL_INATIVAR,
} as const;

let cachedPaymentTerms: PrazoPagamento[] | null = null;
let paymentTermsPromise: Promise<PrazoPagamento[]> | null = null;

export const consultarEscala = (filtro: EscalaFiltro) =>
  n8nPost<EscalaLinha[]>(urls.select, filtro);

export const consultarResumoEscala = (filtro: EscalaFiltro) =>
  n8nPost<EscalaResumo[]>(urls.resumo, filtro);

export const consultarPrazosPagamento = async () => {
  if (cachedPaymentTerms) return cachedPaymentTerms;
  if (paymentTermsPromise) return paymentTermsPromise;

  paymentTermsPromise = n8nPost<PrazoPagamento[]>(
    urls.prazoPagamentoSelect,
    {},
  )
    .then((data) => {
      cachedPaymentTerms = Array.isArray(data) ? data : [];
      return cachedPaymentTerms;
    })
    .finally(() => {
      paymentTermsPromise = null;
    });

  return paymentTermsPromise;
};

export const criarEscala = (payload: CriarEscalaPayload) =>
  n8nPost<ApiMessage>(urls.insert, payload);

export const editarEscala = (payload: EditarEscalaPayload) =>
  n8nPost<ApiMessage>(urls.editar, payload);

export const inativarEscala = (payload: InativarEscalaPayload) =>
  n8nPost<ApiMessage>(urls.inativar, payload);

export const buscarPedidoErpEscala = (payload: BuscarPedidoErpPayload) =>
  n8nPost<EscalaPedidoErp[]>(urls.pedidoErpBuscar, payload);

export const criarVinculoPedidoEscala = (
  payload: CriarVinculoPedidoPayload,
) => n8nPost<ApiMessage>(urls.pedidoVinculoInsert, payload);

export const criarVinculosPedidosDiaEscala = (
  payload: CriarVinculosPedidosDiaPayload,
) => n8nPost<ApiMessage>(urls.pedidoVinculoInsertDia, payload);

export const editarVinculoPedidoEscala = (
  payload: EditarVinculoPedidoPayload,
) => n8nPost<ApiMessage>(urls.pedidoVinculoEditar, payload);

export const inativarVinculoPedidoEscala = (
  payload: InativarVinculoPedidoPayload,
) => n8nPost<ApiMessage>(urls.pedidoVinculoInativar, payload);

export const criarRegistroManualEscala = (payload: RegistroManualPayload) =>
  n8nPost<ApiMessage>(urls.manualInsert, payload);

export const editarRegistroManualEscala = (
  payload: EditarRegistroManualPayload,
) => n8nPost<ApiMessage>(urls.manualEditar, payload);

export const inativarRegistroManualEscala = (
  payload: InativarRegistroManualPayload,
) => n8nPost<ApiMessage>(urls.manualInativar, payload);

export const consultarOcorrenciasEscala = (
  id_escala: number,
  nroempresa: number,
) =>
  n8nPost<EscalaOcorrencia[]>(urls.ocorrencias, {
    id_escala,
    nroempresa,
  });
