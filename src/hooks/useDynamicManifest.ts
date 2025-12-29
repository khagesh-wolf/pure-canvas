import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useSettings } from '@/hooks/useSettings';

interface ManifestConfig {
  name: string;
  short_name: string;
  description: string;
  start_url: string;
  theme_color: string;
  background_color: string;
}

// Config for install pages AND actual role pages
const ROLE_CONFIGS: Record<string, Omit<ManifestConfig, 'name' | 'short_name'> & { badgeColor: string; badgeText: string }> = {
  '/install/admin': {
    description: 'Admin dashboard for menu management and reports',
    start_url: '/admin',
    theme_color: '#6366f1',
    background_color: '#1e1b4b',
    badgeColor: '#6366f1',
    badgeText: 'A',
  },
  '/admin': {
    description: 'Admin dashboard for menu management and reports',
    start_url: '/admin',
    theme_color: '#6366f1',
    background_color: '#1e1b4b',
    badgeColor: '#6366f1',
    badgeText: 'A',
  },
  '/install/counter': {
    description: 'Point-of-sale counter terminal',
    start_url: '/counter',
    theme_color: '#10b981',
    background_color: '#0f172a',
    badgeColor: '#10b981',
    badgeText: 'C',
  },
  '/counter': {
    description: 'Point-of-sale counter terminal',
    start_url: '/counter',
    theme_color: '#10b981',
    background_color: '#0f172a',
    badgeColor: '#10b981',
    badgeText: 'C',
  },
  '/install/kitchen': {
    description: 'Kitchen display for order management',
    start_url: '/kitchen',
    theme_color: '#f97316',
    background_color: '#431407',
    badgeColor: '#f97316',
    badgeText: 'K',
  },
  '/kitchen': {
    description: 'Kitchen display for order management',
    start_url: '/kitchen',
    theme_color: '#f97316',
    background_color: '#431407',
    badgeColor: '#f97316',
    badgeText: 'K',
  },
  '/install/waiter': {
    description: 'Mobile waiter app for table orders',
    start_url: '/waiter',
    theme_color: '#8b5cf6',
    background_color: '#2e1065',
    badgeColor: '#8b5cf6',
    badgeText: 'W',
  },
  '/waiter': {
    description: 'Mobile waiter app for table orders',
    start_url: '/waiter',
    theme_color: '#8b5cf6',
    background_color: '#2e1065',
    badgeColor: '#8b5cf6',
    badgeText: 'W',
  },
};

const ROLE_LABELS: Record<string, string> = {
  '/install/admin': 'Admin',
  '/admin': 'Admin',
  '/install/counter': 'Counter',
  '/counter': 'Counter',
  '/install/kitchen': 'Kitchen',
  '/kitchen': 'Kitchen',
  '/install/waiter': 'Waiter',
  '/waiter': 'Waiter',
};

/**
 * Generate an icon with a role badge overlay
 */
const generateBadgedIcon = (
  logoUrl: string | undefined,
  size: number,
  badgeColor: string,
  badgeText: string,
  restaurantName: string
): Promise<string> => {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    const drawBadge = () => {
      // Draw badge circle in bottom-right
      const badgeSize = size * 0.35;
      const badgeX = size - badgeSize - size * 0.02;
      const badgeY = size - badgeSize - size * 0.02;

      // Badge shadow
      ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
      ctx.shadowBlur = size * 0.05;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = size * 0.02;

      // Badge circle
      ctx.beginPath();
      ctx.arc(badgeX + badgeSize / 2, badgeY + badgeSize / 2, badgeSize / 2, 0, Math.PI * 2);
      ctx.fillStyle = badgeColor;
      ctx.fill();

      // Badge border
      ctx.shadowColor = 'transparent';
      ctx.strokeStyle = 'white';
      ctx.lineWidth = size * 0.02;
      ctx.stroke();

      // Badge text
      ctx.fillStyle = 'white';
      ctx.font = `bold ${badgeSize * 0.6}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(badgeText, badgeX + badgeSize / 2, badgeY + badgeSize / 2);

      resolve(canvas.toDataURL('image/png'));
    };

    if (logoUrl) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        // Draw rounded logo
        const radius = size * 0.2;
        ctx.beginPath();
        ctx.moveTo(radius, 0);
        ctx.lineTo(size - radius, 0);
        ctx.quadraticCurveTo(size, 0, size, radius);
        ctx.lineTo(size, size - radius);
        ctx.quadraticCurveTo(size, size, size - radius, size);
        ctx.lineTo(radius, size);
        ctx.quadraticCurveTo(0, size, 0, size - radius);
        ctx.lineTo(0, radius);
        ctx.quadraticCurveTo(0, 0, radius, 0);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(img, 0, 0, size, size);
        drawBadge();
      };
      img.onerror = () => {
        // Fallback to text-based icon
        drawFallbackIcon();
        drawBadge();
      };
      img.src = logoUrl;
    } else {
      drawFallbackIcon();
      drawBadge();
    }

    function drawFallbackIcon() {
      // Draw rounded background
      const radius = size * 0.2;
      ctx.beginPath();
      ctx.moveTo(radius, 0);
      ctx.lineTo(size - radius, 0);
      ctx.quadraticCurveTo(size, 0, size, radius);
      ctx.lineTo(size, size - radius);
      ctx.quadraticCurveTo(size, size, size - radius, size);
      ctx.lineTo(radius, size);
      ctx.quadraticCurveTo(0, size, 0, size - radius);
      ctx.lineTo(0, radius);
      ctx.quadraticCurveTo(0, 0, radius, 0);
      ctx.closePath();

      // Gradient background
      const gradient = ctx.createLinearGradient(0, 0, size, size);
      gradient.addColorStop(0, badgeColor);
      gradient.addColorStop(1, adjustColor(badgeColor, -30));
      ctx.fillStyle = gradient;
      ctx.fill();

      // Initial letter
      ctx.fillStyle = 'white';
      ctx.font = `bold ${size * 0.45}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(restaurantName.charAt(0).toUpperCase(), size / 2, size / 2);
    }
  });
};

