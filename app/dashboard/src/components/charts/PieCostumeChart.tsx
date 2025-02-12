import { Pie, PieChart } from "recharts"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
    ChartConfig,
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from "@/components/ui/chart"

const chartData = [
    { node: "Main Server", usage: 275, fill: "var(--color-MainServer)" },
    { node: "Node NL", usage: 200, fill: "var(--color-NodeNL)" },
    { node: "Node FR", usage: 187, fill: "var(--color-NodeFR)" },
    { node: "Node DE", usage: 173, fill: "var(--color-NodeDE)" },
    { node: "Node UK", usage: 90, fill: "var(--color-NodeUK)" },
]
const chartConfig = {
    usage: {
        label: "Usage",
    },
    MainServer: {
        label: "Main Server",
        color: "hsl(var(--chart-1))",
    },
    NodeNL: {
        label: "Node NL",
        color: "hsl(var(--chart-2))",
    },
    NodeFR: {
        label: "Node FR",
        color: "hsl(var(--chart-3))",
    },
    NodeDE: {
        label: "Node DE",
        color: "hsl(var(--chart-4))",
    },
    NodeUK: {
        label: "Node UK",
        color: "hsl(var(--chart-5))",
    },
} satisfies ChartConfig

export default function PieCostumeChart() {
    return (
        <Card className="w-full sm:max-w-md">
            <CardHeader className=" pb-0 border-b flex justify-center flex-col p-6">
                <CardTitle>Servers Traffic Usage</CardTitle>
                <CardDescription>Deploy your new project in one-click.</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 pb-0">
                <ChartContainer
                    config={chartConfig}
                    className="mx-auto aspect-square max-h-[250px]"
                >
                    <PieChart>
                        <ChartTooltip
                            cursor={false}
                            content={<ChartTooltipContent hideLabel />}
                        />
                        <Pie data={chartData} dataKey="usage" nameKey="node" />
                    </PieChart>
                </ChartContainer>
                <div className="my-4 flex flex-wrap justify-center gap-4">
                    {chartData.map((entry) => (
                        <div key={entry.node} className="flex items-center gap-2">
                            <div
                                className="h-3 w-3 border rounded-sm"
                                style={{
                                    backgroundColor:
                                        (chartConfig[entry.node.replace(" ", "") as keyof typeof chartConfig] as { color: string }).color,
                                }}
                            />
                            <span className="text-sm">{entry.node}</span>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    )
}