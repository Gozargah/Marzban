import {
  Button,
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
import { Trans, useTranslation } from "react-i18next";
import { getGetNodesQueryKey, useRemoveNode } from "service/api";
import { generateErrorMessage, generateSuccessMessage } from "utils/toastHandler";
import { DeleteIcon } from "../DeleteUserModal";
import { Icon } from "../Icon";
import { queryClient } from "utils/react-query";
import { NodeType } from "contexts/NodesContext";

interface Props {
  node: NodeType;
  isOpen: boolean;
  onClose: VoidFunction;
}

export function DeleteNodeModal({ isOpen, onClose, node }: Props) {
  const toast = useToast();
  const { t } = useTranslation();
  const removeNode = useRemoveNode();

  const onDeleteNode = async () => {
    try {
      await removeNode.mutateAsync({ nodeId: node.id! });
      generateSuccessMessage(t("deleteNode.deleteSuccess", { name: node.name }), toast);
      queryClient.invalidateQueries(getGetNodesQueryKey());
    } catch (e) {
      generateErrorMessage(e, toast);
    }
  };

  return (
    <Modal isCentered isOpen={isOpen} onClose={onClose} size="sm">
      <ModalOverlay bg="blackAlpha.300" backdropFilter="blur(10px)" />
      <ModalContent mx="3">
        <ModalHeader pt={6} display="flex" gap="4" alignItems="center">
          <Icon color="red">
            <DeleteIcon />
          </Icon>
          <Text>{t("deleteNode.title")}</Text>
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Text mt={1} fontSize="sm" _dark={{ color: "gray.400" }} color="gray.600">
            <Trans components={{ b: <b /> }}>{t("deleteNode.prompt", { name: node.name })}</Trans>
          </Text>
        </ModalBody>
        <ModalFooter display="flex">
          <Button size="sm" onClick={onClose} mr={3} w="full" variant="outline">
            {t("cancel")}
          </Button>
          <Button
            size="sm"
            w="full"
            colorScheme="red"
            onClick={onDeleteNode}
            leftIcon={removeNode.isLoading ? <Spinner size="xs" /> : undefined}
          >
            {t("delete")}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
