import {
  Alert,
  AlertIcon,
  Button,
  chakra,
  FormControl,
  FormErrorMessage,
  FormHelperText,
  FormLabel,
  HStack,
  IconButton,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Spinner,
  Text,
  Tooltip,
  useToast,
  VStack,
  Select,
  Collapse,
  Flex,
  Switch,
  Box,
  Grid,
  GridItem,
  useColorMode,
} from "@chakra-ui/react";
import { PencilIcon, UserPlusIcon, ChartPieIcon } from "@heroicons/react/24/outline";
import { FilterUsageType, useDashboard } from "contexts/DashboardContext";
import { FC, useEffect, useState } from "react";
import { Controller, FormProvider, useForm, useWatch } from "react-hook-form";
import {
  ProxyKeys,
  ProxyType,
  User,
  UserCreate,
  UserInbounds,
} from "types/User";
import { z } from "zod";
import { Icon } from "./Icon";
import { RadioGroup } from "./RadioGroup";
import { Input } from "./Input";
import ReactDatePicker from "react-datepicker";
import dayjs from "dayjs";
import { zodResolver } from "@hookform/resolvers/zod";
import { relativeExpiryDate } from "utils/dateFormatter";
import { DeleteIcon } from "./DeleteUserModal";
import { resetStrategy } from "constants/UserSettings";
import { useTranslation } from "react-i18next";
import ReactApexChart from "react-apexcharts";
import { UsageFilter, createUsageConfig } from "./UsageFilter";

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

const schema = z.object({
  username: z.string().min(1, { message: "Required" }),
  selected_proxies: z.array(z.string()).refine((value) => value.length > 0, {
    message: "userDialog.selectOneProtocol",
  }),
  proxies: z.record(z.string(), z.record(z.string(), z.any())).transform((ins) => {
    const deleteIfEmpty = (obj: any, key: string) => {
      if (obj && obj[key] === "") {
        delete obj[key];
      }
    }
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
    })
    return ins;
  }),
});

export type UserDialogProps = {};

export type FormType = Pick<UserCreate, keyof UserCreate> & { selected_proxies: ProxyKeys };

const formatUser = (user: User): FormType => {
  return {
    ...user,
    data_limit: user.data_limit
      ? Number((user.data_limit / 1073741824).toFixed(5))
      : user.data_limit,
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
    expire: null,
    username: "",
    data_limit_reset_strategy: "no_reset",
    status: "active",
    inbounds,
    proxies: {
      vless: { id: "", flow: "" },
      vmess: { id: "" },
      trojan: { password: "" },
      shadowsocks: { password: "", method: "chacha20-poly1305" }
    }
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

  const [dataLimit] = useWatch({
    control: form.control,
    name: ["data_limit"],
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
  }

  useEffect(() => {
    if (editingUser) {
      form.reset(formatUser(editingUser));

      fetchUsageWithFilter({
        start: dayjs().utc().subtract(30, 'day').format("YYYY-MM-DDTHH:00:00")
      });
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
        values.status === "active" || values.status === "disabled"
          ? values.status
          : "active",
    };

    methods[method](body)
      .then(() => {
        toast({
          title: t(isEditing ? "userDialog.userEdited" : "userDialog.userCreated", { username: values.username }),
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

  const disabled = loading;

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
                  {isEditing ? t("userDialog.editUserTitle") : t("createNewUser")}
                </Text>
              </HStack>
            </ModalHeader>
            <ModalCloseButton mt={3} disabled={disabled} />
            <ModalBody>
              <Grid templateColumns={{ base: 'repeat(1, 1fr)', md: 'repeat(2, 1fr)' }} gap={3}>
                <GridItem>
                  <VStack justifyContent="space-between">
                    <Flex
                      flexDirection="column"
                      gridAutoRows="min-content"
                      w="full"
                    >
                      <FormControl mb={"10px"}>
                        <FormLabel>{t('username')}</FormLabel>
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
                                          disabled={
                                            field.value !== "active" &&
                                            field.value !== "disabled"
                                          }
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
                      <Collapse
                        in={!!(dataLimit && dataLimit > 0)}
                        animateOpacity
                        style={{ width: "100%" }}
                      >
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
                                dayjs(num * 1000)
                                  .utc()
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
                                  selected={
                                    field.value
                                      ? createDateAsUTC(field.value)
                                      : undefined
                                  }
                                  onChange={(date: Date) => {
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
                    isInvalid={!!form.formState.errors.selected_proxies?.message}
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
                      {t(form.formState.errors.selected_proxies?.message as string)}
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
                      <Box width={{ base: "100%", md: "70%" }} justifySelf="center">
                        <ReactApexChart options={usage.options} series={usage.series} type="donut" />
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
                            onDeletingUser(editingUser)
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
                    </>
                  )}
                </HStack>
                <HStack w="full" maxW={{ md: "50%", base: "full" }}>
                  <Button
                    onClick={onClose}
                    size="sm"
                    variant="outline"
                    w="full"
                    disabled={disabled}
                  >
                    {t("cancel")}
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    colorScheme="primary"
                    leftIcon={loading ? <Spinner size="xs" /> : undefined}
                    w="full"
                    disabled={disabled}
                  >
                    {isEditing ? t('userDialog.editUser') : t("createUser")}
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
