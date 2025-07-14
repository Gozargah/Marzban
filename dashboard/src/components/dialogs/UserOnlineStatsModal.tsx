import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useTranslation } from 'react-i18next'
import { useUserOnlineStats, useUserOnlineIpList } from '@/service/api'
import { cn } from '@/lib/utils'
import useDirDetection from '@/hooks/use-dir-detection'
import { Users, Search, RefreshCw, Loader2, Activity, Eye, AlertCircle, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import React from 'react'

interface UserOnlineStatsDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  nodeId: number | null
  nodeName?: string
}

interface UserStatsCardProps {
  username: string
  stats: { [key: string]: number }
  nodeId: number
  onViewIPs: (username: string) => void
}

// Memoized UserStatsCard component to prevent unnecessary re-renders
const UserStatsCard = React.memo(({ username, stats, onViewIPs }: UserStatsCardProps) => {
  const { t } = useTranslation()

  // Memoize calculations to avoid recalculating on every render
  const activeProtocols = useMemo(() => {
    return Object.keys(stats).filter(proto => stats[proto] > 0)
  }, [stats])

  const handleViewIPs = useCallback(() => {
    onViewIPs(username)
  }, [onViewIPs, username])

  return (
    <Card className="transition-colors hover:bg-accent/50">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Activity className="h-4 w-4 text-green-500" />
            <span className="break-all" dir="ltr">
              {username}
            </span>
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1">
            {activeProtocols.map(protocol => (
              <Badge key={protocol} variant="outline" className="text-xs">
                <span dir="ltr">{stats[protocol]}</span>
              </Badge>
            ))}
          </div>
          <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:items-center sm:justify-between">
            <Button variant="ghost" size="sm" onClick={handleViewIPs} className="h-6 self-start text-xs sm:self-auto">
              <Eye className="mr-1 h-3 w-3" />
              {t('nodeModal.onlineStats.viewIPs', { defaultValue: 'View IPs' })}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
})

UserStatsCard.displayName = 'UserStatsCard'

// Optimized IP list item component with minimal re-renders
const IPListItem = React.memo(({ ip, timeStrings }: { ip: string; timeStrings: string[] }) => {
  return (
    <div className="rounded bg-accent/40 p-2 transition-colors hover:bg-accent/60">
      <div className="flex flex-col gap-1">
        <span className="break-all font-mono text-sm" dir="ltr">
          {ip}
        </span>
        <div className="flex flex-wrap gap-1">
          {timeStrings.map((timeString, index) => (
            <span key={index} className="rounded bg-muted px-1.5 py-0.5 text-xs" dir="ltr">
              {timeString}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
})

IPListItem.displayName = 'IPListItem'

// Memoized loading component
const LoadingState = React.memo(() => {
  const { t } = useTranslation()
  const dir = useDirDetection()

  return (
    <div className="flex h-32 flex-col items-center justify-center gap-2">
      <Loader2 className="h-6 w-6 animate-spin" />
      <span className="text-sm" dir={dir}>
        {t('loading', { defaultValue: 'Loading...' })}
      </span>
    </div>
  )
})

LoadingState.displayName = 'LoadingState'

// Memoized error component
const ErrorState = React.memo(({ message }: { message: string }) => {
  const dir = useDirDetection()

  return (
    <div className="flex h-32 flex-col items-center justify-center gap-2 px-4 text-center text-muted-foreground">
      <AlertCircle className="h-5 w-5" />
      <span className="text-sm" dir={dir}>
        {message}
      </span>
    </div>
  )
})

ErrorState.displayName = 'ErrorState'

// Memoized empty state component
const EmptyState = React.memo(({ message }: { message: string }) => {
  const dir = useDirDetection()

  return (
    <div className="flex h-32 flex-col items-center justify-center gap-2 px-4 text-center text-muted-foreground">
      <Users className="h-5 w-5" />
      <span className="text-sm" dir={dir}>
        {message}
      </span>
    </div>
  )
})

EmptyState.displayName = 'EmptyState'

export default function UserOnlineStatsModal({ isOpen, onOpenChange, nodeId, nodeName }: UserOnlineStatsDialogProps) {
  const { t } = useTranslation()
  const dir = useDirDetection()
  const [searchTerm, setSearchTerm] = useState('')
  const [specificUsername, setSpecificUsername] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [viewingIPs, setViewingIPs] = useState<string | null>(null)
  const searchTimeoutRef = useRef<NodeJS.Timeout>()

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('')
      setSpecificUsername('')
      setViewingIPs(null)
      setRefreshing(false)

      // Clear any pending search timeout
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [isOpen])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [])

  // Memoize query options to prevent unnecessary re-renders
  const userStatsQueryOptions = useMemo(
    () => ({
      query: {
        enabled: !!(isOpen && nodeId && specificUsername),
        refetchInterval: (query: any) => {
          if (!isOpen || query.state.error) {
            return false
          }
          return 10000 // Increased to 10 seconds to reduce load
        },
      },
    }),
    [isOpen, nodeId, specificUsername],
  )

  const userIPsQueryOptions = useMemo(
    () => ({
      query: {
        enabled: !!(isOpen && nodeId && viewingIPs),
        refetchInterval: (query: any) => {
          if (!isOpen || query.state.error) {
            return false
          }
          return 10000 // Increased to 10 seconds to reduce load
        },
      },
    }),
    [isOpen, nodeId, viewingIPs],
  )

  // Query for specific user stats (when searching for a specific user)
  const { data: userStats, isLoading: isLoadingUserStats, error: userStatsError, refetch: refetchUserStats } = useUserOnlineStats(nodeId || 0, specificUsername, userStatsQueryOptions)

  // Query for user IP list (when viewing IPs)
  const { data: userIPs, error: userIPsError, refetch: refetchIPs } = useUserOnlineIpList(nodeId || 0, viewingIPs || '', userIPsQueryOptions)

  // Memoized error handlers
  const handleUserStatsError = useCallback(
    (error: any) => {
      const errorMessage = error?.message || 'Unknown error occurred'
      if (errorMessage.includes('User not found')) {
        toast.error(
          t('nodeModal.onlineStats.userNotFound', {
            defaultValue: 'User not found or not online',
            username: specificUsername,
          }),
        )
      } else {
        toast.error(
          t('nodeModal.onlineStats.errorLoading', {
            defaultValue: 'Error loading user stats',
            message: errorMessage,
          }),
        )
      }
    },
    [t, specificUsername],
  )

  const handleUserIPsError = useCallback(
    (error: any) => {
      const errorMessage = error?.message || 'Unknown error occurred'
      if (errorMessage.includes('User not found')) {
        toast.error(
          t('nodeModal.onlineStats.userNotFound', {
            defaultValue: 'User not found or not online',
            username: viewingIPs,
          }),
        )
      } else {
        toast.error(
          t('nodeModal.onlineStats.errorLoadingIPs', {
            defaultValue: 'Error loading user IP addresses',
            message: errorMessage,
          }),
        )
      }
    },
    [t, viewingIPs],
  )

  // Handle user stats error
  useEffect(() => {
    if (userStatsError && isOpen) {
      handleUserStatsError(userStatsError)
    }
  }, [userStatsError, isOpen, handleUserStatsError])

  // Handle user IPs error
  useEffect(() => {
    if (userIPsError && isOpen) {
      handleUserIPsError(userIPsError)
    }
  }, [userIPsError, isOpen, handleUserIPsError])

  // Memoized handlers
  const handleSearch = useCallback(() => {
    if (!searchTerm.trim()) {
      toast.error(t('nodeModal.onlineStats.enterUsername', { defaultValue: 'Please enter a username' }))
      return
    }
    setSpecificUsername(searchTerm.trim())
  }, [searchTerm, t])

  // Debounced search to reduce API calls
  const handleSearchInput = useCallback((value: string) => {
    setSearchTerm(value)

    // Clear existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    // Set new timeout for debounced search
    searchTimeoutRef.current = setTimeout(() => {
      if (value.trim()) {
        setSpecificUsername(value.trim())
      }
    }, 500) // 500ms delay
  }, [])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      const promises = []
      if (specificUsername) {
        promises.push(refetchUserStats())
      }
      if (viewingIPs) {
        promises.push(refetchIPs())
      }

      await Promise.all(promises)
      toast.success(t('nodeModal.onlineStats.refreshed', { defaultValue: 'Data refreshed successfully' }))
    } catch (error) {
      toast.error(t('nodeModal.onlineStats.refreshFailed', { defaultValue: 'Failed to refresh data' }))
    } finally {
      setRefreshing(false)
    }
  }, [specificUsername, viewingIPs, refetchUserStats, refetchIPs, t])

  const handleViewIPs = useCallback((username: string) => {
    setViewingIPs(username)
  }, [])

  const handleBackToStats = useCallback(() => {
    setViewingIPs(null)
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleSearch()
      }
    },
    [handleSearch],
  )

  // Memoized data transformations
  const filteredStats = useMemo(() => {
    return userStats && typeof userStats === 'object' ? userStats : {}
  }, [userStats])

  const transformedIPData = useMemo(() => {
    if (!userIPs || typeof userIPs !== 'object') return null

    const transformedData: { [ip: string]: string[] } = {}

    // If userIPs is an array, handle as before
    if (Array.isArray(userIPs)) {
      userIPs.forEach((ipObj: any) => {
        if (typeof ipObj === 'object' && ipObj !== null) {
          Object.entries(ipObj).forEach(([ip, timestamp]) => {
            if (!transformedData[ip]) transformedData[ip] = []
            let tsNum = Number(timestamp)
            if (tsNum < 1e12) tsNum = tsNum * 1000
            const date = new Date(tsNum)
            const timeString = date.toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: false,
            })
            transformedData[ip].push(timeString)
          })
        }
      })
    } else if (typeof userIPs === 'object' && Object.keys(userIPs).length === 1 && !isNaN(Number(Object.keys(userIPs)[0]))) {
      // If userIPs is an object with a single numeric key, use its value
      const onlyKey = Object.keys(userIPs)[0]
      const ipMap = userIPs[onlyKey]
      if (typeof ipMap === 'object' && ipMap !== null) {
        Object.entries(ipMap).forEach(([ip, timestamp]) => {
          if (!transformedData[ip]) transformedData[ip] = []
          let tsNum = Number(timestamp)
          if (tsNum < 1e12) tsNum = tsNum * 1000
          const date = new Date(tsNum)
          const timeString = date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
          })
          transformedData[ip].push(timeString)
        })
      }
    }

    return transformedData
  }, [userIPs])

  // Memoized render functions
  const renderIPList = useCallback(() => {
    if (!transformedIPData) {
      // Show raw data for debugging if transformation failed
      if (userIPs) {
        return (
          <div className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Button variant="ghost" onClick={handleBackToStats} className="mb-2 self-start px-0 text-sm">
                <ArrowLeft className={cn('h-4 w-4', dir === 'rtl' && 'rotate-180')} />
                <span dir={dir}>{t('nodeModal.onlineStats.backToStats', { defaultValue: 'Back to Stats' })}</span>
              </Button>
            </div>
            <ScrollArea className="h-[300px] sm:h-[400px]">
              <div className="p-4">
                <h4 className="mb-2 text-sm font-medium">Raw Data (Debug):</h4>
                <pre className="overflow-auto rounded bg-muted p-2 text-xs">{JSON.stringify(userIPs, null, 2)}</pre>
              </div>
            </ScrollArea>
          </div>
        )
      }
      return null
    }

    // Limit the number of items to prevent memory issues
    const maxItems = 100
    const items = Object.entries(transformedIPData).slice(0, maxItems)
    const hasMore = Object.keys(transformedIPData).length > maxItems

    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Button variant="ghost" onClick={handleBackToStats} className="mb-2 self-start px-0 text-sm">
            <ArrowLeft className={cn('h-4 w-4', dir === 'rtl' && 'rotate-180')} />
            <span dir={dir}>{t('nodeModal.onlineStats.backToStats', { defaultValue: 'Back to Stats' })}</span>
          </Button>
        </div>
        <ScrollArea className="h-[300px] sm:h-[400px]">
          <div className="grid grid-cols-1 gap-2 p-1 lg:grid-cols-2">
            {items.map(([ip, timeStrings]) => (
              <IPListItem key={ip} ip={ip} timeStrings={timeStrings} />
            ))}
          </div>
          {hasMore && (
            <div className="py-2 text-center text-xs text-muted-foreground">
              {t('nodeModal.onlineStats.showingFirst', {
                defaultValue: 'Showing first {{count}} IP addresses',
                count: maxItems,
              })}
            </div>
          )}
        </ScrollArea>
      </div>
    )
  }, [transformedIPData, userIPs, handleBackToStats, dir, t])

  const renderUserStats = useCallback(() => {
    if (isLoadingUserStats) {
      return <LoadingState />
    }

    if (userStatsError) {
      return <ErrorState message={t('nodeModal.onlineStats.errorLoading', { defaultValue: 'Error loading user stats' })} />
    }

    if (!filteredStats || Object.keys(filteredStats).length === 0) {
      const message = specificUsername
        ? t('nodeModal.onlineStats.userNotOnline', { defaultValue: 'User is not online' })
        : t('nodeModal.onlineStats.searchUser', { defaultValue: 'Search for a user to view their online stats' })
      return <EmptyState message={message} />
    }

    return (
      <div className="space-y-3">
        <UserStatsCard username={specificUsername} stats={filteredStats} nodeId={nodeId || 0} onViewIPs={handleViewIPs} />
      </div>
    )
  }, [isLoadingUserStats, userStatsError, filteredStats, specificUsername, nodeId, handleViewIPs, t])

  // Memoized dialog title
  const dialogTitle = useMemo(() => {
    return viewingIPs
      ? t('nodeModal.onlineStats.ipListTitle', {
          defaultValue: 'IP Addresses for {{username}}',
          username: viewingIPs,
        })
      : t('nodeModal.onlineStats.title', { defaultValue: 'Online User Statistics' })
  }, [viewingIPs, t])

  // Memoized search placeholder
  const searchPlaceholder = useMemo(() => {
    return t('nodeModal.onlineStats.searchPlaceholder', {
      defaultValue: 'Enter username to search...',
    })
  }, [t])

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[90vh] max-w-full flex-col sm:h-[600px] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className={cn('flex items-center gap-2 text-xl font-semibold', dir === 'rtl' && 'sm:text-right')}>
            <Activity className="h-5 w-5" />
            <span>{dialogTitle}</span>
          </DialogTitle>
          {nodeName && (
            <p className={cn('text-sm text-muted-foreground', dir === 'rtl' && 'sm:text-right')}>
              {t('nodeModal.onlineStats.nodeInfo', {
                defaultValue: 'Node: {{nodeName}}',
                nodeName,
              })}
            </p>
          )}
        </DialogHeader>

        {/* Search Bar - Only show when not viewing IPs */}
        {!viewingIPs && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="flex-1">
              <Input placeholder={searchPlaceholder} value={searchTerm} onChange={e => handleSearchInput(e.target.value)} onKeyDown={handleKeyDown} className="w-full" dir="ltr" />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSearch} disabled={!searchTerm.trim() || isLoadingUserStats} className="flex-1 sm:flex-none">
                <Search className="h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={handleRefresh} disabled={refreshing || (!specificUsername && !viewingIPs)} className="flex-1 sm:flex-none">
                <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
              </Button>
            </div>
          </div>
        )}

        <Separator />

        {/* Content Area */}
        <div className="flex-1 overflow-hidden">{viewingIPs ? renderIPList() : renderUserStats()}</div>

        {/* Auto-refresh indicator */}
        {(specificUsername || viewingIPs) && (
          <div className="border-t py-2 text-center text-xs text-muted-foreground">
            <Activity className="mr-1 inline h-3 w-3" />
            <span dir={dir}>{t('nodeModal.onlineStats.autoRefresh', { defaultValue: 'Auto-refreshing every 10 seconds' })}</span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
