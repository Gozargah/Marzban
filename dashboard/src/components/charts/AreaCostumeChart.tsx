import { Area, AreaChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'
import { useState, useEffect } from 'react'
import { DateRange } from 'react-day-picker'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartConfig, ChartContainer } from '@/components/ui/chart'
import { useTranslation } from 'react-i18next'
import { SystemStats, Period, getNodeStatsPeriodic, NodeStats, NodeRealtimeStats } from '@/service/api'
import { Skeleton } from '@/components/ui/skeleton'
import { TimeRangeSelector } from '@/components/common/TimeRangeSelector'
import { EmptyState } from './EmptyState'
import { Button } from '@/components/ui/button'
import { Clock, History } from 'lucide-react'
import { dateUtils } from '@/utils/dateFormatter'

type DataPoint = {
  time: string
  cpu: number
  ram: number
}

const chartConfig = {
  cpu: {
    label: 'CPU Usage',
    color: 'hsl(210, 100%, 56%)', // Blue
  },
  ram: {
    label: 'RAM Usage',
    color: 'hsl(200, 100%, 70%)', // Light blue/cyan
  },
} satisfies ChartConfig

// Custom gradient definitions for the chart
const gradientDefs = {
  cpu: {
    id: 'cpuGradient',
    color1: 'hsl(210, 100%, 56%)',
    color2: 'rgba(0, 120, 255, 0.2)',
    color3: 'rgba(0, 120, 255, 0.05)',
    color4: 'rgba(0, 120, 255, 0)',
  },
  ram: {
    id: 'ramGradient',
    color1: 'hsl(200, 100%, 70%)',
    color2: 'rgba(0, 200, 255, 0.2)',
    color3: 'rgba(0, 200, 255, 0.05)',
    color4: 'rgba(0, 200, 255, 0)',
  },
}

// Custom tooltip component
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    // Parse the label as a date if possible
    let formattedDate = label
    try {
      const today = new Date()
      // Try to parse label as MM/DD or HH:mm
      if (/\d{2}\/\d{2}/.test(label)) {
        // MM/DD format, treat as past day
        const [month, day] = label.split('/')
        const localDate = new Date(today.getFullYear(), parseInt(month) - 1, parseInt(day), 0, 0, 0)
        formattedDate = localDate.toLocaleString('en-US', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }).replace(',', '')
      } else if (/\d{2}:\d{2}/.test(label)) {
        // HH:mm format, treat as today
        const now = new Date()
        formattedDate = now.toLocaleString('en-US', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }).replace(',', '')
      }
    } catch {}
    return (
      <div dir="ltr" className="bg-background/95 backdrop-blur-sm p-3 rounded-lg border shadow-lg">
        <p className="text-sm font-medium text-muted-foreground"><span dir="ltr">{formattedDate}</span></p>
        <div className="mt-1 space-y-1">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{
                  backgroundColor: entry.color,
                  boxShadow: `0 0 8px ${entry.color}`,
                }}
              />
              <span className="text-sm font-medium capitalize">{entry.name}:</span>
              <span className="text-sm font-bold">{entry.value.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>
    )
  }
  return null
}

interface AreaCostumeChartProps {
  nodeId?: number
  currentStats?: SystemStats | NodeRealtimeStats | null
  realtimeStats?: SystemStats | NodeRealtimeStats
}

// Helper function to determine period
const getPeriodFromDateRange = (range?: DateRange): Period => {
  if (!range?.from || !range?.to) {
    return Period.hour // Default to hour if no range
  }
  const diffTime = Math.abs(range.to.getTime() - range.from.getTime())
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  if (diffDays <= 2) {
    // Up to 2 days, use hourly data
    return Period.hour
  }
  return Period.day // More than 2 days, use daily data
}

// Type guard functions
const isSystemStats = (stats: SystemStats | NodeRealtimeStats): stats is SystemStats => {
  return 'total_user' in stats
}

const isNodeRealtimeStats = (stats: SystemStats | NodeRealtimeStats): stats is NodeRealtimeStats => {
  return 'incoming_bandwidth_speed' in stats
}

