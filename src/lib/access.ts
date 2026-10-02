import type { User } from "@/contexts/AuthContext";

export interface AccessRule {
  allowedSystems?: string[];
  allowedRoles?: string[];
  allowedModules?: string[];
  minNivel?: number;
}

const normalize = (value: unknown) => String(value || "").trim().toUpperCase();

export const APP_ROUTE_ACCESS = {
  dashboard: {
    allowedSystems: ["VERTICECAMPO"],
    allowedModules: ["GERENCIAL"],
  },
  campo: {
    allowedSystems: ["VERTICECAMPO"],
    allowedModules: ["OPERACIONAL"],
  },
  visitas: {
    allowedSystems: ["VERTICECAMPO"],
    allowedModules: ["RELATORIOS"],
  },
  agendamento: {
    allowedSystems: ["VERTICECAMPO"],
    allowedRoles: ["ADMIN"],
    allowedModules: ["ADMIN"],
    minNivel: 3,
  },
  escala: {
    allowedSystems: ["VERTICECAMPO"],
    allowedRoles: ["ADMIN"],
    allowedModules: ["ESCALA", "ADMIN"],
  },
  contratos: {
    allowedSystems: ["VERTICEPCP"],
  },
} satisfies Record<string, AccessRule>;

const DESKTOP_DEFAULT_ROUTE_ORDER = [
  "/dashboard",
  "/campo",
  "/visitas",
  "/agendamento",
  "/escala",
  "/contratos",
] as const;

const MOBILE_DEFAULT_ROUTE_ORDER = [
  "/campo",
  "/dashboard",
  "/visitas",
  "/agendamento",
  "/escala",
  "/contratos",
] as const;

const ACCESS_BY_PATH: Record<string, AccessRule> = {
  "/dashboard": APP_ROUTE_ACCESS.dashboard,
  "/campo": APP_ROUTE_ACCESS.campo,
  "/campo/localizacao": APP_ROUTE_ACCESS.campo,
  "/visitas": APP_ROUTE_ACCESS.visitas,
  "/agendamento": APP_ROUTE_ACCESS.agendamento,
  "/escala": APP_ROUTE_ACCESS.escala,
  "/contratos": APP_ROUTE_ACCESS.contratos,
};

const getUserSystems = (user: User): string[] => {
  const explicitSystems = (user.sistemas || []).map(normalize).filter(Boolean);
  const mappedSystems = Object.keys(user.modulosPorSistema || {})
    .map(normalize)
    .filter(Boolean);
  const systems = Array.from(new Set([...explicitSystems, ...mappedSystems]));

  // Sessões anteriores à separação por sistema só continham módulos do Campo.
  if (systems.length === 0 && (user.modulos || []).length > 0) {
    systems.push("VERTICECAMPO");
  }

  return systems;
};

const getUserModules = (user: User, systems: string[]): string[] => {
  const mappedModules = systems.flatMap((system) => {
    const entry = Object.entries(user.modulosPorSistema || {}).find(
      ([key]) => normalize(key) === system,
    );
    return (entry?.[1] || []).map(normalize);
  });

  if (mappedModules.length > 0) return Array.from(new Set(mappedModules));
  if (systems.includes("VERTICECAMPO")) return (user.modulos || []).map(normalize);
  return [];
};

export function hasAccessToRule(
  user: User | null | undefined,
  rule?: AccessRule,
): boolean {
  if (!rule) return true;
  if (!user) return false;

  const userRole = normalize(user.role);
  const userSystems = getUserSystems(user);
  const allowedSystems = (rule.allowedSystems || []).map(normalize);

  if (
    allowedSystems.length > 0 &&
    !allowedSystems.some((system) => userSystems.includes(system))
  ) {
    return false;
  }

  const relevantSystems = allowedSystems.length > 0 ? allowedSystems : userSystems;
  const userModules = getUserModules(user, relevantSystems);
  const userNivel = Number(user.nivel || 0);
  const isAdmin = userRole === "ADMIN" || userModules.includes("ADMIN");

  if (isAdmin) return true;

  const checks: boolean[] = [];

  if (rule.allowedRoles && rule.allowedRoles.length > 0) {
    checks.push(rule.allowedRoles.map(normalize).includes(userRole));
  }

  if (rule.allowedModules && rule.allowedModules.length > 0) {
    checks.push(
      rule.allowedModules
        .map(normalize)
        .some((module) => userModules.includes(module)),
    );
  }

  if (rule.minNivel !== undefined) {
    checks.push(userNivel >= rule.minNivel);
  }

  return checks.length === 0 || checks.some(Boolean);
}

export function getDefaultAuthorizedRoute(
  user: User | null | undefined,
  options?: { preferOperational?: boolean },
): string | null {
  if (!user) return null;

  const routeOrder = options?.preferOperational
    ? MOBILE_DEFAULT_ROUTE_ORDER
    : DESKTOP_DEFAULT_ROUTE_ORDER;

  return (
    routeOrder.find((path) => hasAccessToRule(user, ACCESS_BY_PATH[path])) || null
  );
}
