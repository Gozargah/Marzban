import { ThemeProvider } from '@/components/theme-provider'
import { router } from '@/router'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router'
import { Toaster } from './components/ui/sonner'
import './lib/dayjs'
import { queryClient } from './utils/query-client'

export default function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="theme">
        <QueryClientProvider client={queryClient}>
          <main>
            <Toaster />
            <RouterProvider router={router} />
          </main>
        </QueryClientProvider>
    </ThemeProvider>
  )
}
