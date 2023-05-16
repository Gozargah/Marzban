import {
  Accordion,
  AccordionButton,
  AccordionItem,
  AccordionPanel,
  Badge,
  Box,
  chakra,
  Checkbox,
  FormControl,
  HStack,
  IconButton,
  Input,
  Select,
  SimpleGrid,
  Text,
  useCheckbox,
  useCheckboxGroup,
  UseRadioProps,
  VStack,
} from "@chakra-ui/react";
import { EllipsisVerticalIcon } from "@heroicons/react/24/outline";
import { shadowsocksMethods, XTLSFlows } from "constants/Proxies";
import {
  InboundType,
  ProtocolType,
  useDashboard,
} from "contexts/DashboardContext";
import { t } from "i18next";
import { FC, forwardRef, PropsWithChildren, useState } from "react";
import {
  ControllerRenderProps,
  useFormContext,
  useWatch,
} from "react-hook-form";

const SettingsIcon = chakra(EllipsisVerticalIcon, {
  baseStyle: {
    strokeWidth: "2px",
    w: 5,
    h: 5,
  },
});

const InboundCard: FC<
  PropsWithChildren<UseRadioProps & { inbound: InboundType }>
> = ({ inbound, ...props }) => {
  const { getCheckboxProps, getInputProps, getLabelProps, htmlProps } =
    useCheckbox(props);
  const inputProps = getInputProps();
  return (
    <Box as="label">
      <input {...inputProps} />
      <Box
        w="fll"
        position="relative"
        {...htmlProps}
        cursor="pointer"
        borderRadius="sm"
        border="1px solid"
        borderColor={"gray.200"}
        _dark={{
          borderColor: "gray.600",
        }}
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        overflow="hidden"
        _checked={{
          bg: "gray.50",
          outline: "2px",
          boxShadow: "outline",
          outlineColor: "primary.500",
          borderColor: "transparent",
          fontWeight: "medium",
          _dark: {
            bg: "gray.750",
            borderColor: "transparent",
          },
          "& p": {
            opacity: 1,
          },
        }}
        __css={{
          "& p": {
            opacity: 0.8,
          },
        }}
        textTransform="capitalize"
        px={3}
        py={2}
        fontWeight="medium"
        {...getCheckboxProps()}
      >
        <Checkbox
          size="sm"
          w="full"
          maxW="full"
          color="gray.700"
          _dark={{ color: "gray.300" }}
          textTransform="uppercase"
          colorScheme="primary"
          className="inbound-item"
          isChecked={inputProps.checked}
          pointerEvents="none"
          flexGrow={1}
        >
          <HStack
            justify="space-between"
            w="full"
            maxW="calc(100% - 20px)"
            spacing={0}
            gap={2}
            overflow="hidden"
          >
            <Text isTruncated {...getLabelProps()} fontSize="xs">
              {inbound.tag} <Text as="span">({inbound.network})</Text>
            </Text>
          </HStack>
        </Checkbox>
        {inbound.tls && inbound.tls != "none" && (
          <Badge fontSize="xs" opacity=".8" size="xs">
            {inbound.tls}
          </Badge>
        )}
      </Box>
    </Box>
  );
};

const RadioCard: FC<
  PropsWithChildren<
    UseRadioProps & {
      disabled?: boolean;
      title: string;
      description: string;
      toggleAccordion: () => void;
      isSelected: boolean;
    }
  >
