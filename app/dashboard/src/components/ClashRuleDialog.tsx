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
  Switch,
  Input,
  FormErrorMessage,
} from "@chakra-ui/react";
import { FC, useEffect, useState } from "react";
import { Controller, FormProvider, useForm } from "react-hook-form";
import { Icon } from "./Icon";
import { useTranslation } from "react-i18next";
import { Rule, useClash } from "contexts/ClashContext";
import { DeleteIcon } from "./DeleteUserModal";
import { SettingsIcon } from "@chakra-ui/icons";
import { AddIcon, EditIcon } from "./ClashModal";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

export type ClashRuleDialogProps = {};

const getDefaultValues = (ruleset: string | null | undefined): Rule => {
  return {
    id: 0,
    type: "DOMAIN",
    content: "",
    option: "",
    ruleset: ruleset ? ruleset : "DIRECT",
  };
};

const types = ["DOMAIN", "DOMAIN-SUFFIX", "DOMAIN-KEYWORD", "GEOIP",
  "IP-CIDR", "IP-CIDR6", "SRC-IP-CIDR", "SRC-PORT", "DST-PORT",
  "PROCESS-NAME", "PROCESS-PATH", "SCRIPT"
];

const hasNoResolveOption = (type: string) => {
  return type === "GEOIP" || type === "IP-CIDR"
    || type === "IP-CIDR6" || type === "SCRIPT";
}

export type FormType = Pick<Rule, keyof Rule> & { no_resolve: boolean };

const schema = z.object({
  content: z.string().min(1, { message: "fieldRequired" }),
  type: z.string().min(1, { message: "fieldRequired" }),
  ruleset: z.string().min(1, { message: "fieldRequired" }),
  no_resolve: z.any(),
});

const formatRule = (rule: Rule): FormType => {
  return {
    ...rule,
    no_resolve: rule.option?.includes("no-resolve") || false,
  };
};

export const ClashRuleDialog: FC<ClashRuleDialogProps> = () => {
  const {
    ruleFilter,
    editingRule,
    isCreatingRule,
    onEditingRule,
    onCreateRule,
    onEditingRuleset,
    deleteRule,
    editRule,
    createRule,
    rulesets,
    onAlert,
  } = useClash();
  const isEditing = !!editingRule;
  const isOpen = isCreatingRule || isEditing;
  const message = isEditing ? "clash.rule.edited" : "clash.rule.created";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>("");
  const [hasNoResolve, setHasNoResolve] = useState(false);
  const toast = useToast();
  const { t } = useTranslation();
  const form = useForm<FormType>({
    defaultValues: getDefaultValues(null),
    resolver: zodResolver(schema)
  });

  useEffect(() => {
    if (editingRule) {
      form.reset(formatRule(editingRule));
      setHasNoResolve(hasNoResolveOption(editingRule.type));
    }
  }, [editingRule]);

  useEffect(() => {
    if (isCreatingRule) {
      setHasNoResolve(hasNoResolveOption(types[0]));
      form.reset(getDefaultValues(ruleFilter.ruleset));
    }
  }, [isCreatingRule, ruleFilter]);

  const submit = (values: FormType) => {
    setLoading(true);
    setError(null);

    const {no_resolve, ...rest} = values;
    let body: Rule = {
      ...rest,
      id: editingRule?.id,
      option: no_resolve && hasNoResolve ? "no-resolve" : "",
    };

    (isEditing ? editRule : createRule)(body)
      .then(() => {
        toast({
          title: t(message, {name: values.content}),
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
            let tfield = message;
            try {
              const errobj = JSON.parse(message.replace(/"/g, '\\"').replace(/'/g, '"'));
              tfield = `error.${errobj.err}`;
              message = t(tfield);
            } catch (e) {}
            setError(message);
            form.setError(
              key as "content" | "type",
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
    form.reset(getDefaultValues(ruleFilter.ruleset));
    onCreateRule(false);
    onEditingRule(null);
    setError(null);
    setHasNoResolve(false);
  };

  const onDeletingRule = () => {
    onAlert({
      title: t("clash.rule.delete"),
      content: t("clash.rule.deletePrompt", { name: editingRule?.content }),
      type: "error",
      yes: t("delete"),
      onConfirm: () => {
        deleteRule(editingRule!)
          .then(() => {
            toast({
              title: t("clash.rule.deleteSuccess", { name: editingRule?.content }),
              status: "success",
              isClosable: true,
              position: "top",
              duration: 3000,
            });
            onClose();
          })
          .catch((err) => {
            toast({
              title: t("clash.rule.deleteFail"),
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

  const editRuleset = () => {
    const name = form.getValues().ruleset;
    const ruleset = rulesets.data.filter((v) => v.name == name)[0];
    if (ruleset) {
      onClose();
      onEditingRuleset(ruleset);
    }
  };

  const terror = (error: string | undefined) => {
    return error ? t(error) : error;
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
                  {isEditing ? t("clash.rule.edit") : t("clash.rule.add")}
                </Text>
              </HStack>
            </ModalHeader>
            <ModalCloseButton mt={3} disabled={disabled} />
            <ModalBody>
              <VStack justifyContent="space-between">
                <FormControl height="66px">
                  <FormLabel>{t("clash.ruleset")}</FormLabel>
                  <Controller
                    control={form.control}
                    name="ruleset"
                    render={({ field }) => {
                      return (
                        <HStack>
                          <Select disabled={disabled} size="sm" {...field}>
                            {rulesets.data.map((ruleset) => {
                              return (
                                <option key={ruleset.id} value={ruleset.name}>
                                  {ruleset.name} ({ruleset.preferred_proxy})
                                </option>
                              );
                            })}
                          </Select>
                          <IconButton
                            aria-label="Edit"
                            size="sm"
                            onClick={editRuleset}
                          >
                            <SettingsIcon />
                          </IconButton>
                        </HStack>
                        
                      );
                    }}
                  />
                </FormControl>
                <FormControl height="66px">
                  <FormLabel>{t("clash.type")}</FormLabel>
                  <Controller
                    control={form.control}
                    name="type"
                    render={({ field: {onChange, ...rest} }) => {
                      return (
                        <Select 
                          disabled={disabled} 
                          size="sm" {...rest}
                          onChange={(e) => {
                            setHasNoResolve(hasNoResolveOption(e.target.value));
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
                <FormControl isInvalid={!!form.formState.errors.content}>
                  <FormLabel>{t("clash.content")}</FormLabel>
                  <Input
                    size="sm"
                    type="text"
                    borderRadius="6px"
                    disabled={disabled}
                    {...form.register("content")}
                  />
                  <FormErrorMessage>
                    {terror(form.formState.errors.content?.message)}
                  </FormErrorMessage>
                </FormControl>
                {hasNoResolve && (
                  <FormControl pt="2" display='flex' alignItems='center'>
                    <FormLabel mb='0'>no-resolve</FormLabel>
                    <Switch {...form.register("no_resolve")} />
                  </FormControl>
                )}
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
                      onClick={onDeletingRule}
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
