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
  Toast,
  useToast,
} from "@chakra-ui/react";
import { FC, useEffect, useRef, useState } from "react";
import { ArrowPathIcon } from "@heroicons/react/24/outline";
import { Icon } from "./Icon";
import { useDashboard } from "contexts/DashboardContext";

export const ResetIcon = chakra(ArrowPathIcon, {
  baseStyle: {
    w: 5,
    h: 5,
  },
});

export type DeleteUserModalProps = {};

export const ResetUserUsageModal: FC<DeleteUserModalProps> = () => {
  const [loading, setLoading] = useState(false);
  const { resetUsageUser: user, resetDataUsage } = useDashboard();
  const toast = useToast();
  const onClose = () => {
    useDashboard.setState({ resetUsageUser: null });
  };
  const onReset = () => {
    if (user) {
      setLoading(true);
      resetDataUsage(user)
        .then(() => {
          toast({
            title: `${user.username}'s usage has reset successfully.`,
            status: "success",
            isClosable: true,
            position: "top",
            duration: 3000,
          });
        })
        .catch(() => {
          toast({
            title: `Usage reset failed, please try again.`,
            status: "error",
            isClosable: true,
            position: "top",
            duration: 3000,
          });
        })
        .finally(() => {
          setLoading(false);
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
            Reset User Usage
          </Text>
          {user && (
            <Text
              mt={1}
              fontSize="sm"
              _dark={{ color: "gray.400" }}
              color="gray.600"
            >
              Are you sure you want to reset <b>{user.username}</b>'s usage?
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
            colorScheme="blue"
            onClick={onReset}
            leftIcon={loading ? <Spinner size="xs" /> : undefined}
          >
            Reset
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
