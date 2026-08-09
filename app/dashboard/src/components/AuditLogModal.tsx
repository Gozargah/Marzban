import {
  Badge,
  Box,
  Button,
  Collapse,
  HStack,
  IconButton,
  Input,
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
  VStack,
  chakra,
  useToast,
} from "@chakra-ui/react";
import {
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
} from "./PageOrModal";
import { ArrowPathIcon, ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/outline";
import { FC, Fragment, useEffect, useMemo, useState } from "react";
import { fetch } from "service/http";

const PAGE_SIZE = 25;

const RefreshIcon = chakra(ArrowPathIcon, { baseStyle: { w: 4, h: 4 } });
const DownIcon = chakra(ChevronDownIcon, { baseStyle: { w: 4, h: 4 } });
const UpIcon = chakra(ChevronUpIcon, { baseStyle: { w: 4, h: 4 } });

type AuditLogModalProps = { isOpen: boolean; onClose: () => void };

type AuditLog = {
  id: number;
  created_at: string;
  admin_username: string | null;
  action: string;
  target_type: string | null;
  target_name: string | null;
  method: string | null;
  path: string | null;
  status_code: number | null;
  ip: string | null;
  user_agent: string | null;
  details: Record<string, any> | null;
};

// Russian labels for the actions the backend records (app/utils/audit.py).
const ACTION_LABELS: Record<string, string> = {
  login: "Вход",
  login_failed: "Неудачный вход",
  user_create: "Создан юзер",
  user_modify: "Изменён юзер",
  user_delete: "Удалён юзер",
  user_reset: "Сброс трафика",
  user_revoke_sub: "Перевыпуск подписки",
  user_active_next: "Активирован next-plan",
  user_set_owner: "Смена владельца",
  user_group_limit: "Лимит группы юзеру",
  user_group_reset: "Сброс лимита группы",
  users_reset_all: "Сброс трафика всем",
  users_delete_expired: "Удаление истёкших",
  device_revoke: "Отозвано устройство",
  device_delete: "Удалено устройство",
  admin_create: "Создан админ",
  admin_modify: "Изменён админ",
  admin_delete: "Удалён админ",
  admin_users_disable: "Отключены юзеры админа",
  admin_users_activate: "Включены юзеры админа",
  admin_usage_reset: "Сброс статистики админа",
  node_create: "Добавлена нода",
  node_modify: "Изменена нода",
  node_delete: "Удалена нода",
  node_reconnect: "Реконнект ноды",
  hosts_modify: "Изменены хосты",
  core_restart: "Рестарт ядра",
  core_config: "Изменён конфиг ядра",
  host_group_create: "Создана группа",
  host_group_modify: "Изменена группа",
  host_group_delete: "Удалена группа",
  template_create: "Создан шаблон",
  template_modify: "Изменён шаблон",
  template_delete: "Удалён шаблон",
  yuku_settings: "Настройки панели",
  other: "Прочее",
};

const actionLabel = (action: string) => ACTION_LABELS[action] || action;

const actionColor = (action: string, status?: number | null) => {
  if (status && status >= 400) return "red";
  if (action === "login") return "green";
  if (action.endsWith("_delete") || action.startsWith("users_delete")) return "red";
  if (action.endsWith("_create")) return "blue";
  if (action.includes("reset") || action.includes("revoke")) return "orange";
  return "gray";
};

const formatTime = (iso: string) => {
  // backend stores naive UTC; render it in the browser's timezone
  const d = new Date(iso.endsWith("Z") ? iso : `${iso}Z`);
  return d.toLocaleString();
};

const DetailRow: FC<{ label: string; value: any }> = ({ label, value }) => (
  <HStack align="start" spacing={2} fontSize="xs">
    <Text minW="140px" color="gray.500">
      {label}
    </Text>
    <Text wordBreak="break-all" whiteSpace="pre-wrap">
      {typeof value === "object" && value !== null
        ? JSON.stringify(value, null, 1)
        : String(value)}
    </Text>
  </HStack>
);

/** before/after rendered as one line per changed field, plus any loose extras. */
const Details: FC<{ log: AuditLog }> = ({ log }) => {
  const d = log.details || {};
  const before = (d.before || {}) as Record<string, any>;
  const after = (d.after || {}) as Record<string, any>;
  const changedKeys = Array.from(
    new Set([...Object.keys(before), ...Object.keys(after)])
  ).sort();
  const extras = Object.entries(d).filter(
    ([k]) => k !== "before" && k !== "after"
  );

  return (
    <VStack align="stretch" spacing={1} py={2} pl={4}>
      <DetailRow label="Endpoint" value={`${log.method || ""} ${log.path || ""}`} />
      {log.user_agent && <DetailRow label="User-Agent" value={log.user_agent} />}
      {changedKeys.length > 0 && (
        <>
          <Text fontSize="xs" fontWeight="medium" mt={1}>
            Изменения
          </Text>
          {changedKeys.map((k) => (
            <HStack key={k} spacing={2} fontSize="xs" align="start">
              <Text minW="140px" color="gray.500">
                {k}
              </Text>
              <Text as="s" color="red.400" wordBreak="break-all">
                {JSON.stringify(before[k] ?? null)}
              </Text>
              <Text>→</Text>
              <Text color="green.400" wordBreak="break-all">
                {JSON.stringify(after[k] ?? null)}
              </Text>
            </HStack>
          ))}
        </>
      )}
      {extras.length > 0 && (
        <>
          <Text fontSize="xs" fontWeight="medium" mt={1}>
            Детали
          </Text>
          {extras.map(([k, v]) => (
            <DetailRow key={k} label={k} value={v} />
          ))}
        </>
      )}
      {changedKeys.length === 0 && extras.length === 0 && (
        <Text fontSize="xs" color="gray.500">
          Дополнительных данных нет.
        </Text>
      )}
    </VStack>
  );
};

export const AuditLogModal: FC<AuditLogModalProps> = ({ isOpen, onClose }) => {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [admins, setAdmins] = useState<string[]>([]);
  const [actions, setActions] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);

  const [adminFilter, setAdminFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const load = (targetPage = page) => {
    setLoading(true);
    const query: Record<string, any> = {
      offset: targetPage * PAGE_SIZE,
      limit: PAGE_SIZE,
    };
    if (adminFilter) query.admin = adminFilter;
    if (actionFilter) query.action = actionFilter;
    if (search) query.search = search;
    if (dateFrom) query.from = dateFrom;
    if (dateTo) query.to = dateTo;

    fetch("/audit-logs", { query })
      .then((d: any) => {
        setLogs(d.logs || []);
        setTotal(d.total || 0);
      })
      .catch(() =>
        toast({
          title: "Не удалось загрузить историю",
          status: "error",
          isClosable: true,
          duration: 3000,
          position: "top",
        })
      )
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!isOpen) return;
    setExpanded(null);
    fetch("/audit-logs/meta")
      .then((d: any) => {
        setAdmins(d.admins || []);
        setActions(d.actions || []);
      })
      .catch(() => {});
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    load(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, page, adminFilter, actionFilter, dateFrom, dateTo]);

  const pages = useMemo(() => Math.ceil(total / PAGE_SIZE) || 1, [total]);

  const applySearch = () => {
    setPage(0);
    load(0);
  };

  const resetFilters = () => {
    setAdminFilter("");
    setActionFilter("");
    setSearch("");
    setDateFrom("");
    setDateTo("");
    setPage(0);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="6xl" isCentered scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>📜 История действий админов</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack align="stretch" spacing={3}>
            <HStack spacing={2} wrap="wrap">
              <Select
                size="sm"
                maxW="180px"
                placeholder="Все админы"
                value={adminFilter}
                onChange={(e) => {
                  setPage(0);
                  setAdminFilter(e.target.value);
                }}
              >
                {admins.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </Select>

              <Select
                size="sm"
                maxW="220px"
                placeholder="Все действия"
                value={actionFilter}
                onChange={(e) => {
                  setPage(0);
                  setActionFilter(e.target.value);
                }}
              >
                {actions.map((a) => (
                  <option key={a} value={a}>
                    {actionLabel(a)}
                  </option>
                ))}
              </Select>

              <Input
                size="sm"
                maxW="220px"
                placeholder="Юзер / IP / путь"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applySearch()}
              />

              <Tooltip label="С даты">
                <Input
                  size="sm"
                  maxW="185px"
                  type="datetime-local"
                  value={dateFrom}
                  onChange={(e) => {
                    setPage(0);
                    setDateFrom(e.target.value);
                  }}
                />
              </Tooltip>
              <Tooltip label="По дату">
                <Input
                  size="sm"
                  maxW="185px"
                  type="datetime-local"
                  value={dateTo}
                  onChange={(e) => {
                    setPage(0);
                    setDateTo(e.target.value);
                  }}
                />
              </Tooltip>

              <Button size="sm" onClick={applySearch}>
                Найти
              </Button>
              <Button size="sm" variant="ghost" onClick={resetFilters}>
                Сбросить
              </Button>
              <IconButton
                size="sm"
                aria-label="refresh"
                icon={<RefreshIcon />}
                onClick={() => load(page)}
              />
            </HStack>

            {loading ? (
              <HStack justify="center" py={8}>
                <Spinner />
              </HStack>
            ) : logs.length === 0 ? (
              <Text py={8} textAlign="center" color="gray.500">
                Записей нет.
              </Text>
            ) : (
              <Box overflowX="auto">
                <Table size="sm">
                  <Thead>
                    <Tr>
                      <Th w="10px"></Th>
                      <Th>Время</Th>
                      <Th>Админ</Th>
                      <Th>IP</Th>
                      <Th>Действие</Th>
                      <Th>Объект</Th>
                      <Th isNumeric>Код</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {logs.map((log) => (
                      <Fragment key={log.id}>
                        <Tr
                          cursor="pointer"
                          onClick={() =>
                            setExpanded(expanded === log.id ? null : log.id)
                          }
                          _hover={{ bg: "whiteAlpha.100" }}
                        >
                          <Td>{expanded === log.id ? <UpIcon /> : <DownIcon />}</Td>
                          <Td whiteSpace="nowrap" fontSize="xs">
                            {formatTime(log.created_at)}
                          </Td>
                          <Td fontSize="xs">{log.admin_username || "—"}</Td>
                          <Td fontSize="xs">{log.ip || "—"}</Td>
                          <Td>
                            <Badge colorScheme={actionColor(log.action, log.status_code)}>
                              {actionLabel(log.action)}
                            </Badge>
                          </Td>
                          <Td fontSize="xs">{log.target_name || "—"}</Td>
                          <Td isNumeric fontSize="xs">
                            {log.status_code ?? "—"}
                          </Td>
                        </Tr>
                        <Tr>
                          <Td colSpan={7} p={0} border="none">
                            <Collapse in={expanded === log.id} animateOpacity>
                              <Details log={log} />
                            </Collapse>
                          </Td>
                        </Tr>
                      </Fragment>
                    ))}
                  </Tbody>
                </Table>
              </Box>
            )}
          </VStack>
        </ModalBody>
        <ModalFooter>
          <HStack w="full" justify="space-between">
            <Text fontSize="sm" color="gray.500">
              Всего: {total}
            </Text>
            <HStack>
              <Button
                size="sm"
                isDisabled={page === 0}
                onClick={() => setPage((p) => Math.max(p - 1, 0))}
              >
                Назад
              </Button>
              <Text fontSize="sm">
                {page + 1} / {pages}
              </Text>
              <Button
                size="sm"
                isDisabled={page + 1 >= pages}
                onClick={() => setPage((p) => p + 1)}
              >
                Вперёд
              </Button>
              <Button size="sm" variant="ghost" onClick={onClose}>
                Закрыть
              </Button>
            </HStack>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
