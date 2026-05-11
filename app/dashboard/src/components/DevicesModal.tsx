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
import useGetUser from "hooks/useGetUser";
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

type AdminEntry = {
  username: string;
  is_sudo: boolean;
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
  const hoverBg = useColorModeValue("gray.50", "gray.700");

  return (
    <>
      <Tr
        cursor="pointer"
        _hover={{ bg: hoverBg }}
        onClick={() => setOpen((o) => !o)}
      >
        <Td py={2} pr={1} w="6">
          <IconButton
            aria-label="expand"
            variant="ghost"
            size="xs"
            icon={open ? <ChevronDown /> : <ChevronRight />}
            onClick={(e) => {
              e.stopPropagation();
              setOpen((o) => !o);
            }}
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
          <Badge
            colorScheme={FLAG_COLORS[row.flag]}
            fontSize="xs"
            borderRadius="md"
          >
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
                      <Th fontSize="xs" color="gray.500">
                        Model
                      </Th>
                      <Th fontSize="xs" color="gray.500">
                        OS
                      </Th>
                      <Th fontSize="xs" color="gray.500">
                        App
                      </Th>
                      <Th fontSize="xs" color="gray.500">
                        IP
                      </Th>
                      <Th fontSize="xs" color="gray.500">
                        HWID
                      </Th>
                      <Th fontSize="xs" color="gray.500">
                        Last
                      </Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {row.devices.map((d, i) => (
                      <Tr key={i}>
                        <Td fontSize="xs">{d.model || "-"}</Td>
                        <Td fontSize="xs">{d.os || "-"}</Td>
                        <Td fontSize="xs">{d.app || "-"}</Td>
                        <Td fontSize="xs" fontFamily="mono">
                          {d.ip}
                        </Td>
                        <Td
                          fontSize="xs"
                          fontFamily="mono"
                          maxW="120px"
                          isTruncated
                        >
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
  const { userData, getUserIsSuccess, getUserIsPending } = useGetUser();
  const { t } = useTranslation();

  const isSudo =
    !getUserIsPending && getUserIsSuccess ? userData.is_sudo : false;

  const [minutes, setMinutes] = useState(60);
  const [filterAdmin, setFilterAdmin] = useState<string>("");
  const [adminList, setAdminList] = useState<AdminEntry[]>([]);
  const [data, setData] = useState<DevicesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const buildUrl = (m: number, fa: string) => {
    let url = `/devices?minutes=${m}`;
    if (isSudo && fa) url += `&filter_admin=${encodeURIComponent(fa)}`;
    return url;
  };

  const loadData = (m: number, fa: string) => {
    setLoading(true);
    fetch(buildUrl(m, fa))
      .then((d: DevicesResponse) => setData(d))
      .finally(() => setLoading(false));
  };

  // Fetch admin list once when sudo modal opens
  useEffect(() => {
    if (!isShowingDevices || !isSudo) return;
    fetch("/devices/admins").then((list: AdminEntry[]) => setAdminList(list));
  }, [isShowingDevices, isSudo]);

  // Load device data + set up auto-refresh
  useEffect(() => {
    if (!isShowingDevices) return;
    loadData(minutes, filterAdmin);
    intervalRef.current = setInterval(
      () => loadData(minutes, filterAdmin),
      30_000
    );
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isShowingDevices, minutes, filterAdmin]);

  const onClose = () => {
    onShowingDevices(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const suspicious =
    data?.users.filter((u) => u.flag === "suspicious").length ?? 0;
  const sharing = data?.users.filter((u) => u.flag === "sharing").length ?? 0;

  return (
    <Modal
      isOpen={isShowingDevices}
      onClose={onClose}
      size="5xl"
      scrollBehavior="inside"
    >
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
            <HStack gap={3} pr={8} flexWrap="wrap">
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
              {/* Admin filter — sudo only */}
              {isSudo && (
                <Select
                  size="sm"
                  w="150px"
                  borderRadius="md"
                  placeholder={t("devices.allAdmins")}
                  value={filterAdmin}
                  onChange={(e) => setFilterAdmin(e.target.value)}
                >
                  {adminList.map((a) => (
                    <option key={a.username} value={a.username}>
                      {a.username}
                      {a.is_sudo ? " ★" : ""}
                    </option>
                  ))}
                </Select>
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
                {data
                  ? `${data.total_users} ${t("devices.usersLabel")} · ${t("devices.lastLabel")} ${minutes} min`
                  : ""}
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
