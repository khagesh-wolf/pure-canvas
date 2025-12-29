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
 */
export const usePWARedirect = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  useEffect(() => {
    // Only redirect if we're in PWA mode and on the root path
    if (isPWA() && location.pathname === '/') {
      const savedStartPage = localStorage.getItem(PWA_START_PAGE_KEY);
      if (savedStartPage && savedStartPage !== '/') {
        navigate(savedStartPage, { replace: true });
      }
    }
  }, [navigate, location.pathname]);
};
