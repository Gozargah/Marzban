import { useDashboard } from "../contexts/DashboardContext";
import { FC, useState } from "react";
import {
  Box,
  chakra,
  HStack,
  IconButton,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Text,
} from "@chakra-ui/react";
import { Icon } from "./Icon";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  QrCodeIcon,
} from "@heroicons/react/24/outline";
import { QRCodeCanvas } from "qrcode.react";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import Slider from "react-slick";

const QRCode = chakra(QRCodeCanvas);
const NextIcon = chakra(ChevronRightIcon, {
  baseStyle: {
    w: 6,
    h: 6,
    color: "gray.600",
    _dark: {
      color: "white",
    },
  },
});
const PrevIcon = chakra(ChevronLeftIcon, {
  baseStyle: {
    w: 6,
    h: 6,
    color: "gray.600",
    _dark: {
      color: "white",
    },
  },
});
const QRIcon = chakra(QrCodeIcon, {
  baseStyle: {
    w: 5,
    h: 5,
  },
});

export const QRCodeDialog: FC = () => {
  const { qrcodeLinks, setQRCode } = useDashboard();
  const isOpen = qrcodeLinks !== null;
  const [index, setIndex] = useState(0);
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
          <ModalBody w="440px" display="flex" justifyContent="center">
            <Box w="300px">
              <Slider
                centerPadding="0px"
                centerMode={true}
                slidesToShow={1}
                slidesToScroll={1}
                dots={false}
                afterChange={setIndex}
                onInit={() => setIndex(0)}
                nextArrow={
                  <IconButton
                    size="sm"
                    position="absolute"
                    display="flex !important"
                    _before={{ content: '""' }}
                    aria-label="next"
                  >
                    <NextIcon />
                  </IconButton>
                }
                prevArrow={
                  <IconButton
                    size="sm"
                    position="absolute"
                    display="flex !important"
                    _before={{ content: '""' }}
                    aria-label="prev"
                  >
                    <PrevIcon />
                  </IconButton>
                }
              >
                {qrcodeLinks.map((link, i) => {
                  return (
                    <HStack key={i}>
                      <QRCode
                        mx="auto"
                        size={300}
                        p="2"
                        level={"L"}
                        includeMargin={false}
                        value={link}
                      />
                    </HStack>
                  );
                })}
              </Slider>
              <Text display="block" textAlign="center" pb={3} mt={1}>
                {index + 1} / {qrcodeLinks.length}
              </Text>
            </Box>
          </ModalBody>
        )}
      </ModalContent>
    </Modal>
  );
};
