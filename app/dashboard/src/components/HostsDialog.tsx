import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Badge,
  Box,
  Button,
  chakra,
  FormControl,
  FormErrorMessage,
  FormLabel,
  HStack,
  IconButton,
  InputGroup,
  InputRightElement,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Popover,
  PopoverArrow,
  PopoverBody,
  PopoverCloseButton,
  PopoverContent,
  PopoverTrigger,
  Portal,
  Select as ChakraSelect,
  Text,
  Tooltip,
  useToast,
  VStack,
} from "@chakra-ui/react";
import { InformationCircleIcon, LinkIcon } from "@heroicons/react/24/outline";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  proxyALPN,
  proxyFingerprint,
  proxyHostSecurity,
} from "constants/Proxies";
import { useHosts } from "contexts/HostsContext";
import { FC, useEffect, useState } from "react";
import {
  FormProvider,
  useFieldArray,
  useForm,
  useFormContext,
} from "react-hook-form";
import { Trans, useTranslation } from "react-i18next";
import "slick-carousel/slick/slick-theme.css";
import "slick-carousel/slick/slick.css";
import { z } from "zod";
import { useDashboard } from "../contexts/DashboardContext";
import { DeleteIcon } from "./DeleteUserModal";
import { Icon } from "./Icon";
import { Input as CustomInput } from "./Input";

const Select = chakra(ChakraSelect, {
  baseStyle: {
    bg: "white",
    _dark: {
      bg: "gray.700",
    },
  },
});

const Input = chakra(CustomInput, {
  baseStyle: {
    bg: "white",
    _dark: {
      bg: "gray.700",
    },
  },
});

const ModalIcon = chakra(LinkIcon, {
  baseStyle: {
    w: 5,
    h: 5,
  },
});

const InfoIcon = chakra(InformationCircleIcon, {
  baseStyle: {
    w: 4,
    h: 4,
    color: "gray.400",
    cursor: "pointer",
  },
});

const hostsSchema = z.record(
  z.string().min(1),
  z.array(
    z.object({
      remark: z.string().min(1, "Remark is required"),
      address: z.string().min(1, "Address is required"),
      port: z
        .string()
        .or(z.number())
        .nullable()
        .transform((value) => {
          if (typeof value === "number") return value;
          if (value !== null && !isNaN(parseInt(value)))
            return Number(parseInt(value));
          return null;
        }),
      sni: z.string().nullable(),
      host: z.string().nullable(),
      security: z.string(),
      alpn: z.string(),
      fingerprint: z.string(),
    })
  )
);

const Error = chakra(FormErrorMessage, {
  baseStyle: {
    color: "red.400",
    display: "block",
    textAlign: "left",
    w: "100%",
  },
});

type AccordionInboundType = {
  hostKey: string;
  isOpen: boolean;
  toggleAccordion: () => void;
};

