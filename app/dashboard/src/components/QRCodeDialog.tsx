import { useDashboard } from "../contexts/DashboardContext";
import { FC } from "react";
import {
  chakra,
  HStack,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
} from "@chakra-ui/react";
import { Icon } from "./Icon";
import { QrCodeIcon } from "@heroicons/react/24/outline";
import { QRCodeCanvas } from "qrcode.react";

const QRCode = chakra(QRCodeCanvas);

const QRIcon = chakra(QrCodeIcon, {
  baseStyle: {
    w: 5,
    h: 5,
  },
});

export const QRCodeDialog: FC = () => {
  const { qrcodeLinks, setQRCode } = useDashboard();
  const isOpen = qrcodeLinks !== null;
  const onClose = () => {
    setQRCode(null);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay bg="blackAlpha.300" backdropFilter="blur(10px)" />
      <ModalContent mx="3" w="fit-content" maxW="3xl">
        <ModalHeader pt={6}>
          <Icon color="primary">
            <QRIcon color="white" />
          </Icon>
        </ModalHeader>
        <ModalCloseButton mt={3} />
        {qrcodeLinks && (
          <ModalBody>
            <HStack
              flexWrap="wrap"
              spacing={0}
              alignItems="center"
              justifyContent="center"
            >
              {qrcodeLinks.map((link) => {
                return <QRCode size={180} p="2" value={link} />;
              })}
            </HStack>
          </ModalBody>
        )}
      </ModalContent>
    </Modal>
  );
};
