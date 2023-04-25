import {
  chakra,
  FormControl,
  FormErrorMessage,
  FormLabel,
  InputGroup,
  InputLeftAddon,
  InputRightAddon,
  InputRightElement,
  Textarea as ChakraTextarea,
  TextareaProps as ChakraTextareaProps,
} from "@chakra-ui/react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import classNames from "classnames";
import React, { PropsWithChildren, ReactNode } from "react";

const ClearIcon = chakra(XMarkIcon, {
  baseStyle: {
    w: 4,
    h: 4,
  },
});

export type TextareaProps = PropsWithChildren<
  {
    value?: string;
    className?: string;
    endAdornment?: ReactNode;
    startAdornment?: ReactNode;
    type?: string;
    placeholder?: string;
    onChange?: (e: any) => void;
    onBlur?: (e: any) => void;
    onClick?: (e: any) => void;
    name?: string;
    error?: string;
    disabled?: boolean;
    step?: number;
    label?: string;
    clearable?: boolean;
  } & ChakraTextareaProps
>;

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      disabled,
      step,
      label,
      className,
      startAdornment,
      endAdornment,
      placeholder,
      onChange,
      onBlur,
      name,
      value,
      onClick,
      error,
      clearable = false,
      ...props
    },
    ref
  ) => {
    const clear = () => {
      if (onChange)
        onChange({
          target: {
            value: "",
            name,
          },
        });
    };
    const { size = "md" } = props;

    return (
      <FormControl isInvalid={!!error}>
        {label && <FormLabel>{label}</FormLabel>}
        <InputGroup
          size={size}
          w="full"
          rounded="md"
          _focusWithin={{
            outline: "2px solid",
            outlineColor: "primary.200",
          }}
          bg={disabled ? "gray.100" : "transparent"}
          _dark={{ bg: disabled ? "gray.600" : "transparent" }}
        >
          {startAdornment && <InputLeftAddon>{startAdornment}</InputLeftAddon>}
          {/* @ts-ignore */}
          <ChakraTextarea
            name={name}
            ref={ref}
            step={step}
            className={classNames(className)}
            placeholder={placeholder}
            onChange={onChange}
            onBlur={onBlur}
            value={value}
            onClick={onClick}
            disabled={disabled}
            flexGrow={1}
            _focusVisible={{
              outline: "none",
              borderTopColor: "transparent",
              borderRightColor: "transparent",
              borderBottomColor: "transparent",
            }}
            _disabled={{
              cursor: "not-allowed",
            }}
            {...props}
            roundedLeft={startAdornment ? "0" : "md"}
            roundedRight={endAdornment ? "0" : "md"}
          />
          {endAdornment && (
            <InputRightAddon
              borderLeftRadius={0}
              borderRightRadius="6px"
              bg="transparent"
            >
              {endAdornment}
            </InputRightAddon>
          )}
          {clearable && value && value.length && (
            <InputRightElement
              borderLeftRadius={0}
              borderRightRadius="6px"
              bg="transparent"
              onClick={clear}
              cursor="pointer"
            >
              <ClearIcon />
            </InputRightElement>
          )}
        </InputGroup>
        {!!error && <FormErrorMessage>{error}</FormErrorMessage>}
      </FormControl>
    );
  }
);
