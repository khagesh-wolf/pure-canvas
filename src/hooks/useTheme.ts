import { useState, useEffect, useLayoutEffect } from 'react';

type Theme = 'light' | 'dark' | 'system';

// Get stored theme or default
const getStoredTheme = (): Theme => {
  if (typeof window !== 'undefined') {
    return (localStorage.getItem('app-theme') as Theme) || 'light';
  }
  return 'light';
};

// Apply theme immediately to prevent flash
const applyThemeToDocument = (theme: Theme) => {
  const root = window.document.documentElement;
  const effectiveTheme = theme === 'system' 
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : theme;
  
  root.classList.remove('light', 'dark');
  root.classList.add(effectiveTheme);
};

// Apply theme on script load (before React hydration)
if (typeof window !== 'undefined') {
  applyThemeToDocument(getStoredTheme());
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getStoredTheme);

  // Use layout effect to apply theme before paint
  useLayoutEffect(() => {
    applyThemeToDocument(theme);
    localStorage.setItem('app-theme', theme);
  }, [theme]);

  // Listen for system theme changes when in system mode
  useEffect(() => {
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => applyThemeToDocument('system');
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    }
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  return { theme, setTheme };
}
