import {
  Box,
  chakra,
  HStack,
  SimpleGrid,
  Text,
  useCheckbox,
  useCheckboxGroup,
  useRadio,
  useRadioGroup,
  UseRadioProps,
  VStack,
} from "@chakra-ui/react";
import { CheckCircleIcon, XCircleIcon } from "@heroicons/react/24/outline";
import { FC, forwardRef, PropsWithChildren } from "react";
import { ControllerRenderProps } from "react-hook-form";

const CheckedIcon = chakra(CheckCircleIcon, {
  baseStyle: {
    strokeWidth: "2px",
    w: 5,
    h: 5,
  },
});

const UnCheckedIcon = chakra(XCircleIcon, {
  baseStyle: {
    strokeWidth: "2px",
    w: 5,
    h: 5,
  },
});

const RadioCard: FC<
  PropsWithChildren<
    UseRadioProps & { disabled?: boolean; title: string; description: string }
  >
> = ({ disabled, title, description, ...props }) => {
  const { getCheckboxProps, getInputProps, getLabelProps, htmlProps } =
    useCheckbox(props);

  return (
    <Box as="label">
      <input {...getInputProps()} />
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
          top="3"
        />
        <UnCheckedIcon
          className="unchecked"
          color="primary.200"
          position="absolute"
          right="3"
          top="3"
        />
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
  );
};

export type RadioListType = {
  title: string;
  description: string;
};

export type RadioGroupProps = {
  list: RadioListType[];
  disabled?: boolean;
} & ControllerRenderProps;

export const RadioGroup = forwardRef<any, RadioGroupProps>(
  ({ name, list, onChange, disabled, ...props }, ref) => {
    const { getCheckboxProps } = useCheckboxGroup({
      defaultValue: props.value,
      onChange: (value) => {
        onChange({
          target: {
            value,
            name,
          },
        });
      },
    });

    return (
      <SimpleGrid
        ref={ref}
        experimental_spaceY={1}
        alignItems="flex-start"
        columns={1}
        spacing={1}
      >
        {list.map((value) => {
          return (
            <RadioCard
              disabled={disabled}
              key={value.title}
              title={value.title}
              description={value.description}
              {...getCheckboxProps({ value: value.title })}
            />
          );
        })}
      </SimpleGrid>
    );
  }
);
