import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { YocotaLogo } from "@/components/YocotaLogo";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="text-center space-y-6">
        <div className="flex justify-center">
          <YocotaLogo size={40} />
        </div>
        <h1 className="text-5xl font-extrabold text-foreground tracking-tight">404</h1>
        <p className="text-base text-muted-foreground">Página não encontrada</p>
        <a href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
          <span>•</span> Voltar ao início
        </a>
      </div>
    </div>
  );
};

export default NotFound;
