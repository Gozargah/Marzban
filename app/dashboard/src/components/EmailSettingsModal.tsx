import {
  Button,
  chakra,
  Divider,
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
  SimpleGrid,
  Text,
  Textarea,
  VStack,
  useToast,
} from "@chakra-ui/react";
import { BoltIcon, DocumentTextIcon, EnvelopeIcon } from "@heroicons/react/24/outline";
import { useDashboard } from "contexts/DashboardContext";
import { FC, useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { fetch } from "service/http";
import { Icon } from "./Icon";
import { Input } from "./Input";

const SettingsIcon = chakra(EnvelopeIcon, {
  baseStyle: {
    w: 5,
    h: 5,
  },
});
const ResendIcon = chakra(BoltIcon, { baseStyle: { w: 4, h: 4 } });
const SmtpIcon = chakra(EnvelopeIcon, { baseStyle: { w: 4, h: 4 } });
const RulesIcon = chakra(DocumentTextIcon, { baseStyle: { w: 4, h: 4 } });

type EmailFormType = {
  resend_api_key: string;
  resend_from_email: string;
  smtp_host: string;
  smtp_port: string;
  smtp_username: string;
  smtp_password: string;
  smtp_from_email: string;
  email_from_name: string;
  email_rules_text: string;
};

const emptyValues: EmailFormType = {
  resend_api_key: "",
  resend_from_email: "",
  email_from_name: "",
  smtp_host: "",
  smtp_port: "",
  smtp_username: "",
  smtp_password: "",
  smtp_from_email: "",
  email_rules_text: "",
};

export const EmailSettingsModal: FC = () => {
  const { isEditingEmailSettings, onEditingEmailSettings } = useDashboard();
  const { t } = useTranslation();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [passwordSet, setPasswordSet] = useState(false);
  const [apiKeySet, setApiKeySet] = useState(false);

  const form = useForm<EmailFormType>({ defaultValues: emptyValues });

  useEffect(() => {
    if (!isEditingEmailSettings) return;
    setLoading(true);
    fetch("/settings/email")
      .then((data: any) => {
        form.reset({
          resend_api_key: "",
          resend_from_email: data.resend_from_email || "",
          email_from_name: data.email_from_name || "",
          smtp_host: data.smtp_host || "",
          smtp_port: data.smtp_port ? String(data.smtp_port) : "",
          smtp_username: data.smtp_username || "",
          smtp_password: "",
          smtp_from_email: data.smtp_from_email || "",
          email_rules_text: data.email_rules_text || "",
        });
        setPasswordSet(!!data.smtp_password_set);
        setApiKeySet(!!data.resend_api_key_set);
      })
      .finally(() => setLoading(false));
  }, [isEditingEmailSettings]);

  const onClose = () => onEditingEmailSettings(false);

  const submit = (values: EmailFormType) => {
    setSaving(true);
    fetch("/settings/email", {
      method: "PUT",
      body: {
        ...values,
        smtp_port: values.smtp_port ? parseInt(values.smtp_port, 10) : null,
      },
    })
      .then(() => {
        toast({
          title: t("emailSettings.saved"),
          status: "success",
          isClosable: true,
          position: "top",
          duration: 3000,
        });
        onClose();
      })
      .catch(() => {
        toast({
          title: t("emailSettings.saveFailed"),
          status: "error",
          isClosable: true,
          position: "top",
          duration: 3000,
        });
      })
      .finally(() => setSaving(false));
  };

  return (
    <Modal isOpen={isEditingEmailSettings} onClose={onClose} size="lg">
      <ModalOverlay bg="blackAlpha.300" backdropFilter="blur(10px)" />
      <ModalContent mx="3" w="full">
        <ModalHeader pt={6}>
          <HStack gap={2}>
            <Icon color="primary">
              <SettingsIcon color="white" />
            </Icon>
            <Text fontWeight="semibold" fontSize="lg">
              {t("emailSettings.title")}
            </Text>
          </HStack>
        </ModalHeader>
        <ModalCloseButton mt={3} />
        <form onSubmit={form.handleSubmit(submit)}>
          <ModalBody>
            <Text fontSize="sm" color="gray.500" mb="4">
              {t("emailSettings.description")}
            </Text>
            <VStack spacing="4" align="stretch">
              <VStack spacing="3" align="stretch">
                <HStack spacing={1.5} color="gray.500" _dark={{ color: "gray.400" }}>
                  <ResendIcon />
                  <Text fontSize="xs" fontWeight="bold" textTransform="uppercase">
                    {t("emailSettings.sectionResend")}
                  </Text>
                </HStack>
                <Text fontSize="xs" color="gray.500">
                  {t("emailSettings.resendHint")}
                </Text>
                <FormControl>
                  <FormLabel fontSize="sm">
                    {apiKeySet
                      ? t("emailSettings.resendApiKeySet")
                      : t("emailSettings.resendApiKey")}
                  </FormLabel>
                  <Controller
                    control={form.control}
                    name="resend_api_key"
                    render={({ field }) => (
                      <Input {...field} type="password" size="sm" disabled={loading} placeholder="re_..." />
                    )}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">{t("emailSettings.resendFromEmail")}</FormLabel>
                  <Controller
                    control={form.control}
                    name="resend_from_email"
                    render={({ field }) => (
                      <Input
                        {...field}
                        size="sm"
                        placeholder="onboarding@resend.dev"
                        disabled={loading}
                      />
                    )}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">{t("emailSettings.fromName")}</FormLabel>
                  <Controller
                    control={form.control}
                    name="email_from_name"
                    render={({ field }) => (
                      <Input
                        {...field}
                        size="sm"
                        placeholder="Support Golden Cloud"
                        disabled={loading}
                      />
                    )}
                  />
                  <Text fontSize="xs" color="gray.500" mt={1}>
                    {t("emailSettings.fromNameHint")}
                  </Text>
                </FormControl>
              </VStack>

              <Divider />

              <VStack spacing="3" align="stretch">
                <HStack spacing={1.5} color="gray.500" _dark={{ color: "gray.400" }}>
                  <SmtpIcon />
                  <Text fontSize="xs" fontWeight="bold" textTransform="uppercase">
                    {t("emailSettings.sectionSmtp")}
                  </Text>
                </HStack>
                <Text fontSize="xs" color="gray.500">
                  {t("emailSettings.smtpFallbackHint")}
                </Text>
                <FormControl>
                  <FormLabel fontSize="sm">{t("emailSettings.smtpHost")}</FormLabel>
                  <Controller
                    control={form.control}
                    name="smtp_host"
                    render={({ field }) => (
                      <Input
                        {...field}
                        size="sm"
                        placeholder="smtp.gmail.com"
                        disabled={loading}
                      />
                    )}
                  />
                </FormControl>
                <SimpleGrid columns={{ base: 1, sm: 2 }} spacing="3">
                  <FormControl>
                    <FormLabel fontSize="sm">{t("emailSettings.smtpPort")}</FormLabel>
                    <Controller
                      control={form.control}
                      name="smtp_port"
                      render={({ field }) => (
                        <Input
                          {...field}
                          size="sm"
                          type="number"
                          placeholder="587"
                          disabled={loading}
                        />
                      )}
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel fontSize="sm">{t("emailSettings.fromEmail")}</FormLabel>
                    <Controller
                      control={form.control}
                      name="smtp_from_email"
                      render={({ field }) => (
                        <Input
                          {...field}
                          size="sm"
                          placeholder="you@gmail.com"
                          disabled={loading}
                        />
                      )}
                    />
                  </FormControl>
                </SimpleGrid>
                <FormControl>
                  <FormLabel fontSize="sm">{t("emailSettings.smtpUsername")}</FormLabel>
                  <Controller
                    control={form.control}
                    name="smtp_username"
                    render={({ field }) => (
                      <Input {...field} size="sm" disabled={loading} />
                    )}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">
                    {passwordSet
                      ? t("emailSettings.smtpPasswordSet")
                      : t("emailSettings.smtpPassword")}
                  </FormLabel>
                  <Controller
                    control={form.control}
                    name="smtp_password"
                    render={({ field }) => (
                      <Input {...field} type="password" size="sm" disabled={loading} />
                    )}
                  />
                </FormControl>
                <Text fontSize="xs" color="gray.500">
                  {t("emailSettings.gmailHint")}
                </Text>
              </VStack>

              <Divider />

              <VStack spacing="3" align="stretch">
                <HStack spacing={1.5} color="gray.500" _dark={{ color: "gray.400" }}>
                  <RulesIcon />
                  <Text fontSize="xs" fontWeight="bold" textTransform="uppercase">
                    {t("emailSettings.sectionRules")}
                  </Text>
                </HStack>
                <Text fontSize="xs" color="gray.500">
                  {t("emailSettings.rulesHint")}
                </Text>
                <FormControl>
                  <Controller
                    control={form.control}
                    name="email_rules_text"
                    render={({ field }) => (
                      <Textarea {...field} size="sm" rows={4} disabled={loading} />
                    )}
                  />
                </FormControl>
              </VStack>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <HStack w="full" justifyContent="flex-end">
              <Button
                size="sm"
                variant="solid"
                colorScheme="primary"
                px="5"
                type="submit"
                isDisabled={loading || saving}
                isLoading={saving}
              >
                {t("emailSettings.save")}
              </Button>
            </HStack>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
};
