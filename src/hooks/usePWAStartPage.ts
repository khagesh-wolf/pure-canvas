import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const PWA_START_PAGE_KEY = 'pwa_start_page';

// Check if running as installed PWA
function isPWA(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  );
}

// Map install paths to their target pages
const INSTALL_PATH_MAP: Record<string, string> = {
  '/install/admin': '/admin',
  '/install/counter': '/counter',
  '/install/kitchen': '/kitchen',
  '/install/waiter': '/waiter',
};

/**
 * Hook to save the intended start page when installing from an install page
 */
export const useSavePWAStartPage = () => {
  const location = useLocation();
  
  useEffect(() => {
    // Save the target page based on current install path
    const targetPage = INSTALL_PATH_MAP[location.pathname];
    if (targetPage) {
      localStorage.setItem(PWA_START_PAGE_KEY, targetPage);
    }
  }, [location.pathname]);
};

/**
 * Hook to redirect to the saved start page when opening the PWA
 * This must be used at the root level, before any nested routes
 */
export const usePWARedirect = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  useEffect(() => {
    // Only redirect if we're in PWA mode
    if (!isPWA()) return;
    
    const savedStartPage = localStorage.getItem(PWA_START_PAGE_KEY);
    
    // Redirect from root or install pages to the saved start page
    const isRootOrInstall = location.pathname === '/' || location.pathname.startsWith('/install');
    
    if (savedStartPage && isRootOrInstall && savedStartPage !== location.pathname) {
      navigate(savedStartPage, { replace: true });
    }
  }, [navigate, location.pathname]);
};

/**
 * Get the saved PWA start page (for use outside of React components)
 */
export const getSavedPWAStartPage = (): string | null => {
  if (!isPWA()) return null;
  return localStorage.getItem(PWA_START_PAGE_KEY);
};
