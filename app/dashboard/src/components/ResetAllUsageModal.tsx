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
import { DocumentMinusIcon } from "@heroicons/react/24/outline";
import { useDashboard } from "contexts/DashboardContext";
import { FC } from "react";
import { useTranslation } from "react-i18next";
import { getGetUsersQueryKey, useResetUsersDataUsage } from "service/api";
import { queryClient } from "utils/react-query";
import { Icon } from "./Icon";

export const ResetIcon = chakra(DocumentMinusIcon, {
  baseStyle: {
    w: 5,
    h: 5,
  },
});

export type DeleteUserModalProps = {};

export const ResetAllUsageModal: FC<DeleteUserModalProps> = () => {
  const { isResetingAllUsage, onResetAllUsage } = useDashboard();
  const { t } = useTranslation();
  const toast = useToast();
  const { mutate: resetUsersUsage, isLoading } = useResetUsersDataUsage({
    mutation: {
      onSuccess() {
        toast({
          title: t("resetAllUsage.success"),
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
          title: t("resetAllUsage.error"),
          status: "error",
          isClosable: true,
          position: "top",
          duration: 3000,
        });
      },
    },
  });
  const onClose = () => {
    onResetAllUsage(false);
  };

  return (
    <Modal isCentered isOpen={isResetingAllUsage} onClose={onClose} size="sm">
      <ModalOverlay bg="blackAlpha.300" backdropFilter="blur(10px)" />
      <ModalContent mx="3">
        <ModalHeader pt={6}>
          <Icon color="red">
            <ResetIcon />
          </Icon>
        </ModalHeader>
        <ModalCloseButton mt={3} />
        <ModalBody>
          <Text fontWeight="semibold" fontSize="lg">
            {t("resetAllUsage.title")}
          </Text>
          {isResetingAllUsage && (
            <Text
              mt={1}
              fontSize="sm"
              _dark={{ color: "gray.400" }}
              color="gray.600"
            >
              {t("resetAllUsage.prompt")}
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
            colorScheme="red"
            onClick={() => resetUsersUsage()}
            leftIcon={isLoading ? <Spinner size="xs" /> : undefined}
          >
            {t("reset")}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
