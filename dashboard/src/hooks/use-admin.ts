import { AdminDetails } from '@/service/api'
import { useLoaderData } from 'react-router'
import { useState, useEffect } from 'react'
import { getCurrentAdmin } from '@/service/api'
import { useToast } from '@/hooks/use-toast'

export const useAdmin = () => {
  const [admin, setAdmin] = useState<AdminDetails | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const { toast } = useToast()

  // Get initial admin data from loader
  const initialAdminData = useLoaderData() as AdminDetails

  useEffect(() => {
    const fetchAdmin = async () => {
      try {
        setIsLoading(true)
        const response = await getCurrentAdmin()
        setAdmin(response)
        setError(null)
      } catch (err) {
        setError(err as Error)
        toast({
          title: 'Error',
          description: 'Failed to fetch admin details',
          variant: 'destructive',
        })
      } finally {
        setIsLoading(false)
      }
    }

    // If we have initial data, use it
    if (initialAdminData) {
      setAdmin(initialAdminData)
      setIsLoading(false)
    } else {
      // Otherwise fetch fresh data
      fetchAdmin()
    }

    // Poll every 30 seconds
    const interval = setInterval(() => {
      fetchAdmin()
    }, 30000)
    return () => clearInterval(interval)
  }, [initialAdminData, toast])

  const clearAdmin = () => {
    setAdmin(null)
  }

  return {
    admin,
    isLoading,
    error,
    clearAdmin,
  }
}
