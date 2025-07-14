import App from '@/App'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from './sw-register'

// Register service worker with dynamic start URL
registerSW()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
