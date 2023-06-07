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
  Flex,
  Wrap,
  WrapItem,
  Tag,
  TagLabel,
  TagCloseButton,
  IconButton,
  Popover,
  PopoverTrigger,
  Portal,
  PopoverContent,
  PopoverArrow,
  PopoverCloseButton,
  Input,
} from "@chakra-ui/react";
import {
  PencilIcon,
  PlusIcon,
  ArrowPathRoundedSquareIcon,
  InformationCircleIcon
} from "@heroicons/react/24/outline";
import { FC, useEffect, useRef, useState } from "react";
import { Controller, FormProvider, useForm } from "react-hook-form";
import { Icon } from "./Icon";
import { useTranslation } from "react-i18next";
import { User, useClash } from "contexts/ClashContext";
import { InfoIcon } from "./ClashModal";

const AddIcon = chakra(PlusIcon, {
  baseStyle: {
    w: 5,
    h: 5,
  },
});

const RefreshIcon = chakra(ArrowPathRoundedSquareIcon, {
  baseStyle: {
    w: 5,
    h: 5,
  },
});

const EditIcon = chakra(PencilIcon, {
  baseStyle: {
    w: 5,
    h: 5,
  },
});

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
    setDomain("")
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
                      icon={<RefreshIcon/>}
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
                      return (
                        <VStack>
                          <Wrap w="full">
                            {value.map((tag) => {
                              return (
                                <WrapItem key={tag}>
                                  <Tag
                                    w="fit-content"
                                    size="md"
                                    borderRadius="full"
                                    variant="solid"
                                    colorScheme="primary"
                                  >
                                    <TagLabel>{tag}</TagLabel>
                                    <TagCloseButton onClick={() => {
                                      const tags = value.filter((v) => v !== tag)
                                      onChange({
                                        target: {
                                          name: "selected_tags",
                                          value: tags,
                                        }
                                      })
                                    }}/>
                                  </Tag>
                                </WrapItem>
                              )
                            })}
                          </Wrap>
                          <HStack w="full">
                            <Select
                              ref={tagRef}
                              disabled={disabled} 
                              size="sm" 
                            >
                              {proxyTags.data.map((tag) => {
                                const exists = value.some((v) => v === tag); 
                                if (exists) {
                                  return null;
                                } else {
                                  return (
                                    <option key={tag} value={tag}>{tag}</option>
                                  )
                                }
                              })}
                            </Select>
                            <IconButton
                              size="sm"
                              aria-label='Add Tags'
                              isDisabled={disabled}
                              icon={<AddIcon/>}
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
