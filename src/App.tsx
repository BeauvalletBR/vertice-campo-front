import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
} from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import {
  AuthProvider,
  useAuth,
} from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";

import Index from "./pages/Index";
import FieldPage from "./pages/FieldPage";
import NotFound from "./pages/NotFound";
import LoginPage from "./pages/LoginPage";
import Pecuaristas from "./pages/Visitas";
import Agendamento from "./pages/Agendamento";
import AgendamentoGerenciador from "./pages/AgendamentoGerenciador";
import Escala from "./pages/Escala";
import EscalaGerenciador from "./pages/EscalaGerenciador";

const queryClient = new QueryClient();

// Permite acesso ao Agendamento para ADMIN
// ou para usuários com nível 3 ou superior.
function AgendamentoGuard() {
  const { user } = useAuth();

  const userModules = ((user as { modulos?: string[] } | null)?.modulos || []).map(
    (module) => String(module).trim().toUpperCase(),
  );

  const userNivel = Number((user as { nivel?: number } | null)?.nivel || 0);
  const userRole = String((user as { role?: string } | null)?.role || "")
    .trim()
    .toUpperCase();

  const hasAccess =
    userRole === "ADMIN" ||
    userModules.includes("ADMIN") ||
    userNivel >= 3;

  return hasAccess
    ? <Outlet />
    : <Navigate to="/dashboard" replace />;
}

function ProtectedLayout() {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />

        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-12 flex items-center border-b border-border bg-background px-2 shrink-0">
            <SidebarTrigger className="ml-1" />
          </header>

          <main className="flex-1 min-w-0 overflow-auto">
            <Routes>
              <Route
                path="/"
                element={<Navigate to="/dashboard" replace />}
              />

              <Route
                path="/dashboard"
                element={<Index />}
              />

              <Route
                path="/campo"
                element={<FieldPage />}
              />

              <Route
                path="/visitas"
                element={<Pecuaristas />}
              />

              <Route element={<AgendamentoGuard />}>
                <Route
                  path="/agendamento"
                  element={<Agendamento />}
                />

                <Route
                  path="/agendamento/gerenciar"
                  element={<AgendamentoGerenciador />}
                />
              </Route>

              {/* Uma única opção no menu: /escala.
                  As rotas de gerenciar continuam internas,
                  abertas pelos botões da própria página Escala. */}
              <Route
                element={
                  <ProtectedRoute
                    allowedRoles={["ADMIN"]}
                    allowedModules={["ESCALA", "ADMIN"]}
                  />
                }
              >
                <Route
                  path="/escala"
                  element={<Escala />}
                />

                <Route
                  path="/escala/gerenciar"
                  element={<EscalaGerenciador />}
                />

                <Route
                  path="/escala/gerenciar/:idEscala"
                  element={<EscalaGerenciador />}
                />
              </Route>

              <Route
                path="*"
                element={<NotFound />}
              />
            </Routes>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function AppContent() {
  const { user, isAuthLoading } = useAuth();

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />

          <p className="text-sm font-bold text-slate-500">
            Validando acesso...
          </p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={
          user
            ? <Navigate to="/dashboard" replace />
            : <LoginPage />
        }
      />

      <Route
        path="/*"
        element={<ProtectedLayout />}
      />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />

      <BrowserRouter>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;