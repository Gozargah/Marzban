import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { Dialog, DialogContent } from '../ui/dialog'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../ui/card'
import { ChartContainer, ChartTooltipContent, ChartTooltip, ChartConfig } from '../ui/chart'
import { PieChart, TrendingUp, Calendar } from 'lucide-react'
import * as RechartsPrimitive from 'recharts'
import TimeSelector from '../charts/TimeSelector'
import { useTranslation } from 'react-i18next'
import { Period, useGetUserUsage, useGetNodes, useGetCurrentAdmin } from '@/service/api'
import { DateRange } from 'react-day-picker'
import { TimeRangeSelector } from '@/components/common/TimeRangeSelector'
import { Button } from '../ui/button'
import { ResponsiveContainer } from 'recharts'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/select'

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

// Add this helper function before UsageModal
const getXAxisInterval = (dataLength: number, width: number) => {
  if (dataLength <= 8) return 0;
  if (width < 500) return Math.ceil(dataLength / 3); // mobile: show 3 labels
  if (width < 900) return Math.ceil(dataLength / 6); // tablet: show 6 labels
  return Math.ceil(dataLength / 10); // desktop: show 10 labels
};

const UsageModal = ({ open, onClose, username }: UsageModalProps) => {
  // Memoize now only once per modal open
  const nowRef = useRef<number>(Date.now());
  useEffect(() => {
    if (open) nowRef.current = Date.now();
  }, [open]);

  const [period, setPeriod] = useState<PeriodKey>('1w')
  const [customRange, setCustomRange] = useState<DateRange | undefined>(undefined)
  const [showCustomRange, setShowCustomRange] = useState(false)
  const { t, i18n } = useTranslation()
  const { width } = useWindowSize()
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
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
      return { period: backendPeriod, start: start.toISOString(), end: end!.toISOString(), node_id: selectedNodeId }
    }
    return { period: backendPeriod, start: start.toISOString(), node_id: selectedNodeId }
  }, [backendPeriod, start, end, period, customRange, showCustomRange, selectedNodeId])

  // Only fetch when modal is open
  const { data, isLoading } = useGetUserUsage(username, userUsageParams, { query: { enabled: open } })

  // Prepare chart data for BarChart
  const chartData = useMemo(() => {
    if (!data?.stats) return []
    // Filter data to only include points within the selected range
    let filtered = data.stats
    if ((period === '12h' || period === '24h') && !showCustomRange) {
      // For 12h/24h, filter to last 12/24 hours
      const now = nowRef.current
      const hours = period === '12h' ? 12 : 24
      const from = new Date(now - hours * 60 * 60 * 1000)
      filtered = filtered.filter((point: any) => new Date(point.period_start) >= from)
    } else if (showCustomRange && customRange?.from && customRange?.to) {
      // For custom range, filter to selected range
      filtered = filtered.filter((point: any) => {
        if (!customRange.from || !customRange.to) return false;
        const d = new Date(point.period_start)
        return d >= customRange.from && d <= customRange.to
      })
    }
    return filtered.map((point: any) => {
      let label = ''
      if (period === '12h' || period === '24h' || (showCustomRange && backendPeriod === Period.hour)) {
        // Show hour label: YYYY-MM-DD HH:00
        const d = new Date(point.period_start)
        label = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:00`
      } else {
        // Show date label: YYYY-MM-DD
        label = point.period_start.slice(0, 10)
      }
      return {
        period: label,
        usage: point.total_traffic / (1024 * 1024 * 1024),
      }
    })
  }, [data, period, showCustomRange, customRange, backendPeriod])

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
                    <RechartsPrimitive.BarChart
                      data={chartData}
                      margin={{ top: 16, right: chartData.length > 7 ? 0 : 8, left: chartData.length > 7 ? 0 : 8, bottom: 8 }}
                      barSize={Math.max(16, Math.min(40, Math.floor(width / (chartData.length * 1.5))))}
                      onMouseMove={(state) => {
                        if (state.activeTooltipIndex !== activeIndex) {
                          setActiveIndex(state.activeTooltipIndex !== undefined ? state.activeTooltipIndex : null);
                        }
                      }}
                      onMouseLeave={() => {
                        setActiveIndex(null);
                      }}
                    >
                      <RechartsPrimitive.CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <RechartsPrimitive.XAxis
                        dataKey="period"
                        tickLine={false}
                        tickMargin={8}
                        axisLine={false}
                        interval={getXAxisInterval(chartData.length, width)}
                        tickFormatter={(value: string) => {
                          if (period === '12h' || period === '24h' || (showCustomRange && backendPeriod === Period.hour)) {
                            // Show only hour part for compactness
                            return value.slice(11, 16)
                          } else {
                            // Show only MM-DD
                            return value.slice(5, 10)
                          }
                        }}
                      />
                      <RechartsPrimitive.YAxis tick={{ fontSize: 12 }} unit="GB" />
                      <ChartTooltip
                        cursor={false}
                        content={
                          <ChartTooltipContent
                            color='hsl(var(--primary))'
                            labelClassName='text-foreground text-center'
                            labelFormatter={(label: string) => {
                              if (i18n.language === 'fa') {
                                const date = new Date(label);
                                if (backendPeriod === Period.hour) {
                                  return date.toLocaleDateString('fa-IR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
                                } else {
                                  return date.toLocaleDateString('fa-IR', { year: 'numeric', month: '2-digit', day: '2-digit' });
                                }
                              } else {
                                return label;
                              }
                            }}
                          />
                        }
                      />
                      <RechartsPrimitive.Bar
                        dataKey="usage"
                        radius={6}
                      >
                        {
                          chartData.map((_: { period: string, usage: number }, index: number) => (
                            <RechartsPrimitive.Cell
                              key={`cell-${index}`}
                              fill={index === activeIndex ? 'hsl(var(--muted-foreground))' : 'hsl(var(--primary))'}
                            />
                          ))
                        }
                        {chartData.length <= 7 && (
                          <RechartsPrimitive.LabelList
                            dataKey="usage"
                            position="top"
                            offset={8}
                            className="fill-foreground"
                            fontSize={12}
                            formatter={(value: number) => value.toFixed(2)}
                          />
                        )}
                      </RechartsPrimitive.Bar>
                    </RechartsPrimitive.BarChart>
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