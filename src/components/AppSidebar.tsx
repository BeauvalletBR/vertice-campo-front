import { useState, useEffect } from "react";
import { 
  LayoutDashboard, 
  MapPin, 
  LogOut, 
  Users, 
  CalendarPlus, 
  ChevronDown, 
  ListTodo, 
  PlusCircle, 
  Folder, 
  ShieldCheck 
} from "lucide-react";
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
  const userNivel = (user as any)?.nivel || 0; 
  
  const isAgendamentoActive = location.pathname.startsWith('/agendamento');
  const [isAgendamentoOpen, setIsAgendamentoOpen] = useState(isAgendamentoActive);

  // 👇 ESTADO UNIFICADO PARA OS DOIS AGRUPAMENTOS PRINCIPAIS 👇
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    campo: true,          // Gaveta Campo começa aberta
    administrativo: false // Gaveta Administrativo começa fechada
  });

  useEffect(() => {
    if (isAgendamentoActive && !collapsed) {
      setIsAgendamentoOpen(true);
    }
  }, [location.pathname, collapsed, isAgendamentoActive]);

  const toggleGroup = (groupId: string) => {
    if (collapsed) return;
    setOpenGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  };

  // 👇 MATRIZ DE CONFIGURAÇÃO DE MENUS SEM REPETIÇÃO 👇
  const menuGroups = [
    {
      id: "campo",
      title: "Campo",
      icon: Folder,
      items: [
        { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, reqModule: "GERENCIAL" },
        { 
          title: "Agendamentos", 
          icon: CalendarPlus, 
          reqModule: "ADMIN",
          minNivel: 3, 
          subItems: [
            { title: "Agendar", url: "/agendamento", icon: PlusCircle },
            { title: "Gerenciar", url: "/agendamento/gerenciar", icon: ListTodo }
          ]
        },
        { title: "Campo", url: "/campo", icon: MapPin, reqModule: "OPERACIONAL" },
        { title: "Visitas", url: "/visitas", icon: Users, reqModule: "RELATORIOS" },
      ]
    },
    {
      id: "administrativo",
      title: "Operações",
      icon: ShieldCheck,
      items: [] // Vazio para implementações futuras
    }
  ];

  return (
    <Sidebar collapsible="icon" className="bg-slate-950 border-r-slate-800 text-white shadow-xl">
      <SidebarContent>
        
        {/* CABEÇALHO COM LOGO */}
        <div className={`flex items-center mt-4 mb-6 transition-all ${collapsed ? 'justify-center px-0' : 'px-4 gap-3'}`}>
          <div className="bg-white p-1 rounded-md flex items-center justify-center shrink-0 shadow-sm">
            <img src="/logo.png" alt="Logo" className="h-6 w-6 object-contain" />
          </div>
          
          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-black text-lg text-white leading-none tracking-tight">Vértice</span>
              <span className="font-bold text-white/50 text-[10px] uppercase tracking-widest leading-none mt-1">Compra de Gado</span>
            </div>
          )}
        </div>

        {/* RENDERIZADOR DOS AGRUPAMENTOS PRINCIPAIS */}
        {menuGroups.map((group) => {
          const isGroupOpen = openGroups[group.id];

          const filteredItems = group.items.filter((item) => {
            if ((item as any).minNivel && userNivel >= (item as any).minNivel) return true;
            if (item.reqModule && !userModules.includes(item.reqModule)) return false;
            return true;
          });

          return (
            <SidebarGroup key={group.id} className="pb-2">
              <SidebarMenuItem className="list-none">
                <SidebarMenuButton asChild tooltip={group.title} className="hover:bg-transparent cursor-pointer">
                  <div 
                    onClick={() => toggleGroup(group.id)}
                    className={`flex items-center justify-between w-full px-3 py-2 rounded-lg transition-all font-black text-[11px] uppercase tracking-widest select-none ${
                      isGroupOpen ? "text-white" : "text-white/40 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <div className="flex items-center">
                      <group.icon className="mr-3 h-4 w-4 shrink-0 text-white/50" />
                      {!collapsed && <span>{group.title}</span>}
                    </div>
                    {!collapsed && (
                      <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${isGroupOpen ? 'rotate-180' : ''}`} />
                    )}
                  </div>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* GAVETA DO AGRUPAMENTO */}
              {isGroupOpen && !collapsed && (
                <SidebarGroupContent className="mt-1.5 pl-2 pr-1 space-y-1 animate-in slide-in-from-top-1 fade-in duration-200">
                  <SidebarMenu className="space-y-1">
                    {filteredItems.length === 0 ? (
                      <div className="px-4 py-2 text-[11px] font-medium text-white/20 italic">
                        Nenhum recurso liberado
                      </div>
                    ) : (
                      filteredItems.map((item) => {
                        
                        // Sub-menu de Agendamentos interno
                        if (item.subItems) {
                          return (
                            <div key={item.title} className="flex flex-col space-y-1">
                              <SidebarMenuItem>
                                <SidebarMenuButton asChild tooltip={item.title} className="hover:bg-transparent cursor-pointer">
                                  <div 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setIsAgendamentoOpen(!isAgendamentoOpen);
                                    }}
                                    className="flex items-center justify-between w-full px-3 py-2 rounded-lg transition-all font-medium select-none text-white/70 hover:bg-white/10 hover:text-white"
                                  >
                                    <div className="flex items-center">
                                      <item.icon className="mr-3 h-4.5 w-4.5 shrink-0 text-white/50" />
                                      <span>{item.title}</span>
                                    </div>
                                    <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${isAgendamentoOpen ? 'rotate-180' : ''}`} />
                                  </div>
                                </SidebarMenuButton>
                              </SidebarMenuItem>

                              {isAgendamentoOpen && (
                                <div className="pl-9 pr-2 py-0.5 space-y-1 animate-in slide-in-from-top-1 fade-in duration-150">
                                  {item.subItems.map((subItem) => {
                                    const isSubActive = location.pathname === subItem.url;
                                    return (
                                      <NavLink
                                        key={subItem.title}
                                        to={subItem.url}
                                        end
                                        className={`flex items-center w-full px-3 py-1.5 rounded-md text-xs transition-all ${
                                          isSubActive ? 'bg-white !text-slate-900 font-bold shadow-sm' : 'text-white/60 hover:text-white hover:bg-white/10'
                                        }`}
                                      >
                                        <subItem.icon className="mr-2 h-3.5 w-3.5 shrink-0" />
                                        <span>{subItem.title}</span>
                                      </NavLink>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        }

                        // Itens normais (Dashboard, Campo, Visitas)
                        return (
                          <SidebarMenuItem key={item.title}>
                            <SidebarMenuButton asChild tooltip={item.title} className="hover:bg-transparent">
                              <NavLink
                                to={item.url}
                                end
                                className="flex items-center w-full px-3 py-2 rounded-lg text-white/70 hover:bg-white/10 hover:text-white transition-all font-medium text-sm"
                                activeClassName="bg-white !text-slate-900 font-bold shadow-md hover:bg-white hover:text-slate-900"
                              >
                                <item.icon className="mr-3 h-4.5 w-4.5 shrink-0 text-white/50" />
                                <span>{item.title}</span>
                              </NavLink>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        );
                      })
                    )}
                  </SidebarMenu>
                </SidebarGroupContent>
              )}
            </SidebarGroup>
          );
        })}

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