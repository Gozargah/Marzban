import { useDashboard, useHosts } from "../contexts/DashboardContext";
import { FC, useEffect, useState } from "react";
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
  Checkbox,
  FormControl,
  FormErrorMessage,
  FormLabel,
  HStack,
  IconButton,
  Input,
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
  Select,
  Text,
  Textarea,
  Tooltip,
  useToast,
  VStack,
} from "@chakra-ui/react";
import { Input as CustomInput } from "./Input";
import { Icon } from "./Icon";
import {
  LinkIcon,
  InformationCircleIcon,
  PlusIcon as HeroIconPlusIcon,
  SquaresPlusIcon,
} from "@heroicons/react/24/outline";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import {
  FormProvider,
  useFieldArray,
  useForm,
  useFormContext,
} from "react-hook-form";
import { DeleteIcon } from "./DeleteUserModal";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { proxyHostSecurity } from "constants/Proxies";

const ModalIcon = chakra(SquaresPlusIcon, {
  baseStyle: {
    w: 5,
    h: 5,
  },
});

const PlusIcon = chakra(HeroIconPlusIcon, {
  baseStyle: {
    w: 5,
    h: 5,
    strokeWidth: 2,
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

type AddNodeFormType = {
  toggleAccordion: () => void;
};
const AddNodeForm: FC<AddNodeFormType> = ({ toggleAccordion }) => {
  const form = useForm();
  const handleAddNode = () => {};
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
          display="flex"
          gap={1}
        >
          <PlusIcon display={"inline-block"} />{" "}
          <span>Add New Marzban Node</span>
        </Text>
      </AccordionButton>
      <AccordionPanel px={2} py={4}>
        <form onSubmit={handleAddNode}>
          <VStack>
            <FormControl>
              <CustomInput label="Name" size="sm" placeholder="Marzban-S2" />
            </FormControl>
            <HStack alignItems="flex-start">
              <FormControl w="50%">
                <CustomInput
                  label="Address"
                  size="sm"
                  placeholder="51.20.12.13"
                />
              </FormControl>
              <FormControl w="25%">
                <CustomInput label="Port" size="sm" placeholder="62050" />
              </FormControl>
              <FormControl w="25%">
                <CustomInput label="API Port" size="sm" placeholder="62051" />
              </FormControl>
            </HStack>
            <FormControl>
              <FormLabel>Certificate</FormLabel>
              <Textarea
                w="full"
                fontSize="10px"
                fontFamily="monospace"
                overflowWrap="normal"
                noOfLines={10}
                rows={10}
                placeholder="-----BEGIN CERTIFICATE-----
							XzBWUjjMrWf/0rWV5fDl7b4RU8AjeviG1RmEc64ueZ3s6q1LI6DJX1+qGuqDEvp
							g1gctfdLMARuV6LkLiGy5k2FGAW/tfepEyySA/N9WhcHg+rZ4/x1thP0eYJPQ2YJ
							XFSa6Zv8LPLCz5iMbo0FjNlKyZo3699PtyBFXt3zyfTPmiy19RVGTziHqJ9NR9kW
							kBwvFzIy+qPc/dJAk435hVaV3pRBC7Pl2Y7k/pJxxlC07PkACXuhwtUGhQrHYWkK
							Il8rJ9cs0zwC1BOmqoS3Ez22dgtT7FucvIJ1MGP8oUAudMmrXDxx/d7CmnD5q1v4
							iLlV21kNnWuvjS1orTwvuW3aagb6tvEEEmlMhw5a2B8sl71sQ6sxWidgRaOSGW7l
							emFyZ2FoMIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEA0BvDh0eU78EJ
							AjimHyBb+3tFs7KaOPu9G5xgbQWUWccukMDXqybqiUDSfU/T5/+XM8CKq/Fu0DB=&#10;-----END CERTIFICATE-----"
              />
            </FormControl>
            <FormControl py={1}>
              <Checkbox>
                <FormLabel m={0}>
                  Add this node as a new host for every inbound
                </FormLabel>
              </Checkbox>
            </FormControl>
            <Button
              variant="solid"
              type="submit"
              colorScheme="primary"
              size="sm"
              px={5}
              w="full"
            >
              Add Node
            </Button>
          </VStack>
        </form>
      </AccordionPanel>
    </AccordionItem>
  );
};

export const NodesDialog: FC = () => {
  const { isEditingNodes, onEditingNodes, refetchUsers } = useDashboard();
  const { isLoading, hosts, fetchHosts, isPostLoading, setHosts } = useHosts();
  const toast = useToast();
  const [openAccordions, setOpenAccordions] = useState<any>({});

  useEffect(() => {
    if (isEditingNodes) fetchHosts();
  }, [isEditingNodes]);
  const form = useForm<z.infer<typeof hostsSchema>>({
    resolver: zodResolver(hostsSchema),
  });

  useEffect(() => {
    if (hosts && isEditingNodes) {
      form.reset(hosts);
    }
  }, [hosts]);

  const onClose = () => {
    setOpenAccordions({});
    onEditingNodes(false);
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

  const toggleAccordion = (index: number | string) => {
    if (openAccordions[String(index)]) {
      delete openAccordions[String(index)];
    } else openAccordions[String(index)] = {};

    setOpenAccordions({ ...openAccordions });
  };

  return (
    <Modal isOpen={isEditingNodes} onClose={onClose}>
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
                Using Marzban-Node, you are able to scale up your connection
                quality by adding different nodes on different servers.
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
                      <AddNodeForm
                        toggleAccordion={() =>
                          toggleAccordion(Object.keys(hosts).length)
                        }
                      />
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