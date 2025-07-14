// Service Worker Registration with Dynamic Start URL
export function registerSW() {
  if ('serviceWorker' in navigator) {
    // Get the base URL from Vite's environment
    const baseUrl = import.meta.env.BASE_URL || '/'
    
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
        scope: baseUrl,
        icons: [
          {
            src: `${baseUrl}statics/favicon/android-chrome-192x192.png`,
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: `${baseUrl}statics/favicon/android-chrome-512x512.png`,
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: `${baseUrl}statics/favicon/apple-touch-icon.png`,
            sizes: '180x180',
            type: 'image/png'
          }
        ]
      }

      // Create a blob URL for the manifest
      const manifestBlob = new Blob([JSON.stringify(manifest)], { type: 'application/json' })
      const manifestUrl = URL.createObjectURL(manifestBlob)

      // Remove any existing manifest links
      const existingManifests = document.querySelectorAll('link[rel="manifest"]')
      existingManifests.forEach(link => link.remove())

      // Create and add the new manifest link
      const manifestLink = document.createElement('link')
      manifestLink.rel = 'manifest'
      manifestLink.href = manifestUrl
      document.head.appendChild(manifestLink)

      return manifestUrl
    }

    // Update manifest immediately
    let manifestUrl = updateManifest()

    // Register service worker
    navigator.serviceWorker.register(`${baseUrl}sw.js`)
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

    // Clean up manifest URL when page unloads
    window.addEventListener('beforeunload', () => {
      URL.revokeObjectURL(manifestUrl)
    })

    // Also update manifest when the route changes (for SPA)
    let currentUrl = window.location.href
    const checkForRouteChange = () => {
      if (window.location.href !== currentUrl) {
        currentUrl = window.location.href
        const newManifestUrl = updateManifest()
        // Clean up old manifest URL
        URL.revokeObjectURL(manifestUrl)
        // Update the reference
        manifestUrl = newManifestUrl
      }
    }

    // Check for route changes periodically
    setInterval(checkForRouteChange, 1000)
  }
} 