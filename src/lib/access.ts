import type { User } from "@/contexts/AuthContext";

export interface AccessRule {
  allowedRoles?: string[];
  allowedModules?: string[];
  minNivel?: number;
}

const normalize = (value: unknown) => String(value || "").trim().toUpperCase();

export const APP_ROUTE_ACCESS = {
  dashboard: {
    allowedModules: ["GERENCIAL"],
  },
  campo: {
    allowedModules: ["OPERACIONAL"],
  },
  visitas: {
    allowedModules: ["RELATORIOS"],
  },
  agendamento: {
    allowedRoles: ["ADMIN"],
    allowedModules: ["ADMIN"],
    minNivel: 3,
  },
  escala: {
    allowedRoles: ["ADMIN"],
    allowedModules: ["ESCALA", "ADMIN"],
  },
} satisfies Record<string, AccessRule>;

const DESKTOP_DEFAULT_ROUTE_ORDER = [
  "/dashboard",
  "/campo",
  "/visitas",
  "/agendamento",
  "/escala",
] as const;

const MOBILE_DEFAULT_ROUTE_ORDER = [
  "/campo",
  "/dashboard",
  "/visitas",
  "/agendamento",
  "/escala",
] as const;

const ACCESS_BY_PATH: Record<string, AccessRule> = {
  "/dashboard": APP_ROUTE_ACCESS.dashboard,
  "/campo": APP_ROUTE_ACCESS.campo,
  "/visitas": APP_ROUTE_ACCESS.visitas,
  "/agendamento": APP_ROUTE_ACCESS.agendamento,
  "/escala": APP_ROUTE_ACCESS.escala,
};

export function hasAccessToRule(
  user: User | null | undefined,
  rule?: AccessRule,
): boolean {
  if (!rule) return true;
  if (!user) return false;

  const userRole = normalize(user.role);
  const userModules = (user.modulos || []).map(normalize);
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
