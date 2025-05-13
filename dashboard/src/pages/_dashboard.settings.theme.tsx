import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useTheme } from '@/components/theme-provider';
import { useEffect, useState } from 'react';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export function applyThemeVars(vars: Record<string, string | undefined>) {
  const root = document.documentElement;
  Object.entries(vars).forEach(([key, value]) => {
    if (typeof value === 'string') {
      root.style.setProperty(key, value);
    }
  });
}

export const colorThemes = [
  {
    name: 'default',
    label: 'Default',
    dot: '#2563eb',
    css: {
      light: {
        '--background': '240 5% 96%',
        '--foreground': '240 5% 10%',
        '--muted': '240 5% 90%',
        '--muted-foreground': '240 5% 40%',
        '--card': '240 5% 98%',
        '--card-foreground': 'var(--foreground)',
        '--popover': 'var(--background)',
        '--popover-foreground': 'var(--foreground)',
        '--border': '240 5% 80%',
        '--input': '240 6% 91%',
        '--input-placeholder': '240 5% 70%',
        '--primary': '216 46% 40%',
        '--primary-foreground': '240 5% 98%',
        '--secondary': '240 5% 90%',
        '--secondary-foreground': '240 5% 20%',
        '--accent': '240 5% 90%',
        '--accent-foreground': '240 5% 20%',
        '--destructive': '0 72% 51%',
        '--destructive-foreground': '0 0% 98%',
        '--ring': '216 46% 40%',
        '--radius': '0.5rem',
        '--hover-primary': '216 46% 30%',
        '--hover-secondary': '240 5% 85%',
        '--hover-destructive': '0 84% 60%',
        '--success': '142 76% 36%',
        '--hover-success': '142 72% 29%',
        '--border-destructive-50': '0 72% 51%',
        '--bg-destructive-10': '0 72% 51%',
        '--hover-destructive-20': '0 72% 51%',
        '--bg-muted-50': '210 40% 96%',
        '--bg-accent-50': '210 40% 96%',
        '--bg-muted-40': '210 40% 96%',
        '--border-muted-40': '210 40% 96%',
        '--sidebar-background': '240 5% 90%',
        '--sidebar-foreground': '240 5% 20%',
        '--sidebar-primary': '216 46% 40%',
        '--sidebar-primary-foreground': '240 5% 98%',
        '--sidebar-accent': '240 5% 85%',
        '--sidebar-accent-foreground': '240 5% 10%',
        '--sidebar-border': '240 5% 80%',
        '--sidebar-ring': '216 46% 40%',
        '--sidebar-foreground-70': '240 5% 30%',
        '--neon-green': '81 96% 55%',
        '--background-custom': '240 5% 96%',
        '--chart-1': '221.2 83.2% 53.3%',
        '--chart-2': '212 95% 68%',
        '--chart-3': '216 92% 60%',
        '--chart-4': '210 98% 78%',
        '--chart-5': '212 97% 87%',
      },
      dark: {
        '--background': '240 2% 11%',
        '--foreground': '0 0% 98%',
        '--muted': '0 0% 14.9%',
        '--muted-foreground': '0 0% 63.9%',
        '--card': '240 2% 11.5%',
        '--card-foreground': 'var(--foreground)',
        '--popover': 'var(--background)',
        '--popover-foreground': 'var(--foreground)',
        '--border': '0 0% 18%',
        '--input': '240 2% 16.5%',
        '--input-placeholder': '0 0 30%',
        '--primary': '216 46% 53%',
        '--primary-foreground': '0 0% 5%',
        '--secondary': '216 46% 53%',
        '--secondary-foreground': '0 0% 5%',
        '--accent': '240 4% 16%',
        '--accent-foreground': '0 0% 98%',
        '--destructive': '0 72% 51%',
        '--destructive-foreground': '210 40% 98%',
        '--ring': '215 16% 47%',
        '--radius': '0.5rem',
        '--hover-primary': '216 41% 49%',
        '--hover-secondary': '216 41% 49%',
        '--hover-destructive': '0 84% 60%',
        '--success': '142 76% 36%',
        '--hover-success': '142 72% 29%',
        '--border-destructive-50': '0 72% 51%',
        '--bg-destructive-10': '0 72% 51%',
        '--hover-destructive-20': '0 72% 51%',
        '--bg-muted-50': '210 40% 96%',
        '--bg-accent-50': '210 40% 96%',
        '--bg-muted-40': '210 40% 96%',
        '--border-muted-40': '210 40% 96%',
        '--sidebar-background': '240 2% 11%',
        '--sidebar-foreground': '0 0 71%',
        '--sidebar-primary': '0 100% 81%',
        '--sidebar-primary-foreground': '0 0% 98%',
        '--sidebar-accent': 'var(--accent)',
        '--sidebar-accent-foreground': 'var(--accent-foreground)',
        '--sidebar-border': '0 0% 20% / 0.8',
        '--sidebar-ring': '0 0% 64%',
        '--sidebar-foreground-70': '0 0% 98%',
        '--neon-green': '81 96% 55%',
        '--background-custom': '240 4% 8%',
        '--chart-1': '221.2 83.2% 53.3%',
        '--chart-2': '212 95% 68%',
        '--chart-3': '216 92% 60%',
        '--chart-4': '210 98% 78%',
        '--chart-5': '212 97% 87%',
      },
    },
  },
  {
    name: 'red',
    label: 'Red',
    dot: '#ef4444',
    css: {
      light: {
        '--background': '240 5% 96%',
        '--foreground': '240 5% 10%',
        '--card-foreground': 'var(--foreground)',
        '--popover': 'var(--background)',
        '--popover-foreground': 'var(--foreground)',
        '--primary': '0 72.2% 50.6%',
        '--primary-foreground': '0 85.7% 97.3%',
        '--secondary': '0 0% 96.1%',
        '--secondary-foreground': '0 0% 9%',
        '--muted': '240 5% 90%',
        '--muted-foreground': '240 5% 40%',
        '--accent': '240 5% 90%',
        '--accent-foreground': '0 0% 9%',
        '--destructive': '0 84.2% 60.2%',
        '--destructive-foreground': '0 0% 98%',
        '--border': '240 5% 80%',
        '--input': '240 6% 91%',
        '--input-placeholder': '240 5% 70%',
        '--ring': '0 72.2% 50.6%',
        '--radius': '0.5rem',
        '--hover-primary': '0 72.2% 40%',
        '--hover-secondary': '0 0% 90%',
        '--hover-destructive': '0 84.2% 70%',
        '--success': '142 76% 36%',
        '--hover-success': '142 72% 29%',
        '--border-destructive-50': '0 72% 51%',
        '--bg-destructive-10': '0 72% 51%',
        '--hover-destructive-20': '0 72% 51%',
        '--bg-muted-50': '210 40% 96%',
        '--bg-accent-50': '210 40% 96%',
        '--bg-muted-40': '210 40% 96%',
        '--border-muted-40': '210 40% 96%',
        '--sidebar-background': '240 5% 90%',
        '--sidebar-foreground': '240 5% 20%',
        '--sidebar-primary': '0 72.2% 50.6%',
        '--sidebar-primary-foreground': '240 5% 98%',
        '--sidebar-accent': '240 5% 85%',
        '--sidebar-accent-foreground': '240 5% 10%',
        '--sidebar-border': '240 5% 80%',
        '--sidebar-ring': '0 72.2% 50.6%',
        '--sidebar-foreground-70': '240 5% 30%',
        '--neon-green': '81 96% 55%',
        '--background-custom': '240 5% 96%',
        '--chart-1': '221.2 83.2% 53.3%',
        '--chart-2': '212 95% 68%',
        '--chart-3': '216 92% 60%',
        '--chart-4': '210 98% 78%',
        '--chart-5': '212 97% 87%',
      },
      dark: {
        '--background': '240 2% 11%',
        '--foreground': '0 0% 98%',
        '--card': '240 2% 11.5%',
        '--card-foreground': '0 0% 98%',
        '--popover': '240 2% 11.5%',
        '--popover-foreground': '0 0% 98%',
        '--primary': '0 72.2% 50.6%',
        '--primary-foreground': '0 85.7% 97.3%',
        '--secondary': '0 0% 14.9%',
        '--secondary-foreground': '0 0% 98%',
        '--muted': '0 0% 14.9%',
        '--muted-foreground': '0 0% 63.9%',
        '--accent': '0 0% 14.9%',
        '--accent-foreground': '0 0% 98%',
        '--destructive': '0 62.8% 30.6%',
        '--destructive-foreground': '0 0% 98%',
        '--border': '0 0% 18%',
        '--input': '240 2% 16.5%',
        '--ring': '215 16% 47%',
        '--radius': '0.5rem',
        '--background-custom': '240 4% 8%',
        '--sidebar-background': '240 2% 11%',
        '--sidebar-foreground': '0 0 71%',
        '--sidebar-primary': '0 100% 81%',
        '--sidebar-primary-foreground': '0 0% 98%',
        '--sidebar-accent': 'var(--accent)',
        '--sidebar-accent-foreground': 'var(--accent-foreground)',
        '--sidebar-border': '0 0% 20% / 0.8',
        '--sidebar-ring': '0 0% 64%',
        '--sidebar-foreground-70': '0 0% 98%',
        '--chart-1': '221.2 83.2% 53.3%',
        '--chart-2': '212 95% 68%',
        '--chart-3': '216 92% 60%',
        '--chart-4': '210 98% 78%',
        '--chart-5': '212 97% 87%',
      },
    },
  },
  {
    name: 'rose',
    label: 'Rose',
    dot: '#e11d48',
    css: {
      light: {
        '--background': '240 5% 96%',
        '--foreground': '240 5% 10%',
        '--card': '240 5% 98%',
        '--card-foreground': 'var(--foreground)',
        '--popover': 'var(--background)',
        '--popover-foreground': 'var(--foreground)',
        '--border': '240 5% 80%',
        '--primary': '346.8 77.2% 49.8%',
        '--primary-foreground': '355.7 100% 97.3%',
        '--secondary': '240 4.8% 95.9%',
        '--secondary-foreground': '240 5.9% 10%',
        '--muted': '240 5% 90%',
        '--muted-foreground': '240 5% 40%',
        '--accent': '240 5% 90%',
        '--accent-foreground': '240 5.9% 10%',
        '--destructive': '0 84.2% 60.2%',
        '--destructive-foreground': '0 0% 98%',
        '--input': '240 6% 91%',
        '--input-placeholder': '240 5% 70%',
        '--ring': '346.8 77.2% 49.8%',
        '--radius': '0.5rem',
        '--hover-primary': '346.8 77.2% 40%',
        '--hover-secondary': '240 4.8% 90%',
        '--hover-destructive': '0 84.2% 70%',
        '--success': '142 76% 36%',
        '--hover-success': '142 72% 29%',
        '--border-destructive-50': '0 72% 51%',
        '--bg-destructive-10': '0 72% 51%',
        '--hover-destructive-20': '0 72% 51%',
        '--bg-muted-50': '210 40% 96%',
        '--bg-accent-50': '210 40% 96%',
        '--bg-muted-40': '210 40% 96%',
        '--border-muted-40': '210 40% 96%',
        '--sidebar-background': '240 5% 90%',
        '--sidebar-foreground': '240 5% 20%',
        '--sidebar-primary': '346.8 77.2% 49.8%',
        '--sidebar-primary-foreground': '240 5% 98%',
        '--sidebar-accent': '240 5% 85%',
        '--sidebar-accent-foreground': '240 5% 10%',
        '--sidebar-border': '240 5% 80%',
        '--sidebar-ring': '346.8 77.2% 49.8%',
        '--sidebar-foreground-70': '240 5% 30%',
        '--neon-green': '81 96% 55%',
        '--background-custom': '240 5% 96%',
        '--chart-1': '221.2 83.2% 53.3%',
        '--chart-2': '212 95% 68%',
        '--chart-3': '216 92% 60%',
        '--chart-4': '210 98% 78%',
        '--chart-5': '212 97% 87%',
      },
      dark: {
        '--background': '240 2% 11%',
        '--foreground': '0 0% 95%',
        '--card': '240 2% 11.5%',
        '--card-foreground': '0 0% 95%',
        '--popover': '240 2% 11.5%',
        '--popover-foreground': '0 0% 95%',
        '--primary': '346.8 77.2% 49.8%',
        '--primary-foreground': '355.7 100% 97.3%',
        '--secondary': '240 3.7% 15.9%',
        '--secondary-foreground': '0 0% 98%',
        '--muted': '0 0% 15%',
        '--muted-foreground': '240 5% 64.9%',
        '--accent': '12 6.5% 15.1%',
        '--accent-foreground': '0 0% 98%',
        '--destructive': '0 62.8% 30.6%',
        '--destructive-foreground': '0 85.7% 97.3%',
        '--border': '0 0% 18%',
        '--input': '240 2% 16.5%',
        '--ring': '215 16% 47%',
        '--radius': '0.5rem',
        '--background-custom': '240 4% 8%',
        '--sidebar-background': '240 2% 11%',
        '--sidebar-foreground': '0 0 71%',
        '--sidebar-primary': '0 100% 81%',
        '--sidebar-primary-foreground': '0 0% 98%',
        '--sidebar-accent': 'var(--accent)',
        '--sidebar-accent-foreground': 'var(--accent-foreground)',
        '--sidebar-border': '0 0% 20% / 0.8',
        '--sidebar-ring': '0 0% 64%',
        '--sidebar-foreground-70': '0 0% 98%',
        '--chart-1': '221.2 83.2% 53.3%',
        '--chart-2': '212 95% 68%',
        '--chart-3': '216 92% 60%',
        '--chart-4': '210 98% 78%',
        '--chart-5': '212 97% 87%',
      },
    },
  },
  {
    name: 'orange',
    label: 'Orange',
    dot: '#f97316',
    css: {
      light: {
        '--background': '240 5% 96%',
        '--foreground': '240 5% 10%',
        '--card': '240 5% 98%',
        '--card-foreground': 'var(--foreground)',
        '--popover': 'var(--background)',
        '--popover-foreground': 'var(--foreground)',
        '--border': '240 5% 80%',
        '--primary': '24.6 95% 53.1%',
        '--primary-foreground': '60 9.1% 97.8%',
        '--secondary': '60 4.8% 95.9%',
        '--secondary-foreground': '24 9.8% 10%',
        '--muted': '240 5% 90%',
        '--muted-foreground': '240 5% 40%',
        '--accent': '240 5% 90%',
        '--accent-foreground': '24 9.8% 10%',
        '--destructive': '0 84.2% 60.2%',
        '--destructive-foreground': '60 9.1% 97.8%',
        '--input': '240 6% 91%',
        '--input-placeholder': '240 5% 70%',
        '--ring': '24.6 95% 53.1%',
        '--radius': '0.5rem',
        '--hover-primary': '24.6 95% 40%',
        '--hover-secondary': '60 4.8% 90%',
        '--hover-destructive': '0 84.2% 70%',
        '--success': '142 76% 36%',
        '--hover-success': '142 72% 29%',
        '--border-destructive-50': '0 72% 51%',
        '--bg-destructive-10': '0 72% 51%',
        '--hover-destructive-20': '0 72% 51%',
        '--bg-muted-50': '210 40% 96%',
        '--bg-accent-50': '210 40% 96%',
        '--bg-muted-40': '210 40% 96%',
        '--border-muted-40': '210 40% 96%',
        '--sidebar-background': '240 5% 90%',
        '--sidebar-foreground': '240 5% 20%',
        '--sidebar-primary': '24.6 95% 53.1%',
        '--sidebar-primary-foreground': '240 5% 98%',
        '--sidebar-accent': '240 5% 85%',
        '--sidebar-accent-foreground': '240 5% 10%',
        '--sidebar-border': '240 5% 80%',
        '--sidebar-ring': '24.6 95% 53.1%',
        '--sidebar-foreground-70': '240 5% 30%',
        '--neon-green': '81 96% 55%',
        '--background-custom': '240 5% 96%',
        '--chart-1': '221.2 83.2% 53.3%',
        '--chart-2': '212 95% 68%',
        '--chart-3': '216 92% 60%',
        '--chart-4': '210 98% 78%',
        '--chart-5': '212 97% 87%',
      },
      dark: {
        '--background': '240 2% 11%',
        '--foreground': '60 9.1% 97.8%',
        '--card': '240 2% 11.5%',
        '--card-foreground': '60 9.1% 97.8%',
        '--popover': '240 2% 11.5%',
        '--popover-foreground': '60 9.1% 97.8%',
        '--primary': '20.5 90.2% 48.2%',
        '--primary-foreground': '60 9.1% 97.8%',
        '--secondary': '12 6.5% 15.1%',
        '--secondary-foreground': '60 9.1% 97.8%',
        '--muted': '12 6.5% 15.1%',
        '--muted-foreground': '24 5.4% 63.9%',
        '--accent': '12 6.5% 15.1%',
        '--accent-foreground': '60 9.1% 97.8%',
        '--destructive': '0 72.2% 50.6%',
        '--destructive-foreground': '60 9.1% 97.8%',
        '--border': '0 0% 18%',
        '--input': '240 2% 16.5%',
        '--ring': '215 16% 47%',
        '--radius': '0.5rem',
        '--background-custom': '240 4% 8%',
        '--sidebar-background': '240 2% 11%',
        '--sidebar-foreground': '0 0 71%',
        '--sidebar-primary': '0 100% 81%',
        '--sidebar-primary-foreground': '0 0% 98%',
        '--sidebar-accent': 'var(--accent)',
        '--sidebar-accent-foreground': 'var(--accent-foreground)',
        '--sidebar-border': '0 0% 20% / 0.8',
        '--sidebar-ring': '0 0% 64%',
        '--sidebar-foreground-70': '0 0% 98%',
        '--chart-1': '221.2 83.2% 53.3%',
        '--chart-2': '212 95% 68%',
        '--chart-3': '216 92% 60%',
        '--chart-4': '210 98% 78%',
        '--chart-5': '212 97% 87%',
      },
    },
  },
  {
    name: 'green',
    label: 'Green',
    dot: '#22c55e',
    css: {
      light: {
        '--background': '240 5% 96%',
        '--foreground': '240 5% 10%',
        '--card': '240 5% 98%',
        '--card-foreground': 'var(--foreground)',
        '--popover': 'var(--background)',
        '--popover-foreground': 'var(--foreground)',
        '--border': '240 5% 80%',
        '--primary': '142.1 76.2% 36.3%',
        '--primary-foreground': '355.7 100% 97.3%',
        '--secondary': '240 4.8% 95.9%',
        '--secondary-foreground': '240 5.9% 10%',
        '--muted': '240 5% 90%',
        '--muted-foreground': '240 5% 40%',
        '--accent': '240 5% 90%',
        '--accent-foreground': '240 5.9% 10%',
        '--destructive': '0 84.2% 60.2%',
        '--destructive-foreground': '0 0% 98%',
        '--input': '240 6% 91%',
        '--input-placeholder': '240 5% 70%',
        '--ring': '142.1 76.2% 36.3%',
        '--radius': '0.5rem',
        '--hover-primary': '142.1 76.2% 30%',
        '--hover-secondary': '240 4.8% 90%',
        '--hover-destructive': '0 84.2% 70%',
        '--success': '142 76% 36%',
        '--hover-success': '142 72% 29%',
        '--border-destructive-50': '0 72% 51%',
        '--bg-destructive-10': '0 72% 51%',
        '--hover-destructive-20': '0 72% 51%',
        '--bg-muted-50': '210 40% 96%',
        '--bg-accent-50': '210 40% 96%',
        '--bg-muted-40': '210 40% 96%',
        '--border-muted-40': '210 40% 96%',
        '--sidebar-background': '240 5% 90%',
        '--sidebar-foreground': '240 5% 20%',
        '--sidebar-primary': '142.1 76.2% 36.3%',
        '--sidebar-primary-foreground': '240 5% 98%',
        '--sidebar-accent': '240 5% 85%',
        '--sidebar-accent-foreground': '240 5% 10%',
        '--sidebar-border': '240 5% 80%',
        '--sidebar-ring': '142.1 76.2% 36.3%',
        '--sidebar-foreground-70': '240 5% 30%',
        '--neon-green': '81 96% 55%',
        '--background-custom': '240 5% 96%',
        '--chart-1': '221.2 83.2% 53.3%',
        '--chart-2': '212 95% 68%',
        '--chart-3': '216 92% 60%',
        '--chart-4': '210 98% 78%',
        '--chart-5': '212 97% 87%',
      },
      dark: {
        '--background': '240 2% 11%',
        '--foreground': '0 0% 95%',
        '--card': '240 2% 11.5%',
        '--card-foreground': '0 0% 95%',
        '--popover': '240 2% 11.5%',
        '--popover-foreground': '0 0% 95%',
        '--primary': '142.1 70.6% 45.3%',
        '--primary-foreground': '144.9 80.4% 10%',
        '--secondary': '240 3.7% 15.9%',
        '--secondary-foreground': '0 0% 98%',
        '--muted': '0 0% 15%',
        '--muted-foreground': '240 5% 40%',
        '--accent': '12 6.5% 15.1%',
        '--accent-foreground': '0 0% 98%',
        '--destructive': '0 62.8% 30.6%',
        '--destructive-foreground': '0 85.7% 97.3%',
        '--border': '0 0% 18%',
        '--input': '240 2% 16.5%',
        '--input-placeholder': '240 5% 70%',
        '--ring': '215 16% 47%',
        '--radius': '0.5rem',
        '--background-custom': '240 4% 8%',
        '--sidebar-background': '240 2% 11%',
        '--sidebar-foreground': '0 0 71%',
        '--sidebar-primary': '0 100% 81%',
        '--sidebar-primary-foreground': '0 0% 98%',
        '--sidebar-accent': 'var(--accent)',
        '--sidebar-accent-foreground': 'var(--accent-foreground)',
        '--sidebar-border': '0 0% 20% / 0.8',
        '--sidebar-ring': '0 0% 64%',
        '--sidebar-foreground-70': '0 0% 98%',
        '--chart-1': '221.2 83.2% 53.3%',
        '--chart-2': '212 95% 68%',
        '--chart-3': '216 92% 60%',
        '--chart-4': '210 98% 78%',
        '--chart-5': '212 97% 87%',
      },
    },
  },
  {
    name: 'blue',
    label: 'Blue',
    dot: '#3b82f6',
    css: {
      light: {
        '--background': '240 5% 96%',
        '--foreground': '240 5% 10%',
        '--muted': '240 5% 90%',
        '--muted-foreground': '240 5% 40%',
        '--card': '240 5% 98%',
        '--card-foreground': 'var(--foreground)',
        '--popover': 'var(--background)',
        '--popover-foreground': 'var(--foreground)',
        '--border': '240 5% 80%',
        '--primary': '221.2 83.2% 53.3%',
        '--primary-foreground': '210 40% 98%',
        '--secondary': '210 40% 96.1%',
        '--secondary-foreground': '222.2 47.4% 11.2%',
        '--accent': '240 5% 90%',
        '--accent-foreground': '222.2 47.4% 11.2%',
        '--destructive': '0 84.2% 60.2%',
        '--destructive-foreground': '210 40% 98%',
        '--input': '240 6% 91%',
        '--ring': '221.2 83.2% 53.3%',
        '--radius': '0.5rem',
        '--hover-primary': '221.2 83.2% 40%',
        '--hover-secondary': '210 40% 90%',
        '--hover-destructive': '0 84.2% 70%',
        '--success': '142 76% 36%',
        '--hover-success': '142 72% 29%',
        '--border-destructive-50': '0 72% 51%',
        '--bg-destructive-10': '0 72% 51%',
        '--hover-destructive-20': '0 72% 51%',
        '--bg-muted-50': '210 40% 96%',
        '--bg-accent-50': '210 40% 96%',
        '--bg-muted-40': '210 40% 96%',
        '--border-muted-40': '210 40% 96%',
        '--sidebar-background': '240 5% 90%',
        '--sidebar-foreground': '240 5% 20%',
        '--sidebar-primary': '221.2 83.2% 53.3%',
        '--sidebar-primary-foreground': '240 5% 98%',
        '--sidebar-accent': '240 5% 85%',
        '--sidebar-accent-foreground': '240 5% 10%',
        '--sidebar-border': '240 5% 80%',
        '--sidebar-ring': '221.2 83.2% 53.3%',
        '--sidebar-foreground-70': '240 5% 30%',
        '--neon-green': '81 96% 55%',
        '--background-custom': '240 5% 96%',
        '--chart-1': '221.2 83.2% 53.3%',
        '--chart-2': '212 95% 68%',
        '--chart-3': '216 92% 60%',
        '--chart-4': '210 98% 78%',
        '--chart-5': '212 97% 87%',
      },
      dark: {
        '--background': '240 2% 11%',
        '--foreground': '0 0% 98%',
        '--card': '240 2% 11.5%',
        '--card-foreground': '210 40% 98%',
        '--popover': '240 2% 11.5%',
        '--popover-foreground': '210 40% 98%',
        '--primary': '217.2 91.2% 59.8%',
        '--primary-foreground': '222.2 47.4% 11.2%',
        '--secondary': '217.2 32.6% 17.5%',
        '--secondary-foreground': '210 40% 98%',
        '--muted': '217.2 32.6% 17.5%',
        '--muted-foreground': '215 20.2% 65.1%',
        '--accent': '217.2 32.6% 17.5%',
        '--accent-foreground': '210 40% 98%',
        '--destructive': '0 62.8% 30.6%',
        '--destructive-foreground': '210 40% 98%',
        '--border': '0 0% 18%',
        '--input': '240 2% 16.5%',
        '--ring': '215 16% 47%',
        '--radius': '0.5rem',
        '--background-custom': '240 4% 8%',
        '--sidebar-background': '240 2% 11%',
        '--sidebar-foreground': '0 0 71%',
        '--sidebar-primary': '0 100% 81%',
        '--sidebar-primary-foreground': '0 0% 98%',
        '--sidebar-accent': 'var(--accent)',
        '--sidebar-accent-foreground': 'var(--accent-foreground)',
        '--sidebar-border': '0 0% 20% / 0.8',
        '--sidebar-ring': '0 0% 64%',
        '--sidebar-foreground-70': '0 0% 98%',
        '--chart-1': '221.2 83.2% 53.3%',
        '--chart-2': '212 95% 68%',
        '--chart-3': '216 92% 60%',
        '--chart-4': '210 98% 78%',
        '--chart-5': '212 97% 87%',
      },
    },
  },
  {
    name: 'yellow',
    label: 'Yellow',
    dot: '#eab308',
    css: {
      light: {
        '--background': '240 5% 96%',
        '--foreground': '240 5% 10%',
        '--card': '240 5% 98%',
        '--card-foreground': 'var(--foreground)',
        '--popover': 'var(--background)',
        '--popover-foreground': 'var(--foreground)',
        '--border': '240 5% 80%',
        '--primary': '47.9 95.8% 53.1%',
        '--primary-foreground': '26 83.3% 14.1%',
        '--secondary': '60 4.8% 95.9%',
        '--secondary-foreground': '24 9.8% 10%',
        '--muted': '240 5% 90%',
        '--muted-foreground': '240 5% 40%',
        '--accent': '240 5% 90%',
        '--accent-foreground': '24 9.8% 10%',
        '--destructive': '0 84.2% 60.2%',
        '--destructive-foreground': '60 9.1% 97.8%',
        '--input': '240 6% 91%',
        '--input-placeholder': '240 5% 70%',
        '--ring': '20 14.3% 4.1%',
        '--radius': '0.5rem',
        '--hover-primary': '47.9 95.8% 40%',
        '--hover-secondary': '60 4.8% 90%',
        '--hover-destructive': '0 84.2% 70%',
        '--success': '142 76% 36%',
        '--hover-success': '142 72% 29%',
        '--border-destructive-50': '0 72% 51%',
        '--bg-destructive-10': '0 72% 51%',
        '--hover-destructive-20': '0 72% 51%',
        '--bg-muted-50': '210 40% 96%',
        '--bg-accent-50': '210 40% 96%',
        '--bg-muted-40': '210 40% 96%',
        '--border-muted-40': '210 40% 96%',
        '--sidebar-background': '240 5% 90%',
        '--sidebar-foreground': '240 5% 20%',
        '--sidebar-primary': '20 14.3% 4.1%',
        '--sidebar-primary-foreground': '240 5% 98%',
        '--sidebar-accent': '240 5% 85%',
        '--sidebar-accent-foreground': '240 5% 10%',
        '--sidebar-border': '240 5% 80%',
        '--sidebar-ring': '20 14.3% 4.1%',
        '--sidebar-foreground-70': '240 5% 30%',
        '--neon-green': '81 96% 55%',
        '--background-custom': '240 5% 96%',
        '--chart-1': '221.2 83.2% 53.3%',
        '--chart-2': '212 95% 68%',
        '--chart-3': '216 92% 60%',
        '--chart-4': '210 98% 78%',
        '--chart-5': '212 97% 87%',
      },
      dark: {
        '--background': '240 2% 11%',
        '--foreground': '0 0% 98%',
        '--card': '240 2% 11.5%',
        '--card-foreground': '60 9.1% 97.8%',
        '--popover': '240 2% 11.5%',
        '--popover-foreground': '60 9.1% 97.8%',
        '--primary': '47.9 95.8% 53.1%',
        '--primary-foreground': '26 83.3% 14.1%',
        '--secondary': '12 6.5% 15.1%',
        '--secondary-foreground': '60 9.1% 97.8%',
        '--muted': '12 6.5% 15.1%',
        '--muted-foreground': '24 5.4% 63.9%',
        '--accent': '12 6.5% 15.1%',
        '--accent-foreground': '60 9.1% 97.8%',
        '--destructive': '0 62.8% 30.6%',
        '--destructive-foreground': '60 9.1% 97.8%',
        '--border': '0 0% 18%',
        '--input': '240 2% 16.5%',
        '--ring': '215 16% 47%',
        '--radius': '0.5rem',
        '--background-custom': '240 4% 8%',
        '--sidebar-background': '240 2% 11%',
        '--sidebar-foreground': '0 0 71%',
        '--sidebar-primary': '0 100% 81%',
        '--sidebar-primary-foreground': '0 0% 98%',
        '--sidebar-accent': 'var(--accent)',
        '--sidebar-accent-foreground': 'var(--accent-foreground)',
        '--sidebar-border': '0 0% 20% / 0.8',
        '--sidebar-ring': '0 0% 64%',
        '--sidebar-foreground-70': '0 0% 98%',
        '--chart-1': '221.2 83.2% 53.3%',
        '--chart-2': '212 95% 68%',
        '--chart-3': '216 92% 60%',
        '--chart-4': '210 98% 78%',
        '--chart-5': '212 97% 87%',
      },
    },
  },
  {
    name: 'violet',
    label: 'Violet',
    dot: '#8b5cf6',
    css: {
      light: {
        '--background': '240 5% 96%',
        '--foreground': '240 5% 10%',
        '--card': '240 5% 98%',
        '--card-foreground': 'var(--foreground)',
        '--popover': 'var(--background)',
        '--popover-foreground': 'var(--foreground)',
        '--border': '240 5% 80%',
        '--primary': '262.1 83.3% 57.8%',
        '--primary-foreground': '210 20% 98%',
        '--secondary': '220 14.3% 95.9%',
        '--secondary-foreground': '220.9 39.3% 11%',
        '--muted': '240 5% 90%',
        '--muted-foreground': '240 5% 40%',
        '--accent': '240 5% 90%',
        '--accent-foreground': '220.9 39.3% 11%',
        '--destructive': '0 84.2% 60.2%',
        '--destructive-foreground': '210 20% 98%',
        '--input': '240 6% 91%',
        '--input-placeholder': '240 5% 70%',
        '--ring': '262.1 83.3% 57.8%',
        '--radius': '0.5rem',
        '--hover-primary': '262.1 83.3% 40%',
        '--hover-secondary': '220 14.3% 90%',
        '--hover-destructive': '0 84.2% 70%',
        '--success': '142 76% 36%',
        '--hover-success': '142 72% 29%',
        '--border-destructive-50': '0 72% 51%',
        '--bg-destructive-10': '0 72% 51%',
        '--hover-destructive-20': '0 72% 51%',
        '--bg-muted-50': '210 40% 96%',
        '--bg-accent-50': '210 40% 96%',
        '--bg-muted-40': '210 40% 96%',
        '--border-muted-40': '210 40% 96%',
        '--sidebar-background': '240 5% 90%',
        '--sidebar-foreground': '240 5% 20%',
        '--sidebar-primary': '262.1 83.3% 57.8%',
        '--sidebar-primary-foreground': '240 5% 98%',
        '--sidebar-accent': '240 5% 85%',
        '--sidebar-accent-foreground': '240 5% 10%',
        '--sidebar-border': '240 5% 80%',
        '--sidebar-ring': '262.1 83.3% 57.8%',
        '--sidebar-foreground-70': '240 5% 30%',
        '--neon-green': '81 96% 55%',
        '--background-custom': '240 5% 96%',
        '--chart-1': '221.2 83.2% 53.3%',
        '--chart-2': '212 95% 68%',
        '--chart-3': '216 92% 60%',
        '--chart-4': '210 98% 78%',
        '--chart-5': '212 97% 87%',
      },
      dark: {
        '--background': '240 2% 11%',
        '--foreground': '0 0% 98%',
        '--card': '240 2% 11.5%',
        '--card-foreground': '210 20% 98%',
        '--popover': '240 2% 11.5%',
        '--popover-foreground': '210 20% 98%',
        '--primary': '263.4 70% 50.4%',
        '--primary-foreground': '210 20% 98%',
        '--secondary': '215 27.9% 16.9%',
        '--secondary-foreground': '210 20% 98%',
        '--muted': '215 27.9% 16.9%',
        '--muted-foreground': '217.9 10.6% 64.9%',
        '--accent': '215 27.9% 16.9%',
        '--accent-foreground': '210 20% 98%',
        '--destructive': '0 62.8% 30.6%',
        '--destructive-foreground': '210 20% 98%',
        '--border': '0 0% 18%',
        '--input': '240 2% 16.5%',
        '--ring': '215 16% 47%',
        '--radius': '0.5rem',
        '--background-custom': '240 4% 8%',
        '--sidebar-background': '240 2% 11%',
        '--sidebar-foreground': '0 0 71%',
        '--sidebar-primary': '0 100% 81%',
        '--sidebar-primary-foreground': '0 0% 98%',
        '--sidebar-accent': 'var(--accent)',
        '--sidebar-accent-foreground': 'var(--accent-foreground)',
        '--sidebar-border': '0 0% 20% / 0.8',
        '--sidebar-ring': '0 0% 64%',
        '--sidebar-foreground-70': '0 0% 98%',
        '--chart-1': '221.2 83.2% 53.3%',
        '--chart-2': '212 95% 68%',
        '--chart-3': '216 92% 60%',
        '--chart-4': '210 98% 78%',
        '--chart-5': '212 97% 87%',
      },
    },
  },
]

