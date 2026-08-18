import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CalendarPlus,
  ChevronDown,
  Folder,
  LayoutDashboard,
  ListTodo,
  LogOut,
  MapPin,
  PanelLeftClose,
  PanelLeftOpen,
  PlusCircle,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useLocation } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

interface MenuSubItem {
  title: string;
  url: string;
  icon: LucideIcon;
  reqModules?: string[];
}

interface MenuItem {
  id: string;
  title: string;
  icon: LucideIcon;
  url?: string;
  reqModules?: string[];
  minNivel?: number;
  subItems?: MenuSubItem[];
}

interface MenuGroup {
  id: string;
  title: string;
  icon: LucideIcon;
  items: MenuItem[];
}

const formatarNomeCurto = (nomeCompleto: string) => {
  if (!nomeCompleto) return "Usuário";

  const partes = nomeCompleto.trim().split(" ");

  if (partes.length === 1) return partes[0];

  return `${partes[0]} ${partes[partes.length - 1]}`;
};

const normalizarModulo = (modulo: unknown) =>
  String(modulo || "")
    .trim()
    .toUpperCase();

export function AppSidebar() {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { user, logout } = useAuth();

  const userModules = useMemo(
    () =>
      ((user as { modulos?: string[] } | null)?.modulos || []).map(
        normalizarModulo,
      ),
    [user],
  );

  const userNivel = Number((user as { nivel?: number } | null)?.nivel || 0);
  const userRole = normalizarModulo((user as { role?: string } | null)?.role);
  const isAdmin = userRole === "ADMIN" || userModules.includes("ADMIN");

  const isAgendamentoActive = location.pathname.startsWith("/agendamento");
  const isEscalaActive = location.pathname.startsWith("/escala");

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    campo: true,
    administrativo: isEscalaActive,
  });

  const [openSubmenus, setOpenSubmenus] = useState<Record<string, boolean>>({
    agendamentos: isAgendamentoActive,
    escala: isEscalaActive,
  });

  const possuiAlgumModulo = (requiredModules?: string[]) => {
    if (!requiredModules || requiredModules.length === 0) return true;
    if (isAdmin) return true;

    return requiredModules
      .map(normalizarModulo)
      .some((module) => userModules.includes(module));
  };

  useEffect(() => {
    if (collapsed) return;

    if (isAgendamentoActive) {
      setOpenGroups((previous) => ({ ...previous, campo: true }));
      setOpenSubmenus((previous) => ({
        ...previous,
        agendamentos: true,
      }));
    }

    if (isEscalaActive) {
      setOpenGroups((previous) => ({
        ...previous,
        administrativo: true,
      }));
      setOpenSubmenus((previous) => ({
        ...previous,
        escala: true,
      }));
    }
  }, [collapsed, isAgendamentoActive, isEscalaActive]);

  const toggleGroup = (groupId: string) => {
    if (collapsed) return;

    setOpenGroups((previous) => ({
      ...previous,
      [groupId]: !previous[groupId],
    }));
  };

  const toggleSubmenu = (submenuId: string) => {
    setOpenSubmenus((previous) => ({
      ...previous,
      [submenuId]: !previous[submenuId],
    }));
  };

  const menuGroups: MenuGroup[] = [
    {
      id: "campo",
      title: "Campo",
      icon: Folder,
      items: [
        {
          id: "dashboard",
          title: "Dashboard",
          url: "/dashboard",
          icon: LayoutDashboard,
          reqModules: ["GERENCIAL"],
        },
        {
          id: "agendamentos",
          title: "Agendamentos",
          icon: CalendarPlus,
          reqModules: ["ADMIN"],
          minNivel: 3,
          subItems: [
            {
              title: "Agendar",
              url: "/agendamento",
              icon: PlusCircle,
            },
            {
              title: "Gerenciar",
              url: "/agendamento/gerenciar",
              icon: ListTodo,
            },
          ],
        },
        {
          id: "campo-operacional",
          title: "Campo",
          url: "/campo",
          icon: MapPin,
          reqModules: ["OPERACIONAL"],
        },
        {
          id: "visitas",
          title: "Visitas",
          url: "/visitas",
          icon: Users,
          reqModules: ["RELATORIOS"],
        },
      ],
    },
    {
      id: "administrativo",
      title: "Operações",
      icon: ShieldCheck,
      items: [
        {
          id: "escala",
          title: "Escala",
          url: "/escala",
          icon: CalendarDays,
          reqModules: ["ESCALA", "ADMIN"],
        },
      ],
    },
  ];

  const isSubItemActive = (url: string) => {
    if (url === "/escala") {
      return location.pathname === "/escala";
    }

    return location.pathname === url;
  };

  return (
    <Sidebar
      collapsible="icon"
      className="overflow-hidden border-r border-[#31577F] bg-[#173D6E] text-white shadow-[5px_0_18px_rgba(23,61,110,0.10)]"
    >
      {/* Cabeçalho branco, conforme o padrão visual solicitado */}
      <div
        className={`flex h-[92px] shrink-0 items-center border-b border-[#D8E2EC] bg-white transition-all ${
          collapsed
            ? "justify-center px-2"
            : "justify-between gap-3 px-4"
        }`}
      >
        <div
          className={`flex min-w-0 items-center ${
            collapsed ? "justify-center" : "gap-3"
          }`}
        >
          <div className="flex h-14 w-14 shrink-0 items-center justify-center">
            <img
              src="/logo.png"
              alt="Logo Beauvallet"
              className="max-h-14 max-w-14 object-contain"
            />
          </div>

          {!collapsed && (
            <div className="min-w-0">
              <span className="block truncate text-base font-extrabold leading-tight text-[#173D6E]">
                Vértice
              </span>
              <span className="mt-1 block truncate text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#60758A]">
                Compra de Gado
              </span>
            </div>
          )}
        </div>

        {!collapsed && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="h-9 w-9 shrink-0 rounded-lg text-[#173D6E] hover:bg-[#EEF4FA] hover:text-[#1B58A0]"
            title="Recolher menu"
            aria-label="Recolher menu"
          >
            <PanelLeftClose className="h-5 w-5" />
          </Button>
        )}

        {collapsed && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="absolute right-1 top-[28px] h-8 w-8 rounded-lg bg-white text-[#173D6E] shadow-sm hover:bg-[#EEF4FA]"
            title="Expandir menu"
            aria-label="Expandir menu"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Faixa institucional */}
      <div
        className="grid h-1.5 shrink-0 grid-cols-[1.1fr_1fr_0.85fr]"
        aria-label="Cores institucionais Beauvallet"
      >
        <span className="bg-[#E30613]" />
        <span className="bg-[#1B58A0]" />
        <span className="bg-[#0AB1D8]" />
      </div>

      {/* Área dos módulos com predominância do azul-marinho */}
      <SidebarContent className="bg-[#173D6E] px-0 py-3">
        {menuGroups.map((group) => {
          const isGroupOpen = openGroups[group.id];

          const filteredItems = group.items
            .map((item) => {
              const filteredSubItems = item.subItems?.filter((subItem) =>
                possuiAlgumModulo(subItem.reqModules),
              );

              return {
                ...item,
                subItems: filteredSubItems,
              };
            })
            .filter((item) => {
              const hasLevelAccess =
                item.minNivel !== undefined && userNivel >= item.minNivel;

              const hasModuleAccess = possuiAlgumModulo(item.reqModules);

              if (item.subItems) {
                return (
                  item.subItems.length > 0 &&
                  (hasLevelAccess || hasModuleAccess)
                );
              }

              return hasLevelAccess || hasModuleAccess;
            });

          return (
            <SidebarGroup key={group.id} className="px-2 pb-3">
              <SidebarMenuItem className="list-none">
                <SidebarMenuButton
                  asChild
                  tooltip={group.title}
                  className="cursor-pointer hover:bg-transparent"
                >
                  <div
                    onClick={() => toggleGroup(group.id)}
                    className={`flex w-full select-none items-center justify-between rounded-lg px-3 py-2 transition-all ${
                      isGroupOpen
                        ? "text-[#AFC8DF]"
                        : "text-[#88A9C8] hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <div className="flex min-w-0 items-center">
                      <group.icon
                        className={`h-4 w-4 shrink-0 ${
                          collapsed ? "" : "mr-3"
                        } text-[#9FBDD8]`}
                      />

                      {!collapsed && (
                        <span className="truncate text-[11px] font-extrabold uppercase tracking-[0.11em]">
                          {group.title}
                        </span>
                      )}
                    </div>

                    {!collapsed && (
                      <ChevronDown
                        className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${
                          isGroupOpen ? "rotate-180" : ""
                        }`}
                      />
                    )}
                  </div>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {isGroupOpen && !collapsed && (
                <SidebarGroupContent className="mt-1.5 animate-in space-y-1 fade-in slide-in-from-top-1 duration-200">
                  <SidebarMenu className="space-y-1">
                    {filteredItems.length === 0 ? (
                      <div className="px-4 py-2 text-[11px] font-medium italic text-white/35">
                        Nenhum recurso liberado
                      </div>
                    ) : (
                      filteredItems.map((item) => {
                        if (item.subItems) {
                          const isSubmenuOpen =
                            openSubmenus[item.id] || false;

                          const isParentActive = item.subItems.some(
                            (subItem) => isSubItemActive(subItem.url),
                          );

                          return (
                            <div
                              key={item.id}
                              className="flex flex-col space-y-1"
                            >
                              <SidebarMenuItem>
                                <SidebarMenuButton
                                  asChild
                                  tooltip={item.title}
                                  className="cursor-pointer hover:bg-transparent"
                                >
                                  <div
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      toggleSubmenu(item.id);
                                    }}
                                    className={`flex w-full select-none items-center justify-between rounded-lg px-3 py-2.5 text-sm font-bold transition-all ${
                                      isParentActive
                                        ? "bg-white text-[#173D6E] shadow-[0_5px_14px_rgba(4,24,48,0.16)]"
                                        : "text-[#CFDCE9] hover:bg-white/10 hover:text-white"
                                    }`}
                                  >
                                    <div className="flex min-w-0 items-center">
                                      <item.icon
                                        className={`mr-3 h-[18px] w-[18px] shrink-0 ${
                                          isParentActive
                                            ? "text-[#1B58A0]"
                                            : "text-[#AFC8DF]"
                                        }`}
                                      />

                                      <span className="truncate">
                                        {item.title}
                                      </span>
                                    </div>

                                    <ChevronDown
                                      className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${
                                        isSubmenuOpen ? "rotate-180" : ""
                                      }`}
                                    />
                                  </div>
                                </SidebarMenuButton>
                              </SidebarMenuItem>

                              {isSubmenuOpen && (
                                <div className="animate-in space-y-1 py-0.5 pl-7 fade-in slide-in-from-top-1 duration-150">
                                  {item.subItems.map((subItem) => {
                                    const isSubActive = isSubItemActive(
                                      subItem.url,
                                    );

                                    return (
                                      <NavLink
                                        key={subItem.title}
                                        to={subItem.url}
                                        end={subItem.url === "/escala"}
                                        className={`flex w-full items-center rounded-lg px-3 py-2 text-xs transition-all ${
                                          isSubActive
                                            ? "bg-white font-extrabold text-[#173D6E] shadow-[0_4px_12px_rgba(4,24,48,0.14)]"
                                            : "text-[#BBD0E2] hover:bg-white/10 hover:text-white"
                                        }`}
                                      >
                                        <subItem.icon
                                          className={`mr-2 h-3.5 w-3.5 shrink-0 ${
                                            isSubActive
                                              ? "text-[#1B58A0]"
                                              : "text-[#94B5D2]"
                                          }`}
                                        />
                                        <span className="truncate">
                                          {subItem.title}
                                        </span>
                                      </NavLink>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        }

                        if (!item.url) return null;

                        return (
                          <SidebarMenuItem key={item.id}>
                            <SidebarMenuButton
                              asChild
                              tooltip={item.title}
                              className="hover:bg-transparent"
                            >
                              <NavLink
                                to={item.url}
                                end
                                className="flex w-full items-center rounded-lg px-3 py-2.5 text-sm font-bold text-[#CFDCE9] transition-all hover:bg-white/10 hover:text-white"
                                activeClassName="bg-white !text-[#173D6E] font-extrabold shadow-[0_5px_14px_rgba(4,24,48,0.16)] hover:bg-white hover:!text-[#173D6E]"
                              >
                                <item.icon className="mr-3 h-[18px] w-[18px] shrink-0 text-[#AFC8DF]" />
                                <span className="truncate">{item.title}</span>
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

      {/* Rodapé azul, simples como a referência */}
      <SidebarFooter className="border-t border-white/15 bg-[#173D6E] p-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={logout}
          className={`w-full rounded-lg font-bold text-[#D8E4EF] transition-all hover:bg-white/10 hover:text-white ${
            collapsed
              ? "h-11 justify-center px-0"
              : "h-11 justify-start px-3"
          }`}
        >
          <LogOut className="h-5 w-5 shrink-0" />

          {!collapsed && (
            <span className="ml-3 text-sm font-extrabold">
              Sair
            </span>
          )}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}