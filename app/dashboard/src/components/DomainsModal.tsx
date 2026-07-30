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
  Spinner,
  Text,
  VStack,
  useToast,
} from "@chakra-ui/react";
import { GlobeAltIcon } from "@heroicons/react/24/outline";
import { useDashboard } from "contexts/DashboardContext";
import { useHosts } from "contexts/HostsContext";
import { FC, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "./Icon";
import { Input } from "./Input";

const DomainsIcon = chakra(GlobeAltIcon, { baseStyle: { w: 5, h: 5 } });

type HostEntry = Record<string, any>;
type HostsSchema = Record<string, HostEntry[]>;

export const DomainsModal: FC = () => {
  const { isEditingDomains, onEditingDomains } = useDashboard();
  const { hosts, fetchHosts, setHosts, isLoading, isPostLoading } = useHosts();
  const [localHosts, setLocalHosts] = useState<HostsSchema>({});
  const { t } = useTranslation();
  const toast = useToast();

  useEffect(() => {
    if (isEditingDomains) fetchHosts();
  }, [isEditingDomains]);

  useEffect(() => {
    setLocalHosts(hosts as HostsSchema);
  }, [hosts]);

  const onClose = () => onEditingDomains(false);

  const updateAddress = (tag: string, index: number, value: string) => {
    setLocalHosts((prev) => {
      const nextTagHosts = [...(prev[tag] || [])];
      nextTagHosts[index] = { ...nextTagHosts[index], address: value };
      return { ...prev, [tag]: nextTagHosts };
    });
  };

  const save = () => {
    setHosts(localHosts as any)
      .then(() => {
        toast({
          title: t("domainsModal.saved"),
          status: "success",
          isClosable: true,
          position: "top",
          duration: 3000,
        });
        onClose();
      })
      .catch(() => {
        toast({
          title: t("domainsModal.saveFailed"),
          status: "error",
          isClosable: true,
          position: "top",
          duration: 3000,
        });
      });
  };

  const entries = Object.entries(localHosts);

  return (
    <Modal isOpen={isEditingDomains} onClose={onClose} size="lg">
      <ModalOverlay bg="blackAlpha.300" backdropFilter="blur(10px)" />
      <ModalContent mx="3" w="full">
        <ModalHeader pt={6}>
          <HStack gap={2}>
            <Icon color="primary">
              <DomainsIcon color="white" />
            </Icon>
            <Text fontWeight="semibold" fontSize="lg">
              {t("domainsModal.title")}
            </Text>
          </HStack>
        </ModalHeader>
        <ModalCloseButton mt={3} />
        <ModalBody>
          <Text fontSize="sm" color="gray.500" mb="4">
            {t("domainsModal.description")}
          </Text>
          {isLoading ? (
            <HStack justifyContent="center" py="8">
              <Spinner size="sm" />
            </HStack>
          ) : entries.length === 0 ? (
            <Text fontSize="sm" color="gray.500" textAlign="center" py="4">
              {t("domainsModal.empty")}
            </Text>
          ) : (
            <VStack spacing="5" align="stretch">
              {entries.map(([tag, tagHosts]) => (
                <Box key={tag}>
                  <Text
                    fontSize="xs"
                    fontWeight="bold"
                    textTransform="uppercase"
                    color="gray.500"
                    mb="2"
                  >
                    {tag}
                  </Text>
                  <VStack spacing="3" align="stretch">
                    {tagHosts.map((host, i) => (
                      <FormControl key={i}>
                        <FormLabel fontSize="sm">{host.remark || `#${i + 1}`}</FormLabel>
                        <Input
                          size="sm"
                          value={host.address || ""}
                          onChange={(e: any) => updateAddress(tag, i, e.target.value)}
                          placeholder={t("domainsModal.addressPlaceholder")}
                        />
                      </FormControl>
                    ))}
                  </VStack>
                </Box>
              ))}
            </VStack>
          )}
        </ModalBody>
        <ModalFooter>
          <HStack w="full" justifyContent="flex-end">
            <Button
              size="sm"
              variant="solid"
              colorScheme="primary"
              onClick={save}
              isDisabled={isLoading || isPostLoading}
              isLoading={isPostLoading}
            >
              {t("domainsModal.save")}
            </Button>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
