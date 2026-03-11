import { Outlet, useLocation } from "react-router-dom";
import { AdminSidebar } from "@/components/AdminSidebar";
import { Bell } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { TooltipProvider } from "@/components/ui/tooltip";

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

  return (
    <TooltipProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AdminSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          {/* Topbar */}
          <header className="h-14 flex items-center justify-between border-b border-border bg-background px-6 shrink-0">
            <div className="flex items-center gap-2 text-[13px]">
              <span className="text-muted-foreground">Yocota</span>
              <span className="text-muted-foreground/40">/</span>
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
          <main className="flex-1 p-6 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
