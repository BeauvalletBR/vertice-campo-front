import { LayoutDashboard, MapPin, LogOut, Users, CalendarPlus } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

// 👇 DEFININDO QUAIS MÓDULOS SÃO EXIGIDOS PARA CADA ROTA
const items = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, reqModule: "GERENCIAL" },
  { title: "Agendamentos", url: "/agendamento", icon: CalendarPlus, reqModule: "ADMIN" },
  { title: "Campo", url: "/campo", icon: MapPin, reqModule: "OPERACIONAL" },
  { title: "Visitas", url: "/visitas", icon: Users, reqModule: "RELATORIOS" },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { user, logout } = useAuth();

  // Garante que modulos é sempre um array seguro de ler
  const userModules = (user as any)?.modulos || [];

  // 👇 A MÁGICA VISUAL: Filtrar as rotas da Sidebar baseado no crachá do usuário
  const filteredItems = items.filter((item) => {
    // Se o item tem um módulo obrigatório (reqModule), e o usuário NÃO o possui, esconde.
    if (item.reqModule && !userModules.includes(item.reqModule)) {
      return false; 
    }
    return true; 
  });

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>
            {!collapsed && "Vértice Campo"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end
                      className="hover:bg-sidebar-accent/50"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      
      <SidebarFooter className="p-2 border-t border-border/50">
        {!collapsed && user && (
          <div className="px-3 mb-2 mt-1">
            <div className="text-sm font-bold text-sidebar-foreground truncate">
              {user.name}
            </div>
            {/* Opcional: Mostrar também o nome da empresa ou os acessos que ele tem */}
            <div className="text-[10px] font-semibold text-sidebar-foreground/50 uppercase tracking-wider">
              {user.role}
            </div>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={logout}
          className="w-full justify-start text-sidebar-foreground/70 hover:text-red-600 hover:bg-red-100"
        >
          <LogOut className="h-4 w-4 mr-2" />
          {!collapsed && "Sair do Sistema"}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}