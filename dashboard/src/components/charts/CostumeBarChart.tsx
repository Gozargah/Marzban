import { useEffect, useState } from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { DateRange } from "react-day-picker"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { useTranslation } from "react-i18next"
import useDirDetection from "@/hooks/use-dir-detection"
import { getUsage, Period, type NodeUsageStat, getNode } from "@/service/api"
import { formatBytes } from "@/utils/formatByte"
import { Skeleton } from "@/components/ui/skeleton"
import { TimeRangeSelector } from "@/components/common/TimeRangeSelector"

type DataPoint = {
    time: string
    usage: number
}

const chartConfig = {
    usage: {
        label: "Traffic Usage (GB)",
        color: "hsl(var(--primary))",
    },
} satisfies ChartConfig

// Define props interface
interface CostumeBarChartProps {
    nodeId?: number;
}

// Helper function to determine period (copied from AreaCostumeChart)
const getPeriodFromDateRange = (range?: DateRange): Period => {
    if (!range?.from || !range?.to) {
        return Period.hour; // Default to hour if no range
    }
    const diffTime = Math.abs(range.to.getTime() - range.from.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 2) { // Up to 2 days, use hourly data
        return Period.hour;
    }
    return Period.day; // More than 2 days, use daily data
};

export function CostumeBarChart({ nodeId }: CostumeBarChartProps) {
    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)
    const [chartData, setChartData] = useState<DataPoint[] | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<Error | null>(null)
    const [totalUsage, setTotalUsage] = useState("0")

    const { t } = useTranslation()
    const dir = useDirDetection()

    useEffect(() => {
        const fetchUsageData = async () => {
            if (!dateRange?.from || !dateRange?.to) {
                setChartData(null)
                setTotalUsage("0")
                return
            }

            setIsLoading(true)
            setError(null)

            try {
                const startDate = dateRange.from
                const endDate = dateRange.to
                // Determine period based on range
                const period = getPeriodFromDateRange(dateRange);

                // Prepare API parameters
                const params: Parameters<typeof getUsage>[0] = {
                    period: period,
                    start: startDate.toISOString(),
                    end: endDate.toISOString(),
                    // Add nodeId if it exists
                    ...(nodeId !== undefined && { node_id: nodeId })
                };

                const response = await getUsage(params);

                if (response && response.stats && response.stats.length > 0) {
                    const formattedData = response.stats.map((point: NodeUsageStat) => {
                        const date = new Date(point.period_start)
                        let timeFormat;
                        // Format time based on determined period
                        if (period === Period.hour) {
                            timeFormat = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
                        } else { // Period.day
                            timeFormat = `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}`;
                        }

                        const usageInGB = (point.uplink + point.downlink) / (1024 * 1024 * 1024)

                        return {
                            time: timeFormat,
                            usage: parseFloat(usageInGB.toFixed(2))
                        }
                    })

                    setChartData(formattedData)

                    const total = response.stats.reduce((sum: number, point: NodeUsageStat) => sum + point.uplink + point.downlink, 0)
                    const formattedTotal = formatBytes(total, 2)
                    if (typeof formattedTotal === 'string') {
                        setTotalUsage(formattedTotal)
                    }
                } else {
                    setChartData(null)
                    setTotalUsage("0")
                }
            } catch (err) {
                setError(err as Error)
                setChartData(null)
                setTotalUsage("0")
                console.error("Error fetching usage data:", err)
            } finally {
                setIsLoading(false)
            }
        }

        fetchUsageData()
    }, [dateRange, nodeId])

    return (
        <Card>
            <CardHeader className="flex flex-col items-stretch space-y-0 border-b p-0 sm:flex-row">
                <div className="flex flex-1 flex-col sm:flex-row gap-1 px-6 py-6 sm:py-6 border-b">
                    <div className="flex flex-1 flex-col justify-center align-middle gap-1 px-1 py-1">
                        <CardTitle>{t("statistics.trafficUsage")}</CardTitle>
                        <CardDescription>{t("statistics.trafficUsageDescription")}</CardDescription>
                    </div>
                    <div className="px-1 py-1 flex justify-center align-middle flex-col">
                        <TimeRangeSelector onRangeChange={setDateRange} />
                    </div>
                </div>
                <div className="sm:border-l p-6 m-0 flex flex-col justify-center px-4 ">
                    <span className="text-muted-foreground text-xs sm:text-sm">{t("statistics.usageDuringPeriod")}</span>
                    <span className="text-foreground text-lg flex justify-center">
                        {isLoading ? <Skeleton className="h-5 w-20" /> : totalUsage}
                    </span>
                </div>
            </CardHeader>
            <CardContent dir={dir} className="pt-8">
                {isLoading ? (
                    <div className="max-h-[400px] min-h-[200px] w-full flex items-center justify-center">
                        <Skeleton className="h-[300px] w-full" />
                    </div>
                ) : error ? (
                    <div className="max-h-[400px] min-h-[200px] w-full flex items-center justify-center text-destructive">
                        {t("errors.failedToLoad")}
                    </div>
                ) : (
                    <ChartContainer dir={"ltr"} config={chartConfig} className="max-h-[400px] min-h-[200px] w-full">
                        {chartData && chartData.length > 0 ? (
                            <BarChart accessibilityLayer data={chartData}>
                                <CartesianGrid direction={"ltr"} vertical={false} />
                                <XAxis direction={"ltr"} dataKey="time" tickLine={false} tickMargin={10} axisLine={false} />
                                <YAxis 
                                    direction={"ltr"} 
                                    tickLine={false} 
                                    axisLine={false}
                                    tickFormatter={(value) => `${value.toFixed(2)} GB`}
                                />
                                <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                                <Bar dataKey="usage" fill="var(--color-usage)" radius={8} />
                            </BarChart>
                        ) : (
                            <div className="flex items-center justify-center h-full text-muted-foreground">
                                {t("statistics.noDataAvailable")}
                            </div>
                        )}
                    </ChartContainer>
                )}
            </CardContent>
        </Card>
    )
}