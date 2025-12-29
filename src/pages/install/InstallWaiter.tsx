import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSettings } from "@/hooks/useSettings";
import { useSavePWAStartPage } from "@/hooks/usePWAStartPage";
import { 
  Download, UserCircle, CheckCircle2, Loader2, ChevronRight,
  Share, Plus, MoreVertical, Smartphone
} from "lucide-react";
import { Button } from "@/components/ui/button";

function isPWA(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  );
}

function getPlatform(): "ios" | "android" | "desktop" {
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (/android/.test(ua)) return "android";
  return "desktop";
}

export default function InstallWaiter() {
  const navigate = useNavigate();
  const { settings, isLoading } = useSettings();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const platform = getPlatform();
  
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

  const appName = settings.restaurantName || "Waiter";
  const appSubName = settings.restaurantSubName;
  const fullAppName = appSubName ? `${appName} - ${appSubName}` : appName;
  const appLogo = settings.logo;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-950 via-slate-900 to-violet-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
      </div>
    );
  }

  if (isInstalling) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-950 via-slate-900 to-violet-950 flex flex-col items-center justify-center p-6 text-white">
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 max-w-sm w-full text-center border border-white/10">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-violet-500/20 flex items-center justify-center">
            <Loader2 className="w-10 h-10 text-violet-400 animate-spin" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Installing Waiter App...</h2>
          <p className="text-slate-400">Setting up your mobile order system.</p>
          <div className="mt-6 flex justify-center gap-1">
            <div className="w-2 h-2 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "0ms" }} />
            <div className="w-2 h-2 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "150ms" }} />
            <div className="w-2 h-2 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
        </div>
      </div>
    );
  }

  if (isInstalled) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-950 via-slate-900 to-violet-950 flex flex-col items-center justify-center p-6 text-white">
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 max-w-sm w-full text-center border border-white/10">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-violet-500/20 flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-violet-400" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Waiter App Installed!</h2>
          <p className="text-slate-400 mb-6">Your mobile order system is ready.</p>
          <Button 
            onClick={() => navigate('/waiter')} 
            className="w-full bg-violet-500 hover:bg-violet-600 text-white"
            size="lg"
          >
            <ChevronRight className="w-5 h-5 mr-2" />
            Open Waiter App
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-950 via-slate-900 to-violet-950 flex flex-col items-center justify-center p-6 text-white">
      <div className="text-center mb-6">
        {appLogo ? (
          <img
            src={appLogo}
            alt={appName}
            className="w-24 h-24 rounded-2xl object-cover mx-auto mb-6 shadow-2xl shadow-violet-500/30"
          />
        ) : (
          <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-violet-500/30">
            <UserCircle className="w-12 h-12 text-white" />
          </div>
        )}
        <h1 className="text-3xl font-bold">{fullAppName}</h1>
        <p className="text-slate-400 mt-2">Waiter App</p>
      </div>

      <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-6 max-w-sm w-full border border-white/10">
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-violet-500/20 flex items-center justify-center">
            <Download className="w-8 h-8 text-violet-400" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Install on Your Phone</h2>
          <p className="text-slate-400 text-sm">
            Install for quick table ordering, notifications, and offline access.
          </p>
        </div>

        {/* Android with prompt available */}
        {deferredPrompt && (
          <Button 
            onClick={handleInstall} 
            className="w-full bg-violet-500 hover:bg-violet-600 text-white mb-4"
            size="lg"
          >
            <Download className="w-5 h-5 mr-2" />
            Install Waiter App
          </Button>
        )}

        {/* iOS Instructions */}
        {platform === "ios" && (
          <div className="space-y-4">
            <p className="text-sm text-slate-300 font-medium">Follow these steps:</p>
            <div className="space-y-3">
              <div className="flex items-start gap-3 bg-white/5 rounded-xl p-3">
                <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-violet-400">1</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Tap the Share button</p>
                  <p className="text-xs text-slate-400 mt-0.5">At the bottom of Safari</p>
                </div>
                <Share className="w-5 h-5 text-blue-400 flex-shrink-0" />
              </div>

              <div className="flex items-start gap-3 bg-white/5 rounded-xl p-3">
                <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-violet-400">2</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Scroll and tap</p>
                  <p className="text-xs text-slate-400 mt-0.5">"Add to Home Screen"</p>
                </div>
                <Plus className="w-5 h-5 text-white flex-shrink-0" />
              </div>

              <div className="flex items-start gap-3 bg-white/5 rounded-xl p-3">
                <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-violet-400">3</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Tap "Add"</p>
                  <p className="text-xs text-slate-400 mt-0.5">In the top right corner</p>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0" />
              </div>
            </div>
          </div>
        )}

        {/* Android Instructions (when no prompt) */}
        {platform === "android" && !deferredPrompt && (
          <div className="space-y-4">
            <p className="text-sm text-slate-300 font-medium">Follow these steps:</p>
            <div className="space-y-3">
              <div className="flex items-start gap-3 bg-white/5 rounded-xl p-3">
                <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-violet-400">1</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Tap the menu icon</p>
                  <p className="text-xs text-slate-400 mt-0.5">Three dots at top right</p>
                </div>
                <MoreVertical className="w-5 h-5 text-slate-400 flex-shrink-0" />
              </div>

              <div className="flex items-start gap-3 bg-white/5 rounded-xl p-3">
                <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-violet-400">2</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Tap "Install App"</p>
                  <p className="text-xs text-slate-400 mt-0.5">Or "Add to Home Screen"</p>
                </div>
                <Download className="w-5 h-5 text-white flex-shrink-0" />
              </div>

              <div className="flex items-start gap-3 bg-white/5 rounded-xl p-3">
                <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-violet-400">3</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Tap "Install"</p>
                  <p className="text-xs text-slate-400 mt-0.5">To confirm installation</p>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0" />
              </div>
            </div>
          </div>
        )}

        {/* Desktop - suggest mobile */}
        {platform === "desktop" && !deferredPrompt && (
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-3 py-4">
              <Smartphone className="w-12 h-12 text-violet-400" />
            </div>
            <p className="text-sm text-slate-300 text-center">
              Open this page on your <strong>mobile phone</strong> for the best waiter experience.
            </p>
          </div>
        )}

        <div className="mt-6 pt-6 border-t border-white/10">
          <p className="text-xs text-slate-500 text-center mb-3">Features:</p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-white/5 rounded-xl p-3">
              <span className="text-lg">📱</span>
              <p className="text-xs text-slate-400 mt-1">Mobile</p>
            </div>
            <div className="bg-white/5 rounded-xl p-3">
              <span className="text-lg">🔔</span>
              <p className="text-xs text-slate-400 mt-1">Alerts</p>
            </div>
            <div className="bg-white/5 rounded-xl p-3">
              <span className="text-lg">📴</span>
              <p className="text-xs text-slate-400 mt-1">Offline</p>
            </div>
          </div>
        </div>
      </div>

      <button onClick={() => navigate('/waiter')} className="mt-6 text-sm text-slate-500 underline">
        Continue in browser
      </button>
    </div>
  );
}
