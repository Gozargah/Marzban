import { AdminDetails, useGetCurrentAdmin } from '@/service/api'
import { useLoaderData } from 'react-router'

export const useAdmin = () => {
  // Get initial admin data from loader
  const initialAdminData = useLoaderData() as AdminDetails

  // Use React Query's useGetCurrentAdmin with proper configuration
  const {
    data: admin,
    isLoading,
    error,
    refetch
  } = useGetCurrentAdmin({
    query: {
      // Use initial data from router loader if available
      initialData: initialAdminData,
      // Only refetch when window regains focus, not on a timer
      refetchOnWindowFocus: true,
      // Cache the data for 5 minutes
      staleTime: 5 * 60 * 1000,
      // Keep the data in cache for 10 minutes
      gcTime: 10 * 60 * 1000,
      // Don't refetch automatically on mount if we have initial data
      refetchOnMount: !initialAdminData,
      // Retry failed requests up to 2 times
      retry: 2,
      // Don't refetch on reconnect if we have fresh data
      refetchOnReconnect: 'always'
    }
  })

  const clearAdmin = () => {
    // This would typically invalidate the query cache
    // but since we're using React Query, we can just refetch
    refetch()
  }

  return {
    admin: admin || null,
    isLoading,
    error: error as Error | null,
    clearAdmin,
  }
}
