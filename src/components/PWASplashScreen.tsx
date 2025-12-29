import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useStore } from '@/store/useStore';

function isPWA(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  );
}

const ROLE_COLORS: Record<string, { gradient: string; accent: string }> = {
  '/admin': { gradient: 'from-indigo-950 via-slate-900 to-indigo-950', accent: 'text-indigo-400' },
  '/counter': { gradient: 'from-slate-900 via-slate-800 to-slate-900', accent: 'text-emerald-400' },
  '/kitchen': { gradient: 'from-orange-950 via-slate-900 to-orange-950', accent: 'text-orange-400' },
  '/waiter': { gradient: 'from-violet-950 via-slate-900 to-violet-950', accent: 'text-violet-400' },
};

const ROLE_LABELS: Record<string, string> = {
  '/admin': 'Admin Dashboard',
  '/counter': 'Counter Terminal',
  '/kitchen': 'Kitchen Display',
  '/waiter': 'Waiter App',
};

export const PWASplashScreen = ({ children }: { children: React.ReactNode }) => {
  const [showSplash, setShowSplash] = useState(false);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);
  const settings = useStore((state) => state.settings);
  const isDataLoaded = useStore((state) => state.menuItems.length > 0 || state.categories.length > 0);

  useEffect(() => {
    // Only show splash screen in PWA mode
    if (isPWA()) {
      const hasShownSplash = sessionStorage.getItem('pwa_splash_shown');
      if (!hasShownSplash) {
        setShowSplash(true);
        sessionStorage.setItem('pwa_splash_shown', 'true');
      }
    }
  }, []);

  useEffect(() => {
    if (showSplash && isDataLoaded) {
      // Add a minimum display time for better UX
      const timer = setTimeout(() => {
        setIsAnimatingOut(true);
        setTimeout(() => setShowSplash(false), 500);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [showSplash, isDataLoaded]);

  if (!showSplash) {
    return <>{children}</>;
  }

  // Determine role from saved start page
  const savedStartPage = localStorage.getItem('pwa_start_page') || '/';
  const roleConfig = ROLE_COLORS[savedStartPage] || { gradient: 'from-primary/20 via-background to-primary/20', accent: 'text-primary' };
  const roleLabel = ROLE_LABELS[savedStartPage] || '';

  return (
    <>
      <div 
        className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-gradient-to-br ${roleConfig.gradient} transition-opacity duration-500 ${isAnimatingOut ? 'opacity-0' : 'opacity-100'}`}
      >
        {/* Logo */}
        <div className={`transform transition-all duration-700 ${isAnimatingOut ? 'scale-110 opacity-0' : 'scale-100 opacity-100'}`}>
          {settings.logo ? (
            <img
              src={settings.logo}
              alt={settings.restaurantName || 'App'}
              className="w-28 h-28 rounded-3xl object-cover shadow-2xl mb-6 animate-[scale-in_0.5s_ease-out]"
            />
          ) : (
            <div className="w-28 h-28 rounded-3xl bg-primary/20 flex items-center justify-center mb-6 animate-[scale-in_0.5s_ease-out]">
              <span className="text-5xl font-bold text-primary">
                {(settings.restaurantName || 'S').charAt(0)}
              </span>
            </div>
          )}
        </div>

        {/* App Name */}
        <h1 className={`text-2xl font-bold text-white mb-1 animate-[fade-in_0.5s_ease-out_0.2s_both] ${isAnimatingOut ? 'opacity-0' : ''}`}>
          {settings.restaurantName || 'Sajilo Orders'}
        </h1>
        
        {settings.restaurantSubName && (
          <p className={`text-slate-400 mb-2 animate-[fade-in_0.5s_ease-out_0.3s_both] ${isAnimatingOut ? 'opacity-0' : ''}`}>
            {settings.restaurantSubName}
          </p>
        )}

        {roleLabel && (
          <p className={`${roleConfig.accent} text-sm font-medium mb-8 animate-[fade-in_0.5s_ease-out_0.4s_both] ${isAnimatingOut ? 'opacity-0' : ''}`}>
            {roleLabel}
          </p>
        )}

        {/* Loading indicator */}
        <div className={`flex flex-col items-center gap-3 animate-[fade-in_0.5s_ease-out_0.5s_both] ${isAnimatingOut ? 'opacity-0' : ''}`}>
          <Loader2 className={`w-6 h-6 ${roleConfig.accent} animate-spin`} />
          <p className="text-slate-500 text-sm">Loading...</p>
        </div>

        {/* Decorative elements */}
        <div className="absolute bottom-8 flex gap-1.5">
          <div className={`w-2 h-2 rounded-full ${roleConfig.accent.replace('text-', 'bg-')} animate-bounce`} style={{ animationDelay: '0ms' }} />
          <div className={`w-2 h-2 rounded-full ${roleConfig.accent.replace('text-', 'bg-')} animate-bounce`} style={{ animationDelay: '150ms' }} />
          <div className={`w-2 h-2 rounded-full ${roleConfig.accent.replace('text-', 'bg-')} animate-bounce`} style={{ animationDelay: '300ms' }} />
        </div>
      </div>
      {/* Render children underneath for preloading */}
      <div className="invisible">{children}</div>
    </>
  );
};
