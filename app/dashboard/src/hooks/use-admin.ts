import { AdminType } from '@/types/User'
import { useLoaderData } from 'react-router'

// Hook to access admin data from the loader
export const useAdmin = (): AdminType => {
  const adminData = useLoaderData() as AdminType
  return adminData
}
