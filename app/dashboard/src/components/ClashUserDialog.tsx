import {
  Alert,
  AlertIcon,
  Button,
  chakra,
  FormControl,
  FormLabel,
  HStack,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Spinner,
  Text,
  useToast,
  VStack,
  Select,
  Wrap,
  WrapItem,
  Tag,
  TagLabel,
  TagCloseButton,
  IconButton,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverArrow,
  Input,
  InputGroup,
  InputLeftElement,
  InputRightElement,
  Tooltip,
  SimpleGrid,
} from "@chakra-ui/react";
import { FC, useEffect, useRef, useState } from "react";
import { Controller, FormProvider, useForm } from "react-hook-form";
import { Icon } from "./Icon";
import { useTranslation } from "react-i18next";
import { User, useClash } from "contexts/ClashContext";
import { AddIcon, ClearIcon, EditIcon, InfoIcon, RefreshIcon, SearchIcon } from "./ClashModal";

export type ClashUserDialogProps = {};

type FormType = Pick<User, keyof User> & { selected_tags: string[] };

const getDefaultValues = (): FormType => {
  return {
    username: "",
    tags: "",
    code: "",
    domain: "",
    selected_tags: [],
  };
};

const formatUser = (user: User): FormType => {
  return {
    ...user,
    selected_tags: user.tags?.split(",").filter((v) => v.length > 0) || [],
  };
};

