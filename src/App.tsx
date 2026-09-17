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
import SpeechDiag from "./pages/SpeechDiag";
import Sessions from "./pages/Sessions";
import Memorize from "./pages/Memorize";
import { TahfeezErrorBoundary } from "./components/TahfeezErrorBoundary";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
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
        <AppErrorBoundary>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/mushaf" element={<AppErrorBoundary><Index /></AppErrorBoundary>} />
            <Route path="/validation" element={<ValidationReport />} />
            <Route path="/tahfeez" element={<TahfeezErrorBoundary><Tahfeez /></TahfeezErrorBoundary>} />
            <Route path="/audio-diag" element={<AudioDiag />} />
            <Route path="/speech-diag" element={<AppErrorBoundary><SpeechDiag /></AppErrorBoundary>} />
            <Route path="/sessions" element={<Sessions />} />
            <Route path="/memorize" element={<AppErrorBoundary><Memorize /></AppErrorBoundary>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AppErrorBoundary>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  );
};

export default App;

