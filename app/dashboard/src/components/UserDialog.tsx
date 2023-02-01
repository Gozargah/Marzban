import {
  Alert,
  AlertIcon,
  Box,
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
  SimpleGrid,
  Spinner,
  Text,
  Tooltip,
  useToast,
  VStack,
  Select,
} from "@chakra-ui/react";
import { PencilIcon, UserPlusIcon } from "@heroicons/react/24/outline";
import { useDashboard } from "contexts/DashboardContext";
import { FC, useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  ProxyKeys,
  ProxyType,
  User,
  UserCreate,
  dataLimitResetStrategy,
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

const schema = z.object({
  username: z.string().min(1, { message: "Required" }),
  proxies: z.array(z.string()).refine((value) => value.length > 0, {
    message: "Please select at least one protocol",
  }),
  data_limit: z.number().min(0, "The minimum number is 0").nullable(),
  expire: z.number().nullable(),
  data_limit_reset_strategy: z.string(),
});

export type UserDialogProps = {};

export type FormType = Omit<UserCreate, "proxies"> & { proxies: ProxyKeys };

const formatUser = (user: User): FormType => {
  return {
    ...user,
    proxies: Object.keys(user.proxies) as ProxyKeys,
  };
};
const getDefaultValues = (): FormType => ({
  proxies: ["vmess", "vless", "trojan"],
  data_limit: null,
  expire: null,
  username: "",
  data_limit_reset_strategy: "no_reset",
});

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
    onEditingUser,
    createUser,
    onDeletingUser,
  } = useDashboard();
  const isEditing = !!editingUser;
  const isOpen = isCreatingNewUser || isEditing;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>("");
  const toast = useToast();

  const form = useForm<FormType>({
    defaultValues: getDefaultValues(),
    resolver: zodResolver(schema),
  });

  const onClose = () => {
    form.reset(getDefaultValues());
    onCreateUser(false);
    onEditingUser(null);
  };

  const submit = (values: FormType) => {
    setLoading(true);
    const methods = { edited: editUser, created: createUser };
    const method = isEditing ? "edited" : "created";
    setError(null);
    let body: UserCreate = {
      ...values,
      proxies: mergeProxies(values.proxies, editingUser?.proxies),
    };
    methods[method](body)
      .then(() => {
        toast({
          title: `User ${values.username} ${method}.`,
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

  useEffect(() => {
    if (editingUser) {
      console.log(formatUser(editingUser));
      form.reset(formatUser(editingUser));
    }
  }, [editingUser]);

  const disabled = loading;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="2xl">
      <ModalOverlay bg="blackAlpha.300" backdropFilter="blur(10px)" />
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
                {isEditing ? "Edit" : "Create new"} user
              </Text>
            </HStack>
          </ModalHeader>
          <ModalCloseButton mt={3} disabled={disabled} />
          <ModalBody>
            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3} mt={4}>
              <VStack justifyContent="space-between">
                <VStack gap={1} gridAutoRows="min-content" w="full">
                  <FormControl>
                    <FormLabel>Username</FormLabel>
                    <Input
                      size="sm"
                      type="text"
                      borderRadius="6px"
                      error={form.formState.errors.username?.message}
                      disabled={disabled || isEditing}
                      {...form.register("username")}
                    />
                  </FormControl>
                  <HStack>
                    <FormControl>
                      <FormLabel>Bandwidth Limit</FormLabel>
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
                              onChange={(value) => {
                                field.onChange(
                                  value && value.length
                                    ? Number(
                                        (
                                          parseFloat(value) * 1073741824
                                        ).toFixed(3)
                                      )
                                    : 0
                                );
                              }}
                              disabled={disabled}
                              error={form.formState.errors.data_limit?.message}
                              value={
                                field.value
                                  ? String(field.value / 1073741824)
                                  : undefined
                              }
                            />
                          );
                        }}
                      />
                    </FormControl>
                    <FormControl>
                      <FormLabel>Reset Every</FormLabel>
                      <Select
                        size="sm"
                        borderRadius="6px"
                        disabled={disabled}
                        textTransform="capitalize"
                        {...form.register("data_limit_reset_strategy")}
                      >
                        {dataLimitResetStrategy.map((strategy) => (
                          <option
                            style={{ textTransform: "capitalize" }}
                            key={strategy}
                            value={strategy}
                          >
                            {strategy.replace("_", " ")}
                          </option>
                        ))}
                      </Select>
                    </FormControl>
                  </HStack>
                  <FormControl>
                    <FormLabel>Expiry Date</FormLabel>
                    <Controller
                      name="expire"
                      control={form.control}
                      render={({ field }) => {
                        function createDateAsUTC(num: number) {
                          return dayjs(
                            dayjs(num * 1000)
                              .utc()
                              .format("MMMM D, YYYY")
                          ).toDate();
                        }
                        return (
                          <>
                            <ReactDatePicker
                              dateFormat="MMMM d, yyy"
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
                                  error={form.formState.errors.expire?.message}
                                />
                              }
                            />
                            {field.value ? (
                              <FormHelperText>
                                {relativeExpiryDate(field.value)}
                              </FormHelperText>
                            ) : (
                              ""
                            )}
                          </>
                        );
                      }}
                    />
                  </FormControl>
                </VStack>
                {error && (
                  <Alert status="error" display={{ base: "none", md: "flex" }}>
                    <AlertIcon />
                    {error}
                  </Alert>
                )}
              </VStack>
              <FormControl isInvalid={!!form.formState.errors.proxies?.message}>
                <FormLabel>Protocols</FormLabel>
                <Controller
                  control={form.control}
                  name="proxies"
                  render={({ field }) => {
                    return (
                      <RadioGroup
                        list={[
                          {
                            title: "vmess",
                            description: "Fast and secure",
                          },
                          {
                            title: "vless",
                            description: "Lightweight, fast and secure",
                          },
                          {
                            title: "trojan",
                            description:
                              "Lightweight, secure and lightening fast",
                          },
                          {
                            title: "shadowsocks",
                            description:
                              "Fast and secure, but not efficient as others",
                          },
                        ]}
                        disabled={disabled}
                        {...field}
                      />
                    );
                  }}
                />
                <FormErrorMessage>
                  {form.formState.errors.proxies?.message}
                </FormErrorMessage>
              </FormControl>
            </SimpleGrid>
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
            <HStack justifyContent="space-between" w="full" gap={3}>
              <HStack>
                {isEditing && (
                  <>
                    <Tooltip label="Delete" placement="top">
                      <IconButton
                        aria-label="Delete"
                        size="sm"
                        onClick={() => onDeletingUser(editingUser)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </>
                )}
              </HStack>
              <HStack w="full" maxW={{ lg: "50%", base: "full" }}>
                <Button
                  onClick={onClose}
                  size="sm"
                  variant="outline"
                  w="full"
                  disabled={disabled}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  colorScheme="primary"
                  leftIcon={loading ? <Spinner size="xs" /> : undefined}
                  w="full"
                  disabled={disabled}
                >
                  {isEditing ? "Edit user" : "Create user"}
                </Button>
              </HStack>
            </HStack>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
};
