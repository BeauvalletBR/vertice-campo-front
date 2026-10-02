import type { User } from "@/contexts/AuthContext";
import { APP_ROUTE_ACCESS, hasAccessToRule } from "@/lib/access";

export const LAST_AUTHENTICATED_ROUTE_KEY = "@OriginaGoias:lastRoute";
export const PENDING_AUTHENTICATED_ROUTE_KEY = "@OriginaGoias:pendingRoute";

const getPathname = (route: string) => new URL(route, "https://app.local").pathname;

export const normalizeAuthenticatedRoute = (value: unknown): string | null => {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return null;
  }

  const url = new URL(value, "https://app.local");
  const route = `${url.pathname}${url.search}${url.hash}`;

  if (url.pathname === "/inicio") return route;
  if (url.pathname === "/dashboard") return route;
  if (url.pathname === "/campo") return route;
  if (url.pathname === "/visitas") return route;
  if (url.pathname === "/agendamento" || url.pathname.startsWith("/agendamento/")) {
    return route;
  }
  if (url.pathname === "/escala" || url.pathname.startsWith("/escala/")) {
    return route;
  }
  if (url.pathname === "/contratos" || url.pathname.startsWith("/contratos/")) {
    return route;
  }

  return null;
};

export const canAccessAuthenticatedRoute = (
  user: User | null | undefined,
  value: unknown,
) => {
  const route = normalizeAuthenticatedRoute(value);
  if (!user || !route) return false;

  const pathname = getPathname(route);
  if (pathname === "/inicio") return true;
  if (pathname === "/dashboard") {
    return hasAccessToRule(user, APP_ROUTE_ACCESS.dashboard);
  }
  if (pathname === "/campo") {
    return hasAccessToRule(user, APP_ROUTE_ACCESS.campo);
  }
  if (pathname === "/visitas") {
    return hasAccessToRule(user, APP_ROUTE_ACCESS.visitas);
  }
  if (pathname === "/agendamento" || pathname.startsWith("/agendamento/")) {
    return hasAccessToRule(user, APP_ROUTE_ACCESS.agendamento);
  }
  if (pathname === "/escala" || pathname.startsWith("/escala/")) {
    return hasAccessToRule(user, APP_ROUTE_ACCESS.escala);
  }
  if (pathname === "/contratos" || pathname.startsWith("/contratos/")) {
    return hasAccessToRule(user, APP_ROUTE_ACCESS.contratos);
  }

  return false;
};

export const choosePostLoginRoute = (
  user: User,
  options: {
    requestedRoute?: unknown;
    pendingRoute?: unknown;
    lastRoute?: unknown;
    isDesktop: boolean;
  },
) => {
  const candidates = [options.requestedRoute, options.pendingRoute];
  if (options.isDesktop) candidates.push(options.lastRoute);

  for (const candidate of candidates) {
    const route = normalizeAuthenticatedRoute(candidate);
    if (route && canAccessAuthenticatedRoute(user, route)) return route;
  }

  return "/inicio";
};

export const getCurrentBrowserRoute = () =>
  `${window.location.pathname}${window.location.search}${window.location.hash}`;

export const rememberLastAuthenticatedRoute = (route: unknown) => {
  const normalized = normalizeAuthenticatedRoute(route);
  if (normalized) localStorage.setItem(LAST_AUTHENTICATED_ROUTE_KEY, normalized);
};

export const rememberPendingAuthenticatedRoute = (route: unknown) => {
  const normalized = normalizeAuthenticatedRoute(route);
  if (normalized) sessionStorage.setItem(PENDING_AUTHENTICATED_ROUTE_KEY, normalized);
};

export const getLastAuthenticatedRoute = () =>
  localStorage.getItem(LAST_AUTHENTICATED_ROUTE_KEY);

export const getPendingAuthenticatedRoute = () =>
  sessionStorage.getItem(PENDING_AUTHENTICATED_ROUTE_KEY);

export const clearPendingAuthenticatedRoute = () =>
  sessionStorage.removeItem(PENDING_AUTHENTICATED_ROUTE_KEY);
