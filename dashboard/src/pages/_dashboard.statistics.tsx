import PageHeader from '@/components/page-header'
import MainContent from '@/components/statistics/Statistics'
import { Separator } from '@/components/ui/separator'
import { getGetSystemStatsQueryKey, getSystemStats } from '@/service/api'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

const Statistics = () => {
  const { t } = useTranslation();
  
  // Use the getSystemStats API with proper query key and refetch interval
  const { data, error, isLoading } = useQuery({
    queryKey: getGetSystemStatsQueryKey(),
    queryFn: () => getSystemStats(),
    refetchInterval: 5000, // Refetch every 5 seconds
    staleTime: 3000,      // Consider data stale after 3 seconds
    refetchOnWindowFocus: true
  });

  return (
    <div className="flex flex-col gap-2 w-full items-start">
      <PageHeader title="statistics" description="monitorServers" />
      <Separator />
      <div className="px-4 w-full pt-2">
        <MainContent error={error} isLoading={isLoading} data={data} />
      </div>
    </div>
  )
}

export default Statistics
