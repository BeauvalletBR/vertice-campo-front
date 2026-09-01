import { getAnimalBasePrice, getEffectivePremium } from "@/lib/escala-pricing";
import { getEffectivePaymentTermDays } from "@/lib/escala-prazo";
import {
  getAgrotoolsPlannedQuantity,
  toNumber,
  toOptionalNumber,
} from "@/lib/escala-planning";
import type {
  EditarRegistroManualPayload,
  EditarVinculoPedidoPayload,
  EscalaLinha,
  PrazoPagamento,
} from "@/types/escala";

const EMPTY_PAYMENT_TERMS = new Map<number, PrazoPagamento>();

const getTextOrNull = (value: unknown) => {
  const text = String(value ?? "").trim();
  return text || null;
};

export const getPlanningObservation = (row: EscalaLinha) =>
  getTextOrNull(row.OBSERVACAO_PEDIDO_ESCALA) ??
  getTextOrNull(row.OBSERVACAO_REGISTRO);

export const getPlanningBuyerId = (row: EscalaLinha) => {
  const scaleBuyerId = toNumber(row.ID_COMPRADOR_ESCALA);
  if (scaleBuyerId > 0) return scaleBuyerId;

  const erpBuyerId = toNumber(row.SEQCOMPRADOR_ERP);
  return erpBuyerId > 1 ? erpBuyerId : null;
};

export const getPlanningBuyerSnapshot = (row: EscalaLinha) => {
  if (toNumber(row.ID_COMPRADOR_ESCALA) > 0) {
    return (
      getTextOrNull(row.COMPRADOR_ESCALA) ??
      getTextOrNull(row.COMPRADOR_EXIBICAO)
    );
  }

  if (toNumber(row.SEQCOMPRADOR_ERP) > 1) {
    return (
      getTextOrNull(row.COMPRADOR_ERP) ??
      getTextOrNull(row.COMPRADOR_EXIBICAO)
    );
  }

  return (
    getTextOrNull(row.COMPRADOR_ESCALA) ??
    getTextOrNull(row.COMPRADOR_EXIBICAO)
  );
};

const getDisplayOrder = (row: EscalaLinha) => {
  const order = toNumber(row.ORDEM_EXIBICAO);
  return order > 0 ? order : undefined;
};

export const buildOrderUpdatePayload = (
  row: EscalaLinha,
  nroempresa: number,
  overrides: Partial<EditarVinculoPedidoPayload> = {},
  paymentTermsByCode: ReadonlyMap<number, PrazoPagamento> = EMPTY_PAYMENT_TERMS,
): EditarVinculoPedidoPayload => ({
  id_escala_pedido_vinculo: toNumber(row.ID_ESCALA_PEDIDO_VINCULO),
  nroempresa,
  versao: toNumber(row.VERSAO_REGISTRO || row.VERSAO_VINCULO) || 1,
  id_comprador: getPlanningBuyerId(row),
  comprador_nome_snapshot: getPlanningBuyerSnapshot(row),
  observacao: getPlanningObservation(row),
  vlrunitario_premio: getEffectivePremium(row),
  prazo_dias: getEffectivePaymentTermDays(row, paymentTermsByCode),
  curral: toOptionalNumber(row.CURRAL),
  arrobas_vaca: toOptionalNumber(row.ARROBAS_VACA),
  arrobas_boi: toOptionalNumber(row.ARROBAS_BOI),
  qtd_china_vaca: toNumber(row.QTD_CHINA_VACA),
  qtd_china_boi: toNumber(row.QTD_CHINA_BOI),
  qtd_agrotools_vaca: getAgrotoolsPlannedQuantity(row, "VACA"),
  qtd_agrotools_boi: getAgrotoolsPlannedQuantity(row, "BOI"),
  status_agrotools_analise: row.STATUS_AGROTOOLS_ANALISE ?? undefined,
  id_analise_agrotools: getTextOrNull(row.ID_ANALISE_AGROTOOLS),
  ordem_exibicao: getDisplayOrder(row),
  ...overrides,
});

export const buildManualUpdatePayload = (
  row: EscalaLinha,
  nroempresa: number,
  idEscala: number,
  overrides: Partial<EditarRegistroManualPayload> = {},
): EditarRegistroManualPayload => ({
  id_escala_item_manual: toNumber(row.ID_ESCALA_ITEM_MANUAL),
  nroempresa,
  versao: toNumber(row.VERSAO_REGISTRO) || 1,
  id_escala: idEscala,
  nome_produtor: String(row.PRODUTOR ?? "").trim(),
  nome_fazenda: getTextOrNull(row.DESC_PROPRIEDADE),
  municipio: getTextOrNull(row.CIDADE_PROPRIEDADE),
  uf: getTextOrNull(row.UF_PROPRIEDADE),
  id_comprador: getPlanningBuyerId(row),
  comprador_nome_snapshot: getPlanningBuyerSnapshot(row),
  qtd_vaca: toNumber(row.QTD_VACA),
  qtd_boi: toNumber(row.QTD_BOI),
  arrobas_vaca: toOptionalNumber(row.ARROBAS_VACA),
  arrobas_boi: toOptionalNumber(row.ARROBAS_BOI),
  vlrunitario_vaca: getAnimalBasePrice(row, "VACA"),
  vlrunitario_boi: getAnimalBasePrice(row, "BOI"),
  vlrunitario_premio: getEffectivePremium(row),
  prazo_dias: toOptionalNumber(row.PRAZO_DIAS),
  curral: toOptionalNumber(row.CURRAL),
  qtd_china_vaca: toNumber(row.QTD_CHINA_VACA),
  qtd_china_boi: toNumber(row.QTD_CHINA_BOI),
  qtd_agrotools_vaca: getAgrotoolsPlannedQuantity(row, "VACA"),
  qtd_agrotools_boi: getAgrotoolsPlannedQuantity(row, "BOI"),
  status_agrotools_analise: row.STATUS_AGROTOOLS_ANALISE ?? undefined,
  id_analise_agrotools: getTextOrNull(row.ID_ANALISE_AGROTOOLS),
  observacao: getPlanningObservation(row),
  ordem_exibicao: getDisplayOrder(row),
  ...overrides,
});
