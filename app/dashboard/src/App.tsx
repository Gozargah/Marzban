import { ThemeProvider } from '@/components/theme-provider'
import { router } from '@/router'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router'
import { Toaster } from './components/ui/toaster'
import './lib/dayjs'
import { queryClient } from './utils/query-client'

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <Toaster />
        <main>
          <RouterProvider router={router} />
        </main>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
