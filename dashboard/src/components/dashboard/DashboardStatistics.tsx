import useDirDetection from '@/hooks/use-dir-detection'
import { cn } from '@/lib/utils'
import { SystemStats } from '@/service/api'
import { formatBytes, numberWithCommas } from '@/utils/formatByte'
import { CpuIcon, MemoryStickIcon, Users, TrendingUp, TrendingDown } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardTitle, CardContent } from '../ui/card'

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

const DashboardStatistics = ({ systemData }: { systemData: SystemStats | undefined }) => {
  const { t } = useTranslation()
  const dir = useDirDetection()
  const [prevData, setPrevData] = useState<any>(null)
  const [isIncreased, setIsIncreased] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (prevData && systemData) {
      setIsIncreased({
        cpu_usage: (systemData.cpu_usage ?? 0) > prevData.cpu_usage,
        mem_usage: (systemData.mem_used ?? 0) > prevData.mem_used,
        online_users: systemData.online_users > prevData.online_users,
        inc_bandwidth: (systemData.incoming_bandwidth ?? 0) > prevData.incoming_bandwidth,
        out_bandwidth: (systemData.outgoing_bandwidth ?? 0) > prevData.outgoing_bandwidth,
      })
    }
    setPrevData(systemData)
  }, [systemData])

  return (
    <div className="flex flex-col gap-y-4">
      <div className={cn('flex flex-col items-center justify-between gap-x-4 gap-y-4 lg:flex-row', dir === 'rtl' && 'lg:flex-row-reverse')}>
        {/* CPU Usage */}
        <div className="w-full animate-fade-in" style={{ animationDuration: '600ms', animationDelay: '50ms' }}>
          <Card dir={dir} className="group relative w-full overflow-hidden rounded-lg border transition-all duration-300 hover:shadow-lg">
            <div
              className={cn(
                'absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent opacity-0 transition-opacity duration-500',
                'dark:from-primary/5 dark:to-transparent',
                'group-hover:opacity-100',
              )}
            />
            <CardContent className="relative z-10 p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <CpuIcon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{t('statistics.cpuUsage')}</p>
                    <div className="flex items-center gap-2">
                      <span dir="ltr" className={cn('text-2xl font-bold transition-all duration-500', isIncreased.cpu_usage ? 'animate-zoom-out' : '')} style={{ animationDuration: '400ms' }}>
                        {systemData ? <CountUp end={systemData.cpu_usage ?? 0} /> : 0}%
                      </span>
                      {isIncreased.cpu_usage !== undefined && (
                        <div className={cn('flex items-center text-xs', isIncreased.cpu_usage ? 'text-red-500' : 'text-green-500')}>
                          {isIncreased.cpu_usage ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Memory Usage */}
        <div className="w-full animate-fade-in" style={{ animationDuration: '600ms', animationDelay: '150ms' }}>
          <Card dir={dir} className="group relative w-full overflow-hidden rounded-lg border transition-all duration-300 hover:shadow-lg">
            <div
              className={cn(
                'absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent opacity-0 transition-opacity duration-500',
                'dark:from-primary/5 dark:to-transparent',
                'group-hover:opacity-100',
              )}
            />
            <CardContent className="relative z-10 p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <MemoryStickIcon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{t('statistics.ramUsage')}</p>
                    <div className="flex items-center gap-2">
                      <span dir="ltr" className={cn('text-2xl font-bold transition-all duration-500', isIncreased.mem_usage ? 'animate-zoom-out' : '')} style={{ animationDuration: '400ms' }}>
                        {systemData ? (
                          <span>
                            <CountUp end={Number(formatBytes(systemData.mem_used ?? 0, 1, false)) ?? 0} />/{formatBytes(systemData.mem_total ?? 0, 1, true)}
                          </span>
                        ) : (
                          0
                        )}
                      </span>
                      {isIncreased.mem_usage !== undefined && (
                        <div className={cn('flex items-center text-xs', isIncreased.mem_usage ? 'text-red-500' : 'text-green-500')}>
                          {isIncreased.mem_usage ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Online Users */}
        <div className="w-full animate-fade-in" style={{ animationDuration: '600ms', animationDelay: '250ms' }}>
          <Card dir={dir} className="group relative w-full overflow-hidden rounded-lg border transition-all duration-300 hover:shadow-lg">
            <div
              className={cn(
                'absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent opacity-0 transition-opacity duration-500',
                'dark:from-primary/5 dark:to-transparent',
                'group-hover:opacity-100',
              )}
            />
            <CardContent className="relative z-10 p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{t('statistics.onlineUsers')}</p>
                    <div className="flex items-center gap-2">
                      <span className={cn('text-2xl font-bold transition-all duration-500', isIncreased.online_users ? 'animate-zoom-out' : '')} style={{ animationDuration: '400ms' }}>
                        {systemData ? <CountUp end={systemData.online_users} /> : 0}
                      </span>
                      {isIncreased.online_users !== undefined && (
                        <div className={cn('flex items-center text-xs', isIncreased.online_users ? 'text-green-500' : 'text-red-500')}>
                          {isIncreased.online_users ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default DashboardStatistics