// Helper to darken/lighten a hex color
function adjustColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amount));
  const b = Math.min(255, Math.max(0, (num & 0x0000FF) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/**
 * Hook to dynamically generate and inject a manifest for the current install page
 */
export const useDynamicManifest = () => {
  const location = useLocation();
  const { settings } = useSettings();
  const [iconUrls, setIconUrls] = useState<{ icon192: string; icon512: string } | null>(null);

  // Generate badged icons
  useEffect(() => {
    const roleConfig = ROLE_CONFIGS[location.pathname];
    if (!roleConfig) return;

    const restaurantName = settings.restaurantName || 'Sajilo Orders';

    Promise.all([
      generateBadgedIcon(settings.logo, 192, roleConfig.badgeColor, roleConfig.badgeText, restaurantName),
      generateBadgedIcon(settings.logo, 512, roleConfig.badgeColor, roleConfig.badgeText, restaurantName),
    ]).then(([icon192, icon512]) => {
      setIconUrls({ icon192, icon512 });
    });
  }, [location.pathname, settings.logo, settings.restaurantName]);

  // Update manifest when icons are ready
  useEffect(() => {
    const roleConfig = ROLE_CONFIGS[location.pathname];
    if (!roleConfig || !iconUrls) return;

    const roleLabel = ROLE_LABELS[location.pathname];
    const restaurantName = settings.restaurantName || 'Sajilo Orders';
    const subName = settings.restaurantSubName;

    const appName = subName
      ? `${restaurantName} - ${subName} ${roleLabel}`
      : `${restaurantName} ${roleLabel}`;

    const shortName = `${restaurantName.slice(0, 8)} ${roleLabel}`;

    const manifest = {
      name: appName,
      short_name: shortName,
      description: roleConfig.description,
      theme_color: roleConfig.theme_color,
      background_color: roleConfig.background_color,
      display: 'standalone',
      orientation: 'portrait',
      start_url: roleConfig.start_url,
      scope: '/',
      icons: [
        {
          src: iconUrls.icon192,
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any maskable'
        },
        {
          src: iconUrls.icon512,
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any maskable'
        }
      ]
    };

    const manifestBlob = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
    const manifestUrl = URL.createObjectURL(manifestBlob);

    let manifestLink = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (!manifestLink) {
      manifestLink = document.createElement('link');
      manifestLink.rel = 'manifest';
      document.head.appendChild(manifestLink);
    }
    manifestLink.href = manifestUrl;

    // Update theme-color
    let themeColorMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!themeColorMeta) {
      themeColorMeta = document.createElement('meta');
      themeColorMeta.name = 'theme-color';
      document.head.appendChild(themeColorMeta);
    }
    themeColorMeta.content = roleConfig.theme_color;

    // Update apple-touch-icon with badged version
    let appleTouchIcon = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
    if (!appleTouchIcon) {
      appleTouchIcon = document.createElement('link');
      appleTouchIcon.rel = 'apple-touch-icon';
      document.head.appendChild(appleTouchIcon);
    }
    appleTouchIcon.href = iconUrls.icon192;

    return () => {
      URL.revokeObjectURL(manifestUrl);
    };
  }, [location.pathname, settings.restaurantName, settings.restaurantSubName, iconUrls]);
};
