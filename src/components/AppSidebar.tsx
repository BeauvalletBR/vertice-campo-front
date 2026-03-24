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

// 1. Adicionamos a flag opcional "adminOnly" nas rotas restritas
const items = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Agendamentos", url: "/agendamento", icon: CalendarPlus, adminOnly: true }, // <-- BLOQUEADO SÓ PARA ADMIN
  { title: "Campo", url: "/campo", icon: MapPin },
  { title: "Visitas", url: "/visitas", icon: Users },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { user, logout } = useAuth();

  // 2. Filtramos a lista de menus ANTES de renderizar na tela
  // Se o menu for "adminOnly" e o cara NÃO for ADMIN, a gente esconde.
  const filteredItems = items.filter((item) => {
    if (item.adminOnly && user?.role !== "ADMIN") {
      return false; 
    }
    return true; 
  });

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>
            {!collapsed && "Originação Goiás"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {/* 3. Mapeamos apenas os itens filtrados */}
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
            {/* Mostra a Role (cargo) do cara bem pequenininho */}
            <div className="text-[10px] font-semibold text-sidebar-foreground/50 uppercase tracking-wider">
              Perfil: {user.role}
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