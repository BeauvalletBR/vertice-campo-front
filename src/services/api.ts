
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
  name: string;
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
  NOME_REPRESENTANTE?: string | null; 
  LATITUDE?: number | string | null;
  LONGITUDE?: number | string | null;
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
  LATITUDE?: number;
  LONGITUDE?: number;
}

// 1. 👇 NOVA INTERFACE PARA OS LOTES DINÂMICOS 👇
export interface ApiLote {
  prazo_dias: number;
  quantidade_cabecas: number;
  sexo_animal: string;
  status_lote: string;
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
  DISTANCIA_CADASTRADA: number | null;
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
  
  // 2. 👇 O ARRAY DE LOTES SUBSTITUI AS VARIÁVEIS ANTIGAS 👇
  LOTES?: ApiLote[];
  
  IMAGEM?: string | null;
  OBSERVACOES?: string | null;
  DISTANCIAERP?: number | null;
  NROPEDIDO?: string | null;
  STATUS_AUDITORIA?: string | null;
  QUANTIDADECOMPRADA?: number | null;

}

export interface ApiVisitaDetalhe {
  ID_VISITA: number;
  ASSINATURA_DIGITAL: string | null;
  IMAGEM: string | null;
  OBSERVACOES: string | null;
}

export interface ApiAuditoria {
  ID_RESPOSTA: number;
  ID_VISITA: number;
  COD_PRODUTOR: number | null;
  NOME_FAZENDA: string;
  REQUISITO: string;
  PERGUNTA: string;
  RESPOSTA: "C" | "NC" | "NA";
  DATA_AUDITORIA: string;
  OBSERVACOES: string | null;
}

export interface ApiUsuario {
  SEQUSUARIO: number;
  CODUSUARIO: string;
  NOME?: string;
  NOMEUSUARIO?: string;
  NOME_USUARIO?: string;
  USUARIO_NOME?: string;
  DESCRICAO?: string;
  DESCUSUARIO?: string;
}

