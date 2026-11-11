import { useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  getDefaultAuthorizedRoute,
  hasAccessToRule,
} from "@/lib/access";
import { toast } from "sonner";

interface ProtectedRouteProps {
  allowedSystems?: string[];
  allowedRoles?: string[];
  allowedModules?: string[];
  requireAllowedModule?: boolean;
  minNivel?: number;
  redirectTo?: string;
}

export function ProtectedRoute({
  allowedSystems = [],
  allowedRoles = [],
  allowedModules = [],
  requireAllowedModule = false,
  minNivel,
  redirectTo,
}: ProtectedRouteProps) {
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();
  const hasAccess = Boolean(
    isAuthenticated &&
      user &&
      hasAccessToRule(user, {
        allowedSystems,
        allowedRoles,
        allowedModules,
        requireAllowedModule,
        minNivel,
      }),
  );
  const fallbackRoute = user
    ? redirectTo || getDefaultAuthorizedRoute(user) || "/login"
    : "/login";

  useEffect(() => {
    if (isAuthenticated && user && !hasAccess) {
      toast.error("Acesso Negado: Voce nao tem permissao para acessar esta area.", {
        id: "rota-sem-permissao",
      });
    }
  }, [hasAccess, isAuthenticated, user]);

  if (!isAuthenticated || !user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          from: `${location.pathname}${location.search}${location.hash}`,
        }}
      />
    );
  }

  if (!hasAccess) {
    return <Navigate to={fallbackRoute} replace />;
  }

  return <Outlet />;
}
