import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { ChartConfig, ChartContainer, ChartTooltip } from '../ui/chart'
import { formatBytes } from '@/utils/formatByte'
import { useTranslation } from 'react-i18next'
import { useGetUsersUsage } from '@/service/api'
import { useMemo } from 'react'
import { SearchXIcon } from 'lucide-react'

const transformUsageData = (apiData: any) => {
  if (!apiData?.stats || !Array.isArray(apiData.stats)) {
    return []
  }

  return apiData.stats.map((stat: any, index: number, array: any[]) => {
    const date = new Date(stat.period_start)
    const isLastItem = index === array.length - 1

    return {
      date: isLastItem ? 'Today' : `${date.getDate()}/${date.getMonth() + 1}`,
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

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    return (
      <div className="rounded-lg border border-border bg-background p-3 shadow-lg">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-sm text-muted-foreground">
          Traffic: <span className="font-medium text-foreground">{formatBytes(data.traffic, 2)}</span>
        </p>
      </div>
    )
  }
  return null
}

const DataUsageChart = ({ admin_username }: { admin_username: string }) => {
  const { t } = useTranslation()

  const { startDate, endDate } = useMemo(() => {
    const start = new Date(new Date().setDate(new Date().getDate() - 7)).toISOString()
    const end = new Date().toISOString()
    return { startDate: start, endDate: end }
  }, [])

  const { data } = useGetUsersUsage(
    {
      admin: [admin_username],
      period: 'day',
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
    return transformUsageData(data)
  }, [data])

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('admins.used.traffic')}</CardTitle>
        <CardDescription>{t('admins.monitor.traffic')}</CardDescription>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="mt-32 flex flex-col items-center justify-center gap-4 text-muted-foreground">
            <SearchXIcon className="size-16" strokeWidth={1} />
            {t('admins.monitor.no_traffic')}
          </div>
        ) : (
          <ChartContainer config={chartConfig} dir="ltr">
            <BarChart accessibilityLayer data={chartData}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="date" tickLine={false} tickMargin={10} axisLine={false} />
              <YAxis dataKey={'traffic'} tickLine={false} tickMargin={10} axisLine={false} tickFormatter={val => formatBytes(val, 0, true).toString()} />
              <ChartTooltip cursor={false} content={<CustomTooltip />} />
              <Bar dataKey="traffic" fill="var(--color-traffic)" radius={64} maxBarSize={48} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}

export default DataUsageChart
