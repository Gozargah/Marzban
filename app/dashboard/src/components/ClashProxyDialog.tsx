import {
  Alert,
  AlertIcon,
  Button,
  chakra,
  FormControl,
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
  Flex,
  Input,
  Switch,
  Box,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverArrow,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  Divider,
  AccordionIcon,
} from "@chakra-ui/react";
import { PencilIcon, PlusIcon} from "@heroicons/react/24/outline";
import { FC, useEffect, useState } from "react";
import { Controller, FormProvider, useForm } from "react-hook-form";
import { Icon } from "./Icon";
import { useTranslation } from "react-i18next";
import {
  Proxy,
  ProxyInbound,
  ProxySettings,
  useClash
} from "contexts/ClashContext";
import { DeleteIcon } from "./DeleteUserModal";
import { XTLSFlows, proxyALPN, proxyFingerprint } from "constants/Proxies";
import { DuplicateIcon, InfoIcon } from "./ClashModal";

const iconProps = {
  baseStyle: {
    w: 5,
    h: 5,
  }
}

const AddIcon = chakra(PlusIcon, iconProps);
const EditIcon = chakra(PencilIcon, iconProps);

type FormType = Pick<Proxy, keyof Proxy> & {};

const formatProxy = (proxy: Proxy): FormType => {
  return {
    ...proxy
  };
};

const getDefaultValues = (): FormType => {
  return {
    id: 0,
    name: "",
    server: "",
    inbound: "",
    tag: "",
    port: "",
    settings: {
      trojan: {
        security: "tls",
        fingerprint: "chrome",
        udp: false,
        alpn: "",
        sni: "",
        allow_insecure: true,
        ws_addition_path: "",
      },
      vless: {
        security: "tls",
        fingerprint: "chrome",
        servername: "",
        alpn: "",
        udp: false,
        allow_insecure: true,
        ws_addition_path: "",
        flow: "",
      },
      vmess: {
        security: "tls",
        fingerprint: "chrome",
        servername: "",
        alpn: "",
        udp: false,
        allow_insecure: true,
        ws_addition_path: "",
      },
      shadowsocks: {}
    },
  };
};

export type ClashProxyDialogProps = {};

