import { getAuthHeaders, getBackendUrl } from "@/services/api";

export interface ProjecaoPecasLesao {
  gravidade?: number | string | null;
  lado_da_carcaca?: string | null;
  [key: string]: unknown;
}

export interface ProjecaoPecasAnimal {
  lote?: number | string | null;
  animal?: number | string | null;
  data?: string | null;
  acabamento?: number | string | null;
  classe?: string | null;
  sexo?: string | null;
  sigla_sexo?: string | null;
  raca?: string | null;
  sigla_raca?: string | null;
  denticao?: number | string | null;
  brinco?: string | null;
  lesoes?: ProjecaoPecasLesao[] | null;
  conformacao?: number | string | null;
  [key: string]: unknown;
}

export interface ProjecaoPecasResponse {
  data_inicial: string;
  data_final: string;
  total: number;
  animais: ProjecaoPecasAnimal[];
}

export interface ProjecaoPecasMateriaPrima {
  DTAABATE: string;
  SEQPRODUTO: number;
  PRODUTO: string;
  QUANTIDADE_DISPONIVEL: number;
  PESO_LIQUIDO_DISPONIVEL: number;
  QUARTEIO: string;
}

export interface ProjecaoPecasDataDisponivel {
  DTAABATE: string;
  QUARTEIO: string;
  QUANTIDADE_DISPONIVEL: number;
  TIPOS_PRODUTO: number;
  PESO_LIQUIDO: number;
}

export interface ProjecaoPecasClassificacao {
  CLASSE: string;
  QUANTIDADE_HISTORICA: number;
  PERCENTUAL_MEDIO: number;
  QUANTIDADE_PROJETADA: number;
}

export type ProjecaoPecasClasse = "AUSENTE" | "ESCASSO" | "MEDIANO" | "UNIFORME" | "EXCESSIVO";

export interface ProjecaoPecasSelecaoConfig {
  ID_SELECAO?: number;
  NOME: string;
  ORDEM: number;
  PECAS_POR_QUARTEIO: number;
  SEQPRODUTOS: number[];
  PERCENTUAIS: Record<ProjecaoPecasClasse, number>;
}

export interface ProjecaoPecasGrupoConfig {
  ID_GRUPO?: number;
  NOME: string;
  QUARTEIO: "DIANTEIRO" | "TRASEIRO" | "PONTA DE AGULHA";
  ORDEM: number;
  SELECOES: ProjecaoPecasSelecaoConfig[];
}

export interface ProjecaoPecasConfiguracao {
  CLASSES: ProjecaoPecasClasse[];
  GRUPOS: ProjecaoPecasGrupoConfig[];
}

export interface ProjecaoPecasProdutoProjetado {
  ID_SELECAO: number;
  NOME: string;
  SEQPRODUTOS: number[];
  QUANTIDADE_PROJETADA: number;
  POR_CLASSIFICACAO: Record<ProjecaoPecasClasse, number>;
}

export interface ProjecaoPecasGrupoProjetado {
  ID_GRUPO: number;
  GRUPO: string;
  QUARTEIO: string;
  QUANTIDADE_BASE: number;
  CLASSIFICACOES_BASE: Record<ProjecaoPecasClasse, number>;
  SELECOES: ProjecaoPecasProdutoProjetado[];
}

export interface ProjecaoPecasProjecaoResponse {
  DTAABATE: string;
  QUARTEIO: string;
  PADRAO_CORTE: string;
  TOTAL_CORTES: number;
  QUANTIDADE_DISPONIVEL: number;
  PESO_LIQUIDO_DISPONIVEL: number;
  TOTAL_ANIMAIS_CLASSIFICADOS: number;
  SEQUENCIAS_CONSULTADAS: number[];
  SEQUENCIAS_SEM_CLASSIFICACAO: number[];
  ITENS: ProjecaoPecasMateriaPrima[];
  CLASSIFICACOES: ProjecaoPecasClassificacao[];
  PROJECOES_PRODUTOS: ProjecaoPecasGrupoProjetado[];
}

