import {
  Box,
  Button,
  chakra,
  FormControl,
  FormLabel,
  HStack,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Text,
  Tooltip,
} from "@chakra-ui/react";
import { ArrowPathIcon, Cog6ToothIcon } from "@heroicons/react/24/outline";
import { useDashboard } from "contexts/DashboardContext";
import { FC } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "./Icon";
import { JsonEditor } from "./JsonEditor";

import "./JsonEditor/themes.js";

const UsageIcon = chakra(Cog6ToothIcon, {
  baseStyle: {
    w: 5,
    h: 5,
  },
});
export const ReloadIcon = chakra(ArrowPathIcon, {
  baseStyle: {
    w: 4,
    h: 4,
  },
});

export type NodesUsageProps = {};

export const CoreSettingsModal: FC<NodesUsageProps> = () => {
  const { isEditingCore } = useDashboard();
  const onClose = useDashboard.setState.bind(null, { isEditingCore: false });
  const { t } = useTranslation();

  return (
    <Modal isOpen={isEditingCore} onClose={onClose} size="3xl">
      <ModalOverlay bg="blackAlpha.300" backdropFilter="blur(10px)" />
      <ModalContent mx="3" w="full">
        <ModalHeader pt={6}>
          <HStack gap={2}>
            <Icon color="primary">
              <UsageIcon color="white" />
            </Icon>
            <Text fontWeight="semibold" fontSize="lg">
              {t("core.title")}
            </Text>
          </HStack>
        </ModalHeader>
        <ModalCloseButton mt={3} />
        <ModalBody>
          <FormControl>
            <HStack justifyContent="space-between">
              <FormLabel>Configuration</FormLabel>
              <Tooltip label="Xray Version" placement="top">
                <Text as={FormLabel}>v1.8.2</Text>
              </Tooltip>
            </HStack>
            <JsonEditor json={{}} onChange={console.log} />
          </FormControl>
          <FormControl mt="4">
            <HStack justifyContent="space-between">
              <FormLabel>Logs</FormLabel>
              <Text as={FormLabel}>Connecting...</Text>
            </HStack>
            <Box
              border="1px solid"
              borderColor="gray.300"
              bg="#F9F9F9"
              _dark={{
                borderColor: "gray.500",
                bg: "#2e3440",
              }}
              borderRadius={5}
              minHeight="100px"
            ></Box>
          </FormControl>
        </ModalBody>
        <ModalFooter>
          <HStack w="full" justifyContent="space-between">
            <Box>
              <Button size="sm" leftIcon={<ReloadIcon />}>
                Restart Core
              </Button>
            </Box>
            <HStack>
              <Button size="sm" variant="solid" colorScheme="primary" px="5">
                Save
              </Button>
            </HStack>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
