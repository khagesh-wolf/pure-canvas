import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSettings } from "@/hooks/useSettings";
import { useSavePWAStartPage } from "@/hooks/usePWAStartPage";
import { Download, Monitor, CheckCircle2, Loader2, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

function isPWA(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  );
}

export default function InstallCounter() {
  const navigate = useNavigate();
  const { settings, isLoading } = useSettings();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  
  // Save start page for PWA redirect
  useSavePWAStartPage();

  useEffect(() => {
    if (isPWA()) {
      setIsInstalled(true);
    }
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handler);

    const installHandler = () => {
      if (isInstalling) {
        setTimeout(() => {
          setIsInstalled(true);
          setIsInstalling(false);
          setDeferredPrompt(null);
        }, 1500);
      }
    };

    window.addEventListener("appinstalled", installHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installHandler);
    };
  }, [isInstalling]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      setIsInstalling(true);
      setTimeout(() => {
        setIsInstalled(true);
        setIsInstalling(false);
      }, 2000);
    }
    setDeferredPrompt(null);
  };

  const appName = settings.restaurantName || "Counter";
  const appSubName = settings.restaurantSubName;
  const fullAppName = appSubName ? `${appName} - ${appSubName}` : appName;
  const appLogo = settings.logo;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
      </div>
    );
  }

  if (isInstalling) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center p-6 text-white">
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 max-w-md w-full text-center border border-white/10">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-emerald-500/20 flex items-center justify-center">
            <Loader2 className="w-10 h-10 text-emerald-400 animate-spin" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Installing {fullAppName} Counter...</h2>
          <p className="text-slate-400">Setting up your point-of-sale terminal.</p>
          <div className="mt-6 flex justify-center gap-1">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: "0ms" }} />
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: "150ms" }} />
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
        </div>
      </div>
    );
  }

  if (isInstalled) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center p-6 text-white">
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 max-w-md w-full text-center border border-white/10">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-emerald-500/20 flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold mb-2">{fullAppName} Counter Installed!</h2>
          <p className="text-slate-400 mb-6">Your point-of-sale terminal is ready.</p>
          <Button 
            onClick={() => navigate('/counter')} 
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white"
            size="lg"
          >
            <ChevronRight className="w-5 h-5 mr-2" />
            Open Counter
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center p-6 text-white">
      <div className="text-center mb-8">
        {appLogo ? (
          <img
            src={appLogo}
            alt={appName}
            className="w-24 h-24 rounded-2xl object-cover mx-auto mb-6 shadow-2xl shadow-emerald-500/30"
          />
        ) : (
          <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-emerald-500/30">
            <Monitor className="w-12 h-12 text-white" />
          </div>
        )}
        <h1 className="text-3xl font-bold">{fullAppName}</h1>
        <p className="text-slate-400 mt-2">Counter Terminal</p>
      </div>

      <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 max-w-md w-full border border-white/10">
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-emerald-500/20 flex items-center justify-center">
            <Download className="w-8 h-8 text-emerald-400" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Install on Desktop</h2>
          <p className="text-slate-400 text-sm">
            Install for fullscreen mode, keyboard shortcuts, and offline access.
          </p>
        </div>

        {deferredPrompt ? (
          <Button 
            onClick={handleInstall} 
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white"
            size="lg"
          >
            <Download className="w-5 h-5 mr-2" />
            Install {fullAppName} Counter
          </Button>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-slate-300 font-medium text-center">Install from Chrome:</p>
            <div className="space-y-3">
              <div className="flex items-start gap-3 bg-white/5 rounded-xl p-4">
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-emerald-400">1</span>
                </div>
                <div>
                  <p className="text-sm font-medium">Click the install icon</p>
                  <p className="text-xs text-slate-400 mt-0.5">In the address bar (right side)</p>
                </div>
              </div>
              <div className="flex items-start gap-3 bg-white/5 rounded-xl p-4">
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-emerald-400">2</span>
                </div>
                <div>
                  <p className="text-sm font-medium">Click "Install"</p>
                  <p className="text-xs text-slate-400 mt-0.5">To add to your desktop</p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 pt-6 border-t border-white/10">
          <p className="text-xs text-slate-500 text-center mb-3">Features:</p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-white/5 rounded-xl p-3">
              <span className="text-lg">🖥️</span>
              <p className="text-xs text-slate-400 mt-1">Fullscreen</p>
            </div>
            <div className="bg-white/5 rounded-xl p-3">
              <span className="text-lg">⌨️</span>
              <p className="text-xs text-slate-400 mt-1">Shortcuts</p>
            </div>
            <div className="bg-white/5 rounded-xl p-3">
              <span className="text-lg">📴</span>
              <p className="text-xs text-slate-400 mt-1">Offline</p>
            </div>
          </div>
        </div>
      </div>

      <button onClick={() => navigate('/counter')} className="mt-6 text-sm text-slate-500 underline">
        Continue in browser
      </button>
    </div>
  );
}
