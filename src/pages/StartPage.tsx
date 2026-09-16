import {
  CalendarDays,
  CalendarPlus,
  ChevronRight,
  LayoutDashboard,
  MapPin,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import type { AccessRule } from "@/lib/access";
import { APP_ROUTE_ACCESS, hasAccessToRule } from "@/lib/access";

interface StartOption {
  title: string;
  description: string;
  route: string;
  icon: LucideIcon;
  access: AccessRule;
}

const START_OPTIONS: StartOption[] = [
  {
    title: "Dashboard do Campo",
    description: "Indicadores estratégicos e visão geral da operação.",
    route: "/dashboard",
    icon: LayoutDashboard,
    access: APP_ROUTE_ACCESS.dashboard,
  },
  {
    title: "Campo",
    description: "Acompanhamento operacional e localização dos produtores.",
    route: "/campo",
    icon: MapPin,
    access: APP_ROUTE_ACCESS.campo,
  },
  {
    title: "Visitas",
    description: "Consulta das informações e atividades realizadas em campo.",
    route: "/visitas",
    icon: Users,
    access: APP_ROUTE_ACCESS.visitas,
  },
  {
    title: "Agendamentos",
    description: "Programação e gerenciamento das visitas aos produtores.",
    route: "/agendamento",
    icon: CalendarPlus,
    access: APP_ROUTE_ACCESS.agendamento,
  },
  {
    title: "Escala",
    description: "Planejamento, indicadores e análise mensal da escala.",
    route: "/escala",
    icon: CalendarDays,
    access: APP_ROUTE_ACCESS.escala,
  },
];

export default function StartPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const options = START_OPTIONS.filter((option) =>
    hasAccessToRule(user, option.access),
  );

  return (
    <div className="min-h-full bg-[#F5F8FB] p-4 sm:p-6 lg:p-10">
      <div className="mx-auto max-w-6xl">
        <div className="overflow-hidden rounded-3xl border border-[#D6E1EB] bg-white shadow-[0_12px_34px_rgba(23,61,110,0.08)]">
          <div className="h-2 bg-[linear-gradient(90deg,#E30613_0_34%,#1B58A0_34%_70%,#0AB1D8_70%)]" />
          <div className="px-5 py-7 sm:px-8 sm:py-9">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#D96B1A]">
              Vértice Compra de Gado
            </p>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-[#173D6E] sm:text-3xl">
              Onde você deseja entrar?
            </h1>
            <p className="mt-2 max-w-2xl text-sm font-medium text-[#60758A]">
              Selecione uma das áreas disponíveis para o seu perfil.
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {options.map((option) => {
            const Icon = option.icon;
            return (
              <Card
                key={option.route}
                role="button"
                tabIndex={0}
                onClick={() => navigate(option.route)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    navigate(option.route);
                  }
                }}
                className="group cursor-pointer rounded-2xl border-[#D6E1EB] bg-white shadow-[0_5px_18px_rgba(23,61,110,0.05)] transition hover:-translate-y-0.5 hover:border-[#1B58A0] hover:shadow-[0_10px_24px_rgba(23,61,110,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1B58A0]"
              >
                <CardContent className="flex min-h-[142px] items-center gap-4 p-5">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#173D6E] text-white shadow-sm">
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-base font-black text-[#173D6E]">
                      {option.title}
                    </h2>
                    <p className="mt-1 text-xs font-medium leading-5 text-[#60758A]">
                      {option.description}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-[#9BAFC2] transition group-hover:translate-x-1 group-hover:text-[#1B58A0]" />
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
