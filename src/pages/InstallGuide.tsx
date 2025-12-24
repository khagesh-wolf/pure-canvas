import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { ArrowLeft, Share, Plus, Check, Smartphone, Monitor } from 'lucide-react';

// Detect iOS
const isIOS = () => {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

// Check if running as PWA (works for both iOS and Android)
const isPWAMode = () => {
  const isIOSStandalone = (window.navigator as any).standalone === true;
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  const isFullscreen = window.matchMedia('(display-mode: fullscreen)').matches;
  const isPWALaunch = new URLSearchParams(window.location.search).get('source') === 'pwa';
  const wasInstalled = localStorage.getItem('chiyadani:pwaInstalled') === 'true';
  
  return isIOSStandalone || isStandalone || isFullscreen || isPWALaunch || wasInstalled;
};

export default function InstallGuide() {
  const navigate = useNavigate();
  const { settings } = useStore();
  const iOS = isIOS();
  const isPWA = isPWAMode();

  if (isPWA) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-black to-gray-900 flex flex-col items-center justify-center p-6 text-white">
        <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mb-6">
          <Check className="w-10 h-10 text-green-400" />
        </div>
        <h1 className="text-2xl font-bold mb-2">App Installed!</h1>
        <p className="text-gray-400 text-center mb-8">
          You're all set. Scan a table QR code to start ordering.
        </p>
        <button
          onClick={() => navigate('/scan')}
          className="bg-white text-black px-8 py-4 rounded-xl font-semibold"
        >
          Go to Scanner
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-black to-gray-900 text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-lg border-b border-white/10">
        <div className="flex items-center gap-4 p-4">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold">Install Guide</h1>
        </div>
      </header>

      <div className="p-6 max-w-lg mx-auto">
        {/* Logo */}
        <div className="text-center mb-8">
          {settings.logo ? (
            <img 
              src={settings.logo} 
              alt={settings.restaurantName} 
              className="w-16 h-16 rounded-2xl object-cover mx-auto mb-3 shadow-xl"
            />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center mx-auto mb-3 shadow-xl">
              <span className="text-3xl">🍵</span>
            </div>
          )}
          <h2 className="text-xl font-bold">{settings.restaurantName}</h2>
          <p className="text-gray-400 text-sm">Add to Home Screen</p>
        </div>

        {/* Device Tabs */}
        <div className="flex gap-2 mb-6">
          <div className={`flex-1 py-3 px-4 rounded-xl text-center font-medium transition-all ${iOS ? 'bg-white text-black' : 'bg-white/10 text-gray-400'}`}>
            <Smartphone className="w-5 h-5 mx-auto mb-1" />
            iPhone
          </div>
          <div className={`flex-1 py-3 px-4 rounded-xl text-center font-medium transition-all ${!iOS ? 'bg-white text-black' : 'bg-white/10 text-gray-400'}`}>
            <Monitor className="w-5 h-5 mx-auto mb-1" />
            Android
          </div>
        </div>

        {iOS ? (
          /* iOS Instructions */
          <div className="space-y-6">
            {/* Step 1 */}
            <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold">
                  1
                </div>
                <div>
                  <h3 className="font-semibold">Tap the Share Button</h3>
                  <p className="text-gray-400 text-sm">At the bottom of Safari</p>
                </div>
              </div>
              
              {/* Animated Demo */}
              <div className="bg-gray-800 rounded-xl p-4 relative overflow-hidden">
                <div className="flex items-center justify-center gap-6 py-4">
                  <div className="text-gray-600">←</div>
                  <div className="text-gray-600">→</div>
                  <div className="relative">
                    <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center animate-pulse">
                      <Share className="w-6 h-6 text-blue-400" />
                    </div>
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full animate-ping" />
                  </div>
                  <div className="text-gray-600">📖</div>
                  <div className="text-gray-600">⊞</div>
                </div>
                <p className="text-center text-gray-500 text-xs mt-2">Safari toolbar</p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold">
                  2
                </div>
                <div>
                  <h3 className="font-semibold">Select "Add to Home Screen"</h3>
                  <p className="text-gray-400 text-sm">Scroll down in the share menu</p>
                </div>
              </div>
              
              {/* Animated Demo */}
              <div className="bg-gray-800 rounded-xl p-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-3 p-3 bg-gray-700/50 rounded-lg opacity-50">
                    <div className="w-8 h-8 bg-gray-600 rounded-lg" />
                    <span className="text-gray-400 text-sm">Copy</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-white/10 rounded-lg border-2 border-amber-500 animate-pulse">
                    <div className="w-8 h-8 bg-gray-700 rounded-lg flex items-center justify-center">
                      <Plus className="w-5 h-5 text-gray-300" />
                    </div>
                    <span className="text-white text-sm font-medium">Add to Home Screen</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-gray-700/50 rounded-lg opacity-50">
                    <div className="w-8 h-8 bg-gray-600 rounded-lg" />
                    <span className="text-gray-400 text-sm">Add to Reading List</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold">
                  3
                </div>
                <div>
                  <h3 className="font-semibold">Tap "Add" to Confirm</h3>
                  <p className="text-gray-400 text-sm">Top right corner</p>
                </div>
              </div>
              
              {/* Animated Demo */}
              <div className="bg-gray-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-blue-400 text-sm">Cancel</span>
                  <span className="text-white font-medium">Add to Home Screen</span>
                  <span className="text-blue-400 text-sm font-semibold animate-pulse">Add</span>
                </div>
                <div className="flex items-center gap-4 p-3 bg-gray-700/50 rounded-xl">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
                    <span className="text-xl">🍵</span>
                  </div>
                  <div>
                    <p className="text-white font-medium">{settings.restaurantName}</p>
                    <p className="text-gray-500 text-xs truncate max-w-[180px]">{window.location.origin}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 4 */}
            <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-green-500 text-white flex items-center justify-center font-bold">
                  <Check className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold">Open from Home Screen</h3>
                  <p className="text-gray-400 text-sm">Find the app icon and tap it</p>
                </div>
              </div>
              
              {/* Animated Demo */}
              <div className="bg-gray-800 rounded-xl p-4">
                <div className="grid grid-cols-4 gap-3">
                  <div className="text-center">
                    <div className="w-12 h-12 bg-gray-700 rounded-xl mx-auto mb-1" />
                    <span className="text-gray-500 text-xs">App</span>
                  </div>
                  <div className="text-center">
                    <div className="w-12 h-12 bg-gray-700 rounded-xl mx-auto mb-1" />
                    <span className="text-gray-500 text-xs">App</span>
                  </div>
                  <div className="text-center animate-bounce">
                    <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl mx-auto mb-1 flex items-center justify-center shadow-lg shadow-amber-500/30">
                      <span className="text-lg">🍵</span>
                    </div>
                    <span className="text-white text-xs font-medium">{settings.restaurantName.split(' ')[0]}</span>
                  </div>
                  <div className="text-center">
                    <div className="w-12 h-12 bg-gray-700 rounded-xl mx-auto mb-1" />
                    <span className="text-gray-500 text-xs">App</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Android Instructions */
          <div className="space-y-6">
            {/* Step 1 */}
            <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-green-500 text-white flex items-center justify-center font-bold">
                  1
                </div>
                <div>
                  <h3 className="font-semibold">Tap the Menu (⋮)</h3>
                  <p className="text-gray-400 text-sm">Top right of Chrome browser</p>
                </div>
              </div>
              
              <div className="bg-gray-800 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div className="text-gray-500">← →</div>
                  <div className="flex-1 mx-4 bg-gray-700 rounded-full px-4 py-2">
                    <span className="text-gray-400 text-sm">{window.location.host}</span>
                  </div>
                  <div className="relative">
                    <div className="text-white text-lg animate-pulse">⋮</div>
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full animate-ping" />
                  </div>
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-green-500 text-white flex items-center justify-center font-bold">
                  2
                </div>
                <div>
                  <h3 className="font-semibold">Select "Install App" or "Add to Home"</h3>
                  <p className="text-gray-400 text-sm">In the dropdown menu</p>
                </div>
              </div>
              
              <div className="bg-gray-800 rounded-xl p-4">
                <div className="space-y-1">
                  <div className="p-3 text-gray-400 text-sm">New tab</div>
                  <div className="p-3 text-gray-400 text-sm">New incognito tab</div>
                  <div className="p-3 bg-white/10 rounded-lg text-white text-sm font-medium border-2 border-amber-500 animate-pulse">
                    📲 Install app
                  </div>
                  <div className="p-3 text-gray-400 text-sm">Add to Home screen</div>
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-green-500 text-white flex items-center justify-center font-bold">
                  3
                </div>
                <div>
                  <h3 className="font-semibold">Tap "Install" to Confirm</h3>
                  <p className="text-gray-400 text-sm">In the popup dialog</p>
                </div>
              </div>
              
              <div className="bg-gray-800 rounded-xl p-4">
                <div className="bg-gray-700 rounded-xl p-4">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl flex items-center justify-center">
                      <span className="text-lg">🍵</span>
                    </div>
                    <div>
                      <p className="text-white font-medium">{settings.restaurantName}</p>
                      <p className="text-gray-500 text-xs">{window.location.host}</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button className="flex-1 py-2 text-gray-400 text-sm">Cancel</button>
                    <button className="flex-1 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium animate-pulse">
                      Install
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* Bottom spacing */}
        <div className="h-20" />
      </div>
    </div>
  );
}