import useDirDetection from '@/hooks/use-dir-detection'
import { cn } from '@/lib/utils'
import { SystemStats } from '@/service/api'
import { formatBytes } from '@/utils/formatByte'
import { Cpu, MemoryStick, Database, Users, TrendingUp, TrendingDown } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent } from '../ui/card'

const CountUp = ({ end, duration = 1500, suffix = '' }: { end: number; duration?: number; suffix?: string }) => {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!end && end !== 0) return

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

  return <>{count}{suffix}</>
}

const DashboardStatistics = ({ systemData }: { systemData: SystemStats | undefined }) => {
  const { t } = useTranslation()
  const dir = useDirDetection()
  const [prevData, setPrevData] = useState<any>(null)
  const [isIncreased, setIsIncreased] = useState<Record<string, boolean>>({})

  const getTotalTrafficValue = () => {
    if (!systemData) return 0
    
    // For master server stats - use total traffic
    return Number(systemData.incoming_bandwidth) + Number(systemData.outgoing_bandwidth)
  }

  const getMemoryUsage = () => {
    if (!systemData) return { used: 0, total: 0, percentage: 0 }
    
    const memUsed = Number(systemData.mem_used) || 0
    const memTotal = Number(systemData.mem_total) || 0
    const percentage = memTotal > 0 ? (memUsed / memTotal) * 100 : 0
    
    return { used: memUsed, total: memTotal, percentage }
  }

  const getCpuInfo = () => {
    if (!systemData) return { usage: 0, cores: 0 }
    
    let cpuUsage = Number(systemData.cpu_usage) || 0
    const cpuCores = Number(systemData.cpu_cores) || 0
    
    // Fix potential decimal issue - if usage is between 0-1, it's likely a decimal representation
    if (cpuUsage > 0 && cpuUsage <= 1) {
      cpuUsage = cpuUsage * 100
    }
    
    // Ensure CPU usage doesn't exceed 100% and is reasonable
    cpuUsage = Math.min(Math.max(cpuUsage, 0), 100)
    
    return { usage: Math.round(cpuUsage * 10) / 10, cores: cpuCores } // Round to 1 decimal place
  }

  const memory = getMemoryUsage()
  const cpu = getCpuInfo()

  useEffect(() => {
    if (prevData && systemData) {
      setIsIncreased({
        cpu_usage: cpu.usage > prevData.cpu_usage,
        mem_usage: (systemData.mem_used ?? 0) > prevData.mem_used,
        total_traffic: getTotalTrafficValue() > (prevData.total_traffic || 0),
        online_users: systemData.online_users > prevData.online_users,
      })
    }
    setPrevData({
      cpu_usage: cpu.usage,
      mem_used: systemData?.mem_used ?? 0,
      total_traffic: getTotalTrafficValue(),
      online_users: systemData?.online_users ?? 0,
    })
  }, [systemData])

  return (
    <div className={cn(
      'w-full h-full grid gap-3 sm:gap-4 lg:gap-6',
      // Responsive grid: 1 column on mobile, 2 on tablet, 4 on desktop
      'grid-cols-1 sm:grid-cols-2',
      // Ensure equal height for all cards
      'auto-rows-fr',
      dir === 'rtl' && 'lg:grid-flow-col-reverse'
    )}>
      {/* CPU Usage */}
      <div className="w-full h-full animate-fade-in" style={{ animationDuration: '600ms', animationDelay: '50ms' }}>
        <Card dir={dir} className="group relative w-full h-full overflow-hidden rounded-lg border transition-all duration-300 hover:shadow-lg">
          <div
            className={cn(
              'absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent opacity-0 transition-opacity duration-500',
              'dark:from-primary/5 dark:to-transparent',
              'group-hover:opacity-100',
            )}
          />
          <CardContent className="relative z-10 p-4 sm:p-5 lg:p-6 h-full flex flex-col justify-between">
            <div className="flex items-start justify-between mb-2 sm:mb-3">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 rounded-lg bg-primary/10">
                  <Cpu className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground truncate">{t('statistics.cpuUsage')}</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-end justify-between gap-2">
              <div className="flex items-center gap-1 sm:gap-2 min-w-0 flex-1">
                <span dir="ltr" className={cn('text-xl sm:text-2xl lg:text-3xl font-bold transition-all duration-500 truncate', isIncreased.cpu_usage ? 'animate-zoom-out' : '')} style={{ animationDuration: '400ms' }}>
                  <CountUp end={cpu.usage} suffix="%" />
                </span>
                {isIncreased.cpu_usage !== undefined && (
                  <div className={cn('flex items-center text-xs', isIncreased.cpu_usage ? 'text-red-500' : 'text-green-500')}>
                    {isIncreased.cpu_usage ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  </div>
                )}
              </div>
              
              {cpu.cores > 0 && (
                <div className="flex items-center gap-1 text-xs sm:text-sm text-muted-foreground bg-muted/50 px-1.5 sm:px-2 py-1 rounded-md shrink-0">
                  <Cpu className="h-3 w-3" />
                  <span className="font-medium whitespace-nowrap">
                    <CountUp end={cpu.cores} /> {t('statistics.cores')}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Memory Usage */}
      <div className="w-full h-full animate-fade-in" style={{ animationDuration: '600ms', animationDelay: '150ms' }}>
        <Card dir={dir} className="group relative w-full h-full overflow-hidden rounded-lg border transition-all duration-300 hover:shadow-lg">
          <div
            className={cn(
              'absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent opacity-0 transition-opacity duration-500',
              'dark:from-primary/5 dark:to-transparent',
              'group-hover:opacity-100',
            )}
          />
          <CardContent className="relative z-10 p-4 sm:p-5 lg:p-6 h-full flex flex-col justify-between">
            <div className="flex items-start justify-between mb-2 sm:mb-3">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 rounded-lg bg-primary/10">
                  <MemoryStick className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground truncate">{t('statistics.ramUsage')}</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-1 sm:gap-2">
              <span dir="ltr" className={cn('text-lg sm:text-xl lg:text-2xl font-bold transition-all duration-500 truncate', isIncreased.mem_usage ? 'animate-zoom-out' : '')} style={{ animationDuration: '400ms' }}>
                {systemData ? (
                  <span className="whitespace-nowrap">
                    <CountUp end={Number(formatBytes(memory.used, 1, false)) ?? 0} />/{formatBytes(memory.total, 1, true)}
                  </span>
                ) : (
                  0
                )}
              </span>
              {isIncreased.mem_usage !== undefined && (
                <div className={cn('flex items-center text-xs shrink-0', isIncreased.mem_usage ? 'text-red-500' : 'text-green-500')}>
                  {isIncreased.mem_usage ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Total Traffic */}
      <div className="w-full h-full animate-fade-in" style={{ animationDuration: '600ms', animationDelay: '250ms' }}>
        <Card dir={dir} className="group relative w-full h-full overflow-hidden rounded-lg border transition-all duration-300 hover:shadow-lg">
          <div
            className={cn(
              'absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent opacity-0 transition-opacity duration-500',
              'dark:from-primary/5 dark:to-transparent',
              'group-hover:opacity-100',
            )}
          />
          <CardContent className="relative z-10 p-4 sm:p-5 lg:p-6 h-full flex flex-col justify-between">
            <div className="flex items-start justify-between mb-2 sm:mb-3">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 rounded-lg bg-primary/10">
                  <Database className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground truncate">{t('statistics.totalTraffic')}</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-1 sm:gap-2">
              <span dir="ltr" className={cn('text-xl sm:text-2xl lg:text-3xl font-bold transition-all duration-500 truncate', isIncreased.total_traffic ? 'animate-zoom-out' : '')} style={{ animationDuration: '400ms' }}>
                {formatBytes(getTotalTrafficValue() || 0, 1)}
              </span>
              {isIncreased.total_traffic !== undefined && (
                <div className={cn('flex items-center text-xs shrink-0', isIncreased.total_traffic ? 'text-green-500' : 'text-red-500')}>
                  {isIncreased.total_traffic ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Online Users */}
      <div className="w-full h-full animate-fade-in" style={{ animationDuration: '600ms', animationDelay: '350ms' }}>
        <Card dir={dir} className="group relative w-full h-full overflow-hidden rounded-lg border transition-all duration-300 hover:shadow-lg">
          <div
            className={cn(
              'absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent opacity-0 transition-opacity duration-500',
              'dark:from-primary/5 dark:to-transparent',
              'group-hover:opacity-100',
            )}
          />
          <CardContent className="relative z-10 p-4 sm:p-5 lg:p-6 h-full flex flex-col justify-between">
            <div className="flex items-start justify-between mb-2 sm:mb-3">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 rounded-lg bg-primary/10">
                  <Users className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground truncate">{t('statistics.onlineUsers')}</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-1 sm:gap-2">
              <span dir="ltr" className={cn('text-xl sm:text-2xl lg:text-3xl font-bold transition-all duration-500', isIncreased.online_users ? 'animate-zoom-out' : '')} style={{ animationDuration: '400ms' }}>
                <CountUp end={systemData?.online_users || 0} />
              </span>
              {isIncreased.online_users !== undefined && (
                <div className={cn('flex items-center text-xs shrink-0', isIncreased.online_users ? 'text-green-500' : 'text-red-500')}>
                  {isIncreased.online_users ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default DashboardStatistics
