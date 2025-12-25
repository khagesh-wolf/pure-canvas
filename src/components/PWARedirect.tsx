import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { isPWA } from '@/pages/Install';

/**
 * Handles PWA customer routing:
 * - If PWA and on index page, redirect to scan or existing table session
 * - Staff pages (/admin, /counter, /kitchen, /auth) are excluded
 */
export function usePWARedirect() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Only redirect from the index page
    if (location.pathname !== '/') return;

    // Only apply to PWA mode
    if (!isPWA()) return;

    // Check for existing table session
    const sessionKey = 'chiyadani:customerActiveSession';
    const existingSession = localStorage.getItem(sessionKey);

    if (existingSession) {
      try {
        const session = JSON.parse(existingSession) as {
          table: number;
          tableTimestamp?: number;
          timestamp: number;
        };

        // Check if table session is still valid (4 hours)
        const tableTimestamp = session.tableTimestamp || session.timestamp;
        const tableAge = Date.now() - tableTimestamp;
        const isTableExpired = tableAge > 4 * 60 * 60 * 1000; // 4 hours

        if (!isTableExpired && session.table) {
          // Valid table session - go directly to table order page
          navigate(`/table/${session.table}`, { replace: true });
          return;
        }

        // Session expired - clear and go to scan
        localStorage.removeItem(sessionKey);
      } catch {
        localStorage.removeItem(sessionKey);
      }
    }

    // No valid session - redirect to scan page
    navigate('/scan', { replace: true });
  }, [location.pathname, navigate]);
}
