import { useState, useEffect } from 'react';
import { Loader2, Settings, ShoppingCart, ChefHat, ClipboardList } from 'lucide-react';
import { useStore } from '@/store/useStore';

function isPWA(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  );
}

interface RoleConfig {
  gradient: string;
  accent: string;
  bgAccent: string;
  icon: React.ReactNode;
  pattern: string;
}

const ROLE_COLORS: Record<string, RoleConfig> = {
  '/admin': { 
    gradient: 'from-indigo-950 via-indigo-900 to-slate-900', 
    accent: 'text-indigo-400',
    bgAccent: 'bg-indigo-500/20',
    icon: <Settings className="w-8 h-8" />,
    pattern: 'radial-gradient(circle at 20% 80%, rgba(99, 102, 241, 0.15) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(139, 92, 246, 0.1) 0%, transparent 50%)'
  },
  '/counter': { 
    gradient: 'from-emerald-950 via-emerald-900 to-slate-900', 
    accent: 'text-emerald-400',
    bgAccent: 'bg-emerald-500/20',
    icon: <ShoppingCart className="w-8 h-8" />,
    pattern: 'radial-gradient(circle at 30% 70%, rgba(16, 185, 129, 0.15) 0%, transparent 50%), radial-gradient(circle at 70% 30%, rgba(52, 211, 153, 0.1) 0%, transparent 50%)'
  },
  '/kitchen': { 
    gradient: 'from-orange-950 via-orange-900 to-slate-900', 
    accent: 'text-orange-400',
    bgAccent: 'bg-orange-500/20',
    icon: <ChefHat className="w-8 h-8" />,
    pattern: 'radial-gradient(circle at 25% 75%, rgba(249, 115, 22, 0.15) 0%, transparent 50%), radial-gradient(circle at 75% 25%, rgba(251, 146, 60, 0.1) 0%, transparent 50%)'
  },
  '/waiter': { 
    gradient: 'from-violet-950 via-violet-900 to-slate-900', 
    accent: 'text-violet-400',
    bgAccent: 'bg-violet-500/20',
    icon: <ClipboardList className="w-8 h-8" />,
    pattern: 'radial-gradient(circle at 20% 80%, rgba(139, 92, 246, 0.15) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(167, 139, 250, 0.1) 0%, transparent 50%)'
  },
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
  const defaultConfig: RoleConfig = { 
    gradient: 'from-primary/20 via-background to-primary/20', 
    accent: 'text-primary',
    bgAccent: 'bg-primary/20',
    icon: null,
    pattern: ''
  };
  const roleConfig = ROLE_COLORS[savedStartPage] || defaultConfig;
  const roleLabel = ROLE_LABELS[savedStartPage] || '';

  return (
    <>
      <div 
        className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-gradient-to-br ${roleConfig.gradient} transition-opacity duration-500 ${isAnimatingOut ? 'opacity-0' : 'opacity-100'}`}
        style={{ backgroundImage: roleConfig.pattern }}
      >
        {/* Animated background circles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className={`absolute -top-1/4 -left-1/4 w-1/2 h-1/2 rounded-full ${roleConfig.bgAccent} blur-3xl animate-pulse`} />
          <div className={`absolute -bottom-1/4 -right-1/4 w-1/2 h-1/2 rounded-full ${roleConfig.bgAccent} blur-3xl animate-pulse`} style={{ animationDelay: '1s' }} />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center">
          {/* Logo with role badge */}
          <div className={`relative transform transition-all duration-700 ${isAnimatingOut ? 'scale-110 opacity-0' : 'scale-100 opacity-100'}`}>
            {settings.logo ? (
              <img
                src={settings.logo}
                alt={settings.restaurantName || 'App'}
                className="w-28 h-28 rounded-3xl object-cover shadow-2xl mb-6 animate-[scale-in_0.5s_ease-out]"
              />
            ) : (
              <div className={`w-28 h-28 rounded-3xl ${roleConfig.bgAccent} flex items-center justify-center mb-6 animate-[scale-in_0.5s_ease-out] backdrop-blur-sm border border-white/10`}>
                <span className={`text-5xl font-bold ${roleConfig.accent}`}>
                  {(settings.restaurantName || 'S').charAt(0)}
                </span>
              </div>
            )}
            
            {/* Role badge on logo */}
            {roleConfig.icon && (
              <div className={`absolute -bottom-2 -right-2 w-12 h-12 rounded-xl ${roleConfig.bgAccent} backdrop-blur-sm border border-white/20 flex items-center justify-center ${roleConfig.accent} shadow-lg animate-[scale-in_0.5s_ease-out_0.3s_both]`}>
                {roleConfig.icon}
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
            <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full ${roleConfig.bgAccent} backdrop-blur-sm border border-white/10 mb-8 animate-[fade-in_0.5s_ease-out_0.4s_both] ${isAnimatingOut ? 'opacity-0' : ''}`}>
              <span className={`${roleConfig.accent} text-sm font-medium`}>
                {roleLabel}
              </span>
            </div>
          )}

          {/* Loading indicator */}
          <div className={`flex flex-col items-center gap-3 animate-[fade-in_0.5s_ease-out_0.5s_both] ${isAnimatingOut ? 'opacity-0' : ''}`}>
            <Loader2 className={`w-6 h-6 ${roleConfig.accent} animate-spin`} />
            <p className="text-slate-500 text-sm">Loading...</p>
          </div>
        </div>

        {/* Decorative dots */}
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
