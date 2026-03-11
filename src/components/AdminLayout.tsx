import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/AdminSidebar";
import { Bell, Search } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export function AdminLayout() {
  const { user } = useAuth();
  const displayName = user?.email?.split("@")[0] || "Admin";

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AdminSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-16 flex items-center justify-between border-b border-[rgba(255,255,255,0.06)] bg-background px-6 shrink-0">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="text-muted-foreground hover:text-foreground transition-colors duration-150" />
              <div className="hidden sm:flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Olá,</span>
                <span className="text-sm font-semibold text-foreground">{displayName}</span>
                <span className="text-sm">👋</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden md:flex items-center gap-2 bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] rounded-lg px-3 py-2 w-64">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Buscar..."
                  className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none flex-1"
                />
              </div>
              <button className="relative p-2 rounded-lg hover:bg-[rgba(255,255,255,0.04)] transition-colors duration-150">
                <Bell className="h-4 w-4 text-muted-foreground" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary" />
              </button>
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-xs font-bold text-primary">{displayName[0]?.toUpperCase()}</span>
              </div>
            </div>
          </header>
          <main className="flex-1 p-6 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
