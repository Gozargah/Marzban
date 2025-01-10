import { ThemeProvider } from '@/components/theme-provider'
import { router } from '@/pages/Router'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import { Toaster } from './components/ui/toaster'
import './index.css'
import './styles/fonts.css'
import { queryClient } from './utils/query-client'

function App() {
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

export default App
