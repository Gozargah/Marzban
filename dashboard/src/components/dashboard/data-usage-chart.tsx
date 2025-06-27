import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '../ui/chart'
import { formatBytes } from '@/utils/formatByte'
import { useTranslation } from 'react-i18next'

const chartData = [
  { date: '7/1', traffic: 186 },
  { date: '7/2', traffic: 186 },
  { date: '7/3', traffic: 305 },
  { date: '7/4', traffic: 237 },
  { date: '7/5', traffic: 73 },
  { date: '7/6', traffic: 209 },
  { date: 'Today', traffic: 214 },
]
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

const DataUsageChart = () => {
  const { t } = useTranslation()

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('admins.used.traffic')}</CardTitle>
        <CardDescription>{t('admins.monitor.traffic')}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} dir="ltr">
          <BarChart accessibilityLayer data={chartData}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="date" tickLine={false} tickMargin={10} axisLine={false} />
            <YAxis dataKey={'traffic'} tickLine={false} tickMargin={10} axisLine={false} tickFormatter={val => formatBytes(val, 0, true).toString()} />
            <ChartTooltip cursor={false} content={<CustomTooltip />} />
            <Bar dataKey="traffic" fill="var(--color-traffic)" radius={64} maxBarSize={48} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

export default DataUsageChart
