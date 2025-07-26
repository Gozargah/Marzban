import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { Dialog, DialogContent } from '../ui/dialog'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../ui/card'
import { ChartContainer, ChartTooltip, ChartConfig } from '../ui/chart'
import { PieChart, TrendingUp, Calendar } from 'lucide-react'
import TimeSelector from '../charts/TimeSelector'
import { useTranslation } from 'react-i18next'
import { Period, useGetUserUsage, useGetNodes, useGetCurrentAdmin } from '@/service/api'
import { DateRange } from 'react-day-picker'
import { TimeRangeSelector } from '@/components/common/TimeRangeSelector'
import { Button } from '../ui/button'
import { ResponsiveContainer } from 'recharts'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/select'
import { dateUtils } from '@/utils/dateFormatter'
import { TooltipProps } from 'recharts'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Cell } from 'recharts'

// Define allowed period keys
const PERIOD_KEYS = ['1h', '12h', '24h', '3d', '1w'] as const;
type PeriodKey = typeof PERIOD_KEYS[number];

const getPeriodMap = (now: number) => ({
  '1h': { period: Period.minute, start: new Date(now - 60 * 60 * 1000) },
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

// Move this hook to a separate file if reused elsewhere
const useWindowSize = () => {
  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return windowSize;
};

function CustomBarTooltip({ active, payload }: TooltipProps<any, any>) {
  const { t, i18n } = useTranslation()
  if (!active || !payload || !payload.length) return null
  const data = payload[0].payload
  const d = dateUtils.toDayjs(data.local_period_start || data._period_start)
  let formattedDate = d.format('YYYY-MM-DD HH:mm')
  if (i18n.language === 'fa' && typeof window !== 'undefined' && (window as any).Intl && (window as any).Intl.DateTimeFormat) {
    try {
      formattedDate = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
        year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false
      }).format(new Date(data.local_period_start || data._period_start))
    } catch {}
  }
  return (
    <div
      className={`rounded border border-border bg-gradient-to-br from-background to-muted/80 shadow min-w-[160px] text-xs p-2 ${i18n.language === 'fa' ? 'text-right' : 'text-left'}`}
      dir={i18n.language === 'fa' ? 'rtl' : 'ltr'}
    >
      <div className={`mb-1 font-semibold text-xs ${i18n.language === 'fa' ? 'text-right' : 'text-center'}`}>
        {t('statistics.date', { defaultValue: 'Date' })}: {formattedDate}
      </div>
      <div className="flex flex-col gap-0.5 text-xs">
        <div>
          <span className="font-medium text-foreground">{t('statistics.totalUsage', { defaultValue: 'Total Usage' })}:</span>
          <span className={i18n.language === 'fa' ? 'mr-1' : 'ml-1'}>{data.usage} GB</span>
        </div>
      </div>
    </div>
  )
}

