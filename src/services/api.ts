// src/services/api.ts

export interface Visit {
  id: string;
  date: string;
  ranchName: string;
  owner: string;
  city: string;
  status: "completed" | "pending";
}

export interface DashboardStats {
  region: string;
  ranchers: number;
  cities: number;
}

export interface Rancher {
  id: string;
  nome: string;
  ie: string;
  propriedade: string;
  car: "sim" | "nao";
  municipio: string;
  telefone: string;
  melhorDiaContato: string;
  proprietario: string;
  tipoAtividade: string;
  tipoTerminacao: string;
  numAnimais: number;
}

export interface ApiRancher {
  COD_PRODUTOR: number;
  NOME_PRODUTOR: string;
  NOME_FAZENDA: string;
  MUNICIPIO: string;
  UF_FAZENDA: string;
  INSCRICAO: string;
  NUMERO1: string | null;
  POSSUI_CAR: "S" | "N";
  DISTANCIA_CADASTRADA: number;
  QTD_COMPRADA_12M_CHINA: number;
  QTD_COMPRADA_12M_NAO_CHINA: number;
  JA_VENDEU: "S" | "N";
  DATA_ULTIMA_VISITA?: string | null; 
}

export interface ApiAgendamento {
  ID_AGENDAMENTO?: number;
  ID_COMPRADOR?: number;
  DATA_AGENDADA?: string;
  STATUS_AGENDAMENTO?: string;
  COD_PRODUTOR?: number;
  NOME_PRODUTOR?: string;
  NOME_FAZENDA?: string;
  MUNICIPIO?: string;
  UF_FAZENDA?: string;
  INSCRICAO?: string;
  NUMERO1?: string | null;
  POSSUI_CAR?: "S" | "N";
  DISTANCIA_CADASTRADA?: number;
  QTD_COMPRADA_12M_CHINA?: number;
  QTD_COMPRADA_12M_NAO_CHINA?: number;
  JA_VENDEU?: "S" | "N";
}

// NOVA INTERFACE PARA A CONSULTA DE RELATÓRIO DE VISITAS
export interface ApiVisita {
  ID_VISITA: number;
  ID_AGENDAMENTO: number | null;
  ID_COMPRADOR: number;
  DATA_REGISTRO_VISITA: string;
  COD_PRODUTOR: number | null;
  INSCRICAO: string | null;
  NOME_PRODUTOR: string | null;
  NOME_FAZENDA: string | null;
  MUNICIPIO: string | null;
  REGIAO: string | null;
  TELEFONE: string | null;
  POSSUI_CAR: string | null;
  GPS_LATITUDE: number | null;
  GPS_LONGITUDE: number | null;
  DISTANCIA_PERCORRIDA_REAL: number | null;
  MELHOR_DIA_CONTATO: string | null;
  NATUREZA_VISITA: string | null;
  NOME_RECEBEDOR: string | null;
  CARGO_RECEBEDOR: string | null;
  FRIGORIFICO_COSTUME: string | null;
  CABECAS_ABATIDAS_ANO: number | null;
  TIPO_VENDA: string | null;
  TIPO_ATIVIDADE: string | null;
  TIPO_TERMINACAO: string | null;
  EFETIVO_TOTAL_ANIMAIS: number | null;
  HABILITACAO: string | null;
  ASSINATURA_DIGITAL: string | null;
  QTD_30DIAS: number | null;
  SEXO_30DIAS: string | null;
  STATUS_30DIAS: string | null;
  QTD_60DIAS: number | null;
  SEXO_60DIAS: string | null;
  STATUS_60DIAS: string | null;
  QTD_90DIAS: number | null;
  SEXO_90DIAS: string | null;
  STATUS_90DIAS: string | null;
}

const mockStats: DashboardStats[] = [
  { region: "Norte", ranchers: 142, cities: 28 },
  { region: "Sul", ranchers: 385, cities: 42 },
];
const mockVisits: Visit[] = [];
const mockRanchers: Rancher[] = [];

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

let cachedPecuaristas: ApiRancher[] | null = null;
let fetchPromise: Promise<ApiRancher[]> | null = null;

