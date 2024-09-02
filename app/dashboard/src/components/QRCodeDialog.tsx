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
  VStack,
} from "@chakra-ui/react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  QrCodeIcon,
} from "@heroicons/react/24/outline";
import { QRCodeCanvas } from "qrcode.react";
import { FC, useState } from "react";
import { useTranslation } from "react-i18next";
import Slider from "react-slick";
import "slick-carousel/slick/slick-theme.css";
import "slick-carousel/slick/slick.css";
import { useDashboard } from "../contexts/DashboardContext";
import { Icon } from "./Icon";

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
  const { QRcodeLinks, setQRCode, setSubLink, subscribeUrl } = useDashboard();
  const isOpen = QRcodeLinks !== null;
  const [index, setIndex] = useState(0);
  const { t } = useTranslation();
  const onClose = () => {
    setQRCode(null);
    setSubLink(null);
  };

  const subscribeQrLink = String(subscribeUrl).startsWith("/")
    ? window.location.origin + subscribeUrl
    : String(subscribeUrl);

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
        {QRcodeLinks && (
          <ModalBody
            gap={{
              base: "20px",
              lg: "50px",
            }}
            pr={{
              lg: "60px",
            }}
            px={{
              base: "50px",
            }}
            display="flex"
            justifyContent="center"
            flexDirection={{
              base: "column",
              lg: "row",
            }}
          >
            {subscribeUrl && (
              <VStack>
                <QRCode
                  mx="auto"
                  size={300}
                  p="2"
                  level={"L"}
                  includeMargin={false}
                  value={subscribeQrLink}
                  bg="white"
                />
                <Text display="block" textAlign="center" pb={3} mt={1}>
                  {t("qrcodeDialog.sublink")}
                </Text>
              </VStack>
            )}
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
                    mr="-4"
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
                    ml="-4"
                  >
                    <PrevIcon />
                  </IconButton>
                }
              >
                {QRcodeLinks.map((link, i) => {
                  return (
                    <HStack key={i}>
                      <QRCode
                        mx="auto"
                        size={300}
                        p="2"
                        level={"L"}
                        includeMargin={false}
                        value={link}
                        bg="white"
                      />
                    </HStack>
                  );
                })}
              </Slider>
              <Text display="block" textAlign="center" pb={3} mt={1}>
                {index + 1} / {QRcodeLinks.length}
              </Text>
            </Box>
          </ModalBody>
        )}
      </ModalContent>
    </Modal>
  );
};