> = ({
  disabled,
  title,
  description,
  toggleAccordion,
  isSelected,
  ...props
}) => {
  const form = useFormContext();
  const { inbounds } = useDashboard();
  const { getCheckboxProps, getInputProps, getLabelProps, htmlProps } =
    useCheckbox(props);

  const inputProps = getInputProps();

  const [inBoundDefaultValue] = useWatch({
    name: [`inbounds.${title}`],
    control: form.control,
  });

  const { getCheckboxProps: getInboundCheckboxProps } = useCheckboxGroup({
    value: inBoundDefaultValue,
    onChange: (selectedInbounds) => {
      form.setValue(`inbounds.${title}`, selectedInbounds);
      if (selectedInbounds.length === 0) {
        const selected_proxies = form.getValues("selected_proxies");
        form.setValue(
          `selected_proxies`,
          selected_proxies.filter((p: string) => p !== title)
        );
        toggleAccordion();
      }
    },
  });

  const isPartialSelected =
    inBoundDefaultValue &&
    isSelected &&
    (useDashboard.getState().inbounds.get(title as ProtocolType) || [])
      .length !== inBoundDefaultValue.length;

  const protocolHasInbound =
    (useDashboard.getState().inbounds.get(title as ProtocolType) || []).length >
    0;

  const shouldBeDisabled = !isSelected && !protocolHasInbound;

  return (
    <AccordionItem
      isDisabled={!protocolHasInbound}
      borderRadius="md"
      borderStyle="solid"
      border="1px"
      borderColor="gray.200"
      bg={shouldBeDisabled ? "gray.100" : "transparent"}
      _dark={{
        borderColor: "gray.600",
        bg: shouldBeDisabled ? "#364154" : "transparent",
      }}
      _checked={{
        bg: "gray.50",
        outline: "2px",
        boxShadow: "outline",
        outlineColor: "primary.500",
        borderColor: "transparent",
      }}
      {...getCheckboxProps()}
    >
      <Box as={shouldBeDisabled ? "span" : "label"} position="relative">
        {isPartialSelected && (
          <Box
            position="absolute"
            w="2"
            h="2"
            bg="yellow.500"
            top="-1"
            right="-1"
            rounded="full"
            zIndex={999}
          />
        )}
        <input {...inputProps} />
        <Box
          w="fll"
          position="relative"
          {...htmlProps}
          borderRadius="md"
          cursor={shouldBeDisabled ? "not-allowed" : "pointer"}
          _checked={{
            fontWeight: "medium",
            _dark: {
              bg: "gray.750",
              borderColor: "transparent",
            },
            "& > svg": {
              opacity: 1,
              "&.checked": {
                display: "block",
              },
              "&.unchecked": {
                display: "none",
              },
            },
            "& p": {
              opacity: 1,
            },
          }}
          __css={{
            "& > svg": {
              opacity: 0.3,
              "&.checked": {
                display: "none",
              },
              "&.unchecked": {
                display: "block",
              },
            },
            "& p": {
              opacity: 0.8,
            },
          }}
          textTransform="capitalize"
          px={3}
          py={2}
          fontWeight="medium"
          {...getCheckboxProps()}
        >
          <AccordionButton
            display={
              inputProps.checked && protocolHasInbound ? "block" : "none"
            }
            as="span"
            className="checked"
            color="primary.200"
            position="absolute"
            right="3"
            top="3"
            w="auto"
            p={0}
            onClick={toggleAccordion}
          >
            <IconButton size="sm" aria-label="inbound settings">
              <SettingsIcon />
            </IconButton>
          </AccordionButton>

          <Text
            fontSize="sm"
            color={shouldBeDisabled ? "gray.400" : "gray.700"}
            _dark={{ color: shouldBeDisabled ? "gray.500" : "gray.300" }}
            {...getLabelProps()}
          >
            {title}
          </Text>
          <Text
            fontWeight="medium"
            color={shouldBeDisabled ? "gray.400" : "gray.600"}
            _dark={{ color: shouldBeDisabled ? "gray.500" : "gray.400" }}
            fontSize="xs"
          >
            {description}
          </Text>
        </Box>
      </Box>
      <AccordionPanel
        px={2}
        pb={3}
        roundedBottom="5px"
        pt={3}
        _dark={{ bg: inputProps.checked && "gray.750" }}
      >
        <VStack
          w="full"
          rowGap={2}
          borderStyle="solid"
          borderWidth="1px"
          borderRadius="md"
          pl={3}
          pr={3}
          pt={1.5}
          _dark={{ bg: "gray.700" }}
        >
          <VStack alignItems="flex-start" w="full">
            <Text fontSize="sm">{t("inbound")}</Text>
            <SimpleGrid
              gap={2}
              alignItems="flex-start"
              w="full"
              columns={1}
              spacing={1}
            >
              {(
                (inbounds.get(title as ProtocolType) as InboundType[]) || []
              ).map((inbound) => {
                return (
                  <InboundCard
                    key={inbound.tag}
                    {...getInboundCheckboxProps({ value: inbound.tag })}
                    inbound={inbound}
                  />
                );
              })}
            </SimpleGrid>
          </VStack>
          {title === "vmess" && isSelected && (
            <VStack alignItems="flex-start" w="full">
              <FormControl height="66px">
                <Text fontSize="sm" pb={1}>
                  ID
                </Text>
                <Input
                  fontSize="xs"
                  size="sm"
                  borderRadius="6px"
                  pl={2}
                  pr={2}
                  placeholder={t("userDialog.generatedByDefault")}
                  {...form.register("proxies.vmess.id")}
                />
              </FormControl>
            </VStack>
          )}
          {title === "vless" && isSelected && (
            <VStack alignItems="flex-start" w="full">
              <FormControl height="66px">
                <Text fontSize="sm" pb={1}>
                  ID
                </Text>
                <Input
                  fontSize="xs"
                  size="sm"
                  borderRadius="6px"
                  pl={2}
                  pr={2}
                  placeholder={t("userDialog.generatedByDefault")}
                  {...form.register("proxies.vless.id")}
                />
              </FormControl>
              <FormControl height="66px">
                <Text fontSize="sm" pb={1}>
                  Flow
                </Text>
                <Select
                  fontSize="xs"
                  size="sm"
                  borderRadius="6px"
                  {...form.register("proxies.vless.flow")}
                >
                  {XTLSFlows.map((entry) => (
                    <option key={entry.title} value={entry.value}>
                      {entry.title}
                    </option>
                  ))}
                </Select>
              </FormControl>
            </VStack>
          )}
          {title === "trojan" && isSelected && (
            <VStack alignItems="flex-start" w="full">
              <FormControl height="66px">
                <Text fontSize="sm" pb={1}>
                  {t("password")}
                </Text>
                <Input
                  fontSize="xs"
                  size="sm"
                  borderRadius="6px"
                  pl={2}
                  pr={2}
                  placeholder={t("userDialog.generatedByDefault")}
                  {...form.register("proxies.trojan.password")}
                />
              </FormControl>
            </VStack>
          )}
          {title === "shadowsocks" && isSelected && (
            <VStack alignItems="flex-start" w="full">
              <FormControl height="66px">
                <Text fontSize="sm" pb={1}>
                  {t("password")}
                </Text>
                <Input
                  fontSize="xs"
                  size="sm"
                  borderRadius="6px"
                  pl={2}
                  pr={2}
                  placeholder={t("userDialog.generatedByDefault")}
                  {...form.register("proxies.shadowsocks.password")}
                />
              </FormControl>
              <FormControl height="66px">
                <Text fontSize="sm" pb={1}>
                  {t("userDialog.method")}
                </Text>
                <Select
                  fontSize="xs"
                  size="sm"
                  borderRadius="6px"
                  {...form.register("proxies.shadowsocks.method")}
                >
                  {shadowsocksMethods.map((method) => (
                    <option key={method} value={method}>
                      {method}
                    </option>
                  ))}
                </Select>
              </FormControl>
            </VStack>
          )}
        </VStack>
      </AccordionPanel>
    </AccordionItem>
  );
};

