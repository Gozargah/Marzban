import {
  Accordion,
  AccordionButton,
  AccordionItem,
  AccordionPanel,
  Badge,
  Box,
  chakra,
  Checkbox,
  HStack,
  IconButton,
  Kbd,
  SimpleGrid,
  Text,
  useCheckbox,
  useCheckboxGroup,
  UseRadioProps,
} from "@chakra-ui/react";
import {
  CheckCircleIcon,
  Cog6ToothIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import {
  InboundType,
  ProtocolType,
  useDashboard,
} from "contexts/DashboardContext";
import { FC, forwardRef, PropsWithChildren, useEffect, useState } from "react";
import {
  ControllerRenderProps,
  useFormContext,
  useWatch,
} from "react-hook-form";

const CheckedIcon = chakra(CheckCircleIcon, {
  baseStyle: {
    strokeWidth: "2px",
    w: 4,
    h: 4,
  },
});

const UnCheckedIcon = chakra(XCircleIcon, {
  baseStyle: {
    strokeWidth: "2px",
    w: 4,
    h: 4,
  },
});

const SettingsIcon = chakra(Cog6ToothIcon, {
  baseStyle: {
    strokeWidth: "2px",
    w: 4,
    h: 4,
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
              {inbound.tag}
              {' '}
              <Text as="span">({inbound.network})</Text>
            </Text>
            {inbound.tls && (
              <Badge fontSize="xs" opacity=".8" size="xs">
                TLS
              </Badge>
            )}
          </HStack>
        </Checkbox>
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
        const proxies = form.getValues("proxies");
        form.setValue(
          `proxies`,
          proxies.filter((p: string) => p !== title)
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

  console.log(title, inBoundDefaultValue);
  return (
    <AccordionItem border={0}>
      <Box as="label" position="relative">
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
          cursor="pointer"
          borderRadius="md"
          border="1px solid"
          borderColor={"gray.200"}
          _dark={{
            borderColor: "gray.600",
          }}
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
          <CheckedIcon
            className="checked"
            color="primary.200"
            position="absolute"
            right="3"
            top="2"
          />
          <UnCheckedIcon
            className="unchecked"
            color="primary.200"
            position="absolute"
            right="3"
            top="2"
          />

          <AccordionButton
            display={inputProps.checked ? "block" : "none"}
            as="span"
            className="checked"
            color="primary.200"
            position="absolute"
            right="3"
            bottom="2"
            w="auto"
            p={0}
            onClick={toggleAccordion}
          >
            <IconButton size="sx" aria-label="inbound settings">
              <SettingsIcon />
            </IconButton>
          </AccordionButton>

          <Text
            fontSize="sm"
            color="gray.700"
            _dark={{ color: "gray.300" }}
            {...getLabelProps()}
          >
            {title}
          </Text>
          <Text
            fontWeight="medium"
            color="gray.600"
            _dark={{ color: "gray.400" }}
            fontSize="xs"
          >
            {description}
          </Text>
        </Box>
      </Box>
      <AccordionPanel
        px={2}
        pb={3}
        borderWidth="1px"
        borderColor="gray.600"
        borderStyle="solid"
        roundedBottom="5px"
        borderTop={0}
        pt={3}
      >
        <SimpleGrid gap={2} alignItems="flex-start" columns={1} spacing={1}>
          {((inbounds.get(title as ProtocolType) as InboundType[]) || []).map(
            (inbound) => {
              return (
                <InboundCard
                  key={inbound.tag}
                  {...getInboundCheckboxProps({ value: inbound.tag })}
                  inbound={inbound}
                />
              );
            }
          )}
        </SimpleGrid>
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
