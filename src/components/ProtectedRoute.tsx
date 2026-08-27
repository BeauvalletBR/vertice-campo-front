import { useEffect } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  getDefaultAuthorizedRoute,
  hasAccessToRule,
} from "@/lib/access";
import { toast } from "sonner";

interface ProtectedRouteProps {
  allowedRoles?: string[];
  allowedModules?: string[];
  minNivel?: number;
  redirectTo?: string;
}

export function ProtectedRoute({
  allowedRoles = [],
  allowedModules = [],
  minNivel,
  redirectTo,
}: ProtectedRouteProps) {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  const hasAccess = hasAccessToRule(user, {
    allowedRoles,
    allowedModules,
    minNivel,
  });
  const fallbackRoute = redirectTo || getDefaultAuthorizedRoute(user) || "/login";

  useEffect(() => {
    if (!hasAccess) {
      toast.error("Acesso Negado: Voce nao tem permissao para acessar esta area.", {
        id: "rota-sem-permissao",
      });
    }
  }, [hasAccess]);

  if (!hasAccess) {
    return <Navigate to={fallbackRoute} replace />;
  }

  return <Outlet />;
}
