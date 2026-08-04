import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface ProtectedRouteProps {
  allowedRoles?: string[];
  allowedModules?: string[];
}

const normalize = (value: unknown) => String(value || "").trim().toUpperCase();

export function ProtectedRoute({
  allowedRoles = [],
  allowedModules = [],
}: ProtectedRouteProps) {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  const userRole = normalize(user.role);
  const userModules = (user.modulos || []).map(normalize);
  const isAdmin = userRole === "ADMIN" || userModules.includes("ADMIN");

  const roleAllowed =
    allowedRoles.length === 0 ||
    allowedRoles.map(normalize).includes(userRole);

  const moduleAllowed =
    allowedModules.length === 0 ||
    allowedModules.map(normalize).some((module) => userModules.includes(module));

  if (!isAdmin && !roleAllowed && !moduleAllowed) {
    toast.error("Acesso Negado: Você não tem permissão para acessar esta área.", {
      id: "rota-sem-permissao",
    });
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
