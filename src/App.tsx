import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  BrowserRouter,
  Navigate,
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
import {
  APP_ROUTE_ACCESS,
  getDefaultAuthorizedRoute,
} from "@/lib/access";

import Index from "./pages/Index";
import FieldPage from "./pages/FieldPage";
import NotFound from "./pages/NotFound";
import LoginPage from "./pages/LoginPage";
import Pecuaristas from "./pages/Visitas";
import Agendamento from "./pages/Agendamento";
import AgendamentoGerenciador from "./pages/AgendamentoGerenciador";
import Escala from "./pages/Escala";
import EscalaDashboardScreen from "./pages/EscalaDashboardScreen";
import EscalaAnaliseMensal from "./pages/EscalaAnaliseMensal";
import EscalaGerenciador from "./pages/EscalaGerenciador";
import EscalaTVScreen from "./pages/EscalaTVScreen";

const queryClient = new QueryClient();

function ProtectedLayout() {
  const { user } = useAuth();
  const defaultRoute = getDefaultAuthorizedRoute(user);

  if (!user || !defaultRoute) {
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
                element={<Navigate to={defaultRoute} replace />}
              />

              <Route element={<ProtectedRoute {...APP_ROUTE_ACCESS.dashboard} />}>
                <Route
                  path="/dashboard"
                  element={<Index />}
                />
              </Route>

              <Route element={<ProtectedRoute {...APP_ROUTE_ACCESS.campo} />}>
                <Route
                  path="/campo"
                  element={<FieldPage />}
                />
              </Route>

              <Route element={<ProtectedRoute {...APP_ROUTE_ACCESS.visitas} />}>
                <Route
                  path="/visitas"
                  element={<Pecuaristas />}
                />
              </Route>

              <Route element={<ProtectedRoute {...APP_ROUTE_ACCESS.agendamento} />}>
                <Route
                  path="/agendamento"
                  element={<Agendamento />}
                />

                <Route
                  path="/agendamento/gerenciar"
                  element={<AgendamentoGerenciador />}
                />
              </Route>

              <Route
                element={
                  <ProtectedRoute
                    {...APP_ROUTE_ACCESS.escala}
                  />
                }
              >
                <Route
                  path="/escala/dashboard"
                  element={<EscalaDashboardScreen />}
                />

                <Route
                  path="/escala/analise-mensal"
                  element={<EscalaAnaliseMensal />}
                />

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
  const defaultRoute = getDefaultAuthorizedRoute(user);

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
          user && defaultRoute
            ? <Navigate to={defaultRoute} replace />
            : <LoginPage />
        }
      />

      <Route element={<ProtectedRoute {...APP_ROUTE_ACCESS.escala} />}>
        <Route
          path="/escala/tv"
          element={<EscalaTVScreen />}
        />
      </Route>

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
