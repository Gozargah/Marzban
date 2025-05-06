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
        '--background': '0 0% 100%',
        '--foreground': '0 0% 3.9%',
        '--card': '0 0% 100%',
        '--card-foreground': '0 0% 3.9%',
        '--popover': '0 0% 100%',
        '--popover-foreground': '0 0% 3.9%',
        '--primary': '211 57% 51%',
        '--primary-foreground': '0 0% 98%',
        '--secondary': '0 0% 96.1%',
        '--secondary-foreground': '0 0% 9%',
        '--muted': '0 0% 96.1%',
        '--muted-foreground': '0 0% 45.1%',
        '--accent': '0 0% 96.1%',
        '--accent-foreground': '0 0% 9%',
        '--destructive': '0 84.2% 60.2%',
        '--destructive-foreground': '0 0% 98%',
        '--border': '0 0% 86%',
        '--input': '0 0% 86%',
        '--ring': '211 57% 51%',
        '--radius': '0.5rem',
      },
      dark: {
        '--background': '240 2% 11%',
        '--foreground': '0 0% 98%',
        '--muted': '0 0% 14.9%',
        '--muted-foreground': '0 0% 63.9%',
        '--card': '240 2% 11.5%',
        '--card-foreground': '0 0% 98%',
        '--popover': '240 2% 11.5%',
        '--popover-foreground': '0 0% 98%',
        '--border': '0 0% 18%',
        '--input': '240 2% 16.5%',
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
      },
    },
  },
  {
    name: 'red',
    label: 'Red',
    dot: '#ef4444',
    css: {
      light: {
        '--background': '0 0% 100%',
        '--foreground': '0 0% 3.9%',
        '--card': '0 0% 100%',
        '--card-foreground': '0 0% 3.9%',
        '--popover': '0 0% 100%',
        '--popover-foreground': '0 0% 3.9%',
        '--primary': '0 72.2% 50.6%',
        '--primary-foreground': '0 85.7% 97.3%',
        '--secondary': '0 0% 96.1%',
        '--secondary-foreground': '0 0% 9%',
        '--muted': '0 0% 96.1%',
        '--muted-foreground': '0 0% 45.1%',
        '--accent': '0 0% 96.1%',
        '--accent-foreground': '0 0% 9%',
        '--destructive': '0 84.2% 60.2%',
        '--destructive-foreground': '0 0% 98%',
        '--border': '0 0% 89.8%',
        '--input': '0 0% 89.8%',
        '--ring': '0 72.2% 50.6%',
        '--radius': '0.5rem',
        '--chart-1': '12 76% 61%',
        '--chart-2': '173 58% 39%',
        '--chart-3': '197 37% 24%',
        '--chart-4': '43 74% 66%',
        '--chart-5': '27 87% 67%',
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
        '--input': '0 0% 14.9%',
        '--ring': '0 72.2% 50.6%',
        '--chart-1': '220 70% 50%',
        '--chart-2': '160 60% 45%',
        '--chart-3': '30 80% 55%',
        '--chart-4': '280 65% 60%',
        '--chart-5': '340 75% 55%',
      },
    },
  },
  {
    name: 'rose',
    label: 'Rose',
    dot: '#e11d48',
    css: {
      light: {
        '--background': '0 0% 100%',
        '--foreground': '240 10% 3.9%',
        '--card': '0 0% 100%',
        '--card-foreground': '240 10% 3.9%',
        '--popover': '0 0% 100%',
        '--popover-foreground': '240 10% 3.9%',
        '--primary': '346.8 77.2% 49.8%',
        '--primary-foreground': '355.7 100% 97.3%',
        '--secondary': '240 4.8% 95.9%',
        '--secondary-foreground': '240 5.9% 10%',
        '--muted': '240 4.8% 95.9%',
        '--muted-foreground': '240 3.8% 46.1%',
        '--accent': '240 4.8% 95.9%',
        '--accent-foreground': '240 5.9% 10%',
        '--destructive': '0 84.2% 60.2%',
        '--destructive-foreground': '0 0% 98%',
        '--border': '240 5.9% 90%',
        '--input': '240 5.9% 90%',
        '--ring': '346.8 77.2% 49.8%',
        '--radius': '0.5rem',
        '--chart-1': '12 76% 61%',
        '--chart-2': '173 58% 39%',
        '--chart-3': '197 37% 24%',
        '--chart-4': '43 74% 66%',
        '--chart-5': '27 87% 67%',
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
        '--input': '0 0% 14.9%',
        '--ring': '346.8 77.2% 49.8%',
        '--chart-1': '220 70% 50%',
        '--chart-2': '160 60% 45%',
        '--chart-3': '30 80% 55%',
        '--chart-4': '280 65% 60%',
        '--chart-5': '340 75% 55%',
      },
    },
  },
  {
    name: 'orange',
    label: 'Orange',
    dot: '#f97316',
    css: {
      light: {
        '--background': '0 0% 100%',
        '--foreground': '20 14.3% 4.1%',
        '--card': '0 0% 100%',
        '--card-foreground': '20 14.3% 4.1%',
        '--popover': '0 0% 100%',
        '--popover-foreground': '20 14.3% 4.1%',
        '--primary': '24.6 95% 53.1%',
        '--primary-foreground': '60 9.1% 97.8%',
        '--secondary': '60 4.8% 95.9%',
        '--secondary-foreground': '24 9.8% 10%',
        '--muted': '60 4.8% 95.9%',
        '--muted-foreground': '25 5.3% 44.7%',
        '--accent': '60 4.8% 95.9%',
        '--accent-foreground': '24 9.8% 10%',
        '--destructive': '0 84.2% 60.2%',
        '--destructive-foreground': '60 9.1% 97.8%',
        '--border': '20 5.9% 90%',
        '--input': '20 5.9% 90%',
        '--ring': '24.6 95% 53.1%',
        '--radius': '0.5rem',
        '--chart-1': '12 76% 61%',
        '--chart-2': '173 58% 39%',
        '--chart-3': '197 37% 24%',
        '--chart-4': '43 74% 66%',
        '--chart-5': '27 87% 67%',
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
        '--input': '0 0% 14.9%',
        '--ring': '20.5 90.2% 48.2%',
        '--chart-1': '220 70% 50%',
        '--chart-2': '160 60% 45%',
        '--chart-3': '30 80% 55%',
        '--chart-4': '280 65% 60%',
        '--chart-5': '340 75% 55%',
      },
    },
  },
  {
    name: 'green',
    label: 'Green',
    dot: '#22c55e',
    css: {
      light: {
        '--background': '0 0% 100%',
        '--foreground': '240 10% 3.9%',
        '--card': '0 0% 100%',
        '--card-foreground': '240 10% 3.9%',
        '--popover': '0 0% 100%',
        '--popover-foreground': '240 10% 3.9%',
        '--primary': '142.1 76.2% 36.3%',
        '--primary-foreground': '355.7 100% 97.3%',
        '--secondary': '240 4.8% 95.9%',
        '--secondary-foreground': '240 5.9% 10%',
        '--muted': '240 4.8% 95.9%',
        '--muted-foreground': '240 3.8% 46.1%',
        '--accent': '240 4.8% 95.9%',
        '--accent-foreground': '240 5.9% 10%',
        '--destructive': '0 84.2% 60.2%',
        '--destructive-foreground': '0 0% 98%',
        '--border': '240 5.9% 90%',
        '--input': '240 5.9% 90%',
        '--ring': '142.1 76.2% 36.3%',
        '--radius': '0.5rem',
        '--chart-1': '12 76% 61%',
        '--chart-2': '173 58% 39%',
        '--chart-3': '197 37% 24%',
        '--chart-4': '43 74% 66%',
        '--chart-5': '27 87% 67%',
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
        '--muted-foreground': '240 5% 64.9%',
        '--accent': '12 6.5% 15.1%',
        '--accent-foreground': '0 0% 98%',
        '--destructive': '0 62.8% 30.6%',
        '--destructive-foreground': '0 85.7% 97.3%',
        '--border': '0 0% 18%',
        '--input': '0 0% 14.9%',
        '--ring': '142.4 71.8% 29.2%',
        '--chart-1': '220 70% 50%',
        '--chart-2': '160 60% 45%',
        '--chart-3': '30 80% 55%',
        '--chart-4': '280 65% 60%',
        '--chart-5': '340 75% 55%',
      },
    },
  },
  {
    name: 'blue',
    label: 'Blue',
    dot: '#3b82f6',
    css: {
      light: {
        '--background': '0 0% 100%',
        '--foreground': '222.2 84% 4.9%',
        '--card': '0 0% 100%',
        '--card-foreground': '222.2 84% 4.9%',
        '--popover': '0 0% 100%',
        '--popover-foreground': '222.2 84% 4.9%',
        '--primary': '221.2 83.2% 53.3%',
        '--primary-foreground': '210 40% 98%',
        '--secondary': '210 40% 96.1%',
        '--secondary-foreground': '222.2 47.4% 11.2%',
        '--muted': '210 40% 96.1%',
        '--muted-foreground': '215.4 16.3% 46.9%',
        '--accent': '210 40% 96.1%',
        '--accent-foreground': '222.2 47.4% 11.2%',
        '--destructive': '0 84.2% 60.2%',
        '--destructive-foreground': '210 40% 98%',
        '--border': '214.3 31.8% 91.4%',
        '--input': '214.3 31.8% 91.4%',
        '--ring': '221.2 83.2% 53.3%',
        '--radius': '0.5rem',
        '--chart-1': '12 76% 61%',
        '--chart-2': '173 58% 39%',
        '--chart-3': '197 37% 24%',
        '--chart-4': '43 74% 66%',
        '--chart-5': '27 87% 67%',
      },
      dark: {
        '--background': '240 2% 11%',
        '--foreground': '210 40% 98%',
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
        '--input': '0 0% 14.9%',
        '--ring': '224.3 76.3% 48%',
        '--chart-1': '220 70% 50%',
        '--chart-2': '160 60% 45%',
        '--chart-3': '30 80% 55%',
        '--chart-4': '280 65% 60%',
        '--chart-5': '340 75% 55%',
      },
    },
  },
  {
    name: 'yellow',
    label: 'Yellow',
    dot: '#eab308',
    css: {
      light: {
        '--background': '0 0% 100%',
        '--foreground': '20 14.3% 4.1%',
        '--card': '0 0% 100%',
        '--card-foreground': '20 14.3% 4.1%',
        '--popover': '0 0% 100%',
        '--popover-foreground': '20 14.3% 4.1%',
        '--primary': '47.9 95.8% 53.1%',
        '--primary-foreground': '26 83.3% 14.1%',
        '--secondary': '60 4.8% 95.9%',
        '--secondary-foreground': '24 9.8% 10%',
        '--muted': '60 4.8% 95.9%',
        '--muted-foreground': '25 5.3% 44.7%',
        '--accent': '60 4.8% 95.9%',
        '--accent-foreground': '24 9.8% 10%',
        '--destructive': '0 84.2% 60.2%',
        '--destructive-foreground': '60 9.1% 97.8%',
        '--border': '20 5.9% 90%',
        '--input': '20 5.9% 90%',
        '--ring': '20 14.3% 4.1%',
        '--radius': '0.5rem',
        '--chart-1': '12 76% 61%',
        '--chart-2': '173 58% 39%',
        '--chart-3': '197 37% 24%',
        '--chart-4': '43 74% 66%',
        '--chart-5': '27 87% 67%',
      },
      dark: {
        '--background': '240 2% 11%',
        '--foreground': '60 9.1% 97.8%',
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
        '--input': '0 0% 14.9%',
        '--ring': '35.5 91.7% 32.9%',
        '--chart-1': '220 70% 50%',
        '--chart-2': '160 60% 45%',
        '--chart-3': '30 80% 55%',
        '--chart-4': '280 65% 60%',
        '--chart-5': '340 75% 55%',
      },
    },
  },
  {
    name: 'violet',
    label: 'Violet',
    dot: '#8b5cf6',
    css: {
      light: {
        '--background': '0 0% 100%',
        '--foreground': '224 71.4% 4.1%',
        '--card': '0 0% 100%',
        '--card-foreground': '224 71.4% 4.1%',
        '--popover': '0 0% 100%',
        '--popover-foreground': '224 71.4% 4.1%',
        '--primary': '262.1 83.3% 57.8%',
        '--primary-foreground': '210 20% 98%',
        '--secondary': '220 14.3% 95.9%',
        '--secondary-foreground': '220.9 39.3% 11%',
        '--muted': '220 14.3% 95.9%',
        '--muted-foreground': '220 8.9% 46.1%',
        '--accent': '220 14.3% 95.9%',
        '--accent-foreground': '220.9 39.3% 11%',
        '--destructive': '0 84.2% 60.2%',
        '--destructive-foreground': '210 20% 98%',
        '--border': '220 13% 91%',
        '--input': '220 13% 91%',
        '--ring': '262.1 83.3% 57.8%',
        '--radius': '0.5rem',
        '--chart-1': '12 76% 61%',
        '--chart-2': '173 58% 39%',
        '--chart-3': '197 37% 24%',
        '--chart-4': '43 74% 66%',
        '--chart-5': '27 87% 67%',
      },
      dark: {
        '--background': '240 2% 11%',
        '--foreground': '210 20% 98%',
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
        '--input': '0 0% 14.9%',
        '--ring': '263.4 70% 50.4%',
        '--chart-1': '220 70% 50%',
        '--chart-2': '160 60% 45%',
        '--chart-3': '30 80% 55%',
        '--chart-4': '280 65% 60%',
        '--chart-5': '340 75% 55%',
      },
    },
  },
  {
    name: 'teal',
    label: 'Teal',
    dot: '#14b8a6',
    css: {
      light: {
        '--background': '180 21.05% 92.55%',
        '--foreground': '188.80 78.95% 18.63%',
        '--card': '180 23.81% 95.88%',
        '--card-foreground': '188.80 78.95% 18.63%',
        '--popover': '180 23.81% 95.88%',
        '--popover-foreground': '188.80 78.95% 18.63%',
        '--primary': '183.97 91.89% 29.02%',
        '--primary-foreground': '0 0% 100%',
        '--secondary': '180 28.81% 88.43%',
        '--secondary-foreground': '188.80 78.95% 18.63%',
        '--muted': '180 19.23% 89.80%',
        '--muted-foreground': '184 31.25% 37.65%',
        '--accent': '184 38.46% 84.71%',
        '--accent-foreground': '188.80 78.95% 18.63%',
        '--destructive': '0 62.45% 51.96%',
        '--destructive-foreground': '0 0% 100%',
        '--border': '185.71 26.58% 84.51%',
        '--input': '180 28.81% 88.43%',
        '--ring': '183.97 91.89% 29.02%',
        '--chart-1': '183.97 91.89% 29.02%',
        '--chart-2': '183.53 69.39% 38.43%',
        '--chart-3': '183.56 55.10% 48.04%',
        '--chart-4': '183.72 53.55% 58.63%',
        '--chart-5': '183.61 54.97% 70.39%',
        '--sidebar': '186.32 34.55% 89.22%',
        '--sidebar-foreground': '188.80 78.95% 18.63%',
        '--sidebar-primary': '183.97 91.89% 29.02%',
        '--sidebar-primary-foreground': '0 0% 100%',
        '--sidebar-accent': '184 38.46% 84.71%',
        '--sidebar-accent-foreground': '188.80 78.95% 18.63%',
        '--sidebar-border': '185.71 26.58% 84.51%',
        '--sidebar-ring': '183.97 91.89% 29.02%',
        '--font-sans': 'Courier New, monospace',
        '--font-serif': 'Courier New, monospace',
        '--font-mono': 'Courier New, monospace',
        '--radius': '0.125rem',
        '--shadow-2xs': '1px 1px 2px 0px hsl(185 70% 30% / 0.07)',
        '--shadow-xs': '1px 1px 2px 0px hsl(185 70% 30% / 0.07)',
        '--shadow-sm': '1px 1px 2px 0px hsl(185 70% 30% / 0.15), 1px 1px 2px -1px hsl(185 70% 30% / 0.15)',
        '--shadow': '1px 1px 2px 0px hsl(185 70% 30% / 0.15), 1px 1px 2px -1px hsl(185 70% 30% / 0.15)',
        '--shadow-md': '1px 1px 2px 0px hsl(185 70% 30% / 0.15), 1px 2px 4px -1px hsl(185 70% 30% / 0.15)',
        '--shadow-lg': '1px 1px 2px 0px hsl(185 70% 30% / 0.15), 1px 4px 6px -1px hsl(185 70% 30% / 0.15)',
        '--shadow-xl': '1px 1px 2px 0px hsl(185 70% 30% / 0.15), 1px 8px 10px -1px hsl(185 70% 30% / 0.15)',
        '--shadow-2xl': '1px 1px 2px 0px hsl(185 70% 30% / 0.38)'
      },
      dark: {
        '--background': '196.36 52.38% 8.24%',
        '--foreground': '180 77.11% 60.59%',
        '--card': '192 51.02% 9.61%',
        '--card-foreground': '180 77.11% 60.59%',
        '--popover': '192 51.02% 9.61%',
        '--popover-foreground': '180 77.11% 60.59%',
        '--primary': '180 77.11% 60.59%',
        '--primary-foreground': '196.36 52.38% 8.24%',
        '--secondary': '191.43 58.88% 20.98%',
        '--secondary-foreground': '180 77.11% 60.59%',
        '--muted': '192.86 58.33% 14.12%',
        '--muted-foreground': '180 50.68% 42.94%',
        '--accent': '191.43 58.88% 20.98%',
        '--accent-foreground': '180 77.11% 60.59%',
        '--destructive': '0 78.90% 57.25%',
        '--destructive-foreground': '0 0% 94.90%',
        '--border': '191.43 58.88% 20.98%',
        '--input': '191.43 58.88% 20.98%',
        '--ring': '180 77.11% 60.59%',
        '--chart-1': '180 77.11% 60.59%',
        '--chart-2': '180 50.68% 42.94%',
        '--chart-3': '180 50.82% 35.88%',
        '--chart-4': '184.35 57.98% 23.33%',
        '--chart-5': '185.22 62.16% 14.51%',
        '--sidebar': '196.36 52.38% 8.24%',
        '--sidebar-foreground': '180 77.11% 60.59%',
        '--sidebar-primary': '180 77.11% 60.59%',
        '--sidebar-primary-foreground': '196.36 52.38% 8.24%',
        '--sidebar-accent': '191.43 58.88% 20.98%',
        '--sidebar-accent-foreground': '180 77.11% 60.59%',
        '--sidebar-border': '191.43 58.88% 20.98%',
        '--sidebar-ring': '180 77.11% 60.59%',
        '--font-sans': 'Source Code Pro, monospace',
        '--font-serif': 'Source Code Pro, monospace',
        '--font-mono': 'Source Code Pro, monospace',
        '--radius': '0.125rem',
        '--shadow-2xs': '1px 1px 2px 0px hsl(180 70% 60% / 0.10)',
        '--shadow-xs': '1px 1px 2px 0px hsl(180 70% 60% / 0.10)',
        '--shadow-sm': '1px 1px 2px 0px hsl(180 70% 60% / 0.20), 1px 1px 2px -1px hsl(180 70% 60% / 0.20)',
        '--shadow': '1px 1px 2px 0px hsl(180 70% 60% / 0.20), 1px 1px 2px -1px hsl(180 70% 60% / 0.20)',
        '--shadow-md': '1px 1px 2px 0px hsl(180 70% 60% / 0.20), 1px 2px 4px -1px hsl(180 70% 60% / 0.20)',
        '--shadow-lg': '1px 1px 2px 0px hsl(180 70% 60% / 0.20), 1px 4px 6px -1px hsl(180 70% 60% / 0.20)',
        '--shadow-xl': '1px 1px 2px 0px hsl(180 70% 60% / 0.20), 1px 8px 10px -1px hsl(180 70% 60% / 0.20)',
        '--shadow-2xl': '1px 1px 2px 0px hsl(180 70% 60% / 0.50)'
      }
    }
  },
  {
    name: "new",
    label: "New",
    dot: "#000000",
    css: {
      light: {
        '--background': '0 0% 100%',
        '--foreground': '0 0% 3.92%',
        '--card': '0 0% 100%',
        '--card-foreground': '0 0% 3.92%',
        '--popover': '0 0% 100%',
        '--popover-foreground': '0 0% 3.92%',
        '--primary': '0 0% 45.10%',
        '--primary-foreground': '0 0% 98.04%',
        '--secondary': '0 0% 96.08%',
        '--secondary-foreground': '0 0% 9.02%',
        '--muted': '0 0% 96.08%',
        '--muted-foreground': '0 0% 44.31%',
        '--accent': '0 0% 96.08%',
        '--accent-foreground': '0 0% 9.02%',
        '--destructive': '357.14 100% 45.29%',
        '--destructive-foreground': '0 0% 96.08%',
        '--border': '0 0% 89.80%',
        '--input': '0 0% 89.80%',
        '--ring': '0 0% 63.14%',
        '--chart-1': '0 0% 45.10%',
        '--chart-2': '0 0% 45.10%',
        '--chart-3': '0 0% 45.10%',
        '--chart-4': '0 0% 45.10%',
        '--chart-5': '0 0% 45.10%',
        '--sidebar': '0 0% 98.04%',
        '--sidebar-foreground': '0 0% 3.92%',
        '--sidebar-primary': '0 0% 9.02%',
        '--sidebar-primary-foreground': '0 0% 98.04%',
        '--sidebar-accent': '0 0% 96.08%',
        '--sidebar-accent-foreground': '0 0% 9.02%',
        '--sidebar-border': '0 0% 89.80%',
        '--sidebar-ring': '0 0% 63.14%',
        '--font-sans': 'Geist Mono, monospace',
        '--font-serif': 'Geist Mono, monospace',
        '--font-mono': 'Geist Mono, monospace',
        '--radius': '0rem',
        '--shadow-2xs': '0px 1px 0px 0px hsl(0 0% 0% / 0.00)',
        '--shadow-xs': '0px 1px 0px 0px hsl(0 0% 0% / 0.00)',
        '--shadow-sm': '0px 1px 0px 0px hsl(0 0% 0% / 0.00), 0px 1px 2px -1px hsl(0 0% 0% / 0.00)',
        '--shadow': '0px 1px 0px 0px hsl(0 0% 0% / 0.00), 0px 1px 2px -1px hsl(0 0% 0% / 0.00)',
        '--shadow-md': '0px 1px 0px 0px hsl(0 0% 0% / 0.00), 0px 2px 4px -1px hsl(0 0% 0% / 0.00)',
        '--shadow-lg': '0px 1px 0px 0px hsl(0 0% 0% / 0.00), 0px 4px 6px -1px hsl(0 0% 0% / 0.00)',
        '--shadow-xl': '0px 1px 0px 0px hsl(0 0% 0% / 0.00), 0px 8px 10px -1px hsl(0 0% 0% / 0.00)',
        '--shadow-2xl': '0px 1px 0px 0px hsl(0 0% 0% / 0.00)'
      },
      dark: {
        '--background': '0 0% 3.92%',
        '--foreground': '0 0% 98.04%',
        '--card': '0 0% 9.80%',
        '--card-foreground': '0 0% 98.04%',
        '--popover': '0 0% 14.90%',
        '--popover-foreground': '0 0% 98.04%',
        '--primary': '0 0% 45.10%',
        '--primary-foreground': '0 0% 98.04%',
        '--secondary': '0 0% 14.90%',
        '--secondary-foreground': '0 0% 98.04%',
        '--muted': '0 0% 14.90%',
        '--muted-foreground': '0 0% 63.14%',
        '--accent': '0 0% 25.10%',
        '--accent-foreground': '0 0% 98.04%',
        '--destructive': '358.84 100% 69.61%',
        '--destructive-foreground': '0 0% 14.90%',
        '--border': '0 0% 21.96%',
        '--input': '0 0% 32.16%',
        '--ring': '0 0% 45.10%',
        '--chart-1': '0 0% 45.10%',
        '--chart-2': '0 0% 45.10%',
        '--chart-3': '0 0% 45.10%',
        '--chart-4': '0 0% 45.10%',
        '--chart-5': '0 0% 45.10%',
        '--sidebar': '0 0% 9.02%',
        '--sidebar-foreground': '0 0% 98.04%',
        '--sidebar-primary': '0 0% 98.04%',
        '--sidebar-primary-foreground': '0 0% 9.02%',
        '--sidebar-accent': '0 0% 14.90%',
        '--sidebar-accent-foreground': '0 0% 98.04%',
        '--sidebar-border': '0 0% 100%',
        '--sidebar-ring': '0 0% 32.16%',
        '--font-sans': 'Geist Mono, monospace',
        '--font-serif': 'Geist Mono, monospace',
        '--font-mono': 'Geist Mono, monospace',
        '--radius': '0rem',
        '--shadow-2xs': '0px 1px 0px 0px hsl(0 0% 0% / 0.00)',
        '--shadow-xs': '0px 1px 0px 0px hsl(0 0% 0% / 0.00)',
        '--shadow-sm': '0px 1px 0px 0px hsl(0 0% 0% / 0.00), 0px 1px 2px -1px hsl(0 0% 0% / 0.00)',
        '--shadow': '0px 1px 0px 0px hsl(0 0% 0% / 0.00), 0px 1px 2px -1px hsl(0 0% 0% / 0.00)',
        '--shadow-md': '0px 1px 0px 0px hsl(0 0% 0% / 0.00), 0px 2px 4px -1px hsl(0 0% 0% / 0.00)',
        '--shadow-lg': '0px 1px 0px 0px hsl(0 0% 0% / 0.00), 0px 4px 6px -1px hsl(0 0% 0% / 0.00)',
        '--shadow-xl': '0px 1px 0px 0px hsl(0 0% 0% / 0.00), 0px 8px 10px -1px hsl(0 0% 0% / 0.00)',
        '--shadow-2xl': '0px 1px 0px 0px hsl(0 0% 0% / 0.00)'
      }
    }
  }
]

export default function ThemePage() {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [selectedColor, setSelectedColor] = useState(() => {
    // Initialize with saved color theme
    return localStorage.getItem('color-theme') || 'default';
  });
  const [radius, setRadius] = useState(() => {
    return localStorage.getItem('radius') || '0.5rem';
  });

  useEffect(() => {
    setMounted(true);
    // Apply the current color theme and radius
    const color = colorThemes.find(c => c.name === selectedColor) || colorThemes[0];
    const mode = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    applyThemeVars({
      ...color.css[mode],
      '--radius': radius
    });
  }, []);

  useEffect(() => {
    if (!mounted) return;
    // Apply theme vars on color, radius or mode change
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
    // Show toast to inform user to visit theme page
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
    <div className="container mx-auto py-6 space-y-8">
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