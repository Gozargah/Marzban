// Service Worker Registration with Dynamic Start URL
export function registerSW() {
  if ('serviceWorker' in navigator) {
    // Get the current path to use as start URL
    const currentPath = window.location.pathname
    
    // Update the manifest dynamically
    const updateManifest = () => {
      const manifest = {
        name: 'Marzban',
        short_name: 'Marzban',
        description: 'Marzban: Modern dashboard for managing proxies and users.',
        theme_color: '#1b1b1d',
        background_color: '#1b1b1d',
        display: 'standalone' as const,
        start_url: currentPath,
        scope: currentPath,
        icons: [
          {
            src: '/statics/favicon/android-chrome-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/statics/favicon/android-chrome-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: '/statics/favicon/apple-touch-icon.png',
            sizes: '180x180',
            type: 'image/png'
          }
        ]
      }

      // Create a blob URL for the manifest
      const manifestBlob = new Blob([JSON.stringify(manifest)], { type: 'application/json' })
      const manifestUrl = URL.createObjectURL(manifestBlob)

      // Update the manifest link
      let manifestLink = document.querySelector('link[rel="manifest"]') as HTMLLinkElement
      if (!manifestLink) {
        manifestLink = document.createElement('link')
        manifestLink.rel = 'manifest'
        document.head.appendChild(manifestLink)
      }
      manifestLink.href = manifestUrl

      return manifestUrl
    }

    // Update manifest on page load
    const manifestUrl = updateManifest()

    // Register service worker
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('SW registered: ', registration)
          
          // Update manifest when service worker is ready
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // New content is available
                  console.log('New content is available')
                }
              })
            }
          })
        })
        .catch((registrationError) => {
          console.log('SW registration failed: ', registrationError)
        })
    })

    // Clean up manifest URL when page unloads
    window.addEventListener('beforeunload', () => {
      URL.revokeObjectURL(manifestUrl)
    })
  }
} 