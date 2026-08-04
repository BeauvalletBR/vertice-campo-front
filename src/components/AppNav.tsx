import { Link, useLocation } from "react-router-dom";
import { CalendarDays, LayoutDashboard, MapPin } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

export function AppNav() {
  const location = useLocation();
  const { user } = useAuth();

  const userModules = ((user as { modulos?: string[] } | null)?.modulos || []).map(
    (module) => String(module).trim().toUpperCase(),
  );

  const isAdmin = String((user as { role?: string } | null)?.role || "")
    .trim()
    .toUpperCase() === "ADMIN";

  const podeVisualizarEscala =
    isAdmin ||
    ["ESCALA", "ESCALA_GESTAO", "RELATORIOS", "ADMIN"].some((module) =>
      userModules.includes(module),
    );

  return (
    <nav className="bg-primary text-primary-foreground shadow-md">
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-14">
        <span className="font-bold text-sm tracking-tight">
          Vértice - Campo
        </span>

        <div className="flex gap-1">
          <NavItem
            to="/"
            active={location.pathname === "/"}
            icon={<LayoutDashboard className="w-4 h-4" />}
            label="Dashboard"
          />

          <NavItem
            to="/campo"
            active={location.pathname === "/campo"}
            icon={<MapPin className="w-4 h-4" />}
            label="Campo"
          />

          {podeVisualizarEscala && (
            <NavItem
              to="/escala"
              active={location.pathname.startsWith("/escala")}
              icon={<CalendarDays className="w-4 h-4" />}
              label="Escala"
            />
          )}
        </div>
      </div>
    </nav>
  );
}

interface NavItemProps {
  to: string;
  active: boolean;
  icon: ReactNode;
  label: string;
}

function NavItem({ to, active, icon, label }: NavItemProps) {
  return (
    <Link
      to={to}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
        active
          ? "bg-primary-foreground/20"
          : "hover:bg-primary-foreground/10",
      )}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
}