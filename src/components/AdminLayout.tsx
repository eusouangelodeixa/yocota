import { Outlet, useLocation } from "react-router-dom";
import { AdminSidebar } from "@/components/AdminSidebar";
import { Sun, Moon, Menu } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useState, useEffect, useRef } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useTheme } from "@/hooks/useTheme";

const ROUTE_NAMES: Record<string, string> = {
  "/admin": "Dashboard",
  "/admin/produtos": "Produtos",
  "/admin/checkouts": "Checkouts",
  "/admin/ofertas": "Ofertas",
  "/admin/pedidos": "Pedidos",
  "/admin/entregas": "Entregas",
  "/admin/remarketing": "Remarketing",
  "/admin/configuracoes": "Configurações",
};

export function AdminLayout() {
  const { user } = useAuth();
  const location = useLocation();
  const displayName = user?.email?.split("@")[0] || "Admin";
  const currentRoute = ROUTE_NAMES[location.pathname] || "Admin";
  const isMobile = useIsMobile();

  // Desktop: hover-to-expand
  const [hovered, setHovered] = useState(false);
  // Mobile: hamburger-to-open drawer
  const [mobileOpen, setMobileOpen] = useState(false);

  const sidebarRef = useRef<HTMLDivElement>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    if (!user?.id) return;
    supabase.from("profiles").select("avatar_url").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      if (data?.avatar_url) setAvatarUrl(data.avatar_url);
    });
  }, [user?.id]);

  // Auto-close mobile drawer when route changes
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  // Close mobile drawer when clicking outside
  useEffect(() => {
    if (!isMobile || !mobileOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) {
        setMobileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isMobile, mobileOpen]);

  const isExpanded = isMobile ? mobileOpen : hovered;

  return (
    <TooltipProvider>
      <div className="min-h-screen flex w-full bg-background">

        {/* ── Mobile backdrop overlay ── */}
        {isMobile && mobileOpen && (
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-[2px] z-40 transition-opacity duration-200"
            onClick={() => setMobileOpen(false)}
          />
        )}

        {/* ── Sidebar ── */}
        <div
          ref={sidebarRef}
          className={
            isMobile
              ? `fixed inset-y-0 left-0 z-50 transition-transform duration-200 ease-in-out ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`
              : "relative shrink-0"
          }
          onMouseEnter={() => !isMobile && setHovered(true)}
          onMouseLeave={() => !isMobile && setHovered(false)}
        >
          <AdminSidebar
            expanded={isExpanded}
            onNavigate={() => setMobileOpen(false)}
            onIconClick={() => isMobile && setMobileOpen(true)}
          />
        </div>

        {/* ── Main area (takes full width on mobile) ── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <header className="h-14 flex items-center justify-between border-b border-border bg-background px-4 md:px-6 shrink-0">
            <div className="flex items-center gap-2 text-[13px]">
              {/* Hamburger — mobile only */}
              {isMobile && (
                <button
                  onClick={() => setMobileOpen(true)}
                  className="p-1.5 -ml-1 mr-1 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-accent"
                  aria-label="Abrir menu"
                >
                  <Menu className="h-5 w-5" strokeWidth={1.5} />
                </button>
              )}
              <span className="text-foreground font-medium">{currentRoute}</span>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={toggleTheme}
                className="p-1.5 text-muted-foreground hover:text-foreground transition-colors duration-150 rounded-md hover:bg-accent"
                title={theme === "dark" ? "Tema claro" : "Tema escuro"}
              >
                {theme === "dark" ? <Sun className="h-4.5 w-4.5" strokeWidth={1.5} /> : <Moon className="h-4.5 w-4.5" strokeWidth={1.5} />}
              </button>
              <Avatar className="w-8 h-8">
                {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
                <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
                  {displayName[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </div>
          </header>

          <main className="flex-1 p-4 md:p-6 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}

