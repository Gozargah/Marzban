import {
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
} from "@chakra-ui/react";
import { FC, PropsWithChildren } from "react";

export type DialogProps = PropsWithChildren<{
  open: boolean;
  title: string;
  widthFitContent?: boolean;
  onClose: () => void;
}>;
export const Dialog: FC<DialogProps> = ({ open, children, onClose, title }) => {
  return (
    <Modal isOpen={open} onClose={onClose}>
      <ModalOverlay />
      <ModalContent maxW="2xl" pb="2">
        <ModalHeader>{title}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>{children}</ModalBody>
      </ModalContent>
    </Modal>
  );
};
