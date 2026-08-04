import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface ProtectedRouteProps {
  allowedRoles?: Array<string>; 
}

export function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles) {
    const hasRole = allowedRoles.includes(user.role);
    const hasModulo = allowedRoles.some((role) => user.modulos?.includes(role));
    if (!hasRole && !hasModulo) {
      toast.error("Acesso Negado: Você não tem permissão para acessar esta área.");
      return <Navigate to="/" replace />;
    }
  }

  return <Outlet />;
}