import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { BarChart, Cpu, Gauge, MemoryStick } from 'lucide-react'
import { CostumeBarChart } from '../charts/CostumeBarChart'
import { AreaCostumeChart } from '../charts/AreaCostumeChart'
import PieCostumeChart from '../charts/PieCostumeChart'
import { SystemStats, useGetNodes, NodeResponse, useRealtimeNodeStats, NodeRealtimeStats } from '@/service/api'
import { formatBytes } from '@/utils/formatByte'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import useDirDetection from '@/hooks/use-dir-detection'
import { Skeleton } from '@/components/ui/skeleton'
import { useState, useEffect } from 'react'

interface StatisticsProps {
  data?: SystemStats;
  isLoading: boolean;
  error: any;
  selectedServer: string;
  onServerChange: (value: string) => void;
}

export default function Statistics({ data, isLoading, error, selectedServer, onServerChange }: StatisticsProps) {
  const { t } = useTranslation()
  const dir = useDirDetection()

  const { data: nodesData, isLoading: isLoadingNodes, error: nodesError } = useGetNodes()
  const selectedNodeId = selectedServer === "master" ? undefined : parseInt(selectedServer, 10)
  const { data: nodeStats, isLoading: isLoadingNodeStats } = useRealtimeNodeStats(selectedNodeId || 0, {
    query: {
      enabled: !!selectedNodeId,
      refetchInterval: 5000, // Update every 5 seconds
    }
  })

  // Clear any existing intervals when server selection changes
  useEffect(() => {
    return () => {
      // This cleanup function will run when the component unmounts or when selectedServer changes
      // The query will be automatically disabled when selectedServer changes due to the enabled option
    }
  }, [selectedServer])

  if ((selectedServer === "master" && isLoading) || isLoadingNodes || (selectedNodeId && isLoadingNodeStats)) {
    return <StatisticsSkeletons />
  }

  if (error || nodesError) {
    const errorMessage = error?.message || nodesError?.message || "Unknown error"
    return <div className="text-destructive">Error loading statistics: {errorMessage}</div>
  }

  // Get the current stats based on selection
  const currentStats = selectedServer === "master" 
    ? data as SystemStats
    : nodeStats as NodeRealtimeStats

  const getBandwidthValue = () => {
    if (selectedServer === "master") {
      const stats = currentStats as SystemStats
      return Number(stats?.incoming_bandwidth) + Number(stats?.outgoing_bandwidth)
    } else {
      const stats = currentStats as NodeRealtimeStats
      return Number(stats?.incoming_bandwidth_speed) + Number(stats?.outgoing_bandwidth_speed)
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{t("statistics.system")}</h2>
          <p className="text-sm">{t("monitorServers")}</p>
        </div>
        <Select value={selectedServer} onValueChange={onServerChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select server" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="master">Master Server</SelectItem>
            {nodesData?.map((node: NodeResponse) => (
              <SelectItem key={node.id} value={String(node.id)}>
                {node.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("statistics.cpuUsage")}</CardTitle>
            <Cpu className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div dir='ltr' className={cn("text-2xl font-bold", dir === "rtl" && 'text-right')}>
              {currentStats?.cpu_usage.toFixed(1)}%
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("statistics.ramUsage")}</CardTitle>
            <MemoryStick className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div dir='ltr' className={cn("text-2xl font-bold", dir === "rtl" && 'text-right')}>
              {formatBytes(Number(currentStats?.mem_used), 1)} / {formatBytes(Number(currentStats?.mem_total), 1)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("statistics.realTimeBandwidth")}</CardTitle>
            <Gauge className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div dir='ltr' className={cn("text-2xl font-bold", dir === "rtl" && 'text-right')}>
              {formatBytes(getBandwidthValue(), 1)}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-8">
        <CostumeBarChart 
          nodeId={selectedNodeId} 
        />
        <div className="flex gap-4 flex-col sm:flex-row ">
          <AreaCostumeChart 
            nodeId={selectedNodeId} 
            currentStats={currentStats}
            realtimeStats={selectedServer === "master" ? data : nodeStats || undefined}
          />
        </div>
      </div>

      {selectedServer === "master" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">{t("statistics.users")}</h2>
              <p className="text-sm">{t("monitorServers")}</p>
            </div>
            <Select defaultValue="all">
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select users" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("statistics.allUsers")}</SelectItem>
                <SelectItem value="active">{t("statistics.activeUsers")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t("statistics.onlineUsers")}</CardTitle>
                <div className="h-2 w-2 rounded-full bg-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data?.online_users || 0} / {data?.total_user || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t("statistics.activeUsers")}</CardTitle>
                <BarChart className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data?.active_users || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t("statistics.expiredUsers")}</CardTitle>
                <BarChart className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data?.expired_users || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t("statistics.limitedUsers")}</CardTitle>
                <BarChart className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data?.limited_users || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t("statistics.disabledUsers")}</CardTitle>
                <BarChart className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data?.disabled_users || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t("statistics.onHoldUsers")}</CardTitle>
                <BarChart className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data?.on_hold_users || 0}</div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}

function StatisticsSkeletons() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-6 w-[150px] mb-2" />
          <Skeleton className="h-4 w-[200px]" />
        </div>
        <Skeleton className="h-10 w-[180px]" />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-5 w-[100px]" />
              <Skeleton className="h-4 w-4 rounded-full" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-[120px]" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="space-y-8">
        <Skeleton className="h-[300px] w-full" />
        <div className="flex gap-4 flex-col sm:flex-row">
          <Skeleton className="h-[300px] flex-1" />
          <Skeleton className="h-[300px] sm:w-[350px]" />
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-6 w-[100px] mb-2" />
            <Skeleton className="h-4 w-[150px]" />
          </div>
          <Skeleton className="h-10 w-[180px]" />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-5 w-[100px]" />
                <Skeleton className="h-4 w-4 rounded-full" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-[80px]" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
