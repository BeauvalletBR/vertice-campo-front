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
  VENDAREPRESENTANTE: "S" | "N";
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
  VENDAREPRESENTANTE?: "S" | "N";
}

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

export interface ApiUsuario {
  SEQUSUARIO: number;
  CODUSUARIO: string;
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

const getAuthHeaders = (isJson = false) => {
  const tokenAPI = import.meta.env.VITE_N8N_SECRET_TOKEN;
  const headerKey = import.meta.env.VITE_N8N_HEADER_KEY || "x-api-key";
  const jwtToken = localStorage.getItem("jwt_token"); 

  const headers: Record<string, string> = {
    [headerKey]: tokenAPI,
  };

  if (isJson) {
    headers["Content-Type"] = "application/json";
  }

  if (jwtToken) {
    headers["Authorization"] = `Bearer ${jwtToken}`; 
  }

  return headers;
};

const checkSessionExpired = (response: Response) => {
  if (response.status === 401) {
    window.dispatchEvent(new Event('sessao-expirada'));
  }
};

export const fetchPecuaristasAgendamento = async (forceRefresh = false): Promise<ApiRancher[]> => {
  if (cachedPecuaristas && cachedPecuaristas.length > 0 && !forceRefresh) {
    return cachedPecuaristas;
  }

  const loadFromApi = async () => {
    const url = import.meta.env.VITE_N8N_WEBHOOK_URL_PECUARISTAS;
    try {
      const response = await fetch(url, { headers: getAuthHeaders() });
      checkSessionExpired(response);
      
      if (response.status === 401 || response.status === 403) {
         console.warn("Acesso Negado: Você não tem permissão no módulo ADMIN.");
         fetchPromise = null; 
         return [];
      }
      
      const data = await response.json();
      
      if (data.success === false) {
          return [];
      }

      if (Array.isArray(data) && data.length > 0) {
          cachedPecuaristas = data;
      }
      return Array.isArray(data) ? data : [];
    } catch (error) {
      fetchPromise = null;
      return [];
    }
  };

  fetchPromise = loadFromApi();
  return fetchPromise;
};

export const fetchAgendamentosPendentes = async (): Promise<ApiAgendamento[]> => {
  const url = import.meta.env.VITE_N8N_WEBHOOK_URL_AGENDAMENTO_CONSULTA;
  try {
    const response = await fetch(url, { headers: getAuthHeaders() });
    checkSessionExpired(response); 
    
    if (response.status === 401 || response.status === 403) {
        console.warn("Acesso Negado: Módulo OPERACIONAL.");
        return [];
    }
    
    if (!response.ok) return [];
    const data = await response.json();
    if (data.success === false) return [];
    
    return Array.isArray(data) ? data : [];
  } catch (error) {
    return [];
  }
};

export const fetchRelatorioVisitas = async (): Promise<ApiVisita[]> => {
  const url = import.meta.env.VITE_N8N_WEBHOOK_URL_VISITAS_CONSULTA;
  if (!url) return [];

  try {
    const response = await fetch(url, { headers: getAuthHeaders() });
    checkSessionExpired(response);
    
    if (response.status === 401 || response.status === 403) return [];
    if (!response.ok) return [];
    
    const data = await response.json();
    if (data.success === false) return [];
    
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Falha API Consulta Relatório de Visitas:", error);
    return [];
  }
};

export const fetchUsuarios = async (): Promise<ApiUsuario[]> => {
  const url = import.meta.env.VITE_N8N_WEBHOOK_URL_USUARIOS;
  if (!url) return [];
  try {
    const response = await fetch(url, { headers: getAuthHeaders() });
    checkSessionExpired(response);

    if (response.status === 401 || response.status === 403) return [];
    if (!response.ok) return [];
    const data = await response.json();
    if (data.success === false) return [];
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Falha ao buscar usuários:", error);
    return [];
  }
};

export const saveAgendamento = async (dados: any): Promise<{ success: boolean; message?: string }> => {
  const url = import.meta.env.VITE_N8N_WEBHOOK_URL_AGENDAMENTO; 
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: getAuthHeaders(true),
      body: JSON.stringify(dados)
    });
    checkSessionExpired(response); 
    
    if (response.status === 403) return { success: false, message: "Acesso Negado (ADMIN)." };
    return { success: response.ok };
  } catch (error) { return { success: false, message: "Erro de rede" }; }
};

export const saveVisitaCampo = async (dados: any): Promise<{ success: boolean; message?: string }> => {
  const url = import.meta.env.VITE_N8N_WEBHOOK_URL_VISITAS; 
  if (!url) return { success: false };
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: getAuthHeaders(true),
      body: JSON.stringify(dados)
    });
    checkSessionExpired(response);
    
    if (response.status === 403) return { success: false, message: "Acesso Negado (OPERACIONAL)." };
    return { success: response.ok };
  } catch (error) { return { success: false, message: "Erro de rede" }; }
};

