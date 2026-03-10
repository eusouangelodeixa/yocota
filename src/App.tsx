import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminLayout } from "@/components/AdminLayout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/admin/Dashboard";
import Products from "@/pages/admin/Products";
import Checkouts from "@/pages/admin/Checkouts";
import Orders from "@/pages/admin/Orders";
import Placeholder from "@/pages/admin/Placeholder";
import CheckoutPage from "@/pages/CheckoutPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/checkout/:slug" element={<CheckoutPage />} />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="produtos" element={<Products />} />
            <Route path="checkouts" element={<Checkouts />} />
            <Route path="pedidos" element={<Orders />} />
            <Route path="ofertas" element={<Placeholder title="Ofertas" />} />
            <Route path="entregas" element={<Placeholder title="Entregas" />} />
            <Route path="remarketing" element={<Placeholder title="Remarketing" />} />
            <Route path="configuracoes" element={<Placeholder title="Configurações" />} />
          </Route>
          <Route path="/" element={<Login />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
