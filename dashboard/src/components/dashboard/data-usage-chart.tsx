import { Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, Cell } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '../ui/card'
import { ChartConfig, ChartContainer, ChartTooltip } from '../ui/chart'
import { formatBytes } from '@/utils/formatByte'
import { useTranslation } from 'react-i18next'
import { useGetUsersUsage, Period } from '@/service/api'
import { useMemo, useState } from 'react'
import { SearchXIcon, TrendingUp, TrendingDown } from 'lucide-react'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/select'

interface PeriodOption {
  label: string
  value: string
  period: Period
  hours?: number
  days?: number
  months?: number
  allTime?: boolean
}

const PERIOD_KEYS = [
  { key: '12h', period: 'hour' as Period, amount: 12, unit: 'hour' },
  { key: '24h', period: 'hour' as Period, amount: 24, unit: 'hour' },
  { key: '3d', period: 'day' as Period, amount: 3, unit: 'day' },
  { key: '7d', period: 'day' as Period, amount: 7, unit: 'day' },
  { key: '30d', period: 'day' as Period, amount: 30, unit: 'day' },
  { key: '3m', period: 'day' as Period, amount: 3, unit: 'month' },
  { key: 'all', period: 'day' as Period, allTime: true },
]

const transformUsageData = (apiData: any, periodOption: any) => {
  if (!apiData?.stats || !Array.isArray(apiData.stats)) {
    return []
  }

  return apiData.stats.map((stat: any, index: number, array: any[]) => {
    // Convert UTC to local time
    const utcDate = new Date(stat.period_start)
    const localDate = new Date(utcDate.getTime() + utcDate.getTimezoneOffset() * 60000)
    const isLastItem = index === array.length - 1

    let displayLabel = ''
    if (periodOption.hours) {
      // For hour periods, show detailed time format
      if (isLastItem) {
        displayLabel = 'Today'
      } else {
        displayLabel = `${localDate.getMonth() + 1}/${localDate.getDate()} ${localDate.getHours().toString().padStart(2, '0')}:00`
      }
    } else {
      // For day periods, show date format
      if (isLastItem) {
        displayLabel = 'Today'
      } else {
        displayLabel = `${localDate.getMonth() + 1}/${localDate.getDate()}`
      }
    }

    return {
      date: displayLabel,
      fullDate: stat.period_start, // Keep original UTC date for API consistency
      localDate: localDate.toISOString(), // Add local date for display
      traffic: stat.total_traffic || 0,
    }
  })
}

const chartConfig = {
  traffic: {
    label: 'traffic',
    color: 'hsl(var(--foreground))',
  },
} satisfies ChartConfig

