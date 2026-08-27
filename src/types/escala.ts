export type EscalaTurno = "UNICO" | "MANHA" | "TARDE" | "NOITE";

export type EscalaStatus =
  | "RASCUNHO"
  | "ABERTA"
  | "CONFIRMADA"
  | "ENCERRADA"
  | "CANCELADA";

export type AgrotoolsAnaliseStatus =
  | "PENDENTE"
  | "EM_ANALISE"
  | "APTO"
  | "APTO_COM_RESSALVAS"
  | "INAPTO"
  | "ERRO";

export type EscalaOrigemRegistro = "ERP" | "MANUAL";

export type EscalaStatusConfiguracao =
  | "PENDENTE_CRIAR_ESCALA"
  | "PENDENTE_INCLUSAO"
  | "PENDENTE_COMPLEMENTO"
  | "COMPLETO";

export interface ApiMessage {
  success: boolean;
  message: string;
  id?: number;
}

export interface EscalaFiltro {
  nroempresa: number;
  id_escala?: number;
  data_inicio?: string;
  data_fim?: string;
  origem_registro?: EscalaOrigemRegistro;
  status_configuracao?: EscalaStatusConfiguracao;
}

export interface EscalaResumo {
  ID_ESCALA?: number | null;
  NROEMPRESA: number;
  DATA_ABATE: string;
  TURNO?: EscalaTurno | null;
  META_CABECAS?: number | null;
  STATUS_ESCALA?: EscalaStatus | null;
  OBSERVACAO_GERAL?: string | null;
  ATIVO?: number | null;
  VERSAO?: number | null;

  QTD_PEDIDOS?: number | null;
  QTD_PEDIDOS_INCLUIDOS?: number | null;
  QTD_PEDIDOS_PENDENTES?: number | null;
  QTD_MANUAIS?: number | null;
  QTD_PENDENTE_COMPLEMENTO?: number | null;
  QTD_ITENS?: number | null;

  QTD_VACAS?: number | null;
  QTD_BOIS?: number | null;
  QTD_TOTAL?: number | null;
  TOTAL_CABECAS?: number | null;

  QTD_TOTAL_PLANEJADO?: number | null;
  QTD_VACAS_PLANEJADO?: number | null;
  QTD_BOIS_PLANEJADO?: number | null;

  QTD_CHINA?: number | null;
  QTD_AGROTOOLS?: number | null;
  QTD_AGROTOOLS_ANALISE?: number | null;
  QTD_AGROTOOLS_RESSALVA?: number | null;
  RESTA_CABECAS?: number | null;
}

export interface EscalaPedidoErp {
  NROEMPRESA: number;
  SEQPEDIDO: number;
  NROPEDIDO: number;

  SEQPRODUTOR?: number | null;
  PRODUTOR?: string | null;
  DESC_PROPRIEDADE?: string | null;
  CIDADE_PROPRIEDADE?: string | null;
  UF_PROPRIEDADE?: string | null;

  SEQCOMPRADOR?: number | null;
  COMPRADOR?: string | null;

  DTAPEDIDO?: string | null;
  DTAEMBARQUE?: string | null;
  DTAABATE?: string | null;
  STATUS_NEGOCIACAO?: string | null;
  STATUS_PEDIDO?: string | null;

  QTD_PEDIDA_TOTAL?: number | null;
  QTD_VACA?: number | null;
  QTD_BOI?: number | null;
  QTD_CHINA?: number | null;
  CHINA?: string | null;
  AGROTOOLS_ERP?: string | null;

  VLRUNITARIO_VACA?: number | null;
  VLRUNITARIO_BOI?: number | null;
  VLRUNITARIO_PREMIO?: number | null;
  PRECO_BOI?: number | null;
  PRECO_VACA?: number | null;
  VALOR_PREMIO?: number | null;
  VLRUNITARIO_MIN?: number | null;
  VLRUNITARIO_MAX?: number | null;
  VLRUNITARIO_MEDIO_POND?: number | null;
}

export interface EscalaLinha {
  ORIGEM_REGISTRO: EscalaOrigemRegistro;
  ID_PLANEJAMENTO: string;

  NROEMPRESA: number;
  DATA_ABATE: string;

  ID_ESCALA?: number | null;
  ID_ESCALA_SUGERIDA?: number | null;
  QTD_ESCALAS_DIA?: number | null;

  TURNO?: EscalaTurno | null;
  META_CABECAS?: number | null;
  STATUS_ESCALA?: EscalaStatus | null;
  OBSERVACAO_GERAL?: string | null;
  VERSAO_ESCALA?: number | null;

  ID_ESCALA_PEDIDO_VINCULO?: number | null;
  ID_ESCALA_ITEM_MANUAL?: number | null;

  SEQPEDIDO?: number | null;
  NROPEDIDO?: number | null;
  NROPEDIDO_SNAPSHOT?: number | null;

  SEQPRODUTOR?: number | null;
  PRODUTOR?: string | null;
  DESC_PROPRIEDADE?: string | null;
  CIDADE_PROPRIEDADE?: string | null;
  UF_PROPRIEDADE?: string | null;

  SEQCOMPRADOR_ERP?: number | null;
  COMPRADOR_ERP?: string | null;
  COMPRADOR?: string | null;

  ID_COMPRADOR_ESCALA?: number | null;
  COMPRADOR_ESCALA?: string | null;
  COMPRADOR_EXIBICAO?: string | null;

  DTAPEDIDO?: string | null;
  DTAEMBARQUE?: string | null;
  STATUS_NEGOCIACAO?: string | null;
  STATUS_PEDIDO_ERP?: string | null;

