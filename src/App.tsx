import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import FieldPage from "./pages/FieldPage";
import NotFound from "./pages/NotFound";
import LoginPage from "./pages/LoginPage";
import Pecuaristas from "./pages/Visitas";
import Agendamento from "./pages/Agendamento"; 
import AgendamentoGerenciador from "./pages/AgendamentoGerenciador"; 

import { ProtectedRoute } from "@/components/ProtectedRoute";

const queryClient = new QueryClient();

function ProtectedLayout() {
  const { user } = useAuth();
  
  if (!user) return <Navigate to="/login" replace />;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-12 flex items-center border-b border-border bg-background px-2">
            <SidebarTrigger className="ml-1" />
          </header>
          <main className="flex-1">
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              
              {/* 🟢 ROTAS GERAIS: Tanto ADMIN quanto COMPRADOR podem acessar */}
              <Route path="/dashboard" element={<Index />} />
              <Route path="/campo" element={<FieldPage />} />
              <Route path="/visitas" element={<Pecuaristas />} />
              
              {/* ROTAS RESTRITAS: O que estiver aqui dentro, SOMENTE ADMIN acessa */}
              <Route element={<ProtectedRoute allowedRoles={["ADMIN"]} />}>
                <Route path="/agendamento" element={<Agendamento />} />
                
                {/* 👇 2. ADICIONADA A NOVA ROTA DE GERENCIAMENTO AQUI 👇 */}
                <Route path="/agendamento/gerenciar" element={<AgendamentoGerenciador />} />
              </Route>
              
              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function AppContent() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
      <Route path="/*" element={<ProtectedLayout />} />
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