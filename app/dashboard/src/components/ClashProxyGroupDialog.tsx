import {
  Alert,
  AlertIcon,
  Button,
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
  Switch,
  Divider,
  Box,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionIcon,
  AccordionPanel,
  Tag,
  TagLabel,
  TagCloseButton,
  Input,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverArrow,
  InputGroup,
  InputLeftElement,
  InputRightElement,
  SimpleGrid,
} from "@chakra-ui/react";
import { FC, useEffect, useRef, useState } from "react";
import { Controller, FormProvider, useForm } from "react-hook-form";
import { Icon } from "./Icon";
import { useTranslation } from "react-i18next";
import { ProxyBrief, ProxyGroup, ProxyGroupSettings, useClash } from "contexts/ClashContext";
import { DeleteIcon } from "./DeleteUserModal";
import { AddIcon, ClearIcon, DuplicateIcon, EditIcon, InfoIcon, SearchIcon } from "./ClashModal";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

const types = ["select", "load-balance", "relay", "url-test", "fallback"];
const strategyTypes = ["consistent-hashing", "round-robin"];

export type ClashProxyGroupDialogProps = {};

export type FormType = Pick<ProxyGroup, keyof ProxyGroup> & { selected_proxies: string[] };

const schema = z.object({
  name: z.string().min(1, { message: "fieldRequired" }),
  tag: z.string().min(1, { message: "fieldRequired" }),
  type: z.string().min(1, { message: "fieldRequired" }),
  selected_proxies: z.array(z.string()),
  settings: z.record(z.string(), z.any()),
});

const getDefaultValues = (): FormType => {
  return {
    id: 0,
    name: "",
    tag: "",
    type: "select",
    builtin: false,
    proxies: "",
    selected_proxies: [],
    settings: {
      relay: {},
      url_test: {
        tolerance: 150,
        lazy: true,
        url: "http://cp.cloudflare.com/generate_204",
        interval: 300,
      },
      fallback: {
        url: "http://cp.cloudflare.com/generate_204",
        interval: 300,
      },
      load_balance: {
        strategy: "consistent-hashing",
        url: "http://cp.cloudflare.com/generate_204",
        interval: 300,
      },
      select: {
        disable_udp: true,
        filter: "",
      },
    },
  };
};

const formatProxyGroup = (group: ProxyGroup): FormType => {
  return {
    ...group,
    selected_proxies: group.proxies.split(",").filter((v) => v.length > 0),
  };
};

