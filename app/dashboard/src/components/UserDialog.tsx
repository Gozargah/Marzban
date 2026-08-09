import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  Checkbox,
  Collapse,
  Flex,
  FormControl,
  FormErrorMessage,
  FormHelperText,
  FormLabel,
  Grid,
  GridItem,
  HStack,
  IconButton,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  Spinner,
  Switch,
  Text,
  Textarea,
  Tooltip,
  VStack,
  chakra,
  useColorMode,
  useToast,
} from "@chakra-ui/react";
import {
  ChartPieIcon,
  PencilIcon,
  UserPlusIcon,
} from "@heroicons/react/24/outline";
import { zodResolver } from "@hookform/resolvers/zod";
import { resetStrategy } from "constants/UserSettings";
import { FilterUsageType, useDashboard } from "contexts/DashboardContext";
import dayjs from "dayjs";
import { FC, useEffect, useState } from "react";
import ReactApexChart from "react-apexcharts";
import ReactDatePicker from "react-datepicker";
import { Controller, FormProvider, useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import {
  ProxyKeys,
  ProxyType,
  User,
  UserCreate,
  UserInbounds,
} from "types/User";
import { relativeExpiryDate } from "utils/dateFormatter";
import { fetch } from "service/http";
import { z } from "zod";
import { DeleteIcon } from "./DeleteUserModal";
import { Icon } from "./Icon";
import { Input } from "./Input";
import { RadioGroup } from "./RadioGroup";
import { UsageFilter, createUsageConfig } from "./UsageFilter";
import { ReloadIcon } from "./Filters";
import classNames from "classnames";

const AddUserIcon = chakra(UserPlusIcon, {
  baseStyle: {
    w: 5,
    h: 5,
  },
});

const EditUserIcon = chakra(PencilIcon, {
  baseStyle: {
    w: 5,
    h: 5,
  },
});

const UserUsageIcon = chakra(ChartPieIcon, {
  baseStyle: {
    w: 5,
    h: 5,
  },
});

export type UserDialogProps = {};

export type FormType = Pick<UserCreate, keyof UserCreate> & {
  selected_proxies: ProxyKeys;
};

const formatUser = (user: User): FormType => {
  return {
    ...user,
    data_limit: user.data_limit
      ? Number((user.data_limit / 1073741824).toFixed(5))
      : user.data_limit,
    on_hold_expire_duration: user.on_hold_expire_duration
      ? Number(user.on_hold_expire_duration / (24 * 60 * 60))
      : user.on_hold_expire_duration,
    selected_proxies: Object.keys(user.proxies) as ProxyKeys,
  };
};
const getDefaultValues = (): FormType => {
  const defaultInbounds = Object.fromEntries(useDashboard.getState().inbounds);
  const inbounds: UserInbounds = {};
  for (const key in defaultInbounds) {
    inbounds[key] = defaultInbounds[key].map((i) => i.tag);
  }
  return {
    selected_proxies: Object.keys(defaultInbounds) as ProxyKeys,
    data_limit: null,
    device_limit: null,
    expire: null,
    username: "",
    data_limit_reset_strategy: "no_reset",
    status: "active",
    on_hold_expire_duration: null,
    note: "",
    inbounds,
    proxies: {
      vless: { id: "", flow: "" },
      vmess: { id: "" },
      trojan: { password: "" },
      shadowsocks: { password: "", method: "chacha20-ietf-poly1305" },
    },
  };
};

const mergeProxies = (
  proxyKeys: ProxyKeys,
  proxyType: ProxyType | undefined
): ProxyType => {
  const proxies: ProxyType = proxyKeys.reduce(
    (ac, a) => ({ ...ac, [a]: {} }),
    {}
  );
  if (!proxyType) return proxies;
  proxyKeys.forEach((proxy) => {
    if (proxyType[proxy]) {
      proxies[proxy] = proxyType[proxy];
    }
  });
  return proxies;
};

const baseSchema = {
  username: z.string().min(1, { message: "Required" }),
  selected_proxies: z.array(z.string()).refine((value) => value.length > 0, {
    message: "userDialog.selectOneProtocol",
  }),
  note: z.string().nullable(),
  proxies: z
    .record(z.string(), z.record(z.string(), z.any()))
    .transform((ins) => {
      const deleteIfEmpty = (obj: any, key: string) => {
        if (obj && obj[key] === "") {
          delete obj[key];
        }
      };
      deleteIfEmpty(ins.vmess, "id");
      deleteIfEmpty(ins.vless, "id");
      deleteIfEmpty(ins.trojan, "password");
      deleteIfEmpty(ins.shadowsocks, "password");
      deleteIfEmpty(ins.shadowsocks, "method");
      return ins;
    }),
  data_limit: z
    .string()
    .min(0)
    .or(z.number())
    .nullable()
    .transform((str) => {
      if (str) return Number((parseFloat(String(str)) * 1073741824).toFixed(5));
      return 0;
    }),
  expire: z.number().nullable(),
  data_limit_reset_strategy: z.string(),
  device_limit: z
    .string()
    .or(z.number())
    .nullable()
    .transform((v) => {
      if (v) return parseInt(String(v));
      return 0;
    }),
  inbounds: z.record(z.string(), z.array(z.string())).transform((ins) => {
    Object.keys(ins).forEach((protocol) => {
      if (Array.isArray(ins[protocol]) && !ins[protocol]?.length)
        delete ins[protocol];
    });
    return ins;
  }),
};

const schema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("active"),
    ...baseSchema,
  }),
  z.object({
    status: z.literal("disabled"),
    ...baseSchema,
  }),
  z.object({
    status: z.literal("limited"),
    ...baseSchema,
  }),
  z.object({
    status: z.literal("expired"),
    ...baseSchema,
  }),
  z.object({
    status: z.literal("on_hold"),
    on_hold_expire_duration: z.coerce
      .number()
      .min(0.1, "Required")
      .transform((d) => {
        return d * (24 * 60 * 60);
      }),
    ...baseSchema,
  }),
]);

