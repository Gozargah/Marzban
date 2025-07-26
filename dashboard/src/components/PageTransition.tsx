import { ReactNode, useEffect, useState, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router'
import { cn } from '@/lib/utils'

interface PageTransitionProps {
  children: ReactNode
  duration?: number // in milliseconds
  delay?: number // in milliseconds
  isContentTransition?: boolean // Flag to indicate if this is an inner content transition
}

export default function PageTransition({
  children,
  duration = 300,
  delay = 0,
  isContentTransition = false, // Default to false for backward compatibility
}: PageTransitionProps) {
  const location = useLocation()
  const navigationType = useNavigationType()
  const [displayChildren, setDisplayChildren] = useState(children)
  const [isPageTransitioning, setIsPageTransitioning] = useState(false)
  const [isShaking, setIsShaking] = useState(false)
  const previousLocationRef = useRef({
    pathname: location.pathname,
    search: location.search,
    hash: location.hash,
    key: location.key,
    state: location.state,
  })
  const isFirstRenderRef = useRef(true)
  const hasNavigatedRef = useRef(false)
  const transitionTimeoutRef = useRef<number | null>(null)
  const shakeTimeoutRef = useRef<number | null>(null)

  // Clean up timeouts on unmount
  useEffect(() => {
    return () => {
      if (transitionTimeoutRef.current) {
        window.clearTimeout(transitionTimeoutRef.current)
      }
      if (shakeTimeoutRef.current) {
        window.clearTimeout(shakeTimeoutRef.current)
      }
    }
  }, [])

  // Update children when they change, but only if not transitioning
  useEffect(() => {
    if (!isShaking && !isPageTransitioning) {
      setDisplayChildren(children)
    }
  }, [children, isShaking, isPageTransitioning])

  // For hash router, we need to consider the full URL including the hash
  const getPathWithHash = () => {
    return `${location.pathname}${location.hash}`
  }

  const previousPathWithHash = () => {
    return `${previousLocationRef.current.pathname}${previousLocationRef.current.hash}`
  }

  // Detect actual location change for hash router
  const isSameLocation = () => {
    // In hash router, the location.key changes for each navigation attempt
    // even if the URL is the same, so we can use it to detect navigation attempts
    return getPathWithHash() === previousPathWithHash() && location.key !== previousLocationRef.current.key
  }

  // Check if we're coming from login page
  const isComingFromLogin = () => {
    const prevPath = previousPathWithHash()
    const currentPath = getPathWithHash()
    return prevPath.includes('/login') && (currentPath === '/' || currentPath === '/#/')
  }

  // Check if this is a tab navigation within dashboard sections
  const isTabNavigation = () => {
    // Check if navigation is between tabs in settings or nodes sections
    const currentPath = location.pathname
    const previousPath = previousLocationRef.current.pathname

    // Check for tab navigation patterns
    return (
      // Settings tab navigation
      (currentPath.startsWith('/settings') && previousPath.startsWith('/settings')) ||
      // Nodes tab navigation
      (currentPath.startsWith('/nodes') && previousPath.startsWith('/nodes'))
    )
  }

  // Reset location ref without animation
  const resetLocationRef = () => {
    previousLocationRef.current = {
      pathname: location.pathname,
      search: location.search,
      hash: location.hash,
      key: location.key,
      state: location.state,
    }
  }

  // Handle navigation effects
  useEffect(() => {
    // Skip on first render
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false
      return
    }

    // Clear any existing timeouts
    if (transitionTimeoutRef.current) {
      window.clearTimeout(transitionTimeoutRef.current)
      transitionTimeoutRef.current = null
    }
    if (shakeTimeoutRef.current) {
      window.clearTimeout(shakeTimeoutRef.current)
      shakeTimeoutRef.current = null
    }

    // Skip animations on browser actions like refresh (POP)
    if (navigationType === 'POP') {
      setDisplayChildren(children)
      resetLocationRef()
      return
    }

    // Check if we're navigating to the same location
    const isSameLocationAttempt = isSameLocation()

    // Special case: Tab navigation - handle differently based on isContentTransition
    if (isTabNavigation()) {
      if (isContentTransition) {
        // For content inside tabs
        if (isSameLocationAttempt) {
          // Same page navigation inside tabs - trigger shake for content
          setIsShaking(true)

          // Reset shake after animation completes
          shakeTimeoutRef.current = window.setTimeout(() => {
            setIsShaking(false)
          }, duration)
        } else {
          // Different tab - use transition
          setIsPageTransitioning(true)

          transitionTimeoutRef.current = window.setTimeout(() => {
            setDisplayChildren(children)
            // Small delay before removing transition class to ensure smooth animation
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                setIsPageTransitioning(false)
              })
            })
            resetLocationRef()
          }, 100) // Shorter transition for better responsiveness
        }
      } else {
        // For the main page wrapper, skip animations
        setDisplayChildren(children)
        resetLocationRef()
      }
      return
    }

    // Special case: coming from login - no shake, just fade
    if (isComingFromLogin()) {
      // Just do a simple fade transition
      setIsPageTransitioning(true)

      transitionTimeoutRef.current = window.setTimeout(() => {
        setDisplayChildren(children)
        // Small delay before removing transition class
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setIsPageTransitioning(false)
          })
        })
        resetLocationRef()
        hasNavigatedRef.current = true
      }, 100)

      return
    }

    // Same path but different navigation attempt - trigger shake
    if (isSameLocationAttempt) {
      setIsShaking(true)

      // Reset shake after animation completes
      shakeTimeoutRef.current = window.setTimeout(() => {
        setIsShaking(false)
      }, duration)

      return
    }

    // Different location - fade transition
    const isRealLocationChange = getPathWithHash() !== previousPathWithHash()

    if (isRealLocationChange) {
      // Different page navigation - fade transition
      setIsPageTransitioning(true)

      // Wait for fade-out, then update content
      transitionTimeoutRef.current = window.setTimeout(() => {
        setDisplayChildren(children)
        // Small delay before removing transition class
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setIsPageTransitioning(false)
          })
        })
        resetLocationRef()
        hasNavigatedRef.current = true
      }, 100)
    } else {
      // Same location but different children - update without transition
      setDisplayChildren(children)
      resetLocationRef()
    }
  }, [location, navigationType, children, duration, isContentTransition])

  return (
    <div
      className={cn('w-full will-change-opacity will-change-transform', isShaking ? 'animate-telegram-shake' : '', isPageTransitioning ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0')}
      style={{
        animationDuration: isShaking ? `${duration}ms` : undefined,
        animationDelay: isShaking && delay > 0 ? `${delay}ms` : undefined,
        animationFillMode: isShaking ? 'both' : undefined,
        transition: 'opacity 100ms cubic-bezier(0.4, 0, 0.2, 1), transform 100ms cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      {displayChildren}
    </div>
  )
}
