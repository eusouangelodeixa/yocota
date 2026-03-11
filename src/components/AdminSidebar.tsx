import {
  LayoutDashboard, Package, ShoppingCart, Gift, ClipboardList,
  Truck, MessageSquare, Settings, LogOut,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const menuItems = [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
  { title: "Produtos", url: "/admin/produtos", icon: Package },
  { title: "Checkouts", url: "/admin/checkouts", icon: ShoppingCart },
  { title: "Ofertas", url: "/admin/ofertas", icon: Gift },
  { title: "Pedidos", url: "/admin/pedidos", icon: ClipboardList },
  { title: "Entregas", url: "/admin/entregas", icon: Truck },
  { title: "Remarketing", url: "/admin/remarketing", icon: MessageSquare },
  { title: "Configurações", url: "/admin/configuracoes", icon: Settings },
];

export function AdminSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();
  const { signOut } = useAuth();

  const isActive = (path: string) => {
    if (path === "/admin") return location.pathname === "/admin";
    return location.pathname.startsWith(path);
  };

  return (
    <aside className="w-14 shrink-0 h-screen flex flex-col bg-background border-r border-border">
      {/* Logo */}
      <div className="h-14 flex items-center justify-center">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
          <span className="text-primary-foreground font-bold text-sm">Y</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 flex flex-col items-center gap-1 py-3">
        {menuItems.map((item) => {
          const active = isActive(item.url);
          return (
            <Tooltip key={item.title} delayDuration={200}>
              <TooltipTrigger asChild>
                <NavLink
                  to={item.url}
                  end={item.url === "/admin"}
                  onClick={onNavigate}
                  className={`relative w-10 h-10 flex items-center justify-center transition-colors duration-150 ${
                    active
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  {active && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-5 bg-primary" />
                  )}
                  <item.icon className="h-[18px] w-[18px]" strokeWidth={1.5} />
                </NavLink>
              </TooltipTrigger>
              <TooltipContent side="right" className="card-elevated text-xs font-medium text-foreground border-border">
                {item.title}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="pb-3 flex justify-center">
        <Tooltip delayDuration={200}>
          <TooltipTrigger asChild>
            <button
              onClick={() => signOut()}
              className="w-10 h-10 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors duration-150"
            >
              <LogOut className="h-[18px] w-[18px]" strokeWidth={1.5} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="card-elevated text-xs font-medium text-foreground border-border">
            Sair
          </TooltipContent>
        </Tooltip>
      </div>
    </aside>
  );
}