export interface ProjecaoPecasRealizadoFiltro {
  data_abate?: string;
  data_rendimento_inicio?: string;
  data_rendimento_fim?: string;
  nroordem?: number;
  seqproduto?: number;
  seqproduto_excluir?: number;
  quarteio?: "" | "DIANTEIRO" | "TRASEIRO" | "PONTA DE AGULHA";
}

export interface ProjecaoPecasRealizadoProdutoData {
  SEQPRODUTO: number;
  PRODUTO: string;
  QUANTIDADE: number;
  PESO_TOTAL: number;
}

export interface ProjecaoPecasRealizadoResumoData {
  DATA_ABATE?: string | null;
  QUANTIDADE_REGISTROS: number;
  QUANTIDADE_ANIMAIS: number;
  PESO_TOTAL: number;
  TOTAL_CLASSIFICADOS: number;
  TOTAL_SEM_CLASSIFICACAO: number;
  REGISTROS_SEM_SEQUENCIA: number;
  SEQUENCIAS_SEM_CLASSIFICACAO: number[];
  SEQPRODUTOS_ENTRADA: ProjecaoPecasRealizadoProdutoData[];
}

export interface ProjecaoPecasRealizadoItem {
  SEQESTOQUE: number;
  SEQPRODUTO: number;
  PRODUTO: string;
  PESOLIQUIDO: number;
  DATARENDIMENTO?: string | null;
  DATAABATE?: string | null;
  SEQUENCIADIA?: number | null;
  SEQABATE?: number | null;
  NROORDEM?: number | null;
  DTAPRODUCAO?: string | null;
  SEQESTOQUEDERIVADO?: number | null;
  STATUS?: number | string | null;
  QUARTEIO: string;
  DATA_CLASSIFICACAO?: string | null;
  CLASSE?: string | null;
  DADOS_CLASSIFICACAO?: ProjecaoPecasAnimal | null;
}

export interface ProjecaoPecasRealizadoClasse {
  CLASSE: ProjecaoPecasClasse;
  QUANTIDADE: number;
  PERCENTUAL: number;
}

export interface ProjecaoPecasComparativoRendimento {
  DATA_RENDIMENTO: string;
  ID_GRUPO?: number | null;
  GRUPO: string;
  ID_SELECAO?: number | null;
  SELECAO?: string | null;
  TIPO_VINCULO: "DIRETO" | "SUBGRUPO" | "SEM_GRUPO" | "SEM_REALIZADO";
  SUBGRUPO_GER_REND?: string | null;
  PADRAO_CORTE?: string | null;
  QUANTIDADE_PROJETADA?: number | null;
  QUANTIDADE_REALIZADA: number;
  DIFERENCA_QUANTIDADE?: number | null;
  PESO_LIQUIDO: number;
  SOBRA_UTILIZADA_QUANTIDADE: number;
  SOBRA_UTILIZADA_PESO: number;
  SEQPRODUTOS: number[];
  PRODUTOS: string[];
  ORDENS: Array<number | string>;
}

export interface ProjecaoPecasRealizadoResponse {
  TOTAL_REGISTROS: number;
  TOTAL_CLASSIFICADOS: number;
  TOTAL_SEM_CLASSIFICACAO: number;
  PESO_TOTAL: number;
  TOTAL_ORDENS: number;
  AVISOS: string[];
  ITENS: ProjecaoPecasRealizadoItem[];
  CLASSIFICACOES: ProjecaoPecasRealizadoClasse[];
  PROJECOES_PRODUTOS: ProjecaoPecasGrupoProjetado[];
  RESUMO_DATAS: ProjecaoPecasRealizadoResumoData[];
  COMPARATIVO_RENDIMENTO: ProjecaoPecasComparativoRendimento[];
  AVISO_COMPARATIVO?: string | null;
}

const readError = async (response: Response) => {
  const payload = await response.json().catch(() => null);
  const detail = payload?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((item) => item?.msg || String(item)).join("; ");
  }
  return `Erro na API Beef Quality (${response.status}).`;
};

