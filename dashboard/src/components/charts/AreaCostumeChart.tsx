import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { useState, useEffect } from "react"
import {
    Card,
    CardContent,
    CardDescription, CardHeader,
    CardTitle,
} from "@/components/ui/card"
import {
    ChartConfig,
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from "@/components/ui/chart"
import { useTranslation } from "react-i18next";
import useDirDetection from "@/hooks/use-dir-detection";
import { getSystemStats, SystemStats } from "@/service/api"
import { formatBytes } from "@/utils/formatByte"
import { Skeleton } from "@/components/ui/skeleton"

type DataPoint = {
    time: string
    cpu: number
    ram: number
}

const chartConfig = {
    cpu: {
        label: "CPU Usage",
        color: "hsl(var(--chart-1))",
    },
    ram: {
        label: "RAM Usage",
        color: "hsl(var(--chart-2))",
    },
} satisfies ChartConfig

export function AreaCostumeChart() {
    const { t } = useTranslation();
    const dir = useDirDetection();
    const [statsHistory, setStatsHistory] = useState<DataPoint[]>([]);
    const [currentStats, setCurrentStats] = useState<SystemStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    
    // Fetch initial data and set up interval for real-time updates
    useEffect(() => {
        const fetchSystemStats = async () => {
            try {
                const data = await getSystemStats();
                setCurrentStats(data);
                
                // Add to history with timestamp
                const now = new Date();
                const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
                
                setStatsHistory(prev => {
                    const newHistory = [...prev, {
                        time: timeStr,
                        cpu: data.cpu_usage,
                        ram: (data.mem_used / data.mem_total) * 100
                    }];
                    
                    // Limit to last 10 data points for display
                    if (newHistory.length > 10) {
                        return newHistory.slice(newHistory.length - 10);
                    }
                    return newHistory;
                });
                
                setIsLoading(false);
            } catch (err) {
                setError(err as Error);
                setIsLoading(false);
                console.error("Error fetching system stats:", err);
            }
        };
        
        // Fetch immediately
        fetchSystemStats();
        
        // Then set up interval (every 5 seconds)
        const intervalId = setInterval(fetchSystemStats, 5000);
        
        // Clean up interval
        return () => clearInterval(intervalId);
    }, []);

    // Format RAM usage for display
    const ramUsage = currentStats 
        ? formatBytes(currentStats.mem_used) 
        : t("statistics.loading");
    
    const cpuUsage = currentStats 
        ? `${currentStats.cpu_usage}%` 
        : t("statistics.loading");

    return (
        <Card className={"flex flex-1 flex-col"}>
            <CardHeader className="flex flex-col items-stretch space-y-0 border-b p-0 sm:flex-row">
                <div className="flex flex-1 flex-col justify-center gap-1 px-6 py-5 sm:py-6 border-b">
                    <CardTitle>{t("statistics.realTimeStats")}</CardTitle>
                    <CardDescription>
                        {t("statistics.serverPerformance")}
                    </CardDescription>
                </div>
                <div className=" m-0 p-6 flex flex-col justify-center px-4 sm:border-b-0 sm:border-l border-b">
                    <span className="text-muted-foreground text-xs sm:text-sm ">{t("statistics.cpuUsage")}</span>
                    <span className="text-foreground text-lg flex justify-center">
                        {isLoading ? <Skeleton className="h-5 w-16" /> : cpuUsage}
                    </span>
                </div>
                <div className="p-6 m-0 flex flex-col justify-center px-4 sm:border-b-0 sm:border-l">
                    <span className="text-muted-foreground text-xs sm:text-sm">{t("statistics.ramUsage")}</span>
                    <span className="text-foreground text-lg flex justify-center">
                        {isLoading ? <Skeleton className="h-5 w-16" /> : ramUsage}
                    </span>
                </div>
            </CardHeader>
            <CardContent className={"pt-8"}>
                {isLoading ? (
                    <div className="max-h-[360px] min-h-[200px] w-full flex items-center justify-center">
                        <Skeleton className="h-[250px] w-full" />
                    </div>
                ) : error ? (
                    <div className="max-h-[360px] min-h-[200px] w-full flex items-center justify-center text-destructive">
                        {t("errors.failedToLoad")}
                    </div>
                ) : (
                    <ChartContainer dir={dir} config={chartConfig} className={"max-h-[360px] min-h-[200px] w-full"}>
                        <AreaChart
                            accessibilityLayer
                            data={statsHistory}
                            margin={{
                                left: 12,
                                right: 12,
                            }}
                        >
                            <CartesianGrid vertical={false} />
                            <XAxis
                                dataKey="time"
                                tickLine={false}
                                axisLine={false}
                                tickMargin={10}
                            />
                            <YAxis 
                                tickLine={false} 
                                tickFormatter={(value) => `${value}%`} 
                                axisLine={false} 
                                tickMargin={8} 
                                domain={[0, 100]}
                            />
                            <ChartTooltip
                                cursor={false}
                                content={<ChartTooltipContent indicator="dot" />}
                            />
                            <Area
                                dataKey="cpu"
                                type="linear"
                                fill="var(--color-cpu)"
                                stroke="var(--color-cpu)"
                                dot={{
                                    fill: "white",
                                }}
                                activeDot={{
                                    r: 6,
                                }}
                            />
                            <Area
                                dataKey="ram"
                                type="linear"
                                fill="var(--color-ram)"
                                stroke="var(--color-ram)"
                                dot={{
                                    fill: "white",
                                }}
                                activeDot={{
                                    r: 6,
                                }}
                            />
                        </AreaChart>
                    </ChartContainer>
                )}
            </CardContent>
        </Card>
    )
}
