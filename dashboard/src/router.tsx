import CoreSettings from '@/pages/_dashboard.nodes.cores'
import ThemePage from '@/pages/_dashboard.settings.theme'
import { getCurrentAdmin } from '@/service/api'
import { createHashRouter, RouteObject } from 'react-router'
import DashboardLayout from './pages/_dashboard'
import Dashboard from './pages/_dashboard._index'
import AdminsPage from './pages/_dashboard.admins'
import Groups from './pages/_dashboard.groups'
import Hosts from './pages/_dashboard.hosts'
import Nodes from './pages/_dashboard.nodes'
import NodesPage from './pages/_dashboard.nodes._index'
import NodeLogs from './pages/_dashboard.nodes.logs'
import Settings from './pages/_dashboard.settings'
import CleanupSettings from './pages/_dashboard.settings.cleanup'
import DiscordSettings from './pages/_dashboard.settings.discord'
import NotificationSettings from './pages/_dashboard.settings.notifications'
import SubscriptionSettings from './pages/_dashboard.settings.subscriptions'
import TelegramSettings from './pages/_dashboard.settings.telegram'
import WebhookSettings from './pages/_dashboard.settings.webhook'
import Statistics from './pages/_dashboard.statistics'
import UserTemplates from './pages/_dashboard.templates'
import Users from './pages/_dashboard.users'
import Login from './pages/login'
import { useAdmin } from '@/hooks/use-admin'
import { Navigate } from 'react-router'

// Component to handle default settings routing based on user permissions
function SettingsIndex() {
  const { admin } = useAdmin()
  const is_sudo = admin?.is_sudo || false
  
  // For sudo admins, default to notifications; for non-sudo admins, default to theme
  const defaultPath = is_sudo ? '/settings/notifications' : '/settings/theme'
  
  return <Navigate to={defaultPath} replace />
}

const fetchAdminLoader = async (): Promise<any> => {
  try {
    const response = await getCurrentAdmin()
    return response
  } catch (error) {
    throw Response.redirect('/login')
  }
}

export const router = createHashRouter([
  {
    element: <DashboardLayout />,
    errorElement: <Login />,
    loader: fetchAdminLoader,
    children: [
      {
        path: '/',
        index: true,
        element: <Dashboard />,
      },
      {
        path: '/users',
        element: <Users />,
      },
      {
        path: '/statistics',
        element: <Statistics />,
      },
      {
        path: '/hosts',
        element: <Hosts />,
      },
      {
        path: '/nodes',
        element: <Nodes />,
        children: [
          {
            path: '/nodes',
            element: <NodesPage />,
          },
          {
            path: '/nodes/cores',
            element: <CoreSettings />,
          },
          {
            path: '/nodes/logs',
            element: <NodeLogs />,
          },
        ],
      },
      {
        path: '/groups',
        element: <Groups />,
      },
      {
        path: '/templates',
        element: <UserTemplates />,
      },
      {
        path: '/admins',
        element: <AdminsPage />,
      },
      {
        path: '/settings',
        element: <Settings />,
        children: [
          {
            path: '/settings',
            index: true,
            element: <SettingsIndex />,
          },
          {
            path: '/settings/notifications',
            element: <NotificationSettings />,
          },
          {
            path: '/settings/subscriptions',
            element: <SubscriptionSettings />,
          },
          {
            path: '/settings/telegram',
            element: <TelegramSettings />,
          },
          {
            path: '/settings/discord',
            element: <DiscordSettings />,
          },
          {
            path: '/settings/webhook',
            element: <WebhookSettings />,
          },
          {
            path: '/settings/cleanup',
            element: <CleanupSettings />,
          },
          {
            path: '/settings/theme',
            element: <ThemePage />,
          },
        ],
      },
      {
        path: 'theme',
        element: <ThemePage />,
      },
    ],
  },
  {
    path: '/login',
    element: <Login />,
  },
] as RouteObject[])
