import {
  Alert,
  AlertDescription,
  AlertIcon,
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  chakra,
  Heading,
  HStack,
  Spinner,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  VStack,
} from "@chakra-ui/react";
import { ArrowLeftIcon, ArrowPathIcon } from "@heroicons/react/24/outline";
import { FC, useMemo } from "react";
import ReactApexChart from "react-apexcharts";
import { useTranslation } from "react-i18next";
import { useQuery } from "react-query";
import { Link } from "react-router-dom";
import { fetch } from "service/http";

const BackIcon = chakra(ArrowLeftIcon, { baseStyle: { w: 4, h: 4 } });
const RefreshIcon = chakra(ArrowPathIcon, { baseStyle: { w: 4, h: 4 } });

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
  metrics: Metrics | null;
};

type PoolRow = {
  name: string;
  nodes: NodeRow[];
};

type StatusPayload = {
  enabled: boolean;
  fail_threshold: number;
  pools: PoolRow[];
};

type AlertRow = {
  severity: string;
  message: string;
  node_id: number | null;
  node_name: string | null;
};

type AlertsPayload = {
  alerts: AlertRow[];
};

const STATUS_KEY = "smart-dns-status";
const ALERTS_KEY = "smart-dns-alerts";

export const SmartDns: FC = () => {
  const { t } = useTranslation();
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

  const chartOptions = useMemo(() => {
    const pools = status?.pools ?? [];
    const categories: string[] = [];
    pools.forEach((p) => {
      p.nodes.forEach((n) => {
        categories.push(`${n.node_name} (${p.name})`);
      });
    });
    return {
      chart: { type: "bar" as const, toolbar: { show: false } },
      plotOptions: { bar: { horizontal: true, borderRadius: 4 } },
      xaxis: { categories },
      dataLabels: { enabled: true },
      tooltip: { y: { formatter: (v: number) => String(v) } },
    };
  }, [status?.pools]);

  const chartSeries = useMemo(() => {
    const pools = status?.pools ?? [];
    const data: number[] = [];
    pools.forEach((p) => {
      p.nodes.forEach((n) => data.push(n.score));
    });
    return [{ name: t("smartDns.score"), data }];
  }, [status?.pools, t]);

  return (
    <Box p={{ base: 3, md: 6 }} maxW="1200px" mx="auto">
      <VStack align="stretch" spacing={4}>
        <HStack justify="space-between" flexWrap="wrap" gap={2}>
          <HStack>
            <Button
              as={Link}
              to="/"
              size="sm"
              variant="ghost"
              leftIcon={<BackIcon />}
            >
              {t("smartDns.back")}
            </Button>
            <Heading size="md">{t("smartDns.title")}</Heading>
          </HStack>
          <Button
            size="sm"
            leftIcon={<RefreshIcon />}
            onClick={() => refetch()}
            isLoading={isFetching}
          >
            {t("smartDns.refresh")}
          </Button>
        </HStack>

        {status && !status.enabled && (
          <Alert status="warning" borderRadius="md">
            <AlertIcon />
            <AlertDescription>{t("smartDns.disabled")}</AlertDescription>
          </Alert>
        )}

        {alertsData && alertsData.alerts.length > 0 && (
          <Alert status="error" borderRadius="md" variant="left-accent">
            <AlertIcon />
            <Box>
              <Text fontWeight="semibold">{t("smartDns.alerts")}</Text>
              <VStack align="stretch" spacing={1} mt={1}>
                {alertsData.alerts.map((a, i) => (
                  <Text key={i} fontSize="sm">
                    {a.message}
                    {a.node_name ? ` (${a.node_name})` : ""}
                  </Text>
                ))}
              </VStack>
            </Box>
          </Alert>
        )}

        {alertsData && alertsData.alerts.length === 0 && (
          <Text fontSize="sm" color="gray.500">
            {t("smartDns.noAlerts")}
          </Text>
        )}

        {isLoading && (
          <HStack>
            <Spinner size="sm" />
            <Text>…</Text>
          </HStack>
        )}

        {!isLoading && status && (!status.pools || status.pools.length === 0) && (
          <Text color="gray.500">{t("smartDns.noData")}</Text>
        )}

        {status?.pools?.map((pool) => (
          <Card key={pool.name} variant="outline" size="sm">
            <CardHeader py={2}>
              <Heading size="sm">
                {t("smartDns.pool")}: {pool.name}
              </Heading>
            </CardHeader>
            <CardBody pt={0}>
              <Table size="sm" variant="simple">
                <Thead>
                  <Tr>
                    <Th>{t("smartDns.node")}</Th>
                    <Th>{t("smartDns.status")}</Th>
                    <Th isNumeric>{t("smartDns.score")}</Th>
                    <Th isNumeric>{t("smartDns.conn")}</Th>
                    <Th isNumeric>{t("smartDns.bw")}</Th>
                    <Th isNumeric>{t("smartDns.cpu")}</Th>
                    <Th>IP</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {pool.nodes.map((n) => (
                    <Tr key={n.node_id}>
                      <Td fontWeight="medium">{n.node_name}</Td>
                      <Td>
                        <Badge colorScheme={n.is_up ? "green" : "red"}>
                          {n.is_up ? t("smartDns.up") : t("smartDns.down")}
                        </Badge>
                        {n.consecutive_failures > 0 && (
                          <Text as="span" fontSize="xs" color="gray.500" ml={1}>
                            ({n.consecutive_failures})
                          </Text>
                        )}
                      </Td>
                      <Td isNumeric>{n.score}</Td>
                      <Td isNumeric>{n.metrics?.active_connections ?? "—"}</Td>
                      <Td isNumeric>{n.metrics?.bandwidth_mbps ?? "—"}</Td>
                      <Td isNumeric>{n.metrics?.cpu ?? "—"}</Td>
                      <Td fontSize="xs">{n.announce_ip}</Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </CardBody>
          </Card>
        ))}

        {status && status.pools && status.pools.length > 0 && chartSeries[0].data.length > 0 && (
          <Card variant="outline">
            <CardHeader>
              <Heading size="sm">{t("smartDns.scoreChart")}</Heading>
            </CardHeader>
            <CardBody>
              <ReactApexChart
                options={chartOptions}
                series={chartSeries}
                type="bar"
                height={120 + chartSeries[0].data.length * 28}
              />
            </CardBody>
          </Card>
        )}
      </VStack>
    </Box>
  );
};
