import { Outlet, useLocation } from "react-router-dom";
import { AdminSidebar } from "@/components/AdminSidebar";
import { Menu, Sun, Moon } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useState, useEffect } from "react";
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    supabase.from("profiles").select("avatar_url, display_name").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      if (data?.avatar_url) setAvatarUrl(data.avatar_url);
    });
  }, [user?.id]);

  return (
    <TooltipProvider>
      <div className="min-h-screen flex w-full bg-background">
        {isMobile && sidebarOpen && (
          <div className="fixed inset-0 bg-black/60 z-40" onClick={() => setSidebarOpen(false)} />
        )}

        <div className={`${isMobile ? 'fixed inset-y-0 left-0 z-50 transition-transform duration-220 ease-out' : ''} ${isMobile && !sidebarOpen ? '-translate-x-full' : 'translate-x-0'}`}>
          <AdminSidebar onNavigate={() => setSidebarOpen(false)} />
        </div>

        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b border-border bg-background px-4 md:px-6 shrink-0">
            <div className="flex items-center gap-3 text-[13px]">
              {isMobile && (
                <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1.5 -ml-1 text-muted-foreground hover:text-foreground transition-colors duration-150">
                  <Menu className="h-5 w-5" strokeWidth={1.5} />
                </button>
              )}
              <span className="text-muted-foreground hidden sm:inline">Yocota</span>
              <span className="text-muted-foreground/40 hidden sm:inline">/</span>
              <span className="text-foreground font-medium">{currentRoute}</span>
            </div>
            <div className="flex items-center gap-3">
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
