import { Box } from "@chakra-ui/react";
import {
  Card,
  CategoryBar,
  ColGrid,
  Flex,
  Legend,
  Metric,
  ProgressBar,
  Text,
} from "@tremor/react";
import "@tremor/react/dist/esm/tremor.css";

import useSWR from "swr";
export type SystemInfo = {
  cpu_percent: number;
  mem_total: number;
  mem_used: number;
  mem_percent: number;
  uptime: number;
  total_user: number;
  users_active: number;
  incoming_bandwidth: number;
  outgoing_bandwith: number;
};

export const Header = () => {
  const { data: system } = useSWR<SystemInfo>("/system", {
    revalidateIfStale: true,
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    refreshInterval: 5000,
  });
  if (system) {
    const totalBandWidth = system.incoming_bandwidth + system.outgoing_bandwith;

    return (
      <Box
        p={4}
        __css={{
          _dark: {
            "& .tr-bg-blue-100": {
              bg: "whiteAlpha.700",
            },
            "& > div > div": {
              bg: "gray.800",
              "--tw-ring-color": "var(--chakra-colors-whiteAlpha-300)",
              "& > div > p.tr-font-semibold": {
                color: "whiteAlpha.800",
              },
            },
          },
        }}
      >
        <ColGrid numColsMd={2} numColsLg={3} gapX="gap-x-6" gapY="gap-y-6">
          <Card>
            <Flex>
              <Text>Total Users</Text>
            </Flex>
            <Metric>{system.total_user}</Metric>
            <div className="total_users">
              <CategoryBar
                categoryPercentageValues={[
                  Number(
                    (
                      (system.users_active / Math.max(system.total_user, 1)) *
                      100
                    ).toFixed(2)
                  ),
                  Number(
                    (
                      ((system.total_user - system.users_active) /
                        Math.max(system.total_user, 1)) *
                      100
                    ).toFixed(2)
                  ),
                ]}
                colors={["emerald", "red"]}
                marginTop="mt-4"
              />
            </div>
            <Legend
              categories={["Active users", "Inactive users"]}
              colors={["emerald", "red"]}
              marginTop="mt-3"
            />
          </Card>
          <Card>
            <Flex>
              <Text>Memory Usage</Text>
            </Flex>
            <Metric>
              {((system.mem_used / system.mem_total) * 100).toFixed(1)}%
            </Metric>
            <Flex marginTop="mt-4">
              <Text truncate={true}>{`${(
                (system.mem_used / system.mem_total) *
                100
              ).toFixed(1)}% (${(system.mem_used / 1073741824).toFixed(
                1
              )} GB)`}</Text>
              <Text>{(system.mem_total / 1073741824).toFixed(0)} GB</Text>
            </Flex>
            <ProgressBar
              percentageValue={(system.mem_used / system.mem_total) * 100}
              marginTop="mt-2"
            />
          </Card>
          <Card>
            <Text>Bandwidth Usage</Text>
            <Metric>{(totalBandWidth / 1073741824).toFixed(2)} GB</Metric>
            <CategoryBar
              categoryPercentageValues={[
                parseFloat(
                  (
                    (system.incoming_bandwidth / Math.max(totalBandWidth, 1)) *
                    100
                  ).toFixed(1)
                ),
                parseFloat(
                  (
                    (system.outgoing_bandwith / Math.max(totalBandWidth, 1)) *
                    100
                  ).toFixed(1)
                ),
              ]}
              colors={["indigo", "yellow"]}
              marginTop="mt-4"
            />
            <Legend
              categories={["Income", "Out going"]}
              colors={["indigo", "yellow"]}
              marginTop="mt-3"
            />
          </Card>
        </ColGrid>
      </Box>
    );
  }
  return <></>;
};