export const ClashProxyGroupDialog: FC<ClashProxyGroupDialogProps> = () => {
  const {
    editingProxyGroup,
    duplicatingProxyGroup,
    isCreatingProxyGroup,
    onEditingProxyGroup,
    onCreateProxyGroup,
    onDuplicatingProxyGroup,
    deleteProxyGroup,
    editProxyGroup,
    createProxyGroup,
    onAlert,
    proxyGroups,
  } = useClash();
  const isEditing = !!editingProxyGroup;
  const isOpen = isCreatingProxyGroup || isEditing;
  const message = isEditing ? "clash.proxyGroup.edited" : "clash.proxyGroup.created";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>("");
  const [type, setType] = useState("");
  const proxiesRef = useRef<HTMLSelectElement>(null);
  const toast = useToast();
  const { t } = useTranslation();
  const form = useForm<FormType>({
    defaultValues: getDefaultValues(),
    resolver: zodResolver(schema)
  });
  const proxyBriefs: { [key: string]: ProxyBrief } = proxyGroups.proxies.reduce((ac, a) => ({...ac, [a.id]: a}), {});

  useEffect(() => {
    if (editingProxyGroup) {
      form.reset(formatProxyGroup(editingProxyGroup));
      setType(editingProxyGroup.type);
    }
  }, [editingProxyGroup]);

  useEffect(() => {
    if (isCreatingProxyGroup) {
      if (duplicatingProxyGroup) {
        form.reset(duplicatingProxyGroup);
        setType(duplicatingProxyGroup.type);
      } else {
        form.reset(getDefaultValues());
        setType(types[0]);
      }
    }
  }, [isCreatingProxyGroup]);

  const [search, setSearch] = useState("");
  
  const onSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
  };
  const clear = () => {
    setSearch("");
  };

  const submit = (values: FormType) => {
    setLoading(true);
    
    setError(null);

    const {selected_proxies, ...rest} = values;
    let settings = {} as ProxyGroupSettings;
    if (values.settings.icon) {
      settings.icon = values.settings.icon;
    }
    if (values.type == "select") {
      settings.select = values.settings.select;
    } else if (values.type == "url-test") {
      settings.url_test = values.settings.url_test;
    } else if (values.type == "fallback") {
      settings.fallback = values.settings.fallback;
    } else if (values.type == "load-balance") {
      settings.load_balance = values.settings.load_balance;
    }
    let body: ProxyGroup = {
      ...rest,
      id: editingProxyGroup?.id,
      builtin: editingProxyGroup?.builtin || false,
      proxies: selected_proxies.join(","),
      settings: settings,
    };

    (isEditing ? editProxyGroup : createProxyGroup)(body)
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
              message = t(`error.${errobj.err}`);
            } catch (e) {}
            setError(message);
            form.setError(
              key as "name" | "tag",
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
    form.reset(getDefaultValues());
    onCreateProxyGroup(false);
    onEditingProxyGroup(null);
    onDuplicatingProxyGroup(null);
    setError(null);
    setLoading(false);
    onAlert(null);
  };

  const onDeletingProxyGroup = () => {
    onAlert({
      title: t("clash.proxyGroup.delete"),
      content: t("clash.proxyGroup.deletePrompt", { name: editingProxyGroup?.name }),
      type: "error",
      yes: t("delete"),
      onConfirm: () => {
        deleteProxyGroup(editingProxyGroup!)
          .then(() => {
            toast({
              title: t("clash.proxyGroup.deleteSuccess", { name: editingProxyGroup?.name }),
              status: "success",
              isClosable: true,
              position: "top",
              duration: 3000,
            });
            onClose();
          })
          .catch((err) => {
            toast({
              title: t("clash.proxyGroup.deleteFail"),
              status: "error",
              isClosable: true,
              position: "top",
              duration: 3000,
            });
          })
          .finally(() => {
            onAlert(null);
          });
      }
    });
  };

  const disabled = loading;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
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
                  {isEditing ? t("clash.proxyGroup.edit") : t("clash.proxyGroup.add")}
                </Text>
              </HStack>
            </ModalHeader>
            <ModalCloseButton mt={3} disabled={disabled} />
            <ModalBody>
              <VStack justifyContent="space-between">
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
                            {t("clash.proxyGroup.uniqueInfo")}
                          </Text>
                        </PopoverContent>
                      </Popover>
                    </HStack>
                    <Input
                      size="sm"
                      type="text"
                      borderRadius="6px"
                      disabled={disabled}
                      {...form.register("name")}
                    />
                  </FormControl>
                  {editingProxyGroup && !editingProxyGroup.builtin && (
                    <Box h="full">
                      <IconButton
                        mt="4"
                        aria-label="duplicate proxy"
                        bg="transparent"
                        onClick={() => onDuplicatingProxyGroup(editingProxyGroup!)}
                      >
                        <DuplicateIcon />
                      </IconButton>
                    </Box>
                  )}
                </HStack>
                <HStack w="full">
                  <FormControl w="60%">
                    <FormLabel>{t("clash.type")}</FormLabel>
                    <Controller
                      control={form.control}
                      name="type"
                      render={({ field: {onChange, ...rest} }) => {
                        return (
                          <Select 
                            disabled={disabled || editingProxyGroup?.builtin} 
                            size="sm" 
                            {...rest}
                            onChange={(e) => {
                              setType(e.target.value);
                              onChange(e);
                            }}
                          >
                            {types.map((value) => {
                              return (
                                <option key={value} value={value}>
                                  {value}
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
                      disabled={disabled || editingProxyGroup?.builtin}
                      {...form.register("tag")}
                    />
                  </FormControl>
                </HStack>
                <FormControl pt="2">
                  <HStack mb="1">
                    <FormLabel mr="0" mb="0">{t("clash.proxies")}</FormLabel>
                    <Popover isLazy placement="right">
                      <PopoverTrigger>
                        <InfoIcon />
                      </PopoverTrigger>
                      <PopoverContent>
                        <PopoverArrow />
                        <Text fontSize="xs" p="2" >
                          {t("clash.proxyGroup.proxiesInfo")}
                        </Text>
                      </PopoverContent>
                    </Popover>
                  </HStack>
                  <Controller
                    control={form.control}
                    name="selected_proxies"
                    render={({field: {onChange, value, ...rest}}) => {
                      return (
                        <VStack w="full">
                          <SimpleGrid w="full" spacingY="6px">
                            {value.map((id) => {
                              const proxy = proxyBriefs[id];
                              if (!proxy) {
                                return null;
                              }
                              let color = "primary";
                              if (proxy.id.startsWith("#")) {
                                color = "green";
                              } else if (proxy.builtin && proxy.id !== "...") {
                                color = "purple";
                              }
                              return (
                                <Tooltip key={id} label={proxy.server} placement="top">
                                  <Tag
                                    pl="3"
                                    pr="3"
                                    w="fit-content"
                                    size="md"
                                    borderRadius="full"
                                    variant="solid"
                                    cursor="default"
                                    colorScheme={color}
                                  >
                                    <TagLabel>{proxy.name}{" -> "}{proxy.tag}</TagLabel>
                                    {!proxy.builtin && (
                                      <TagCloseButton onClick={() => {
                                        const proxies = value.filter((v) => v !== id)
                                        onChange({
                                          target: {
                                            name: "selected_proxies",
                                            value: proxies,
                                          }
                                        })
                                      }}/>
                                    )}
                                  </Tag>
                                </Tooltip>
                              )
                            })}
                          </SimpleGrid >
                          <VStack w="full">
                            <HStack w="full">
                              <InputGroup>
                                <InputLeftElement
                                  height="8"
                                  pointerEvents="none"
                                  children={<SearchIcon />} 
                                />
                                <Input
                                  disabled={disabled || editingProxyGroup?.builtin}
                                  size="sm"
                                  borderRadius="md"
                                  placeholder={t("search")}
                                  value={search}
                                  borderColor="light-border"
                                  onChange={onSearchChange}
                                />

                                <InputRightElement height="8">
                                  {loading && <Spinner size="xs" />}
                                  {search.length > 0 && (
                                    <IconButton
                                      onClick={clear}
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
                              <Select
                                ref={proxiesRef}
                                disabled={disabled || editingProxyGroup?.builtin}
                                size="sm" 
                              >
                                {proxyGroups.proxies.map((proxy) => {
                                  const exists = value.some((v) => proxy.id === proxyBriefs[v]?.id);
                                  const id = `#${editingProxyGroup?.id}`;
                                  const name = `${proxy.name} -> ${proxy.tag}`;
                                  const notfound = search && name.toLowerCase().indexOf(search.toLowerCase()) < 0;
                                  if (exists || proxy.builtin || proxy.id == id || notfound) {
                                    return null;
                                  } else {
                                    return (
                                      <option key={proxy.id} value={proxy.id}>
                                        {name}
                                      </option>
                                    )
                                  }
                                })}
                              </Select>
                              <IconButton
                                size="sm"
                                aria-label='Add Proxy'
                                isDisabled={disabled || editingProxyGroup?.builtin}
                                icon={<AddIcon/>}
                                onClick={() => {
                                  const id = proxiesRef.current!.value;
                                  const proxy = proxyBriefs[id];
                                  const exists = value.some((v) => proxy.name === proxyBriefs[v]?.name);
                                  if (exists) {
                                    toast({
                                      title: t("clash.proxy.existed", {name: proxyBriefs[id].name}),
                                      status: "error",
                                      isClosable: true,
                                      position: "top",
                                      duration: 3000,
                                    });
                                  } else {
                                    form.clearErrors("proxies");
                                    onChange({
                                      target: {
                                        name: "selected_proxies",
                                        value: [...value, id],
                                      }
                                    });
                                  }
                                }}
                              />
                            </HStack>
                          </VStack>
                        </VStack>
                      )
                    }}
                  />
                </FormControl>
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
                        {type == "load-balance" && (
                          <VStack w="full">
                            <FormControl>
                              <FormLabel>{t("clash.strategy")}</FormLabel>
                              <Controller
                                control={form.control}
                                name="settings.load_balance.strategy"
                                render={({ field }) => {
                                  return (
                                    <Select size="sm" {...field}>
                                      {strategyTypes.map((value) => {
                                        return (
                                          <option key={value} value={value}>
                                            {value}
                                          </option>
                                        );
                                      })}
                                    </Select>
                                  );
                                }}
                              />
                            </FormControl>
                            <FormControl>
                              <FormLabel>{t("clash.url")}</FormLabel>
                              <Input
                                size="sm"
                                type="text"
                                borderRadius="6px"
                                {...form.register("settings.load_balance.url")}
                              />
                            </FormControl>
                            <FormControl>
                              <FormLabel>{t("clash.interval")}</FormLabel>
                              <Input
                                size="sm"
                                type="text"
                                borderRadius="6px"
                                {...form.register("settings.load_balance.interval")}
                              />
                            </FormControl>
                          </VStack>
                        )}
                        {type == "url-test" && (
                          <VStack w="full">
                            <FormControl>
                              <FormLabel>{t("clash.url")}</FormLabel>
                              <Input
                                size="sm"
                                type="text"
                                borderRadius="6px"
                                {...form.register("settings.url_test.url")}
                              />
                            </FormControl>
                            <FormControl>
                              <FormLabel>{t("clash.interval")}</FormLabel>
                              <Input
                                size="sm"
                                type="text"
                                borderRadius="6px"
                                {...form.register("settings.url_test.interval")}
                              />
                            </FormControl>
                            <FormControl>
                              <FormLabel>{t("clash.tolerance")}</FormLabel>
                              <Input
                                size="sm"
                                type="text"
                                borderRadius="6px"
                                {...form.register("settings.url_test.tolerance")}
                              />
                            </FormControl>
                            <FormControl pt="1" display='flex' alignItems='center'>
                              <FormLabel mb='0'>lazy</FormLabel>
                              <Switch {...form.register("settings.url_test.lazy")} />
                            </FormControl>
                          </VStack>
                        )}
                        {type == "fallback" && (
                          <VStack w="full">
                            <FormControl>
                              <FormLabel>{t("clash.url")}</FormLabel>
                              <Input
                                size="sm"
                                type="text"
                                borderRadius="6px"
                                {...form.register("settings.fallback.url")}
                              />
                            </FormControl>
                            <FormControl>
                              <FormLabel>{t("clash.interval")}</FormLabel>
                              <Input
                                size="sm"
                                type="text"
                                borderRadius="6px"
                                {...form.register("settings.fallback.interval")}
                              />
                            </FormControl>
                          </VStack>
                        )}
                        {type == "select" && (
                          <VStack w="full">
                            <FormControl>
                              <FormLabel>{t("clash.filter")}</FormLabel>
                              <Input
                                size="sm"
                                type="text"
                                borderRadius="6px"
                                disabled={editingProxyGroup?.builtin}
                                {...form.register("settings.select.filter")}
                              />
                            </FormControl>
                            <FormControl pt={2} display='flex' alignItems='center'>
                              <FormLabel mb='0'>disable-udp</FormLabel>
                              <Switch
                                disabled={editingProxyGroup?.builtin}
                                {...form.register("settings.select.disable_udp")}
                              />
                            </FormControl>
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
                {isEditing && !editingProxyGroup.builtin && (
                  <Tooltip label={t("delete")} placement="top">
                    <IconButton
                      aria-label="Delete"
                      size="sm"
                      onClick={onDeletingProxyGroup}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Tooltip>
                )}
                {isEditing && editingProxyGroup.builtin && (
                  <IconButton
                    aria-label="Delete"
                    size="sm"
                    isDisabled={true}
                    onClick={onDeletingProxyGroup}
                  >
                    <DeleteIcon />
                  </IconButton>
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
