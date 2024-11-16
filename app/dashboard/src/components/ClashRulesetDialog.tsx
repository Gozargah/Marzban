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
  FormControl,
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
  Radio,
  RadioGroup,
  Select,
  Spinner,
  Stack,
  Switch,
  Text,
  Tooltip,
  VStack,
  chakra,
  useToast
} from "@chakra-ui/react";
import { PencilIcon, PlusIcon } from "@heroicons/react/24/outline";
import { Ruleset, useClash } from "contexts/ClashContext";
import { FC, useEffect, useState } from "react";
import { Controller, FormProvider, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { tryParseJSON } from "utils/json";
import { DeleteIcon } from "./DeleteUserModal";
import { Icon } from "./Icon";

const AddIcon = chakra(PlusIcon, {
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

export type ClashRulesetDialogProps = {};

const getDefaultValues = (): Ruleset => {
  return {
    id: 0,
    name: "",
    builtin: false,
    policy: "PROXY",
    settings: {
      as_provider: false,
      type: "http",
      behavior: "classical",
      format: "yaml",
      interval: 3600,
    },
  };
};

export type FormType = Ruleset;

export const ClashRulesetDialog: FC<ClashRulesetDialogProps> = () => {
  const {
    editingRuleset,
    isCreatingRuleset,
    onEditingRuleset,
    onCreateRuleset,
    deleteRuleset,
    editRuleset,
    createRuleset,
    onRuleFilterChange,
    onAlert,
  } = useClash();
  const isEditing = !!editingRuleset;
  const isOpen = isCreatingRuleset || isEditing;
  const title = isEditing ? "clash.ruleset.edited" : "clash.ruleset.created";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>("");
  const [asProvider, setAsProvider] = useState(false);
  const toast = useToast();
  const { t } = useTranslation();
  const form = useForm<FormType>({ defaultValues: getDefaultValues() });

  useEffect(() => {
    if (editingRuleset) {
      form.reset(editingRuleset);
      setAsProvider(editingRuleset.settings.as_provider ?? false);
    }
  }, [editingRuleset]);

  const submit = (values: FormType) => {
    setLoading(true);
    setError(null);

    let body: Ruleset = values;

    (isEditing ? editRuleset : createRuleset)(body)
      .then(() => {
        toast({
          title: t(title, { name: values.name }),
          status: "success",
          isClosable: true,
          position: "top",
          duration: 3000,
        });
        onRuleFilterChange({
          ruleset: body.name,
          offset: 0,
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
            form.setError(key as "name" | "policy", {
              type: "custom",
              message: message,
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
    onCreateRuleset(false);
    setAsProvider(false);
    onEditingRuleset(null);
    setError(null);
    onAlert(null);
  };

  const onDeletingRuleset = () => {
    onAlert({
      title: t("clash.ruleset.delete"),
      content: t("clash.ruleset.deletePrompt", { name: editingRuleset?.name }),
      type: "error",
      yes: t("delete"),
      onConfirm: () => {
        deleteRuleset(editingRuleset!)
          .then(() => {
            toast({
              title: t("clash.ruleset.deleteSuccess", {
                name: editingRuleset?.name,
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
              title: t("clash.ruleset.deleteFail"),
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
                  {isEditing ? t("clash.ruleset.edit") : t("clash.ruleset.add")}
                </Text>
              </HStack>
            </ModalHeader>
            <ModalCloseButton mt={3} disabled={disabled} />
            <ModalBody>
              <VStack justifyContent="space-between">
                <FormControl mb="0" isInvalid={!!form.formState.errors.name}>
                  <FormLabel>{t("clash.name")}</FormLabel>
                  <Input
                    size="sm"
                    type="text"
                    borderRadius="6px"
                    disabled={disabled || editingRuleset?.builtin}
                    {...form.register("name")}
                  />
                </FormControl>
                <FormControl mb="0px" pt="10px">
                  <FormLabel>{t("clash.policy")}</FormLabel>
                  <Controller
                    control={form.control}
                    name="policy"
                    render={({ field }) => (
                      <RadioGroup
                        isDisabled={disabled || editingRuleset?.builtin}
                        {...field}
                      >
                        <Stack direction="row" spacing="6">
                          {["DIRECT", "PROXY", "REJECT"].map((v) => (
                            <Radio
                              key={v}
                              value={v}
                              size="md"
                              colorScheme="primary"
                            >
                              <Text fontSize="sm">{v}</Text>
                            </Radio>
                          ))}
                        </Stack>
                      </RadioGroup>
                    )}
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
                        <FormControl mb="10px">
                          <FormLabel>{t("clash.icon")}</FormLabel>
                          <Input
                            size="sm"
                            type="text"
                            borderRadius="6px"
                            disabled={disabled}
                            {...form.register("settings.icon")}
                          />
                        </FormControl>
                        <FormControl display="flex" alignItems="center">
                          <FormLabel mb="0">
                            {t("clash.ruleset.asRuleProvider")}
                          </FormLabel>
                          <Switch
                            disabled={disabled || editingRuleset?.builtin}
                            colorScheme="primary"
                            {...form.register("settings.as_provider", {
                              onChange: (e) => setAsProvider(e.target.checked),
                            })}
                          />
                        </FormControl>
                        {asProvider && (
                          <VStack w="full">
                            <HStack w="full">
                              <FormControl>
                                <FormLabel>{t("clash.behavior")}</FormLabel>
                                <Select
                                  size="sm"
                                  {...form.register("settings.behavior")}
                                >
                                  {["classical", "domain", "ipcidr"].map(
                                    (v) => (
                                      <option key={v} value={v}>
                                        {v}
                                      </option>
                                    )
                                  )}
                                </Select>
                              </FormControl>
                              <FormControl>
                                <FormLabel>{t("clash.type")}</FormLabel>
                                <Select
                                  size="sm"
                                  {...form.register("settings.type")}
                                >
                                  {["http", "file"].map((v) => (
                                    <option key={v} value={v}>
                                      {v}
                                    </option>
                                  ))}
                                </Select>
                              </FormControl>
                            </HStack>
                            <HStack w="full">
                              <FormControl>
                                <FormLabel>{t("clash.format")}</FormLabel>
                                <Select
                                  size="sm"
                                  {...form.register("settings.format")}
                                >
                                  {["yaml", "text"].map((v) => (
                                    <option key={v} value={v}>
                                      {v}
                                    </option>
                                  ))}
                                </Select>
                              </FormControl>
                              <FormControl>
                                <FormLabel>{t("clash.interval")}</FormLabel>
                                <Input
                                  size="sm"
                                  type="text"
                                  borderRadius="6px"
                                  {...form.register("settings.interval")}
                                />
                              </FormControl>
                            </HStack>
                            <FormControl>
                              <FormLabel>{t("clash.url")}</FormLabel>
                              <Input
                                size="sm"
                                type="text"
                                borderRadius="6px"
                                {...form.register("settings.url")}
                              />
                            </FormControl>
                            <FormControl>
                              <FormLabel>{t("clash.path")}</FormLabel>
                              <Input
                                size="sm"
                                type="text"
                                borderRadius="6px"
                                {...form.register("settings.path")}
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
            <ModalFooter mt="3">
              <HStack justifyContent="space-between" w="full" gap={3}>
                {isEditing && (
                  <Tooltip label={t("delete")} placement="top">
                    <IconButton
                      aria-label="Delete"
                      size="sm"
                      onClick={onDeletingRuleset}
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
                    isDisabled={disabled || !form.formState.isDirty}
                  >
                    {isEditing ? t("clash.update") : t("clash.create")}
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
