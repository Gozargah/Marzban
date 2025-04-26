import { useEffect, useState, useMemo } from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import TimeSelector, { type TimePeriod } from "./TimeSelector"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { useTranslation } from "react-i18next"
import useDirDetection from "@/hooks/use-dir-detection"
import { getUsage, Period } from "@/service/api"
import { formatBytes } from "@/utils/formatByte"
import { Skeleton } from "@/components/ui/skeleton"

type DataPoint = {
    time: string
    usage: number
}

const chartConfig = {
    usage: {
        label: "Traffic Usage",
        color: "hsl(var(--chart-1))",
    },
} satisfies ChartConfig

const periodMap: Record<TimePeriod, Period> = {
    "12h": "hour",
    "24h": "hour",
    "3d": "day",
    "1w": "day",
    "30d": "day"
};

export function CostumeBarChart() {
    const [selectedTime, setSelectedTime] = useState<TimePeriod>("24h")
    const [chartData, setChartData] = useState<DataPoint[] | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<Error | null>(null)
    const [totalUsage, setTotalUsage] = useState("0")
    
    const { t } = useTranslation()
    const dir = useDirDetection()

    useEffect(() => {
        const fetchUsageData = async () => {
            setIsLoading(true);
            setError(null);
            
            try {
                const now = new Date();
                let startDate = new Date(now);
                
                // Set the start date based on the selected time period
                switch(selectedTime) {
                    case "12h":
                        startDate.setHours(now.getHours() - 12);
                        break;
                    case "24h":
                        startDate.setHours(now.getHours() - 24);
                        break;
                    case "3d":
                        startDate.setDate(now.getDate() - 3);
                        break;
                    case "1w":
                        startDate.setDate(now.getDate() - 7);
                        break;
                    case "30d":
                        startDate.setDate(now.getDate() - 30);
                        break;
                }
                
                const response = await getUsage({
                    period: periodMap[selectedTime],
                    start: startDate.toISOString(),
                    end: now.toISOString()
                });
                
                if (response && response.datapoints) {
                    // Transform data into the format expected by the chart
                    const formattedData = response.datapoints.map(point => {
                        // For hourly data, format as HH:MM
                        // For daily data, format as MM/DD
                        const date = new Date(point.timestamp);
                        
                        let timeFormat;
                        if (periodMap[selectedTime] === "hour") {
                            timeFormat = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
                        } else {
                            timeFormat = `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}`;
                        }
                        
                        // Convert bytes to GB for display
                        const usageInGB = (point.uplink + point.downlink) / (1024 * 1024 * 1024);
                        
                        return {
                            time: timeFormat,
                            usage: parseFloat(usageInGB.toFixed(2))
                        };
                    });
                    
                    setChartData(formattedData);
                    
                    // Calculate total usage
                    const total = response.datapoints.reduce((sum, point) => sum + point.uplink + point.downlink, 0);
                    setTotalUsage(formatBytes(total, 2));
                }
            } catch (err) {
                setError(err as Error);
                console.error("Error fetching usage data:", err);
            } finally {
                setIsLoading(false);
            }
        };
        
        fetchUsageData();
    }, [selectedTime]);

    return (
        <Card>
            <CardHeader className="flex flex-col items-stretch space-y-0 border-b p-0 sm:flex-row">
                <div className="flex flex-1 flex-col sm:flex-row gap-1 px-6 py-6 sm:py-6 border-b">
                    <div className="flex flex-1 flex-col justify-center align-middle gap-1 px-1 py-1">
                        <CardTitle>{t("statistics.trafficUsage")}</CardTitle>
                        <CardDescription>{t("statistics.trafficUsageDescription")}</CardDescription>
                    </div>
                    <div className="px-1 py-1 flex justify-center align-middle flex-col">
                        <TimeSelector selectedTime={selectedTime} setSelectedTime={setSelectedTime} />
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
                    <ChartContainer dir={dir} config={chartConfig} className="max-h-[400px] min-h-[200px] w-full">
                        {chartData && chartData.length > 0 ? (
                            <BarChart accessibilityLayer data={chartData}>
                                <CartesianGrid direction={dir} vertical={false} />
                                <XAxis direction={dir} dataKey="time" tickLine={false} tickMargin={10} axisLine={false} />
                                <YAxis direction={dir} tickLine={false} axisLine={false} />
                                <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                                <Bar dataKey="usage" fill="var(--color-usage)" radius={8} />
                            </BarChart>
                        ) : (
                            <div className="flex items-center justify-center h-full">
                                {t("statistics.noDataAvailable")}
                            </div>
                        )}
                    </ChartContainer>
                )}
            </CardContent>
        </Card>
    )
}