export const vincularVisitaPecuarista = async (dados: any): Promise<{ success: boolean; message?: string }> => {
  const url = import.meta.env.VITE_N8N_WEBHOOK_URL_VISITAS_VINCULAR;
  if (!url) return { success: false, message: "URL de vínculo não configurada no .env" };
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: getAuthHeaders(true),
      body: JSON.stringify(dados)
    });
    checkSessionExpired(response);
    
    if (response.status === 403) return { success: false, message: "Acesso Negado (OPERACIONAL)." };
    
    const data = await response.json();
    return { success: response.ok && data.success !== false, message: data.message };
  } catch (error) { 
    return { success: false, message: "Erro de rede" }; 
  }
};

export const inativarVisita = async (id_visita: string | number): Promise<{ success: boolean; message?: string }> => {
  const url = import.meta.env.VITE_N8N_WEBHOOK_URL_VISITAS_INATIVAR;
  if (!url) return { success: false, message: "URL de inativação não configurada no .env" };
  
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: getAuthHeaders(true),
      body: JSON.stringify({ id_visita: Number(id_visita) })
    });
    checkSessionExpired(response);
    
    if (response.status === 403) return { success: false, message: "Acesso Negado." };
    
    const data = await response.json();
    return { success: response.ok && data.success !== false, message: data.message };
  } catch (error) {
    return { success: false, message: "Erro de comunicação com o servidor." };
  }
};

export const inativarAgendamento = async (id_agendamento: string | number): Promise<{ success: boolean; message?: string }> => {
  const url = import.meta.env.VITE_N8N_WEBHOOK_URL_AGENDAMENTO_INATIVAR;
  if (!url) return { success: false, message: "URL de inativação não configurada no .env" };
  
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: getAuthHeaders(true),
      body: JSON.stringify({ id_agendamento: Number(id_agendamento) })
    });
    checkSessionExpired(response);
    
    if (response.status === 403) return { success: false, message: "Acesso Negado. Você não tem nível suficiente." };
    
    const data = await response.json();
    return { success: response.ok && data.success !== false, message: data.message };
  } catch (error) {
    return { success: false, message: "Erro de comunicação com o servidor." };
  }
};

export const editarAgendamento = async (dados: any): Promise<{ success: boolean; message?: string }> => {
  const url = import.meta.env.VITE_N8N_WEBHOOK_URL_AGENDAMENTO_EDITAR;
  if (!url) return { success: false, message: "URL de edição de agendamento não configurada" };
  
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: getAuthHeaders(true),
      body: JSON.stringify(dados)
    });
    checkSessionExpired(response);
    
    if (response.status === 403) return { success: false, message: "Acesso Negado." };
    
    const data = await response.json();
    return { success: response.ok && data.success !== false, message: data.message };
  } catch (error) {
    return { success: false, message: "Erro de comunicação." };
  }
};

export const editarVisita = async (dados: any): Promise<{ success: boolean; message?: string }> => {
  const url = import.meta.env.VITE_N8N_WEBHOOK_URL_VISITAS_EDITAR;
  if (!url) return { success: false, message: "URL de edição de visita não configurada" };
  
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: getAuthHeaders(true),
      body: JSON.stringify(dados)
    });
    checkSessionExpired(response);
    
    if (response.status === 403) return { success: false, message: "Acesso Negado." };
    
    const data = await response.json();
    return { success: response.ok && data.success !== false, message: data.message };
  } catch (error) {
    return { success: false, message: "Erro de comunicação." };
  }
};

export interface LoginResponse {
  success: boolean;
  message?: string;
  user?: {
    id: string | number;
    login: string;
    name: string;
    role: "ADMIN" | "COMPRADOR";
    modulos?: string[];
    nivel?: number; 
  };
  access_token?: string; 
}

export const realizarLogin = async (login: string, senha: string, empresa: string): Promise<LoginResponse> => {
  const url = import.meta.env.VITE_N8N_WEBHOOK_URL_LOGIN; 
  const tokenAPI = import.meta.env.VITE_N8N_SECRET_TOKEN;
  const headerKey = import.meta.env.VITE_N8N_HEADER_KEY || "x-api-key";

  if (!url) return { success: false, message: "URL de login não configurada no .env" };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", [headerKey]: tokenAPI },
      body: JSON.stringify({ login, senha, empresa: Number(empresa) }) 
    });
    
    if (response.status === 403) return { success: false, message: "Acesso Negado. Token de API inválido." };

    if (!response.ok) {
      return { success: false, message: "Erro de comunicação com o servidor de autenticação." };
    }

    const data = await response.json();
    
    if (data.success && data.access_token) {
      localStorage.setItem("jwt_token", data.access_token);
      localStorage.setItem("user_data", JSON.stringify(data.user));
      localStorage.setItem("empresa_logada", empresa); 
    }

    return data;
  } catch (error) {
    return { success: false, message: "Sistema indisponível no momento." };
  }
};

export const realizarLogout = () => {
  localStorage.removeItem("jwt_token");
  localStorage.removeItem("user_data");
  localStorage.removeItem("empresa_logada");
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
  getVisitasConsulta: fetchRelatorioVisitas,
  realizarLogin,
  realizarLogout, 
  getUsuarios: fetchUsuarios, 
  vincularVisita: vincularVisitaPecuarista,
  inativarVisita,
  inativarAgendamento, 
  fetchAgendamentosPendentes,
  editarAgendamento,
  editarVisita
};