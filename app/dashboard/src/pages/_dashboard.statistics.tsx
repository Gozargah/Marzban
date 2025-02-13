import PageHeader from '@/components/page-header'
import MainContent from '@/components/statistics/Statistics'
import { Separator } from '@/components/ui/separator'
import { getSystemStats } from '@/service/api'
import { useQuery } from '@tanstack/react-query'

const Statistics = () => {
  const { data, error, isLoading } = useQuery({
    queryKey: ["systemStats"],
    queryFn: () => getSystemStats(),
    refetchInterval: 5000
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
