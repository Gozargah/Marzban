import {
  Button,
  chakra,
  HStack,
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
import { TrashIcon, ExclamationCircleIcon } from "@heroicons/react/24/outline";
import { FC, useEffect, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { Icon } from "./Icon";
import { useClash } from "contexts/ClashContext";

const iconStyle = {
  baseStyle: {
    w: 5,
    h: 5,
  }
};

const colorScheme = {
  error: "red",
  success: "green",
  warning: "yellow",
  info: "blue",
};

const DeleteIcon = chakra(TrashIcon, iconStyle);
const WarningIcon = chakra(ExclamationCircleIcon, iconStyle)

export type AlertDialogProps = {};

export const AlertDialog: FC<AlertDialogProps> = () => {
  const [loading, setLoading] = useState(false);
  const { alert, onAlert } = useClash();
  const { t } = useTranslation();
  const onClose = () => {
    onAlert(null);
  };
  const onDelete = () => {
    setLoading(true);
    alert?.onConfirm();
  };
  useEffect(() => {
    setLoading(false);
  }, [alert]);

  return (
    <Modal isCentered isOpen={!!alert} onClose={onClose} size="sm">
      <ModalOverlay bg="blackAlpha.300" backdropFilter="blur(10px)" />
      <ModalContent mx="3">
        <ModalHeader pt={6}>
          <HStack spacing={4}>
            <Icon color={colorScheme[alert?.type || "error"]}>
              <WarningIcon w={10} />
            </Icon>
            <Text fontWeight="semibold" fontSize="lg">
              {alert?.title}
            </Text>
          </HStack>
        </ModalHeader>
        <ModalCloseButton mt={3} />
        <ModalBody>
          {alert && (
            <Text
              mt={1}
              fontSize="sm"
              _dark={{ color: "gray.400" }}
              color="gray.600"
            >
              <Trans components={{ b: <b /> }}>
                {alert.content}
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
            colorScheme={colorScheme[alert?.type || "error"]}
            onClick={onDelete}
            leftIcon={loading ? <Spinner size="xs" /> : undefined}
          >
            {alert?.yes}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
