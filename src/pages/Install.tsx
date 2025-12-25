import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { 
  Download, 
  Smartphone, 
  Share, 
  Plus, 
  MoreVertical,
  ChevronRight,
  CheckCircle2,
  QrCode
} from 'lucide-react';
import { Button } from '@/components/ui/button';

// Detect if running as installed PWA
export function isPWA(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true ||
    document.referrer.includes('android-app://') ||
    window.location.search.includes('utm_source=pwa')
  );
}

// Detect platform
function getPlatform(): 'ios' | 'android' | 'desktop' {
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  if (/android/.test(ua)) return 'android';
  return 'desktop';
}

export default function Install() {
  const navigate = useNavigate();
  const { settings } = useStore();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const platform = getPlatform();

  // Check if already installed
  useEffect(() => {
    if (isPWA()) {
      setIsInstalled(true);
    }
  }, []);

  // Listen for beforeinstallprompt (Chrome/Android)
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handler);
    
    // Listen for successful install
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  // Handle install button click (Android/Chrome)
  const handleInstall = async () => {
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setIsInstalled(true);
      // Check for pending table redirect
      const pendingTable = sessionStorage.getItem('chiyadani:pendingTable');
      if (pendingTable) {
        sessionStorage.removeItem('chiyadani:pendingTable');
        navigate(`/scan?table=${pendingTable}`);
        return;
      }
    }
    setDeferredPrompt(null);
  };

  // Handle navigation after install
  const handleContinue = () => {
    const pendingTable = sessionStorage.getItem('chiyadani:pendingTable');
    if (pendingTable) {
      sessionStorage.removeItem('chiyadani:pendingTable');
      navigate(`/scan?table=${pendingTable}`);
    } else {
      navigate('/scan');
    }
  };

  // If already installed, show success and redirect option
  if (isInstalled) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-black to-gray-900 flex flex-col items-center justify-center p-6 text-white">
        <div className="text-center mb-8">
          {settings.logo ? (
            <img 
              src={settings.logo} 
              alt={settings.restaurantName} 
              className="w-20 h-20 rounded-2xl object-cover mx-auto mb-4 shadow-2xl"
            />
          ) : (
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center mx-auto mb-4 shadow-2xl">
              <span className="text-4xl">🍵</span>
            </div>
          )}
          <h1 className="text-2xl font-bold">{settings.restaurantName}</h1>
        </div>

        <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 max-w-sm w-full text-center border border-white/10">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-success/20 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-success" />
          </div>
          
          <h2 className="text-xl font-semibold mb-2">App Installed!</h2>
          <p className="text-gray-400 text-sm mb-6">
            You can now scan table QR codes to start ordering.
          </p>

          <Button 
            onClick={handleContinue}
            className="w-full bg-white text-black hover:bg-gray-100"
          >
            <QrCode className="w-4 h-4 mr-2" />
            Scan Table QR
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-black to-gray-900 flex flex-col items-center justify-center p-6 text-white">
      {/* Logo */}
      <div className="text-center mb-6">
        {settings.logo ? (
          <img 
            src={settings.logo} 
            alt={settings.restaurantName} 
            className="w-20 h-20 rounded-2xl object-cover mx-auto mb-4 shadow-2xl"
          />
        ) : (
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center mx-auto mb-4 shadow-2xl">
            <span className="text-4xl">🍵</span>
          </div>
        )}
        <h1 className="text-2xl font-bold">{settings.restaurantName}</h1>
        <p className="text-gray-400 mt-1">Digital Menu</p>
      </div>

      {/* Install Card */}
      <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-6 max-w-sm w-full border border-white/10">
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center">
            <Download className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Install Our App</h2>
          <p className="text-gray-400 text-sm">
            Install for faster ordering, offline access, and a better experience.
          </p>
        </div>

        {/* Android/Chrome - Show install button if prompt available */}
        {deferredPrompt && (
          <Button 
            onClick={handleInstall}
            className="w-full bg-white text-black hover:bg-gray-100 mb-4"
            size="lg"
          >
            <Download className="w-5 h-5 mr-2" />
            Install App
          </Button>
        )}

        {/* iOS Instructions */}
        {platform === 'ios' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-300 font-medium">Follow these steps:</p>
            
            <div className="space-y-3">
              <div className="flex items-start gap-3 bg-white/5 rounded-xl p-3">
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold">1</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Tap the Share button</p>
                  <p className="text-xs text-gray-400 mt-0.5">At the bottom of Safari</p>
                </div>
                <Share className="w-5 h-5 text-blue-400 flex-shrink-0" />
              </div>

              <div className="flex items-start gap-3 bg-white/5 rounded-xl p-3">
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold">2</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Scroll and tap</p>
                  <p className="text-xs text-gray-400 mt-0.5">"Add to Home Screen"</p>
                </div>
                <Plus className="w-5 h-5 text-white flex-shrink-0" />
              </div>

              <div className="flex items-start gap-3 bg-white/5 rounded-xl p-3">
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold">3</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Tap "Add"</p>
                  <p className="text-xs text-gray-400 mt-0.5">In the top right corner</p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
              </div>
            </div>
          </div>
        )}

        {/* Android Instructions (when no prompt) */}
        {platform === 'android' && !deferredPrompt && (
          <div className="space-y-4">
            <p className="text-sm text-gray-300 font-medium">Follow these steps:</p>
            
            <div className="space-y-3">
              <div className="flex items-start gap-3 bg-white/5 rounded-xl p-3">
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold">1</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Tap the menu icon</p>
                  <p className="text-xs text-gray-400 mt-0.5">Three dots at top right</p>
                </div>
                <MoreVertical className="w-5 h-5 text-gray-400 flex-shrink-0" />
              </div>

              <div className="flex items-start gap-3 bg-white/5 rounded-xl p-3">
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold">2</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Tap "Install App"</p>
                  <p className="text-xs text-gray-400 mt-0.5">Or "Add to Home Screen"</p>
                </div>
                <Download className="w-5 h-5 text-white flex-shrink-0" />
              </div>

              <div className="flex items-start gap-3 bg-white/5 rounded-xl p-3">
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold">3</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Tap "Install"</p>
                  <p className="text-xs text-gray-400 mt-0.5">To confirm installation</p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
              </div>
            </div>
          </div>
        )}

        {/* Desktop Instructions */}
        {platform === 'desktop' && !deferredPrompt && (
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-3 py-4">
              <Smartphone className="w-12 h-12 text-amber-400" />
            </div>
            <p className="text-sm text-gray-300 text-center">
              Open this page on your <strong>mobile phone</strong> for the best experience. 
              Scan the QR code on your table to get started!
            </p>
          </div>
        )}
      </div>

      {/* Benefits */}
      <div className="mt-6 max-w-sm w-full">
        <p className="text-xs text-gray-500 text-center mb-3">Why install?</p>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-white/5 rounded-xl p-3">
            <span className="text-lg">⚡</span>
            <p className="text-xs text-gray-400 mt-1">Faster</p>
          </div>
          <div className="bg-white/5 rounded-xl p-3">
            <span className="text-lg">📴</span>
            <p className="text-xs text-gray-400 mt-1">Offline</p>
          </div>
          <div className="bg-white/5 rounded-xl p-3">
            <span className="text-lg">🔔</span>
            <p className="text-xs text-gray-400 mt-1">Alerts</p>
          </div>
        </div>
      </div>

      {/* Skip link */}
      <button 
        onClick={() => navigate('/scan')}
        className="mt-6 text-sm text-gray-500 underline"
      >
        Continue in browser instead
      </button>
    </div>
  );
}
