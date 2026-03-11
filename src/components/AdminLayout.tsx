import { Outlet, useLocation } from "react-router-dom";
import { AdminSidebar } from "@/components/AdminSidebar";
import { Bell, Menu, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

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

  return (
    <TooltipProvider>
      <div className="min-h-screen flex w-full bg-background">
        {/* Mobile overlay */}
        {isMobile && sidebarOpen && (
          <div className="fixed inset-0 bg-black/60 z-40" onClick={() => setSidebarOpen(false)} />
        )}

        {/* Sidebar */}
        <div className={`${isMobile ? 'fixed inset-y-0 left-0 z-50 transition-transform duration-220 ease-out' : ''} ${isMobile && !sidebarOpen ? '-translate-x-full' : 'translate-x-0'}`}>
          <AdminSidebar onNavigate={() => setSidebarOpen(false)} />
        </div>

        <div className="flex-1 flex flex-col min-w-0">
          {/* Topbar */}
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
              <button className="relative p-2 text-muted-foreground hover:text-foreground transition-colors duration-150">
                <Bell className="h-4 w-4" strokeWidth={1.5} />
              </button>
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                <span className="text-xs font-bold text-primary-foreground">{displayName[0]?.toUpperCase()}</span>
              </div>
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
