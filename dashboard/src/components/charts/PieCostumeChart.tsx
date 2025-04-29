import { Pie, PieChart } from "recharts"
import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
    ChartConfig,
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from "@/components/ui/chart"
import { useTranslation } from "react-i18next"
import { getNodes, realtimeNodesStats } from "@/service/api"
import { formatBytes } from "@/utils/formatByte"
import { Skeleton } from "@/components/ui/skeleton"

type NodeData = {
    node: string
    usage: number
    fill: string
    nodeId: number
}

// Colors for nodes
const nodeColors = [
    "hsl(var(--chart-1))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
    "hsl(var(--chart-5))",
    "hsl(var(--chart-6))",
    "hsl(var(--chart-7))",
    "hsl(var(--chart-8))",
]

export default function PieCostumeChart() {
    const { t } = useTranslation()
    const [nodesData, setNodesData] = useState<NodeData[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<Error | null>(null)
    const [chartConfig, setChartConfig] = useState<ChartConfig>({})

    useEffect(() => {
        const fetchNodesData = async () => {
            try {
                setIsLoading(true)
                
                // Get the list of nodes
                const nodesResponse = await getNodes()
                
                if (!nodesResponse || !nodesResponse.nodes || nodesResponse.nodes.length === 0) {
                    setNodesData([])
                    setIsLoading(false)
                    return
                }
                
                // Get real-time stats for all nodes
                const statsResponse = await realtimeNodesStats()
                
                const newConfig: ChartConfig = {}
                const nodeTrafficData: NodeData[] = []
                
                // Combine nodes with their stats
                nodesResponse.nodes.forEach((node, index) => {
                    const nodeStats = statsResponse[node.id.toString()]
                    
                    if (nodeStats) {
                        // Calculate total traffic (incoming + outgoing)
                        const totalTraffic = nodeStats.incoming_bandwidth_speed + nodeStats.outgoing_bandwidth_speed
                        
                        const colorIndex = index % nodeColors.length
                        const nodeName = node.name
                        
                        // Add to chart config for tooltip and legend
                        const safeNodeName = nodeName.replace(/\s+/g, '')
                        newConfig[safeNodeName] = {
                            label: nodeName,
                            color: nodeColors[colorIndex]
                        }
                        
                        // Add to chart data
                        nodeTrafficData.push({
                            node: nodeName,
                            usage: totalTraffic,
                            fill: nodeColors[colorIndex],
                            nodeId: node.id
                        })
                    }
                })
                
                // If we have traffic data, set it up
                if (nodeTrafficData.length > 0) {
                    setNodesData(nodeTrafficData)
                    setChartConfig(newConfig)
                }
                
                setIsLoading(false)
            } catch (err) {
                console.error("Error fetching nodes data:", err)
                setError(err as Error)
                setIsLoading(false)
            }
        }
        
        fetchNodesData()
        
        // Refresh every 10 seconds
        const intervalId = setInterval(fetchNodesData, 10000)
        
        return () => clearInterval(intervalId)
    }, [])

    return (
        <Card className="w-full sm:max-w-md">
            <CardHeader className="pb-0 border-b flex justify-center flex-col p-6">
                <CardTitle>{t("statistics.serverTraffic")}</CardTitle>
                <CardDescription>{t("statistics.nodeTrafficDistribution")}</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 pb-0">
                {isLoading ? (
                    <div className="aspect-square max-h-[250px] flex items-center justify-center">
                        <Skeleton className="h-[200px] w-[200px] rounded-full" />
                    </div>
                ) : error ? (
                    <div className="aspect-square max-h-[250px] flex items-center justify-center text-destructive">
                        {t("errors.failedToLoad")}
                    </div>
                ) : nodesData.length === 0 ? (
                    <div className="aspect-square max-h-[250px] flex items-center justify-center">
                        {t("statistics.noNodesAvailable")}
                    </div>
                ) : (
                    <ChartContainer
                        config={chartConfig}
                        className="mx-auto aspect-square max-h-[250px]"
                    >
                        <PieChart>
                            <ChartTooltip
                                cursor={false}
                                content={<ChartTooltipContent formatter={(value) => formatBytes(Number(value), 1)} />}
                            />
                            <Pie 
                                data={nodesData} 
                                dataKey="usage" 
                                nameKey="node" 
                                outerRadius={80}
                                label={({ node, value }) => `${node}: ${formatBytes(value, 1)}`}
                            />
                        </PieChart>
                    </ChartContainer>
                )}
                <div className="my-4 flex flex-wrap justify-center gap-4">
                    {nodesData.map((entry) => (
                        <div key={entry.nodeId} className="flex items-center gap-2">
                            <div
                                className="h-3 w-3 border rounded-sm"
                                style={{ backgroundColor: entry.fill }}
                            />
                            <span className="text-sm">{entry.node}</span>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    )
}