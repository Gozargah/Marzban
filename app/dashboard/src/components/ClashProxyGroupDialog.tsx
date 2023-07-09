import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Alert,
  AlertIcon,
  Box,
  Button,
  Center,
  Divider,
  FormControl,
  FormErrorMessage,
  FormLabel,
  HStack,
  IconButton,
  Input,
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
  useToast,
} from "@chakra-ui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ProxyBrief,
  ProxyGroup,
  ProxyGroupSettings,
  useClash,
} from "contexts/ClashContext";
import { FC, useEffect, useRef, useState } from "react";
import { DragDropContext, Draggable } from "react-beautiful-dnd";
import { FormProvider, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { tryParseJSON } from "utils/json";
import { z } from "zod";
import {
  AddIcon,
  ClearIcon,
  Droppable,
  DuplicateIcon,
  EditIcon,
  InfoIcon,
  RankIcon,
  SearchIcon,
} from "./ClashModal";
import { DeleteIcon } from "./DeleteUserModal";
import { Icon } from "./Icon";

const types = ["select", "load-balance", "relay", "url-test", "fallback"];
const strategyTypes = ["consistent-hashing", "round-robin"];

export type ClashProxyGroupDialogProps = {};

export type FormType = Pick<ProxyGroup, keyof ProxyGroup> & {
  selected_proxies: string[];
};

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
    proxyBriefs,
  } = useClash();
  const isEditing = !!editingProxyGroup;
  const isOpen = isCreatingProxyGroup || isEditing;
  const title = isEditing
    ? "clash.proxyGroup.edited"
    : "clash.proxyGroup.created";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>("");
  const [type, setType] = useState("");
  const proxiesRef = useRef<HTMLSelectElement>(null);
  const toast = useToast();
  const { t } = useTranslation();
  const form = useForm<FormType>({
    defaultValues: getDefaultValues(),
    resolver: zodResolver(schema),
  });
  const briefMap: { [key: string]: ProxyBrief } = proxyBriefs.reduce(
    (ac, a) => ({ ...ac, [a.id]: a }),
    {}
  );

  useEffect(() => {
    if (editingProxyGroup) {
      form.reset(formatProxyGroup(editingProxyGroup));
      setType(editingProxyGroup.type);
    }
  }, [editingProxyGroup]);

  useEffect(() => {
    if (isCreatingProxyGroup) {
      if (duplicatingProxyGroup) {
        form.reset(formatProxyGroup(duplicatingProxyGroup));
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
  const clearSearch = () => {
    setSearch("");
  };

  const submit = (values: FormType) => {
    setLoading(true);

    setError(null);

    const { selected_proxies, ...rest } = values;
    let settings = {} as ProxyGroupSettings;
    settings.icon = values.settings.icon;
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
            form.setError(key as "name" | "tag", {
              type: "custom",
              message: tfield,
            });
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
    clearSearch();
  };

  const onDeletingProxyGroup = () => {
    onAlert({
      title: t("clash.proxyGroup.delete"),
      content: t("clash.proxyGroup.deletePrompt", {
        name: editingProxyGroup?.name,
      }),
      type: "error",
      yes: t("delete"),
      onConfirm: () => {
        deleteProxyGroup(editingProxyGroup!)
          .then(() => {
            toast({
              title: t("clash.proxyGroup.deleteSuccess", {
                name: editingProxyGroup?.name,
              }),
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
              status: "warning",
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

  const terror = (error: string | undefined) => {
    return error ? t(error) : error;
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
                  {isEditing
                    ? t("clash.proxyGroup.edit")
                    : t("clash.proxyGroup.add")}
                </Text>
              </HStack>
            </ModalHeader>
            <ModalCloseButton mt={3} disabled={disabled} />
            <ModalBody>
              <VStack justifyContent="space-between">
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
                    <FormErrorMessage>
                      {terror(form.formState.errors.name?.message)}
                    </FormErrorMessage>
                  </FormControl>
                </HStack>
                <HStack w="full" alignItems="baseline">
                  <FormControl w="60%">
                    <FormLabel>{t("clash.type")}</FormLabel>
                    <Select
                      disabled={disabled || editingProxyGroup?.builtin}
                      size="sm"
                      {...form.register("type", {
                        onChange: (e) => setType(e.target.value),
                      })}
                    >
                      {types.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </Select>
                    <FormErrorMessage>
                      {terror(form.formState.errors.type?.message)}
                    </FormErrorMessage>
                  </FormControl>
                  <FormControl isInvalid={!!form.formState.errors.tag}>
                    <FormLabel>{t("tag")}</FormLabel>
                    <Input
                      size="sm"
                      type="text"
                      borderRadius="6px"
                      disabled={disabled || editingProxyGroup?.builtin}
                      {...form.register("tag")}
                    />
                    <FormErrorMessage>
                      {terror(form.formState.errors.tag?.message)}
                    </FormErrorMessage>
                  </FormControl>
                </HStack>
                <FormControl pt="2">
                  <HStack mb="1">
                    <FormLabel mr="0" mb="0">
                      {t("clash.proxies")}
                    </FormLabel>
                    <Popover isLazy placement="right">
                      <PopoverTrigger>
                        <InfoIcon />
                      </PopoverTrigger>
                      <PopoverContent>
                        <PopoverArrow />
                        <Text fontSize="xs" p="2">
                          {t("clash.proxyGroup.proxiesInfo")}
                        </Text>
                      </PopoverContent>
                    </Popover>
                  </HStack>
                  <VStack w="full">
                    <DragDropContext
                      onDragEnd={(result) => {
                        if (!result.destination) {
                          return;
                        }
                        const proxies = Array.from(
                          form.getValues().selected_proxies
                        );
                        const [removed] = proxies.splice(
                          result.source.index,
                          1
                        );
                        proxies.splice(result.destination.index, 0, removed);
                        form.setValue("selected_proxies", proxies, {
                          shouldDirty: true,
                        });
                      }}
                    >
                      <Droppable droppableId="droppable">
                        {(provided) => (
                          <SimpleGrid
                            w="full"
                            {...provided.droppableProps}
                            ref={provided.innerRef}
                          >
                            {form
                              .getValues()
                              .selected_proxies.map((id, index) => {
                                const proxy = briefMap[id] || {
                                  id: id,
                                  name: `(${id})`,
                                  server: "Not Found",
                                  tag: `<Not Found>`,
                                  builtin: false,
                                };
                                let colorScheme = "primary";
                                if (!briefMap[id]) {
                                  colorScheme = "red";
                                } else if (proxy.id.startsWith("#")) {
                                  colorScheme = "green";
                                } else if (
                                  proxy.builtin &&
                                  proxy.id !== "..."
                                ) {
                                  colorScheme = "purple";
                                }
                                return (
                                  <Draggable
                                    key={proxy.id}
                                    index={index}
                                    draggableId={proxy.id}
                                    isDragDisabled={editingProxyGroup?.builtin}
                                  >
                                    {(provided) => (
                                      <Tag
                                        ref={provided.innerRef}
                                        {...provided.draggableProps}
                                        {...provided.dragHandleProps}
                                        pl="3"
                                        pr="3"
                                        mb="1"
                                        w="fit-content"
                                        size="md"
                                        borderRadius="full"
                                        variant="solid"
                                        cursor="default"
                                        colorScheme={colorScheme}
                                      >
                                        {!editingProxyGroup?.builtin && (
                                          <TagLeftIcon
                                            boxSize="18px"
                                            as={RankIcon}
                                          />
                                        )}
                                        <Popover
                                          isLazy
                                          trigger="hover"
                                          placement="top"
                                        >
                                          <PopoverTrigger>
                                            <Center
                                              height="full"
                                              cursor="default"
                                            >
                                              <TagLabel>
                                                {proxy.name}
                                                {" -> "}
                                                {proxy.tag}
                                              </TagLabel>
                                            </Center>
                                          </PopoverTrigger>
                                          {!!proxy.server && (
                                            <PopoverContent w="full">
                                              <PopoverArrow />
                                              <Text
                                                p="2"
                                                pl="3"
                                                pr="3"
                                                color="gray.800"
                                                _dark={{
                                                  color: "whiteAlpha.900",
                                                }}
                                              >
                                                {proxy.server}
                                              </Text>
                                            </PopoverContent>
                                          )}
                                        </Popover>
                                        {!editingProxyGroup?.builtin && (
                                          <TagCloseButton
                                            onClick={() => {
                                              const value =
                                                form.getValues()
                                                  .selected_proxies;
                                              const proxies = value.filter(
                                                (v) => v !== id
                                              );
                                              form.setValue(
                                                "selected_proxies",
                                                proxies,
                                                {
                                                  shouldDirty: true,
                                                  shouldValidate: true,
                                                }
                                              );
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
                        )}
                      </Droppable>
                    </DragDropContext>
                    <VStack w="full">
                      <HStack w="full">
                        <InputGroup>
                          <InputLeftElement
                            height="8"
                            pointerEvents="none"
                            children={
                              <IconButton
                                aria-label="clear"
                                size="xs"
                                bgColor="unset"
                                isDisabled={
                                  disabled || editingProxyGroup?.builtin
                                }
                              >
                                <SearchIcon />
                              </IconButton>
                            }
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
                                onClick={clearSearch}
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
                          {proxyBriefs.map((proxy) => {
                            const value = form.getValues().selected_proxies;
                            const exists = value.some((id) => proxy.id === id);
                            const id = `#${editingProxyGroup?.id}`;
                            const name = `${proxy.name} -> ${proxy.tag}`;
                            const notfound =
                              search &&
                              name.toLowerCase().indexOf(search.toLowerCase()) <
                                0;
                            if (
                              exists ||
                              proxy.builtin ||
                              proxy.id == id ||
                              notfound
                            ) {
                              return null;
                            } else {
                              return (
                                <option key={proxy.id} value={proxy.id}>
                                  {name}
                                </option>
                              );
                            }
                          })}
                        </Select>
                        <IconButton
                          size="sm"
                          aria-label="Add Proxy"
                          isDisabled={disabled || editingProxyGroup?.builtin}
                          icon={<AddIcon />}
                          onClick={() => {
                            const value = form.getValues().selected_proxies;
                            const id = proxiesRef.current!.value;
                            const proxy = briefMap[id];
                            const exists = value.some(
                              (id) => proxy.name === briefMap[id]?.name
                            );
                            if (exists) {
                              toast({
                                title: t("clash.proxy.exists", {
                                  name: briefMap[id].name,
                                }),
                                status: "error",
                                isClosable: true,
                                position: "top",
                                duration: 3000,
                              });
                            } else {
                              form.clearErrors("proxies");
                              form.setValue(
                                "selected_proxies",
                                [...value, id],
                                { shouldDirty: true }
                              );
                            }
                          }}
                        />
                      </HStack>
                    </VStack>
                  </VStack>
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
                              <Select
                                size="sm"
                                {...form.register(
                                  "settings.load_balance.strategy"
                                )}
                              >
                                {strategyTypes.map((value) => (
                                  <option key={value} value={value}>
                                    {value}
                                  </option>
                                ))}
                              </Select>
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
                                {...form.register(
                                  "settings.load_balance.interval"
                                )}
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
                                {...form.register(
                                  "settings.url_test.tolerance"
                                )}
                              />
                            </FormControl>
                            <FormControl
                              pt="1"
                              display="flex"
                              alignItems="center"
                            >
                              <FormLabel mb="0">lazy</FormLabel>
                              <Switch
                                colorScheme="primary"
                                {...form.register("settings.url_test.lazy")}
                              />
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
                            <FormControl
                              pt={2}
                              display="flex"
                              alignItems="center"
                            >
                              <FormLabel mb="0">disable-udp</FormLabel>
                              <Switch
                                colorScheme="primary"
                                disabled={editingProxyGroup?.builtin}
                                {...form.register(
                                  "settings.select.disable_udp"
                                )}
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
              <HStack justifyContent="space-between" w="full" gap={3}>
                {isEditing && (
                  <HStack spacing={2} pr={5}>
                    <Tooltip
                      isDisabled={editingProxyGroup.builtin}
                      label={t("delete")}
                      placement="top"
                    >
                      <IconButton
                        isDisabled={editingProxyGroup.builtin}
                        aria-label="Delete"
                        size="sm"
                        onClick={onDeletingProxyGroup}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip
                      isDisabled={editingProxyGroup.builtin}
                      label={t("duplicate")}
                      placement="top"
                    >
                      <IconButton
                        isDisabled={editingProxyGroup.builtin}
                        aria-label="Duplicate proxy group"
                        size="sm"
                        onClick={() =>
                          onDuplicatingProxyGroup(editingProxyGroup!)
                        }
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
