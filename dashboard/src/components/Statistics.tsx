import { Card } from '@/components/ui/card'
import { useGetSystemStats } from '@/service/api'
import { formatBytes, numberWithCommas } from '@/utils/formatByte'
import { BarChart, PieChart, User } from 'lucide-react'
import { FC, PropsWithChildren, ReactElement, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Textarea } from './ui/textarea'

const TotalUsersIcon = User
const NetworkIcon = BarChart
const MemoryIcon = PieChart

type StatisticCardProps = {
  title: string
  content: ReactNode
  icon: ReactElement
}

const StatisticCard: FC<PropsWithChildren<StatisticCardProps>> = ({ title, content, icon }) => {
  return (
    <Card className="p-6 border border-light-border bg-light-gray dark:border-gray-600 dark:bg-gray-750 rounded-lg w-full flex justify-between">
      <div className="flex items-center gap-4">
        <div className="p-2 relative text-white before:content-[''] before:absolute before:top-0 before:left-0 before:bg-primary-400 before:w-full before:h-full before:rounded-[5px] before:opacity-50 after:content-[''] after:absolute after:top-[-5px] after:left-[-5px] after:bg-primary-400 after:w-[calc(100%+10px)] after:h-[calc(100%+10px)] after:rounded-[8px] after:opacity-40">
          {icon}
        </div>
        <Textarea className="text-gray-600 dark:text-gray-300 font-medium text-sm capitalize">{title}</Textarea>
      </div>
      <div className="text-3xl font-semibold mt-2">{content}</div>
    </Card>
  )
}

export const StatisticsQueryKey = ['systemStats']

export const Statistics = () => {
  const { t } = useTranslation()
  const { data: systemData } = useGetSystemStats(undefined, {
    query: {
      refetchInterval: 5000
    }
  })

  return (
    <div className="flex flex-wrap justify-between gap-4">
      <StatisticCard
        title={t('activeUsers')}
        content={
          systemData && (
            <div className="flex items-end">
              <span>{numberWithCommas(systemData.active_users)}</span>
              <span className="font-normal text-lg inline-block pb-[5px]">/ {numberWithCommas(systemData.total_user)}</span>
            </div>
          )
        }
        icon={<TotalUsersIcon className="w-5 h-5" />}
      />
      <StatisticCard title={t('dataUsage')} content={systemData && formatBytes(systemData.incoming_bandwidth + systemData.outgoing_bandwidth)} icon={<NetworkIcon className="w-5 h-5" />} />
      <StatisticCard
        title={t('memoryUsage')}
        content={
          systemData && (
            <div className="flex items-end">
              <span>{formatBytes(systemData?.mem_used ?? 0, 1, true)[0]}</span>
              <span className="font-normal text-lg inline-block pb-[5px]">
                {formatBytes(systemData?.mem_used ?? 0, 1, true)[1]} / {formatBytes(systemData?.mem_total ?? 0, 1)}
              </span>
            </div>
          )
        }
        icon={<MemoryIcon className="w-5 h-5" />}
      />
    </div>
  )
}
