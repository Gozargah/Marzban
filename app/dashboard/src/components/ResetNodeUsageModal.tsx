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
import { FC, useState } from "react";
import { DocumentMinusIcon } from "@heroicons/react/24/outline";
import { Icon } from "./Icon";
import { useDashboard } from "contexts/DashboardContext";
import { Trans, useTranslation } from "react-i18next";
import { useNodes } from "contexts/NodesContext";

export const ResetIcon = chakra(DocumentMinusIcon, {
  baseStyle: {
    w: 5,
    h: 5,
  },
});

export type DeleteUserModalProps = {};

export const ResetNodeUsageModal: FC<DeleteUserModalProps> = () => {
  const [loading, setLoading] = useState(false);
  const { isResetingNodeUsage, onResetNodeUsage } = useDashboard();
  const { resetNodeUsage, editingNode, setEditingNode } = useNodes();
  const { t } = useTranslation();
  const toast = useToast();
  const onClose = () => {
    onResetNodeUsage(false)
    setEditingNode(null);
  };
  const onReset = () => {
    setLoading(true);
    resetNodeUsage(editingNode!)
      .then(() => {
        onResetNodeUsage(false)
        toast({
          title: t("resetNodeUsage.success", {name: editingNode?.name}),
          status: "success",
          isClosable: true,
          position: "top",
          duration: 3000,
        });
      })
      .catch(() => {
        toast({
          title: t("resetNodeUsage.error", {name: editingNode?.name}),
          status: "error",
          isClosable: true,
          position: "top",
          duration: 3000,
        });
      })
      .finally(() => {
        setLoading(false);
      });
  };
  return (
    <Modal isCentered isOpen={isResetingNodeUsage} onClose={onClose} size="sm">
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
            {t("resetNodeUsage.title",)}
          </Text>
          {isResetingNodeUsage && (
            <Text
              mt={1}
              fontSize="sm"
              _dark={{ color: "gray.400" }}
              color="gray.600"
            >
                <Trans
                  components={{b: <b /> }}
                >
                  {t("resetNodeUsage.prompt", {name: editingNode?.name})}
                </Trans>
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
            onClick={onReset}
            leftIcon={loading ? <Spinner size="xs" /> : undefined}
          >
            {t("reset")}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
