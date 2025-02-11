import PageHeader from '@/components/page-header'
import MainContent from '@/components/statistics/Statistics'
import { Separator } from '@/components/ui/separator'

const Statistics = () => {
  return (
    <div className="flex flex-col gap-2 w-full items-start">
      <PageHeader title="statistics" description="monitorServers" />
      <Separator />
      <div className="px-4 w-full pt-2">
        <MainContent />
      </div>
    </div>
  )
}

export default Statistics
