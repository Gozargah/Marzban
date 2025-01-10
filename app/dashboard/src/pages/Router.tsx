import CoreSettings from '@/components/settings/CoreSettings'
import { getCurrentAdmin } from '@/service/api'
import { createHashRouter, RouteObject } from 'react-router-dom'
import Dashboard from './Dashboard'
import Layout from './Layout'
import Login from './Login'
import Nodes from './Nodes'
import Settings from './Settings'
import Statistics from './Statistics'

const fetchAdminLoader = async (): Promise<any> => {
  try {
    const response = await getCurrentAdmin()
    return response
  } catch (error) {
    throw new Response('Unauthorized', { status: 401 })
  }
}

export const router = createHashRouter([
  {
    element: <Layout />,
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
