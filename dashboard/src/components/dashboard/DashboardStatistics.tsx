import useDirDetection from '@/hooks/use-dir-detection'
import { cn } from '@/lib/utils'
import { useGetSystemStats } from '@/service/api'
import { formatBytes, numberWithCommas } from '@/utils/formatByte'
import { CpuIcon, MemoryStickIcon, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardTitle } from '../ui/card'

const CountUp = ({ end, duration = 1500 }: { end: number; duration?: number }) => {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!end) return

    let startTimestamp: number | null = null
    const startValue = count
    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp
      const progress = Math.min((timestamp - startTimestamp) / duration, 1)
      // Using easeOutQuad for a softer animation
      const eased = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2
      const currentCount = Math.floor(eased * (end - startValue) + startValue)

      setCount(currentCount)

      if (progress < 1) {
        window.requestAnimationFrame(step)
      } else {
        setCount(end)
      }
    }

    window.requestAnimationFrame(step)
  }, [end, duration])

  return <>{numberWithCommas(count)}</>
}

const DashboardStatistics = () => {
  const { t } = useTranslation()
  const dir = useDirDetection()
  const [prevData, setPrevData] = useState<any>(null)
  const [isIncreased, setIsIncreased] = useState<Record<string, boolean>>({})

  const { data } = useGetSystemStats(undefined, {
    query: {
      refetchInterval: 5000,
    },
  })

  useEffect(() => {
    if (prevData && data) {
      setIsIncreased({
        cpu_usage: (data.cpu_usage ?? 0) > prevData.cpu_usage,
        mem_usage: (data.mem_used ?? 0) > prevData.mem_used,
        online_users: data.online_users > prevData.online_users,
        inc_bandwidth: (data.incoming_bandwidth ?? 0) > prevData.incoming_bandwidth,
        out_bandwidth: (data.outgoing_bandwidth ?? 0) > prevData.outgoing_bandwidth,
      })
    }
    setPrevData(data)
  }, [data])

  return (
    <div className="flex flex-col gap-y-4">
      <div className={cn('flex flex-col lg:flex-row items-center justify-between gap-x-4 gap-y-4', dir === 'rtl' && 'lg:flex-row-reverse')}>
        {/* Online Users */}
        <div className="w-full animate-fade-in" style={{ animationDuration: '600ms', animationDelay: '50ms' }}>
          <Card dir={dir} className="py-6 px-4 w-full rounded-md transition-all duration-500 overflow-hidden relative group">
            <div
              className={cn(
                'absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent opacity-0 transition-opacity duration-500',
                'dark:from-primary/5 dark:to-transparent',
                'group-hover:opacity-100',
              )}
            />
            <CardTitle className="flex items-center justify-between gap-x-4 relative z-10">
              <div className="flex items-center gap-x-4">
                <CpuIcon className="size-5" />
                <span className="">{t('statistics.cpuUsage')}</span>
              </div>
              <span dir="ltr" className={cn('text-3xl mx-2 transition-all duration-500', isIncreased.online_users ? 'animate-zoom-out' : '')} style={{ animationDuration: '400ms' }}>
                {data ? <CountUp end={data.cpu_usage ?? 0} /> : 0}%
              </span>
            </CardTitle>
          </Card>
        </div>

        <div className="w-full animate-fade-in" style={{ animationDuration: '600ms', animationDelay: '150ms' }}>
          <Card dir={dir} className="py-6 px-4 w-full rounded-md transition-all duration-500 overflow-hidden relative group">
            <div
              className={cn(
                'absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent opacity-0 transition-opacity duration-500',
                'dark:from-primary/5 dark:to-transparent',
                'group-hover:opacity-100',
              )}
            />
            <CardTitle className="flex items-center justify-between gap-x-4 relative z-10">
              <div className="flex items-center gap-x-4">
                <MemoryStickIcon className="size-5" />
                <span className="">{t('statistics.ramUsage')}</span>
              </div>
              <span dir="ltr" className={cn('text-3xl mx-2 transition-all duration-500', isIncreased.active_users ? 'animate-zoom-out' : '')} style={{ animationDuration: '400ms' }}>
                {data ? (
                  <span>
                    <CountUp end={Number(formatBytes(data.mem_used ?? 0, 1, false)) ?? 0} />/{formatBytes(data.mem_total ?? 0, 1, true)}
                  </span>
                ) : (
                  0
                )}
              </span>
            </CardTitle>
          </Card>
        </div>

        <div className="w-full animate-fade-in" style={{ animationDuration: '600ms', animationDelay: '250ms' }}>
          <Card dir={dir} className="py-6 px-4 w-full rounded-md transition-all duration-500 overflow-hidden relative group">
            <div
              className={cn(
                'absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent opacity-0 transition-opacity duration-500',
                'dark:from-primary/5 dark:to-transparent',
                'group-hover:opacity-100',
              )}
            />
            <CardTitle className="flex items-center justify-between gap-x-4 relative z-10">
              <div className="flex items-center gap-x-4">
                <Users className="h-5 w-5" />
                <span className="">{t('statistics.onlineUsers')}</span>
              </div>
              <span className={cn('text-3xl mx-2 transition-all duration-500', isIncreased.total_user ? 'animate-zoom-out' : '')} style={{ animationDuration: '400ms' }}>
                {data ? <CountUp end={data.online_users} /> : 0}
              </span>
            </CardTitle>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default DashboardStatistics
