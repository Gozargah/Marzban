import { useEffect, useState } from 'react'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { DateRange } from 'react-day-picker'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { type ChartConfig, ChartContainer, ChartTooltip } from '@/components/ui/chart'
import { useTranslation } from 'react-i18next'
import useDirDetection from '@/hooks/use-dir-detection'
import { getUsage, Period, type NodeUsageStat } from '@/service/api'
import { formatBytes } from '@/utils/formatByte'
import { Skeleton } from '@/components/ui/skeleton'
import { TimeRangeSelector } from '@/components/common/TimeRangeSelector'
import { EmptyState } from './EmptyState'
import { TrendingUp, Upload, Download, Calendar } from 'lucide-react'
import { dateUtils } from '@/utils/dateFormatter'
import { TooltipProps } from 'recharts'
import TimeSelector from './TimeSelector'

type DataPoint = {
  time: string
  usage: number
}

const chartConfig = {
  usage: {
    label: 'Traffic Usage (GB)',
    color: 'hsl(var(--primary))',
  },
} satisfies ChartConfig

// Define props interface
interface CostumeBarChartProps {
  nodeId?: number
}

// Helper function to determine period (copied from AreaCostumeChart)
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

function CustomBarTooltip({ active, payload, period }: TooltipProps<any, any> & { period?: string }) {
  const { t, i18n } = useTranslation()
  if (!active || !payload || !payload.length) return null
  const data = payload[0].payload
  const d = dateUtils.toDayjs(data._period_start)
  const today = dateUtils.toDayjs(new Date())
  const isToday = d.isSame(today, 'day')

  let formattedDate
  if (i18n.language === 'fa') {
    try {
      if (period === 'day' && isToday) {
        formattedDate = new Date().toLocaleString('fa-IR', {
          year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false
        }).replace(',', '')
      } else if (period === 'day') {
        const localDate = new Date(d.year(), d.month(), d.date(), 0, 0, 0)
        formattedDate = localDate.toLocaleString('fa-IR', {
          year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false
        }).replace(',', '')
      } else {
        formattedDate = d.toDate().toLocaleString('fa-IR', {
          year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false
        }).replace(',', '')
      }
    } catch {
      formattedDate = d.format('YYYY/MM/DD HH:mm')
    }
  } else {
    if (period === 'day' && isToday) {
      const now = new Date()
      formattedDate = now.toLocaleString('en-US', {
        year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false
      }).replace(',', '')
    } else if (period === 'day') {
      const localDate = new Date(d.year(), d.month(), d.date(), 0, 0, 0)
      formattedDate = localDate.toLocaleString('en-US', {
        year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false
      }).replace(',', '')
    } else {
      formattedDate = d.toDate().toLocaleString('en-US', {
        year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false
      }).replace(',', '')
    }
  }

  const isRTL = i18n.language === 'fa'

  return (
    <div
      className={`rounded border border-border bg-background shadow min-w-[140px] text-[11px] p-2 ${isRTL ? 'text-right' : 'text-left'}`}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className={`mb-1.5 font-semibold text-[11px] opacity-70 ${isRTL ? 'text-right' : 'text-center'}`}>
        <span dir="ltr" className="inline-block">{formattedDate}</span>
      </div>
      <div className={`mb-1.5 text-muted-foreground text-[11px] ${isRTL ? 'text-right' : 'text-center'}`}>
        <span>{t('statistics.totalUsage', { defaultValue: 'Total' })}: </span>
        <span dir="ltr" className="inline-block font-mono">{data.usage} GB</span>
      </div>
      <div className={`flex flex-col gap-1`}>
        <div className={`flex items-center gap-1 text-muted-foreground text-[10px] ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
          <Upload className="h-3 w-3 flex-shrink-0" />
          <span dir="ltr" className="inline-block font-mono">{formatBytes(data._uplink)}</span>
          <span className={`opacity-60 ${isRTL ? 'mx-1' : 'mx-1'}`}>|</span>
          <Download className="h-3 w-3 flex-shrink-0" />
          <span dir="ltr" className="inline-block font-mono">{formatBytes(data._downlink)}</span>
        </div>
      </div>
    </div>
  )
}

export function CostumeBarChart({ nodeId }: CostumeBarChartProps) {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)
  const [selectedTime, setSelectedTime] = useState<string>('1w')
  const [showCustomRange, setShowCustomRange] = useState(false)
  const [chartData, setChartData] = useState<DataPoint[] | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [totalUsage, setTotalUsage] = useState('0')

  const { t } = useTranslation()
  const dir = useDirDetection()

  useEffect(() => {
    const fetchUsageData = async () => {
      if (!dateRange?.from || !dateRange?.to) {
        setChartData(null)
        setTotalUsage('0')
        return
      }

      setIsLoading(true)
      setError(null)

      try {
        const startDate = dateRange.from
        const endDate = dateRange.to
        // Determine period based on range
        const period = getPeriodFromDateRange(dateRange)

        // Prepare API parameters
        const params: Parameters<typeof getUsage>[0] = {
          period: period,
          start: startDate.toISOString(),
          end: dateUtils.toDayjs(endDate).endOf('day').toISOString(),
          ...(nodeId !== undefined && { node_id: nodeId }),
        }

        const response = await getUsage(params)

        let statsArr: NodeUsageStat[] = []
        if (response && response.stats) {
          if (typeof response.stats === 'object' && !Array.isArray(response.stats)) {
            // If nodeId is provided, use that key
            const key = nodeId !== undefined ? String(nodeId) : '-1'
            if (response.stats[key] && Array.isArray(response.stats[key])) {
              statsArr = response.stats[key]
            } else {
              // fallback: use first available key
              const firstKey = Object.keys(response.stats)[0]
              if (firstKey && Array.isArray(response.stats[firstKey])) {
                statsArr = response.stats[firstKey]
              }
            }
          } else if (Array.isArray(response.stats)) {
            // fallback: old format
            statsArr = response.stats
          }
        }

        if (statsArr.length > 0) {
          const formattedData = statsArr.map((point: NodeUsageStat) => {
            const d = dateUtils.toDayjs(point.period_start)
            let timeFormat
            if (period === Period.hour) {
              timeFormat = d.format('HH:mm')
            } else {
              timeFormat = d.format('MM/DD')
            }
            const usageInGB = (point.uplink + point.downlink) / (1024 * 1024 * 1024)
            return {
              time: timeFormat,
              usage: parseFloat(usageInGB.toFixed(2)),
              _uplink: point.uplink,
              _downlink: point.downlink,
              _period_start: point.period_start,
            }
          })

          setChartData(formattedData)

          const total = statsArr.reduce((sum: number, point: NodeUsageStat) => sum + point.uplink + point.downlink, 0)
          const formattedTotal = formatBytes(total, 2)
          if (typeof formattedTotal === 'string') {
            setTotalUsage(formattedTotal)
          }
        } else {
          setChartData(null)
          setTotalUsage('0')
        }
      } catch (err) {
        setError(err as Error)
        setChartData(null)
        setTotalUsage('0')
        console.error('Error fetching usage data:', err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchUsageData()
  }, [dateRange, nodeId])

  // Add effect to update dateRange when selectedTime changes
  useEffect(() => {
    if (!showCustomRange) {
      const now = new Date()
      let from: Date | undefined
      if (selectedTime === '12h') {
        from = new Date(now.getTime() - 12 * 60 * 60 * 1000)
      } else if (selectedTime === '24h') {
        from = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      } else if (selectedTime === '3d') {
        from = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)
      } else if (selectedTime === '1w') {
        from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      }
      if (from) setDateRange({ from, to: now })
    }
  }, [selectedTime, showCustomRange])

  return (
    <Card>
      <CardHeader className="flex flex-col items-stretch space-y-0 border-b p-0 sm:flex-row">
        <div className="flex flex-1 flex-col sm:flex-row gap-1 px-6 py-6 sm:py-6 border-b">
          <div className="flex flex-1 flex-col justify-center align-middle gap-1 px-1 py-1">
            <CardTitle>{t('statistics.trafficUsage')}</CardTitle>
            <CardDescription>{t('statistics.trafficUsageDescription')}</CardDescription>
          </div>
          <div className="px-1 py-1 flex justify-center align-middle flex-col gap-2">
            <div className="flex gap-2 items-center">
              {showCustomRange ? (
                <TimeRangeSelector onRangeChange={range => { setDateRange(range); setShowCustomRange(true); }} initialRange={dateRange} />
              ) : (
                <TimeSelector selectedTime={selectedTime} setSelectedTime={v => { setSelectedTime(v); setShowCustomRange(false); }} />
              )}
              <button type="button" aria-label="Custom Range" className={`rounded p-1 border ${showCustomRange ? 'bg-muted' : ''}`} onClick={() => setShowCustomRange(v => !v)}>
                <Calendar className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
        <div className="sm:border-l p-6 m-0 flex flex-col justify-center px-4 ">
          <span className="text-muted-foreground text-xs sm:text-sm">{t('statistics.usageDuringPeriod')}</span>
          <span dir='ltr' className="text-foreground text-lg flex justify-center">{isLoading ? <Skeleton className="h-5 w-20" /> : totalUsage}</span>
        </div>
      </CardHeader>
      <CardContent dir={dir} className="pt-8">
        {isLoading ? (
          <div className="max-h-[400px] min-h-[200px] w-full flex items-center justify-center">
            <Skeleton className="h-[300px] w-full" />
          </div>
        ) : error ? (
          <EmptyState type="error" className="max-h-[400px] min-h-[200px]" />
        ) : !dateRange ? (
          <EmptyState 
            type="no-data" 
            title={t('statistics.selectTimeRange')}
            description={t('statistics.selectTimeRangeDescription')}
            icon={<TrendingUp className="h-12 w-12 text-muted-foreground/50" />}
            className="max-h-[400px] min-h-[200px]" 
          />
        ) : (
          <ChartContainer dir={'ltr'} config={chartConfig} className="max-h-[400px] min-h-[200px] w-full">
            {chartData && chartData.length > 0 ? (
              <BarChart accessibilityLayer data={chartData}>
                <CartesianGrid direction={'ltr'} vertical={false} />
                <XAxis direction={'ltr'} dataKey="time" tickLine={false} tickMargin={10} axisLine={false} />
                <YAxis direction={'ltr'} tickLine={false} axisLine={false} tickFormatter={value => `${value.toFixed(2)} GB`} 
                  tick={{
                    fill: 'hsl(var(--muted-foreground))',
                    fontSize: 9,
                    fontWeight: 500,
                  }}
                  width={32}
                  tickMargin={2}
                />
                <ChartTooltip cursor={false} content={<CustomBarTooltip period={getPeriodFromDateRange(dateRange)} />} />
                <Bar dataKey="usage" fill="var(--color-usage)" radius={8} />
              </BarChart>
            ) : (
              <EmptyState 
                type="no-data" 
                title={t('statistics.noDataInRange')}
                description={t('statistics.noDataInRangeDescription')}
                className="max-h-[400px] min-h-[200px]" 
              />
            )}
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
