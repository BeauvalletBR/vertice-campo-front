import { getAnimalBasePrice, getEffectivePremium } from "@/lib/escala-pricing";
import {
  getAgrotoolsPlannedQuantity,
  toNumber,
  toOptionalNumber,
} from "@/lib/escala-planning";
import type {
  EditarRegistroManualPayload,
  EditarVinculoPedidoPayload,
  EscalaLinha,
} from "@/types/escala";

const getTextOrNull = (value: unknown) => {
  const text = String(value ?? "").trim();
  return text || null;
};

export const getPlanningObservation = (row: EscalaLinha) =>
  getTextOrNull(row.OBSERVACAO_PEDIDO_ESCALA) ??
  getTextOrNull(row.OBSERVACAO_REGISTRO);

export const getPlanningBuyerId = (row: EscalaLinha) => {
  const buyerId = toNumber(row.ID_COMPRADOR_ESCALA);
  return buyerId > 0 ? buyerId : null;
};

export const getPlanningBuyerSnapshot = (row: EscalaLinha) =>
  getTextOrNull(row.COMPRADOR_ESCALA) ??
  getTextOrNull(row.COMPRADOR_EXIBICAO);

const getDisplayOrder = (row: EscalaLinha) => {
  const order = toNumber(row.ORDEM_EXIBICAO);
  return order > 0 ? order : undefined;
};

export const buildOrderUpdatePayload = (
  row: EscalaLinha,
  nroempresa: number,
  overrides: Partial<EditarVinculoPedidoPayload> = {},
): EditarVinculoPedidoPayload => ({
  id_escala_pedido_vinculo: toNumber(row.ID_ESCALA_PEDIDO_VINCULO),
  nroempresa,
  versao: toNumber(row.VERSAO_REGISTRO || row.VERSAO_VINCULO) || 1,
  id_comprador: getPlanningBuyerId(row),
  comprador_nome_snapshot: getPlanningBuyerSnapshot(row),
  observacao: getPlanningObservation(row),
  vlrunitario_premio: getEffectivePremium(row),
  prazo_dias: toOptionalNumber(row.PRAZO_DIAS),
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