export interface ApiHistoricoCompra {
  COD_PRODUTOR: number;
  SEQ_PROPRIEDADE: number;
  MES_ANO: string;
  QTD_CHINA: number;
  QTD_NAO_CHINA: number;
  TOTAL_COMPRADO: number;
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

let cachedHistorico: ApiHistoricoCompra[] | null = null;
let fetchHistoricoPromise: Promise<ApiHistoricoCompra[]> | null = null;

const getAuthHeaders = (isJson = false) => {
  const apiToken = import.meta.env.VITE_N8N_SECRET_TOKEN;
  const apiHeaderName = import.meta.env.VITE_N8N_HEADER_KEY || "x-api-key";
  const jwtToken = localStorage.getItem("jwt_token");
  const configuredApiUrl =
    import.meta.env.VITE_N8N_WEBHOOK_URL_LOGIN ||
    import.meta.env.VITE_N8N_WEBHOOK_URL_USUARIOS ||
    "";
  const endpointOrigin = new URL(configuredApiUrl, window.location.origin).origin;
  const usesSameOriginProxy = endpointOrigin === window.location.origin;

  const headers: Record<string, string> = {};

  if (apiToken && !usesSameOriginProxy) {
    headers[apiHeaderName] = apiToken;
  }

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


/**
 * Função genérica para consumir os webhooks autenticados do n8n.
 * Reaproveita o mesmo Header Auth e o mesmo JWT utilizados pelo restante do sistema.
 */
export async function n8nPost<T>(
  url: string | undefined,
  body: unknown
): Promise<T> {
  if (!url) {
    throw new Error("URL do webhook n8n não configurada no arquivo .env.");
  }

  const response = await fetch(url, {
    method: "POST",
    headers: getAuthHeaders(true),
    cache: "no-store",
    body: JSON.stringify(body),
  });

  checkSessionExpired(response);

  const contentType = response.headers.get("content-type") || "";
  let responseBody: unknown;

  try {
    responseBody = contentType.includes("application/json")
      ? await response.json()
      : await response.text();
  } catch {
    responseBody = null;
  }

  if (!response.ok) {
    const message =
      typeof responseBody === "object" &&
      responseBody !== null &&
      "message" in responseBody
        ? String(
            (responseBody as { message?: unknown }).message ||
              `Erro HTTP ${response.status}.`
          )
        : String(responseBody || `Erro HTTP ${response.status}.`);

    throw new Error(message);
  }

  if (
    typeof responseBody === "object" &&
    responseBody !== null &&
    "success" in responseBody &&
    (responseBody as { success?: boolean }).success === false
  ) {
    throw new Error(
      String(
        (responseBody as { message?: unknown }).message ||
          "A API retornou uma falha."
      )
    );
  }

  return responseBody as T;
}

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

export const fetchHistoricoCompras = async (forceRefresh = false): Promise<ApiHistoricoCompra[]> => {
  if (cachedHistorico && cachedHistorico.length > 0 && !forceRefresh) {
    return cachedHistorico;
  }

  const loadFromApi = async () => {
    const url = import.meta.env.VITE_N8N_WEBHOOK_URL_PECUARISTAS_HISTORICO;
    if (!url) return [];

    try {
      const response = await fetch(url, { headers: getAuthHeaders() });
      checkSessionExpired(response);
      
      if (response.status === 401 || response.status === 403) {
          fetchHistoricoPromise = null; 
          return [];
      }
      
      const data = await response.json();
      
      if (data.success === false) {
          return [];
      }

      if (Array.isArray(data) && data.length > 0) {
          cachedHistorico = data;
      }
      return Array.isArray(data) ? data : [];
    } catch (error) {
      fetchHistoricoPromise = null;
      return [];
    }
  };

  fetchHistoricoPromise = loadFromApi();
  return fetchHistoricoPromise;
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
  const baseUrl = import.meta.env.VITE_N8N_WEBHOOK_URL_VISITAS_CONSULTA;
  if (!baseUrl) return [];

  // Adiciona um parâmetro único para impedir resposta 304 e uso do cache antigo.
  const separador = baseUrl.includes("?") ? "&" : "?";
  const url = `${baseUrl}${separador}_=${Date.now()}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: getAuthHeaders(),
      cache: "no-store",
    });

    checkSessionExpired(response);
    
    if (response.status === 401 || response.status === 403) return [];

    if (!response.ok) {
      console.error(`Erro na consulta de visitas. Status: ${response.status}`);
      return [];
    }
    
    const data = await response.json();
    if (data.success === false) return [];
    
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Falha API Consulta Relatório de Visitas:", error);
    return [];
  }
};


export const fetchVisitaDetalhe = async (
  id_visita: string | number
): Promise<ApiVisitaDetalhe | null> => {
  const baseUrl = import.meta.env.VITE_N8N_WEBHOOK_URL_VISITAS_CONSULTA_DETALHE;

  if (!baseUrl) {
    console.error("VITE_N8N_WEBHOOK_URL_VISITAS_CONSULTA_DETALHE não configurada.");
    return null;
  }

  const separador = baseUrl.includes("?") ? "&" : "?";
  const url = `${baseUrl}${separador}_=${Date.now()}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: getAuthHeaders(true),
      cache: "no-store",
      body: JSON.stringify({
        id_visita: Number(id_visita),
      }),
    });

    checkSessionExpired(response);

    if (response.status === 401 || response.status === 403) {
      return null;
    }

    if (!response.ok) {
      const erro = await response.text();
      console.error(
        `Erro na consulta do detalhe da visita. Status: ${response.status}`,
        erro
      );
      return null;
    }

    const data = await response.json();

    if (data?.success === false) {
      console.error("A API de detalhe da visita retornou erro:", data.message);
      return null;
    }

    if (Array.isArray(data)) {
      return data.length > 0 ? data[0] : null;
    }

    return data?.ID_VISITA ? data : null;
  } catch (error) {
    console.error("Falha API Consulta Detalhe da Visita:", error);
    return null;
  }
};

export const fetchAuditoriaVisita = async (id_visita: string | number): Promise<ApiAuditoria[]> => {
  const url = import.meta.env.VITE_N8N_WEBHOOK_URL_VISITAS_AUDITORIA_CONSULTAR;
  if (!url) return [];
  
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: getAuthHeaders(true),
      body: JSON.stringify({ id_visita: Number(id_visita) })
    });
    checkSessionExpired(response);
    
    if (response.status === 401 || response.status === 403) return [];
    if (!response.ok) return [];
    
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Falha ao buscar auditoria do checklist:", error);
    return [];
  }
};

