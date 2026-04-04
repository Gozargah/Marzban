import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Alert,
  AlertDescription,
  AlertIcon,
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  chakra,
  Flex,
  Grid,
  HStack,
  Progress,
  Spinner,
  Text,
  Tooltip,
  useColorMode,
  VStack,
} from "@chakra-ui/react";
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  BoltIcon,
  ChartBarIcon,
  CheckCircleIcon,
  CpuChipIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  GlobeAltIcon,
  ServerIcon,
  SignalIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import type { TFunction } from "i18next";
import { FC, ReactNode, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "react-query";
import { Link } from "react-router-dom";
import { fetch } from "service/http";

// ─── Chakra-wrapped icons ────────────────────────────────────────────────────
const BackIcon    = chakra(ArrowLeftIcon,          { baseStyle: { w: 4, h: 4 } });
const RefreshIcon = chakra(ArrowPathIcon,           { baseStyle: { w: 4, h: 4 } });
const PoolIcon    = chakra(GlobeAltIcon,            { baseStyle: { w: 4, h: 4 } });
const NodeIcon    = chakra(ServerIcon,              { baseStyle: { w: 4, h: 4 } });
const CpuIcon     = chakra(CpuChipIcon,             { baseStyle: { w: 3, h: 3 } });
const BwIcon      = chakra(ChartBarIcon,            { baseStyle: { w: 3, h: 3 } });
const ConnIcon    = chakra(SignalIcon,              { baseStyle: { w: 3, h: 3 } });
const ScoreIcon   = chakra(BoltIcon,               { baseStyle: { w: 3, h: 3 } });
const OkIcon      = chakra(CheckCircleIcon,         { baseStyle: { w: 4, h: 4 } });
const ErrIcon     = chakra(XCircleIcon,             { baseStyle: { w: 4, h: 4 } });
const WarnIcon    = chakra(ExclamationTriangleIcon, { baseStyle: { w: 4, h: 4 } });
const CritIcon    = chakra(ExclamationCircleIcon,   { baseStyle: { w: 4, h: 4 } });

// ─── Types ───────────────────────────────────────────────────────────────────
type Metrics = {
  active_connections: number;
  bandwidth_mbps: number;
  cpu: number;
  status: string;
};

type NodeRow = {
  node_id: number;
  node_name: string;
  smart_dns_name: string;
  announce_ip: string;
  address: string;
  port: number;
  is_up: boolean;
  consecutive_failures: number;
  score: number;
  last_error: string | null;
  last_poll_ts: number;
  seconds_since_poll: number;
  metrics: Metrics | null;
};

type PoolRow = { name: string; nodes: NodeRow[] };
type StatusPayload  = { enabled: boolean; fail_threshold: number; poller_alive: boolean; pools: PoolRow[] };
type AlertRow       = { severity: string; message: string; node_id: number | null; node_name: string | null };
type AlertsPayload  = { alerts: AlertRow[] };

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Same formula as the fixed backend: 1/(1+score) */
const lbWeight = (score: number) => 1.0 / (1.0 + score);

/** Returns traffic-share percentages (0-100) for each node, in order. */
const computeShares = (nodes: NodeRow[]): number[] => {
  const weights = nodes.map(n => (n.is_up ? lbWeight(n.score) : 0));
  const total   = weights.reduce((a, b) => a + b, 0);
  if (total === 0) return nodes.map(() => 0);
  return weights.map(w => Math.round((w / total) * 1000) / 10);
};

const fmtNum = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

/** Accepts seconds (server-computed) — no browser/server clock skew. */
const timeAgo = (seconds: number, t: TFunction): string => {
  if (seconds < 5) return t("smartDns.timeAgoNow");
  if (seconds < 60) return t("smartDns.timeAgoSeconds", { n: Math.round(seconds) });
  if (seconds < 3600) return t("smartDns.timeAgoMinutes", { n: Math.round(seconds / 60) });
  return t("smartDns.timeAgoHours", { n: Math.round(seconds / 3600) });
};

const SMART_DNS_PAGE_LANG = "ru";

/** This page is always Russian, independent of the dashboard language switcher. */
function useSmartDnsPageT(): TFunction {
  const { i18n } = useTranslation();
  const rawNs = i18n.options.defaultNS;
  const ns =
    typeof rawNs === "string"
      ? rawNs
      : Array.isArray(rawNs) && rawNs.length > 0
        ? rawNs[0]
        : "translation";

  const [ruReady, setRuReady] = useState(() =>
    i18n.hasResourceBundle(SMART_DNS_PAGE_LANG, ns)
  );

  useEffect(() => {
    if (i18n.hasResourceBundle(SMART_DNS_PAGE_LANG, ns)) {
      setRuReady(true);
      return;
    }
    void i18n.loadLanguages(SMART_DNS_PAGE_LANG).then(() => setRuReady(true));
  }, [i18n, ns]);

  return useMemo(
    () => i18n.getFixedT(SMART_DNS_PAGE_LANG, ns),
    [i18n, ns, ruReady]
  );
}

type NodeState = "up" | "grace" | "down";
const nodeState = (n: NodeRow): NodeState =>
  !n.is_up ? "down" : n.consecutive_failures > 0 ? "grace" : "up";

const STATE_COLOR: Record<NodeState, string> = {
  up:    "green",
  grace: "orange",
  down:  "red",
};

// Distribution-bar accent palette (hex, intentionally vivid)
const DIST_HEX = [
  "#4d7de7", "#9F7AEA", "#38B2AC", "#ED64A6",
  "#0BC5EA", "#F6AD55", "#68D391", "#FC8181",
];

// ─── StatCard ────────────────────────────────────────────────────────────────
const StatCard: FC<{
  icon: ReactNode;
  label: string;
  value: ReactNode;
  sub?: string;
  accentColor?: string;
}> = ({ icon, label, value, sub, accentColor = "blue.400" }) => {
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";
  return (
    <Box
      flex="1"
      minW="120px"
      position="relative"
      bg={dark ? "gray.750" : "white"}
      border="1px solid"
      borderColor={dark ? "gray.600" : "gray.200"}
      borderRadius="xl"
      overflow="hidden"
      p={4}
    >
      {/* Left accent stripe */}
      <Box
        position="absolute"
        left={0} top={0} bottom={0}
        w="3px"
        bg={accentColor}
        borderRadius="full"
      />
      <HStack spacing={1.5} mb={1}>
        <Box color={dark ? "gray.400" : "gray.500"}>{icon}</Box>
        <Text
          fontSize="10px"
          fontWeight="semibold"
          textTransform="uppercase"
          letterSpacing="wider"
          color={dark ? "gray.400" : "gray.500"}
        >
          {label}
        </Text>
      </HStack>
      <Text fontSize="2xl" fontWeight="bold" lineHeight="1.1">{value}</Text>
      {sub && (
        <Text fontSize="xs" color={dark ? "gray.500" : "gray.400"} mt={0.5}>{sub}</Text>
      )}
    </Box>
  );
};

// ─── DistributionBar ─────────────────────────────────────────────────────────
const DistributionBar: FC<{ nodes: NodeRow[]; shares: number[] }> = ({ nodes, shares }) => {
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";
  const total = shares.reduce((a, b) => a + b, 0);
  if (total === 0) return null;

  return (
    <Box mt={3}>
      {/* Segmented bar */}
      <Flex h="6px" borderRadius="full" overflow="hidden" gap="1px" mb={2}>
        {nodes.map((n, i) =>
          shares[i] > 0 ? (
            <Tooltip key={n.node_id} label={`${n.node_name}: ${shares[i]}%`} hasArrow>
              <Box
                h="100%"
                style={{ flex: `${shares[i]} 0 0` }}
                bg={DIST_HEX[i % DIST_HEX.length]}
                opacity={n.is_up ? 1 : 0.25}
                transition="flex 0.5s ease"
                cursor="default"
              />
            </Tooltip>
          ) : null
        )}
      </Flex>
      {/* Legend */}
      <HStack spacing={3} flexWrap="wrap">
        {nodes.map((n, i) => (
          <HStack key={n.node_id} spacing={1}>
            <Box
              w="7px" h="7px"
              borderRadius="2px"
              bg={DIST_HEX[i % DIST_HEX.length]}
              opacity={n.is_up ? 1 : 0.35}
            />
            <Text fontSize="xs" color={dark ? "gray.400" : "gray.500"}>
              {n.node_name}
              {shares[i] > 0 ? ` ${shares[i]}%` : " —"}
            </Text>
          </HStack>
        ))}
      </HStack>
    </Box>
  );
};

// ─── NodeCard ────────────────────────────────────────────────────────────────
const NodeCard: FC<{ node: NodeRow; lbShare: number }> = ({ node, lbShare }) => {
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";
  const t = useSmartDnsPageT();
  const state  = nodeState(node);
  const color  = STATE_COLOR[state];
  const m      = node.metrics;

  const cpuPct  = m ? Math.min(100, m.cpu) : 0;
  const bwPct   = m ? Math.min(100, (m.bandwidth_mbps / 1000) * 100) : 0;
  const cpuScheme = cpuPct > 85 ? "red" : cpuPct > 65 ? "orange" : "green";
  const bwScheme  = bwPct  > 85 ? "red" : bwPct  > 65 ? "orange" : "blue";

  const stateLabel =
    state === "up"    ? t("smartDns.stateUp") :
    state === "grace" ? t("smartDns.stateGrace") :
                        t("smartDns.stateDown");

  return (
    <Box
      bg={dark ? "gray.750" : "white"}
      border="1px solid"
      borderColor={dark ? "gray.600" : "gray.200"}
      borderRadius="xl"
      overflow="hidden"
      position="relative"
      transition="box-shadow 0.2s"
      _hover={{ boxShadow: dark ? "0 0 0 1px var(--chakra-colors-gray-500)" : "sm" }}
    >
      {/* State accent bar */}
      <Box
        position="absolute" left={0} top={0} bottom={0}
        w="3px" bg={`${color}.400`}
      />

      <Box px={4} py={3} pl={5}>
        {/* ── Header row ── */}
        <HStack justify="space-between" mb={2} flexWrap="wrap" gap={1}>
          <HStack spacing={2} minW={0} flex={1} overflow="hidden">
            {/* Pulsing status dot */}
            <Box
              w="8px" h="8px" borderRadius="full" flexShrink={0}
              bg={`${color}.${dark ? "300" : "500"}`}
              boxShadow={state === "up" ? `0 0 0 3px var(--chakra-colors-${color}-${dark ? "800" : "100"})` : "none"}
            />
            <Text fontWeight="semibold" fontSize="sm" isTruncated>
              {node.node_name}
            </Text>
          </HStack>
          <HStack spacing={1} flexShrink={0}>
            <Badge
              colorScheme={color}
              variant={state === "down" ? "solid" : "subtle"}
              fontSize="2xs"
            >
              {stateLabel}
            </Badge>
            {node.is_up && lbShare > 0 && (
              <Badge colorScheme="blue" variant="outline" fontSize="2xs">
                {lbShare}%
              </Badge>
            )}
          </HStack>
        </HStack>

        {/* ── IP address ── */}
        <Text
          fontSize="xs"
          fontFamily="mono"
          color={dark ? "gray.400" : "gray.500"}
          mb={m ? 3 : 2}
        >
          {node.announce_ip}
        </Text>

        {/* ── Metrics ── */}
        {m ? (
          <VStack spacing={2} align="stretch">
            {/* CPU */}
            <Box>
              <HStack justify="space-between" mb="2px">
                <HStack spacing={1} color={dark ? "gray.400" : "gray.500"}>
                  <CpuIcon />
                  <Text fontSize="xs">{t("smartDns.cpu")}</Text>
                </HStack>
                <Text fontSize="xs" fontWeight="medium">{m.cpu.toFixed(1)}%</Text>
              </HStack>
              <Progress value={cpuPct} size="xs" colorScheme={cpuScheme} borderRadius="full" />
            </Box>

            {/* Bandwidth */}
            <Box>
              <HStack justify="space-between" mb="2px">
                <HStack spacing={1} color={dark ? "gray.400" : "gray.500"}>
                  <BwIcon />
                  <Text fontSize="xs">{t("smartDns.bw")}</Text>
                </HStack>
                <Text fontSize="xs" fontWeight="medium">
                  {m.bandwidth_mbps.toFixed(0)} {t("smartDns.mbpsUnit")}
                </Text>
              </HStack>
              <Progress value={bwPct} size="xs" colorScheme={bwScheme} borderRadius="full" />
            </Box>

            {/* Connections + Score */}
            <HStack justify="space-between" pt={1} flexWrap="wrap" gap={2}>
              <HStack spacing={1} color={dark ? "gray.400" : "gray.500"}>
                <ConnIcon />
                <Text fontSize="xs">{t("smartDns.conn")}</Text>
                <Text fontSize="xs" fontWeight="semibold" color={dark ? "white" : "gray.800"}>
                  {fmtNum(m.active_connections)}
                </Text>
              </HStack>
              <HStack spacing={1} color={dark ? "gray.400" : "gray.500"}>
                <ScoreIcon />
                <Text fontSize="xs">{t("smartDns.score")}</Text>
                <Text fontSize="xs" fontWeight="semibold" color={dark ? "white" : "gray.800"}>
                  {node.score.toFixed(1)}
                </Text>
              </HStack>
            </HStack>
          </VStack>
        ) : (
          <Text fontSize="xs" color={dark ? "gray.500" : "gray.400"} fontStyle="italic">
            {t("smartDns.noMetricsYet")}
          </Text>
        )}

        {/* ── Error / failure info ── */}
        {(node.consecutive_failures > 0 || node.last_error) && (
          <Box
            mt={3} p={2}
            bg={dark ? "red.900" : "red.50"}
            borderRadius="md"
            borderLeft="2px solid"
            borderLeftColor="red.400"
          >
            {node.consecutive_failures > 0 && (
              <Text fontSize="xs" color={dark ? "red.300" : "red.700"} fontWeight="medium">
                {t("smartDns.pollErrors")}: {node.consecutive_failures}
              </Text>
            )}
            {node.last_error && (
              <Text fontSize="xs" color={dark ? "red.300" : "red.600"} noOfLines={2} mt={0.5}>
                {node.last_error}
              </Text>
            )}
          </Box>
        )}

        {/* ── Last polled ── */}
        {node.last_poll_ts > 0 && (() => {
          const stale = node.seconds_since_poll > 15;
          return (
            <Text
              fontSize="10px"
              color={stale ? (dark ? "orange.400" : "orange.500") : (dark ? "gray.600" : "gray.400")}
              mt={2}
              textAlign="right"
              fontWeight={stale ? "semibold" : "normal"}
            >
              {t("smartDns.metricsUpdated", { rel: timeAgo(node.seconds_since_poll, t) })}
              {stale && " ⚠"}
            </Text>
          );
        })()}
      </Box>
    </Box>
  );
};

// ─── PoolSection ─────────────────────────────────────────────────────────────
const PoolSection: FC<{ pool: PoolRow }> = ({ pool }) => {
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";
  const t = useSmartDnsPageT();

  const upCount  = pool.nodes.filter(n => n.is_up).length;
  const total    = pool.nodes.length;
  const allDown  = upCount === 0;
  const shares   = useMemo(() => computeShares(pool.nodes), [pool.nodes]);

  const headerBg    = dark ? "gray.750" : "gray.50";
  const borderColor = allDown
    ? (dark ? "red.500" : "red.300")
    : (dark ? "gray.600" : "gray.200");

  return (
    <Card
      variant="outline"
      borderColor={borderColor}
      borderRadius="2xl"
      overflow="hidden"
    >
      {/* Pool header */}
      <Box
        px={5} py={3}
        bg={headerBg}
        borderBottom="1px solid"
        borderColor={dark ? "gray.600" : "gray.100"}
      >
        <HStack justify="space-between" flexWrap="wrap" gap={2}>
          <HStack spacing={2}>
            <Box color={dark ? "blue.300" : "blue.500"}>
              <PoolIcon />
            </Box>
            <Text fontWeight="semibold" fontSize="sm" fontFamily="mono">
              {pool.name}
            </Text>
          </HStack>
          <Badge
            colorScheme={allDown ? "red" : upCount < total ? "orange" : "green"}
            fontSize="xs"
          >
            {t("smartDns.poolSummary", { up: upCount, total })}
          </Badge>
        </HStack>

        {/* Traffic distribution bar */}
        <DistributionBar nodes={pool.nodes} shares={shares} />
      </Box>

      {/* Node grid */}
      <CardBody p={4}>
        <Grid
          templateColumns={{ base: "1fr", md: "repeat(2, 1fr)", lg: "repeat(3, 1fr)" }}
          gap={3}
        >
          {pool.nodes.map((n, i) => (
            <NodeCard key={n.node_id} node={n} lbShare={shares[i]} />
          ))}
        </Grid>
      </CardBody>
    </Card>
  );
};

// ─── Main Page ───────────────────────────────────────────────────────────────
const STATUS_KEY = "smart-dns-status";
const ALERTS_KEY = "smart-dns-alerts";

export const SmartDns: FC = () => {
  const t = useSmartDnsPageT();
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";

  const { data: status, isLoading, refetch, isFetching } = useQuery({
    queryKey: STATUS_KEY,
    queryFn: () => fetch("/smart-dns/status") as Promise<StatusPayload>,
    refetchInterval: 4000,
    refetchOnWindowFocus: true,
  });

  const { data: alertsData } = useQuery({
    queryKey: ALERTS_KEY,
    queryFn: () => fetch("/smart-dns/alerts") as Promise<AlertsPayload>,
    refetchInterval: 4000,
    refetchOnWindowFocus: true,
  });

  // ── Summary numbers ──────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const pools = status?.pools ?? [];
    let totalNodes = 0, upNodes = 0, totalConns = 0;
    let cpuSum = 0, bwSum = 0, mCount = 0;

    for (const p of pools) {
      for (const n of p.nodes) {
        totalNodes++;
        if (n.is_up) upNodes++;
        if (n.metrics) {
          totalConns += n.metrics.active_connections;
          cpuSum     += n.metrics.cpu;
          bwSum      += n.metrics.bandwidth_mbps;
          mCount++;
        }
      }
    }
    return {
      poolCount:  pools.length,
      totalNodes,
      upNodes,
      downNodes:  totalNodes - upNodes,
      totalConns,
      avgCpu:     mCount > 0 ? cpuSum / mCount : 0,
      avgBw:      mCount > 0 ? bwSum  / mCount : 0,
    };
  }, [status]);

  const alerts         = alertsData?.alerts ?? [];
  const criticalAlerts = alerts.filter(a => a.severity === "critical");
  const warningAlerts  = alerts.filter(a => a.severity !== "critical");

  return (
    <Box p={{ base: 3, md: 6 }} maxW="1400px" mx="auto">
      <VStack align="stretch" spacing={5}>

        {/* ── Header ── */}
        <HStack justify="space-between" flexWrap="wrap" gap={2}>
          <HStack spacing={3}>
            <Button as={Link} to="/" size="sm" variant="ghost" leftIcon={<BackIcon />}>
              {t("smartDns.back")}
            </Button>
            {/* Live status dot */}
            <Box
              w="9px" h="9px" borderRadius="full" flexShrink={0}
              bg={status?.enabled ? "green.400" : "gray.400"}
              boxShadow={
                status?.enabled
                  ? `0 0 0 3px var(--chakra-colors-green-${dark ? "900" : "100"})`
                  : "none"
              }
            />
            <Text fontWeight="bold" fontSize="lg">{t("smartDns.title")}</Text>
            {status && (
              <Badge
                colorScheme={status.enabled ? "green" : "gray"}
                variant="subtle"
                fontSize="xs"
              >
                {status.enabled ? t("smartDns.enabled") : t("smartDns.disabledBadge")}
              </Badge>
            )}
          </HStack>

          <Button
            size="sm"
            variant="outline"
            leftIcon={<RefreshIcon />}
            onClick={() => refetch()}
            isLoading={isFetching}
          >
            {t("smartDns.refresh")}
          </Button>
        </HStack>

        {/* ── Disabled banner ── */}
        {status && !status.enabled && (
          <Alert status="warning" borderRadius="xl">
            <AlertIcon />
            <AlertDescription>{t("smartDns.disabled")}</AlertDescription>
          </Alert>
        )}

        {/* ── Poller dead banner ── */}
        {status && status.enabled && !status.poller_alive && (
          <Alert status="error" borderRadius="xl" variant="left-accent">
            <Box color="red.400" mr={3}><CritIcon /></Box>
            <Box>
              <Text fontWeight="semibold" fontSize="sm">{t("smartDns.pollerDead")}</Text>
              <Text fontSize="xs" mt={0.5}>{t("smartDns.pollerDeadHint")}</Text>
            </Box>
          </Alert>
        )}

        {/* ── Critical alerts ── */}
        {criticalAlerts.length > 0 && (
          <Alert status="error" borderRadius="xl" variant="left-accent">
            <Box color="red.400" mr={3}><CritIcon /></Box>
            <Box>
              <Text fontWeight="semibold" fontSize="sm" mb={criticalAlerts.length > 1 ? 1 : 0}>
                {criticalAlerts.length === 1
                  ? criticalAlerts[0].message
                  : `${criticalAlerts.length} ${t("smartDns.alerts").toLowerCase()}`}
              </Text>
              {criticalAlerts.length > 1 && (
                <VStack align="stretch" spacing={0.5}>
                  {criticalAlerts.map((a, i) => (
                    <Text key={i} fontSize="xs">
                      • {a.message}{a.node_name ? ` (${a.node_name})` : ""}
                    </Text>
                  ))}
                </VStack>
              )}
            </Box>
          </Alert>
        )}

        {/* ── Warning alerts ── */}
        {warningAlerts.length > 0 && (
          <Alert status="warning" borderRadius="xl" variant="left-accent">
            <Box color="orange.400" mr={3}><WarnIcon /></Box>
            <Box>
              <Text fontWeight="semibold" fontSize="sm" mb={1}>
                {warningAlerts.length} {t("smartDns.alerts").toLowerCase()}
              </Text>
              <VStack align="stretch" spacing={0.5}>
                {warningAlerts.map((a, i) => (
                  <Text key={i} fontSize="xs">
                    • {a.message}{a.node_name ? ` (${a.node_name})` : ""}
                  </Text>
                ))}
              </VStack>
            </Box>
          </Alert>
        )}

        {/* ── Loading ── */}
        {isLoading && (
          <HStack justify="center" py={10}>
            <Spinner size="md" color="blue.400" />
            <Text color={dark ? "gray.400" : "gray.500"}>{t("smartDns.loading")}</Text>
          </HStack>
        )}

        {/* ── Summary stat strip ── */}
        {status && !isLoading && (
          <Flex gap={3} flexWrap="wrap">
            <StatCard
              icon={<PoolIcon />}
              label={t("smartDns.totalPools")}
              value={stats.poolCount}
              accentColor="blue.400"
            />
            <StatCard
              icon={<OkIcon />}
              label={t("smartDns.healthyNodes")}
              value={`${stats.upNodes} / ${stats.totalNodes}`}
              accentColor="green.400"
            />
            {stats.downNodes > 0 && (
              <StatCard
                icon={<ErrIcon />}
                label={t("smartDns.downNodes")}
                value={stats.downNodes}
                accentColor="red.400"
              />
            )}
            <StatCard
              icon={<ConnIcon />}
              label={t("smartDns.conn")}
              value={fmtNum(stats.totalConns)}
              sub={t("smartDns.connSub")}
              accentColor="purple.400"
            />
            <StatCard
              icon={<CpuIcon />}
              label={t("smartDns.avgCpu")}
              value={`${stats.avgCpu.toFixed(1)}%`}
              sub={t("smartDns.avgCpuSub")}
              accentColor={stats.avgCpu > 80 ? "red.400" : "teal.400"}
            />
            <StatCard
              icon={<BwIcon />}
              label={t("smartDns.avgBw")}
              value={`${stats.avgBw.toFixed(0)}`}
              sub={t("smartDns.avgBwSub")}
              accentColor="cyan.400"
            />
          </Flex>
        )}

        {status && !isLoading && status.enabled && (
          <Accordion
            allowToggle
            reduceMotion
            borderRadius="xl"
            borderWidth="1px"
            borderColor={dark ? "gray.600" : "gray.200"}
            bg={dark ? "gray.800" : "white"}
          >
            <AccordionItem border="none">
              <AccordionButton
                px={4}
                py={3}
                borderRadius="xl"
                _expanded={{ bg: dark ? "gray.750" : "gray.50" }}
              >
                <Box flex="1" textAlign="left" fontWeight="semibold" fontSize="sm">
                  {t("smartDns.helpTitle")}
                </Box>
                <AccordionIcon />
              </AccordionButton>
              <AccordionPanel px={4} pb={4} pt={0}>
                <VStack
                  align="stretch"
                  spacing={2.5}
                  fontSize="sm"
                  color={dark ? "gray.300" : "gray.600"}
                >
                  <Text>{t("smartDns.helpP1")}</Text>
                  <Text>{t("smartDns.helpP2")}</Text>
                  <Text>{t("smartDns.helpP3")}</Text>
                  <Text>{t("smartDns.helpP4")}</Text>
                  <Text>{t("smartDns.helpP5")}</Text>
                  <Text>{t("smartDns.helpP6")}</Text>
                  <Text>{t("smartDns.helpP7")}</Text>
                  <Text>{t("smartDns.helpP8")}</Text>
                </VStack>
              </AccordionPanel>
            </AccordionItem>
          </Accordion>
        )}

        {/* ── Empty state ── */}
        {!isLoading && status && status.pools.length === 0 && (
          <Box
            p={12}
            textAlign="center"
            border="2px dashed"
            borderColor={dark ? "gray.600" : "gray.200"}
            borderRadius="2xl"
          >
            <Box
              mx="auto"
              w={12} h={12}
              borderRadius="full"
              bg={dark ? "gray.700" : "gray.100"}
              display="flex"
              alignItems="center"
              justifyContent="center"
              mb={3}
            >
              <Box color={dark ? "gray.500" : "gray.400"} fontSize="xl">
                <GlobeAltIcon style={{ width: 24, height: 24 }} />
              </Box>
            </Box>
            <Text fontWeight="medium" color={dark ? "gray.400" : "gray.600"}>
              {t("smartDns.noData")}
            </Text>
          </Box>
        )}

        {/* ── Pool sections ── */}
        {status?.pools?.map(pool => (
          <PoolSection key={pool.name} pool={pool} />
        ))}

        {/* ── All healthy footer ── */}
        {!isLoading && alerts.length === 0 && (status?.pools?.length ?? 0) > 0 && (
          <HStack justify="center" color={dark ? "green.300" : "green.600"} spacing={1.5}>
            <OkIcon />
            <Text fontSize="sm">{t("smartDns.allPoolsHealthy")}</Text>
          </HStack>
        )}

      </VStack>
    </Box>
  );
};
