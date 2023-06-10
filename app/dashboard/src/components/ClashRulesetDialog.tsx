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
  RadioGroup,
  Stack,
  Radio,
  Input,
} from "@chakra-ui/react";
import { PencilIcon, PlusIcon} from "@heroicons/react/24/outline";
import { FC, useEffect, useState } from "react";
import { Controller, FormProvider, useForm } from "react-hook-form";
import { Icon } from "./Icon";
import { useTranslation } from "react-i18next";
import { Ruleset, useClash } from "contexts/ClashContext";
import { DeleteIcon } from "./DeleteUserModal";

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
    preferred_proxy: "PROXY",
    settings: {}
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
  const message = isEditing ? "clash.ruleset.edited" : "clash.ruleset.created";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>("");
  const toast = useToast();
  const { t } = useTranslation();
  const form = useForm<FormType>({ defaultValues: getDefaultValues() });

  useEffect(() => {
    if (editingRuleset) {
      form.reset(editingRuleset);
    }
  }, [editingRuleset]);

  const submit = (values: FormType) => {
    setLoading(true);
    setError(null);

    let body: Ruleset = values;

    (isEditing ? editRuleset : createRuleset)(body)
      .then(() => {
        toast({
          title: t(message, {name: values.name}),
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
        if (err?.response?.status === 409 
            || err?.response?.status === 400
            || err?.response?.status === 404) {
          var message = err?.response?._data?.detail;
          try {
            message = t(`error.${message.err}`);
          } catch (e) {}
          setError(message);
        }
        if (err?.response?.status === 422) {
          Object.keys(err.response._data.detail).forEach((key) => {
            let message = err.response._data.detail[key];
            try {
              const errobj = JSON.parse(message.replace(/"/g, '\\"').replace(/'/g, '"'));
              message = t(`error.${errobj.err}`);
            } catch (e) {}
            setError(message);
            form.setError(
              key as "name" | "preferred_proxy",
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
    onCreateRuleset(false);
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
              title: t("clash.ruleset.deleteSuccess", { name: editingRuleset?.name }),
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
    <Modal isOpen={isOpen} onClose={onClose} size="sm">
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
                <FormControl mb="10px" isInvalid={!!form.formState.errors.name}>
                  <FormLabel>{t("clash.name")}</FormLabel>
                  <Input
                    size="sm"
                    type="text"
                    borderRadius="6px"
                    disabled={disabled || editingRuleset?.builtin}
                    {...form.register("name")}
                  />
                </FormControl>
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
                <FormControl mb="10px" pt="10px">
                  <FormLabel>{t("clash.preferredProxy")}</FormLabel>
                  <Controller
                    control={form.control}
                    name="preferred_proxy"
                    render={({ field }) => {
                      return (
                        <RadioGroup
                          {...field}
                          isDisabled={disabled || editingRuleset?.builtin}
                        >
                          <Stack direction='row' spacing="6">
                            <Radio size="sm" value='DIRECT'>DIRECT</Radio>
                            <Radio size="sm" value='PROXY'>PROXY</Radio>
                            <Radio size="sm" value='REJECT'>REJECT</Radio>
                          </Stack>
                        </RadioGroup>
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
              >
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
