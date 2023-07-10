import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Alert,
  AlertIcon,
  Button,
  Divider,
  Flex,
  FormControl,
  FormErrorMessage,
  FormLabel,
  HStack,
  IconButton,
  Input,
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
  Spinner,
  Switch,
  Text,
  Tooltip,
  VStack,
  chakra,
  useToast
} from "@chakra-ui/react";
import { PencilIcon, PlusIcon } from "@heroicons/react/24/outline";
import { zodResolver } from "@hookform/resolvers/zod";
import { proxyALPN, proxyFingerprint } from "constants/Proxies";
import {
  Proxy,
  ProxyInbound,
  ProxySettings,
  useClash,
} from "contexts/ClashContext";
import { FC, useEffect, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { tryParseJSON } from "utils/json";
import { z } from "zod";
import { DuplicateIcon, InfoIcon } from "./ClashModal";
import { DeleteIcon } from "./DeleteUserModal";
import { Icon } from "./Icon";

const iconProps = {
  baseStyle: {
    w: 5,
    h: 5,
  },
};

const AddIcon = chakra(PlusIcon, iconProps);
const EditIcon = chakra(PencilIcon, iconProps);

type FormType = Pick<Proxy, keyof Proxy> & {};

const schema = z.object({
  name: z.string().min(1, { message: "fieldRequired" }),
  server: z.string().min(1, { message: "fieldRequired" }),
  port: z.string().min(1, { message: "fieldRequired" }),
  tag: z.string().min(1, { message: "fieldRequired" }),
  inbound: z.string().min(1, { message: "fieldRequired" }),
  settings: z.record(z.string(), z.any()),
});

const formatProxy = (proxy: Proxy): FormType => {
  return {
    ...proxy,
  };
};

const getDefaultValues = (): FormType => {
  return {
    id: 0,
    name: "",
    server: "",
    builtin: false,
    inbound: "",
    tag: "",
    port: "",
    settings: {
      trojan: {
        security: "tls",
        fingerprint: "chrome",
        udp: true,
        alpn: "",
        sni: "",
        allow_insecure: false,
      },
      vless: {
        security: "tls",
        fingerprint: "chrome",
        servername: "",
        alpn: "",
        udp: true,
        allow_insecure: false,
      },
      vmess: {
        security: "tls",
        fingerprint: "chrome",
        servername: "",
        alpn: "",
        udp: true,
        allow_insecure: false,
      },
      shadowsocks: {
        udp: true,
      },
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
  const title = isEditing ? "clash.proxy.edited" : "clash.proxy.created";
  const [loading, setLoading] = useState(false);
  const [inbound, setInbound] = useState<ProxyInbound | null>(null);
  const [port, setPort] = useState("");
  const [error, setError] = useState<string | null>("");
  const toast = useToast();
  const { t } = useTranslation();
  const form = useForm<FormType>({
    defaultValues: getDefaultValues(),
    resolver: zodResolver(schema),
  });

  const findInbound = (name: string) => {
    return proxyInbounds.find((v) => v.name === name) || null;
  };

  const updateForm = (proxy: Proxy | null) => {
    if (proxy) {
      const inbound = findInbound(proxy.inbound);
      form.reset(formatProxy(proxy));
      setInbound(inbound);
      setPort(proxy.port);
    } else {
      form.reset(getDefaultValues());
      setInbound(null);
      setPort("");
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

  const removeUndefined = (settings: any, defaultSettings: any) => {
    Object.keys(settings).map((key) => {
      if (defaultSettings[key] === undefined) {
        delete settings[key];
      }
    });
  };

  const submit = (values: FormType) => {
    setLoading(true);
    setError(null);

    const defaultSettings = getDefaultValues().settings;
    let settings = {} as ProxySettings;
    if (values.settings.icon) {
      settings.icon = values.settings.icon;
    }
    if (inbound?.type == "trojan") {
      settings.trojan = values.settings.trojan;
      removeUndefined(settings.trojan, defaultSettings.trojan);
    } else if (inbound?.type == "vless") {
      settings.vless = values.settings.vless;
      removeUndefined(settings.vless, defaultSettings.vless);
    } else if (inbound?.type == "vmess") {
      settings.vmess = values.settings.vmess;
      removeUndefined(settings.vmess, defaultSettings.vmess);
    } else if (inbound?.type == "shadowsocks") {
      settings.shadowsocks = values.settings.shadowsocks;
      removeUndefined(settings.shadowsocks, defaultSettings.shadowsocks);
    }

    const { ...rest } = values;
    let body: Proxy = {
      ...rest,
      id: editingProxy?.id,
      builtin: false,
      settings: settings,
    };

    (isEditing ? editProxy : createProxy)(body)
      .then(() => {
        toast({
          title: t(title, { name: values.name }),
          status: "success",
          isClosable: true,
          position: "top",
          duration: 3000,
        });
        onClose();
      })
      .catch((err) => {
        if (
          err?.response?.status === 409 ||
          err?.response?.status === 400 ||
          err?.response?.status === 404
        ) {
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
              key as "name" | "port" | "server" | "tag" | "inbound",
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
    updateForm(null);
    onCreateProxy(false);
    onEditingProxy(null);
    onDuplicatingProxy(null);
    setError(null);
    onAlert(null);
  };

  const onDeletingProxy = () => {
    let alert: any = {};
    if (editingProxy?.builtin) {
      alert.title = "clash.proxy.deleteOrReset";
      alert.prompt = "clash.proxy.deleteBuiltinPrompt";
      alert.yes = "confirm";
      alert.success = "clash.proxy.resetSuccess";
    } else {
      alert.title = "clash.proxy.delete";
      alert.prompt = "clash.proxy.deletePrompt";
      alert.yes = "delete";
      alert.success = "clash.proxy.deleteSuccess";
    }
    onAlert({
      title: t(alert.title),
      content: t(alert.prompt, { name: editingProxy?.name }),
      type: "error",
      yes: t(alert.yes),
      onConfirm: () => {
        deleteProxy(editingProxy!)
          .then(() => {
            toast({
              title: t(alert.success, { name: editingProxy?.name }),
              status: "success",
              isClosable: true,
              position: "top",
              duration: 3000,
            });
            onClose();
          })
          .catch((err) => {
            toast({
              title: t("clash.proxy.deleteFail", { name: editingProxy?.name }),
              status: "warning",
              isClosable: true,
              position: "top",
              duration: 3000,
            });
            onClose();
          });
      },
    });
  };

  const terror = (error: string | undefined) => {
    return error ? t(error) : error;
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
                      <FormLabel mr="0" mb="0">
                        {t("clash.name")}
                      </FormLabel>
                      <Popover isLazy placement="right">
                        <PopoverTrigger>
                          <InfoIcon />
                        </PopoverTrigger>
                        <PopoverContent>
                          <PopoverArrow />
                          <Text fontSize="xs" p="2">
                            {t("clash.proxy.uniqueInfo")}
                          </Text>
                        </PopoverContent>
                      </Popover>
                    </HStack>
                    <Input
                      size="sm"
                      type="text"
                      borderRadius="6px"
                      placeholder={inbound?.name || "us bwh|01"}
                      disabled={disabled}
                      {...form.register("name")}
                    />
                    <FormErrorMessage>
                      {terror(form.formState.errors.name?.message)}
                    </FormErrorMessage>
                  </FormControl>
                </HStack>
                <HStack w="full" alignItems="baseline">
                  <FormControl isInvalid={!!form.formState.errors.server}>
                    <FormLabel>{t("clash.server")}</FormLabel>
                    <Input
                      size="sm"
                      type="text"
                      borderRadius="6px"
                      placeholder={inbound?.server || "bwh-aws.example.com"}
                      disabled={disabled}
                      {...form.register("server")}
                    />
                    <FormErrorMessage>
                      {terror(form.formState.errors.server?.message)}
                    </FormErrorMessage>
                  </FormControl>
                  <FormControl w="50%" isInvalid={!!form.formState.errors.port}>
                    <FormLabel>{t("clash.port")}</FormLabel>
                    <Input
                      size="sm"
                      type="text"
                      borderRadius="6px"
                      placeholder={inbound?.port || "1080 | 1080:1081"}
                      disabled={disabled}
                      {...form.register("port", {
                        onChange: (e) => setPort(e.target.value),
                      })}
                    />
                    <FormErrorMessage>
                      {terror(form.formState.errors.port?.message)}
                    </FormErrorMessage>
                  </FormControl>
                </HStack>
                <HStack w="full" alignItems="baseline">
                  <FormControl isInvalid={!!form.formState.errors.inbound}>
                    <FormLabel>{t("clash.inbound")}</FormLabel>
                    <Select
                      disabled={disabled || editingProxy?.builtin}
                      size="sm"
                      placeholder="Select inbound"
                      {...form.register("inbound", {
                        onChange: (e) => {
                          const newInbound = findInbound(e.target.value)!;
                          const curr = form.getValues();
                          if (newInbound.type == "trojan") {
                            form.setValue("settings.trojan.security", "tls");
                          }
                          if (!curr.name || inbound?.name == curr.name) {
                            form.setValue("name", newInbound.name);
                          }
                          if (!curr.server || inbound?.server == curr.server) {
                            form.setValue("server", newInbound.server);
                          }
                          if (!curr.port || inbound?.port == curr.port) {
                            form.setValue("port", newInbound.port);
                          }
                          form.clearErrors("port");
                          form.clearErrors("inbound");
                          setInbound(newInbound);
                        },
                      })}
                    >
                      {proxyInbounds.map((value) => (
                        <option key={value.name} value={value.name}>
                          {value.name}
                        </option>
                      ))}
                    </Select>
                    <FormErrorMessage>
                      {terror(form.formState.errors.inbound?.message)}
                    </FormErrorMessage>
                  </FormControl>
                  <FormControl isInvalid={!!form.formState.errors.tag}>
                    <HStack mb="1">
                      <FormLabel mr="0" mb="0">
                        {t("tag")}
                      </FormLabel>
                      <Popover isLazy placement="right">
                        <PopoverTrigger>
                          <InfoIcon />
                        </PopoverTrigger>
                        <PopoverContent>
                          <PopoverArrow />
                          <Text fontSize="xs" p="2">
                            {t("clash.proxy.tag.info")}
                          </Text>
                        </PopoverContent>
                      </Popover>
                    </HStack>
                    <Input
                      size="sm"
                      type="text"
                      borderRadius="6px"
                      placeholder="bwh-aws"
                      disabled={disabled || editingProxy?.builtin}
                      {...form.register("tag")}
                    />
                    <FormErrorMessage>
                      {terror(form.formState.errors.tag?.message)}
                    </FormErrorMessage>
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
                          disabled={disabled}
                          size="sm"
                          placeholder="Select security"
                          {...form.register(
                            `settings.${inbound.type}.security`
                          )}
                        >
                          <option key="none" value="none">
                            none
                          </option>
                          <option key="tls" value="tls">
                            tls
                          </option>
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
                            {inbound.type == "trojan" && (
                              <FormControl>
                                <FormLabel>SNI</FormLabel>
                                <Input
                                  size="sm"
                                  type="text"
                                  borderRadius="6px"
                                  disabled={disabled}
                                  {...form.register(
                                    `settings.${inbound.type}.sni`
                                  )}
                                />
                              </FormControl>
                            )}
                            {(inbound.type == "vmess" ||
                              inbound.type == "vless") && (
                              <FormControl>
                                <FormLabel>
                                  {t("clash.proxy.serverName")}
                                </FormLabel>
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
                                    {...form.register(
                                      `settings.${inbound.type}.servername`
                                    )}
                                  />
                                )}
                              </FormControl>
                            )}
                            <HStack w="full">
                              <FormControl>
                                <FormLabel>ALPN</FormLabel>
                                <Select
                                  disabled={disabled}
                                  size="sm"
                                  {...form.register(
                                    `settings.${inbound.type}.alpn`
                                  )}
                                >
                                  {proxyALPN.map((v) => (
                                    <option key={v.value} value={v.value}>
                                      {v.title}
                                    </option>
                                  ))}
                                </Select>
                              </FormControl>
                              <FormControl>
                                <FormLabel>
                                  {t("clash.proxy.fingerprint")}
                                </FormLabel>
                                <Select
                                  disabled={disabled}
                                  size="sm"
                                  {...form.register(
                                    `settings.${inbound.type}.fingerprint`
                                  )}
                                >
                                  {proxyFingerprint.map((v) => (
                                    <option key={v.value} value={v.value}>
                                      {v.title}
                                    </option>
                                  ))}
                                </Select>
                              </FormControl>
                            </HStack>
                            <HStack pt={1} w="full" gap="4">
                              <FormControl
                                w="fit-content"
                                display="flex"
                                alignItems="center"
                              >
                                <FormLabel mb="0">UDP</FormLabel>
                                <Switch
                                  colorScheme="primary"
                                  {...form.register(
                                    `settings.${inbound.type}.udp`
                                  )}
                                />
                              </FormControl>
                              <FormControl
                                w="fit-content"
                                display="flex"
                                alignItems="center"
                              >
                                <FormLabel mb="0">
                                  {t("clash.proxy.allowInsecure")}
                                </FormLabel>
                                <Switch
                                  colorScheme="primary"
                                  {...form.register(
                                    `settings.${inbound.type}.allow_insecure`
                                  )}
                                />
                              </FormControl>
                            </HStack>
                          </VStack>
                        )}
                        {inbound?.type == "shadowsocks" && (
                          <HStack pt={1} w="full" gap="4">
                            <FormControl
                              w="fit-content"
                              display="flex"
                              alignItems="center"
                            >
                              <FormLabel mb="0">UDP</FormLabel>
                              <Switch
                                colorScheme="primary"
                                {...form.register(
                                  `settings.${inbound.type}.udp`
                                )}
                              />
                            </FormControl>
                          </HStack>
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
              <HStack justifyContent="space-between" w="full" gap={3}>
                {isEditing && (
                  <HStack spacing={2} pr={10}>
                    <Tooltip label={t("delete")} placement="top">
                      <IconButton
                        aria-label="Delete"
                        size="sm"
                        onClick={onDeletingProxy}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip
                      isDisabled={editingProxy.builtin}
                      label={t("duplicate")}
                      placement="top"
                    >
                      <IconButton
                        aria-label="duplicate proxy"
                        size="sm"
                        isDisabled={editingProxy.builtin}
                        onClick={() => onDuplicatingProxy(editingProxy!)}
                      >
                        <DuplicateIcon />
                      </IconButton>
                    </Tooltip>
                  </HStack>
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
                    isDisabled={disabled || !form.formState.isDirty}
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
