import {
  chakra,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Text,
  VStack,
} from "@chakra-ui/react";
import {
  QrCodeIcon,
} from "@heroicons/react/24/outline";
import { QRCodeCanvas } from "qrcode.react";
import { FC } from "react";
import { useTranslation } from "react-i18next";
import "slick-carousel/slick/slick-theme.css";
import "slick-carousel/slick/slick.css";
import { Icon } from "./Icon";
import { useClash } from "contexts/ClashContext";

const QRCode = chakra(QRCodeCanvas);
const QRIcon = chakra(QrCodeIcon, {
  baseStyle: {
    w: 5,
    h: 5,
  },
});

export const ClashQRCodeDialog: FC = () => {
  const { setSublink, sublink } = useClash();
  const isOpen = sublink !== null;
  const { t } = useTranslation();
  const onClose = () => {
    setSublink(null);
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
        <ModalBody>
          <VStack>
            <QRCode
                mx="auto"
                size={300}
                p="2"
                level={"L"}
                includeMargin={false}
                value={sublink || ""}
                bg="white"
            />
            <Text display="block" textAlign="center" pb={3} mt={1}>
                {t("clash.sublink")}
            </Text>
          </VStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};