// --- BUSCAR PECUARISTAS ---
export const fetchPecuaristasAgendamento = async (forceRefresh = false): Promise<ApiRancher[]> => {
  if (cachedPecuaristas && !forceRefresh) return cachedPecuaristas;
  if (fetchPromise && !forceRefresh) return fetchPromise;

  const loadFromApi = async () => {
    const url = import.meta.env.VITE_N8N_WEBHOOK_URL_PECUARISTAS;
    const token = import.meta.env.VITE_N8N_SECRET_TOKEN;
    const headerKey = import.meta.env.VITE_N8N_HEADER_KEY;
    try {
      const response = await fetch(url, { headers: { [headerKey]: token } });
      const data = await response.json();
      cachedPecuaristas = Array.isArray(data) ? data : [];
      return cachedPecuaristas;
    } catch (error) {
      return [];
    }
  };

  fetchPromise = loadFromApi();
  return fetchPromise;
};

// --- CONSULTAR AGENDAMENTOS PENDENTES ---
export const fetchAgendamentosPendentes = async (): Promise<ApiAgendamento[]> => {
  const url = import.meta.env.VITE_N8N_WEBHOOK_URL_AGENDAMENTO_CONSULTA;
  const token = import.meta.env.VITE_N8N_SECRET_TOKEN;
  const headerKey = import.meta.env.VITE_N8N_HEADER_KEY;
  try {
    const response = await fetch(url, { headers: { [headerKey]: token } });
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    return [];
  }
};

// --- NOVA FUNÇÃO: CONSULTAR RELATÓRIO DE VISITAS ---
export const fetchRelatorioVisitas = async (): Promise<ApiVisita[]> => {
  const url = import.meta.env.VITE_N8N_WEBHOOK_URL_VISITAS_CONSULTA;
  const token = import.meta.env.VITE_N8N_SECRET_TOKEN;
  const headerKey = import.meta.env.VITE_N8N_HEADER_KEY;
  
  if (!url) return [];

  try {
    const response = await fetch(url, { headers: { [headerKey]: token } });
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Falha API Consulta Relatório de Visitas:", error);
    return [];
  }
};

// --- SALVAR AGENDAMENTO SIMPLES ---
export const saveAgendamento = async (dados: any): Promise<{ success: boolean }> => {
  const url = import.meta.env.VITE_N8N_WEBHOOK_URL_AGENDAMENTO; 
  const token = import.meta.env.VITE_N8N_SECRET_TOKEN;
  const headerKey = import.meta.env.VITE_N8N_HEADER_KEY;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", [headerKey]: token },
      body: JSON.stringify(dados)
    });
    return { success: response.ok };
  } catch (error) { return { success: false }; }
};

// --- SALVAR A VISITA DE CAMPO ---
export const saveVisitaCampo = async (dados: any): Promise<{ success: boolean }> => {
  const url = import.meta.env.VITE_N8N_WEBHOOK_URL_VISITAS; 
  const token = import.meta.env.VITE_N8N_SECRET_TOKEN;
  const headerKey = import.meta.env.VITE_N8N_HEADER_KEY;
  if (!url) return { success: false };
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", [headerKey]: token },
      body: JSON.stringify(dados)
    });
    return { success: response.ok };
  } catch (error) { return { success: false }; }
};

export const api = {
  getStats: async (): Promise<DashboardStats[]> => { await delay(800); return mockStats; },
  getRecentVisits: async (): Promise<Visit[]> => { await delay(600); return mockVisits; },
  saveVisit: saveVisitaCampo, 
  searchRanchers: async (query: string): Promise<Rancher[]> => { 
    await delay(400); 
    const q = query.toLowerCase();
    return mockRanchers.filter(r => r.nome.toLowerCase().includes(q) || r.propriedade.toLowerCase().includes(q)); 
  },
  getRanchers: async (): Promise<Rancher[]> => { await delay(400); return mockRanchers; },
  getVisitasConsulta: fetchRelatorioVisitas, // Exportando a função nova
};