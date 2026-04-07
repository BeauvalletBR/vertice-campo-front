import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

export function AppNav() {
  const location = useLocation();

  return (
    <nav className="bg-primary text-primary-foreground shadow-md">
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-14">
        <span className="font-bold text-sm tracking-tight">
          Vértice - Campo
        </span>
        <div className="flex gap-1">
          <NavItem to="/" active={location.pathname === "/"} icon={<LayoutDashboard className="w-4 h-4" />} label="Dashboard" />
          <NavItem to="/campo" active={location.pathname === "/campo"} icon={<MapPin className="w-4 h-4" />} label="Campo" />
        </div>
      </div>
    </nav>
  );
}

function NavItem({ to, active, icon, label }: { to: string; active: boolean; icon: React.ReactNode; label: string }) {
  return (
    <Link
      to={to}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
        active ? "bg-primary-foreground/20" : "hover:bg-primary-foreground/10"
      )}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
}
