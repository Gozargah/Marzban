import { useAdmin } from '@/hooks/use-admin'
import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router'

export default function RouteGuard({ children }: { children: React.ReactNode }) {
  const { admin } = useAdmin()
  const location = useLocation()
  const navigate = useNavigate()
  const is_sudo = admin?.is_sudo || false

  useEffect(() => {
    if (!admin) return // Wait for admin data to load

    if (!is_sudo) {
      const currentPath = location.pathname

      // Define allowed routes for non-sudo admins
      const allowedRoutes = ['/', '/users', '/settings', '/settings/theme']
      const isAllowedRoute = allowedRoutes.some(route => currentPath === route || (route === '/settings' && currentPath.startsWith('/settings/theme')))

      // If current route is allowed, don't redirect
      if (isAllowedRoute) {
        return
      }

      // Define restricted routes for non-sudo admins
      const restrictedRoutes = ['/statistics', '/hosts', '/groups', '/templates', '/admins', '/nodes']
      const isRestrictedRoute = restrictedRoutes.some(route => currentPath.startsWith(route))

      if (isRestrictedRoute) {
        console.log('RouteGuard: Redirecting non-sudo admin from restricted route:', currentPath)
        navigate('/users', { replace: true })
        return
      }

      // Handle settings routes
      if (currentPath === '/settings') {
        console.log('RouteGuard: Redirecting non-sudo admin from /settings to /settings/theme')
        navigate('/settings/theme', { replace: true })
        return
      }

      // Redirect from restricted settings pages
      const restrictedSettingsRoutes = ['/settings/general', '/settings/notifications', '/settings/subscriptions', '/settings/telegram', '/settings/discord', '/settings/webhook', '/settings/cleanup']

      if (restrictedSettingsRoutes.includes(currentPath)) {
        console.log('RouteGuard: Redirecting non-sudo admin from restricted settings:', currentPath)
        navigate('/settings/theme', { replace: true })
        return
      }
    }
  }, [admin, is_sudo, location.pathname, navigate])

  return <>{children}</>
}