const DataUsageChart = ({ admin_username }: { admin_username?: string }) => {
  const { t, i18n } = useTranslation()
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const PERIOD_OPTIONS: PeriodOption[] = useMemo(() => [
    ...PERIOD_KEYS.slice(0, 6).map(opt => ({
      label: typeof opt.amount === 'number' ? `${opt.amount} ${t(`time.${opt.unit}${opt.amount > 1 ? 's' : ''}`)}` : '',
      value: opt.key,
      period: opt.period,
      hours: opt.unit === 'hour' && typeof opt.amount === 'number' ? opt.amount : undefined,
      days: opt.unit === 'day' && typeof opt.amount === 'number' ? opt.amount : undefined,
      months: opt.unit === 'month' && typeof opt.amount === 'number' ? opt.amount : undefined,
    })),
    { label: t('alltime', { defaultValue: 'All Time' }), value: 'all', period: 'day', allTime: true },
  ], [t])
  const [periodOption, setPeriodOption] = useState<PeriodOption>(() => PERIOD_OPTIONS[3])

  const { startDate, endDate } = useMemo(() => {
    const now = new Date()
    let start: Date
    if (periodOption.allTime) {
      start = new Date('2000-01-01T00:00:00Z') // Arbitrary early date
    } else if (periodOption.hours) {
      start = new Date(now)
      start.setHours(now.getHours() - periodOption.hours)
    } else if (periodOption.days) {
      start = new Date(now)
      start.setDate(now.getDate() - periodOption.days)
    } else {
      start = new Date(now)
    }
    return { startDate: start.toISOString(), endDate: now.toISOString() }
  }, [periodOption])

  const { data } = useGetUsersUsage(
    {
      ...(admin_username ? { admin: [admin_username] } : {}),
      period: periodOption.period,
      start: startDate,
      end: endDate,
    },
    {
      query: {
        refetchInterval: 1000 * 60 * 5,
      },
    },
  )

  const chartData = useMemo(() => {
    return transformUsageData(data, periodOption)
  }, [data, periodOption])

  // Calculate trend
  const trend = useMemo(() => {
    if (!chartData || chartData.length < 2) return null
    const last = chartData[chartData.length - 1]?.traffic || 0
    const prev = chartData[chartData.length - 2]?.traffic || 0
    if (prev === 0) return null
    const percent = ((last - prev) / prev) * 100
    return percent
  }, [chartData])

  return (
    <Card className="flex flex-col h-full justify-between">
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle>{t('admins.used.traffic', { defaultValue: 'Traffic Usage' })}</CardTitle>
          <CardDescription>{t('admins.monitor.traffic', { defaultValue: 'Monitor admin traffic usage over time' })}</CardDescription>
        </div>
        <Select
          value={periodOption.value}
          onValueChange={val => {
            const found = PERIOD_OPTIONS.find(opt => opt.value === val)
            if (found) setPeriodOption(found)
          }}
        >
          <SelectTrigger className={`w-32 h-8 text-xs${i18n.dir() === 'rtl' ? ' text-right' : ''}`} dir={i18n.dir()}>
            <SelectValue>{periodOption.label}</SelectValue>
          </SelectTrigger>
          <SelectContent dir={i18n.dir()}>
            {PERIOD_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value} className={i18n.dir() === 'rtl' ? 'text-right' : ''}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col justify-center p-2 sm:p-6">
        {chartData.length === 0 ? (
          <div className="mt-16 flex flex-col items-center justify-center gap-4 text-muted-foreground min-h-[200px]">
            <SearchXIcon className="size-16" strokeWidth={1} />
            {t('admins.monitor.no_traffic', { defaultValue: 'No traffic data available' })}
          </div>
        ) : (
          <ChartContainer config={chartConfig} dir="ltr">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart 
                data={chartData}
                margin={{ top: 16, right: 8, left: 8, bottom: 8 }}
                onMouseMove={(state) => {
                  if (state.activeTooltipIndex !== activeIndex) {
                    setActiveIndex(state.activeTooltipIndex !== undefined ? state.activeTooltipIndex : null);
                  }
                }}
                onMouseLeave={() => {
                  setActiveIndex(null);
                }}
              >
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tickLine={false} 
                  tickMargin={10} 
                  axisLine={false}
                  tickFormatter={(_value: string, index: number): string => {
                    // If this is the last bar, show 'Today' (translated)
                    if (periodOption.hours && index === chartData.length - 1) {
                      return i18n.language === 'fa' ? 'امروز' : 'Today';
                    }
                    if (periodOption.hours) {
                      // For hour periods, show only time part for compactness
                      const timePart = chartData[index]?.date?.split(' ')[1];
                      return timePart || chartData[index]?.date;
                    }
                    // For day periods, show date or 'Today' if present
                    if (chartData[index]?.date === 'Today') {
                      return i18n.language === 'fa' ? 'امروز' : 'Today';
                    }
                    return chartData[index]?.date;
                  }}
                />
                <YAxis dataKey={'traffic'} tickLine={false} tickMargin={10} axisLine={false} tickFormatter={val => formatBytes(val, 0, true).toString()} />
                <ChartTooltip 
                  cursor={false} 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      const localDate = data.localDate;
                      const traffic = data.traffic;
                      try {
                        const dateObj = new Date(localDate);
                        let formattedDate = '';
                        if (!isNaN(dateObj.getTime())) {
                          if (i18n.language === 'fa') {
                            if (periodOption.hours) {
                              formattedDate = dateObj.toLocaleDateString('fa-IR', {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit',
                              }) + ' ' + dateObj.toLocaleTimeString('fa-IR', {
                                hour: '2-digit',
                                minute: '2-digit',
                              });
                            } else {
                              formattedDate = dateObj.toLocaleDateString('fa-IR', {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit',
                              });
                            }
                          } else {
                            if (periodOption.hours) {
                              formattedDate = dateObj.toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit',
                              }) + ' ' + dateObj.toLocaleTimeString('en-US', {
                                hour: '2-digit',
                                minute: '2-digit',
                              });
                            } else {
                              formattedDate = dateObj.toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit',
                              });
                            }
                          }
                        } else {
                          formattedDate = data.date;
                        }
                        return (
                          <div className="rounded-lg border border-border bg-background p-3 shadow-lg">
                            <p className="text-sm font-medium text-center">{formattedDate}</p>
                            <p className="text-sm text-muted-foreground">
                              {t('admins.traffic', { defaultValue: 'Traffic' })}: <span className="font-medium text-foreground">{formatBytes(traffic, 2)}</span>
                            </p>
                          </div>
                        );
                      } catch (error) {
                        return null;
                      }
                    }
                    return null;
                  }}
                />
                <Bar dataKey="traffic" radius={6} maxBarSize={48}>
                  {chartData.map((_: any, index: number) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={index === activeIndex ? 'hsl(var(--muted-foreground))' : 'hsl(var(--primary))'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        )}
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm mt-0 pt-2 sm:pt-4">
        {chartData.length > 0 && trend !== null && trend > 0 && (
          <div className="flex gap-2 leading-none font-medium text-green-600 dark:text-green-400">
            {t('usersTable.trendingUp', { defaultValue: 'Trending up by' })} {trend.toFixed(1)}% <TrendingUp className="h-4 w-4" />
          </div>
        )}
        {chartData.length > 0 && trend !== null && trend < 0 && (
          <div className="flex gap-2 leading-none font-medium text-red-600 dark:text-red-400">
            {t('usersTable.trendingDown', { defaultValue: 'Trending down by' })} {Math.abs(trend).toFixed(1)}% <TrendingDown className="h-4 w-4" />
          </div>
        )}
        <div className="text-muted-foreground leading-none">
          {t('statistics.trafficUsageDescription', { defaultValue: 'Total traffic usage across all servers' })}
        </div>
      </CardFooter>
    </Card>
  )
}

export default DataUsageChart
