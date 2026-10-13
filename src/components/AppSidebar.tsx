import { useEffect, useState } from "react";
import {
  Boxes,
  CalendarDays,
  CalendarPlus,
  CalendarRange,
  ChevronDown,
  FileSignature,
  FlaskConical,
  Folder,
  LayoutDashboard,
  ListTodo,
  LogOut,
  MapPin,
  MapPinned,
  PanelLeftClose,
  PanelLeftOpen,
  PlusCircle,
  ShieldCheck,
  TrendingUp,
  Trash2,
  UserCog,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useLocation } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import type { AccessRule } from "@/lib/access";
import {
  APP_ROUTE_ACCESS,
  hasAccessToRule,
} from "@/lib/access";
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
  access?: AccessRule;
}

interface MenuItem {
  id: string;
  title: string;
  icon: LucideIcon;
  url?: string;
  access?: AccessRule;
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


export function AppSidebar() {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { user, logout } = useAuth();

  const isAgendamentoActive = location.pathname.startsWith("/agendamento");
  const isUsuariosActive = location.pathname.startsWith("/admin/usuarios");
  const isEscalaActive = location.pathname.startsWith("/escala");
  const isContratosActive = location.pathname.startsWith("/contratos");
  const isRendimentoActive = location.pathname.startsWith("/rendimento");
  const activeGroupId = isUsuariosActive
    ? "gerenciamento"
    : isEscalaActive
      ? "escala"
      : isContratosActive
        ? "contratos"
        : isRendimentoActive
          ? "rendimento"
          : "campo";

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    gerenciamento: activeGroupId === "gerenciamento",
    campo: activeGroupId === "campo",
    escala: activeGroupId === "escala",
    contratos: activeGroupId === "contratos",
    rendimento: activeGroupId === "rendimento",
  });

  const [openSubmenus, setOpenSubmenus] = useState<Record<string, boolean>>({
    agendamentos: isAgendamentoActive,
    rendimentoCadastros: location.pathname.startsWith("/rendimento/cadastros"),
  });

  useEffect(() => {
    if (collapsed) return;

    setOpenGroups((previous) =>
      Object.keys(previous).reduce<Record<string, boolean>>(
        (groups, groupId) => {
          groups[groupId] = groupId === activeGroupId;
          return groups;
        },
        {},
      ),
    );

    if (isAgendamentoActive) {
      setOpenSubmenus((previous) => ({
        ...previous,
        agendamentos: true,
      }));
    }

    if (isRendimentoActive) {
      if (location.pathname.startsWith("/rendimento/cadastros")) {
        setOpenSubmenus((previous) => ({
          ...previous,
          rendimentoCadastros: true,
        }));
      }
    }

  }, [activeGroupId, collapsed, isAgendamentoActive, isRendimentoActive, location.pathname]);

  const toggleGroup = (groupId: string) => {
    if (collapsed) return;

    setOpenGroups((previous) => {
      const nextOpenState = !previous[groupId];

      return Object.keys(previous).reduce<Record<string, boolean>>(
        (groups, currentGroupId) => {
          groups[currentGroupId] =
            currentGroupId === groupId ? nextOpenState : false;
          return groups;
        },
        {},
      );
    });
  };

  const toggleSubmenu = (submenuId: string) => {
    setOpenSubmenus((previous) => ({
      ...previous,
      [submenuId]: !previous[submenuId],
    }));
  };

  const menuGroups: MenuGroup[] = [
    {
      id: "gerenciamento",
      title: "Gerenciamento",
      icon: UserCog,
      items: [
        {
          id: "usuarios",
          title: "Usuários",
          url: "/admin/usuarios",
          icon: UserCog,
          access: APP_ROUTE_ACCESS.usuarios,
        },
      ],
    },
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
          access: APP_ROUTE_ACCESS.dashboard,
        },
        {
          id: "agendamentos",
          title: "Agendamentos",
          icon: CalendarPlus,
          access: APP_ROUTE_ACCESS.agendamento,
          subItems: [
            {
              title: "Agendar",
              url: "/agendamento",
              icon: PlusCircle,
              access: APP_ROUTE_ACCESS.agendamento,
            },
            {
              title: "Gerenciar",
              url: "/agendamento/gerenciar",
              icon: ListTodo,
              access: APP_ROUTE_ACCESS.agendamento,
            },
          ],
        },
        {
          id: "campo-operacional",
          title: "Campo",
          url: "/campo",
          icon: MapPin,
          access: APP_ROUTE_ACCESS.campo,
        },
        {
          id: "visitas",
          title: "Visitas",
          url: "/visitas",
          icon: Users,
          access: APP_ROUTE_ACCESS.visitas,
        },
        {
          id: "campo-localizacao",
          title: "Localização",
          url: "/campo/localizacao",
          icon: MapPinned,
          access: APP_ROUTE_ACCESS.campo,
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
          icon: CalendarDays,
          access: APP_ROUTE_ACCESS.escala,
          subItems: [
            {
              title: "Dashboard",
              url: "/escala/dashboard",
              icon: LayoutDashboard,
              access: APP_ROUTE_ACCESS.escala,
            },
            {
              title: "Planejamento",
              url: "/escala",
              icon: CalendarDays,
              access: APP_ROUTE_ACCESS.escala,
            },
            {
              title: "Análise mensal",
              url: "/escala/analise-mensal",
              icon: CalendarRange,
              access: APP_ROUTE_ACCESS.escala,
            },
            {
              title: "Realizado mensal",
              url: "/escala/realizado",
              icon: TrendingUp,
              access: APP_ROUTE_ACCESS.escala,
            },
          ],
        },
      ],
    },
    {
      id: "contratos",
      title: "Contratos",
      icon: FileSignature,
      items: [
        {
          id: "contratos-inicio",
          title: "Contratos",
          url: "/contratos",
          icon: FileSignature,
          access: APP_ROUTE_ACCESS.contratos,
        },
      ],
    },
    {
      id: "rendimento",
      title: "Teste rendimento",
      icon: FlaskConical,
      items: [
        {
          id: "rendimento-testes",
          title: "Testes",
          url: "/rendimento/testes",
          icon: FlaskConical,
          access: APP_ROUTE_ACCESS.rendimento,
        },
        {
          id: "rendimentoCadastros",
          title: "Cadastros",
          icon: Boxes,
          access: APP_ROUTE_ACCESS.rendimento,
          subItems: [
            {
              title: "Produtos/Cortes",
              url: "/rendimento/cadastros/produtos",
              icon: Boxes,
              access: APP_ROUTE_ACCESS.rendimento,
            },
            {
              title: "Tipos de descarte",
              url: "/rendimento/cadastros/descartes",
              icon: Trash2,
              access: APP_ROUTE_ACCESS.rendimento,
            },
          ],
        },
      ],
    },
  ];

  const normalizedMenuGroups = menuGroups.flatMap((group) => {
    if (group.id !== "administrativo") {
      return [group];
    }

    return [
      {
        id: "escala",
        title: "Escala",
        icon: ShieldCheck,
        items: [
          {
            id: "escala-dashboard",
            title: "Dashboard",
            url: "/escala/dashboard",
            icon: LayoutDashboard,
            access: APP_ROUTE_ACCESS.escala,
          },
          {
            id: "escala-planejamento",
            title: "Planejamento",
            url: "/escala",
            icon: CalendarDays,
            access: APP_ROUTE_ACCESS.escala,
          },
          {
            id: "escala-analise-mensal",
            title: "Análise mensal",
            url: "/escala/analise-mensal",
            icon: CalendarRange,
            access: APP_ROUTE_ACCESS.escala,
          },
          {
            id: "escala-realizado-mensal",
            title: "Realizado mensal",
            url: "/escala/realizado",
            icon: TrendingUp,
            access: APP_ROUTE_ACCESS.escala,
          },
        ],
      },
    ];
  });

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
      <SidebarContent className="app-sidebar-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain bg-[#173D6E] px-0 py-4">
        {normalizedMenuGroups.map((group) => {
          const isGroupOpen = openGroups[group.id];

          const filteredItems = group.items
            .map((item) => {
              const filteredSubItems = item.subItems?.filter((subItem) =>
                hasAccessToRule(user, subItem.access),
              );

              return {
                ...item,
                subItems: filteredSubItems,
              };
            })
            .filter((item) => {
              const hasItemAccess = hasAccessToRule(user, item.access);

              if (item.subItems) {
                return (
                  item.subItems.length > 0 &&
                  hasItemAccess
                );
              }

              return hasItemAccess;
            });

          if (filteredItems.length === 0) return null;

          const isGroupActive = filteredItems.some((item) => {
            if (item.url) {
              return (
                location.pathname === item.url ||
                location.pathname.startsWith(`${item.url}/`)
              );
            }

            return item.subItems?.some(
              (subItem) =>
                location.pathname === subItem.url ||
                location.pathname.startsWith(`${subItem.url}/`),
            );
          });

          return (
            <SidebarGroup
              key={group.id}
              className={`mx-2.5 mb-3 w-auto overflow-hidden rounded-xl border bg-[#F8FAFC] p-0 shadow-[0_6px_16px_rgba(4,25,49,0.18)] transition-all duration-200 ${
                isGroupActive
                  ? "border-[#C9D5E2] shadow-[0_8px_20px_rgba(4,25,49,0.24)]"
                  : "border-[#DCE4EC] hover:border-[#C7D3DF]"
              }`}
            >
              <SidebarMenuItem className="list-none">
                <SidebarMenuButton
                  asChild
                  tooltip={group.title}
                  className="cursor-pointer hover:bg-transparent"
                >
                  <div
                    onClick={() => toggleGroup(group.id)}
                    aria-expanded={Boolean(isGroupOpen)}
                    className={`flex w-full select-none items-center justify-between text-[#173D6E] transition-colors duration-150 ${
                      collapsed ? "h-10 justify-center px-0" : "px-3 py-3"
                    } ${
                      isGroupActive
                        ? "bg-white"
                        : isGroupOpen
                          ? "bg-[#F7F9FC]"
                          : "bg-[#F8FAFC] hover:bg-[#EEF3F7]"
                    }`}
                  >
                    <div className="flex min-w-0 items-center">
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center transition-colors ${
                          isGroupActive
                            ? "text-[#DC2626]"
                            : "text-[#31597D]"
                        } ${collapsed ? "" : "mr-2.5"}`}
                      >
                        <group.icon className="h-4 w-4" />
                      </span>

                      {!collapsed && (
                        <span className="truncate text-[11px] font-black uppercase tracking-[0.105em] text-[#102F53]">
                          {group.title}
                        </span>
                      )}
                    </div>

                    {!collapsed && (
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 transition-all duration-200 ${
                          isGroupActive ? "text-[#DC2626]" : "text-[#607A96]"
                        } ${
                          isGroupOpen ? "rotate-180" : ""
                        }`}
                      />
                    )}
                  </div>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {isGroupOpen && !collapsed && (
                <SidebarGroupContent className="animate-in space-y-1 border-t border-[#E1E7EE] bg-white p-2 fade-in slide-in-from-top-1 duration-150">
                  <SidebarMenu className="space-y-1.5">
                    {filteredItems.length === 0 ? (
                      <div className="px-4 py-2 text-[11px] font-medium italic text-[#7A8DA2]">
                        Nenhum recurso liberado
                      </div>
                    ) : (
                      filteredItems.map((item) => {
                        if (item.subItems) {
                          const isSubmenuOpen =
                            openSubmenus[item.id] || false;

                          const isParentActive =
                            item.id === "escala"
                              ? location.pathname.startsWith("/escala")
                              : item.subItems.some((subItem) =>
                                  isSubItemActive(subItem.url),
                                );

                          return (
                            <div
                              key={item.id}
                              className="flex flex-col space-y-1.5"
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
                                    className={`flex w-full select-none items-center justify-between rounded-lg border px-3 py-2.5 text-sm font-bold transition-all ${
                                      isParentActive
                                        ? "border-[#D3DEE9] bg-[#EDF3F8] text-[#123F73]"
                                        : "border-transparent text-[#294766] hover:border-[#E0E7EE] hover:bg-[#F3F6F9] hover:text-[#123F73]"
                                    }`}
                                  >
                                    <div className="flex min-w-0 items-center">
                                      <item.icon
                                        className={`mr-3 h-[18px] w-[18px] shrink-0 ${
                                          isParentActive
                                            ? "text-[#DC2626]"
                                            : "text-[#607A96]"
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
                                <div className="animate-in space-y-1 py-0.5 pl-5 fade-in slide-in-from-top-1 duration-150">
                                  {item.subItems.map((subItem) => {
                                    const isSubActive = isSubItemActive(
                                      subItem.url,
                                    );

                                    return (
                                      <NavLink
                                        key={subItem.title}
                                        to={subItem.url}
                                        end={subItem.url === "/escala" || subItem.url === "/campo"}
                                        className={`flex w-full items-center rounded-lg border-l-[3px] px-3 py-2.5 text-xs transition-all ${
                                          isSubActive
                                            ? "border-l-[#DC2626] bg-[#FEF2F2] font-extrabold text-[#B91C1C] shadow-[0_2px_8px_rgba(220,38,38,0.08)]"
                                            : "border-l-transparent text-[#405D79] hover:bg-[#F3F6F9] hover:text-[#173D6E]"
                                        }`}
                                      >
                                        <subItem.icon
                                          className={`mr-2 h-3.5 w-3.5 shrink-0 ${
                                            isSubActive
                                              ? "text-[#DC2626]"
                                              : "text-[#70879E]"
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
                                className="flex w-full items-center rounded-lg border-l-[3px] border-l-transparent px-3 py-2.5 text-sm font-bold text-[#294766] transition-all hover:bg-[#F3F6F9] hover:text-[#173D6E]"
                                activeClassName="!border-l-[#DC2626] !bg-[#FEF2F2] !text-[#B91C1C] font-extrabold shadow-[0_2px_8px_rgba(220,38,38,0.08)] hover:!bg-[#FDE8E8] hover:!text-[#991B1B] [&_.module-icon]:!text-[#DC2626]"
                              >
                                <item.icon className="module-icon mr-3 h-[18px] w-[18px] shrink-0 text-[#607A96]" />
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