export async function consultarProjecaoPecas(
  dataInicial: string,
  dataFinal: string,
): Promise<ProjecaoPecasResponse> {
  const response = await fetch(getBackendUrl("/projecao-pecas/animais"), {
    method: "POST",
    headers: getAuthHeaders(true),
    body: JSON.stringify({
      data_inicial: dataInicial,
      data_final: dataFinal,
    }),
  });

  if (response.status === 401) {
    window.dispatchEvent(new Event("sessao-expirada"));
  }
  if (!response.ok) throw new Error(await readError(response));
  return response.json();
}

export async function consultarRealizadoProjecaoPecas(
  filtro: ProjecaoPecasRealizadoFiltro,
): Promise<ProjecaoPecasRealizadoResponse> {
  const response = await fetch(getBackendUrl("/projecao-pecas/realizado"), {
    method: "POST",
    headers: getAuthHeaders(true),
    body: JSON.stringify(filtro),
  });
  if (response.status === 401) window.dispatchEvent(new Event("sessao-expirada"));
  if (!response.ok) throw new Error(await readError(response));
  return response.json();
}

export async function gerarProjecaoMateriasPrimas(
  dataAbate: string,
  quarteio: "" | "DIANTEIRO" | "TRASEIRO" | "PONTA DE AGULHA",
  padraoCorte = "ELEGIVEIS",
): Promise<ProjecaoPecasProjecaoResponse> {
  const response = await fetch(getBackendUrl("/projecao-pecas/projecao"), {
    method: "POST",
    headers: getAuthHeaders(true),
    body: JSON.stringify({
      data_abate: dataAbate,
      quarteio: quarteio || null,
      padrao_corte: padraoCorte,
    }),
  });
  if (response.status === 401) window.dispatchEvent(new Event("sessao-expirada"));
  if (!response.ok) throw new Error(await readError(response));
  return response.json();
}

export async function consultarDatasDisponiveisProjecaoPecas(): Promise<ProjecaoPecasDataDisponivel[]> {
  const response = await fetch(getBackendUrl("/projecao-pecas/datas-disponiveis"), {
    headers: getAuthHeaders(),
  });
  if (response.status === 401) window.dispatchEvent(new Event("sessao-expirada"));
  if (!response.ok) throw new Error(await readError(response));
  const payload = await response.json();
  return Array.isArray(payload?.DATAS) ? payload.DATAS : [];
}

export async function consultarConfiguracaoProjecaoPecas(): Promise<ProjecaoPecasConfiguracao> {
  const response = await fetch(getBackendUrl("/projecao-pecas/configuracao"), {
    headers: getAuthHeaders(),
  });
  if (response.status === 401) window.dispatchEvent(new Event("sessao-expirada"));
  if (!response.ok) throw new Error(await readError(response));
  return response.json();
}

export async function salvarConfiguracaoProjecaoPecas(
  configuracao: ProjecaoPecasConfiguracao,
): Promise<ProjecaoPecasConfiguracao> {
  const response = await fetch(getBackendUrl("/projecao-pecas/configuracao"), {
    method: "PUT",
    headers: getAuthHeaders(true),
    body: JSON.stringify({
      grupos: configuracao.GRUPOS.map((grupo) => ({
        id_grupo: grupo.ID_GRUPO,
        nome: grupo.NOME,
        quarteio: grupo.QUARTEIO,
        ordem: grupo.ORDEM,
        selecoes: grupo.SELECOES.map((selecao) => ({
          id_selecao: selecao.ID_SELECAO,
          nome: selecao.NOME,
          ordem: selecao.ORDEM,
          pecas_por_quarteio: selecao.PECAS_POR_QUARTEIO,
          seqprodutos: selecao.SEQPRODUTOS,
          percentuais: selecao.PERCENTUAIS,
        })),
      })),
    }),
  });
  if (response.status === 401) window.dispatchEvent(new Event("sessao-expirada"));
  if (!response.ok) throw new Error(await readError(response));
  return response.json();
}
