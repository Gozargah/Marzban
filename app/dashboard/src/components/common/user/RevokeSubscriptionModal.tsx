import {
  Button,
  chakra,
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
} from "@chakra-ui/react";
import { ArrowPathIcon } from "@heroicons/react/24/outline";
import { useDashboard } from "contexts/DashboardContext";
import { FC } from "react";
import { Trans, useTranslation } from "react-i18next";
import { getGetUsersQueryKey, useRevokeUserSubscription } from "core/services/api";
import { queryClient } from "core/utils/react-query";
import { Icon } from "components/tools/Icon";

export const ResetIcon = chakra(ArrowPathIcon, {
  baseStyle: {
    w: 5,
    h: 5,
  },
});

export type RevokeSubscriptionModalProps = {};

export const RevokeSubscriptionModal: FC<RevokeSubscriptionModalProps> = () => {
  const { revokeSubscriptionUser: user } = useDashboard();
  const { t } = useTranslation();
  const toast = useToast();
  const onClose = () => {
    useDashboard.setState({ revokeSubscriptionUser: null });
  };
  const { mutate, isLoading } = useRevokeUserSubscription({
    mutation: {
      onSuccess(user) {
        toast({
          title: t("revokeUserSub.success", { username: user.username }),
          status: "success",
          isClosable: true,
          position: "top",
          duration: 3000,
        });
        queryClient.invalidateQueries(getGetUsersQueryKey());
        onClose();
      },
      onError() {
        toast({
          title: t("revokeUserSub.error"),
          status: "error",
          isClosable: true,
          position: "top",
          duration: 3000,
        });
      },
    },
  });
  const onReset = () => {
    if (user) {
      mutate({
        username: user.username,
      });
    }
  };
  return (
    <Modal isCentered isOpen={!!user} onClose={onClose} size="sm">
      <ModalOverlay bg="blackAlpha.300" backdropFilter="blur(10px)" />
      <ModalContent mx="3">
        <ModalHeader pt={6}>
          <Icon color="blue">
            <ResetIcon />
          </Icon>
        </ModalHeader>
        <ModalCloseButton mt={3} />
        <ModalBody>
          <Text fontWeight="semibold" fontSize="lg">
            {t("revokeUserSub.title")}
          </Text>
          {user && (
            <Text mt={1} fontSize="sm" _dark={{ color: "gray.400" }} color="gray.600">
              <Trans components={{ b: <b /> }}>{t("revokeUserSub.prompt", { username: user.username })}</Trans>
            </Text>
          )}
        </ModalBody>
        <ModalFooter display="flex">
          <Button size="sm" onClick={onClose} mr={3} w="full" variant="outline">
            {t("cancel")}
          </Button>
          <Button
            size="sm"
            w="full"
            colorScheme="blue"
            onClick={onReset}
            leftIcon={isLoading ? <Spinner size="xs" /> : undefined}
          >
            {t("revoke")}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
