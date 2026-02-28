import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import ValidationReport from "./pages/ValidationReport";
import Tahfeez from "./pages/Tahfeez";
import AudioDiag from "./pages/AudioDiag";
import { TahfeezErrorBoundary } from "./components/TahfeezErrorBoundary";
import { initOTA } from "./services/otaUpdateService";
import { UpdateBanner } from "./components/UpdateBanner";
import { requestAllNativePermissions } from "./services/nativePermissions";

const queryClient = new QueryClient();

const App = () => {
  useEffect(() => {
    initOTA();
    requestAllNativePermissions();
  }, []);

  return (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <UpdateBanner />
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/mushaf" element={<Index />} />
          <Route path="/validation" element={<ValidationReport />} />
          <Route path="/tahfeez" element={<TahfeezErrorBoundary><Tahfeez /></TahfeezErrorBoundary>} />
          <Route path="/audio-diag" element={<AudioDiag />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  );
};

export default App;

