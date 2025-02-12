import { useState, useMemo } from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import TimeSelector, { type TimePeriod } from "./TimeSelector"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { useTranslation } from "react-i18next"
import useDirDetection from "@/hooks/use-dir-detection"


type DataPoint = {
    time: string
    usage: number
}


type ChartDataByPeriod = {
    [key: string]: DataPoint[]
}


const chartDataByPeriod: ChartDataByPeriod = {
    "12h": [
        { time: "00:00", usage: 3 },
        { time: "02:00", usage: 4 },
        { time: "04:00", usage: 2.5 },
        { time: "06:00", usage: 2 },
        { time: "08:00", usage: 1 },
        { time: "10:00", usage: 0.5 },
        { time: "12:00", usage: 4 },
        { time: "14:00", usage: 7 },
        { time: "16:00", usage: 1 },
        { time: "18:00", usage: 3.5 },
        { time: "20:00", usage: 2 },
        { time: "22:00", usage: 5.8 },
        { time: "00:00", usage: 2.7 },
        { time: "02:00", usage: 9 },
    ],
    "24h": [
        { time: "00:00", usage: 3 },
        { time: "04:00", usage: 4 },
        { time: "08:00", usage: 2.5 },
        { time: "12:00", usage: 2 },
        { time: "16:00", usage: 1 },
        { time: "20:00", usage: 0.5 },
    ],
    "3d": [
        { time: "Day 1", usage: 10 },
        { time: "Day 2", usage: 15 },
        { time: "Day 3", usage: 8 },
        { time: "Day 4", usage: 13 },
        { time: "Day 5", usage: 7 },
        { time: "Day 6", usage: 16 },
    ],
    "1w": [
        { time: "Mon", usage: 20 },
        { time: "Tue", usage: 15 },
        { time: "Wed", usage: 18 },
        { time: "Thu", usage: 12 },
        { time: "Fri", usage: 22 },
        { time: "Sat", usage: 10 },
        { time: "Sun", usage: 5 },
    ],
}

const chartConfig = {
    usage: {
        label: "Traffic Usage",
        color: "hsl(var(--chart-1))",
    },
} satisfies ChartConfig

export function CostumeBarChart() {
    const [selectedTime, setSelectedTime] = useState<TimePeriod>("12h")
    const { t } = useTranslation()
    const dir = useDirDetection()

    const chartData = useMemo(() => chartDataByPeriod[selectedTime.toString()], [selectedTime])

    const totalUsage = useMemo(() => {
        return chartData ? chartData.reduce((sum, item) => sum + item.usage, 0).toFixed(2) : "0"
    }, [chartData])

    return (
        <Card>
            <CardHeader className="flex flex-col items-stretch space-y-0 border-b p-0 sm:flex-row">
                <div className="flex flex-1 flex-col sm:flex-row gap-1 px-6 py-6 sm:py-6 border-b">
                    <div className="flex flex-1 flex-col justify-center align-middle gap-1 px-1 py-1">
                        <CardTitle>{t("Traffic Usage")}</CardTitle>
                        <CardDescription>{t("Deploy your new project in one-click.")}</CardDescription>
                    </div>
                    <div className="px-1 py-1 flex justify-center align-middle flex-col">
                        <TimeSelector selectedTime={selectedTime} setSelectedTime={setSelectedTime} />
                    </div>
                </div>
                <div className="sm:border-l p-6 m-0 flex flex-col justify-center px-4 ">
                    <span className="text-muted-foreground text-xs sm:text-sm">{t("Usage during selected period")}</span>
                    <span className="text-foreground text-lg flex justify-center">{totalUsage} GB</span>
                </div>
            </CardHeader>
            <CardContent dir={dir} className="pt-8">
                <ChartContainer dir={dir} config={chartConfig} className="max-h-[400px] min-h-[200px] w-full">
                    {chartData && (
                        <BarChart accessibilityLayer data={chartData}>
                            <CartesianGrid direction={dir} vertical={false} />
                            <XAxis direction={dir} dataKey="time" tickLine={false} tickMargin={10} axisLine={false} />
                            <YAxis direction={dir} tickLine={false} axisLine={false} />
                            <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                            <Bar dataKey="usage" fill="var(--color-usage)" radius={8} />
                        </BarChart>
                    )}
                </ChartContainer>
            </CardContent>
        </Card>
    )
}