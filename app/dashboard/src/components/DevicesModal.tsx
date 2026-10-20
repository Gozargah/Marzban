import {
  Alert,
  AlertIcon,
  Badge,
  chakra,
  Flex,
  IconButton,
  ModalBody,
  Spinner,
  Text,
  Tooltip,
  VStack,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Divider,
  Link,
} from "@chakra-ui/react";

import { TrashIcon } from "@heroicons/react/24/outline";
import dayjs from "dayjs";
import { useTranslation } from "react-i18next";
import { User, UserDevice } from "types/User";
import { fetch } from "service/http";

// NPVPN-2148: несколько гео-баз и провайдер на одной странице — по РФ базы часто расходятся.
const checkIpUrl = (ip: string) =>
  `https://check-host.net/ip-info?host=${encodeURIComponent(ip)}`;

const DeleteDeviceIcon = chakra(TrashIcon, {
  baseStyle: {
    w: 4,
    h: 4,
  },
});

interface DeviceModalProps {
  devicesError: string | null;
  devicesLoading: boolean;
  devices: UserDevice[];
  deletingDeviceId: number | null;
  editingUser: User | null | undefined;
  setDeletingDeviceId: (id: number | null) => void;
  setDevicesError: (error: string | null) => void;
  setDevices: (
    devices: UserDevice[] | ((prev: UserDevice[]) => UserDevice[])
  ) => void;
  toast: any;
}

