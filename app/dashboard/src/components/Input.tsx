import {
  FormControl,
  FormErrorMessage,
  FormLabel,
  Input as ChakraInput,
  InputGroup,
  InputLeftAddon,
  InputProps as ChakraInputProps,
  InputRightAddon,
  NumberDecrementStepper,
  NumberIncrementStepper,
  NumberInput,
  NumberInputField,
  NumberInputFieldProps,
  NumberInputStepper,
} from "@chakra-ui/react";
import classNames from "classnames";
import React, { PropsWithChildren, ReactNode } from "react";

export type InputProps = PropsWithChildren<
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
    step?: string;
    label?: string;
  } & ChakraInputProps &
    NumberInputFieldProps
>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      disabled,
      step,
      label,
      className,
      startAdornment,
      endAdornment,
      type = "text",
      placeholder,
      onChange,
      onBlur,
      name,
      value,
      onClick,
      error,
      ...props
    },
    ref
  ) => {
    const Component = type == "number" ? NumberInputField : ChakraInput;
    const Wrapper = type == "number" ? NumberInput : React.Fragment;
    const wrapperProps =
      type == "number"
        ? {
            name,
            type,
            placeholder,
            onChange: (v: any) => {
              if (onChange) onChange(v);
            },
            onBlur,
            value,
            onClick,
            disabled,
            flexGrow: 1,
          }
        : {};
    return (
      <FormControl isInvalid={!!error}>
        {label && <FormLabel>{label}</FormLabel>}
        <InputGroup
          w="full"
          rounded="md"
          _focusWithin={{
            outline: "2px solid",
            outlineColor: "blue.500",
          }}
        >
          {startAdornment && <InputLeftAddon>{startAdornment}</InputLeftAddon>}
          <Wrapper {...wrapperProps}>
            <Component
              name={name}
              ref={ref}
              step={step}
              className={classNames(className)}
              type={type}
              placeholder={placeholder}
              onChange={onChange}
              onBlur={onBlur}
              value={value}
              onClick={onClick}
              disabled={disabled}
              roundedLeft={startAdornment ? "0" : "md"}
              roundedRight={endAdornment ? "0" : "md"}
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
            />
            {type == "number" && (
              <>
                <NumberInputStepper>
                  <NumberIncrementStepper />
                  <NumberDecrementStepper />
                </NumberInputStepper>
              </>
            )}
          </Wrapper>
          {endAdornment && <InputRightAddon>{endAdornment}</InputRightAddon>}
        </InputGroup>
        {!!error && <FormErrorMessage>{error}</FormErrorMessage>}
      </FormControl>
    );
  }
);
