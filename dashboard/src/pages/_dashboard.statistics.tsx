import PageHeader from '@/components/page-header'
import MainContent from '@/components/statistics/Statistics'
import { Separator } from '@/components/ui/separator'
import { getGetSystemStatsQueryKey, getSystemStats } from '@/service/api'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

const Statistics = () => {
  const [selectedServer, setSelectedServer] = useState<string>("master");
  
  // Use the getSystemStats API with proper query key and refetch interval
  const { data, error, isLoading } = useQuery({
    queryKey: getGetSystemStatsQueryKey(),
    queryFn: () => getSystemStats(),
    refetchInterval: selectedServer === "master" ? 5000 : false, // Only refetch when master is selected
    staleTime: 3000,      // Consider data stale after 3 seconds
    refetchOnWindowFocus: true,
    enabled: selectedServer === "master" // Only fetch when master is selected
  });

  return (
    <div className="flex flex-col gap-2 w-full items-start">
      <PageHeader title="statistics" description="monitorServers" />
      <Separator />
      <div className="px-4 w-full pt-2">
        <MainContent 
          error={error} 
          isLoading={isLoading} 
          data={data} 
          selectedServer={selectedServer}
          onServerChange={setSelectedServer}
        />
      </div>
    </div>
  )
}

export default Statistics
