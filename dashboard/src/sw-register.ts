// Service Worker Registration - Simplified
export function registerSW() {
  if ('serviceWorker' in navigator) {
    // Get the base URL from Vite's environment
    const baseUrl = import.meta.env.BASE_URL || '/'

    // Register service worker
    navigator.serviceWorker
      .register(`${baseUrl}sw.js`)
      .then(registration => {
        console.log('SW registered: ', registration)
      })
      .catch(registrationError => {
        console.log('SW registration failed: ', registrationError)
      })
  }
}
