import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSettings } from "@/hooks/useSettings";
import { useSavePWAStartPage } from "@/hooks/usePWAStartPage";
import { Download, ChefHat, CheckCircle2, Loader2, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

function isPWA(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  );
}

export default function InstallKitchen() {
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

  const appName = settings.restaurantName || "Kitchen";
  const appSubName = settings.restaurantSubName;
  const fullAppName = appSubName ? `${appName} - ${appSubName}` : appName;
  const appLogo = settings.logo;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-950 via-slate-900 to-orange-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
      </div>
    );
  }

  if (isInstalling) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-950 via-slate-900 to-orange-950 flex flex-col items-center justify-center p-6 text-white">
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 max-w-md w-full text-center border border-white/10">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-orange-500/20 flex items-center justify-center">
            <Loader2 className="w-10 h-10 text-orange-400 animate-spin" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Installing Kitchen Display...</h2>
          <p className="text-slate-400">Setting up your order display system.</p>
          <div className="mt-6 flex justify-center gap-1">
            <div className="w-2 h-2 rounded-full bg-orange-400 animate-bounce" style={{ animationDelay: "0ms" }} />
            <div className="w-2 h-2 rounded-full bg-orange-400 animate-bounce" style={{ animationDelay: "150ms" }} />
            <div className="w-2 h-2 rounded-full bg-orange-400 animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
        </div>
      </div>
    );
  }

  if (isInstalled) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-950 via-slate-900 to-orange-950 flex flex-col items-center justify-center p-6 text-white">
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 max-w-md w-full text-center border border-white/10">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-orange-500/20 flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-orange-400" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Kitchen Display Installed!</h2>
          <p className="text-slate-400 mb-6">Your order display system is ready.</p>
          <Button 
            onClick={() => navigate('/kitchen')} 
            className="w-full bg-orange-500 hover:bg-orange-600 text-white"
            size="lg"
          >
            <ChevronRight className="w-5 h-5 mr-2" />
            Open Kitchen Display
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-950 via-slate-900 to-orange-950 flex flex-col items-center justify-center p-6 text-white">
      <div className="text-center mb-8">
        {appLogo ? (
          <img
            src={appLogo}
            alt={appName}
            className="w-24 h-24 rounded-2xl object-cover mx-auto mb-6 shadow-2xl shadow-orange-500/30"
          />
        ) : (
          <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-orange-500/30">
            <ChefHat className="w-12 h-12 text-white" />
          </div>
        )}
        <h1 className="text-3xl font-bold">{fullAppName}</h1>
        <p className="text-slate-400 mt-2">Kitchen Display</p>
      </div>

      <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 max-w-md w-full border border-white/10">
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-orange-500/20 flex items-center justify-center">
            <Download className="w-8 h-8 text-orange-400" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Install on Desktop</h2>
          <p className="text-slate-400 text-sm">
            Install for fullscreen display, sound alerts, and continuous operation.
          </p>
        </div>

        {deferredPrompt ? (
          <Button 
            onClick={handleInstall} 
            className="w-full bg-orange-500 hover:bg-orange-600 text-white"
            size="lg"
          >
            <Download className="w-5 h-5 mr-2" />
            Install Kitchen Display
          </Button>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-slate-300 font-medium text-center">Install from Chrome:</p>
            <div className="space-y-3">
              <div className="flex items-start gap-3 bg-white/5 rounded-xl p-4">
                <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-orange-400">1</span>
                </div>
                <div>
                  <p className="text-sm font-medium">Click the install icon</p>
                  <p className="text-xs text-slate-400 mt-0.5">In the address bar (right side)</p>
                </div>
              </div>
              <div className="flex items-start gap-3 bg-white/5 rounded-xl p-4">
                <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-orange-400">2</span>
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
              <span className="text-lg">📺</span>
              <p className="text-xs text-slate-400 mt-1">Fullscreen</p>
            </div>
            <div className="bg-white/5 rounded-xl p-3">
              <span className="text-lg">🔔</span>
              <p className="text-xs text-slate-400 mt-1">Alerts</p>
            </div>
            <div className="bg-white/5 rounded-xl p-3">
              <span className="text-lg">⏱️</span>
              <p className="text-xs text-slate-400 mt-1">Timers</p>
            </div>
          </div>
        </div>
      </div>

      <button onClick={() => navigate('/kitchen')} className="mt-6 text-sm text-slate-500 underline">
        Continue in browser
      </button>
    </div>
  );
}
