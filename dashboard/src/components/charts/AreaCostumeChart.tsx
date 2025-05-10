import { Area, AreaChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts"
import { useState, useEffect } from "react"
import { DateRange } from "react-day-picker";
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
import { getSystemStats, SystemStats, Period, getNodeStatsPeriodic, NodeStats, NodeRealtimeStats } from "@/service/api"
import { formatBytes } from "@/utils/formatByte"
import { Skeleton } from "@/components/ui/skeleton"
import { TimeRangeSelector } from "@/components/common/TimeRangeSelector";
import { cn } from "@/lib/utils";

type DataPoint = {
    time: string
    cpu: number
    ram: number
}

const chartConfig = {
    cpu: {
        label: "CPU Usage",
        color: "hsl(210, 100%, 56%)", // Blue
    },
    ram: {
        label: "RAM Usage",
        color: "hsl(200, 100%, 70%)", // Light blue/cyan
    },
} satisfies ChartConfig

// Custom gradient definitions for the chart
const gradientDefs = {
    cpu: {
        id: 'cpuGradient',
        color1: 'hsl(210, 100%, 56%)',
        color2: 'rgba(0, 120, 255, 0.2)',
        color3: 'rgba(0, 120, 255, 0.05)',
        color4: 'rgba(0, 120, 255, 0)',
    },
    ram: {
        id: 'ramGradient',
        color1: 'hsl(200, 100%, 70%)',
        color2: 'rgba(0, 200, 255, 0.2)',
        color3: 'rgba(0, 200, 255, 0.05)',
        color4: 'rgba(0, 200, 255, 0)',
    },
};

// Custom tooltip component
const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div dir="ltr" className="bg-background/95 backdrop-blur-sm p-3 rounded-lg border shadow-lg">
                <p className="text-sm font-medium text-muted-foreground">{label}</p>
                <div className="mt-1 space-y-1">
                    {payload.map((entry: any, index: number) => (
                        <div key={index} className="flex items-center gap-2">
                            <div
                                className="w-3 h-3 rounded-full"
                                style={{
                                    backgroundColor: entry.color,
                                    boxShadow: `0 0 8px ${entry.color}`,
                                }}
                            />
                            <span className="text-sm font-medium capitalize">{entry.name}:</span>
                            <span className="text-sm font-bold">{entry.value.toFixed(1)}%</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    }
    return null;
};

interface AreaCostumeChartProps {
    nodeId?: number;
    currentStats?: SystemStats | NodeRealtimeStats | null;
    realtimeStats?: SystemStats | NodeRealtimeStats;
}

// Helper function to determine period
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

export function AreaCostumeChart({ nodeId, currentStats, realtimeStats }: AreaCostumeChartProps) {
    const { t } = useTranslation();
    const dir = useDirDetection();
    const [statsHistory, setStatsHistory] = useState<DataPoint[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

    // Clear stats when node changes
    useEffect(() => {
        setStatsHistory([]);
        setDateRange(undefined);
        console.log("nodeId", nodeId);
    }, [nodeId]);

    // Effect for Real-time Stats
    useEffect(() => {
        if (!realtimeStats) return;

        try {
            const now = new Date();
            const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

            let cpuUsage = 0;
            let ramUsage = 0;

            if ('cpu_usage' in realtimeStats) {
                // Master server stats
                cpuUsage = realtimeStats.cpu_usage;
                ramUsage = parseFloat(((Number(realtimeStats.mem_used) / Number(realtimeStats.mem_total)) * 100).toFixed(1));
            } else {
                // Node stats
                const nodeStats = realtimeStats as NodeRealtimeStats;
                cpuUsage = nodeStats.cpu_usage;
                ramUsage = parseFloat(((Number(nodeStats.mem_used) / Number(nodeStats.mem_total)) * 100).toFixed(1));
            }

            setStatsHistory(prev => {
                const newHistory = [...prev, {
                    time: timeStr,
                    cpu: cpuUsage,
                    ram: ramUsage
                }];

                // Keep last 60 points (5 minutes with 5-second interval)
                const MAX_HISTORY = 60;
                if (newHistory.length > MAX_HISTORY) {
                    return newHistory.slice(newHistory.length - MAX_HISTORY);
                }
                return newHistory;
            });

            setIsLoading(false);
        } catch (err) {
            setError(err as Error);
            setIsLoading(false);
            console.error("Error processing real-time stats:", err);
        }
    }, [realtimeStats]);

    // Effect for Historical Stats
    useEffect(() => {
        if (nodeId === undefined || !dateRange?.from || !dateRange?.to) return;

        const fetchNodeHistoricalStats = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const period = getPeriodFromDateRange(dateRange);
                const data = await getNodeStatsPeriodic(nodeId, {
                    start: dateRange.from!.toISOString(),
                    end: dateRange.to!.toISOString(),
                    period: period
                });

                const statsArray = data?.stats;

                if (Array.isArray(statsArray)) {
                    const formattedData = statsArray.map((point: NodeStats) => {
                        const date = new Date(point.period_start);
                        let timeFormat;
                        if (period === Period.hour) {
                            timeFormat = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
                        } else {
                            timeFormat = `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}`;
                        }
                        return {
                            time: timeFormat,
                            cpu: point.cpu_usage_percentage,
                            ram: point.mem_usage_percentage
                        };
                    });
                    setStatsHistory(formattedData);
                } else {
                    console.error("Invalid historical stats format received:", data);
                    setStatsHistory([]);
                    setError(new Error("Invalid data format received"));
                }

            } catch (err) {
                setError(err as Error);
                console.error(`Error fetching historical stats for node ${nodeId}:`, err);
                setStatsHistory([]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchNodeHistoricalStats();
    }, [nodeId, dateRange]);

    // --- Header Display Logic --- 
    let displayCpuUsage: string | JSX.Element = <Skeleton className="h-5 w-16" />;
    let displayRamUsage: string | JSX.Element = <Skeleton className="h-5 w-16" />;

    if (currentStats) {
        if ('cpu_usage' in currentStats) {
            // Master server stats
            displayCpuUsage = `${currentStats.cpu_usage.toFixed(1)}%`;
            displayRamUsage = `${((Number(currentStats.mem_used) / Number(currentStats.mem_total)) * 100).toFixed(1)}%`;
        } else {
            // Node stats
            const nodeStats = currentStats as NodeRealtimeStats;
            displayCpuUsage = `${nodeStats.cpu_usage.toFixed(1)}%`;
            displayRamUsage = `${((Number(nodeStats.mem_used) / Number(nodeStats.mem_total)) * 100).toFixed(1)}%`;
        }
    } else if (!isLoading && error) {
        displayCpuUsage = t("common.error");
        displayRamUsage = t("common.error");
    }

    return (
        <Card className={"flex flex-1 flex-col"}>
            <CardHeader className="flex flex-col items-stretch space-y-0 border-b p-0 sm:flex-row">
                <div className="flex flex-1 flex-col justify-center gap-1 px-6 py-5 sm:py-6 border-b">
                    <div className="flex items-center justify-between">
                        <CardTitle>{t("statistics.realTimeStats")}</CardTitle>
                        <div className={cn(nodeId === undefined && "hidden")}>
                            <TimeRangeSelector onRangeChange={setDateRange} />
                        </div>
                    </div>
                    <CardDescription>
                        {t("statistics.serverPerformance")}
                    </CardDescription>
                </div>
                <div className=" m-0 p-6 flex flex-col justify-center px-4 sm:border-b-0 sm:border-l border-b">
                    <span className="text-muted-foreground text-xs sm:text-sm ">{t("statistics.cpuUsage")}</span>
                    <span className="text-foreground text-lg flex justify-center">
                        {displayCpuUsage}
                    </span>
                </div>
                <div className="p-6 m-0 flex flex-col justify-center px-4 sm:border-b-0 sm:border-l">
                    <span className="text-muted-foreground text-xs sm:text-sm">{t("statistics.ramUsage")}</span>
                    <span dir="ltr" className="text-foreground text-lg flex justify-center">
                        {displayRamUsage}
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
                    <ChartContainer dir={"ltr"} config={chartConfig} className={"max-h-[360px] min-h-[200px] w-full"}>
                        <AreaChart
                            accessibilityLayer
                            data={statsHistory}
                            
                        >
                            <defs>
                                <linearGradient id={gradientDefs.cpu.id} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={gradientDefs.cpu.color1} stopOpacity={0.9} />
                                    <stop offset="30%" stopColor={gradientDefs.cpu.color2} stopOpacity={0.4} />
                                    <stop offset="70%" stopColor={gradientDefs.cpu.color3} stopOpacity={0.1} />
                                    <stop offset="100%" stopColor={gradientDefs.cpu.color4} stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id={gradientDefs.ram.id} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={gradientDefs.ram.color1} stopOpacity={0.9} />
                                    <stop offset="30%" stopColor={gradientDefs.ram.color2} stopOpacity={0.4} />
                                    <stop offset="70%" stopColor={gradientDefs.ram.color3} stopOpacity={0.1} />
                                    <stop offset="100%" stopColor={gradientDefs.ram.color4} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid
                                vertical={false}
                                strokeDasharray="4 4"
                                stroke="hsl(var(--border))"
                                opacity={0.1}
                            />
                            <XAxis
                                dataKey="time"
                                tickLine={false}
                                axisLine={false}
                                tickMargin={12}
                                tick={{
                                    fill: 'hsl(var(--muted-foreground))',
                                    fontSize: 11,
                                    fontWeight: 500,
                                }}
                                padding={{ left: 20, right: 20 }}
                            />
                            <YAxis
                                tickLine={false}
                                tickFormatter={(value) => `${value.toFixed(1)}%`}
                                axisLine={false}
                                tickMargin={16}
                                domain={[0, 100]}
                                tick={{
                                    fill: 'hsl(var(--muted-foreground))',
                                    fontSize: 11,
                                    fontWeight: 500,
                                }}
                                padding={{ top: 20, bottom: 20 }}
                            />
                            <Tooltip
                                content={<CustomTooltip />}
                                cursor={{
                                    stroke: 'hsl(var(--border))',
                                    strokeWidth: 1,
                                    strokeDasharray: '4 4',
                                    opacity: 0.3,
                                }}
                            />
                            <Area
                                dataKey="cpu"
                                type="monotone"
                                fill={`url(#${gradientDefs.cpu.id})`}
                                stroke={gradientDefs.cpu.color1}
                                strokeWidth={3}
                                dot={{
                                    fill: "white",
                                    stroke: gradientDefs.cpu.color1,
                                    strokeWidth: 2,
                                    r: 4,
                                }}
                                activeDot={{
                                    r: 8,
                                    fill: "white",
                                    stroke: gradientDefs.cpu.color1,
                                    strokeWidth: 3,
                                }}
                                animationDuration={2000}
                                animationEasing="ease-in-out"
                            />
                            <Area
                                dataKey="ram"
                                type="monotone"
                                fill={`url(#${gradientDefs.ram.id})`}
                                stroke={gradientDefs.ram.color1}
                                strokeWidth={3}
                                dot={{
                                    fill: "white",
                                    stroke: gradientDefs.ram.color1,
                                    strokeWidth: 2,
                                    r: 4,
                                }}
                                activeDot={{
                                    r: 8,
                                    fill: "white",
                                    stroke: gradientDefs.ram.color1,
                                    strokeWidth: 3,
                                }}
                                animationDuration={2000}
                                animationEasing="ease-in-out"
                            />
                        </AreaChart>
                    </ChartContainer>
                )}
            </CardContent>
        </Card>
    )
}
