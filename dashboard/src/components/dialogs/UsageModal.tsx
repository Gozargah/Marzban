import { useState, useMemo, useRef } from 'react'
import { Dialog, DialogContent } from '../ui/dialog'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../ui/card'
import { ChartContainer, ChartTooltipContent, ChartTooltip, ChartConfig } from '../ui/chart'
import { PieChart, TrendingUp, Calendar } from 'lucide-react'
import * as RechartsPrimitive from 'recharts'
import TimeSelector from '../charts/TimeSelector'
import { useTranslation } from 'react-i18next'
import { Period, useGetUserUsage } from '@/service/api'
import { DateRange } from 'react-day-picker'
import { TimeRangeSelector } from '@/components/common/TimeRangeSelector'
import { Button } from '../ui/button'

// Define allowed period keys
const PERIOD_KEYS = ['12h', '24h', '3d', '1w'] as const;
type PeriodKey = typeof PERIOD_KEYS[number];

const getPeriodMap = (now: number) => ({
  '12h': { period: Period.hour, start: new Date(now - 12 * 60 * 60 * 1000) },
  '24h': { period: Period.hour, start: new Date(now - 24 * 60 * 60 * 1000) },
  '3d': { period: Period.day, start: new Date(now - 3 * 24 * 60 * 60 * 1000) },
  '1w': { period: Period.day, start: new Date(now - 7 * 24 * 60 * 60 * 1000) },
});

interface UsageModalProps {
  open: boolean;
  onClose: () => void;
  username: string;
}