export type RadioListType = {
  title: string;
  description: string;
};

export type RadioGroupProps = ControllerRenderProps & {
  list: RadioListType[];
  disabled?: boolean;
};

export const RadioGroup = forwardRef<any, RadioGroupProps>(
  ({ name, list, onChange, disabled, ...props }, ref) => {
    const form = useFormContext();
    const [expandedAccordions, setExpandedAccordions] = useState<number[]>([]);

    const toggleAccordion = (i: number) => {
      if (expandedAccordions.includes(i))
        expandedAccordions.splice(expandedAccordions.indexOf(i), 1);
      else expandedAccordions.push(i);
      setExpandedAccordions([...expandedAccordions]);
    };

    const { getCheckboxProps } = useCheckboxGroup({
      value: props.value,
      onChange: (value) => {
        // active all inbounds when a proxy selected
        const selectedItem = value.filter((el) => !props.value.includes(el));
        if (selectedItem[0]) {
          form.setValue(
            `inbounds.${selectedItem[0]}`,
            useDashboard
              .getState()
              .inbounds.get(selectedItem[0] as ProtocolType)
              ?.map((i) => i.tag)
          );
        }

        setExpandedAccordions(
          expandedAccordions.filter((i) => {
            return value.find((title) => title === list[i].title);
          })
        );

        onChange({
          target: {
            value,
            name,
          },
        });
      },
    });

    return (
      <Accordion allowToggle index={expandedAccordions}>
        <SimpleGrid
          ref={ref}
          gap={2}
          alignItems="flex-start"
          columns={1}
          spacing={1}
        >
          {list.map((value, index) => {
            return (
              <RadioCard
                toggleAccordion={toggleAccordion.bind(null, index)}
                disabled={disabled}
                key={value.title}
                title={value.title}
                description={value.description}
                isSelected={
                  !!(props.value as string[]).find((v) => v === value.title)
                }
                {...getCheckboxProps({ value: value.title })}
              />
            );
          })}
        </SimpleGrid>
      </Accordion>
    );
  }
);
