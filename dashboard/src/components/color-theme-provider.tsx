import { useEffect } from 'react';
import { colorThemes } from '@/pages/_dashboard.settings.theme';
import { useTheme } from './theme-provider';

function clearThemeVars() {
  const root = document.documentElement;
  const computedStyle = getComputedStyle(root);
  const cssVars = Array.from(computedStyle).filter(prop => prop.startsWith('--'));
  cssVars.forEach(prop => root.style.removeProperty(prop));
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

  useEffect(() => {
    // Load and apply saved color theme on mount
    const savedColor = localStorage.getItem('color-theme') || 'default';
    const color = colorThemes.find(c => c.name === savedColor) || colorThemes[0];
    const mode = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    clearThemeVars();
    applyThemeVars(color.css[mode]);
  }, []);

  useEffect(() => {
    // Apply theme vars when theme mode changes
    const savedColor = localStorage.getItem('color-theme') || 'default';
    const color = colorThemes.find(c => c.name === savedColor) || colorThemes[0];
    const mode = theme === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      : theme;
    clearThemeVars();
    applyThemeVars(color.css[mode]);
  }, [theme]);

  return <>{children}</>;
} 