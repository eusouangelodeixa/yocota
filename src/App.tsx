import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/hooks/useTheme";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminLayout } from "@/components/AdminLayout";
import Login from "@/pages/Login";
import Dashboard from "@/features/admin/pages/Dashboard";
import Products from "@/features/admin/pages/Products";
import Checkouts from "@/features/admin/pages/Checkouts";
import Orders from "@/features/admin/pages/Orders";
import Offers from "@/features/admin/pages/Offers";
import Deliveries from "@/features/admin/pages/Deliveries";
import Remarketing from "@/features/admin/pages/Remarketing";
import Settings from "@/features/admin/pages/Settings";
import CheckoutPage from "@/features/checkout/pages/CheckoutPage";
import OfferFrame from "@/features/funnel/pages/OfferFrame";
import SuccessPage from "@/features/funnel/pages/SuccessPage";
import RecoverPage from "@/pages/RecoverPage";
import LandingPage from "@/pages/LandingPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
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
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
