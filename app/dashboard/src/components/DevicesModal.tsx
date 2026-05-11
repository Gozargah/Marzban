import {
  Badge,
  Box,
  Collapse,
  HStack,
  IconButton,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Select,
  Spinner,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  VStack,
  chakra,
  useColorModeValue,
} from "@chakra-ui/react";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  DevicePhoneMobileIcon,
} from "@heroicons/react/24/outline";
import { useDashboard } from "contexts/DashboardContext";
import { FC, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { fetch } from "service/http";
import { Icon } from "./Icon";

const DevicesIcon = chakra(DevicePhoneMobileIcon, {
  baseStyle: { w: 5, h: 5 },
});
const ChevronDown = chakra(ChevronDownIcon, { baseStyle: { w: 4, h: 4 } });
const ChevronRight = chakra(ChevronRightIcon, { baseStyle: { w: 4, h: 4 } });

type DeviceEntry = {
  hwid: string | null;
  ip: string;
  model: string | null;
  os: string | null;
  app: string;
  locale: string | null;
  status: number;
  last: string;
};

type UserDeviceRow = {
  username: string;
  device_count: number;
  hwid_count: number;
  flag: "ok" | "sharing" | "suspicious";
  last_seen: string | null;
  devices: DeviceEntry[];
};

type DevicesResponse = {
  minutes: number;
  generated: string;
  total_users: number;
  users: UserDeviceRow[];
  error?: string;
};

const FLAG_COLORS: Record<string, string> = {
  ok: "green",
  sharing: "yellow",
  suspicious: "red",
};

const MINUTE_OPTIONS = [
  { label: "30 min", value: 30 },
  { label: "1 hour", value: 60 },
  { label: "3 hours", value: 180 },
  { label: "6 hours", value: 360 },
  { label: "24 hours", value: 1440 },
];

function relativeTime(iso: string | null): string {
  if (!iso) return "-";
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const UserRow: FC<{ row: UserDeviceRow }> = ({ row }) => {
  const [open, setOpen] = useState(false);
  const subBg = useColorModeValue("gray.50", "gray.700");

  return (
    <>
      <Tr
        cursor="pointer"
        _hover={{ bg: useColorModeValue("gray.50", "gray.700") }}
        onClick={() => setOpen((o) => !o)}
      >
        <Td py={2} pr={1} w="6">
          <IconButton
            aria-label="expand"
            variant="ghost"
            size="xs"
            icon={open ? <ChevronDown /> : <ChevronRight />}
            onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
          />
        </Td>
        <Td py={2} fontWeight="medium" fontSize="sm">
          {row.username}
        </Td>
        <Td py={2} isNumeric fontSize="sm">
          {row.device_count}
        </Td>
        <Td py={2} isNumeric fontSize="sm">
          {row.hwid_count}
        </Td>
        <Td py={2}>
          <Badge colorScheme={FLAG_COLORS[row.flag]} fontSize="xs" borderRadius="md">
            {row.flag}
          </Badge>
        </Td>
        <Td py={2} fontSize="xs" color="gray.500">
          {relativeTime(row.last_seen)}
        </Td>
      </Tr>
      {open && (
        <Tr>
          <Td colSpan={6} p={0} bg={subBg}>
            <Collapse in={open} animateOpacity>
              <Box px={8} py={3}>
                <Table size="sm" variant="unstyled">
                  <Thead>
                    <Tr>
                      <Th fontSize="xs" color="gray.500">Model</Th>
                      <Th fontSize="xs" color="gray.500">OS</Th>
                      <Th fontSize="xs" color="gray.500">App</Th>
                      <Th fontSize="xs" color="gray.500">IP</Th>
                      <Th fontSize="xs" color="gray.500">HWID</Th>
                      <Th fontSize="xs" color="gray.500">Last</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {row.devices.map((d, i) => (
                      <Tr key={i}>
                        <Td fontSize="xs">{d.model || "-"}</Td>
                        <Td fontSize="xs">{d.os || "-"}</Td>
                        <Td fontSize="xs">{d.app || "-"}</Td>
                        <Td fontSize="xs" fontFamily="mono">{d.ip}</Td>
                        <Td fontSize="xs" fontFamily="mono" maxW="120px" isTruncated>
                          {d.hwid || "-"}
                        </Td>
                        <Td fontSize="xs">{relativeTime(d.last)}</Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </Box>
            </Collapse>
          </Td>
        </Tr>
      )}
    </>
  );
};

export const DevicesModal: FC = () => {
  const { isShowingDevices, onShowingDevices } = useDashboard();
  const { t } = useTranslation();
  const [minutes, setMinutes] = useState(60);
  const [data, setData] = useState<DevicesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadData = (m: number) => {
    setLoading(true);
    fetch(`/devices?minutes=${m}`)
      .then((d: DevicesResponse) => setData(d))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!isShowingDevices) return;
    loadData(minutes);
    intervalRef.current = setInterval(() => loadData(minutes), 30_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isShowingDevices, minutes]);

  const onClose = () => {
    onShowingDevices(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const suspicious = data?.users.filter((u) => u.flag === "suspicious").length ?? 0;
  const sharing = data?.users.filter((u) => u.flag === "sharing").length ?? 0;

  return (
    <Modal isOpen={isShowingDevices} onClose={onClose} size="5xl" scrollBehavior="inside">
      <ModalOverlay bg="blackAlpha.300" backdropFilter="blur(10px)" />
      <ModalContent mx="3" w="full">
        <ModalHeader pt={6}>
          <HStack gap={2} justify="space-between" flexWrap="wrap">
            <HStack gap={2}>
              <Icon color="primary">
                <DevicesIcon color="white" />
              </Icon>
              <Text fontWeight="semibold" fontSize="lg">
                {t("devices.title")}
              </Text>
              {loading && <Spinner size="sm" />}
            </HStack>
            <HStack gap={3} pr={8}>
              {suspicious > 0 && (
                <Badge colorScheme="red" fontSize="xs">
                  {suspicious} suspicious
                </Badge>
              )}
              {sharing > 0 && (
                <Badge colorScheme="yellow" fontSize="xs">
                  {sharing} sharing
                </Badge>
              )}
              <Select
                size="sm"
                w="120px"
                borderRadius="md"
                value={minutes}
                onChange={(e) => setMinutes(Number(e.target.value))}
              >
                {MINUTE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </HStack>
          </HStack>
        </ModalHeader>
        <ModalCloseButton mt={3} />
        <ModalBody pb={6}>
          {data?.error ? (
            <Text color="red.400" fontSize="sm">
              {data.error}
            </Text>
          ) : (
            <VStack align="stretch" gap={2}>
              <Text fontSize="xs" color="gray.500">
                {data ? `${data.total_users} users · last ${minutes} min` : ""}
              </Text>
              <Box overflowX="auto">
                <Table size="sm" variant="simple">
                  <Thead>
                    <Tr>
                      <Th w="6" />
                      <Th>{t("username")}</Th>
                      <Th isNumeric>{t("devices.devices")}</Th>
                      <Th isNumeric>HWID</Th>
                      <Th>{t("devices.flag")}</Th>
                      <Th>{t("devices.lastSeen")}</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {data?.users.map((row) => (
                      <UserRow key={row.username} row={row} />
                    ))}
                  </Tbody>
                </Table>
              </Box>
            </VStack>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};
