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
import Offers from "@/pages/admin/Offers";
import Deliveries from "@/pages/admin/Deliveries";
import Remarketing from "@/pages/admin/Remarketing";
import Settings from "@/pages/admin/Settings";
import CheckoutPage from "@/pages/CheckoutPage";
import OfferFrame from "@/pages/OfferFrame";
import SuccessPage from "@/pages/SuccessPage";
import RecoverPage from "@/pages/RecoverPage";
import LandingPage from "@/pages/LandingPage";
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
          <Route path="/offer-frame/:token" element={<OfferFrame />} />
          <Route path="/success/:checkoutId" element={<SuccessPage />} />
          <Route path="/recover/:token" element={<RecoverPage />} />
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
            <Route path="ofertas" element={<Offers />} />
            <Route path="entregas" element={<Deliveries />} />
            <Route path="remarketing" element={<Remarketing />} />
            <Route path="configuracoes" element={<Settings />} />
          </Route>
          <Route path="/" element={<LandingPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
