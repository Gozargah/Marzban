import {
  Alert,
  AlertIcon,
  Box,
  Button,
  Collapse,
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerOverlay,
  Flex,
  FormControl,
  FormErrorMessage,
  FormHelperText,
  FormLabel,
  Grid,
  GridItem,
  HStack,
  IconButton,
  Select,
  Spinner,
  Switch,
  Text,
  Textarea,
  Tooltip,
  VStack,
  chakra,
  useBreakpointValue,
  useClipboard,
  useColorMode,
  useToast,
} from "@chakra-ui/react";
import { ChartPieIcon, ClipboardIcon, LinkIcon, PencilIcon, UserPlusIcon } from "@heroicons/react/24/outline";
import { InformationCircleIcon } from "@heroicons/react/24/solid";
import { zodResolver } from "@hookform/resolvers/zod";
import { UsageFilter, createUsageConfig } from "components/common/nodes/UsageFilter";
import { convertDateFormat } from "components/common/user/OnlineBadge";
import { Input } from "components/elements/Input";
import { RadioGroup } from "components/elements/RadioGroup";
import { queryClient } from "config/react-query";
import { resetStrategy } from "config/user-settings";
import { FilterUsageType, useDashboard } from "contexts/DashboardContext";
import dayjs from "dayjs";
import { FC, useEffect, useState } from "react";
import ReactApexChart from "react-apexcharts";
import ReactDatePicker from "react-datepicker";
import { Controller, FormProvider, useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import {
  GetInbounds200,
  UserCreate as UserCreateInterface,
  UserResponse,
  UserStatusModify,
  getGetUsersQueryKey,
  useAddUser,
  useGetInbounds,
  useGetUserUsage,
  useModifyUser,
} from "services/api";
import { ErrorType } from "services/http";
import { ProxyKeys, ProxyType, UserCreate, UserInbounds } from "types/User";
import { relativeExpiryDate } from "utils/dateFormatter";
import { z } from "zod";
import { DeleteIcon } from "./DeleteUserModal";

const AddUserIcon = chakra(UserPlusIcon, {
  baseStyle: {
    w: 5,
    h: 5,
  },
});

const InfoIcon = chakra(InformationCircleIcon);

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

const schema = z.object({
  username: z.string().min(1, { message: "Required" }),
  selected_proxies: z.array(z.string()).refine((value) => value.length > 0, {
    message: "userDialog.selectOneProtocol",
  }),
  note: z.string().nullable(),
  proxies: z.record(z.string(), z.record(z.string(), z.any())).transform((ins) => {
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
    .min(0, "The minimum number is 0")
    .or(z.number())
    .nullable()
    .transform((str) => {
      if (str) return Number((parseFloat(String(str)) * 1073741824).toFixed(5));
      return 0;
    }),
  expire: z.number().nullable(),
  data_limit_reset_strategy: z.string(),
  status: z.string(),
  inbounds: z.record(z.string(), z.array(z.string())).transform((ins) => {
    Object.keys(ins).forEach((protocol) => {
      if (Array.isArray(ins[protocol]) && !ins[protocol]?.length) delete ins[protocol];
    });
    return ins;
  }),
});

export type UserDialogProps = {};

export type FormType = Pick<UserCreate, keyof UserCreate> & {
  selected_proxies: ProxyKeys;
};

const defaultUser: FormType = {
  data_limit: null,
  expire: null,
  username: "",
  data_limit_reset_strategy: "no_reset",
  status: "active",
  note: "",
  proxies: {
    vless: { id: "", flow: "" },
    vmess: { id: "" },
    trojan: { password: "" },
    shadowsocks: { password: "", method: "chacha20-ietf-poly1305" },
  },
  inbounds: {},
  selected_proxies: [],
};
const formatUser = (user: Required<UserResponse>): FormType => {
  return {
    ...user,
    data_limit: user.data_limit ? Number((user.data_limit / 1073741824).toFixed(5)) : user.data_limit,
    selected_proxies: Object.keys(user.proxies) as ProxyKeys,
  };
};
const getDefaultValues = (defaultInbounds: GetInbounds200, user?: FormType): FormType => {
  const inbounds: UserInbounds = {};
  for (const key in defaultInbounds) {
    inbounds[key] = defaultInbounds[key].map((i) => i.tag);
  }
  if (!user)
    return {
      ...defaultUser,
      inbounds,
      selected_proxies: Object.keys(defaultInbounds) as ProxyKeys,
    };
  return user;
};

const mergeProxies = (proxyKeys: ProxyKeys, proxyType: ProxyType | undefined): ProxyType => {
  const proxies: ProxyType = proxyKeys.reduce((ac, a) => ({ ...ac, [a]: {} }), {});
  if (!proxyType) return proxies;
  proxyKeys.forEach((proxy) => {
    if (proxyType[proxy]) {
      proxies[proxy] = proxyType[proxy];
    }
  });
  return proxies;
};
export const UserDialog: FC<UserDialogProps> = () => {
  const { editingUser, isCreatingNewUser, onCreateUser, onEditingUser, onDeletingUser } = useDashboard();

  const isEditing = !!editingUser;
  const isOpen = isCreatingNewUser || isEditing;
  const [error, setError] = useState<string | null>("");
  const toast = useToast();
  const { t, i18n } = useTranslation();
  const { data: defaultInbounds = {} } = useGetInbounds({
    query: {
      onSuccess(data) {
        form.reset(getDefaultValues(data, editingUser ? formatUser(editingUser) : undefined));
      },
    },
  });

  const { colorMode } = useColorMode();

  const [usageVisible, setUsageVisible] = useState(false);
  const handleUsageToggle = () => {
    setUsageVisible((current) => !current);
  };

  const form = useForm<FormType>({
    defaultValues: getDefaultValues(defaultInbounds),
    resolver: zodResolver(schema),
  });

  const [dataLimit] = useWatch({
    control: form.control,
    name: ["data_limit"],
  });

  const usageTitle = t("userDialog.total");
  const [usage, setUsage] = useState(createUsageConfig(colorMode, usageTitle));
  const [usageFilter, setUsageFilter] = useState("1m");
  const [filters, setFilters] = useState<FilterUsageType>();
  useGetUserUsage(editingUser?.username || "", filters, {
    query: {
      onSuccess(data) {
        const labels = [];
        const series = [];
        for (const key in data.usages) {
          series.push(data.usages[key].used_traffic);
          labels.push(data.usages[key].node_name);
        }
        setUsage(createUsageConfig(colorMode, usageTitle, series, labels));
      },
      enabled: !!editingUser?.username,
    },
  });

  useEffect(() => {
    if (editingUser) {
      form.reset(formatUser(editingUser));
      setFilters({
        start: dayjs().utc().subtract(30, "day").format("YYYY-MM-DDTHH:00:00"),
      });
    }
  }, [editingUser]);

  const onSuccess = (data: UserResponse) => {
    toast({
      title: t(isEditing ? "userDialog.userEdited" : "userDialog.userCreated", {
        username: data.username,
      }),
      status: "success",
      isClosable: true,
      position: "top",
      duration: 3000,
    });
    onClose();
    queryClient.invalidateQueries(getGetUsersQueryKey());
  };
  const onError = (err: ErrorType<string | Record<string, string>>) => {
    if ((err?.response?.status === 409 || err?.response?.status === 400) && typeof err?.data?.detail === "string")
      setError(err?.data?.detail);
    if (err?.response?.status === 422 && typeof err?.data?.detail === "object") {
      Object.keys(err?.data.detail).forEach((key) => {
        setError((err?.data?.detail as Record<string, string>)[key] as string);
        form.setError(key as "proxies" | "username" | "data_limit" | "expire", {
          type: "custom",
          message: (err?.data?.detail as Record<string, string>)[key],
        });
      });
    }
  };

  const { mutate: createUser, isLoading: createLoading } = useAddUser<ErrorType<string | Record<string, string>>>({
    mutation: {
      onSuccess,
      onError,
    },
  });

  const { mutate: editUser, isLoading: editingLoading } = useModifyUser<ErrorType<string | Record<string, string>>>({
    mutation: {
      onSuccess,
      onError,
    },
  });

  const loading = createLoading || editingLoading;
  const submit = (values: FormType) => {
    setError(null);
    const { selected_proxies, ...rest } = values;
    let data: Omit<UserCreate, "data_limit" | "status"> & {
      data_limit: number | undefined;
      status: UserStatusModify;
    } = {
      ...rest,
      data_limit: values.data_limit || undefined,
      proxies: mergeProxies(selected_proxies, values.proxies),
      data_limit_reset_strategy:
        values.data_limit && values.data_limit > 0 ? values.data_limit_reset_strategy : "no_reset",
      status: values.status === "active" || values.status === "disabled" ? values.status : "active",
    };

    if (isEditing) {
      editUser({
        username: editingUser.username,
        data,
      });
    } else {
      createUser({
        data: data as UserCreateInterface,
      });
    }
  };

  const onClose = () => {
    setTimeout(() => {
      form.reset(getDefaultValues(defaultInbounds));
    }, 500);
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

  const lastSubUpdate = editingUser
    ? !editingUser.sub_updated_at
      ? "Never"
      : (relativeExpiryDate(convertDateFormat(editingUser.sub_updated_at), " and ").time || "0 min") + " ago"
    : null;
  const drawerPlacement = useBreakpointValue({
    base: "bottom",
    md: "right",
  }) as "bottom" | "right";

  const subscriptionURL = !!editingUser
    ? editingUser.subscription_url.startsWith("http")
      ? editingUser.subscription_url
      : window.location.origin + editingUser.subscription_url
    : "";
  const { onCopy: copySubscriptionLink, hasCopied: subCopied } = useClipboard(subscriptionURL);
  const { onCopy: copyConfigs, hasCopied: configsCopied } = useClipboard(
    !!editingUser ? editingUser.links.join("\n") : ""
  );

  return (
    <Drawer isOpen={isOpen} onClose={onClose} size="sm" placement={drawerPlacement}>
      <DrawerOverlay bg="blackAlpha.300" backdropFilter="blur(10px)" />
      <FormProvider {...form}>
        <form onSubmit={form.handleSubmit(submit)}>
          <DrawerContent bg="main-bg">
            <DrawerHeader pt={6}>
              <HStack gap={2}>
                {/* <Icon color="primary">
                  {isEditing ? <EditUserIcon color="white" /> : <AddUserIcon color="white" />}
                </Icon> */}
                <Text fontWeight="semibold" fontSize="lg">
                  {isEditing ? t("userDialog.editUserTitle") : t("createNewUser")}
                </Text>
              </HStack>
            </DrawerHeader>
            <DrawerCloseButton mt={3} disabled={disabled} />
            <DrawerBody>
              <Grid templateColumns="repeat(1, 1fr)" gap={3}>
                <GridItem>
                  <VStack justifyContent="space-between">
                    <Flex flexDirection="column" gridAutoRows="min-content" w="full">
                      <FormControl mb={"10px"}>
                        <FormLabel>{t("username")}</FormLabel>
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
                                      label={"status: " + field.value}
                                      textTransform="capitalize"
                                    >
                                      <Box>
                                        <Switch
                                          colorScheme="primary"
                                          disabled={field.value !== "active" && field.value !== "disabled"}
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
                                error={form.formState.errors.data_limit?.message}
                                value={field.value ? String(field.value) : ""}
                              />
                            );
                          }}
                        />
                      </FormControl>
                      <Collapse in={!!(dataLimit && dataLimit > 0)} animateOpacity style={{ width: "100%" }}>
                        <FormControl height="66px">
                          <FormLabel>{t("userDialog.periodicUsageReset")}</FormLabel>
                          <Controller
                            control={form.control}
                            name="data_limit_reset_strategy"
                            render={({ field }) => {
                              return (
                                <Select size="sm" {...field}>
                                  {resetStrategy.map((s) => {
                                    return (
                                      <option key={s.value} value={s.value}>
                                        {t("userDialog.resetStrategy" + s.title)}
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
                        <FormLabel>{t("userDialog.expiryDate")}</FormLabel>
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
                            const { status, time } = relativeExpiryDate(field.value);
                            return (
                              <>
                                <ReactDatePicker
                                  locale={i18n.language.toLocaleLowerCase()}
                                  dateFormat={t("dateFormat")}
                                  minDate={new Date()}
                                  selected={field.value ? createDateAsUTC(field.value) : undefined}
                                  onChange={(date: Date) => {
                                    field.onChange({
                                      target: {
                                        value: date
                                          ? dayjs(dayjs(date).set("hour", 23).set("minute", 59).set("second", 59))
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
                                      error={form.formState.errors.expire?.message}
                                      w="full"
                                    />
                                  }
                                />
                                {field.value ? <FormHelperText>{t(status, { time: time })}</FormHelperText> : ""}
                              </>
                            );
                          }}
                        />
                      </FormControl>

                      <FormControl mb={"10px"} isInvalid={!!form.formState.errors.note}>
                        <FormLabel>{t("userDialog.note")}</FormLabel>
                        <Textarea {...form.register("note")} />
                        <FormErrorMessage>{form.formState.errors?.note?.message}</FormErrorMessage>
                      </FormControl>
                    </Flex>
                    {error && (
                      <Alert status="error" display={{ base: "none", md: "flex" }}>
                        <AlertIcon />
                        {error}
                      </Alert>
                    )}
                  </VStack>
                </GridItem>
                <GridItem>
                  <FormControl isInvalid={!!form.formState.errors.selected_proxies?.message}>
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
                    <FormErrorMessage>{t(form.formState.errors.selected_proxies?.message as string)}</FormErrorMessage>
                  </FormControl>
                </GridItem>
                {isEditing && usageVisible && (
                  <GridItem pt={6} colSpan={{ base: 1 }}>
                    <VStack gap={4}>
                      <UsageFilter
                        defaultValue={usageFilter}
                        onChange={(filter, query) => {
                          setUsageFilter(filter);
                          setFilters(query);
                        }}
                      />
                      <Box width={{ base: "100%", md: "70%" }} justifySelf="center">
                        <ReactApexChart options={usage.options} series={usage.series} type="donut" />
                      </Box>
                    </VStack>
                  </GridItem>
                )}
              </Grid>
              {error && (
                <Alert mt="3" status="error" display={{ base: "flex", md: "none" }}>
                  <AlertIcon />
                  {error}
                </Alert>
              )}
            </DrawerBody>
            <DrawerFooter mt="3" display="flex" flexDirection="column" alignItems="start" gap={2}>
              {editingUser && (
                <Box as="span" fontSize="sm" _dark={{ color: "gray.300" }} color="black" pb="2">
                  <Text as="span" display="inline">
                    {!!editingUser.sub_updated_at
                      ? t("userDialog.subUpdated", {
                          time: lastSubUpdate,
                        })
                      : t("userDialog.subNeverUpdated")}
                  </Text>
                  {!!editingUser.sub_updated_at && (
                    <Tooltip
                      placement="top"
                      label={t("userDialog.subApp", {
                        app: (editingUser.sub_last_user_agent || "").split("/").join(", "),
                      })}
                    >
                      <InfoIcon transform="translate(3px, 5px)" display="inline" color="gray.400" width="18px" />
                    </Tooltip>
                  )}
                </Box>
              )}
              <VStack w="full">
                <HStack w="full" justify="space-between" flexWrap="wrap">
                  {isEditing && (
                    <>
                      <HStack>
                        <Tooltip label={t("userDialog.usage")} placement="top">
                          <IconButton aria-label="usage" size="sm" onClick={handleUsageToggle}>
                            <UserUsageIcon />
                          </IconButton>
                        </Tooltip>
                      </HStack>
                      <HStack flexWrap="wrap">
                        <Button onClick={handleResetUsage} size="sm">
                          {t("userDialog.resetUsage")}
                        </Button>
                        <Button onClick={handleRevokeSubscription} size="sm">
                          {t("userDialog.revokeSubscription")}
                        </Button>
                      </HStack>
                    </>
                  )}
                </HStack>
                <HStack justify="space-between" w="full">
                  {isEditing ? (
                    <HStack>
                      <Tooltip
                        label={subCopied ? t("usersTable.copied") : t("usersTable.copyLink")}
                        placement="top"
                        closeOnClick={false}
                      >
                        <IconButton aria-label={t("usersTable.copyLink")} size="sm" onClick={copySubscriptionLink}>
                          <LinkIcon width="20px" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip
                        label={configsCopied ? t("usersTable.copied") : t("usersTable.copyConfigs")}
                        placement="top"
                        closeOnClick={false}
                      >
                        <IconButton aria-label={t("usersTable.copyConfigs")} size="sm" onClick={copyConfigs}>
                          <ClipboardIcon width="20px" />
                        </IconButton>
                      </Tooltip>
                    </HStack>
                  ) : (
                    <span></span>
                  )}
                  <HStack>
                    {isEditing && (
                      <Tooltip label={t("delete")} placement="top">
                        <IconButton
                          aria-label="Delete"
                          size="sm"
                          onClick={() => {
                            onDeletingUser(editingUser);
                            onClose();
                          }}
                          colorScheme="red"
                          variant="outline"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    )}
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
              </VStack>
            </DrawerFooter>
          </DrawerContent>
        </form>
      </FormProvider>
    </Drawer>
  );
};
