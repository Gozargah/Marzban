import {
  Badge,
  Box,
  Card,
  chakra,
  Grid,
  GridItem,
  HStack,
  IconButton,
  Progress,
  Select,
  Spinner,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tooltip,
  Tr,
  useColorMode,
  VStack,
} from "@chakra-ui/react";
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  BoltIcon,
  ChartBarIcon,
  CpuChipIcon,
  ExclamationTriangleIcon,
  GlobeAltIcon,
  ServerIcon,
  ShieldCheckIcon,
  SignalIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";
import { FC, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import ReactApexChart from "react-apexcharts";
import { useTranslation } from "react-i18next";
import { useQuery } from "react-query";
import { Link } from "react-router-dom";
import { fetch } from "service/http";

const CpuIcon = chakra(CpuChipIcon, { baseStyle: { w: 5, h: 5 } });
const MemIcon = chakra(ServerIcon, { baseStyle: { w: 5, h: 5 } });
const BwIcon = chakra(ChartBarIcon, { baseStyle: { w: 5, h: 5 } });
const ConnIcon = chakra(GlobeAltIcon, { baseStyle: { w: 5, h: 5 } });
const OnlineIcon = chakra(UsersIcon, { baseStyle: { w: 5, h: 5 } });
const NodeIcon = chakra(SignalIcon, { baseStyle: { w: 5, h: 5 } });
const AlertIcon = chakra(ExclamationTriangleIcon, { baseStyle: { w: 4, h: 4 } });
const BackIcon = chakra(ArrowLeftIcon, { baseStyle: { w: 4, h: 4 } });
const RefreshIcon = chakra(ArrowPathIcon, { baseStyle: { w: 4, h: 4 } });
const ProtoIcon = chakra(BoltIcon, { baseStyle: { w: 5, h: 5 } });
const AuthIcon = chakra(ShieldCheckIcon, { baseStyle: { w: 4, h: 4 } });

type MetricPoint = {
  timestamp: number;
  cpu_percent: number;
  memory_percent: number;
  memory_used: number;
  memory_total: number;
  incoming_speed: number;
  outgoing_speed: number;
  incoming_packets: number;
  outgoing_packets: number;
  active_connections: number;
  online_users: number;
};

type MonitoringEvent = {
  timestamp: number;
  event_type: string;
  severity: string;
  message: string;
  node_name: string | null;
  node_id: number | null;
};

type NodeHealth = {
  node_id: number;
  node_name: string;
  status: string;
  uptime_percent: number;
  last_connected: number | null;
  last_error: string | null;
  last_error_time: number | null;
};

type ProtocolPoint = {
  timestamp: number;
  active_users: number;
  traffic: number;
  auth_success: number;
  auth_fail: number;
  errors: number;
};

type ProtocolSummary = {
  protocol: string;
  active_users: number;
  traffic_10m: number;
  auth_success: number;
  auth_fail: number;
  errors: number;
  data_points: number;
};

type MonitoringData = {
  metrics: MetricPoint[];
  events: MonitoringEvent[];
  nodes: NodeHealth[];
  protocol_summary: ProtocolSummary[];
  protocol_stats: Record<string, ProtocolPoint[]>;
};

const PROTOCOL_COLORS: Record<string, string> = {
  hysteria2: "#EC4899",
  vless: "#3B82F6",
  vmess: "#8B5CF6",
  trojan: "#10B981",
  shadowsocks: "#F59E0B",
};

const PROTOCOL_LABELS: Record<string, string> = {
  hysteria2: "Hysteria2",
  vless: "VLESS",
  vmess: "VMess",
  trojan: "Trojan",
  shadowsocks: "Shadowsocks",
};

function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec < 1024) return `${bytesPerSec} B/s`;
  if (bytesPerSec < 1048576) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
  if (bytesPerSec < 1073741824) return `${(bytesPerSec / 1048576).toFixed(1)} MB/s`;
  return `${(bytesPerSec / 1073741824).toFixed(2)} GB/s`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(2)} GB`;
}

function formatTime(ts: number): string {
  return new Date(ts * 1000).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDateTime(ts: number): string {
  return new Date(ts * 1000).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function timeAgo(ts: number): string {
  const diff = Date.now() / 1000 - ts;
  if (diff < 60) return `${Math.round(diff)}s ago`;
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  return `${Math.round(diff / 86400)}d ago`;
}

const severityColor: Record<string, string> = {
  info: "blue",
  warning: "orange",
  error: "red",
};

const statusColor: Record<string, string> = {
  connected: "green",
  connecting: "yellow",
  error: "red",
  disabled: "gray",
};

const QUERY_KEY = "monitoring-data";

const MiniStatCard: FC<{
  icon: React.ReactElement;
  label: string;
  value: string;
  sub?: string;
  color?: string;
}> = ({ icon, label, value, sub, color = "primary.400" }) => (
  <Card
    p={4}
    borderWidth="1px"
    borderColor="light-border"
    bg="#F9FAFB"
    _dark={{ borderColor: "gray.600", bg: "gray.750" }}
    boxShadow="none"
    borderRadius="12px"
    w="full"
  >
    <HStack spacing={3}>
      <Box
        p="2"
        position="relative"
        color="white"
        _before={{
          content: `""`,
          position: "absolute",
          top: 0,
          left: 0,
          bg: color,
          display: "block",
          w: "full",
          h: "full",
          borderRadius: "5px",
          opacity: ".5",
          zIndex: "1",
        }}
        _after={{
          content: `""`,
          position: "absolute",
          top: "-4px",
          left: "-4px",
          bg: color,
          display: "block",
          w: "calc(100% + 8px)",
          h: "calc(100% + 8px)",
          borderRadius: "7px",
          opacity: ".35",
          zIndex: "1",
        }}
      >
        <Box position="relative" zIndex="2">{icon}</Box>
      </Box>
      <Box flex="1" minW={0}>
        <Text fontSize="xs" color="gray.500" _dark={{ color: "gray.400" }} noOfLines={1}>
          {label}
        </Text>
        <Text fontSize="xl" fontWeight="bold" lineHeight="1.2" noOfLines={1}>
          {value}
        </Text>
        {sub && (
          <Text fontSize="xs" color="gray.500" _dark={{ color: "gray.400" }} noOfLines={1}>
            {sub}
          </Text>
        )}
      </Box>
    </HStack>
  </Card>
);

const ChartCard: FC<{
  title: string;
  children: React.ReactNode;
  minH?: string;
}> = ({ title, children, minH = "260px" }) => (
  <Card
    p={4}
    borderWidth="1px"
    borderColor="light-border"
    bg="#F9FAFB"
    _dark={{ borderColor: "gray.600", bg: "gray.750" }}
    boxShadow="none"
    borderRadius="12px"
    w="full"
    minH={minH}
  >
    <Text fontSize="sm" fontWeight="semibold" mb={2} color="gray.600" _dark={{ color: "gray.300" }}>
      {title}
    </Text>
    {children}
  </Card>
);

export const Monitoring: FC = () => {
  const { t } = useTranslation();
  const { colorMode } = useColorMode();
  const isDark = colorMode === "dark";
  const [minutes, setMinutes] = useState(30);

  const { data, isLoading, refetch, isFetching } = useQuery<MonitoringData>({
    queryKey: [QUERY_KEY, minutes],
    queryFn: () => fetch(`/monitoring?minutes=${minutes}&event_limit=100`),
    refetchInterval: 10000,
    keepPreviousData: true,
  });

  const metrics = data?.metrics || [];
  const events = data?.events || [];
  const nodes = data?.nodes || [];
  const protoSummary = data?.protocol_summary || [];
  const protoStats = data?.protocol_stats || {};

  const latest = metrics.length > 0 ? metrics[metrics.length - 1] : null;

  const timestamps = useMemo(
    () => metrics.map((m) => formatTime(m.timestamp)),
    [metrics]
  );

  const baseChartOptions = useCallback(
    (opts?: { yFormatter?: (v: number) => string }): ApexCharts.ApexOptions => ({
      chart: {
        toolbar: { show: false },
        zoom: { enabled: false },
        background: "transparent",
        animations: { enabled: true, easing: "easeinout", dynamicAnimation: { speed: 500 } },
      },
      theme: { mode: isDark ? "dark" : "light" },
      grid: {
        borderColor: isDark ? "#374151" : "#E5E7EB",
        strokeDashArray: 3,
      },
      xaxis: {
        categories: timestamps,
        labels: {
          show: true,
          rotate: 0,
          style: { fontSize: "10px", colors: isDark ? "#9CA3AF" : "#6B7280" },
          formatter: (_: string, ts: number) => {
            if (timestamps.length < 20) return timestamps[ts] || "";
            return ts % Math.ceil(timestamps.length / 8) === 0 ? timestamps[ts] || "" : "";
          },
        },
        axisBorder: { show: false },
        axisTicks: { show: false },
        tooltip: { enabled: false },
      },
      yaxis: {
        labels: {
          style: { fontSize: "10px", colors: isDark ? "#9CA3AF" : "#6B7280" },
          formatter: opts?.yFormatter || ((v: number) => String(Math.round(v))),
        },
      },
      stroke: { curve: "smooth", width: 2 },
      fill: {
        type: "gradient",
        gradient: { opacityFrom: 0.4, opacityTo: 0.05, shadeIntensity: 1 },
      },
      dataLabels: { enabled: false },
      tooltip: {
        theme: isDark ? "dark" : "light",
        x: { show: true },
        y: { formatter: opts?.yFormatter },
      },
      legend: { labels: { colors: isDark ? "#D1D5DB" : "#374151" } },
    }),
    [isDark, timestamps]
  );

  const cpuMemSeries = useMemo(
    () => [
      { name: t("monitoring.cpu"), data: metrics.map((m) => Math.round(m.cpu_percent * 10) / 10) },
      { name: t("monitoring.memory"), data: metrics.map((m) => Math.round(m.memory_percent * 10) / 10) },
    ],
    [metrics, t]
  );

  const bwSeries = useMemo(
    () => [
      { name: t("monitoring.incoming"), data: metrics.map((m) => m.incoming_speed) },
      { name: t("monitoring.outgoing"), data: metrics.map((m) => m.outgoing_speed) },
    ],
    [metrics, t]
  );

  const connSeries = useMemo(
    () => [
      { name: t("monitoring.connections"), data: metrics.map((m) => m.active_connections) },
    ],
    [metrics, t]
  );

  const usersSeries = useMemo(
    () => [
      { name: t("monitoring.onlineUsers"), data: metrics.map((m) => m.online_users) },
    ],
    [metrics, t]
  );

  const activeProtocols = useMemo(
    () => Object.keys(protoStats).filter((k) => protoStats[k]?.length > 0),
    [protoStats]
  );

  const protoTrafficSeries = useMemo(() => {
    return activeProtocols.map((proto) => ({
      name: PROTOCOL_LABELS[proto] || proto,
      data: (protoStats[proto] || []).map((p) => p.traffic),
    }));
  }, [activeProtocols, protoStats]);

  const protoTrafficTimestamps = useMemo(() => {
    const firstProto = activeProtocols[0];
    if (!firstProto || !protoStats[firstProto]) return [];
    return protoStats[firstProto].map((p) => formatTime(p.timestamp));
  }, [activeProtocols, protoStats]);

  const protoChartOptions = useCallback(
    (cats: string[], yFmt?: (v: number) => string): ApexCharts.ApexOptions => ({
      chart: {
        toolbar: { show: false },
        zoom: { enabled: false },
        background: "transparent",
        animations: { enabled: true, easing: "easeinout", dynamicAnimation: { speed: 500 } },
      },
      theme: { mode: isDark ? "dark" : "light" },
      grid: { borderColor: isDark ? "#374151" : "#E5E7EB", strokeDashArray: 3 },
      xaxis: {
        categories: cats,
        labels: {
          show: true, rotate: 0,
          style: { fontSize: "10px", colors: isDark ? "#9CA3AF" : "#6B7280" },
          formatter: (_: string, idx: number) => {
            if (cats.length < 20) return cats[idx] || "";
            return idx % Math.ceil(cats.length / 8) === 0 ? cats[idx] || "" : "";
          },
        },
        axisBorder: { show: false }, axisTicks: { show: false }, tooltip: { enabled: false },
      },
      yaxis: {
        labels: {
          style: { fontSize: "10px", colors: isDark ? "#9CA3AF" : "#6B7280" },
          formatter: yFmt || ((v: number) => String(Math.round(v))),
        },
      },
      colors: activeProtocols.map((p) => PROTOCOL_COLORS[p] || "#6B7280"),
      stroke: { curve: "smooth", width: 2 },
      fill: { type: "gradient", gradient: { opacityFrom: 0.4, opacityTo: 0.05, shadeIntensity: 1 } },
      dataLabels: { enabled: false },
      tooltip: { theme: isDark ? "dark" : "light", x: { show: true }, y: { formatter: yFmt } },
      legend: { labels: { colors: isDark ? "#D1D5DB" : "#374151" } },
    }),
    [isDark, activeProtocols]
  );

  const hysteriaSummary = protoSummary.find((s) => s.protocol === "hysteria2");

  return (
    <VStack minH="100vh" p="6" spacing={4} align="stretch">
      {/* Header */}
      <HStack justify="space-between" wrap="wrap" gap={2}>
        <HStack spacing={3}>
          <Link to="/">
            <IconButton
              aria-label="Back to dashboard"
              size="sm"
              variant="outline"
              icon={<BackIcon />}
            />
          </Link>
          <Text as="h1" fontWeight="semibold" fontSize="2xl">
            {t("monitoring.title")}
          </Text>
          {isFetching && <Spinner size="sm" color="primary.400" />}
        </HStack>
        <HStack spacing={2}>
          <Select
            size="sm"
            w="140px"
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
            borderRadius="8px"
          >
            <option value={10}>10 {t("monitoring.minutes")}</option>
            <option value={30}>30 {t("monitoring.minutes")}</option>
            <option value={60}>1 {t("monitoring.hour")}</option>
            <option value={120}>2 {t("monitoring.hours")}</option>
          </Select>
          <Tooltip label={t("monitoring.refresh")}>
            <IconButton
              aria-label="Refresh"
              size="sm"
              variant="outline"
              icon={<RefreshIcon />}
              onClick={() => refetch()}
              isLoading={isFetching}
            />
          </Tooltip>
        </HStack>
      </HStack>

      {isLoading ? (
        <Box textAlign="center" py="20">
          <Spinner size="xl" color="primary.400" />
        </Box>
      ) : (
        <>
          {/* Quick Stats */}
          <Grid
            templateColumns={{
              base: "1fr",
              sm: "repeat(2, 1fr)",
              lg: "repeat(5, 1fr)",
            }}
            gap={3}
          >
            <MiniStatCard
              icon={<CpuIcon />}
              label="CPU"
              value={latest ? `${latest.cpu_percent.toFixed(1)}%` : "—"}
              color="primary.400"
            />
            <MiniStatCard
              icon={<MemIcon />}
              label={t("monitoring.memory")}
              value={latest ? `${latest.memory_percent.toFixed(1)}%` : "—"}
              sub={latest ? `${formatBytes(latest.memory_used)} / ${formatBytes(latest.memory_total)}` : undefined}
              color="purple.400"
            />
            <MiniStatCard
              icon={<BwIcon />}
              label={t("monitoring.bandwidth")}
              value={latest ? formatSpeed(latest.incoming_speed + latest.outgoing_speed) : "—"}
              sub={
                latest
                  ? `↓ ${formatSpeed(latest.incoming_speed)}  ↑ ${formatSpeed(latest.outgoing_speed)}`
                  : undefined
              }
              color="teal.400"
            />
            <MiniStatCard
              icon={<ConnIcon />}
              label={t("monitoring.connections")}
              value={latest ? String(latest.active_connections) : "—"}
              color="orange.400"
            />
            <MiniStatCard
              icon={<OnlineIcon />}
              label={t("monitoring.onlineUsers")}
              value={latest ? String(latest.online_users) : "—"}
              color="green.400"
            />
          </Grid>

          {/* Charts Row 1: CPU/Memory + Bandwidth */}
          <Grid
            templateColumns={{ base: "1fr", lg: "1fr 1fr" }}
            gap={3}
          >
            <GridItem>
              <ChartCard title={`CPU & ${t("monitoring.memory")} (%)`}>
                <Suspense fallback={<Spinner />}>
                  <ReactApexChart
                    options={{
                      ...baseChartOptions({ yFormatter: (v) => `${v}%` }),
                      colors: ["#4d7de7", "#9333EA"],
                    }}
                    series={cpuMemSeries}
                    type="area"
                    height="220"
                  />
                </Suspense>
              </ChartCard>
            </GridItem>
            <GridItem>
              <ChartCard title={t("monitoring.bandwidth")}>
                <Suspense fallback={<Spinner />}>
                  <ReactApexChart
                    options={{
                      ...baseChartOptions({ yFormatter: formatSpeed }),
                      colors: ["#14B8A6", "#F59E0B"],
                    }}
                    series={bwSeries}
                    type="area"
                    height="220"
                  />
                </Suspense>
              </ChartCard>
            </GridItem>
          </Grid>

          {/* Charts Row 2: Connections + Online Users */}
          <Grid
            templateColumns={{ base: "1fr", lg: "1fr 1fr" }}
            gap={3}
          >
            <GridItem>
              <ChartCard title={t("monitoring.connections")}>
                <Suspense fallback={<Spinner />}>
                  <ReactApexChart
                    options={{
                      ...baseChartOptions(),
                      colors: ["#F97316"],
                    }}
                    series={connSeries}
                    type="area"
                    height="200"
                  />
                </Suspense>
              </ChartCard>
            </GridItem>
            <GridItem>
              <ChartCard title={t("monitoring.onlineUsers")}>
                <Suspense fallback={<Spinner />}>
                  <ReactApexChart
                    options={{
                      ...baseChartOptions(),
                      colors: ["#22C55E"],
                    }}
                    series={usersSeries}
                    type="area"
                    height="200"
                  />
                </Suspense>
              </ChartCard>
            </GridItem>
          </Grid>

          {/* Protocol Overview */}
          {protoSummary.length > 0 && (
            <>
              <Text fontSize="lg" fontWeight="semibold" mt={2}>
                {t("monitoring.protocols")}
              </Text>
              <Grid
                templateColumns={{
                  base: "1fr",
                  sm: "repeat(2, 1fr)",
                  lg: `repeat(${Math.min(protoSummary.length, 5)}, 1fr)`,
                }}
                gap={3}
              >
                {protoSummary.map((ps) => (
                  <Card
                    key={ps.protocol}
                    p={4}
                    borderWidth="1px"
                    borderColor="light-border"
                    bg="#F9FAFB"
                    _dark={{ borderColor: "gray.600", bg: "gray.750" }}
                    boxShadow="none"
                    borderRadius="12px"
                  >
                    <HStack justify="space-between" mb={2}>
                      <HStack spacing={2}>
                        <ProtoIcon color={PROTOCOL_COLORS[ps.protocol] || "gray.400"} />
                        <Text fontWeight="semibold" fontSize="sm">
                          {PROTOCOL_LABELS[ps.protocol] || ps.protocol}
                        </Text>
                      </HStack>
                      <Badge
                        colorScheme={ps.errors > 0 ? "red" : "green"}
                        borderRadius="full"
                        fontSize="2xs"
                      >
                        {ps.errors > 0 ? `${ps.errors} err` : "OK"}
                      </Badge>
                    </HStack>
                    <VStack align="stretch" spacing={1}>
                      <HStack justify="space-between">
                        <Text fontSize="xs" color="gray.500">{t("monitoring.activeUsers")}</Text>
                        <Text fontSize="xs" fontWeight="bold">{ps.active_users}</Text>
                      </HStack>
                      <HStack justify="space-between">
                        <Text fontSize="xs" color="gray.500">{t("monitoring.traffic10m")}</Text>
                        <Text fontSize="xs" fontWeight="bold">{formatBytes(ps.traffic_10m)}</Text>
                      </HStack>
                      {ps.protocol === "hysteria2" && (
                        <HStack justify="space-between">
                          <HStack spacing={1}>
                            <AuthIcon color="green.400" />
                            <Text fontSize="xs" color="gray.500">{t("monitoring.auth")}</Text>
                          </HStack>
                          <Text fontSize="xs" fontWeight="bold">
                            <Text as="span" color="green.400">{ps.auth_success}</Text>
                            {" / "}
                            <Text as="span" color={ps.auth_fail > 0 ? "red.400" : "gray.500"}>{ps.auth_fail}</Text>
                          </Text>
                        </HStack>
                      )}
                    </VStack>
                  </Card>
                ))}
              </Grid>
            </>
          )}

          {/* Protocol Traffic Chart */}
          {activeProtocols.length > 0 && (
            <Grid templateColumns={{ base: "1fr", lg: "1fr 1fr" }} gap={3}>
              <GridItem>
                <ChartCard title={t("monitoring.protoTraffic")}>
                  <Suspense fallback={<Spinner />}>
                    <ReactApexChart
                      options={protoChartOptions(protoTrafficTimestamps, formatBytes)}
                      series={protoTrafficSeries}
                      type="area"
                      height="220"
                    />
                  </Suspense>
                </ChartCard>
              </GridItem>

              {/* Hysteria2 Auth Chart */}
              {protoStats.hysteria2 && protoStats.hysteria2.length > 0 && (
                <GridItem>
                  <ChartCard title={`Hysteria2 — ${t("monitoring.authHistory")}`}>
                    <Suspense fallback={<Spinner />}>
                      <ReactApexChart
                        options={{
                          ...protoChartOptions(
                            protoStats.hysteria2.map((p) => formatTime(p.timestamp))
                          ),
                          colors: ["#22C55E", "#EF4444"],
                        }}
                        series={[
                          {
                            name: t("monitoring.authOk"),
                            data: protoStats.hysteria2.map((p) => p.auth_success),
                          },
                          {
                            name: t("monitoring.authFail"),
                            data: protoStats.hysteria2.map((p) => p.auth_fail),
                          },
                        ]}
                        type="bar"
                        height="220"
                      />
                    </Suspense>
                  </ChartCard>
                </GridItem>
              )}
            </Grid>
          )}

          {/* Nodes Health + Events */}
          <Grid
            templateColumns={{ base: "1fr", lg: "1fr 1fr" }}
            gap={3}
          >
            {/* Node Health */}
            <GridItem>
              <ChartCard title={t("monitoring.nodeHealth")} minH="200px">
                {nodes.length === 0 ? (
                  <Text color="gray.500" fontSize="sm" py={4} textAlign="center">
                    {t("monitoring.noNodes")}
                  </Text>
                ) : (
                  <VStack spacing={3} align="stretch">
                    {nodes.map((node) => (
                      <Box
                        key={node.node_id}
                        p={3}
                        borderWidth="1px"
                        borderColor="light-border"
                        _dark={{ borderColor: "gray.600" }}
                        borderRadius="8px"
                      >
                        <HStack justify="space-between" mb={2}>
                          <HStack spacing={2}>
                            <NodeIcon
                              color={
                                node.status === "connected"
                                  ? "green.400"
                                  : node.status === "error"
                                  ? "red.400"
                                  : "yellow.400"
                              }
                            />
                            <Text fontWeight="medium" fontSize="sm">
                              {node.node_name}
                            </Text>
                          </HStack>
                          <Badge
                            colorScheme={statusColor[node.status] || "gray"}
                            borderRadius="full"
                            px={2}
                            fontSize="xs"
                          >
                            {node.status}
                          </Badge>
                        </HStack>
                        <HStack justify="space-between" mb={1}>
                          <Text fontSize="xs" color="gray.500">
                            Uptime
                          </Text>
                          <Text fontSize="xs" fontWeight="semibold">
                            {node.uptime_percent}%
                          </Text>
                        </HStack>
                        <Progress
                          value={node.uptime_percent}
                          size="sm"
                          borderRadius="full"
                          colorScheme={
                            node.uptime_percent >= 95
                              ? "green"
                              : node.uptime_percent >= 80
                              ? "yellow"
                              : "red"
                          }
                        />
                        {node.last_error && (
                          <HStack mt={2} spacing={1}>
                            <AlertIcon color="red.400" />
                            <Text fontSize="xs" color="red.400" noOfLines={1}>
                              {node.last_error}
                            </Text>
                            {node.last_error_time && (
                              <Text fontSize="xs" color="gray.500" flexShrink={0}>
                                ({timeAgo(node.last_error_time)})
                              </Text>
                            )}
                          </HStack>
                        )}
                      </Box>
                    ))}
                  </VStack>
                )}
              </ChartCard>
            </GridItem>

            {/* Events Log */}
            <GridItem>
              <ChartCard title={t("monitoring.events")} minH="200px">
                {events.length === 0 ? (
                  <Text color="gray.500" fontSize="sm" py={4} textAlign="center">
                    {t("monitoring.noEvents")}
                  </Text>
                ) : (
                  <Box overflowX="auto" maxH="400px" overflowY="auto">
                    <Table size="sm" variant="simple">
                      <Thead>
                        <Tr>
                          <Th fontSize="xs" px={2}>{t("monitoring.time")}</Th>
                          <Th fontSize="xs" px={2}>{t("monitoring.severity")}</Th>
                          <Th fontSize="xs" px={2}>{t("monitoring.event")}</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {events.slice(0, 50).map((ev, i) => (
                          <Tr key={i}>
                            <Td fontSize="xs" px={2} whiteSpace="nowrap" color="gray.500">
                              {formatDateTime(ev.timestamp)}
                            </Td>
                            <Td px={2}>
                              <Badge
                                colorScheme={severityColor[ev.severity] || "gray"}
                                borderRadius="full"
                                fontSize="2xs"
                                px={2}
                              >
                                {ev.severity}
                              </Badge>
                            </Td>
                            <Td fontSize="xs" px={2} maxW="300px">
                              <Text noOfLines={2}>{ev.message}</Text>
                            </Td>
                          </Tr>
                        ))}
                      </Tbody>
                    </Table>
                  </Box>
                )}
              </ChartCard>
            </GridItem>
          </Grid>
        </>
      )}
    </VStack>
  );
};

export default Monitoring;
