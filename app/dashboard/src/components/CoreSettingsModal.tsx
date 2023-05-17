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
import { joinPaths } from "@remix-run/router";
import classNames from "classnames";
import { useCoreSettings } from "contexts/CoreSettingsContext";
import { useDashboard } from "contexts/DashboardContext";
import { FC, useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useMutation } from "react-query";
import { ReadyState } from "react-use-websocket";
import { useWebSocket } from "react-use-websocket/dist/lib/use-websocket";
import { getAuthToken } from "utils/authStorage";
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

let logsTmp: string[] = [];
export const CoreSettingsModal: FC<NodesUsageProps> = () => {
  const { isEditingCore } = useDashboard();
  const {
    fetchCoreSettings,
    updateConfig,
    isLoading,
    config,
    isPostLoading,
    version,
    restartCore,
  } = useCoreSettings();
  const logsDiv = useRef<HTMLDivElement | null>(null);
  const onClose = useDashboard.setState.bind(null, { isEditingCore: false });
  const { t } = useTranslation();
  const form = useForm({
    defaultValues: { config: config || {} },
  });
  const toast = useToast();
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    if (config) form.setValue("config", config);
  }, [config]);
  useEffect(() => {
    if (isEditingCore) fetchCoreSettings();
  }, [isEditingCore]);
  "".startsWith;

  let baseURL = new URL(
    import.meta.env.VITE_BASE_API.startsWith("/")
      ? window.location.origin + import.meta.env.VITE_BASE_API
      : import.meta.env.VITE_BASE_API
  );

  const { readyState } = useWebSocket(
    (baseURL.protocol === "https:" ? "wss://" : "ws://") +
      joinPaths([baseURL.host + baseURL.pathname, "/core/logs"]) +
      "?token=" +
      getAuthToken(),
    {
      onMessage: (e) => {
        logsTmp.push(e.data);
        setLogs([...logsTmp]);
      },
    }
  );

  useEffect(() => {
    if (logsDiv.current)
      logsDiv.current.scrollTop = logsDiv.current?.scrollHeight;
  }, [logs]);

  const status = {
    [ReadyState.CONNECTING]: "connecting",
    [ReadyState.OPEN]: "connected",
    [ReadyState.CLOSING]: "closed",
    [ReadyState.CLOSED]: "closed",
    [ReadyState.UNINSTANTIATED]: "closed",
  }[readyState];
  const { mutate: handleRestartCore, isLoading: isRestarting } =
    useMutation(restartCore);
  const handleOnSave = ({ config }: any) => {
    updateConfig(config)
      .then(() => {
        toast({
          title: t("core.successMessage"),
          status: "success",
          isClosable: true,
          position: "top",
          duration: 3000,
        });
      })
      .catch((e) => {
        let message = t("core.generalErrorMessage");
        if (typeof e.response._data.detail === "object")
          message =
            e.response._data.detail[Object.keys(e.response._data.detail)[0]];
        if (typeof e.response._data.detail === "string")
          message = e.response._data.detail;

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
                  {t("core.configuration")}{" "}
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
                <FormLabel>{t("core.logs")}</FormLabel>
                <Text as={FormLabel}>{t(`core.socket.${status}`)}</Text>
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
                minHeight="200px"
                maxHeight={"250px"}
                p={2}
                overflowY="auto"
                ref={logsDiv}
              >
                {logs.map((message, i) => (
                  <Text fontSize="xs" opacity={0.8} key={i}>
                    {message}
                  </Text>
                ))}
              </Box>
            </FormControl>
          </ModalBody>
          <ModalFooter>
            <HStack w="full" justifyContent="space-between">
              <Box>
                <Button
                  size="sm"
                  leftIcon={
                    <ReloadIcon
                      className={classNames({
                        "animate-spin": isRestarting,
                      })}
                    />
                  }
                  onClick={() => handleRestartCore()}
                >
                  {t(isRestarting ? "core.restarting" : "core.restartCore")}
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
                  {t("core.save")}
                </Button>
              </HStack>
            </HStack>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
};
