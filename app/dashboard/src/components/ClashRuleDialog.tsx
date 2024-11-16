import {
  Alert,
  AlertIcon,
  Button,
  FormControl,
  FormErrorMessage,
  FormHelperText,
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
  useToast,
} from "@chakra-ui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Rule, useClash } from "contexts/ClashContext";
import { FC, useEffect, useState } from "react";
import { Controller, FormProvider, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { tryParseJSON } from "utils/json";
import { z } from "zod";
import { AddIcon, EditIcon, SettingIcon } from "./ClashModal";
import { DeleteIcon } from "./DeleteUserModal";
import { Icon } from "./Icon";

export type ClashRuleDialogProps = {};

type RuleType = {
  name: string;
  message?: string;
  example?: string;
  noResolve?: boolean;
};

const ruleTypes: RuleType[] = [
  { name: "DOMAIN", example: "www.google.com" },
  { name: "DOMAIN-SUFFIX", example: "google.com" },
  { name: "DOMAIN-KEYWORD", example: "google" },
  { name: "GEOIP", noResolve: true, example: "cn" },
  { name: "GEOSITE", message: "clash.rule.supportGEOSITE", example: "google" },
  { name: "IP-CIDR", noResolve: true, example: "127.0.0.0/8" },
  { name: "IP-CIDR6", noResolve: true, example: "2620:0:2d0:200::7/32" },
  { name: "RULE-SET", example: "providername" },
  { name: "SRC-IP-CIDR", example: "192.168.1.201/32" },
  { name: "SRC-PORT", example: "80" },
  { name: "DST-PORT", example: "8080" },
  { name: "PROCESS-NAME", example: "onedrive" },
  { name: "PROCESS-PATH", example: "/usr/bin/curl" },
  { name: "NETWORK", message: "clash.rule.supportNETWORK", example: "tcp udp" },
  {
    name: "SCRIPT",
    message: "clash.rule.supportSCRIPT",
    example: "script shortcut",
  },
  {
    name: "AND",
    message: "clash.rule.supportLOGIC",
    example: "((DOMAIN,google.com),(NETWORK,UDP))",
  },
  {
    name: "OR",
    message: "clash.rule.supportLOGIC",
    example: "((NETWORK,UDP),(DOMAIN,google.com))",
  },
  {
    name: "NOT",
    message: "clash.rule.supportLOGIC",
    example: "((DOMAIN,google.com))",
  },
];

export type FormType = Omit<Rule, "priority"> & {
  no_resolve: boolean;
  priority: boolean;
};

const schema = z.object({
  content: z.string().min(1, { message: "fieldRequired" }),
  type: z.string().min(1, { message: "fieldRequired" }),
  ruleset: z.string().min(1, { message: "fieldRequired" }),
  policy: z.string(),
  priority: z.boolean(),
  no_resolve: z.boolean(),
});

const getDefaultValues = (ruleset: string | null | undefined): FormType => {
  return {
    id: 0,
    type: "DOMAIN-SUFFIX",
    content: "",
    option: "",
    policy: "",
    priority: false,
    no_resolve: false,
    ruleset: ruleset ? ruleset : "DIRECT",
  };
};

const formatRule = (rule: Rule): FormType => {
  return {
    ...rule,
    no_resolve: rule.option?.includes("no-resolve") || false,
    priority: rule.priority == 1,
  };
};

const findRuleType = (type: string) => {
  return ruleTypes.filter((entry) => entry.name === type)[0] || ruleTypes[0];
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
  const title = isEditing ? "clash.rule.edited" : "clash.rule.created";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>("");
  const [ruleType, setRuleType] = useState(findRuleType("DOMAIN-SUFFIX"));
  const toast = useToast();
  const { t } = useTranslation();
  const form = useForm<FormType>({
    defaultValues: getDefaultValues(null),
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (editingRule) {
      form.reset(formatRule(editingRule));
      setRuleType(findRuleType(editingRule.type));
    }
  }, [editingRule]);

  useEffect(() => {
    if (isCreatingRule) {
      setRuleType(findRuleType("DOMAIN-SUFFIX"));
      form.reset(getDefaultValues(ruleFilter.ruleset));
    }
  }, [isCreatingRule, ruleFilter]);

  const submit = (values: FormType) => {
    setLoading(true);
    setError(null);

    const { no_resolve, priority, ...rest } = values;
    let body: Rule = {
      ...rest,
      id: editingRule?.id,
      priority: priority ? 1 : 0,
      option:
        no_resolve && findRuleType(values.type).noResolve ? "no-resolve" : "",
    };

    (isEditing ? editRule : createRule)(body)
      .then(() => {
        toast({
          title: t(title, { name: values.content }),
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
            form.setError(key as "content" | "type", {
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
    form.reset(getDefaultValues(ruleFilter.ruleset));
    onCreateRule(false);
    onEditingRule(null);
    setError(null);
    setRuleType(findRuleType("DOMAIN-SUFFIX"));
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
              title: t("clash.rule.deleteSuccess", {
                name: editingRule?.content,
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
              title: t("clash.rule.deleteFail"),
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

  const editRuleset = () => {
    const name = form.getValues().ruleset;
    const ruleset = rulesets.filter((v) => v.name == name)[0];
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
                  {isEditing ? t("clash.rule.edit") : t("clash.rule.add")}
                </Text>
              </HStack>
            </ModalHeader>
            <ModalCloseButton mt={3} disabled={disabled} />
            <ModalBody>
              <VStack justifyContent="space-between">
                <FormControl height="66px">
                  <FormLabel>{t("clash.ruleset")}</FormLabel>
                  <HStack>
                    <Select
                      disabled={disabled}
                      size="sm"
                      {...form.register("ruleset")}
                    >
                      {rulesets.map((ruleset) => {
                        return (
                          <option key={ruleset.id} value={ruleset.name}>
                            {ruleset.name} ({ruleset.policy})
                          </option>
                        );
                      })}
                    </Select>
                    <IconButton
                      aria-label="Edit"
                      size="sm"
                      onClick={editRuleset}
                    >
                      <SettingIcon />
                    </IconButton>
                  </HStack>
                </FormControl>
                <FormControl height="66px" mb={!!ruleType.message ? 4 : 0}>
                  <FormLabel>{t("clash.type")}</FormLabel>
                  <Select
                    disabled={disabled}
                    size="sm"
                    {...form.register("type", {
                      onChange: (e) =>
                        setRuleType(findRuleType(e.target.value)),
                    })}
                  >
                    {ruleTypes.map((entry) => {
                      return (
                        <option key={entry.name} value={entry.name}>
                          {entry.name}
                        </option>
                      );
                    })}
                  </Select>
                  {ruleType.message && (
                    <FormHelperText fontSize="xs" mt={1}>
                      {t(ruleType.message)}
                    </FormHelperText>
                  )}
                </FormControl>
                <FormControl isInvalid={!!form.formState.errors.content}>
                  <FormLabel>{t("clash.content")}</FormLabel>
                  <Input
                    size="sm"
                    type="text"
                    borderRadius="6px"
                    placeholder={ruleType.example}
                    disabled={disabled}
                    {...form.register("content")}
                  />
                  <FormErrorMessage>
                    {terror(form.formState.errors.content?.message)}
                  </FormErrorMessage>
                </FormControl>
                <FormControl mb="0px" pt="10px">
                  <FormLabel>{t("clash.policy")}</FormLabel>
                  <Controller
                    control={form.control}
                    name="policy"
                    render={({ field }) => (
                      <RadioGroup isDisabled={disabled} {...field}>
                        <Stack direction="row" spacing="6">
                          {["", "DIRECT", "PROXY", "REJECT"].map((v) => (
                            <Radio
                              key={v || "RULESET"}
                              value={v}
                              size="md"
                              colorScheme="primary"
                            >
                              <Text fontSize="sm">{v || "RULESET"}</Text>
                            </Radio>
                          ))}
                        </Stack>
                      </RadioGroup>
                    )}
                  />
                </FormControl>
                <HStack w="full" pt="2">
                  {ruleType.noResolve && (
                    <FormControl display="flex" alignItems="center">
                      <FormLabel mb="0">{t("clash.rule.noResolve")}</FormLabel>
                      <Switch
                        colorScheme="primary"
                        {...form.register("no_resolve")}
                      />
                    </FormControl>
                  )}
                  <FormControl display="flex" alignItems="center">
                    <FormLabel mb="0">{t("clash.rule.priority")}</FormLabel>
                    <Switch
                      disabled={disabled}
                      colorScheme="primary"
                      {...form.register("priority")}
                    />
                  </FormControl>
                </HStack>
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