export const ClashUserDialog: FC<ClashUserDialogProps> = () => {
  const {
    editingUser,
    onEditingUser,
    resetUserAuthCode,
    editUser,
    proxyTags,
    onAlert,
  } = useClash();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>("");
  const toast = useToast();
  const { t } = useTranslation();
  const tagRef = useRef<HTMLSelectElement>(null);
  const [domain, setDomain] = useState("");
  const form = useForm<FormType>({ defaultValues: getDefaultValues() });

  const doResetUserAuthCode = () => {
    return resetUserAuthCode(editingUser!)
      .then(() => {
        form.reset(formatUser(editingUser!), {keepDirtyValues: true, keepDirty: true});
      });
  };

  const [search, setSearch] = useState("");
  
  const onSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
  };
  const clear = () => {
    setSearch("");
  };

  const handlerRefreshAuthCode = () => {
    onAlert({
      title: t("clash.user.resetAuthCode"),
      content: t("clash.user.resetAuthCodePrompt", { name: editingUser?.username }),
      type: "warning",
      yes: t("reset"),
      onConfirm: () => {
        doResetUserAuthCode()
          .then(() => {
            toast({
              title: t("clash.user.resetAuthCodeSuccess", { name: editingUser?.username }),
              status: "success",
              isClosable: true,
              position: "top",
              duration: 3000,
            });
          })
          .catch((err) => {
            toast({
              title: t("clash.user.resetAuthCodeFail"),
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

  useEffect(() => {
    if (editingUser) {
      form.reset(formatUser(editingUser));
      setDomain(editingUser.domain || "");
      if (!editingUser.code || editingUser.code.length == 0) {
        doResetUserAuthCode();
      }
    }
  }, [editingUser]);

  const submit = (values: FormType) => {
    setLoading(true);
    setError(null);

    const {selected_tags, ...rest} = values;
    let body: User = {
      ...rest,
      tags: selected_tags.join(','),
    };

    editUser(body)
      .then(() => {
        toast({
          title: t("clash.user.edited", {name: values.username}),
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
            setError(err?.response?._data?.detail[key]);
            form.setError(
              key as "tags",
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
    onEditingUser(null);
    setError(null);
    setDomain("");
    setSearch("");
  };

  const disabled = loading;

  return (
    <Modal isOpen={!!editingUser} onClose={onClose} size="md">
      <ModalOverlay bg="blackAlpha.300" backdropFilter="blur(10px)" />
      <FormProvider {...form}>
        <ModalContent mx="3">
          <form onSubmit={form.handleSubmit(submit)}>
            <ModalHeader pt={6}>
              <HStack gap={2}>
                <Icon color="primary">
                  <EditIcon color="white" />
                </Icon>
                <Text fontWeight="semibold" fontSize="lg">
                  {t("clash.user.edit")}
                </Text>
              </HStack>
            </ModalHeader>
            <ModalCloseButton mt={3} disabled={disabled} />
            <ModalBody>
              <VStack justifyContent="space-between">
                <FormControl mb="10px" isInvalid={!!form.formState.errors.username}>
                  <FormLabel>{t("clash.username")}</FormLabel>
                  <Input
                    size="sm"
                    type="text"
                    borderRadius="6px"
                    disabled={true}
                    {...form.register("username")}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel>{t("clash.user.authcode")}</FormLabel>
                  <HStack>
                    <Input
                      size="sm"
                      type="text"
                      borderRadius="6px"
                      disabled={true}
                      {...form.register("code")}
                    />
                    <IconButton
                      size="sm"
                      aria-label='Refresh Auth Code'
                      isDisabled={disabled}
                      icon={<RefreshIcon />}
                      onClick={handlerRefreshAuthCode}
                    />
                  </HStack>
                </FormControl>
                <FormControl mb="10px" isInvalid={!!form.formState.errors.domain}>
                  <FormLabel>{t("clash.domain")}</FormLabel>
                  <Controller
                    control={form.control}
                    name="domain"
                    render={({field: {onChange, ...rest}}) => {
                      return (
                        <Input
                          size="sm"
                          type="text"
                          borderRadius="6px"
                          placeholder="Domain (e.g. https://example.com)"
                          disabled={disabled}
                          {...rest}
                          onChange={(e) => {
                            setDomain(e.target.value);
                            onChange(e);
                          }}
                        />
                      );
                    }}
                  />
                  {domain && (
                    <Text
                      pt="1"
                      fontSize="xs"
                      color="gray.500"
                    >
                      {domain}/clash/sub/{editingUser?.code}/{editingUser?.username}
                    </Text>
                  )}
                </FormControl>
                <FormControl pt="2">
                  <HStack mb="1">
                    <FormLabel mr="0" mb="0">
                      {t("clash.user.proxyTags")}
                    </FormLabel>
                    <Popover isLazy placement="right">
                      <PopoverTrigger>
                        <InfoIcon />
                      </PopoverTrigger>
                      <PopoverContent>
                        <PopoverArrow />
                        <Text fontSize="xs" p="2" >
                          {t("clash.user.proxyTags.info")}
                        </Text>
                      </PopoverContent>
                    </Popover>
                  </HStack>
                  <Controller
                    control={form.control}
                    name="selected_tags"
                    render={({field: {onChange, value}}) => {
                      const showBuiltin = value.length == 0;
                      const showingTags = showBuiltin ? ["built-in"] : value;
                      return (
                        <VStack>
                          <Wrap w="full">
                            {showingTags.map((tag) => {
                              const entry = proxyTags.filter((v) => v.tag == tag)[0];
                              if (!entry) {
                                return null;
                              }
                              return (
                                <WrapItem key={tag}>
                                  <Popover isLazy trigger="hover" placement="top">
                                    <PopoverTrigger>
                                      <Tag
                                        w="fit-content"
                                        size="md"
                                        pl="3"
                                        pr="3"
                                        borderRadius="full"
                                        variant="solid"
                                        cursor="default"
                                        colorScheme={showBuiltin ? "gray": "primary"}
                                      >
                                        <TagLabel>{tag}</TagLabel>
                                        {!showBuiltin && (
                                          <TagCloseButton onClick={() => {
                                            const tags = value.filter((v) => v !== tag)
                                            onChange({
                                              target: {
                                                name: "selected_tags",
                                                value: tags,
                                              }
                                            })
                                          }}/>
                                        )}
                                      </Tag>
                                    </PopoverTrigger>
                                    <PopoverContent w="full">
                                      <PopoverArrow />
                                      <SimpleGrid p="1" pl="3" pr="3" w="full" alignItems="flex-start">
                                        {entry.servers.map((value, index) => {
                                          return (
                                            <Text key={index} fontSize="sm">
                                              {value}
                                            </Text>
                                          )
                                        })}
                                      </SimpleGrid>
                                    </PopoverContent>
                                  </Popover>
                                </WrapItem>
                              )
                            })}
                          </Wrap>
                          <HStack w="full">
                            <InputGroup w="85%">
                              <InputLeftElement
                                height="8"
                                pointerEvents="none"
                                children={<SearchIcon />} 
                              />
                              <Input
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
                            <Select
                              ref={tagRef}
                              disabled={disabled} 
                              size="sm" 
                            >
                              {proxyTags.map((entry) => {
                                const exists = value.some((v) => v === entry.tag);
                                const builtin = entry.tag === "built-in";
                                const notfound = search && entry.tag.toLowerCase().indexOf(search.toLowerCase()) < 0;
                                if (exists || builtin || notfound) {
                                  return null;
                                } else {
                                  return (
                                    <option key={entry.tag} value={entry.tag}>{entry.tag}</option>
                                  )
                                }
                              })}
                            </Select>
                            <IconButton
                              size="sm"
                              aria-label='Add Tags'
                              isDisabled={disabled}
                              icon={<AddIcon />}
                              onClick={() => {
                                const tag = tagRef.current!.value;
                                const exists = value.some((v) => tag === v);
                                if (exists) {
                                  toast({
                                    title: t("clash.tagExisted", {name: tag}),
                                    status: "error",
                                    isClosable: true,
                                    position: "top",
                                    duration: 3000,
                                  });
                                } else {
                                  if (form.getFieldState("tags").error) {
                                    form.clearErrors("tags");
                                  }
                                  onChange({
                                    target: {
                                      name: "selected_tags",
                                      value: [...value, tag],
                                    }
                                  });
                                }
                              }}
                            />
                          </HStack>
                        </VStack>
                      )
                    }}
                  />
                </FormControl>
                {error && (
                  <Alert status="error">
                    <AlertIcon />
                    {error}
                  </Alert>
                )}
              </VStack>
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
                    {t("update")}
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