  QTD_PEDIDA_TOTAL?: number | null;
  QTD_VACA?: number | null;
  QTD_BOI?: number | null;

  ARROBAS_VACA?: number | null;
  ARROBAS_BOI?: number | null;

  VLRUNITARIO_VACA?: number | null;
  VLRUNITARIO_BOI?: number | null;
  PRECO_BOI?: number | null;
  PRECO_VACA?: number | null;
  VALOR_PREMIO?: number | null;
  VLRUNITARIO_MIN?: number | null;
  VLRUNITARIO_MAX?: number | null;
  VLRUNITARIO_MEDIO_POND?: number | null;
  VLRUNITARIO_PREMIO?: number | null;

  PRAZO_DIAS?: number | null;
  CURRAL?: number | null;

  QTD_CHINA_TOTAL?: number | null;
  QTD_CHINA?: number | null;
  QTD_CHINA_VACA?: number | null;
  QTD_CHINA_BOI?: number | null;

  AGROTOOLS_ERP?: string | null;
  QTD_AGROTOOLS_VACA?: number | null;
  QTD_AGROTOOLS_BOI?: number | null;

  STATUS_AGROTOOLS_ANALISE?: AgrotoolsAnaliseStatus | null;
  ID_ANALISE_AGROTOOLS?: string | null;

  OBSERVACAO_REGISTRO?: string | null;
  OBSERVACAO_PEDIDO_ESCALA?: string | null;
  ORDEM_EXIBICAO?: number | null;
  VERSAO_REGISTRO?: number | null;
  VERSAO_VINCULO?: number | null;

  STATUS_CONFIGURACAO: EscalaStatusConfiguracao;
  CAMPOS_PENDENTES?: string | null;

  PODE_CRIAR_ESCALA?: "S" | "N" | null;
  PODE_INCLUIR_PEDIDO?: "S" | "N" | null;
  PODE_EDITAR?: "S" | "N" | null;
  PODE_INATIVAR?: "S" | "N" | null;
}

export interface CriarEscalaPayload {
  nroempresa: number;
  data_abate: string;
  turno: EscalaTurno;
  meta_cabecas: number;
  status_escala?: EscalaStatus;
  observacao_geral?: string | null;
  incluir_pedidos_pendentes?: boolean;
}

export interface EditarEscalaPayload extends CriarEscalaPayload {
  id_escala: number;
  versao: number;
}

export interface InativarEscalaPayload {
  id_escala: number;
  nroempresa: number;
  versao: number;
}

export interface BuscarPedidoErpPayload {
  nroempresa: number;
  nro_pedido: number;
  seqpedido?: number;
}

export interface CriarVinculoPedidoPayload {
  id_escala: number;
  nroempresa: number;
  nro_pedido: number;
  seqpedido?: number;
  observacao?: string | null;
  ordem_exibicao?: number;
  qtd_china_vaca?: number | null;
  qtd_china_boi?: number | null;
}

export interface CriarVinculosPedidosDiaPayload {
  id_escala: number;
  nroempresa: number;
  observacao?: string | null;
}

export interface EditarVinculoPedidoPayload {
  id_escala_pedido_vinculo: number;
  nroempresa: number;
  versao: number;

  id_comprador?: number | null;
  comprador_nome_snapshot?: string | null;
  observacao?: string | null;
  vlrunitario_premio?: number | null;
  prazo_dias?: number | null;
  curral?: number | null;

  arrobas_vaca?: number | null;
  arrobas_boi?: number | null;
  qtd_china_vaca?: number | null;
  qtd_china_boi?: number | null;
  qtd_agrotools_vaca?: number | null;
  qtd_agrotools_boi?: number | null;

  status_agrotools_analise?: AgrotoolsAnaliseStatus;
  id_analise_agrotools?: string | null;
  ordem_exibicao?: number;
}

export interface InativarVinculoPedidoPayload {
  id_escala_pedido_vinculo: number;
  nroempresa: number;
  versao: number;
}

export interface RegistroManualPayload {
  nroempresa: number;
  id_escala: number;

  nome_produtor: string;
  nome_fazenda?: string | null;
  municipio?: string | null;
  uf?: string | null;

  id_comprador?: number | null;
  comprador_nome_snapshot?: string | null;

  qtd_vaca: number;
  qtd_boi: number;
  arrobas_vaca?: number | null;
  arrobas_boi?: number | null;
  vlrunitario_vaca?: number | null;
  vlrunitario_boi?: number | null;

  vlrunitario_premio?: number | null;
  prazo_dias?: number | null;
  curral?: number | null;

  qtd_china_vaca: number;
  qtd_china_boi: number;
  qtd_agrotools_vaca: number;
  qtd_agrotools_boi: number;

  status_agrotools_analise?: AgrotoolsAnaliseStatus;
  id_analise_agrotools?: string | null;
  observacao?: string | null;
  ordem_exibicao?: number;
}

export interface EditarRegistroManualPayload extends RegistroManualPayload {
  id_escala_item_manual: number;
  versao: number;
}

export interface InativarRegistroManualPayload {
  id_escala_item_manual: number;
  nroempresa: number;
  versao: number;
}

export interface EscalaOcorrencia {
  ID_OCORRENCIA?: number;
  SISTEMA_ORIGEM?: string;
  TABELA_AFETADA?: string;
  ACAO?: string;
  COD_LINK?: number;
  USUARIO_ID?: number;
  USUARIO_NOME?: string;
  DETALHES?: string;
  ALTERACAO?: string;
  DATA_CRIACAO?: string;
  CRIADO_EM?: string;
}
