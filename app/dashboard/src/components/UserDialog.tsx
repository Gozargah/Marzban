import {
  Alert,
  AlertIcon,
  Box,
  Button,
  Center,
  Input as ChakraInput,
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
  InputGroup,
  InputLeftElement,
  InputRightElement,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Popover,
  PopoverArrow,
  PopoverContent,
  PopoverTrigger,
  Select,
  SimpleGrid,
  Spinner,
  Switch,
  Tag,
  TagCloseButton,
  TagLabel,
  TagLeftIcon,
  Text,
  Tooltip,
  VStack,
  chakra,
  useColorMode,
  useDisclosure,
  useToast,
} from "@chakra-ui/react";
import {
  ArrowPathRoundedSquareIcon,
  Bars3Icon,
  ChartPieIcon,
  InformationCircleIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  PlusIcon,
  RssIcon,
  UserPlusIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { zodResolver } from "@hookform/resolvers/zod";
import { ReactComponent as AddTagIcon } from "assets/add_tag.svg";
import { resetStrategy } from "constants/UserSettings";
import { ProxyTag, useClash } from "contexts/ClashContext";
import { FilterUsageType, useDashboard } from "contexts/DashboardContext";
import dayjs from "dayjs";
import { FC, useEffect, useRef, useState } from "react";
import ReactApexChart from "react-apexcharts";
import {
  DragDropContext,
  Draggable,
  Droppable as DroppableBug,
  DroppableProps,
} from "react-beautiful-dnd";
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
import { tryParseJSON } from "utils/json";
import { z } from "zod";
import { DeleteIcon } from "./DeleteUserModal";
import { Icon } from "./Icon";
import { Input } from "./Input";
import { RadioGroup } from "./RadioGroup";
import { UsageFilter, createUsageConfig } from "./UsageFilter";

const iconProps = {
  baseStyle: {
    w: 5,
    h: 5,
  },
};
const AddUserIcon = chakra(UserPlusIcon, iconProps);
const EditUserIcon = chakra(PencilIcon, iconProps);
const UserUsageIcon = chakra(ChartPieIcon, iconProps);
const SubscriptionIcon = chakra(RssIcon, iconProps);
const RefreshIcon = chakra(ArrowPathRoundedSquareIcon, iconProps);
const RankIcon = chakra(Bars3Icon, iconProps);
const ClearIcon = chakra(XMarkIcon, iconProps);
const AddIcon = chakra(PlusIcon, iconProps);
const SearchIcon = chakra(MagnifyingGlassIcon, iconProps);
const InfoIcon = chakra(InformationCircleIcon, {
  baseStyle: {
    w: 4,
    h: 4,
    color: "gray.400",
    cursor: "pointer",
  },
});
const EmptyTagIcon = chakra(AddTagIcon);

const schema = z.object({
  username: z.string().min(1, { message: "fieldRequired" }),
  selected_proxies: z.array(z.string()).refine((value) => value.length > 0, {
    message: "userDialog.selectOneProtocol",
  }),
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
      if (Array.isArray(ins[protocol]) && !ins[protocol]?.length)
        delete ins[protocol];
    });
    return ins;
  }),
  sub_url_prefix: z.any(),
  sub_tags: z.any(),
  sub_revoked_at: z.string(),
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
    selected_proxies: Object.keys(user.proxies) as ProxyKeys,
    sub_tags: user.sub_tags || "",
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
      shadowsocks: { password: "", method: "chacha20-poly1305" },
    },
    sub_url_prefix: "",
    sub_tags: "",
    sub_revoked_at: "",
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
    revokeUserSubscription,
    fetchUserUsage,
    onEditingUser,
    createUser,
    onDeletingUser,
  } = useDashboard();
  const { onAlert } = useClash();
  const isEditing = !!editingUser;
  const isOpen = isCreatingNewUser || isEditing;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>("");
  const [overflow, setOverflow] = useState("hidden");
  const [subURLPrefix, setSubURLPrefix] = useState("");
  const toast = useToast();
  const { t, i18n } = useTranslation();

  const { colorMode } = useColorMode();

  const [usageVisible, setUsageVisible] = useState(false);
  const handleUsageToggle = () => {
    setUsageVisible((current) => !current);
  };

  const {
    isOpen: isSubOpen,
    onToggle: onSubToggle,
    onClose: closeSub,
  } = useDisclosure();

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
  };

  useEffect(() => {
    if (editingUser) {
      form.reset(formatUser(editingUser));
      setSubURLPrefix(editingUser.sub_url_prefix);

      fetchUsageWithFilter({
        start: dayjs().utc().subtract(30, "day").format("YYYY-MM-DDTHH:00:00"),
      });
    }
  }, [editingUser]);

  const createRequestBody = (values: FormType) => {
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
    return body;
  };

  const submit = (values: FormType) => {
    setLoading(true);
    const methods = { edited: editUser, created: createUser };
    const method = isEditing ? "edited" : "created";
    setError(null);

    const body = createRequestBody(values);

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
        if (err?.response?.status === 409 || err?.response?.status === 400) {
          let message = err?.response?._data?.detail;
          if (message.err) {
            message = t(`error.${message.err}`);
          }
          setError(message);
        }
        if (err?.response?.status === 422) {
          Object.keys(err.response._data.detail).forEach((key) => {
            let message = tryParseJSON(err.response._data.detail[key]);
            let tfield = message;
            if (message["err"]) {
              tfield = `error.${message.err}`;
              message = t(tfield);
            }
            setError(message);
            form.setError(
              key as "proxies" | "username" | "data_limit" | "expire",
              {
                type: "custom",
                message: tfield,
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
    closeSub();
  };

  const handleResetUsage = () => {
    useDashboard.setState({ resetUsageUser: editingUser });
  };

  const terror = (error: string | undefined) => {
    return error ? t(error) : error;
  };

  const handleRevokeSubscription = () => {
    const body = createRequestBody(form.getValues());
    onAlert({
      title: t("userDialog.revoke.title"),
      content: t("userDialog.revoke.prompt", {
        username: editingUser?.username,
      }),
      type: "warning",
      yes: t("userDialog.revoke"),
      onConfirm: () => {
        revokeUserSubscription(body)
          .then(() => {
            toast({
              title: t("userDialog.revoke.success", {
                username: editingUser?.username,
              }),
              status: "success",
              isClosable: true,
              position: "top",
              duration: 3000,
            });
          })
          .catch((err) => {
            toast({
              title: t("userDialog.revoke.error"),
              status: "error",
              isClosable: true,
              position: "top",
              duration: 3000,
            });
          })
          .finally(() => {
            onAlert(null);
          });
      },
    });
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
                      <FormControl mb={"10px"}>
                        <FormLabel>{t("username")}</FormLabel>
                        <HStack>
                          <Input
                            size="sm"
                            type="text"
                            borderRadius="6px"
                            error={terror(
                              form.formState.errors.username?.message
                            )}
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
                                <Select size="sm" {...field}>
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
                                    field.onChange(
                                      date
                                        ? dayjs(
                                            dayjs(date)
                                              .set("hour", 23)
                                              .set("minute", 59)
                                              .set("second", 59)
                                          )
                                            .utc()
                                            .valueOf() / 1000
                                        : 0
                                    );
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
                <GridItem colSpan={{ base: 1, md: 2 }}>
                  <Collapse
                    in={isSubOpen}
                    style={{ overflow: overflow }}
                    onAnimationComplete={() => setOverflow("unset")}
                    animateOpacity
                  >
                    <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                      <Flex
                        pt="15px"
                        flexDirection="column"
                        gridAutoRows="min-content"
                        w="full"
                      >
                        <FormControl mb="10px">
                          <FormLabel>{t("userDialog.issuedAt")}</FormLabel>
                          <Controller
                            name="sub_revoked_at"
                            control={form.control}
                            render={({ field }) => (
                              <HStack>
                                <ChakraInput
                                  size="sm"
                                  borderRadius="6px"
                                  disabled={true}
                                  value={dayjs
                                    .utc(field.value)
                                    .local()
                                    .format("YYYY-MM-DD HH:mm:ss")}
                                />
                                <Tooltip
                                  label={t("userDialog.revoke.tip")}
                                  placement="top"
                                >
                                  <IconButton
                                    size="sm"
                                    aria-label="Revoke subscription"
                                    isDisabled={disabled}
                                    icon={<RefreshIcon />}
                                    onClick={handleRevokeSubscription}
                                  />
                                </Tooltip>
                              </HStack>
                            )}
                          />
                        </FormControl>
                        <FormControl
                          mb="10px"
                          isInvalid={!!form.formState.errors.sub_url_prefix}
                        >
                          <FormLabel>{t("userDialog.urlPrefix")}</FormLabel>
                          <Input
                            size="sm"
                            type="text"
                            borderRadius="6px"
                            placeholder="Domain (e.g. https://example.com)"
                            disabled={disabled}
                            {...form.register("sub_url_prefix", {
                              onChange: (e) => setSubURLPrefix(e.target.value),
                            })}
                          />
                          {subURLPrefix && (
                            <Text
                              maxW="300px"
                              pt="1"
                              fontSize="xs"
                              color="gray.500"
                              w="inherit"
                              noOfLines={1}
                            >
                              {subURLPrefix}
                              /sub/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9
                            </Text>
                          )}
                        </FormControl>
                      </Flex>
                      <Flex
                        pt="15px"
                        flexDirection="column"
                        gridAutoRows="min-content"
                        w="full"
                      >
                        <FormControl
                          mb="10px"
                          isInvalid={!!form.formState.errors.sub_url_prefix}
                        >
                          <HStack mb="1">
                            <FormLabel mr="0" mb="0">
                              {t("tags")}
                            </FormLabel>
                            <Popover isLazy placement="top">
                              <PopoverTrigger>
                                <InfoIcon />
                              </PopoverTrigger>
                              <PopoverContent w="300px">
                                <PopoverArrow />
                                <Text fontSize="xs" p="2">
                                  {t("userDialog.tags.info")}
                                </Text>
                              </PopoverContent>
                            </Popover>
                          </HStack>
                          <Controller
                            name="sub_tags"
                            control={form.control}
                            render={({ field }) => (
                              <ProxyTags
                                tags={field.value}
                                onChange={field.onChange}
                              />
                            )}
                          />
                        </FormControl>
                      </Flex>
                    </SimpleGrid>
                  </Collapse>
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
                      <Tooltip
                        label={t("userDialog.subscription")}
                        placement="top"
                      >
                        <IconButton
                          aria-label="usage"
                          size="sm"
                          onClick={() => {
                            setOverflow("hidden");
                            onSubToggle();
                          }}
                        >
                          <SubscriptionIcon />
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
                      {/* <Button onClick={handleRevokeSubscription} size="sm">
                        {t("userDialog.revokeSubscription")}
                      </Button> */}
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

const Droppable = ({ children, ...props }: DroppableProps) => {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const animation = requestAnimationFrame(() => setEnabled(true));

    return () => {
      cancelAnimationFrame(animation);
      setEnabled(false);
    };
  }, []);

  if (!enabled) {
    return null;
  }

  return <DroppableBug {...props}>{children}</DroppableBug>;
};

type ProxyTagsProps = {
  tags: string;
  onChange: (value: string) => void;
};

const ProxyTags: FC<ProxyTagsProps> = ({ tags, onChange }) => {
  const { proxyTags, onCreateProxy } = useClash();
  const { onEditingSubscription } = useDashboard();
  const { t } = useTranslation();

  const selected_tags = tags.split(",").filter((v) => v.length > 0);
  const tagMap: { [key: string]: ProxyTag } = proxyTags.reduce(
    (ac, a) => ({ ...ac, [a.tag]: a }),
    {}
  );

  const hasAvailableTags = !proxyTags.every((v) => v.tag == "built-in");

  const tagRef = useRef<HTMLSelectElement>(null);
  const [search, setSearch] = useState("");
  const onSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
  };

  return (
    <VStack>
      <DragDropContext
        onDragEnd={(result) => {
          if (!result.destination) {
            return;
          }
          const tags = Array.from(selected_tags);
          const [removed] = tags.splice(result.source.index, 1);
          tags.splice(result.destination.index, 0, removed);
          onChange(tags.join(","));
        }}
      >
        <Droppable droppableId="droppable">
          {(provided) => {
            const value = selected_tags;
            const showBuiltin = value.length == 0;
            const showingTags = showBuiltin ? ["built-in"] : value;
            return (
              <SimpleGrid
                w="full"
                {...provided.droppableProps}
                ref={provided.innerRef}
              >
                {showingTags.map((tag, index) => {
                  const entry = tagMap[tag] || {
                    tag: tag,
                    servers: ["Not Found"],
                  };
                  const server =
                    entry.servers[0].split("->")[0].trimEnd() +
                    (entry.servers.length > 1 ? "..." : "");
                  let colorScheme = "primary";
                  if (showBuiltin) {
                    colorScheme = "gray";
                  } else if (!tagMap[tag]) {
                    colorScheme = "red";
                  }
                  return (
                    <Draggable
                      key={entry.tag}
                      index={index}
                      draggableId={entry.tag}
                      isDragDisabled={showBuiltin}
                    >
                      {(provided) => (
                        <Tag
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          w="fit-content"
                          size="md"
                          pl="3"
                          pr="3"
                          mb="1"
                          borderRadius="full"
                          variant="solid"
                          cursor="default"
                          colorScheme={colorScheme}
                        >
                          {!showBuiltin && (
                            <TagLeftIcon boxSize="18px" as={RankIcon} />
                          )}
                          <Popover isLazy trigger="hover" placement="top">
                            <PopoverTrigger>
                              <Center height="full" cursor="default">
                                <TagLabel>
                                  {entry.tag}
                                  {" -> "}
                                  {server}
                                </TagLabel>
                              </Center>
                            </PopoverTrigger>
                            <PopoverContent w="full">
                              <PopoverArrow />
                              <SimpleGrid
                                p="2"
                                spacingY="1"
                                pl="3"
                                pr="3"
                                w="full"
                                alignItems="flex-start"
                                color="gray.800"
                                _dark={{
                                  color: "whiteAlpha.900",
                                }}
                              >
                                {entry.servers.map((value, index) => (
                                  <Text key={index} fontSize="sm">
                                    {value}
                                  </Text>
                                ))}
                              </SimpleGrid>
                            </PopoverContent>
                          </Popover>
                          {!showBuiltin && (
                            <TagCloseButton
                              onClick={() => {
                                const tags = value.filter((v) => v !== tag);
                                onChange(tags.join(","));
                              }}
                            />
                          )}
                        </Tag>
                      )}
                    </Draggable>
                  );
                })}
                {provided.placeholder}
              </SimpleGrid>
            );
          }}
        </Droppable>
      </DragDropContext>
      {!hasAvailableTags && (
        <VStack mt={3}>
          <Text>{t("userDialog.noTags")}</Text>
          <EmptyTagIcon
            onClick={() => {
              onEditingSubscription(true);
              onCreateProxy(true);
            }}
            cursor="pointer"
            boxSize="32px"
            _dark={{
              'path[fill="#ccc"]': {
                fill: "primary.300",
              },
            }}
            _light={{
              'path[fill="#ccc"]': {
                fill: "primary.500",
              },
            }}
          />
        </VStack>
      )}
      {hasAvailableTags && (
        <VStack w="full">
          <HStack w="full">
            <InputGroup>
              <InputLeftElement
                height="8"
                pointerEvents="none"
                children={<SearchIcon />}
              />
              <Input
                pl={10}
                size="sm"
                borderRadius="md"
                placeholder={t("search")}
                value={search}
                borderColor="light-border"
                onChange={onSearchChange}
              />

              <InputRightElement height="8">
                {search.length > 0 && (
                  <IconButton
                    onClick={() => setSearch("")}
                    aria-label="clear"
                    size="xs"
                    variant="ghost"
                  >
                    <ClearIcon />
                  </IconButton>
                )}
              </InputRightElement>
            </InputGroup>
            <Box w="36px" />
          </HStack>
          <HStack w="full">
            <Select ref={tagRef} size="sm">
              {proxyTags.map((entry) => {
                const value = selected_tags;
                const exists = value.some((tag) => tag === entry.tag);
                const builtin = entry.tag === "built-in";
                const notfound =
                  search &&
                  entry.tag.toLowerCase().indexOf(search.toLowerCase()) < 0;
                if (exists || builtin || notfound) {
                  return null;
                } else {
                  return (
                    <option key={entry.tag} value={entry.tag}>
                      {entry.tag}
                    </option>
                  );
                }
              })}
            </Select>
            <IconButton
              size="sm"
              aria-label="Add Tags"
              icon={<AddIcon />}
              onClick={() => {
                const value = selected_tags;
                const newTag = tagRef.current!.value;
                onChange([...value, newTag].join(","));
              }}
            />
          </HStack>
        </VStack>
      )}
    </VStack>
  );
};
