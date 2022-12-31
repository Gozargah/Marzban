import {
  Box,
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
} from "@chakra-ui/react";
import { FC, useState } from "react";
import { TrashIcon } from "@heroicons/react/24/outline";
import { Icon } from "./Icon";
import { useDashboard } from "contexts/DashboardContext";

export const DeleteIcon = chakra(TrashIcon, {
  baseStyle: {
    w: 5,
    h: 5,
  },
});

export type DeleteUserModalProps = {};

export const DeleteUserModal: FC<DeleteUserModalProps> = () => {
  const [loading, setLoading] = useState(false);
  const { deletingUser: user, onDeletingUser, deleteUser } = useDashboard();

  const onClose = () => {
    onDeletingUser(null);
  };
  const onDelete = () => {
    if (user) {
      setLoading(true);
      deleteUser(user).then(onClose).finally(setLoading.bind(null, false));
    }
  };
  return (
    <Modal isCentered isOpen={!!user} onClose={onClose} size="sm">
      <ModalOverlay bg="blackAlpha.300" backdropFilter="blur(10px)" />
      <ModalContent mx="3">
        <ModalHeader pt={6}>
          <Icon color="red">
            <DeleteIcon />
          </Icon>
        </ModalHeader>
        <ModalCloseButton mt={3} />
        <ModalBody>
          <Text fontWeight="semibold" fontSize="lg">
            Delete user
          </Text>
          {user && (
            <Text
              mt={1}
              fontSize="sm"
              _dark={{ color: "gray.400" }}
              color="gray.600"
            >
              Are you sure you want to delete <b>{user.username}</b>?
            </Text>
          )}
        </ModalBody>
        <ModalFooter display="flex">
          <Button size="sm" onClick={onClose} mr={3} w="full" variant="outline">
            Cancel
          </Button>
          <Button
            size="sm"
            w="full"
            colorScheme="red"
            onClick={onDelete}
            leftIcon={loading ? <Spinner size="xs" /> : undefined}
          >
            Delete
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