const UsageModal = ({ open, onClose, username }: UsageModalProps) => {
  // Memoize now only once per modal open
  const nowRef = useRef<number>(Date.now());
  useEffect(() => {
    if (open) nowRef.current = Date.now();
  }, [open]);

  const [period, setPeriod] = useState<PeriodKey>('1w')
  const [customRange, setCustomRange] = useState<DateRange | undefined>(undefined)
  const [showCustomRange, setShowCustomRange] = useState(false)
  const { t } = useTranslation()
  const { width } = useWindowSize()
  const [selectedNodeId, setSelectedNodeId] = useState<number | undefined>(undefined)

  // Get current admin to check permissions
  const { data: currentAdmin } = useGetCurrentAdmin()
  const is_sudo = currentAdmin?.is_sudo || false

  // Reset node selection for non-sudo admins
  useEffect(() => {
    if (!is_sudo) {
      setSelectedNodeId(undefined) // Non-sudo admins see all nodes (master server data)
    }
  }, [is_sudo])

  // Fetch nodes list - only for sudo admins
  const { data: nodes, isLoading: isLoadingNodes } = useGetNodes(undefined, { 
    query: { 
      enabled: open && is_sudo // Only fetch nodes for sudo admins when modal is open
    } 
  })

  // Memoize periodMap only when modal opens
  const periodMap = useMemo(() => getPeriodMap(nowRef.current), [open]);
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
  
  const userUsageParams = useMemo(() => {
    if (showCustomRange && customRange?.from && customRange?.to) {
      return {
        period: backendPeriod,
        start: start.toISOString(),
        end: dateUtils.toDayjs(customRange.to).endOf('day').toISOString(),
        node_id: selectedNodeId
      }
    }
    return { period: backendPeriod, start: start.toISOString(), node_id: selectedNodeId }
  }, [backendPeriod, start, end, period, customRange, showCustomRange, selectedNodeId])

  // Only fetch when modal is open
  const { data, isLoading } = useGetUserUsage(username, userUsageParams, { query: { enabled: open } })

  // Prepare chart data for BarChart
  const chartData = useMemo(() => {
    if (!data?.stats) return []
    let flatStats: any[] = []
    if (data.stats) {
      if (typeof data.stats === 'object' && !Array.isArray(data.stats)) {
        // Dict format: use nodeId if provided, else '-1', else first key
        const key = selectedNodeId !== undefined ? String(selectedNodeId) : '-1'
        if (data.stats[key] && Array.isArray(data.stats[key])) {
          flatStats = data.stats[key]
        } else {
          const firstKey = Object.keys(data.stats)[0]
          if (firstKey && Array.isArray(data.stats[firstKey])) {
            flatStats = data.stats[firstKey]
          } else {
            flatStats = []
          }
        }
      } else if (Array.isArray(data.stats)) {
        // List format: use node_id === -1, then 0, else first
        let selectedStats = data.stats.find((s: any) => s.node_id === -1)
        if (!selectedStats) selectedStats = data.stats.find((s: any) => s.node_id === 0)
        if (!selectedStats) selectedStats = data.stats[0]
        flatStats = selectedStats?.stats || []
        if (!Array.isArray(flatStats)) flatStats = []
      }
    }
    let filtered = flatStats
    if ((period === '12h' || period === '24h') && !showCustomRange) {
      if (!start || !end) return flatStats.map((point: any) => {
        const dateObj = dateUtils.toDayjs(point.period_start)
        let timeFormat
        if (period === '12h' || period === '24h' || (showCustomRange && backendPeriod === Period.hour)) {
          timeFormat = dateObj.format('HH:mm')
        } else {
          timeFormat = dateObj.format('MM/DD')
        }
        const usageInGB = point.total_traffic / (1024 * 1024 * 1024)
        return {
          time: timeFormat,
          usage: parseFloat(usageInGB.toFixed(2)),
          _period_start: point.period_start,
          local_period_start: dateObj.toISOString(),
        }
      })
      const from = dateUtils.toDayjs(start as Date || new Date(0))
      const to = dateUtils.toDayjs(end as Date || new Date(0))
      filtered = filtered.filter((point: any) => {
        const pointTime = dateUtils.toDayjs(point.period_start)
        return (pointTime.isSame(from) || pointTime.isAfter(from)) &&
               (pointTime.isSame(to) || pointTime.isBefore(to))
      })
    } else if (showCustomRange && customRange?.from && customRange?.to) {
      filtered = filtered.filter((point: any) => {
        if (!customRange.from || !customRange.to) return false;
        const dateObj = dateUtils.toDayjs(point.period_start)
        return dateObj.isAfter(dateUtils.toDayjs(customRange.from).subtract(1, 'minute')) && dateObj.isBefore(dateUtils.toDayjs(customRange.to).add(1, 'minute'))
      })
    }
    return filtered.map((point: any) => {
      const dateObj = dateUtils.toDayjs(point.period_start)
      let timeFormat
      if (period === '12h' || period === '24h' || (showCustomRange && backendPeriod === Period.hour)) {
        timeFormat = dateObj.format('HH:mm')
      } else {
        timeFormat = dateObj.format('MM/DD')
      }
      const usageInGB = point.total_traffic / (1024 * 1024 * 1024)
      return {
        time: timeFormat,
        usage: parseFloat(usageInGB.toFixed(2)),
        _period_start: point.period_start,
        local_period_start: dateObj.toISOString(),
      }
    })
  }, [data, period, showCustomRange, customRange, backendPeriod, start, end, selectedNodeId])

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

  // Handlers
  const handleCustomRangeChange = useCallback((range: DateRange | undefined) => {
    setCustomRange(range);
    if (range?.from && range?.to) {
      setShowCustomRange(true);
      const diffHours = (range.to.getTime() - range.from.getTime()) / (1000 * 60 * 60);
      if (diffHours <= 1) setPeriod('1h');
      else if (diffHours <= 12) setPeriod('12h');
      else if (diffHours <= 24) setPeriod('24h');
      else if (diffHours <= 72) setPeriod('3d');
      else setPeriod('1w');
    }
  }, []);

  const handleTimeSelect = useCallback((newPeriod: PeriodKey) => {
    setPeriod(newPeriod);
    setShowCustomRange(false);
    setCustomRange(undefined);
  }, []);

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
                  aria-label={t('usersTable.selectCustomRange', { defaultValue: 'Select custom range' })}
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
              {/* Node selector - only show for sudo admins */}
              {is_sudo && (
                <div className="flex justify-center items-center gap-2 w-full">
                  <Select
                    value={selectedNodeId?.toString() || 'all'}
                    onValueChange={(value) => setSelectedNodeId(value === 'all' ? undefined : Number(value))}
                    disabled={isLoadingNodes}
                  >
                    <SelectTrigger className="w-full sm:w-[180px]">
                      <SelectValue placeholder={t('userDialog.selectNode', { defaultValue: 'Select Node' })} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('userDialog.allNodes', { defaultValue: 'All Nodes' })}</SelectItem>
                      {nodes?.map((node) => (
                        <SelectItem key={node.id} value={node.id.toString()}>
                          {node.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
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
                  <ResponsiveContainer width="100%" height={width < 500 ? 200 : 320}>
                    <BarChart data={chartData} margin={{ top: 16, right: chartData.length > 7 ? 0 : 8, left: chartData.length > 7 ? 0 : 8, bottom: 8 }} barSize={Math.max(16, Math.min(40, Math.floor(width / (chartData.length * 1.5))))}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <XAxis dataKey="time" tickLine={false} tickMargin={10} axisLine={false} />
                      <YAxis tick={{ fontSize: 12 }} unit="GB" />
                      <ChartTooltip cursor={false} content={<CustomBarTooltip />} />
                      <Bar dataKey="usage" radius={6}>
                        {chartData.map((_: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={'hsl(var(--primary))'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
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