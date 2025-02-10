import CoreSettings from '@/components/settings/CoreSettings'
import { getCurrentAdmin } from '@/service/api'
import { createHashRouter, RouteObject } from 'react-router'
import DashboardLayout from './pages/_dashboard'
import Dashboard from './pages/_dashboard._index'
import Nodes from './pages/_dashboard.nodes'
import Settings from './pages/_dashboard.settings'
import Statistics from './pages/_dashboard.statistics'
import Login from './pages/login'
import GeneralSettings from './components/settings/GeneralSettings'

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
        path: '/nodes',
        element: <Nodes />,
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
