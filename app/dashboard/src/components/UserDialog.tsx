import {
  Alert,
  AlertIcon,
  Box,
  Button,
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
import { FC, useEffect, useMemo, useState } from "react";
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
  UserDevice,
  UserDevicesResponse,
} from "types/User";
import { Bot } from "types/Bot";
import {
  GIB,
  bsExtraGbSchema,
  shouldSubmitBsExtra,
} from "utils/bsExtraForm";
import { relativeExpiryDate } from "utils/dateFormatter";
import { z } from "zod";
import { DeleteIcon } from "./DeleteUserModal";
import { Icon } from "./Icon";
import { Input } from "./Input";
import { RadioGroup } from "./RadioGroup";
import { UsageFilter, createUsageConfig } from "./UsageFilter";
import { ReloadIcon } from "./Filters";
import classNames from "classnames";
import { fetch } from "service/http";
import { DevicesModal } from "./DevicesModal";
import ReactSelect, { StylesConfig } from "react-select";
import { useBotSelectStyles } from "hooks/useBotSelectStyles";

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

export type FormType = Omit<UserCreate, "bs_extra"> & {
  selected_proxies: ProxyKeys;
  /** Купленный БС-трафик в ГБ (в API уходит как bs_extra в байтах) */
  bs_extra?: number | null;
  /** Пользователь менял поле — слать введённое, даже если цифра совпала с отображаемой */
  bs_extra_dirty?: boolean;
};

interface BotOption {
  value: string;
  label: string;
}

