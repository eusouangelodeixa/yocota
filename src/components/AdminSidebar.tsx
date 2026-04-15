import {
  LayoutDashboard, Package, ShoppingCart, Gift, ClipboardList,
  Truck, MessageSquare, Settings, LogOut,
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { YocotaLogo } from "@/components/YocotaLogo";

const menuItems = [
  { title: "Dashboard",     url: "/admin",                 icon: LayoutDashboard },
  { title: "Produtos",      url: "/admin/produtos",        icon: Package },
  { title: "Checkouts",     url: "/admin/checkouts",       icon: ShoppingCart },
  { title: "Ofertas",       url: "/admin/ofertas",         icon: Gift },
  { title: "Pedidos",       url: "/admin/pedidos",         icon: ClipboardList },
  { title: "Entregas",      url: "/admin/entregas",        icon: Truck },
  { title: "Remarketing",   url: "/admin/remarketing",     icon: MessageSquare },
  { title: "Configurações", url: "/admin/configuracoes",   icon: Settings },
];

interface Props {
  onNavigate?: () => void;
  /** Called when a collapsed icon is clicked (mobile: trigger expand) */
  onIconClick?: () => void;
  expanded?: boolean;
}

export function AdminSidebar({ onNavigate, onIconClick, expanded = false }: Props) {
  const location = useLocation();
  const { signOut } = useAuth();

  const isActive = (path: string) => {
    if (path === "/admin") return location.pathname === "/admin";
    return location.pathname.startsWith(path);
  };

  return (
    <aside
      className="h-screen flex flex-col bg-background border-r border-border overflow-hidden transition-all duration-200 ease-in-out"
      style={{ width: expanded ? "210px" : "56px" }}
    >
      {/* Logo */}
      <div className="h-14 flex items-center px-3 shrink-0 overflow-hidden">
        <YocotaLogo size={28} className="shrink-0" />
        {expanded && (
          <span className="ml-3 font-bold text-[15px] text-foreground whitespace-nowrap">
            Yocota
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 flex flex-col gap-0.5 py-2 px-2 overflow-hidden">
        {menuItems.map((item) => {
          const active = isActive(item.url);

          if (expanded) {
            return (
              <NavLink
                key={item.title}
                to={item.url}
                end={item.url === "/admin"}
                onClick={onNavigate}
                className={`relative flex items-center gap-3 px-3 h-10 rounded-lg transition-colors duration-150 overflow-hidden ${
                  active
                    ? "text-foreground bg-secondary"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
              >
                {active && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2.5px] h-5 bg-primary rounded-r" />
                )}
                <item.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.5} />
                <span className="text-[13px] font-medium whitespace-nowrap">{item.title}</span>
              </NavLink>
            );
          }

          // Collapsed: icon only - clicking expands (mobile) or tooltip shows (desktop hover)
          return (
            <Tooltip key={item.title} delayDuration={300}>
              <TooltipTrigger asChild>
                <button
                  onClick={onIconClick}
                  className={`relative w-10 h-10 flex items-center justify-center rounded-lg transition-colors duration-150 ${
                    active
                      ? "text-foreground bg-secondary"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  }`}
                >
                  {active && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2.5px] h-5 bg-primary rounded-r" />
                  )}
                  <item.icon className="h-[18px] w-[18px]" strokeWidth={1.5} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="card-elevated text-xs font-medium text-foreground border-border">
                {item.title}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="pb-3 shrink-0 px-2 overflow-hidden">
        {expanded ? (
          <button
            onClick={() => signOut()}
            className="flex items-center gap-3 w-full h-10 px-3 rounded-lg text-muted-foreground hover:text-destructive hover:bg-secondary transition-colors duration-150"
          >
            <LogOut className="h-[18px] w-[18px] shrink-0" strokeWidth={1.5} />
            <span className="text-[13px] font-medium whitespace-nowrap">Sair</span>
          </button>
        ) : (
          <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
              <button
                onClick={() => signOut()}
                className="w-10 h-10 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors duration-150 rounded-lg hover:bg-secondary"
              >
                <LogOut className="h-[18px] w-[18px]" strokeWidth={1.5} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="card-elevated text-xs font-medium text-foreground border-border">
              Sair
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </aside>
  );
}
