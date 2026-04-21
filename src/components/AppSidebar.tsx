import { LayoutDashboard, MapPin, LogOut, Users, CalendarPlus } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

const items = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, reqModule: "GERENCIAL" },
  { title: "Agendamentos", url: "/agendamento", icon: CalendarPlus, reqModule: "ADMIN" },
  { title: "Campo", url: "/campo", icon: MapPin, reqModule: "OPERACIONAL" },
  { title: "Visitas", url: "/visitas", icon: Users, reqModule: "RELATORIOS" },
];

const formatarNomeCurto = (nomeCompleto: string) => {
  if (!nomeCompleto) return "Usuário";
  const partes = nomeCompleto.trim().split(" ");
  if (partes.length === 1) return partes[0]; 
  return `${partes[0]} ${partes[partes.length - 1]}`;
};

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { user, logout } = useAuth();

  const userModules = (user as any)?.modulos || [];

  const filteredItems = items.filter((item) => {
    if (item.reqModule && !userModules.includes(item.reqModule)) {
      return false; 
    }
    return true; 
  });

  return (
    <Sidebar collapsible="icon" className="bg-slate-950 border-r-slate-800 text-white shadow-xl">
      <SidebarContent>
        <SidebarGroup>
          
          {/* CABEÇALHO COM LOGO PROTEGIDA */}
          <div className={`flex items-center mt-4 mb-6 transition-all ${collapsed ? 'justify-center px-0' : 'px-4 gap-3'}`}>
            <div className="bg-white p-1 rounded-md flex items-center justify-center shrink-0 shadow-sm">
              <img src="/logo.png" alt="Logo" className="h-6 w-6 object-contain" />
            </div>
            
            {!collapsed && (
              <div className="flex flex-col">
                <span className="font-black text-lg text-white leading-none tracking-tight">Vértice</span>
                <span className="font-bold text-white/50 text-[10px] uppercase tracking-widest leading-none mt-1">Campo</span>
              </div>
            )}
          </div>

          <SidebarGroupContent>
            <SidebarMenu className="space-y-1.5">
              {filteredItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title} className="hover:bg-transparent">
                    <NavLink
                      to={item.url}
                      end
                      className="flex items-center w-full px-3 py-2.5 rounded-lg text-white/70 hover:bg-white/10 hover:text-white transition-all font-medium"
                      activeClassName="bg-white !text-slate-900 font-bold shadow-md hover:bg-white hover:text-slate-900"
                    >
                      <item.icon className="mr-3 h-5 w-5 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      
      {/* RODAPÉ DO USUÁRIO */}
      <SidebarFooter className="p-3 border-t border-white/10">
        {!collapsed && user && (
          <div className="flex items-center gap-3 px-2 mb-4 mt-1">
            <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center shrink-0">
              <span className="font-bold text-white text-sm">
                {user.name ? user.name.charAt(0).toUpperCase() : "U"}
              </span>
            </div>
            
            <div className="flex flex-col overflow-hidden">
              {/* 👇 APLICANDO A FUNÇÃO DE NOME CURTO AQUI 👇 */}
              <div className="text-sm font-bold text-white truncate" title={user.name}>
                {formatarNomeCurto(user.name)}
              </div>
              <div className="text-[10px] font-bold text-white/50 uppercase tracking-wider truncate">
                {user.role}
              </div>
            </div>
          </div>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={logout}
          className={`w-full text-white/70 hover:text-white hover:bg-red-500/80 transition-all ${collapsed ? 'justify-center px-0 h-10' : 'justify-start h-10'}`}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span className="ml-3 font-bold">Sair do Sistema</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}