const formatUser = (user: User): FormType => {
  return {
    ...user,
    bot_username: user.bot_username ?? "",
    data_limit: user.data_limit
      ? Number((user.data_limit / GIB).toFixed(5))
      : user.data_limit,
    bs_extra:
      user.bs_monthly_limit_total != null && user.bs_monthly_limit_total > 0
        ? Number(((user.bs_extra_effective ?? 0) / GIB).toFixed(5))
        : null,
    bs_extra_dirty: false,
    device_limit: user.device_limit ?? null,
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
    bs_extra: null,
    bs_extra_dirty: false,
    device_limit: null,
    expire: null,
    username: "",
    data_limit_reset_strategy: "no_reset",
    status: "active",
    on_hold_expire_duration: null,
    note: "",
    bot_username: "",
    inbounds,
    proxies: {
      vless: { id: "", flow: "xtls-rprx-vision" },
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
  bot_username: z.string().nullable(),
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
      if (str) return Number((parseFloat(String(str)) * GIB).toFixed(5));
      return 0;
    }),
  bs_extra: bsExtraGbSchema,
  bs_extra_dirty: z.boolean().optional(),
  device_limit: z
    .string()
    .min(0)
    .or(z.number())
    .nullable()
    .transform((value) => {
      if (value) return Math.max(0, Number(value));
      return 0;
    }),
  expire: z.number().nullable(),
  data_limit_reset_strategy: z.string(),
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
  const botSelectStyles = useBotSelectStyles();

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
  const [devicesOpen, setDevicesOpen] = useState(false);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [deletingDeviceId, setDeletingDeviceId] = useState<number | null>(null);
  const [devicesError, setDevicesError] = useState<string | null>(null);
  const [devices, setDevices] = useState<UserDevice[]>([]);
  const [bots, setBots] = useState<Bot[]>([]);
  const botOptions = useMemo<BotOption[]>(
    () =>
      bots.map((bot) => ({
        value: bot.username,
        label: `@${bot.username}`,
      })),
    [bots]
  );

  const toast = useToast();
  const { t, i18n } = useTranslation();

  const { colorMode } = useColorMode();

  const [usageVisible, setUsageVisible] = useState(false);
  const handleUsageToggle = () => {
    setUsageVisible((current) => !current);
  };

  useEffect(() => {
    fetch<Bot[]>("/bots")
      .then(setBots)
      .catch(() => setBots([]));
  }, []);

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
    }
  }, [editingUser]);

  const submit = (values: FormType) => {
    setLoading(true);
    const methods = { edited: editUser, created: createUser };
    const method = isEditing ? "edited" : "created";
    setError(null);

    const { selected_proxies, bs_extra, bs_extra_dirty, ...rest } = values;

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
    if (isEditing && shouldSubmitBsExtra(bs_extra, bs_extra_dirty)) {
      body.bs_extra = bs_extra;
    }

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
    setDevicesOpen(false);
    setDevices([]);
    setDevicesError(null);
    setUsageVisible(false);
    setUsageFilter("1m");
  };

  const loadDevices = async () => {
    if (!editingUser) return;
    setDevicesLoading(true);
    setDevicesError(null);
    try {
      const res = await fetch<UserDevicesResponse>(
        `/user/${editingUser.username}/devices`,
        { method: "GET" }
      );
      setDevices(res.devices || []);
    } catch (err: any) {
      setDevicesError(
        err?.response?._data?.detail || t("userDialog.devicesLoadError")
      );
    } finally {
      setDevicesLoading(false);
    }
  };

  const openDevices = () => {
    setDevicesOpen(true);
    loadDevices();
  };

  const deleteDevice = async (deviceId: number) => {
    if (!editingUser) return;
    setDeletingDeviceId(deviceId);
    setDevicesError(null);
    try {
      await fetch(`/user/${editingUser.username}/devices/${deviceId}`, {
        method: "DELETE",
      });
      setDevices((prev) => prev.filter((device) => device.id !== deviceId));
      toast({
        title: t("userDialog.deviceDeleted"),
        status: "success",
        isClosable: true,
        position: "top",
        duration: 3000,
      });
    } catch (err: any) {
      setDevicesError(
        err?.response?._data?.detail || t("userDialog.deviceDeleteError")
      );
    } finally {
      setDeletingDeviceId(null);
    }
  };

  const handleResetUsage = () => {
    useDashboard.setState({ resetUsageUser: editingUser });
  };

  const handleRevokeSubscription = () => {
    useDashboard.setState({ revokeSubscriptionUser: editingUser });
  };

  const handleRotateAddresses = () => {
    useDashboard.setState({ rotateAddressesUser: editingUser });
  };

  const handleOpenAddressPins = () => {
    useDashboard.setState({ addressPinsUser: editingUser });
    // NPVPN-2072: форму закрываем намеренно, иначе диалог закреплений открылся бы
    // ВТОРОЙ модалкой поверх этой — а Chakra включает RemoveScroll только первой
    // (`enabled: index === 1 && blockScrollOnMount`). Лок первой модалки при этом
    // продолжает гасить wheel над чужим поддеревом, и журнал выдачи скроллился
    // только перетаскиванием полосы, но не колесом мыши.
    onClose();
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
    <>
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
                                          label={
                                            "status: " +
                                            t(`status.${field.value}`)
                                          }
                                          textTransform="capitalize"
                                        >
                                          <Box>
                                            <Switch
                                              colorScheme="primary"
                                              isChecked={
                                                field.value === "active"
                                              }
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
                        {isEditing &&
                          editingUser?.bs_monthly_limit_total != null &&
                          editingUser.bs_monthly_limit_total > 0 && (
                            <FormControl mb={"10px"}>
                              <FormLabel>{t("userDialog.bsDataLimit")}</FormLabel>
                              <Controller
                                control={form.control}
                                name="bs_extra"
                                render={({ field }) => {
                                  return (
                                    <Input
                                      endAdornment="GB"
                                      type="number"
                                      size="sm"
                                      borderRadius="6px"
                                      onChange={(v) => {
                                        form.setValue("bs_extra_dirty", true, {
                                          shouldValidate: false,
                                        });
                                        field.onChange(v);
                                      }}
                                      disabled={disabled}
                                      error={
                                        form.formState.errors.bs_extra?.message
                                      }
                                      value={
                                        field.value === null ||
                                        field.value === undefined
                                          ? ""
                                          : String(field.value)
                                      }
                                    />
                                  );
                                }}
                              />
                            </FormControl>
                          )}
                        <FormControl mb={"10px"}>
                          <FormLabel>{t("userDialog.deviceLimit")}</FormLabel>
                          <Controller
                            control={form.control}
                            name="device_limit"
                            render={({ field }) => {
                              return (
                                <Input
                                  endAdornment={t("userDialog.devicesUnit")}
                                  type="number"
                                  size="sm"
                                  borderRadius="6px"
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
                                        backgroundColor:
                                          colorMode === "dark"
                                            ? "#222C3B"
                                            : "white",
                                      },
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
                                    value={
                                      field.value ? String(field.value) : ""
                                    }
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
                                            form.formState.errors.expire
                                              ?.message
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

                        <FormControl
                          mb={"10px"}
                          isInvalid={!!form.formState.errors.bot_username}
                        >
                          {/* <FormLabel>{t("userDialog.botUsername")}</FormLabel>
                          <Select {...form.register("bot_username")}>
                            <option value="">{t("userDialog.noBot")}</option>
                            {bots.map((bot) => (
                              <option key={bot.id} value={bot.username}>
                                @{bot.username}
                              </option>
                            ))}
                          </Select> */}
                          <FormControl>
                            <FormLabel>{t("userDialog.botUsername")}</FormLabel>
                            <Controller
                              control={form.control}
                              name="bot_username"
                              render={({ field }) => (
                                <ReactSelect<BotOption>
                                  options={botOptions}
                                  value={
                                    botOptions.find(
                                      (o) => o.value === field.value
                                    ) ?? null
                                  }
                                  onChange={(option: BotOption | null) =>
                                    field.onChange(option?.value ?? "")
                                  }
                                  placeholder={t("botSettings.selectBot")}
                                  noOptionsMessage={() =>
                                    t("botSettings.noBotsFound")
                                  }
                                  isSearchable
                                  isClearable
                                  styles={botSelectStyles}
                                  menuPortalTarget={document.body}
                                  menuPosition="fixed"
                                />
                              )}
                            />
                            {/* <FormHelperText>
                              {t("userDialog.noBot")}
                            </FormHelperText> */}
                          </FormControl>
                          <FormHelperText>
                            {t("userDialog.botUsernameHint")}
                          </FormHelperText>
                          <FormErrorMessage>
                            {
                              form.formState.errors?.bot_username
                                ?.message as string
                            }
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
              <ModalFooter mt="3" flexDirection="column" gap={3}>
                {isEditing && (
                  /* NPVPN-2072: ряд действий переносится по мере нехватки ширины.
                     Раньше это был Grid с жёстко перечисленными колонками — каждая
                     новая кнопка выдавливала соседние за край модалки. */
                  <Flex w="full" gap={2} flexWrap="wrap" alignItems="center">
                    <Tooltip label={t("delete")} placement="top">
                      <IconButton
                        aria-label="Delete"
                        size="xs"
                        w="36px"
                        h="36px"
                        flexShrink={0}
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
                        size="xs"
                        w="36px"
                        h="36px"
                        flexShrink={0}
                        onClick={handleUsageToggle}
                      >
                        <UserUsageIcon />
                      </IconButton>
                    </Tooltip>
                    <Button onClick={handleResetUsage} size="sm" flex="1 1 140px">
                      {t("userDialog.resetUsage")}
                    </Button>
                    <Button
                      onClick={handleRevokeSubscription}
                      size="sm"
                      flex="1 1 140px"
                    >
                      {t("userDialog.revokeSubscription")}
                    </Button>
                    <Button onClick={openDevices} size="sm" flex="1 1 140px">
                      {t("userDialog.devicesButton")}
                    </Button>
                    <Button
                      onClick={handleRotateAddresses}
                      size="sm"
                      flex="1 1 140px"
                    >
                      {t("userDialog.rotateAddresses")}
                    </Button>
                    <Button
                      onClick={handleOpenAddressPins}
                      size="sm"
                      flex="1 1 140px"
                    >
                      {t("userDialog.addressPins")}
                    </Button>
                  </Flex>
                )}
                <HStack w="full" justify="flex-end">
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
              </ModalFooter>
            </form>
          </ModalContent>
        </FormProvider>
      </Modal>

      <Modal
        isOpen={devicesOpen}
        onClose={() => setDevicesOpen(false)}
        size="6xl"
      >
        <ModalOverlay bg="blackAlpha.300" backdropFilter="blur(10px)" />
        <ModalContent mx="3" w="fit-content" maxW="calc(100vw - 2rem)">
          <ModalHeader pt={6}>
            <HStack gap={2} justifyContent="space-between">
              <Text fontWeight="semibold" fontSize="lg">
                {t("userDialog.devicesTitle")}
              </Text>
            </HStack>
          </ModalHeader>
          <ModalCloseButton mt={3} />

          {/* <ModalBody overflowX="auto">
            {devicesError && (
              <Alert status="error" mb="3">
                <AlertIcon />
                {devicesError}
              </Alert>
            )}
            {devicesLoading ? (
              <Flex justifyContent="center" py="6">
                <Spinner />
              </Flex>
            ) : devices.length ? (
              <Box w="max-content" maxW="full" overflowX="auto">
                <Table
                  size="sm"
                  w="auto"
                  sx={{
                    tableLayout: "auto",
                    th: { whiteSpace: "nowrap", px: 2 },
                    td: {
                      whiteSpace: "nowrap",
                      px: 2,
                      verticalAlign: "top",
                    },
                  }}
                >
                <Thead>
                  <Tr>
                    <Th>HWID</Th>
                    <Th>{t("userDialog.deviceOs")}</Th>
                    <Th>{t("userDialog.deviceVerOs")}</Th>
                    <Th>{t("userDialog.deviceModel")}</Th>
                    <Th>User-Agent</Th>
                    <Th>{t("userDialog.deviceFirstSeen")}</Th>
                    <Th>{t("userDialog.deviceLastSeen")}</Th>
                    <Th>Status</Th>
                    <Th w="72px" textAlign="center" />
                  </Tr>
                </Thead>
                <Tbody>
                  {devices.map((device) => (
                    <Tr key={device.id}>
                      <Td>{device.hwid}</Td>
                      <Td>{device.device_os || "-"}</Td>
                      <Td>{device.ver_os || "-"}</Td>
                      <Td>{device.device_model || "-"}</Td>
                      <Td>{device.user_agent || "-"}</Td>
                      <Td>
                        {device.first_seen
                          ? dayjs(device.first_seen).format("YYYY-MM-DD HH:mm")
                          : "-"}
                      </Td>
                      <Td>
                        {device.last_seen
                          ? dayjs(device.last_seen).format("YYYY-MM-DD HH:mm")
                          : "-"}
                      </Td>
                      <Td>
                        <Text
                          color={
                            (device.status || "active").toLowerCase() === "active"
                              ? "green.500"
                              : (device.status || "").toLowerCase() === "revoked"
                                ? "red.500"
                                : "gray.500"
                          }
                          fontWeight="medium"
                        >
                          {device.status || "active"}
                        </Text>
                      </Td>
                      <Td textAlign="center">
                        <Tooltip label={t("delete")} placement="top">
                          <IconButton
                            aria-label={t("delete")}
                            size="xs"
                            variant="ghost"
                            colorScheme="red"
                            icon={<DeleteDeviceIcon />}
                            isLoading={deletingDeviceId === device.id}
                            onClick={() => deleteDevice(device.id)}
                          />
                        </Tooltip>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
                </Table>
              </Box>
            ) : (
              <Text color="gray.500">{t("userDialog.devicesEmpty")}</Text>
            )}
          </ModalBody> */}
          <DevicesModal
            devicesError={devicesError}
            devicesLoading={devicesLoading}
            devices={devices}
            deletingDeviceId={deletingDeviceId}
            editingUser={editingUser}
            setDeletingDeviceId={setDeletingDeviceId}
            setDevicesError={setDevicesError}
            setDevices={setDevices}
            toast={toast}
          />

          <ModalFooter>
            <HStack w="full" justify="flex-end">
              <Button
                size="sm"
                onClick={loadDevices}
                isLoading={devicesLoading}
              >
                {t("userDialog.devicesRefresh")}
              </Button>
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};
