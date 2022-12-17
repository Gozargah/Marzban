import {
  Box,
  HStack,
  useRadio,
  useRadioGroup,
  UseRadioProps,
} from "@chakra-ui/react";
import { FC, forwardRef, PropsWithChildren } from "react";
import { ControllerRenderProps } from "react-hook-form";

const RadioCard: FC<
  PropsWithChildren<UseRadioProps & { disabled?: boolean }>
> = ({ disabled, ...props }) => {
  const { getInputProps, getCheckboxProps } = useRadio(props);

  const input = getInputProps();
  const checkbox = getCheckboxProps();

  return (
    <Box as="label">
      <input {...input} />
      <Box
        {...checkbox}
        cursor="pointer"
        borderRadius="md"
        color={!disabled ? "gray.600" : "gray.500"}
        _dark={{
          color: !disabled ? "gray.400" : "gray.400",
        }}
        _checked={{
          bg: !disabled ? "blue.500" : "blue.300",
          color: "white",
          fontWeight: "medium",
          _dark: {
            bg: !disabled ? "blue.500" : "blue.200",
            color: !disabled ? "white" : "blackAlpha.500",
          },
        }}
        textTransform="capitalize"
        px={2}
        py={1}
        fontSize="sm"
      >
        {props.children}
      </Box>
    </Box>
  );
};

export type RadioGroupProps = {
  list: string[];
  disabled?: boolean;
} & ControllerRenderProps;

export const RadioGroup = forwardRef<any, RadioGroupProps>(
  ({ name, list, onChange, disabled, ...props }, ref) => {
    const { getRootProps, getRadioProps } = useRadioGroup({
      name,
      defaultValue: list[0],
      onChange,
    });

    const group = getRootProps();

    return (
      <HStack
        {...group}
        bg={disabled ? "gray.100" : "transparent"}
        _dark={{
          bg: disabled ? "gray.700" : "transparent",
          borderColor: "whiteAlpha.300",
        }}
        border="1px solid"
        borderColor="gray.200"
        overflow="hidden"
        rounded="md"
        p="1"
        ref={ref}
        experimental_spaceX={1}
      >
        {list.map((value) => {
          const radio = getRadioProps({ value });
          return (
            <RadioCard disabled={disabled} key={value} {...radio}>
              {value}
            </RadioCard>
          );
        })}
      </HStack>
    );
  }
);