export const DevicesModal = ({
  devicesError,
  devicesLoading,
  devices,
  deletingDeviceId,
  editingUser,
  setDeletingDeviceId,
  setDevicesError,
  setDevices,
  toast,
}: DeviceModalProps) => {
  const { t } = useTranslation();

  const deleteDevice = async (deviceId: number) => {
    if (!editingUser) return;

    setDeletingDeviceId(deviceId);
    setDevicesError(null);
    try {
      await fetch(`/user/${editingUser.username}/devices/${deviceId}`, {
        method: "DELETE",
      });
      setDevices((prev) => prev.filter((device) => device.id !== deviceId));
      toast({
        title: t("userDialog.deviceDeleted"),
        status: "success",
        isClosable: true,
        position: "top",
        duration: 3000,
      });
    } catch (err: any) {
      setDevicesError(
        err?.response?._data?.detail || t("userDialog.deviceDeleteError")
      );
    } finally {
      setDeletingDeviceId(null);
    }
  };

  const getStatusColor = (status?: string) => {
    if (!status || status.toLowerCase() === "active") return "green";
    if (status.toLowerCase() === "revoked") return "red";
    return "gray";
  };

  return (
    <ModalBody overflow="auto" p={4}>
      {devicesError && (
        <Alert status="error" mb={3}>
          <AlertIcon />
          {devicesError}
        </Alert>
      )}
      {devicesLoading ? (
        <Flex justifyContent="center" py="6">
          <Spinner />
        </Flex>
      ) : devices.length ? (
        <Accordion allowToggle>
          {devices.map((device) => (
            <AccordionItem
              key={device.id}
              borderWidth="1px"
              borderRadius="lg"
              mb={2}
            >
              <AccordionButton
                _hover={{ bg: "gray.100", _dark: { bg: "gray.600" } }}
                borderRadius="lg"
                px={3}
                py={2}
              >
                <Flex flex="1" align="center" minW={0} gap={4}>
                  {/* HWID */}
                  <Text
                    flex={{ base: 1, md: 2 }}
                    fontSize="sm"
                    fontFamily="mono"
                    fontWeight="bold"
                    noOfLines={1}
                  >
                    {device.hwid}
                  </Text>

                  {/* Model */}
                  <Text
                    flex={1}
                    fontSize="sm"
                    color="gray.600"
                    _dark={{ color: "gray.300" }}
                    noOfLines={1}
                    display={{ base: "none", md: "block" }}
                  >
                    {device.device_model || "-"}
                  </Text>

                  {/* OS */}
                  <Text
                    flex={1}
                    fontSize="sm"
                    color="gray.600"
                    _dark={{ color: "gray.300" }}
                    noOfLines={1}
                    display={{ base: "none", lg: "block" }}
                  >
                    {device.device_os || "-"}
                  </Text>

                  {/* Version */}
                  <Text
                    flex={1}
                    fontSize="sm"
                    color="gray.600"
                    _dark={{ color: "gray.300" }}
                    noOfLines={1}
                    display={{ base: "none", xl: "block" }}
                  >
                    {device.ver_os || "-"}
                  </Text>

                  {/* IP — текстом: ссылка внутри AccordionButton раскрывала бы аккордеон */}
                  <Text
                    flex={1.2}
                    fontSize="sm"
                    fontFamily="mono"
                    color="gray.600"
                    _dark={{ color: "gray.300" }}
                    noOfLines={1}
                    display={{ base: "none", lg: "block" }}
                  >
                    {device.last_ip || "-"}
                  </Text>

                  {/* Last Seen */}
                  <Text
                    flex={1.3}
                    fontSize="sm"
                    color="gray.600"
                    _dark={{ color: "gray.300" }}
                    noOfLines={1}
                    display={{ base: "none", "2xl": "block" }}
                  >
                    {device.last_seen
                      ? dayjs(device.last_seen).format("YYYY-MM-DD HH:mm")
                      : "-"}
                  </Text>

                  <Badge
                    colorScheme={getStatusColor(device.status)}
                    flexShrink={0}
                  >
                    {device.status || "active"}
                  </Badge>

                  <Tooltip label={t("delete")} placement="top">
                    <IconButton
                      aria-label={t("delete")}
                      size="xs"
                      variant="ghost"
                      colorScheme="red"
                      icon={<DeleteDeviceIcon />}
                      isLoading={deletingDeviceId === device.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteDevice(device.id);
                      }}
                      flexShrink={0}
                      minW="28px"
                      h="28px"
                    />
                  </Tooltip>

                  <AccordionIcon flexShrink={0} />
                </Flex>
              </AccordionButton>

              <AccordionPanel pb={4} pt={3}>
                <VStack align="start" spacing={2.5} divider={<Divider />}>
                  {/* HWID */}
                  <Flex w="full" justify="space-between" align="center">
                    <Text
                      fontSize="sm"
                      color="gray.500"
                      fontWeight="medium"
                      flexShrink={0}
                    >
                      HWID:
                    </Text>
                    <Text
                      fontSize="sm"
                      fontFamily="mono"
                      wordBreak="break-all"
                      color="gray.800"
                      _dark={{ color: "white" }}
                      textAlign="right"
                      ml={4}
                    >
                      {device.hwid}
                    </Text>
                  </Flex>

                  {/* Device OS */}
                  <Flex w="full" justify="space-between" align="center">
                    <Text
                      fontSize="sm"
                      color="gray.500"
                      fontWeight="medium"
                      flexShrink={0}
                    >
                      {t("userDialog.deviceOs")}:
                    </Text>
                    <Text
                      fontSize="sm"
                      color="gray.800"
                      _dark={{ color: "white" }}
                      textAlign="right"
                      ml={4}
                    >
                      {device.device_os || "-"}
                    </Text>
                  </Flex>

                  {/* Version OS */}
                  <Flex w="full" justify="space-between" align="center">
                    <Text
                      fontSize="sm"
                      color="gray.500"
                      fontWeight="medium"
                      flexShrink={0}
                    >
                      {t("userDialog.deviceVerOs")}:
                    </Text>
                    <Text
                      fontSize="sm"
                      color="gray.800"
                      _dark={{ color: "white" }}
                      textAlign="right"
                      ml={4}
                    >
                      {device.ver_os || "-"}
                    </Text>
                  </Flex>

                  {/* Device Model */}
                  <Flex w="full" justify="space-between" align="center">
                    <Text
                      fontSize="sm"
                      color="gray.500"
                      fontWeight="medium"
                      flexShrink={0}
                    >
                      {t("userDialog.deviceModel")}:
                    </Text>
                    <Text
                      fontSize="sm"
                      color="gray.800"
                      _dark={{ color: "white" }}
                      textAlign="right"
                      ml={4}
                    >
                      {device.device_model || "-"}
                    </Text>
                  </Flex>

                  {/* User-Agent */}
                  <Flex w="full" justify="space-between" align="flex-start">
                    <Text
                      fontSize="sm"
                      color="gray.500"
                      fontWeight="medium"
                      flexShrink={0}
                    >
                      User-Agent:
                    </Text>
                    <Text
                      fontSize="sm"
                      color="gray.800"
                      _dark={{ color: "white" }}
                      wordBreak="break-all"
                      textAlign="right"
                      ml={4}
                      flex={1}
                    >
                      {device.user_agent || "-"}
                    </Text>
                  </Flex>

                  {/* First Seen */}
                  <Flex w="full" justify="space-between" align="center">
                    <Text
                      fontSize="sm"
                      color="gray.500"
                      fontWeight="medium"
                      flexShrink={0}
                    >
                      {t("userDialog.deviceFirstSeen")}:
                    </Text>
                    <Text
                      fontSize="sm"
                      color="gray.800"
                      _dark={{ color: "white" }}
                      textAlign="right"
                      ml={4}
                    >
                      {device.first_seen
                        ? dayjs(device.first_seen).format("YYYY-MM-DD HH:mm")
                        : "-"}
                    </Text>
                  </Flex>

                  {/* IP */}
                  <Flex w="full" justify="space-between" align="center">
                    <Text
                      fontSize="sm"
                      color="gray.500"
                      fontWeight="medium"
                      flexShrink={0}
                    >
                      {t("userDialog.deviceIp")}:
                    </Text>
                    {device.last_ip ? (
                      <Link
                        href={checkIpUrl(device.last_ip)}
                        isExternal
                        rel="noopener noreferrer"
                        fontSize="sm"
                        fontFamily="mono"
                        color="blue.500"
                        textDecoration="underline"
                        _hover={{ color: "blue.600" }}
                        ml={4}
                      >
                        {device.last_ip}
                      </Link>
                    ) : (
                      <Text
                        fontSize="sm"
                        color="gray.800"
                        _dark={{ color: "white" }}
                        textAlign="right"
                        ml={4}
                      >
                        -
                      </Text>
                    )}
                  </Flex>

                  {/* Last Seen */}
                  <Flex w="full" justify="space-between" align="center">
                    <Text
                      fontSize="sm"
                      color="gray.500"
                      fontWeight="medium"
                      flexShrink={0}
                    >
                      {t("userDialog.deviceLastSeen")}:
                    </Text>
                    <Text
                      fontSize="sm"
                      color="gray.800"
                      _dark={{ color: "white" }}
                      textAlign="right"
                      ml={4}
                    >
                      {device.last_seen
                        ? dayjs(device.last_seen).format("YYYY-MM-DD HH:mm")
                        : "-"}
                    </Text>
                  </Flex>

                  {/* Status */}
                  <Flex w="full" justify="space-between" align="center">
                    <Text
                      fontSize="sm"
                      color="gray.500"
                      fontWeight="medium"
                      flexShrink={0}
                    >
                      {t("userDialog.status", "Status")}:
                    </Text>
                    <Badge colorScheme={getStatusColor(device.status)}>
                      {device.status || "active"}
                    </Badge>
                  </Flex>
                </VStack>
              </AccordionPanel>
            </AccordionItem>
          ))}
        </Accordion>
      ) : (
        <Flex
          direction="column"
          align="center"
          justify="center"
          py={12}
          px={6}
          minH="200px"
        >
          <Text color="gray.500" fontSize="md" textAlign="center">
            {t("userDialog.devicesEmpty")}
          </Text>
        </Flex>
      )}
    </ModalBody>
  );
};
