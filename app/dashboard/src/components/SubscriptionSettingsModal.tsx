import {
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
  Text,
  Textarea,
  VStack,
  useToast,
} from "@chakra-ui/react";
import { Cog6ToothIcon } from "@heroicons/react/24/outline";
import { useDashboard } from "contexts/DashboardContext";
import { FC, useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { fetch } from "service/http";
import { Icon } from "./Icon";
import { Input } from "./Input";

const SettingsIcon = chakra(Cog6ToothIcon, {
  baseStyle: {
    w: 5,
    h: 5,
  },
});

type SubscriptionSettingsType = {
  sub_profile_title: string | null;
  sub_support_url: string | null;
  sub_update_interval: string | null;
  active_status_text: string | null;
  expired_status_text: string | null;
  limited_status_text: string | null;
  disabled_status_text: string | null;
  onhold_status_text: string | null;
  device_limit_exceeded_message: string | null;
};

const emptyValues: SubscriptionSettingsType = {
  sub_profile_title: "",
  sub_support_url: "",
  sub_update_interval: "",
  active_status_text: "",
  expired_status_text: "",
  limited_status_text: "",
  disabled_status_text: "",
  onhold_status_text: "",
  device_limit_exceeded_message: "",
};

const fields: {
  name: keyof SubscriptionSettingsType;
  labelKey: string;
  multiline?: boolean;
}[] = [
  { name: "sub_profile_title", labelKey: "subscriptionSettings.profileTitle" },
  { name: "sub_support_url", labelKey: "subscriptionSettings.supportUrl" },
  { name: "sub_update_interval", labelKey: "subscriptionSettings.updateInterval" },
  { name: "active_status_text", labelKey: "subscriptionSettings.activeText" },
  { name: "expired_status_text", labelKey: "subscriptionSettings.expiredText" },
  { name: "limited_status_text", labelKey: "subscriptionSettings.limitedText" },
  { name: "disabled_status_text", labelKey: "subscriptionSettings.disabledText" },
  { name: "onhold_status_text", labelKey: "subscriptionSettings.onholdText" },
  {
    name: "device_limit_exceeded_message",
    labelKey: "subscriptionSettings.deviceLimitMessage",
    multiline: true,
  },
];

export const SubscriptionSettingsModal: FC = () => {
  const { isEditingSubscriptionSettings, onEditingSubscriptionSettings } =
    useDashboard();
  const { t } = useTranslation();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const form = useForm<SubscriptionSettingsType>({
    defaultValues: emptyValues,
  });

  useEffect(() => {
    if (!isEditingSubscriptionSettings) return;
    setLoading(true);
    fetch("/settings/subscription")
      .then((data: SubscriptionSettingsType) => {
        form.reset({ ...emptyValues, ...data });
      })
      .finally(() => setLoading(false));
  }, [isEditingSubscriptionSettings]);

  const onClose = () => onEditingSubscriptionSettings(false);

  const submit = (values: SubscriptionSettingsType) => {
    setSaving(true);
    fetch("/settings/subscription", { method: "PUT", body: values })
      .then(() => {
        toast({
          title: t("subscriptionSettings.saved"),
          status: "success",
          isClosable: true,
          position: "top",
          duration: 3000,
        });
        onClose();
      })
      .catch(() => {
        toast({
          title: t("subscriptionSettings.saveFailed"),
          status: "error",
          isClosable: true,
          position: "top",
          duration: 3000,
        });
      })
      .finally(() => setSaving(false));
  };

  return (
    <Modal isOpen={isEditingSubscriptionSettings} onClose={onClose} size="lg">
      <ModalOverlay bg="blackAlpha.300" backdropFilter="blur(10px)" />
      <ModalContent mx="3" w="full">
        <ModalHeader pt={6}>
          <HStack gap={2}>
            <Icon color="primary">
              <SettingsIcon color="white" />
            </Icon>
            <Text fontWeight="semibold" fontSize="lg">
              {t("subscriptionSettings.title")}
            </Text>
          </HStack>
        </ModalHeader>
        <ModalCloseButton mt={3} />
        <form onSubmit={form.handleSubmit(submit)}>
          <ModalBody>
            <Text fontSize="sm" color="gray.500" mb="4">
              {t("subscriptionSettings.description")}
            </Text>
            <VStack spacing="3" align="stretch">
              {fields.map(({ name, labelKey, multiline }) => (
                <FormControl key={name}>
                  <FormLabel fontSize="sm">{t(labelKey)}</FormLabel>
                  <Controller
                    control={form.control}
                    name={name}
                    render={({ field }) =>
                      multiline ? (
                        <Textarea
                          {...field}
                          value={field.value || ""}
                          size="sm"
                          borderRadius="6px"
                          isDisabled={loading}
                        />
                      ) : (
                        <Input
                          {...field}
                          value={field.value || ""}
                          size="sm"
                          borderRadius="6px"
                          disabled={loading}
                        />
                      )
                    }
                  />
                </FormControl>
              ))}
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
                {t("subscriptionSettings.save")}
              </Button>
            </HStack>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
};
