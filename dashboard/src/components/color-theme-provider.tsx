import { useEffect, useState } from 'react';
import { colorThemes } from '@/pages/_dashboard.settings.theme';
import { useTheme } from './theme-provider';

function clearThemeVars() {
  // Remove all CSS variables from <html> and <body>
  [document.documentElement, document.body].forEach(root => {
    const computedStyle = getComputedStyle(root);
    const cssVars = Array.from(computedStyle).filter(prop => prop.startsWith('--'));
    cssVars.forEach(prop => root.style.removeProperty(prop));
  });
}

function applyThemeVars(vars: Record<string, string | undefined>) {
  const root = document.documentElement;
  Object.entries(vars).forEach(([key, value]) => {
    if (typeof value === 'string') {
      root.style.setProperty(key, value);
    }
  });
}

export function ColorThemeProvider({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  const [colorTheme, setColorTheme] = useState(() => localStorage.getItem('color-theme') || 'default');

  useEffect(() => {
    // Listen for color theme changes in localStorage (e.g., from ThemeSettings)
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'color-theme' && e.newValue) {
        setColorTheme(e.newValue);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    // Apply theme vars when theme mode or color theme changes
    const color = colorThemes.find(c => c.name === colorTheme) || colorThemes[0];
    const mode = theme === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      : theme;
    clearThemeVars();
    // Always apply default theme first
    const defaultTheme = colorThemes.find(c => c.name === 'default') || colorThemes[0];
    applyThemeVars(defaultTheme.css[mode]);
    // Then apply the selected theme (overrides defaults)
    applyThemeVars(color.css[mode]);
  }, [theme, colorTheme]);

  return <>{children}</>;
} 