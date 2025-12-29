import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { DataProvider } from "@/components/DataProvider";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { SubscriptionGuard } from "@/components/SubscriptionGuard";
import { PWASplashScreen } from "@/components/PWASplashScreen";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { usePWARedirect } from "@/hooks/usePWAStartPage";
import Hub from "./pages/Hub";
import TableOrder from "./pages/TableOrder";
import ScanTable from "./pages/ScanTable";
import Install from "./pages/Install";
import InstallCounter from "./pages/install/InstallCounter";
import InstallAdmin from "./pages/install/InstallAdmin";
import InstallKitchen from "./pages/install/InstallKitchen";
import InstallWaiter from "./pages/install/InstallWaiter";
import Counter from "./pages/Counter";
import Admin from "./pages/Admin";
import Auth from "./pages/Auth";
import Kitchen from "./pages/Kitchen";
import Waiter from "./pages/Waiter";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Component to handle document title updates and PWA redirect
const AppInitializer = () => {
  useDocumentTitle();
  usePWARedirect();
  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner position="top-right" />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          {/* Install pages - outside DataProvider for fast loading */}
          <Route path="/install" element={<Install />} />
          <Route path="/install/counter" element={<InstallCounter />} />
          <Route path="/install/admin" element={<InstallAdmin />} />
          <Route path="/install/kitchen" element={<InstallKitchen />} />
          <Route path="/install/waiter" element={<InstallWaiter />} />
          
          {/* All other routes wrapped in SubscriptionGuard and DataProvider */}
          <Route path="/*" element={
            <SubscriptionGuard>
              <DataProvider>
                <PWASplashScreen>
                  <AppInitializer />
                  <Routes>
                    {/* Customer landing - scan table QR */}
                    <Route path="/" element={<ScanTable />} />
                    
                    {/* Staff hub - requires knowing the URL */}
                    <Route path="/hub" element={<Hub />} />
                    <Route path="/table/:tableNumber" element={<TableOrder />} />
                    
                    {/* Staff routes */}
                    <Route path="/counter" element={<Counter />} />
                    <Route path="/admin" element={<Admin />} />
                    <Route path="/kitchen" element={<Kitchen />} />
                    <Route path="/waiter" element={<Waiter />} />
                    <Route path="/auth" element={<Auth />} />
                    
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                  <OfflineIndicator />
                </PWASplashScreen>
              </DataProvider>
            </SubscriptionGuard>
          } />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
