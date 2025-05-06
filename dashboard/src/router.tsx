import CoreSettings from '@/pages/_dashboard.settings.core'
import { getCurrentAdmin } from '@/service/api'
import { createHashRouter, RouteObject } from 'react-router'
import DashboardLayout from './pages/_dashboard'
import Dashboard from './pages/_dashboard._index'
import Groups from './pages/_dashboard.groups'
import Nodes from './pages/_dashboard.nodes'
import Settings from './pages/_dashboard.settings'
import GeneralSettings from './pages/_dashboard.settings._index'
import Statistics from './pages/_dashboard.statistics'
import UserTemplates from './pages/_dashboard.templates._index'
import Login from './pages/login'
import Hosts from './pages/_dashboard.hosts'
import AdminsPage from './pages/_dashboard.admins'

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
        path: '/statistics',
        element: <Statistics />,
      },
      {
        path: '/hosts',
        element: <Hosts />
      },
      {
        path: '/nodes',
        element: <Nodes />,
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
            element: <GeneralSettings />,
          },
          {
            path: '/settings/core',
            element: <CoreSettings />,
          },
        ],
      },
    ],
  },
  {
    path: '/login',
    element: <Login />,
  },
] as RouteObject[])