export const ClashProxyDialog: FC<ClashProxyDialogProps> = () => {
  const {
    proxyInbounds,
    editingProxy,
    isCreatingProxy,
    duplicatingProxy,
    onEditingProxy,
    onDuplicatingProxy,
    onCreateProxy,
    deleteProxy,
    editProxy,
    createProxy,
    onAlert,
  } = useClash();
  const isEditing = !!editingProxy;
  const isOpen = isCreatingProxy || isEditing;
  const message = isEditing ? "clash.proxy.edited" : "clash.proxy.created";
  const [loading, setLoading] = useState(false);
  const [inbound, setInbound] = useState<ProxyInbound | null>(null);
  const [port, setPort] = useState("");
  const [wsAdditionPath, setWSAdditionPath] = useState("");
  const [error, setError] = useState<string | null>("");
  const toast = useToast();
  const { t } = useTranslation();
  const form = useForm<FormType>({ defaultValues: getDefaultValues() });

  const findInbound = (name: string) => {
    return proxyInbounds.data.find((v) => v.name === name) || null;
  }

  const updateForm = (proxy: Proxy | null) => {
    if (proxy) {
      const inbound = findInbound(proxy.inbound);
      form.reset(formatProxy(proxy));
      setInbound(inbound);
      setPort(proxy.port);
      if(inbound?.type == "trojan") {
        setWSAdditionPath(proxy.settings.trojan?.ws_addition_path || "");
      } else if(inbound?.type == "vless") {
        setWSAdditionPath(proxy.settings.vless?.ws_addition_path || "");
      } else if(inbound?.type == "vmess") {
        setWSAdditionPath(proxy.settings.vmess?.ws_addition_path || "");
      }
    } else {
      form.reset(getDefaultValues());
      setInbound(null);
      setPort("");
      setWSAdditionPath("");
    }
  };

  useEffect(() => {
    if (editingProxy) {
      updateForm(editingProxy);
    }
  }, [editingProxy, proxyInbounds]);

  useEffect(() => {
    if (isCreatingProxy) {
      if (duplicatingProxy) {
        updateForm(duplicatingProxy);
      } else {
        updateForm(null);
      }
    }
  }, [isCreatingProxy, proxyInbounds]);

  const remove_undefined = (settings: any, defaultSettings: any) => {
    Object.keys(settings).map((key) => {
      if (defaultSettings[key] === undefined) {
        delete settings[key];
      }
    });
  };

  const submit = (values: FormType) => {
    setLoading(true);
    setError(null);

    let settings = {} as ProxySettings;
    if (values.settings.icon) {
      settings.icon = values.settings.icon;
    }
    if(inbound?.type == "trojan") {
      settings.trojan = values.settings.trojan;
      remove_undefined(settings.trojan, getDefaultValues().settings.trojan);
    } else if(inbound?.type == "vless") {
      settings.vless = values.settings.vless;
      remove_undefined(settings.vless, getDefaultValues().settings.vless);
    } else if(inbound?.type == "vmess") {
      settings.vmess = values.settings.vmess;
      remove_undefined(settings.vmess, getDefaultValues().settings.vmess);
    } else if(inbound?.type == "shadowsocks") {
      settings.shadowsocks = values.settings.shadowsocks;
      remove_undefined(settings.shadowsocks, getDefaultValues().settings.shadowsocks);
    }

    const {...rest} = values;
    let body: Proxy = {
      ...rest,
      settings: settings,
    };

    (isEditing ? editProxy : createProxy)(body)
      .then(() => {
        toast({
          title: t(message, {name: values.name}),
          status: "success",
          isClosable: true,
          position: "top",
          duration: 3000,
        });
        onClose();
      })
      .catch((err) => {
        if (err?.response?.status === 409 
          || err?.response?.status === 400
          || err?.response?.status === 404)
          setError(err?.response?._data?.detail);
        if (err?.response?.status === 422) {
          Object.keys(err.response._data.detail).forEach((key) => {
            let message = err.response._data.detail[key];
            try {
              const errobj = JSON.parse(message.replace(/"/g, '\\"').replace(/'/g, '"'));
              if (errobj) {
                message = t(`error.${errobj.err}`);
              }
            } catch (e) {}
            setError(message);
            form.setError(
              key as "name" | "port" | "server" | "tag" | "inbound",
              {
                type: "custom",
                message: message,
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
    updateForm(null);
    onCreateProxy(false);
    onEditingProxy(null);
    onDuplicatingProxy(null);
    setError(null);
    onAlert(null);
  };

  const onDeletingProxy = () => {
    onAlert({
      title: t("clash.proxy.delete"),
      content: t("clash.proxy.deletePrompt", { name: editingProxy?.name }),
      type: "error",
      yes: t("delete"),
      onConfirm: () => {
        deleteProxy(editingProxy!)
          .then(() => {
            toast({
              title: t("clash.proxy.deleteSuccess", { name: editingProxy?.name }),
              status: "success",
              isClosable: true,
              position: "top",
              duration: 3000,
            });
            onClose();
          });
      }
    });
  };

  const disabled = loading;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalOverlay bg="blackAlpha.300" backdropFilter="blur(10px)" />
      <FormProvider {...form}>
        <ModalContent mx="3">
          <form onSubmit={form.handleSubmit(submit)}>
            <ModalHeader pt={6}>
              <HStack gap={2}>
                <Icon color="primary">
                  {isEditing ? (
                    <EditIcon color="white" />
                  ) : (
                    <AddIcon color="white" />
                  )}
                </Icon>
                <Text fontWeight="semibold" fontSize="lg">
                  {isEditing ? t("clash.proxy.edit") : t("clash.proxy.add")}
                </Text>
              </HStack>
            </ModalHeader>
            <ModalCloseButton mt={3} disabled={disabled} />
            <ModalBody>
              <VStack>
                <HStack w="full">
                  <FormControl isInvalid={!!form.formState.errors.name}>
                    <HStack mb="1">
                      <FormLabel mr="0" mb="0">{t("clash.name")}</FormLabel>
                      <Popover isLazy placement="right">
                        <PopoverTrigger>
                          <InfoIcon />
                        </PopoverTrigger>
                        <PopoverContent>
                          <PopoverArrow />
                          <Text fontSize="xs" p="2" >
                            {t("clash.proxy.uniqueInfo")}
                          </Text>
                        </PopoverContent>
                      </Popover>
                    </HStack>
                    <Input
                      size="sm"
                      type="text"
                      borderRadius="6px"
                      placeholder="us bwh|01"
                      disabled={disabled}
                      {...form.register("name")}
                    />
                  </FormControl>
                  {editingProxy && (
                    <Box h="full">
                      <IconButton
                        mt="4"
                        aria-label="duplicate proxy"
                        bg="transparent"
                        onClick={() => onDuplicatingProxy(editingProxy!)}
                      >
                        <DuplicateIcon />
                      </IconButton>
                    </Box>
                  )}
                </HStack>
                <HStack w="full">
                  <FormControl isInvalid={!!form.formState.errors.server}>
                    <FormLabel>{t("clash.server")}</FormLabel>
                    <Input
                      size="sm"
                      type="text"
                      borderRadius="6px"
                      placeholder="bwh-aws.example.com"
                      disabled={disabled}
                      {...form.register("server")}
                    />
                  </FormControl>
                  <FormControl w="50%" isInvalid={!!form.formState.errors.port}>
                    <FormLabel>{t("clash.port")}</FormLabel>
                    <Controller
                      name="port"
                      control={form.control}
                      render={({ field: {onChange, ...rest} }) => {
                        return (
                          <Input
                            size="sm"
                            type="text"
                            borderRadius="6px"
                            placeholder="1080 | 1080:1081"
                            disabled={disabled}
                            {...rest}
                            onChange={(e) => {
                              setPort(e.target.value);
                              onChange(e);
                            }}
                          />
                        )
                      }}
                    />
                  </FormControl>
                </HStack>
                <HStack w="full">
                  <FormControl isInvalid={!!form.formState.errors.inbound}>
                    <FormLabel>{t("clash.inbound")}</FormLabel>
                    <Controller
                      control={form.control}
                      name="inbound"
                      render={({ field: {onChange, ...rest} }) => {
                        return (
                          <Select 
                            disabled={disabled}
                            size="sm" 
                            {...rest}
                            placeholder="Select inbound"
                            onChange={(e) => {
                              const newInbound = findInbound(e.target.value);
                              form.setValue("port", newInbound?.port || "");
                              form.clearErrors("port");
                              form.clearErrors("inbound");
                              setInbound(newInbound);
                              onChange(e);
                            }}
                          >
                            {proxyInbounds.data.map((value) => {
                              return (
                                <option key={value.name} value={value.name}>
                                  {value.name}
                                </option>
                              );
                            })}
                          </Select>
                        );
                      }}
                    />
                  </FormControl>
                  <FormControl isInvalid={!!form.formState.errors.tag}>
                    <FormLabel>{t("clash.tag")}</FormLabel>
                    <Input
                      size="sm"
                      type="text"
                      borderRadius="6px"
                      placeholder="bwh-aws"
                      disabled={disabled}
                      {...form.register("tag")}
                    />
                  </FormControl>
                </HStack>
                <HStack w="full">
                  <Flex w="full" flexDirection="column" gap="1">
                    <Text fontSize="sm">{t("clash.type")}</Text>
                    <Input
                      size="sm"
                      borderRadius="6px"
                      disabled={true}
                      value={inbound?.type || ""}
                    />
                  </Flex>
                  <Flex w="full" flexDirection="column" gap="1">
                    <Text fontSize="sm">{t("clash.proxy.network")}</Text>
                    <Input
                      size="sm"
                      borderRadius="6px"
                      disabled={true}
                      value={inbound?.network || ""}
                    />
                  </Flex>
                  {inbound && inbound.type != "shadowsocks" && (
                    <FormControl w="full">
                      <FormLabel>{t("clash.proxy.security")}</FormLabel>
                      {inbound.security == "none" && (
                        <Select 
                          disabled={disabled || inbound.security != "none" || inbound.type == "trojan"} 
                          size="sm"
                          placeholder="Select security"
                          {...form.register(`settings.${inbound.type}.security`)}
                        >
                          <option key="none" value="none">none</option>
                          <option key="tls" value="tls">tls</option>
                        </Select>
                      )}
                      {inbound.security != "none" && (
                        <Input
                          size="sm"
                          borderRadius="6px"
                          disabled={true}
                          value={inbound?.security}
                        />
                      )}
                    </FormControl>
                  )}
                </HStack>
                <Accordion w="full" allowToggle>
                  <AccordionItem border="0">
                    <AccordionButton
                      display="flex"
                      justifyContent="space-between"
                      px={0}
                      py={1}
                      borderRadius={3}
                      _hover={{ bg: "transparent" }}
                    >
                      <HStack pt="4" pb="2" w="full">
                        <Divider />
                          <Text
                            whiteSpace="nowrap"
                            fontSize="xs"
                            color="gray.600"
                            _dark={{ color: "gray.500" }}
                            pl={1}
                          >
                          {t("clash.advanceOption")}
                          <AccordionIcon fontSize="sm" ml={1} />
                        </Text>
                        <Divider />
                      </HStack>
                    </AccordionButton>
                    <AccordionPanel w="full" p={1}>
                      <VStack w="full">
                        {port.indexOf(":") > 0 && (
                          <FormControl>
                            <FormLabel>{t("clash.icon")}</FormLabel>
                            <Input
                              size="sm"
                              type="text"
                              borderRadius="6px"
                              disabled={disabled}
                              {...form.register("settings.icon")}
                            />
                          </FormControl>
                        )}
                        {inbound && inbound.type != "shadowsocks" && (
                          <VStack w="full">
                            {inbound.network == "ws" && (
                              <FormControl>
                                <FormLabel>{t("clash.proxy.wsAdditionPath")}</FormLabel>
                                <Controller
                                  control={form.control}
                                  name={`settings.${inbound.type}.ws_addition_path`}
                                  render={({field: {onChange, ...rest}}) => {
                                    return (
                                      <Input
                                        size="sm"
                                        type="text"
                                        borderRadius="6px"
                                        disabled={disabled}
                                        {...rest}
                                        onChange={(e) => {
                                          setWSAdditionPath(e.target.value);
                                          onChange(e);
                                        }}
                                      />
                                    );
                                  }}
                                />
                                <Flex
                                  fontSize="xs"
                                  color="gray.500"
                                  pt="1"
                                >
                                  <Text>wsSettings.path: {inbound.ws_path}</Text>
                                  <Text
                                    color="primary.500"
                                    fontWeight="bold"
                                  >
                                    {wsAdditionPath}
                                  </Text>
                                  <Text>?user={"{username}"}&port={inbound.port}</Text>
                                </Flex>
                              </FormControl>
                            )}
                            {inbound.type == "trojan" && (
                              <FormControl>
                                <FormLabel>SNI</FormLabel>
                                <Input
                                  size="sm"
                                  type="text"
                                  borderRadius="6px"
                                  disabled={disabled}
                                  {...form.register(`settings.${inbound.type}.sni`)}
                                />
                              </FormControl>
                            )}
                            {(inbound.type == "vmess" || inbound.type == "vless") && (
                              <FormControl>
                                <FormLabel>{t("clash.proxy.serverName")}</FormLabel>
                                {inbound.security == "reality" && (
                                  <Input
                                    size="sm"
                                    type="text"
                                    borderRadius="6px"
                                    disabled={true}
                                    value={inbound.servername}
                                  />
                                )}
                                {inbound.security != "reality" && (
                                  <Input
                                    size="sm"
                                    type="text"
                                    borderRadius="6px"
                                    disabled={disabled}
                                    {...form.register(`settings.${inbound.type}.servername`)}
                                  />
                                )}
                              </FormControl>
                            )}
                            <HStack w="full">
                              <FormControl>
                                <FormLabel>ALPN</FormLabel>
                                  <Controller
                                    control={form.control}
                                    name={`settings.${inbound.type}.alpn`}
                                    render={({field}) => {
                                      return (
                                        <Select
                                          disabled={disabled} 
                                          size="sm"
                                          {...field}
                                        >
                                          {proxyALPN.map((v) => {
                                            return (
                                              <option key={v.value} value={v.value}>
                                                {v.title}
                                              </option>
                                            )
                                          })}
                                        </Select>
                                      )
                                    }}
                                  />
                              </FormControl>
                              <FormControl>
                                <FormLabel>{t("clash.proxy.fingerprint")}</FormLabel>
                                <Controller
                                  control={form.control}
                                  name={`settings.${inbound.type}.fingerprint`}
                                  render={({field}) => {
                                    return (
                                      <Select 
                                        disabled={disabled} 
                                        size="sm"
                                        {...field}
                                      >
                                        {proxyFingerprint.map((v) => {
                                          return (
                                            <option key={v.value} value={v.value}>
                                              {v.title}
                                            </option>
                                          )
                                        })}
                                      </Select>
                                    )
                                  }}
                                />
                              </FormControl>
                              {inbound.type == "vless" && inbound.security == "reality" && (
                                <FormControl>
                                  <Text fontSize="sm" pb={1}>
                                    {t("clash.proxy.flow")}
                                  </Text>
                                  <Select
                                    size="sm"
                                    borderRadius="6px"
                                    {...form.register(`settings.${inbound.type}.flow`)}
                                  >
                                    {XTLSFlows.map((entry) => (
                                      <option key={entry.title} value={entry.value}>
                                        {entry.title}
                                      </option>
                                    ))}
                                  </Select>
                                </FormControl>
                              )}
                            </HStack>
                            <HStack pt={1} w="full" gap="4">
                              <FormControl w="fit-content" display='flex' alignItems='center'>
                                <FormLabel mb='0'>UDP</FormLabel>
                                <Switch {...form.register(`settings.${inbound.type}.udp`)} />
                              </FormControl>
                              <FormControl w="fit-content" display='flex' alignItems='center'>
                                <FormLabel mb='0'>{t("clash.proxy.allowInsecure")}</FormLabel>
                                <Switch {...form.register(`settings.${inbound.type}.allow_insecure`)} />
                              </FormControl>
                            </HStack>
                          </VStack>
                        )}
                      </VStack>
                    </AccordionPanel>
                  </AccordionItem>
                </Accordion>
                {error && (
                  <Alert status="error">
                    <AlertIcon />
                    {error}
                  </Alert>
                )}
              </VStack>
            </ModalBody>
            <ModalFooter>
              <HStack
                justifyContent="space-between"
                w="full"
                gap={3}
              >
                {isEditing && (
                  <Tooltip label={t("delete")} placement="top">
                    <IconButton
                      aria-label="Delete"
                      size="sm"
                      onClick={onDeletingProxy}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Tooltip>
                  )}
                <HStack w="full" justifyItems="flex-end">
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
                    {isEditing ? t("update") : t("create")}
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
