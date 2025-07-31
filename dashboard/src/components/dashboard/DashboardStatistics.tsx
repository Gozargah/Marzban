import useDirDetection from '@/hooks/use-dir-detection'
import { cn } from '@/lib/utils'
import { SystemStats } from '@/service/api'
import { formatBytes } from '@/utils/formatByte'
import { Cpu, MemoryStick, Database, Users, Upload, Download } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent } from '../ui/card'

const DashboardStatistics = ({ systemData }: { systemData: SystemStats | undefined }) => {
  const { t } = useTranslation()
  const dir = useDirDetection()

  const getTotalTrafficValue = () => {
    if (!systemData) return 0
    
    // For master server stats - use total traffic
    return Number(systemData.incoming_bandwidth) + Number(systemData.outgoing_bandwidth)
  }

  const getIncomingBandwidth = () => {
    if (!systemData) return 0
    return Number(systemData.incoming_bandwidth) || 0
  }

  const getOutgoingBandwidth = () => {
    if (!systemData) return 0
    return Number(systemData.outgoing_bandwidth) || 0
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
    
    // CPU usage is already in percentage (0-100), no need to multiply
    // Just ensure it's within reasonable bounds
    cpuUsage = Math.min(Math.max(cpuUsage, 0), 100)
    
    return { usage: Math.round(cpuUsage * 10) / 10, cores: cpuCores } // Round to 1 decimal place
  }

  const memory = getMemoryUsage()
  const cpu = getCpuInfo()

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
                <span dir="ltr" className="text-xl sm:text-2xl lg:text-3xl font-bold transition-all duration-300 truncate">
                  {cpu.usage}%
                </span>
              </div>
              
              {cpu.cores > 0 && (
                <div className="flex items-center gap-1 text-xs sm:text-sm text-muted-foreground bg-muted/50 px-1.5 sm:px-2 py-1 rounded-md shrink-0">
                  <Cpu className="h-3 w-3" />
                  <span className="font-medium whitespace-nowrap">
                    {cpu.cores} {t('statistics.cores')}
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
              <span dir="ltr" className="text-lg sm:text-xl lg:text-2xl font-bold transition-all duration-300 truncate">
                {systemData ? (
                  <span className="whitespace-nowrap">
                    {formatBytes(memory.used, 1, false)}/{formatBytes(memory.total, 1, true)}
                  </span>
                ) : (
                  0
                )}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Total Traffic with Incoming/Outgoing Details */}
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
            
            <div className="flex items-end justify-between gap-2">
              <div className="flex items-center gap-1 sm:gap-2 min-w-0 flex-1">
                <span dir="ltr" className="text-xl sm:text-2xl lg:text-3xl font-bold transition-all duration-300 truncate">
                  {formatBytes(getTotalTrafficValue() || 0, 1)}
                </span>
              </div>
              
              {/* Incoming/Outgoing Details */}
              <div className="flex items-center gap-2 text-xs shrink-0">
                <div className="flex items-center gap-1 text-green-600 dark:text-green-400 bg-muted/50 px-1.5 py-1 rounded-md">
                  <Download className="h-3 w-3" />
                  <span dir="ltr" className="font-medium">{formatBytes(getIncomingBandwidth() || 0, 1)}</span>
                </div>
                <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400 bg-muted/50 px-1.5 py-1 rounded-md">
                  <Upload className="h-3 w-3" />
                  <span dir="ltr" className="font-medium">{formatBytes(getOutgoingBandwidth() || 0, 1)}</span>
                </div>
              </div>
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
              <span dir="ltr" className="text-xl sm:text-2xl lg:text-3xl font-bold transition-all duration-300">
                {systemData?.online_users || 0}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default DashboardStatistics
