import { useDashboard } from "../contexts/DashboardContext";
import { FC } from "react";
import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Box,
  Button,
  chakra,
  HStack,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Text,
  VStack,
} from "@chakra-ui/react";
import { Icon } from "./Icon";
import { LinkIcon } from "@heroicons/react/24/outline";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";

const ModalIcon = chakra(LinkIcon, {
  baseStyle: {
    w: 5,
    h: 5,
  },
});

const AccordionInbound: FC = () => {
  return (
    <AccordionItem
      border="1px solid"
      _dark={{ borderColor: "gray.600" }}
      _light={{ borderColor: "gray.200" }}
      borderRadius="4px"
      p={1}
      w="full"
    >
      <AccordionButton px={2} borderRadius="3px">
        <Text
          as="span"
          fontWeight="medium"
          fontSize="sm"
          flex="1"
          textAlign="left"
          color="gray.700"
          _dark={{ color: "gray.300" }}
        >
          VLESS_NO_TLS
        </Text>
        <AccordionIcon />
      </AccordionButton>
      <AccordionPanel px={2} pb={2}>
        <VStack gap={3}>
          <VStack
            border="1px solid"
            _dark={{ borderColor: "gray.600" }}
            _light={{ borderColor: "gray.200" }}
            p={2}
            borderRadius="4px"
          >
            <Input size="sm" borderRadius="4px" placeholder="Remark" />
            <HStack>
              <Input
                w="70%"
                size="sm"
                borderRadius="4px"
                placeholder="Address (e.g. google.com)"
              />
              <Input w="30%" size="sm" borderRadius="4px" placeholder="8080" />
            </HStack>
          </VStack>
          <Button
            variant="outline"
            w="full"
            size="sm"
            color=""
            fontWeight={"normal"}
          >
            Add host
          </Button>
        </VStack>
      </AccordionPanel>
    </AccordionItem>
  );
};

export const HostsDialog: FC = () => {
  const { isEditingHosts, onEditingHosts } = useDashboard();
  const onClose = onEditingHosts.bind(null, false);
  return (
    <Modal isOpen={isEditingHosts} onClose={onClose}>
      <ModalOverlay bg="blackAlpha.300" backdropFilter="blur(10px)" />
      <ModalContent mx="3" w="fit-content" maxW="3xl">
        <ModalHeader pt={6}>
          <Icon color="primary">
            <ModalIcon color="white" />
          </Icon>
        </ModalHeader>
        <ModalCloseButton mt={3} />
        <ModalBody w="440px" pb={3} pt={3}>
          <Text mb={3} opacity={0.8} fontSize="sm">
            Using this setting, you are able to assign specific address for each
            inbound.
          </Text>
          <Accordion w="full" allowToggle allowMultiple>
            <VStack w="full">
              <AccordionInbound />
              <AccordionInbound />
            </VStack>
          </Accordion>
          <HStack justifyContent="flex-end" py={2}>
            <Button
              variant="solid"
              mt="2"
              colorScheme="primary"
              size="sm"
              px={5}
            >
              Apply
            </Button>
          </HStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};