const AccordionInbound: FC<AccordionInboundType> = ({
  hostKey,
  isOpen,
  toggleAccordion,
}) => {
  const { inbounds } = useDashboard();
  const inbound = [...inbounds.values()]
    .flat()
    .filter((inbound) => inbound.tag === hostKey)[0];

  const form = useFormContext<z.infer<typeof hostsSchema>>();
  const {
    fields: hosts,
    append: addHost,
    remove: removeHost,
  } = useFieldArray({
    control: form.control,
    name: hostKey,
  });
  const { errors } = form.formState;
  const { t } = useTranslation();
  const accordionErrors = errors[hostKey];
  const handleAddHost = () => {
    addHost({
      host: "",
      sni: "",
      port: null,
      address: "",
      remark: "",
      security: "inbound_default",
      alpn: "",
      fingerprint: "",
    });
  };
  useEffect(() => {
    if (accordionErrors && !isOpen) {
      toggleAccordion();
    }
  }, [accordionErrors]);
  return (
    <AccordionItem
      border="1px solid"
      _dark={{ borderColor: "gray.600" }}
      _light={{ borderColor: "gray.200" }}
      borderRadius="4px"
      p={1}
      w="full"
    >
      <AccordionButton px={2} borderRadius="3px" onClick={toggleAccordion}>
        <Text
          as="span"
          fontWeight="medium"
          fontSize="sm"
          flex="1"
          textAlign="left"
          color="gray.700"
          _dark={{ color: "gray.300" }}
        >
          {hostKey}
        </Text>
        <AccordionIcon />
      </AccordionButton>
      <AccordionPanel px={2} pb={2}>
        <VStack gap={3}>
          {hosts.map((host, index) => (
            <VStack
              key={index}
              border="1px solid"
              _dark={{ borderColor: "gray.600", bg: "#273142" }}
              _light={{ borderColor: "gray.200", bg: "#fcfbfb" }}
              p={2}
              w="full"
              borderRadius="4px"
            >
              <HStack w="100%" alignItems="flex-start">
                <FormControl
                  position="relative"
                  zIndex={10}
                  isInvalid={
                    !!(accordionErrors && accordionErrors[index]?.remark)
                  }
                >
                  <InputGroup>
                    <Input
                      {...form.register(hostKey + "." + index + ".remark")}
                      size="sm"
                      borderRadius="4px"
                      placeholder="Remark"
                    />
                    <InputRightElement>
                      <Popover isLazy placement="right">
                        <PopoverTrigger>
                          <Box mt="-8px">
                            <InfoIcon />
                          </Box>
                        </PopoverTrigger>
                        <Portal>
                          <PopoverContent>
                            <PopoverArrow />
                            <PopoverCloseButton />
                            <PopoverBody>
                              <Box fontSize="xs">
                                <Text pr="20px">{t("hostsDialog.desc")}</Text>
                                <Text>
                                <Badge>
                                  {"{"}SERVER_IP{"}"}
                                </Badge>{" "}
                                {t("hostsDialog.currentServer")}
                              </Text>
                                <Text mt={1}>
                                  <Badge>
                                    {"{"}USERNAME{"}"}
                                  </Badge>{" "}
                                  {t("hostsDialog.username")}
                                </Text>
                                <Text mt={1}>
                                  <Badge>
                                    {"{"}DATA_USAGE{"}"}
                                  </Badge>{" "}
                                  {t("hostsDialog.dataUsage")}
                                </Text>
                                <Text mt={1}>
                                  <Badge>
                                    {"{"}DATA_LEFT{"}"}
                                  </Badge>{" "}
                                  {t("hostsDialog.remainingData")}
                                </Text>
                                <Text mt={1}>
                                  <Badge>
                                    {"{"}DATA_LIMIT{"}"}
                                  </Badge>{" "}
                                  {t("hostsDialog.dataLimit")}
                                </Text>
                                <Text mt={1}>
                                  <Badge>
                                    {"{"}DAYS_LEFT{"}"}
                                  </Badge>{" "}
                                  {t("hostsDialog.remaingDays")}
                                </Text>
                                <Text mt={1}>
                                  <Badge>
                                    {"{"}PROTOCOL{"}"}
                                  </Badge>{" "}
                                  {t("hostsDialog.proxyProtocol")}
                                </Text>
                                <Text mt={1}>
                                  <Badge>
                                    {"{"}TRANSPORT{"}"}
                                  </Badge>{" "}
                                  {t("hostsDialog.proxyMethod")}
                                </Text>
                              </Box>
                            </PopoverBody>
                          </PopoverContent>
                        </Portal>
                      </Popover>
                    </InputRightElement>
                  </InputGroup>
                  {accordionErrors && accordionErrors[index]?.remark && (
                    <Error>{accordionErrors[index]?.remark?.message}</Error>
                  )}
                </FormControl>
              </HStack>
              <FormControl
                isInvalid={
                  !!(accordionErrors && accordionErrors[index]?.address)
                }
              >
                <InputGroup>
                  <Input
                    size="sm"
                    borderRadius="4px"
                    placeholder="Address (e.g. example.com)"
                    {...form.register(hostKey + "." + index + ".address")}
                  />
                  <InputRightElement>
                    <Popover isLazy placement="right">
                      <PopoverTrigger>
                        <Box mt="-8px">
                          <InfoIcon />
                        </Box>
                      </PopoverTrigger>
                      <Portal>
                        <PopoverContent>
                          <PopoverArrow />
                          <PopoverCloseButton />
                          <PopoverBody>
                            <Box fontSize="xs">
                            <Text pr="20px">{t("hostsDialog.desc")}</Text>
                                <Text>
                                <Badge>
                                  {"{"}SERVER_IP{"}"}
                                </Badge>{" "}
                                {t("hostsDialog.currentServer")}
                              </Text>
                                <Text mt={1}>
                                  <Badge>
                                    {"{"}USERNAME{"}"}
                                  </Badge>{" "}
                                  {t("hostsDialog.username")}
                                </Text>
                                <Text mt={1}>
                                  <Badge>
                                    {"{"}DATA_USAGE{"}"}
                                  </Badge>{" "}
                                  {t("hostsDialog.dataUsage")}
                                </Text>
                                <Text mt={1}>
                                  <Badge>
                                    {"{"}DATA_LEFT{"}"}
                                  </Badge>{" "}
                                  {t("hostsDialog.remainingData")}
                                </Text>
                                <Text mt={1}>
                                  <Badge>
                                    {"{"}DATA_LIMIT{"}"}
                                  </Badge>{" "}
                                  {t("hostsDialog.dataLimit")}
                                </Text>
                                <Text mt={1}>
                                  <Badge>
                                    {"{"}DAYS_LEFT{"}"}
                                  </Badge>{" "}
                                  {t("hostsDialog.remaingDays")}
                                </Text>
                                <Text mt={1}>
                                  <Badge>
                                    {"{"}PROTOCOL{"}"}
                                  </Badge>{" "}
                                  {t("hostsDialog.proxyProtocol")}
                                </Text>
                                <Text mt={1}>
                                  <Badge>
                                    {"{"}TRANSPORT{"}"}
                                  </Badge>{" "}
                                  {t("hostsDialog.proxyMethod")}
                                </Text>
                            </Box>
                          </PopoverBody>
                        </PopoverContent>
                      </Portal>
                    </Popover>
                  </InputRightElement>
                </InputGroup>
                {accordionErrors && accordionErrors[index]?.address && (
                  <Error>{accordionErrors[index]?.address?.message}</Error>
                )}
              </FormControl>

              <Accordion w="full" allowToggle>
                <AccordionItem border="0">
                  <AccordionButton
                    display="flex"
                    justifyContent="space-between"
                    px={0}
                    py={1}
                    borderRadius={3}
                    _hover={{ bg: "transparent" }}
                  >
                    <Text
                      fontSize="xs"
                      color="gray.600"
                      _dark={{ color: "gray.500" }}
                      pl={1}
                    >
                      {t("hostsDialog.advancedOptions")}
                      <AccordionIcon fontSize="sm" ml={1} />
                    </Text>

                    <Tooltip label="Delete" placement="top">
                      <IconButton
                        aria-label="Delete"
                        size="sm"
                        colorScheme="red"
                        variant="ghost"
                        onClick={removeHost.bind(null, index)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </AccordionButton>
                  <AccordionPanel w="full" p={1}>
                    <VStack key={index} w="full" borderRadius="4px">
                      <FormControl
                        isInvalid={
                          !!(accordionErrors && accordionErrors[index]?.port)
                        }
                      >
                        <FormLabel
                          display="flex"
                          pb={1}
                          alignItems="center"
                          justifyContent="space-between"
                          gap={1}
                          m="0"
                        >
                          <span>{t("hostsDialog.port")}</span>
                          <Popover isLazy placement="right">
                            <PopoverTrigger>
                              <InfoIcon />
                            </PopoverTrigger>
                            <Portal>
                              <PopoverContent p={2}>
                                <PopoverArrow />
                                <PopoverCloseButton />
                                <Text fontSize="xs" pr={5}>
                                  {t("hostsDialog.port.info")}
                                </Text>
                              </PopoverContent>
                            </Portal>
                          </Popover>
                        </FormLabel>
                        <Input
                          size="sm"
                          borderRadius="4px"
                          placeholder={String(inbound.port || "8080")}
                          type="number"
                          {...form.register(hostKey + "." + index + ".port")}
                        />
                      </FormControl>
                      <FormControl
                        isInvalid={
                          !!(accordionErrors && accordionErrors[index]?.sni)
                        }
                      >
                        <FormLabel
                          display="flex"
                          pb={1}
                          alignItems="center"
                          gap={1}
                          justifyContent="space-between"
                          m="0"
                        >
                          <span>{t("hostsDialog.sni")}</span>

                          <Popover isLazy placement="right">
                            <PopoverTrigger>
                              <InfoIcon />
                            </PopoverTrigger>
                            <Portal>
                              <PopoverContent p={2}>
                                <PopoverArrow />
                                <PopoverCloseButton />
                                <Text fontSize="xs" pr={5}>
                                  {t("hostsDialog.sni.info")}
                                </Text>
                                <Text fontSize="xs" mt="2">
                                  <Trans
                                    i18nKey="hostsDialog.host.wildcard"
                                    components={{
                                      badge: <Badge />,
                                    }}
                                  />
                                </Text>
                                <Text fontSize="xs">
                                  <Trans
                                    i18nKey="hostsDialog.host.multiHost"
                                    components={{
                                      badge: <Badge />,
                                    }}
                                  />
                                </Text>
                              </PopoverContent>
                            </Portal>
                          </Popover>
                        </FormLabel>
                        <Input
                          size="sm"
                          borderRadius="4px"
                          placeholder="SNI (e.g. example.com)"
                          {...form.register(hostKey + "." + index + ".sni")}
                        />
                        {accordionErrors && accordionErrors[index]?.sni && (
                          <Error>{accordionErrors[index]?.sni?.message}</Error>
                        )}
                      </FormControl>
                      <FormControl
                        isInvalid={
                          !!(accordionErrors && accordionErrors[index]?.host)
                        }
                      >
                        <FormLabel
                          display="flex"
                          pb={1}
                          alignItems="center"
                          gap={1}
                          justifyContent="space-between"
                          m="0"
                        >
                          <span>{t("hostsDialog.host")}</span>

                          <Popover isLazy placement="right">
                            <PopoverTrigger>
                              <InfoIcon />
                            </PopoverTrigger>
                            <Portal>
                              <PopoverContent p={2}>
                                <PopoverArrow />
                                <PopoverCloseButton />
                                <Text fontSize="xs" pr={5}>
                                  {t("hostsDialog.host.info")}
                                </Text>
                                <Text fontSize="xs" mt="2">
                                  <Trans
                                    i18nKey="hostsDialog.host.wildcard"
                                    components={{
                                      badge: <Badge />,
                                    }}
                                  />
                                </Text>
                                <Text fontSize="xs">
                                  <Trans
                                    i18nKey="hostsDialog.host.multiHost"
                                    components={{
                                      badge: <Badge />,
                                    }}
                                  />
                                </Text>
                              </PopoverContent>
                            </Portal>
                          </Popover>
                        </FormLabel>
                        <Input
                          size="sm"
                          borderRadius="4px"
                          placeholder="Host (e.g. example.com)"
                          {...form.register(hostKey + "." + index + ".host")}
                        />
                        {accordionErrors && accordionErrors[index]?.host && (
                          <Error>{accordionErrors[index]?.host?.message}</Error>
                        )}
                      </FormControl>
                      <FormControl height="66px">
                        <FormLabel
                          display="flex"
                          pb={1}
                          alignItems="center"
                          gap={1}
                          justifyContent="space-between"
                          m="0"
                        >
                          <span>{t("hostsDialog.security")}</span>

                          <Popover isLazy placement="right">
                            <PopoverTrigger>
                              <InfoIcon />
                            </PopoverTrigger>
                            <Portal>
                              <PopoverContent p={2}>
                                <PopoverArrow />
                                <PopoverCloseButton />
                                <Text fontSize="xs" pr={5}>
                                  {t("hostsDialog.security.info")}
                                </Text>
                              </PopoverContent>
                            </Portal>
                          </Popover>
                        </FormLabel>
                        <Select
                          size="sm"
                          {...form.register(
                            hostKey + "." + index + ".security"
                          )}
                        >
                          {proxyHostSecurity.map((s) => {
                            return (
                              <option key={s.value} value={s.value}>
                                {s.title}
                              </option>
                            );
                          })}
                        </Select>
                      </FormControl>

                      <FormControl height="66px">
                        <FormLabel
                          display="flex"
                          pb={1}
                          alignItems="center"
                          gap={1}
                          justifyContent="space-between"
                          m="0"
                        >
                          <span>{t("hostsDialog.alpn")}</span>
                        </FormLabel>
                        <Select
                          size="sm"
                          {...form.register(hostKey + "." + index + ".alpn")}
                        >
                          {proxyALPN.map((s) => {
                            return (
                              <option key={s.value} value={s.value}>
                                {s.title}
                              </option>
                            );
                          })}
                        </Select>
                      </FormControl>

                      <FormControl height="66px">
                        <FormLabel
                          display="flex"
                          pb={1}
                          alignItems="center"
                          gap={1}
                          justifyContent="space-between"
                          m="0"
                        >
                          <span>{t("hostsDialog.fingerprint")}</span>
                        </FormLabel>
                        <Select
                          size="sm"
                          {...form.register(
                            hostKey + "." + index + ".fingerprint"
                          )}
                        >
                          {proxyFingerprint.map((s) => {
                            return (
                              <option key={s.value} value={s.value}>
                                {s.title}
                              </option>
                            );
                          })}
                        </Select>
                      </FormControl>
                    </VStack>
                  </AccordionPanel>
                </AccordionItem>
              </Accordion>
            </VStack>
          ))}
          <Button
            variant="outline"
            w="full"
            size="sm"
            color=""
            fontWeight={"normal"}
            onClick={handleAddHost}
          >
            {t("hostsDialog.addHost")}
          </Button>
        </VStack>
      </AccordionPanel>
    </AccordionItem>
  );
};

export const HostsDialog: FC = () => {
  const { isEditingHosts, onEditingHosts, refetchUsers, inbounds } =
    useDashboard();
  const { isLoading, hosts, fetchHosts, isPostLoading, setHosts } = useHosts();
  const toast = useToast();
  const { t } = useTranslation();
  const [openAccordions, setOpenAccordions] = useState<any>({});

  useEffect(() => {
    if (isEditingHosts) fetchHosts();
  }, [isEditingHosts]);
  const form = useForm<z.infer<typeof hostsSchema>>({
    resolver: zodResolver(hostsSchema),
  });

  useEffect(() => {
    if (hosts && isEditingHosts) {
      form.reset(hosts);
    }
  }, [hosts]);

  const onClose = () => {
    setOpenAccordions({});
    onEditingHosts(false);
  };
  const handleFormSubmit = (hosts: z.infer<typeof hostsSchema>) => {
    setHosts(hosts)
      .then(() => {
        toast({
          title: t("hostsDialog.savedSuccess"),
          status: "success",
          isClosable: true,
          position: "top",
          duration: 3000,
        });
        refetchUsers();
      })
      .catch((err) => {
        if (err?.response?.status === 409 || err?.response?.status === 400) {
          toast({
            title: err.response?._data?.detail,
            status: "error",
            isClosable: true,
            position: "top",
            duration: 3000,
          });
        }
        if (err?.response?.status === 422) {
          Object.keys(err.response._data.detail).forEach((key) => {
            toast({
              title: err.response._data.detail[key] + " (" + key + ")",
              status: "error",
              isClosable: true,
              position: "top",
              duration: 3000,
            });
          });
        }
      });
  };

  const toggleAccordion = (index: number) => {
    if (openAccordions[String(index)]) {
      delete openAccordions[String(index)];
    } else openAccordions[String(index)] = {};

    setOpenAccordions({ ...openAccordions });
  };

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
          <FormProvider {...form}>
            <form onSubmit={form.handleSubmit(handleFormSubmit)}>
              <Text mb={3} opacity={0.8} fontSize="sm">
                {t("hostsDialog.title")}
              </Text>
              {isLoading && t("hostsDialog.loading")}
              {!isLoading &&
                hosts &&
                (Object.keys(hosts).length > 0 ? (
                  <Accordion
                    w="full"
                    allowToggle
                    allowMultiple
                    index={Object.keys(openAccordions).map((i) => parseInt(i))}
                  >
                    <VStack w="full">
                      {Object.keys(hosts).map((hostKey, index) => {
                        return (
                          <AccordionInbound
                            toggleAccordion={() => toggleAccordion(index)}
                            isOpen={openAccordions[String(index)]}
                            key={hostKey}
                            hostKey={hostKey}
                          />
                        );
                      })}
                    </VStack>
                  </Accordion>
                ) : (
                  "No inbound found. Please check your Xray config file."
                ))}

              <HStack justifyContent="flex-end" py={2}>
                <Button
                  variant="solid"
                  mt="2"
                  type="submit"
                  colorScheme="primary"
                  size="sm"
                  px={5}
                  isLoading={isPostLoading}
                  disabled={isPostLoading}
                >
                  {t("hostsDialog.apply")}
                </Button>
              </HStack>
            </form>
          </FormProvider>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};