export const UserDialog: FC<UserDialogProps> = () => {
  const {
    editingUser,
    isCreatingNewUser,
    onCreateUser,
    editUser,
    fetchUserUsage,
    onEditingUser,
    createUser,
    onDeletingUser,
  } = useDashboard();
  const isEditing = !!editingUser;
  const isOpen = isCreatingNewUser || isEditing;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>("");
  const toast = useToast();
  const { t, i18n } = useTranslation();

  const { colorMode } = useColorMode();

  const [usageVisible, setUsageVisible] = useState(false);
  const handleUsageToggle = () => {
    setUsageVisible((current) => !current);
  };

  type DeviceItem = {
    id: number;
    hwid: string;
    platform?: string | null;
    os_version?: string | null;
    device_model?: string | null;
    user_agent?: string | null;
    status?: string | null;
    created_at?: string | null;
    last_seen?: string | null;
  };
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const loadDevices = (username: string) => {
    setDevicesLoading(true);
    fetch(`/user/${username}/devices`)
      .then((data: any) => setDevices(data.devices || []))
      .catch(() => setDevices([]))
      .finally(() => setDevicesLoading(false));
  };
  const deleteDevice = (deviceId: number) => {
    if (!editingUser) return;
    fetch(`/user/${editingUser.username}/devices/${deviceId}`, { method: "DELETE" })
      .then(() => setDevices((prev) => prev.filter((d) => d.id !== deviceId)))
      .catch(() => {});
  };
  const revokeDevice = (deviceId: number) => {
    if (!editingUser) return;
    fetch(`/user/${editingUser.username}/devices/${deviceId}/revoke`, { method: "POST" })
      .then(() =>
        setDevices((prev) =>
          prev.map((d) => (d.id === deviceId ? { ...d, status: "revoked" } : d))
        )
      )
      .catch(() => {});
  };

  const GB = 1024 ** 3;
  type GroupUsage = {
    group_id: number;
    group_name: string;
    member: boolean;
    used_traffic: number;
    traffic_limit: number | null;
    group_default_limit: number | null;
    limit_override: number | null;
    limit_source: string;
  };
  const [groupUsages, setGroupUsages] = useState<GroupUsage[]>([]);
  const [groupInputs, setGroupInputs] = useState<Record<number, string>>({});
  const loadGroupUsages = (username: string) => {
    fetch(`/user/${username}/group-usage`)
      .then((data: any) => {
        const list: GroupUsage[] = data || [];
        setGroupUsages(list);
        const inputs: Record<number, string> = {};
        list.forEach((g) => {
          inputs[g.group_id] = g.limit_override
            ? String(Math.round((g.limit_override / GB) * 100) / 100)
            : "";
        });
        setGroupInputs(inputs);
      })
      .catch(() => setGroupUsages([]));
  };
  const saveGroupLimit = (groupId: number) => {
    if (!editingUser) return;
    const raw = groupInputs[groupId];
    const gb = parseFloat(raw);
    const traffic_limit = raw && !isNaN(gb) ? Math.round(gb * GB) : 0;
    fetch(`/user/${editingUser.username}/group/${groupId}`, {
      method: "PUT",
      body: { traffic_limit, set_limit: true },
    })
      .then(() => loadGroupUsages(editingUser.username))
      .catch(() => {});
  };
  const toggleGroupMember = (groupId: number, member: boolean) => {
    if (!editingUser) return;
    fetch(`/user/${editingUser.username}/group/${groupId}`, {
      method: "PUT",
      body: { member },
    })
      .then(() => loadGroupUsages(editingUser.username))
      .catch(() => {});
  };

  const form = useForm<FormType>({
    defaultValues: getDefaultValues(),
    resolver: zodResolver(schema),
  });

  useEffect(
    () =>
      useDashboard.subscribe(
        (state) => state.inbounds,
        () => {
          form.reset(getDefaultValues());
        }
      ),
    []
  );

  const [dataLimit, userStatus] = useWatch({
    control: form.control,
    name: ["data_limit", "status"],
  });

  const usageTitle = t("userDialog.total");
  const [usage, setUsage] = useState(createUsageConfig(colorMode, usageTitle));
  const [usageFilter, setUsageFilter] = useState("1m");
  const fetchUsageWithFilter = (query: FilterUsageType) => {
    fetchUserUsage(editingUser!, query).then((data: any) => {
      const labels = [];
      const series = [];
      for (const key in data.usages) {
        series.push(data.usages[key].used_traffic);
        labels.push(data.usages[key].node_name);
      }
      setUsage(createUsageConfig(colorMode, usageTitle, series, labels));
    });
  };

  useEffect(() => {
    if (editingUser) {
      form.reset(formatUser(editingUser));

      fetchUsageWithFilter({
        start: dayjs().utc().subtract(30, "day").format("YYYY-MM-DDTHH:00:00"),
      });

      loadDevices(editingUser.username);
      loadGroupUsages(editingUser.username);
    } else {
      setDevices([]);
      setGroupUsages([]);
    }
  }, [editingUser]);

  const submit = (values: FormType) => {
    setLoading(true);
    const methods = { edited: editUser, created: createUser };
    const method = isEditing ? "edited" : "created";
    setError(null);

    const { selected_proxies, ...rest } = values;

    let body: UserCreate = {
      ...rest,
      data_limit: values.data_limit,
      proxies: mergeProxies(selected_proxies, values.proxies),
      data_limit_reset_strategy:
        values.data_limit && values.data_limit > 0
          ? values.data_limit_reset_strategy
          : "no_reset",
      status:
        values.status === "active" ||
          values.status === "disabled" ||
          values.status === "on_hold"
          ? values.status
          : "active",
    };

    methods[method](body)
      .then(() => {
        toast({
          title: t(
            isEditing ? "userDialog.userEdited" : "userDialog.userCreated",
            { username: values.username }
          ),
          status: "success",
          isClosable: true,
          position: "top",
          duration: 3000,
        });
        onClose();
      })
      .catch((err) => {
        if (err?.response?.status === 409 || err?.response?.status === 400)
          setError(err?.response?._data?.detail);
        if (err?.response?.status === 422) {
          Object.keys(err.response._data.detail).forEach((key) => {
            setError(err?.response._data.detail[key] as string);
            form.setError(
              key as "proxies" | "username" | "data_limit" | "expire",
              {
                type: "custom",
                message: err.response._data.detail[key],
              }
            );
          });
        }
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const onClose = () => {
    form.reset(getDefaultValues());
    onCreateUser(false);
    onEditingUser(null);
    setError(null);
    setUsageVisible(false);
    setUsageFilter("1m");
  };

  const handleResetUsage = () => {
    useDashboard.setState({ resetUsageUser: editingUser });
  };

  const handleRevokeSubscription = () => {
    useDashboard.setState({ revokeSubscriptionUser: editingUser });
  };

  const disabled = loading;
  const isOnHold = userStatus === "on_hold";

  const [randomUsernameLoading, setrandomUsernameLoading] = useState(false);

  const createRandomUsername = (): string => {
    setrandomUsernameLoading(true);
    let result = "";
    const characters =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    const charactersLength = characters.length;
    let counter = 0;
    while (counter < 6) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
      counter += 1;
    }
    return result;
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="2xl">
      <ModalOverlay bg="blackAlpha.300" backdropFilter="blur(10px)" />
      <FormProvider {...form}>
        <ModalContent mx="3">
          <form onSubmit={form.handleSubmit(submit)}>
            <ModalHeader pt={6}>
              <HStack gap={2}>
                <Icon color="primary">
                  {isEditing ? (
                    <EditUserIcon color="white" />
                  ) : (
                    <AddUserIcon color="white" />
                  )}
                </Icon>
                <Text fontWeight="semibold" fontSize="lg">
                  {isEditing
                    ? t("userDialog.editUserTitle")
                    : t("createNewUser")}
                </Text>
              </HStack>
            </ModalHeader>
            <ModalCloseButton mt={3} disabled={disabled} />
            <ModalBody>
              <Grid
                templateColumns={{
                  base: "repeat(1, 1fr)",
                  md: "repeat(2, 1fr)",
                }}
                gap={3}
              >
                <GridItem>
                  <VStack justifyContent="space-between">
                    <Flex
                      flexDirection="column"
                      gridAutoRows="min-content"
                      w="full"
                    >
                      <Flex flexDirection="row" w="full" gap={2}>
                        <FormControl mb={"10px"}>
                          <FormLabel>
                            <Flex gap={2} alignItems={"center"}>
                              {t("username")}
                              {!isEditing && (
                                <ReloadIcon
                                  cursor={"pointer"}
                                  className={classNames({
                                    "animate-spin": randomUsernameLoading,
                                  })}
                                  onClick={() => {
                                    const randomUsername =
                                      createRandomUsername();
                                    form.setValue("username", randomUsername);
                                    setTimeout(() => {
                                      setrandomUsernameLoading(false);
                                    }, 350);
                                  }}
                                />
                              )}
                            </Flex>
                          </FormLabel>
                          <HStack>
                            <Input
                              size="sm"
                              type="text"
                              borderRadius="6px"
                              error={form.formState.errors.username?.message}
                              disabled={disabled || isEditing}
                              {...form.register("username")}
                            />
                            {isEditing && (
                              <HStack px={1}>
                                <Controller
                                  name="status"
                                  control={form.control}
                                  render={({ field }) => {
                                    return (
                                      <Tooltip
                                        placement="top"
                                        label={"status: " + t(`status.${field.value}`)}
                                        textTransform="capitalize"
                                      >
                                        <Box>
                                          <Switch
                                            colorScheme="primary"
                                            isChecked={field.value === "active"}
                                            onChange={(e) => {
                                              if (e.target.checked) {
                                                field.onChange("active");
                                              } else {
                                                field.onChange("disabled");
                                              }
                                            }}
                                          />
                                        </Box>
                                      </Tooltip>
                                    );
                                  }}
                                />
                              </HStack>
                            )}
                          </HStack>
                        </FormControl>
                        {!isEditing && (
                          <FormControl flex="1">
                            <FormLabel whiteSpace={"nowrap"}>
                              {t("userDialog.onHold")}
                            </FormLabel>
                            <Controller
                              name="status"
                              control={form.control}
                              render={({ field }) => {
                                const status = field.value;
                                return (
                                  <>
                                    {status ? (
                                      <Switch
                                        colorScheme="primary"
                                        isChecked={status === "on_hold"}
                                        onChange={(e) => {
                                          if (e.target.checked) {
                                            field.onChange("on_hold");
                                          } else {
                                            field.onChange("active");
                                          }
                                        }}
                                      />
                                    ) : (
                                      ""
                                    )}
                                  </>
                                );
                              }}
                            />
                          </FormControl>
                        )}
                      </Flex>
                      <FormControl mb={"10px"}>
                        <FormLabel>{t("userDialog.dataLimit")}</FormLabel>
                        <Controller
                          control={form.control}
                          name="data_limit"
                          render={({ field }) => {
                            return (
                              <Input
                                endAdornment="GB"
                                type="number"
                                size="sm"
                                borderRadius="6px"
                                onChange={field.onChange}
                                disabled={disabled}
                                error={
                                  form.formState.errors.data_limit?.message
                                }
                                value={field.value ? String(field.value) : ""}
                              />
                            );
                          }}
                        />
                      </FormControl>
                      <Collapse
                        in={!!(dataLimit && dataLimit > 0)}
                        animateOpacity
                        style={{ width: "100%" }}
                      >
                        <FormControl height="66px">
                          <FormLabel>
                            {t("userDialog.periodicUsageReset")}
                          </FormLabel>
                          <Controller
                            control={form.control}
                            name="data_limit_reset_strategy"
                            render={({ field }) => {
                              return (
                                <Select
                                  size="sm"
                                  {...field}
                                  disabled={disabled}
                                  bg={disabled ? "gray.100" : "transparent"}
                                  _dark={{
                                    bg: disabled ? "gray.600" : "transparent",
                                  }}
                                  sx={{
                                    option: {
                                      backgroundColor: colorMode === "dark" ? "#222C3B" : "white"
                                    }
                                  }}
                                >
                                  {resetStrategy.map((s) => {
                                    return (
                                      <option key={s.value} value={s.value}>
                                        {t(
                                          "userDialog.resetStrategy" + s.title
                                        )}
                                      </option>
                                    );
                                  })}
                                </Select>
                              );
                            }}
                          />
                        </FormControl>
                      </Collapse>

                      <FormControl mb={"10px"}>
                        <FormLabel>{t("userDialog.deviceLimit")}</FormLabel>
                        <Controller
                          control={form.control}
                          name="device_limit"
                          render={({ field }) => {
                            return (
                              <Input
                                endAdornment={t("userDialog.devices")}
                                type="number"
                                size="sm"
                                borderRadius="6px"
                                placeholder="0 = ∞"
                                onChange={field.onChange}
                                disabled={disabled}
                                error={
                                  form.formState.errors.device_limit?.message
                                }
                                value={field.value ? String(field.value) : ""}
                              />
                            );
                          }}
                        />
                      </FormControl>

                      {isEditing && (
                        <FormControl mb={"10px"}>
                          <FormLabel>
                            {t("userDialog.devicesList")} (
                            {devices.filter((d) => d.status !== "revoked").length})
                          </FormLabel>
                          {devicesLoading ? (
                            <Spinner size="sm" />
                          ) : devices.length === 0 ? (
                            <Text fontSize="xs" color="gray.500">
                              {t("userDialog.noDevices")}
                            </Text>
                          ) : (
                            <VStack align="stretch" spacing="4px">
                              {devices.map((d) => {
                                const revoked = d.status === "revoked";
                                const fmt = (s?: string | null) => {
                                  if (!s) return "—";
                                  const dt = new Date(s);
                                  return isNaN(dt.getTime())
                                    ? s
                                    : dt.toLocaleString();
                                };
                                const rows: [string, string][] = [
                                  [t("userDialog.deviceHwid"), d.hwid || "—"],
                                  [t("userDialog.deviceModel"), d.device_model || "—"],
                                  [t("userDialog.deviceOs"), d.platform || "—"],
                                  [t("userDialog.deviceOsVer"), d.os_version || "—"],
                                  [t("userDialog.deviceUserAgent"), d.user_agent || "—"],
                                  [t("userDialog.deviceFirstSeen"), fmt(d.created_at)],
                                  [t("userDialog.deviceLastSeen"), fmt(d.last_seen)],
                                ];
                                return (
                                  <Box
                                    key={d.id}
                                    borderWidth="1px"
                                    borderRadius="6px"
                                    px="10px"
                                    py="8px"
                                    opacity={revoked ? 0.55 : 1}
                                  >
                                    <HStack justify="space-between" align="start" mb="6px">
                                      <HStack spacing="6px" overflow="hidden">
                                        <Text fontSize="sm" fontWeight="600" noOfLines={1}>
                                          {d.device_model || d.hwid}
                                        </Text>
                                        {revoked && (
                                          <Badge colorScheme="red" fontSize="9px">
                                            {t("userDialog.deviceRevoked")}
                                          </Badge>
                                        )}
                                      </HStack>
                                      <HStack spacing="4px" flexShrink={0}>
                                        {!revoked && (
                                          <Tooltip
                                            label={t("userDialog.revokeDevice")}
                                            placement="top"
                                          >
                                            <IconButton
                                              aria-label="revoke device"
                                              size="sm"
                                              variant="outline"
                                              colorScheme="orange"
                                              icon={<Text fontSize="18px" lineHeight="1">⊘</Text>}
                                              onClick={() => revokeDevice(d.id)}
                                            />
                                          </Tooltip>
                                        )}
                                        <Tooltip label={t("delete")} placement="top">
                                          <IconButton
                                            aria-label="delete device"
                                            size="sm"
                                            variant="outline"
                                            colorScheme="red"
                                            icon={<DeleteIcon />}
                                            onClick={() => deleteDevice(d.id)}
                                          />
                                        </Tooltip>
                                      </HStack>
                                    </HStack>
                                    <VStack align="stretch" spacing="1px">
                                      {rows.map(([label, value]) => (
                                        <HStack
                                          key={label}
                                          align="start"
                                          spacing="6px"
                                          fontSize="11px"
                                        >
                                          <Text color="gray.500" flexShrink={0} minW="84px">
                                            {label}
                                          </Text>
                                          <Text
                                            wordBreak="break-all"
                                            color="gray.700"
                                            _dark={{ color: "gray.300" }}
                                          >
                                            {value}
                                          </Text>
                                        </HStack>
                                      ))}
                                    </VStack>
                                  </Box>
                                );
                              })}
                            </VStack>
                          )}
                        </FormControl>
                      )}

                      {isEditing && groupUsages.length > 0 && (
                        <FormControl mb={"10px"}>
                          <FormLabel>{t("userDialog.groupLimits")}</FormLabel>
                          <VStack align="stretch" spacing="6px">
                            {groupUsages.map((g) => {
                              const usedGb =
                                Math.round((g.used_traffic / (1024 ** 3)) * 100) / 100;
                              const limitGb = g.traffic_limit
                                ? Math.round((g.traffic_limit / (1024 ** 3)) * 100) / 100
                                : null;
                              return (
                                <Box
                                  key={g.group_id}
                                  borderWidth="1px"
                                  borderRadius="6px"
                                  px="10px"
                                  py="8px"
                                >
                                  <HStack justify="space-between" mb="4px">
                                    <Checkbox
                                      isChecked={g.member}
                                      onChange={(e) =>
                                        toggleGroupMember(g.group_id, e.target.checked)
                                      }
                                    >
                                      <Text fontSize="sm" fontWeight="600">
                                        {g.group_name}
                                      </Text>
                                    </Checkbox>
                                    <Text fontSize="11px" color="gray.500">
                                      {usedGb} / {limitGb ?? "∞"} ГБ
                                      {g.limit_source === "user" && (
                                        <Badge ml="6px" colorScheme="purple" fontSize="9px">
                                          {t("userDialog.groupOverride")}
                                        </Badge>
                                      )}
                                    </Text>
                                  </HStack>
                                  <HStack>
                                    <Input
                                      size="xs"
                                      type="number"
                                      placeholder={
                                        g.group_default_limit
                                          ? `${Math.round((g.group_default_limit / (1024 ** 3)) * 100) / 100} (по умолч.)`
                                          : "0 = безлимит"
                                      }
                                      value={groupInputs[g.group_id] ?? ""}
                                      onChange={(e: any) =>
                                        setGroupInputs((prev) => ({
                                          ...prev,
                                          // custom Input passes a string for
                                          // type=number, an event otherwise
                                          [g.group_id]:
                                            typeof e === "string"
                                              ? e
                                              : e?.target?.value ?? "",
                                        }))
                                      }
                                    />
                                    <Button
                                      size="xs"
                                      onClick={() => saveGroupLimit(g.group_id)}
                                    >
                                      {t("userDialog.groupSetLimit")}
                                    </Button>
                                  </HStack>
                                </Box>
                              );
                            })}
                          </VStack>
                          <Text fontSize="10px" color="gray.500" mt="4px">
                            {t("userDialog.groupLimitsHint")}
                          </Text>
                        </FormControl>
                      )}

                      <FormControl mb={"10px"}>
                        <FormLabel>
                          {isOnHold
                            ? t("userDialog.onHoldExpireDuration")
                            : t("userDialog.expiryDate")}
                        </FormLabel>

                        {isOnHold && (
                          <Controller
                            control={form.control}
                            name="on_hold_expire_duration"
                            render={({ field }) => {
                              return (
                                <Input
                                  endAdornment="Days"
                                  type="number"
                                  size="sm"
                                  borderRadius="6px"
                                  onChange={(on_hold) => {
                                    form.setValue("expire", null);
                                    field.onChange({
                                      target: {
                                        value: on_hold,
                                      },
                                    });
                                  }}
                                  disabled={disabled}
                                  error={
                                    form.formState.errors
                                      .on_hold_expire_duration?.message
                                  }
                                  value={field.value ? String(field.value) : ""}
                                />
                              );
                            }}
                          />
                        )}
                        {!isOnHold && (
                          <Controller
                            name="expire"
                            control={form.control}
                            render={({ field }) => {
                              function createDateAsUTC(num: number) {
                                return dayjs(
                                  dayjs(num * 1000).utc()
                                  // .format("MMMM D, YYYY") // exception with: dayjs.locale(lng);
                                ).toDate();
                              }
                              const { status, time } = relativeExpiryDate(
                                field.value
                              );
                              return (
                                <>
                                  <ReactDatePicker
                                    locale={i18n.language.toLocaleLowerCase()}
                                    dateFormat={t("dateFormat")}
                                    minDate={new Date()}
                                    selected={
                                      field.value
                                        ? createDateAsUTC(field.value)
                                        : undefined
                                    }
                                    onChange={(date: Date) => {
                                      form.setValue(
                                        "on_hold_expire_duration",
                                        null
                                      );
                                      field.onChange({
                                        target: {
                                          value: date
                                            ? dayjs(
                                              dayjs(date)
                                                .set("hour", 23)
                                                .set("minute", 59)
                                                .set("second", 59)
                                            )
                                              .utc()
                                              .valueOf() / 1000
                                            : 0,
                                          name: "expire",
                                        },
                                      });
                                    }}
                                    customInput={
                                      <Input
                                        size="sm"
                                        type="text"
                                        borderRadius="6px"
                                        clearable
                                        disabled={disabled}
                                        error={
                                          form.formState.errors.expire?.message
                                        }
                                      />
                                    }
                                  />
                                  {field.value ? (
                                    <FormHelperText>
                                      {t(status, { time: time })}
                                    </FormHelperText>
                                  ) : (
                                    ""
                                  )}
                                </>
                              );
                            }}
                          />
                        )}
                      </FormControl>

                      <FormControl
                        mb={"10px"}
                        isInvalid={!!form.formState.errors.note}
                      >
                        <FormLabel>{t("userDialog.note")}</FormLabel>
                        <Textarea {...form.register("note")} />
                        <FormErrorMessage>
                          {form.formState.errors?.note?.message}
                        </FormErrorMessage>
                      </FormControl>
                    </Flex>
                    {error && (
                      <Alert
                        status="error"
                        display={{ base: "none", md: "flex" }}
                      >
                        <AlertIcon />
                        {error}
                      </Alert>
                    )}
                  </VStack>
                </GridItem>
                <GridItem>
                  <FormControl
                    isInvalid={
                      !!form.formState.errors.selected_proxies?.message
                    }
                  >
                    <FormLabel>{t("userDialog.protocols")}</FormLabel>
                    <Controller
                      control={form.control}
                      name="selected_proxies"
                      render={({ field }) => {
                        return (
                          <RadioGroup
                            list={[
                              {
                                title: "vmess",
                                description: t("userDialog.vmessDesc"),
                              },
                              {
                                title: "vless",
                                description: t("userDialog.vlessDesc"),
                              },
                              {
                                title: "trojan",
                                description: t("userDialog.trojanDesc"),
                              },
                              {
                                title: "shadowsocks",
                                description: t("userDialog.shadowsocksDesc"),
                              },
                            ]}
                            disabled={disabled}
                            {...field}
                          />
                        );
                      }}
                    />
                    <FormErrorMessage>
                      {t(
                        form.formState.errors.selected_proxies
                          ?.message as string
                      )}
                    </FormErrorMessage>
                  </FormControl>
                </GridItem>
                {isEditing && usageVisible && (
                  <GridItem pt={6} colSpan={{ base: 1, md: 2 }}>
                    <VStack gap={4}>
                      <UsageFilter
                        defaultValue={usageFilter}
                        onChange={(filter, query) => {
                          setUsageFilter(filter);
                          fetchUsageWithFilter(query);
                        }}
                      />
                      <Box
                        width={{ base: "100%", md: "70%" }}
                        justifySelf="center"
                      >
                        <ReactApexChart
                          options={usage.options}
                          series={usage.series}
                          type="donut"
                        />
                      </Box>
                    </VStack>
                  </GridItem>
                )}
              </Grid>
              {error && (
                <Alert
                  mt="3"
                  status="error"
                  display={{ base: "flex", md: "none" }}
                >
                  <AlertIcon />
                  {error}
                </Alert>
              )}
            </ModalBody>
            <ModalFooter mt="3">
              <HStack
                justifyContent="space-between"
                w="full"
                gap={3}
                flexDirection={{
                  base: "column",
                  sm: "row",
                }}
              >
                <HStack
                  justifyContent="flex-start"
                  w={{
                    base: "full",
                    sm: "unset",
                  }}
                >
                  {isEditing && (
                    <>
                      <Tooltip label={t("delete")} placement="top">
                        <IconButton
                          aria-label="Delete"
                          size="sm"
                          onClick={() => {
                            onDeletingUser(editingUser);
                            onClose();
                          }}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip label={t("userDialog.usage")} placement="top">
                        <IconButton
                          aria-label="usage"
                          size="sm"
                          onClick={handleUsageToggle}
                        >
                          <UserUsageIcon />
                        </IconButton>
                      </Tooltip>
                      <Button onClick={handleResetUsage} size="sm">
                        {t("userDialog.resetUsage")}
                      </Button>
                      <Button onClick={handleRevokeSubscription} size="sm">
                        {t("userDialog.revokeSubscription")}
                      </Button>
                    </>
                  )}
                </HStack>
                <HStack
                  w="full"
                  maxW={{ md: "50%", base: "full" }}
                  justify="end"
                >
                  <Button
                    type="submit"
                    size="sm"
                    px="8"
                    colorScheme="primary"
                    leftIcon={loading ? <Spinner size="xs" /> : undefined}
                    disabled={disabled}
                  >
                    {isEditing ? t("userDialog.editUser") : t("createUser")}
                  </Button>
                </HStack>
              </HStack>
            </ModalFooter>
          </form>
        </ModalContent>
      </FormProvider>
    </Modal>
  );
};