export default function ThemeSettings() {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [selectedColor, setSelectedColor] = useState(() => {
    return localStorage.getItem('color-theme') || 'default';
  });
  const [radius, setRadius] = useState(() => {
    return localStorage.getItem('radius') || '0.5rem';
  });

  useEffect(() => {
    setMounted(true);
    const color = colorThemes.find(c => c.name === selectedColor) || colorThemes[0];
    const mode = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    applyThemeVars({
      ...color.css[mode],
      '--radius': radius
    });
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const color = colorThemes.find(c => c.name === selectedColor) || colorThemes[0];
    const mode = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    applyThemeVars({
      ...color.css[mode],
      '--radius': radius
    });
    localStorage.setItem('color-theme', selectedColor);
    localStorage.setItem('radius', radius);
  }, [selectedColor, mounted, theme, radius]);

  const handleColorChange = (name: string) => {
    setSelectedColor(name);
    toast({
      title: t('success'),
      description: t('theme.themeSaved'),
    });
  };

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme);
    toast({
      title: t('theme.themeChanged'),
      description: t('theme.visitThemePage'),
    });
  };

  const handleRadiusChange = (value: string) => {
    setRadius(value);
    toast({
      title: t('success'),
      description: t('theme.radiusSaved'),
    });
  };

  return (
    <div className="flex flex-col gap-y-6 mt-10">
      <Card>
        <CardHeader>
          <CardTitle>{t('theme.title')}</CardTitle>
          <CardDescription>{t('theme.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-wrap gap-2 items-center">
            {colorThemes.map((color) => (
              <button
                key={color.name}
                onClick={() => handleColorChange(color.name)}
                className={cn(
                  'flex items-center gap-2 px-3 py-1 rounded-full border transition',
                  selectedColor === color.name
                    ? 'border-primary bg-primary/10'
                    : 'border-border bg-background',
                )}
                aria-label={color.label}
              >
                <span
                  className="inline-block w-4 h-4 rounded-full border"
                  style={{ background: color.dot }}
                />
                <span className="text-sm font-medium">{color.label}</span>
              </button>
            ))}
          </div>
          <div className="space-y-4">
            <h3 className="text-lg font-medium">{t('theme.mode')}</h3>
            <RadioGroup
              defaultValue={theme}
              onValueChange={handleThemeChange}
              className="grid grid-cols-1 gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="light" id="light" />
                <Label htmlFor="light">{t('theme.light')}</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="dark" id="dark" />
                <Label htmlFor="dark">{t('theme.dark')}</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="system" id="system" />
                <Label htmlFor="system">{t('theme.system')}</Label>
              </div>
            </RadioGroup>
          </div>
          <div className="space-y-4">
            <h3 className="text-lg font-medium">{t('theme.radius')}</h3>
            <RadioGroup
              defaultValue={radius}
              onValueChange={handleRadiusChange}
              className="grid grid-cols-2 gap-4 sm:grid-cols-4"
            >
              <div>
                <RadioGroupItem
                  value="0"
                  id="radius-none"
                  className="peer sr-only"
                />
                <Label
                  htmlFor="radius-none"
                  className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="mb-3 h-6 w-6"
                  >
                    <rect width="18" height="18" x="3" y="3" rx="0" />
                  </svg>
                  None
                </Label>
              </div>
              <div>
                <RadioGroupItem
                  value="0.3rem"
                  id="radius-sm"
                  className="peer sr-only"
                />
                <Label
                  htmlFor="radius-sm"
                  className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="mb-3 h-6 w-6"
                  >
                    <rect width="18" height="18" x="3" y="3" rx="2" />
                  </svg>
                  Small
                </Label>
              </div>
              <div>
                <RadioGroupItem
                  value="0.5rem"
                  id="radius-md"
                  className="peer sr-only"
                />
                <Label
                  htmlFor="radius-md"
                  className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="mb-3 h-6 w-6"
                  >
                    <rect width="18" height="18" x="3" y="3" rx="6" />
                  </svg>
                  Medium
                </Label>
              </div>
              <div>
                <RadioGroupItem
                  value="0.75rem"
                  id="radius-lg"
                  className="peer sr-only"
                />
                <Label
                  htmlFor="radius-lg"
                  className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="mb-3 h-6 w-6"
                  >
                    <rect width="18" height="18" x="3" y="3" rx="12" />
                  </svg>
                  Large
                </Label>
              </div>
            </RadioGroup>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 