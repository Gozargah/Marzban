import { ThemeProvider } from '@/components/theme-provider'
import { ColorThemeProvider } from '@/components/color-theme-provider'
import { router } from '@/router'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router'
import { Toaster } from './components/ui/toaster'
import './lib/dayjs'
import { queryClient } from './utils/query-client'

export default function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="theme">
      <ColorThemeProvider>
        <QueryClientProvider client={queryClient}>
          <Toaster />
          <main>
            <RouterProvider router={router} />
          </main>
        </QueryClientProvider>
      </ColorThemeProvider>
    </ThemeProvider>
  )
}
