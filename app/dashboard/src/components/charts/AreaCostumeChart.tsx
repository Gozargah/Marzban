import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"

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
import useDirDetection from "@/hooks/use-dir-detection.tsx";


const chartData = [
    { time: "13:01", usage: 25 },
    { time: "13:03", usage: 30 },
    { time: "13:04", usage: 50 },
    { time: "13:05", usage: 20 },
    { time: "13:06", usage: 15 },
    { time: "13:07", usage: 25 },
    { time: "13:08", usage: 5 },
    { time: "13:09", usage: 0 },
    { time: "13:10", usage: 85 },
    { time: "13:11", usage: 7 },
]

const chartConfig = {
    usage: {
        label: "usage",
        color: "hsl(var(--chart-1))",
    },
} satisfies ChartConfig


export function AreaCostumeChart() {
    const { t } = useTranslation();
    const dir = useDirDetection();

    return (
        <Card className={"flex flex-1 flex-col"}>
            <CardHeader className="flex flex-col items-stretch space-y-0 border-b p-0 sm:flex-row">
                <div className="flex flex-1 flex-col justify-center gap-1 px-6 py-5 sm:py-6 border-b">
                    <CardTitle>{t("Real Time Statistics")}</CardTitle>
                    <CardDescription>
                        {t("Deploy your new project in one-click.")}
                    </CardDescription>
                </div>
                <div className=" m-0 p-6 flex flex-col justify-center px-4 sm:border-b-0 sm:border-l border-b">
                    <span className="text-muted-foreground text-xs sm:text-sm ">{t("CPU Usage")}</span>
                    <span className="text-foreground text-lg flex justify-center">49%</span>
                </div>
                <div className="p-6 m-0 flex flex-col justify-center px-4 sm:border-b-0 sm:border-l">
                    <span
                        className="text-muted-foreground text-xs sm:text-sm">{t("RAM Usage")}</span>
                    <span className="text-foreground text-lg flex justify-center">1.3 GB</span>
                </div>
            </CardHeader>
            <CardContent className={"pt-8"}>
                <ChartContainer dir={dir} config={chartConfig} className={"max-h-[360px] min-h-[200px] w-full"}>
                    <AreaChart
                        accessibilityLayer
                        data={chartData}
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
                        <YAxis tickLine={false} tickFormatter={(value) => `${value}%`} axisLine={false} tickMargin={8} />
                        <ChartTooltip
                            cursor={false}
                            content={<ChartTooltipContent indicator="dot" hideLabel />}
                        />
                        <Area
                            dataKey="usage"
                            type="linear"
                            fill="var(--color-usage)"
                            stroke="var(--color-usage)"
                            dot={{
                                fill: "white",
                            }}
                            activeDot={{
                                r: 6,
                            }}
                        />
                    </AreaChart>
                </ChartContainer>
            </CardContent>
        </Card>
    )
}
