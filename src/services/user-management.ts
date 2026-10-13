export interface AdminSystem {
  SISTEMA: string;
  DESCRICAO: string;
  SIGLASISTEMA: string;
  UTILIZAPTF: "S" | "N";
}

export interface AdminModule {
  SISTEMA: string;
  MODULO: string;
  DESCRICAO: string;
  SIGLAMODULO: string;
  TIPOACESSO?: string | null;
  VERSAO?: string | null;
  ORIGEM?: string | null;
  ORDEM?: number | null;
}

export interface AdminApplication {
  SEQAPLICACAO: number;
  CODAPLICACAO: string;
  SISTEMA: string;
  MODULO: string;
  DESCRICAO: string;
  TIPOACESSO?: string | null;
  ORIGEM?: string | null;
}

export interface AdminCompany {
  NROEMPRESA: number;
  FANTASIA?: string | null;
  RAZAOSOCIAL?: string | null;
  NOMEREDUZIDO?: string | null;
  STATUS?: string | null;
}

export interface AdminUser {
  SEQUSUARIO: number;
  CODUSUARIO: string;
  NOME: string;
  TIPOUSUARIO: string;
  DTLIMITEUSO?: string | null;
  NIVEL?: number | null;
  EMAIL?: string | null;
  QTD_PERMISSOES: number;
}

export interface AdminPermission {
  SEQUSUARIO: number;
  SISTEMA: string;
  MODULO: string;
  NROEMPRESA: number;
  PERMISSAO: "S" | "N";
}

export interface AdminCatalog {
  sistemas: AdminSystem[];
  modulos: AdminModule[];
  aplicacoes: AdminApplication[];
  empresas: AdminCompany[];
}

const baseUrl = String(import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

const headers = (json = false): HeadersInit => {
  const result: Record<string, string> = {
    [import.meta.env.VITE_N8N_HEADER_KEY || "x-api-key"]:
      import.meta.env.VITE_N8N_SECRET_TOKEN || "",
  };
  const token = localStorage.getItem("jwt_token");
  if (token) result.Authorization = `Bearer ${token}`;
  if (json) result["Content-Type"] = "application/json";
  return result;
};

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  if (!baseUrl) throw new Error("VITE_API_BASE_URL não configurada.");
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { ...headers(Boolean(init?.body)), ...(init?.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) window.dispatchEvent(new Event("sessao-expirada"));
  if (!response.ok) {
    const detail = data?.detail;
    throw new Error(typeof detail === "string" ? detail : "Não foi possível concluir a operação.");
  }
  return data as T;
};

export const userManagementApi = {
  getCatalog: () => request<AdminCatalog>("/admin/acessos/catalogo"),
  getUsers: (search = "") =>
    request<AdminUser[]>(`/admin/acessos/usuarios?busca=${encodeURIComponent(search)}`),
  getPermissions: (userId: number) =>
    request<AdminPermission[]>(`/admin/acessos/usuarios/${userId}/permissoes`),
  savePermissions: (userId: number, permissoes: Array<Omit<AdminPermission, "SEQUSUARIO" | "PERMISSAO">>) =>
    request<{ success: boolean; message: string }>(
      `/admin/acessos/usuarios/${userId}/permissoes`,
      { method: "PUT", body: JSON.stringify({ permissoes }) },
    ),
  createSystem: (payload: object) =>
    request("/admin/acessos/sistemas", { method: "POST", body: JSON.stringify(payload) }),
  updateSystem: (system: string, payload: object) =>
    request(`/admin/acessos/sistemas/${encodeURIComponent(system)}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteSystem: (system: string) =>
    request(`/admin/acessos/sistemas/${encodeURIComponent(system)}`, { method: "DELETE" }),
  createModule: (payload: object) =>
    request("/admin/acessos/modulos", { method: "POST", body: JSON.stringify(payload) }),
  updateModule: (system: string, module: string, payload: object) =>
    request(`/admin/acessos/modulos/${encodeURIComponent(system)}/${encodeURIComponent(module)}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  deleteModule: (system: string, module: string) =>
    request(`/admin/acessos/modulos/${encodeURIComponent(system)}/${encodeURIComponent(module)}`, { method: "DELETE" }),
  createApplication: (payload: object) =>
    request("/admin/acessos/aplicacoes", { method: "POST", body: JSON.stringify(payload) }),
  updateApplication: (id: number, payload: object) =>
    request(`/admin/acessos/aplicacoes/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteApplication: (id: number) =>
    request(`/admin/acessos/aplicacoes/${id}`, { method: "DELETE" }),
};
