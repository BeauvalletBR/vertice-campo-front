import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface ProtectedRouteProps {
  allowedRoles?: Array<"ADMIN" | "COMPRADOR">;
}

export function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    toast.error("Acesso Negado: Você não tem permissão para acessar esta área.");
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}