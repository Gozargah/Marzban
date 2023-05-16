import {
  Badge,
  Box,
  Button,
  chakra,
  CircularProgress,
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
  useToast,
} from "@chakra-ui/react";
import { ArrowPathIcon, Cog6ToothIcon } from "@heroicons/react/24/outline";
import { useCoreSettings } from "contexts/CoreSettingsContext";
import { useDashboard } from "contexts/DashboardContext";
import { FC, useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
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
  const {
    fetchCoreSettings,
    updateConfig,
    isLoading,
    config,
    isPostLoading,
    version,
  } = useCoreSettings();
  const onClose = useDashboard.setState.bind(null, { isEditingCore: false });
  const { t } = useTranslation();
  const form = useForm({
    defaultValues: { config: config || {} },
  });
  const toast = useToast();
  useEffect(() => {
    if (config) form.setValue("config", config);
  }, [config]);

  useEffect(() => {
    if (isEditingCore) fetchCoreSettings();
  }, [isEditingCore]);

  const handleOnSave = ({ config }: any) => {
    updateConfig(config)
      .then(() => {
        toast({
          title: "Core settings updated successfully",
          status: "success",
          isClosable: true,
          position: "top",
          duration: 3000,
        });
      })
      .catch((e) => {
        let message = "Something went wrong, please check the configuration";
        if (typeof e.response._data.detail === "object")
          message =
            e.response._data.detail[Object.keys(e.response._data.detail)[0]];
        toast({
          title: message,
          status: "error",
          isClosable: true,
          position: "top",
          duration: 3000,
        });
      });
  };

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
        <form onSubmit={form.handleSubmit(handleOnSave)}>
          <ModalBody>
            <FormControl>
              <HStack justifyContent="space-between" alignItems="flex-start">
                <FormLabel>
                  Configuration{" "}
                  {isLoading && (
                    <CircularProgress isIndeterminate size="15px" />
                  )}
                </FormLabel>
                <Tooltip label="Xray Version" placement="top">
                  <Badge as={FormLabel} textTransform="lowercase">
                    {version && `v${version}`}
                  </Badge>
                </Tooltip>
              </HStack>
              <Controller
                control={form.control}
                name="config"
                render={({ field }) => (
                  <JsonEditor json={config} onChange={field.onChange} />
                )}
              />
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
                <Button
                  size="sm"
                  variant="solid"
                  colorScheme="primary"
                  px="5"
                  type="submit"
                  isDisabled={isLoading || isPostLoading}
                  isLoading={isPostLoading}
                >
                  Save
                </Button>
              </HStack>
            </HStack>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
};