// 👇 NOVA FUNÇÃO: BUSCAR LOTES DINÂMICOS 👇
export const fetchLotesVisita = async (id_visita: string | number): Promise<ApiLote[]> => {
  const url = import.meta.env.VITE_N8N_WEBHOOK_URL_VISITAS_LOTES_CONSULTAR; 
  if (!url) return [];
  
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: getAuthHeaders(true),
      body: JSON.stringify({ id_visita: Number(id_visita) })
    });
    
    checkSessionExpired(response);
    
    if (response.status === 401 || response.status === 403) return [];
    if (!response.ok) return [];
    
    const data = await response.json();
    
    // O Oracle retorna as colunas em CAIXA ALTA. 
    // Vamos mapear para o padrão minúsculo que o formulário React espera.
    if (Array.isArray(data)) {
      return data.map((d: any) => ({
        prazo_dias: Number(d.PRAZO_DIAS),
        quantidade_cabecas: Number(d.QUANTIDADE_CABECAS),
        sexo_animal: String(d.SEXO_ANIMAL),
        status_lote: String(d.STATUS_LOTE)
      }));
    }
    
    return [];
  } catch (error) {
    console.error("Falha ao buscar lotes da visita:", error);
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

export const saveVisitaCampo = async (dados: any): Promise<{ success: boolean; message?: string, id_visita?: number }> => {
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
    
    let idVisitaSalva = undefined;
    try {
      const resJson = await response.json();
      if (resJson.id_visita) idVisitaSalva = resJson.id_visita;
    } catch(e) {}

    return { success: response.ok, id_visita: idVisitaSalva };
  } catch (error) { return { success: false, message: "Erro de rede" }; }
};

export const saveAuditoriaAvulsa = async (dados: any): Promise<{ success: boolean; message?: string }> => {
  const url = import.meta.env.VITE_N8N_WEBHOOK_URL_VISITAS_AUDITORIA_INSERT_AVULSA;
  if (!url) return { success: false, message: "URL de gravação de auditoria avulsa não definida no ambiente" };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: getAuthHeaders(true),
      body: JSON.stringify(dados)
    });
    checkSessionExpired(response);

    if (response.status === 403) {
      return { success: false, message: "Acesso Negado: Privilégios insuficientes para salvar auditoria." };
    }

    return { success: response.ok };
  } catch (error) {
    console.error("Falha ao sincronizar auditoria avulsa:", error);
    return { success: false, message: "Falha de rede ao tentar se comunicar com o servidor" };
  }
};

export const savePedidoVisita = async (id_visita: string | number, numero_pedido: string | number): Promise<{ success: boolean; message?: string }> => {
  const url = import.meta.env.VITE_N8N_WEBHOOK_URL_VISITAS_PEDIDO_INSERT; 
  if (!url) return { success: false, message: "URL de inserção de pedido não configurada" };
  
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: getAuthHeaders(true),
      body: JSON.stringify({ 
        id_visita: Number(id_visita), 
        numero_pedido: Number(numero_pedido) 
      })
    });
    checkSessionExpired(response);
    
    if (response.status === 403) return { success: false, message: "Acesso Negado." };
    
    const data = await response.json();
    return { success: response.ok && data.success !== false, message: data.message };
  } catch (error) {
    return { success: false, message: "Erro de comunicação com o servidor." };
  }
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
    nroempresa?: number;
  };
  access_token?: string; 
}

export const realizarLogin = async (login: string, senha: string, empresa: string): Promise<LoginResponse> => {
  const url = import.meta.env.VITE_N8N_WEBHOOK_URL_LOGIN; 
  if (!url) return { success: false, message: "URL de login não configurada no .env" };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: getAuthHeaders(true),
      body: JSON.stringify({ login, senha, empresa: Number(empresa) }) 
    });
    
    if (response.status === 403) return { success: false, message: "Acesso negado pelo servidor." };

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
  saveAuditoriaAvulsa,
  searchRanchers: async (query: string): Promise<Rancher[]> => { 
    await delay(400); 
    const q = query.toLowerCase();
    return mockRanchers.filter(r => r.name.toLowerCase().includes(q) || r.propriedade.toLowerCase().includes(q)); 
  },
  getRanchers: async (): Promise<Rancher[]> => { await delay(400); return mockRanchers; },
  getVisitasConsulta: fetchRelatorioVisitas,
  fetchVisitaDetalhe,
  realizarLogin,
  realizarLogout, 
  getUsuarios: fetchUsuarios, 
  vincularVisita: vincularVisitaPecuarista,
  inativarVisita,
  inativarAgendamento, 
  fetchAgendamentosPendentes,
  editarAgendamento,
  editarVisita,
  fetchHistoricoCompras,
  savePedidoVisita,
  fetchAuditoriaVisita,
  fetchLotesVisita 
};
