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
    <div className="flex flex-col gap-2 w-full items-start">
      <div className="w-full transform-gpu animate-fade-in" style={{ animationDuration: '400ms' }}>
        <PageHeader title="statistics" description="monitorServers" />
        <Separator />
      </div>

      {/* Node Selector at the top */}
      <div className="w-full px-3 sm:px-4 pt-3 sm:pt-4">
        <div className="transform-gpu animate-slide-up" style={{ animationDuration: '500ms', animationDelay: '50ms', animationFillMode: 'both' }}>
          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="text-base sm:text-lg font-semibold truncate">{t('nodes.title')}</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{t('statistics.selectNodeToView')}</p>
                </div>
                <div className="w-full sm:w-auto sm:min-w-[180px] lg:min-w-[200px]">
                  {isLoadingNodes ? (
                    <Skeleton className="h-9 sm:h-10 w-full" />
                  ) : (
                    <Select value={selectedServer} onValueChange={setSelectedServer}>
                      <SelectTrigger className="w-full h-9 sm:h-10 text-xs sm:text-sm">
                        <SelectValue placeholder={t('selectServer')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="master" className="text-xs sm:text-sm">{t('master')}</SelectItem>
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
        <div className="px-3 sm:px-4 w-full pt-2">
          <div className="transform-gpu animate-slide-up" style={{ animationDuration: '500ms', animationDelay: '100ms', animationFillMode: 'both' }}>
            <Card>
              <CardContent className="p-4 sm:p-6">
                <MainContent 
                  error={error} 
                  isLoading={isLoading} 
                  data={data} 
                  selectedServer={selectedServer}
                  is_sudo={true}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Statistics