const UsageModal = ({ open, onClose, username }: UsageModalProps) => {
  const [period, setPeriod] = useState<PeriodKey>('1w')
  const [customRange, setCustomRange] = useState<DateRange | undefined>(undefined)
  const [showCustomRange, setShowCustomRange] = useState(false)
  const nowRef = useRef(Date.now())
  const { t } = useTranslation()

  // Compute periodMap with custom range
  const periodMap = useMemo(() => getPeriodMap(nowRef.current), [nowRef])
  let backendPeriod: Period;
  let start: Date;
  let end: Date | undefined = undefined;

  if (showCustomRange && customRange?.from && customRange?.to) {
    backendPeriod = Period.day;
    start = customRange.from;
    end = customRange.to;
  } else {
    const map = periodMap[period];
    backendPeriod = map.period;
    start = map.start;
  }
  const params = useMemo(() => {
    if (showCustomRange && customRange?.from && customRange?.to) {
      return { period: backendPeriod, start: start.toISOString(), end: end!.toISOString() }
    }
    return { period: backendPeriod, start: start.toISOString() }
  }, [backendPeriod, start, end, period, customRange, showCustomRange])

  // Only fetch when modal is open
  const { data, isLoading } = useGetUserUsage(username, params, { query: { enabled: open } })

  // Prepare chart data for BarChart
  const chartData = useMemo(() => {
    if (!data?.stats) return []
    return data.stats.map((point: any) => ({
      period: point.period_start.slice(0, 10),
      usage: point.total_traffic / (1024 * 1024 * 1024),
    }))
  }, [data])

  // Calculate trend (simple: compare last and previous usage)
  const trend = useMemo(() => {
    if (!chartData || chartData.length < 2) return null
    const last = chartData[chartData.length - 1].usage
    const prev = chartData[chartData.length - 2].usage
    if (prev === 0) return null
    const percent = ((last - prev) / prev) * 100
    return percent
  }, [chartData])

  // Chart config
  const chartConfig = {
    usage: {
      label: t('userDialog.usage', { defaultValue: 'Usage' }),
      color: 'hsl(var(--primary))',
    },
  } satisfies ChartConfig

  const handleCustomRangeChange = (range: DateRange | undefined) => {
    setCustomRange(range)
    if (range?.from && range?.to) {
      setShowCustomRange(true)
      // Calculate the time difference in hours
      const diffHours = (range.to.getTime() - range.from.getTime()) / (1000 * 60 * 60)
      
      // Update period based on the time range
      if (diffHours <= 12) {
        setPeriod('12h')
      } else if (diffHours <= 24) {
        setPeriod('24h')
      } else if (diffHours <= 72) {
        setPeriod('3d')
      } else {
        setPeriod('1w')
      }
    }
  }

  const handleTimeSelect = (newPeriod: PeriodKey) => {
    setPeriod(newPeriod)
    setShowCustomRange(false)
    setCustomRange(undefined)
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl p-0.5">
        <Card className="w-full border-none shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg sm:text-xl text-center">{t('usersTable.usageChart', { defaultValue: 'Usage Chart' })}</CardTitle>
            <CardDescription className="flex flex-col items-center gap-4 pt-4">
              <div className="flex justify-center items-center gap-2 w-full">
                <TimeSelector selectedTime={period} setSelectedTime={handleTimeSelect as any} />
                <Button
                  variant="ghost"
                  size="icon"
                  className={showCustomRange ? "text-primary" : ""}
                  onClick={() => {
                    setShowCustomRange(!showCustomRange)
                    if (!showCustomRange) {
                      setCustomRange(undefined)
                    }
                  }}
                >
                  <Calendar className="h-4 w-4" />
                </Button>
              </div>
              {showCustomRange && (
                <div className="flex justify-center w-full">
                  <TimeRangeSelector
                    onRangeChange={handleCustomRangeChange}
                    initialRange={customRange}
                    className="w-full sm:w-auto"
                  />
                </div>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent dir='ltr' className="p-0 mb-0">
            <div className="w-full">
              {isLoading ? (
                <div className="flex items-center justify-center h-60 w-full">
                  <div className="animate-pulse w-full h-40 rounded-lg" />
                </div>
              ) : chartData.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-60 text-muted-foreground gap-2">
                  <PieChart className="w-12 h-12 opacity-30" />
                  <div className="text-lg font-medium">{t('usersTable.noUsageData', { defaultValue: 'No usage data available for this period.' })}</div>
                  <div className="text-sm">{t('usersTable.tryDifferentRange', { defaultValue: 'Try a different time range.' })}</div>
                </div>
              ) : (
                <ChartContainer config={chartConfig}>
                  <RechartsPrimitive.BarChart
                    data={chartData}
                    width={undefined}
                    height={320}
                    margin={{ top: 16, right: 8, left: 8, bottom: 8 }}
                    barSize={28}
                  >
                    <RechartsPrimitive.CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <RechartsPrimitive.XAxis
                      dataKey="period"
                      tickLine={false}
                      tickMargin={8}
                      axisLine={false}
                      tickFormatter={(value: string) => value.slice(5)}
                    />
                    <RechartsPrimitive.YAxis tick={{ fontSize: 12 }} unit="GB" />
                    <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                    <RechartsPrimitive.Bar dataKey="usage" fill='hsl(var(--primary))' radius={6}>
                      <RechartsPrimitive.LabelList
                        dataKey="usage"
                        position="top"
                        offset={8}
                        className="fill-foreground"
                        fontSize={12}
                        formatter={(value: number) => value.toFixed(2)}
                      />
                    </RechartsPrimitive.Bar>
                  </RechartsPrimitive.BarChart>
                </ChartContainer>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex-col items-start gap-2 text-xs sm:text-sm mt-0">
            {trend !== null && trend > 0 && (
              <div className="flex gap-2 leading-none font-medium text-green-600 dark:text-green-400">
                {t('usersTable.trendingUp', { defaultValue: 'Trending up by' })} {trend.toFixed(1)}% <TrendingUp className="h-4 w-4" />
              </div>
            )}
            {trend !== null && trend < 0 && (
              <div className="flex gap-2 leading-none font-medium text-red-600 dark:text-red-400">
                {t('usersTable.trendingDown', { defaultValue: 'Trending down by' })} {Math.abs(trend).toFixed(1)}%
              </div>
            )}
            <div className="text-muted-foreground leading-none">
              {t('usersTable.usageSummary', { defaultValue: 'Showing total usage for the selected period.' })}
            </div>
          </CardFooter>
        </Card>
      </DialogContent>
    </Dialog>
  )
}

export default UsageModal 