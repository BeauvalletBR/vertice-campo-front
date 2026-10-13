import { getBackendUrl, n8nPost } from "./api";
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
  EscalaPreparacaoAutomatica,
  EscalaChinaSincronizacao,
  EscalaLinha,
  EscalaOcorrencia,
  EscalaPedidoErp,
  EscalaRealizadoMensal,
  EscalaRealizadoMensalFiltro,
  EscalaResumo,
  InativarEscalaPayload,
  InativarRegistroManualPayload,
  InativarVinculoPedidoPayload,
  PrazoPagamento,
  RegistroManualPayload,
} from "../types/escala";

const urls = {
  select: getBackendUrl("/escala/planejamento/select"),
  resumo: getBackendUrl("/escala/planejamento/resumo"),
  realizadoMensal: getBackendUrl("/escala/realizado-mensal"),
  planejamentoPreparar: getBackendUrl("/escala/planejamento/preparar"),
  insert: getBackendUrl("/escala/insert"),
  editar: getBackendUrl("/escala/editar"),
  inativar: getBackendUrl("/escala/inativar"),
  ocorrencias: getBackendUrl("/escala/ocorrencias/select"),
  pedidoErpBuscar: getBackendUrl("/escala/pedido-erp/buscar"),
  pedidoVinculoInsert: getBackendUrl("/escala/pedido-vinculo/insert"),
  pedidoVinculoInsertDia: getBackendUrl("/escala/pedido-vinculo/insert-dia"),
  pedidoVinculoEditar: getBackendUrl("/escala/pedido-vinculo/editar"),
  pedidoVinculoInativar: getBackendUrl("/escala/pedido-vinculo/inativar"),
  prazoPagamentoSelect: getBackendUrl("/escala/prazo-pagto/select"),
  chinaSincronizar: getBackendUrl("/escala/china/sincronizar"),
  chinaAlertasCiente: getBackendUrl("/escala/china/alertas/ciente"),
  manualInsert: getBackendUrl("/escala/manual/insert"),
  manualEditar: getBackendUrl("/escala/manual/editar"),
  manualInativar: getBackendUrl("/escala/manual/inativar"),
} as const;

let cachedPaymentTerms: PrazoPagamento[] | null = null;
let paymentTermsPromise: Promise<PrazoPagamento[]> | null = null;

export const consultarEscala = (filtro: EscalaFiltro) =>
  n8nPost<EscalaLinha[]>(urls.select, filtro);

export const consultarResumoEscala = (filtro: EscalaFiltro) =>
  n8nPost<EscalaResumo[]>(urls.resumo, filtro);

export const consultarRealizadoMensalEscala = (
  filtro: EscalaRealizadoMensalFiltro,
) => n8nPost<EscalaRealizadoMensal[]>(urls.realizadoMensal, filtro);

export const prepararPlanejamentoEscala = (filtro: EscalaFiltro) => {
  if (!urls.planejamentoPreparar) {
    return Promise.reject(
      new Error("URL do preparo automático da Escala não configurada."),
    );
  }
  return n8nPost<EscalaPreparacaoAutomatica>(urls.planejamentoPreparar, filtro);
};

export const sincronizarChinaEscala = (filtro: EscalaFiltro) => {
  if (!urls.chinaSincronizar) {
    return Promise.reject(
      new Error("URL de sincronização dos alertas China não configurada."),
    );
  }
  return n8nPost<EscalaChinaSincronizacao>(urls.chinaSincronizar, filtro);
};

export const confirmarAlertasChinaEscala = (
  nroempresa: number,
  idsAjuste: number[],
) => {
  if (!urls.chinaAlertasCiente) {
    return Promise.reject(new Error("URL de confirmação dos alertas China não configurada."));
  }
  return n8nPost<ApiMessage>(urls.chinaAlertasCiente, {
    nroempresa,
    ids_ajuste: idsAjuste,
  });
};

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
