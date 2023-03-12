import { useDashboard, useHosts } from "../contexts/DashboardContext";
import { FC, useEffect, useRef, useState } from "react";
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
  Input,
  InputGroup,
  InputRightElement,
  Kbd,
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
  PopoverHeader,
  PopoverTrigger,
  Portal,
  Select,
  Text,
  Tooltip,
  useToast,
  VStack,
} from "@chakra-ui/react";
import { Icon } from "./Icon";
import { LinkIcon, InformationCircleIcon } from "@heroicons/react/24/outline";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import {
  Controller,
  FormProvider,
  useFieldArray,
  useForm,
  useFormContext,
} from "react-hook-form";
import { DeleteIcon } from "./DeleteUserModal";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { proxyHostSecurity } from "constants/ProxyHosts";
import { ProxyHostSecurity } from "types/ProxyHosts";

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
      sni: z.string(),
      host: z.string(),
      security: z.string(),
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
  const accordionErrors = errors[hostKey];
  const handleAddHost = () => {
    addHost({
      host: "",
      sni: "",
      port: null,
      address: "",
      remark: "",
      security: "inbound_default",
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
                                <Text pr="20px">
                                  Use these variables to make it dynamic
                                </Text>
                                <Text mt={1}>
                                  <Badge>
                                    {"{"}USERNAME{"}"}
                                  </Badge>{" "}
                                  the username of the user
                                </Text>
                                <Text mt={1}>
                                  <Badge>
                                    {"{"}DATA_USAGE{"}"}
                                  </Badge>{" "}
                                  The current usage of the user
                                </Text>
                                <Text mt={1}>
                                  <Badge>
                                    {"{"}DATA_LIMIT{"}"}
                                  </Badge>{" "}
                                  The usage limit of the user
                                </Text>
                                <Text mt={1}>
                                  <Badge>
                                    {"{"}DAYS_LEFT{"}"}
                                  </Badge>{" "}
                                  Remaining days of the user
                                </Text>
                                <Text mt={1}>
                                  <Badge>
                                    {"{"}PROTOCOL{"}"}
                                  </Badge>{" "}
                                  Proxy protocol (e.g. VMess)
                                </Text>
                                <Text mt={1}>
                                  <Badge>
                                    {"{"}TRANSPORT{"}"}
                                  </Badge>{" "}
                                  Proxy transport method (e.g. ws)
                                </Text>
                                <Text mt={1}>
                                  <Badge>
                                    {"{"}PROTOCOL{"}"}
                                  </Badge>{" "}
                                  Proxy protocol (e.g. VMess)
                                </Text>
                                <Text mt={1}>
                                  <Badge>
                                    {"{"}TRANSPORT{"}"}
                                  </Badge>{" "}
                                  Proxy transport method (e.g. ws)
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
              </HStack>
              <HStack alignItems="flex-start">
                <FormControl
                  w="70%"
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
                                <Text pr="20px">
                                  Use these variables to make it dynamic
                                </Text>
                                <Text>
                                  <Badge>
                                    {"{"}SERVER_IP{"}"}
                                  </Badge>{" "}
                                  Current server ip address
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
                <Input
                  w="30%"
                  size="sm"
                  borderRadius="4px"
                  placeholder="8080"
                  type="number"
                  {...form.register(hostKey + "." + index + ".port")}
                />
              </HStack>
              <FormControl
                isInvalid={!!(accordionErrors && accordionErrors[index]?.sni)}
              >
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
                isInvalid={!!(accordionErrors && accordionErrors[index]?.host)}
              >
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
                <FormLabel>Security</FormLabel>
                <Select
                  size="sm"
                  {...form.register(hostKey + "." + index + ".security")}
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
            Add host
          </Button>
        </VStack>
      </AccordionPanel>
    </AccordionItem>
  );
};

export const HostsDialog: FC = () => {
  const { isEditingHosts, onEditingHosts, refetchUsers } = useDashboard();
  const { isLoading, hosts, fetchHosts, isPostLoading, setHosts } = useHosts();
  const toast = useToast();
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
          title: `Hosts saved successfully`,
          status: "success",
          isClosable: true,
          position: "top",
          duration: 3000,
        });
        refetchUsers();
      })
      .catch((e) => {
        toast({
          title: e.response?._data?.detail,
          status: "error",
          isClosable: true,
          position: "top",
          duration: 3000,
        });
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
                Using this setting, you are able to assign specific address for
                each inbound.
              </Text>
              {isLoading && "loading..."}
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
                  Apply
                </Button>
              </HStack>
            </form>
          </FormProvider>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};
