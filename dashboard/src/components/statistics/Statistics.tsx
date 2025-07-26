import { Skeleton } from '@/components/ui/skeleton'
import { NodeRealtimeStats, SystemStats, useGetNodes, useRealtimeNodeStats } from '@/service/api'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { CostumeBarChart } from '../charts/CostumeBarChart'
import { EmptyState } from '../charts/EmptyState'
import SystemStatisticsSection from './SystemStatisticsSection'
import { lazy, Suspense } from 'react'
import { AllNodesStackedBarChart } from '../charts/AllNodesStackedBarChart'

interface StatisticsProps {
  data?: SystemStats
  isLoading: boolean
  error: any
  selectedServer: string
  is_sudo: boolean
}

export default function Statistics({ data, isLoading, error, selectedServer, is_sudo }: StatisticsProps) {
  const { t } = useTranslation()

  // Only fetch nodes for sudo admins
  const { isLoading: isLoadingNodes, error: nodesError } = useGetNodes(undefined, {
    query: {
      enabled: is_sudo, // Only fetch nodes for sudo admins
    },
  })

  // For non-sudo admins, selectedServer should always be 'master'
  const actualSelectedServer = is_sudo ? selectedServer : 'master'
  const selectedNodeId = actualSelectedServer === 'master' ? undefined : parseInt(actualSelectedServer, 10)

  // Only fetch node stats for sudo admins when a node is selected
  const { data: nodeStats, isLoading: isLoadingNodeStats } = useRealtimeNodeStats(selectedNodeId || 0, {
    query: {
      enabled: is_sudo && !!selectedNodeId, // Only fetch node stats for sudo admins with selected node
      refetchInterval: 5000, // Update every 5 seconds
    },
  })

  // Clear any existing intervals when server selection changes
  useEffect(() => {
    return () => {
      // This cleanup function will run when the component unmounts or when selectedServer changes
      // The query will be automatically disabled when selectedServer changes due to the enabled option
    }
  }, [selectedServer])

  if ((actualSelectedServer === 'master' && isLoading) || (is_sudo && isLoadingNodes) || (is_sudo && selectedNodeId && isLoadingNodeStats)) {
    return <StatisticsSkeletons is_sudo={is_sudo} />
  }

  if (error || (is_sudo && nodesError)) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">{t('statistics.system')}</h2>
            <p className="text-sm">{t('monitorServers')}</p>
          </div>
        </div>
        <EmptyState
          type="error"
          title={t('errors.statisticsLoadFailed')}
          description={error?.message || nodesError?.message || t('errors.connectionFailed')}
          className="min-h-[400px]"
        />
      </div>
    )
  }

  // Get the current stats based on selection
  const currentStats = actualSelectedServer === 'master' ? (data as SystemStats) : (nodeStats as NodeRealtimeStats)

  return (
    <div className="space-y-8">
      {/* System Statistics Section - show for all admins */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">{t('statistics.system')}</h2>
            <p className="text-sm">{t('monitorServers')}</p>
          </div>
        </div>
        <div className="transform-gpu animate-slide-up" style={{ animationDuration: '500ms', animationDelay: '100ms', animationFillMode: 'both' }}>
          <SystemStatisticsSection currentStats={currentStats} />
        </div>
      </div>

      {/* Charts Section - only show for sudo admins */}
      <div className="space-y-8">
        {is_sudo && (
          <div className="transform-gpu animate-slide-up" style={{ animationDuration: '500ms', animationDelay: '200ms', animationFillMode: 'both' }}>
            {actualSelectedServer === 'master' ? (
              <AllNodesStackedBarChart />
            ) : (
              <CostumeBarChart nodeId={selectedNodeId} />
            )}
          </div>
        )}
        <div className="transform-gpu animate-slide-up" style={{ animationDuration: '500ms', animationDelay: '300ms', animationFillMode: 'both' }}>
          <Suspense fallback={<div />}>
            <AreaCostumeChart nodeId={selectedNodeId} currentStats={currentStats} realtimeStats={actualSelectedServer === 'master' ? data : nodeStats || undefined} />
          </Suspense>
        </div>
      </div>
    </div>
  )
}

function StatisticsSkeletons({ is_sudo }: { is_sudo: boolean }) {
  return (
    <div className="space-y-8">
      {/* System Stats Skeleton - show for all admins */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-6 w-[150px] mb-2" />
            <Skeleton className="h-4 w-[200px]" />
          </div>
        </div>
        <div className="flex flex-col items-center justify-between gap-x-4 gap-y-4 lg:flex-row">
          {[1, 2, 3].map(i => (
            <div key={i} className="w-full">
              <div className="group relative w-full overflow-hidden rounded-lg border p-6">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-9 w-9 rounded-lg" />
                  <div>
                    <Skeleton className="h-4 w-[100px] mb-2" />
                    <Skeleton className="h-8 w-[120px]" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Charts Skeleton - only show for sudo admins */}
      {is_sudo && (
        <div className="space-y-8">
          <Skeleton className="h-[400px] w-full" />
          <Skeleton className="h-[360px] w-full" />
        </div>
      )}
    </div>
  )
}

const AreaCostumeChart = lazy(() => import('../charts/AreaCostumeChart').then(m => ({ default: m.AreaCostumeChart })))