export function AreaCostumeChart({ nodeId, currentStats, realtimeStats }: AreaCostumeChartProps) {
  const { t } = useTranslation()
  const [statsHistory, setStatsHistory] = useState<DataPoint[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)
  const [viewMode, setViewMode] = useState<'realtime' | 'historical'>('realtime')

  // Clear stats when node changes
  useEffect(() => {
    setStatsHistory([])
    setDateRange(undefined)
    setViewMode('realtime')
  }, [nodeId])

  // Toggle between real-time and historical view
  const toggleViewMode = () => {
    if (viewMode === 'realtime') {
      setViewMode('historical')
    } else {
      setViewMode('realtime')
      setDateRange(undefined)
      setStatsHistory([])
    }
  }

  // Effect for Real-time Stats
  useEffect(() => {
    if (!realtimeStats || viewMode !== 'realtime') return

    try {
      const now = new Date()
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`

      let cpuUsage = 0
      let ramUsage = 0

      if (isSystemStats(realtimeStats)) {
        // Master server stats
        cpuUsage = Number(realtimeStats.cpu_usage ?? 0)
        const memUsed = Number(realtimeStats.mem_used ?? 0)
        const memTotal = Number(realtimeStats.mem_total ?? 1)
        ramUsage = parseFloat(((memUsed / memTotal) * 100).toFixed(1))
      } else if (isNodeRealtimeStats(realtimeStats)) {
        // Node stats
        cpuUsage = Number(realtimeStats.cpu_usage ?? 0)
        const memUsed = Number(realtimeStats.mem_used ?? 0)
        const memTotal = Number(realtimeStats.mem_total ?? 1)
        ramUsage = parseFloat(((memUsed / memTotal) * 100).toFixed(1))
      }

      setStatsHistory(prev => {
        const newHistory = [
          ...prev,
          {
            time: timeStr,
            cpu: cpuUsage,
            ram: ramUsage,
          },
        ]

        // Improved cleanup logic for real-time data
        const MAX_HISTORY = 120
        const CLEANUP_THRESHOLD = 150

        if (newHistory.length > CLEANUP_THRESHOLD) {
          const cleanedHistory = newHistory.filter((_, index) => {
            if (index >= newHistory.length - 60) return true
            return index % 2 === 0
          })

          if (cleanedHistory.length > MAX_HISTORY) {
            return cleanedHistory.slice(-MAX_HISTORY)
          }

          return cleanedHistory
        }

        return newHistory
      })

      setIsLoading(false)
    } catch (err) {
      setError(err as Error)
      setIsLoading(false)
      console.error('Error processing real-time stats:', err)
    }
  }, [realtimeStats, viewMode])

  // Effect for Historical Stats
  useEffect(() => {
    if (nodeId === undefined || viewMode !== 'historical' || !dateRange?.from || !dateRange?.to) return

    const fetchNodeHistoricalStats = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const period = getPeriodFromDateRange(dateRange)
        const data = await getNodeStatsPeriodic(nodeId, {
          start: dateRange.from!.toISOString(),
          end: dateRange.to!.toISOString(),
          period: period,
        })

        const statsArray = data?.stats

        if (Array.isArray(statsArray)) {
          const formattedData = statsArray.map((point: NodeStats) => {
            const d = dateUtils.toDayjs(point.period_start)
            let timeFormat
            if (period === Period.hour) {
              timeFormat = d.format('HH:mm')
            } else {
              timeFormat = d.format('MM/DD')
            }
            return {
              time: timeFormat,
              cpu: point.cpu_usage_percentage,
              ram: point.mem_usage_percentage,
            }
          })
          setStatsHistory(formattedData)
        } else {
          console.error('Invalid historical stats format received:', data)
          setStatsHistory([])
          setError(new Error('Invalid data format received'))
        }
      } catch (err) {
        setError(err as Error)
        console.error(`Error fetching historical stats for node ${nodeId}:`, err)
        setStatsHistory([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchNodeHistoricalStats()
  }, [nodeId, dateRange, viewMode])

  // --- Header Display Logic ---
  let displayCpuUsage: string | JSX.Element = <Skeleton className="h-5 w-16" />
  let displayRamUsage: string | JSX.Element = <Skeleton className="h-5 w-16" />

  if (currentStats) {
    if (isSystemStats(currentStats)) {
      // Master server stats
      const cpuUsage = Number(currentStats.cpu_usage ?? 0)
      const memUsed = Number(currentStats.mem_used ?? 0)
      const memTotal = Number(currentStats.mem_total ?? 1)
      const ramPercentage = ((memUsed / memTotal) * 100)

      displayCpuUsage = `${cpuUsage.toFixed(1)}%`
      displayRamUsage = `${ramPercentage.toFixed(1)}%`
    } else if (isNodeRealtimeStats(currentStats)) {
      // Node stats
      const cpuUsage = Number(currentStats.cpu_usage ?? 0)
      const memUsed = Number(currentStats.mem_used ?? 0)
      const memTotal = Number(currentStats.mem_total ?? 1)
      const ramPercentage = ((memUsed / memTotal) * 100)

      displayCpuUsage = `${cpuUsage.toFixed(1)}%`
      displayRamUsage = `${ramPercentage.toFixed(1)}%`
    }
  } else if (!isLoading && error) {
    displayCpuUsage = t('error')
    displayRamUsage = t('error')
  }

  return (
    <Card className="flex flex-1 flex-col">
      {/* Header - Mobile First Design */}
      <CardHeader className="flex flex-col space-y-4 p-4 md:p-6">
        {/* Title and Button Row */}
        <div className="flex flex-col space-y-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
          <div className="flex items-center space-x-3">
            <div className="flex items-center gap-x-2">
              {viewMode === 'realtime' ? (
                <Clock className="h-5 w-5 flex-shrink-0" />
              ) : (
                <History className="h-5 w-5 flex-shrink-0" />
              )}
              <CardTitle className="text-lg md:text-xl">
                {viewMode === 'realtime' ? t('statistics.realTimeData') : t('statistics.historicalData')}
              </CardTitle>
            </div>
          </div>

          {/* Toggle Button - Always visible on mobile */}
          {nodeId !== undefined && (
            <Button
              variant={viewMode === 'realtime' ? 'default' : 'outline'}
              size="sm"
              onClick={toggleViewMode}
              className="w-full sm:w-auto h-9 px-4 font-medium"
            >
              {viewMode === 'realtime' ? (
                <>
                  <History className="h-4 w-4 mr-2" />
                  <span>{t('statistics.viewHistorical')}</span>
                </>
              ) : (
                <>
                  <Clock className="h-4 w-4 mr-2" />
                  <span>{t('statistics.viewRealtime')}</span>
                </>
              )}
            </Button>
          )}
        </div>

        {/* Description */}
        <CardDescription className="text-sm text-muted-foreground">
          {viewMode === 'realtime'
            ? t('statistics.realtimeDescription')
            : t('statistics.historicalDescription')
          }
        </CardDescription>

        {/* Stats Display - Responsive Grid */}
        <div className="grid grid-cols-2 gap-4 sm:gap-6 pt-2">
          <div className="flex flex-col items-center space-y-2 p-3 rounded-lg bg-muted/50">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {t('statistics.cpuUsage')}
            </span>
            <span className="text-xl sm:text-2xl font-bold text-foreground">
              {displayCpuUsage}
            </span>
          </div>
          <div className="flex flex-col items-center space-y-2 p-3 rounded-lg bg-muted/50">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {t('statistics.ramUsage')}
            </span>
            <span dir="ltr" className="text-xl sm:text-2xl font-bold text-foreground">
              {displayRamUsage}
            </span>
          </div>
        </div>
      </CardHeader>

      {/* Time Range Selector - Only show in historical mode */}
      {viewMode === 'historical' && nodeId !== undefined && (
        <div className="border-t bg-muted/30 p-4 md:p-6">
          <div className="flex flex-col space-y-4 lg:flex-row lg:items-center lg:justify-between lg:space-y-0">
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-foreground">
                {t('statistics.selectTimeRange')}
              </h4>
              <p className="text-xs text-muted-foreground">
                {t('statistics.selectTimeRangeDescription')}
              </p>
            </div>
            <div className="flex-shrink-0">
              <TimeRangeSelector onRangeChange={setDateRange} />
            </div>
          </div>
        </div>
      )}

      {/* Chart Content */}
      <CardContent className="flex-1 p-4 md:p-6 pt-0">
        {isLoading ? (
          <div className="h-[280px] sm:h-[320px] lg:h-[360px] w-full flex items-center justify-center">
            <Skeleton className="h-full w-full rounded-lg" />
          </div>
        ) : error ? (
          <EmptyState type="error" className="h-[280px] sm:h-[320px] lg:h-[360px]" />
        ) : statsHistory.length === 0 ? (
          <EmptyState
            type="no-data"
            title={viewMode === 'realtime' ? t('statistics.waitingForData') : t('statistics.noDataAvailable')}
            description={viewMode === 'realtime' ? t('statistics.waitingForDataDescription') : t('statistics.selectTimeRangeToView')}
            className="h-[280px] sm:h-[320px] lg:h-[360px]"
          />
        ) : (
          <div className="h-[280px] sm:h-[320px] lg:h-[360px] w-full">
            <ChartContainer dir="ltr" config={chartConfig} className="h-full w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={statsHistory} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <defs>
                    <linearGradient id={gradientDefs.cpu.id} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={gradientDefs.cpu.color1} stopOpacity={0.9} />
                      <stop offset="30%" stopColor={gradientDefs.cpu.color2} stopOpacity={0.4} />
                      <stop offset="70%" stopColor={gradientDefs.cpu.color3} stopOpacity={0.1} />
                      <stop offset="100%" stopColor={gradientDefs.cpu.color4} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id={gradientDefs.ram.id} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={gradientDefs.ram.color1} stopOpacity={0.9} />
                      <stop offset="30%" stopColor={gradientDefs.ram.color2} stopOpacity={0.4} />
                      <stop offset="70%" stopColor={gradientDefs.ram.color3} stopOpacity={0.1} />
                      <stop offset="100%" stopColor={gradientDefs.ram.color4} stopOpacity={0} />
                    </linearGradient>
                  </defs>

                  <CartesianGrid
                    vertical={false}
                    strokeDasharray="4 4"
                    stroke="hsl(var(--border))"
                    opacity={0.1}
                  />

                  <XAxis
                    dataKey="time"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={12}
                    tick={{
                      fill: 'hsl(var(--muted-foreground))',
                      fontSize: 10,
                      fontWeight: 500,
                    }}
                    interval="preserveStartEnd"
                    minTickGap={30}
                  />

                  <YAxis
                    tickLine={false}
                    tickFormatter={value => `${value.toFixed(0)}%`}
                    axisLine={false}
                    tickMargin={2}
                    domain={[0, 100]}
                    tick={{
                      fill: 'hsl(var(--muted-foreground))',
                      fontSize: 9,
                      fontWeight: 500,
                    }}
                    width={32}
                  />

                  <Tooltip
                    content={<CustomTooltip />}
                    cursor={{
                      stroke: 'hsl(var(--border))',
                      strokeWidth: 1,
                      strokeDasharray: '4 4',
                      opacity: 0.3,
                    }}
                  />

                  <Area
                    dataKey="cpu"
                    type="monotone"
                    fill={`url(#${gradientDefs.cpu.id})`}
                    stroke={gradientDefs.cpu.color1}
                    strokeWidth={2}
                    dot={viewMode === 'realtime' ? false : {
                      fill: 'white',
                      stroke: gradientDefs.cpu.color1,
                      strokeWidth: 2,
                      r: 3,
                    }}
                    activeDot={{
                      r: 6,
                      fill: 'white',
                      stroke: gradientDefs.cpu.color1,
                      strokeWidth: 2,
                    }}
                    animationDuration={viewMode === 'realtime' ? 1000 : 2000}
                    animationEasing="ease-in-out"
                  />

                  <Area
                    dataKey="ram"
                    type="monotone"
                    fill={`url(#${gradientDefs.ram.id})`}
                    stroke={gradientDefs.ram.color1}
                    strokeWidth={2}
                    dot={viewMode === 'realtime' ? false : {
                      fill: 'white',
                      stroke: gradientDefs.ram.color1,
                      strokeWidth: 2,
                      r: 3,
                    }}
                    activeDot={{
                      r: 6,
                      fill: 'white',
                      stroke: gradientDefs.ram.color1,
                      strokeWidth: 2,
                    }}
                    animationDuration={viewMode === 'realtime' ? 1000 : 2000}
                    animationEasing="ease-in-out"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
