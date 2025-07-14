import PageHeader from '@/components/page-header'
import MainContent from '@/components/statistics/Statistics'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getGetSystemStatsQueryKey, getSystemStats, useGetNodes, NodeResponse } from '@/service/api'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'

const Statistics = () => {
  const { t } = useTranslation()
  const [selectedServer, setSelectedServer] = useState<string>('master')

  // Fetch nodes for the selector
  const { data: nodesData, isLoading: isLoadingNodes } = useGetNodes(undefined, {
    query: {
      enabled: true,
    },
  })

  // Use the getSystemStats API with proper query key and refetch interval
  const { data, error, isLoading } = useQuery({
    queryKey: getGetSystemStatsQueryKey(),
    queryFn: () => getSystemStats(),
    refetchInterval: selectedServer === 'master' ? 5000 : false, // Only refetch when master is selected
    staleTime: 3000, // Consider data stale after 3 seconds
    refetchOnWindowFocus: true,
    enabled: selectedServer === 'master', // Only fetch when master is selected
  })

  return (
    <div className="flex w-full flex-col items-start gap-2">
      <div className="w-full transform-gpu animate-fade-in" style={{ animationDuration: '400ms' }}>
        <PageHeader title="statistics" description="monitorServers" />
        <Separator />
      </div>

      {/* Node Selector at the top */}
      <div className="w-full px-3 pt-3 sm:px-4 sm:pt-4">
        <div className="transform-gpu animate-slide-up" style={{ animationDuration: '500ms', animationDelay: '50ms', animationFillMode: 'both' }}>
          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center sm:gap-4">
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-base font-semibold sm:text-lg">{t('nodes.title')}</h3>
                  <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">{t('statistics.selectNodeToView')}</p>
                </div>
                <div className="w-full sm:w-auto sm:min-w-[180px] lg:min-w-[200px]">
                  {isLoadingNodes ? (
                    <Skeleton className="h-9 w-full sm:h-10" />
                  ) : (
                    <Select value={selectedServer} onValueChange={setSelectedServer}>
                      <SelectTrigger className="h-9 w-full text-xs sm:h-10 sm:text-sm">
                        <SelectValue placeholder={t('selectServer')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="master" className="text-xs sm:text-sm">
                          {t('master')}
                        </SelectItem>
                        {nodesData
                          ?.filter((node: NodeResponse) => node.status === 'connected')
                          .map((node: NodeResponse) => (
                            <SelectItem key={node.id} value={String(node.id)} className="text-xs sm:text-sm">
                              {node.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="w-full">
        <div className="w-full px-3 pt-2 sm:px-4">
          <div className="transform-gpu animate-slide-up" style={{ animationDuration: '500ms', animationDelay: '100ms', animationFillMode: 'both' }}>
            <MainContent error={error} isLoading={isLoading} data={data} selectedServer={selectedServer} is_sudo={true} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default Statistics
