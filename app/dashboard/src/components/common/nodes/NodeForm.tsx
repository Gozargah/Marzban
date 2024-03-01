import {
  Box,
  Button,
  ButtonProps,
  chakra,
  Checkbox,
  FormControl,
  FormLabel,
  HStack,
  Switch,
  Tooltip,
  VStack,
} from "@chakra-ui/react";
import { Input } from "components/elements/Input";
import { NodeType } from "contexts/NodesContext";
import { ReactNode } from "react";
import { Controller, UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";

interface Props {
  isLoading: boolean;
  addAsHost?: boolean;
  submitBtnText: string;
  btnLeftAdornment?: ReactNode;
  form: UseFormReturn<NodeType>;
  btnProps?: Partial<ButtonProps>;
  onSubmit: (data: NodeType) => void;
}

export function NodeForm({
  form,
  onSubmit,
  isLoading,
  addAsHost,
  submitBtnText,
  btnProps = {},
  btnLeftAdornment,
}: Props) {
  const { t } = useTranslation();

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <VStack>
        <HStack w="full">
          <FormControl>
            <CustomInput
              label={t("nodes.nodeName")}
              size="sm"
              placeholder="Marzban-S2"
              {...form.register("name")}
              error={form.formState?.errors?.name?.message}
            />
          </FormControl>
          {!addAsHost && (
            <HStack px={1}>
              <Controller
                name="status"
                control={form.control}
                render={({ field }) => (
                  <Tooltip
                    key={field.value}
                    placement="top"
                    label={`${t("usersTable.status")}: ` + (field.value !== "disabled" ? t("active") : t("disabled"))}
                    textTransform="capitalize"
                  >
                    <Box mt="6">
                      <Switch
                        colorScheme="primary"
                        isChecked={field.value !== "disabled"}
                        onChange={(e) => {
                          if (e.target.checked) {
                            field.onChange("connecting");
                          } else {
                            field.onChange("disabled");
                          }
                        }}
                      />
                    </Box>
                  </Tooltip>
                )}
              />
            </HStack>
          )}
        </HStack>
        <HStack alignItems="flex-start">
          <Box w="50%">
            <CustomInput
              label={t("nodes.nodeAddress")}
              size="sm"
              placeholder="51.20.12.13"
              {...form.register("address")}
              error={form.formState?.errors?.address?.message}
            />
          </Box>
          <Box w="25%">
            <CustomInput
              size="sm"
              label={t("nodes.nodePort")}
              placeholder="62050"
              {...form.register("port")}
              error={form.formState?.errors?.port?.message}
            />
          </Box>
          <Box w="25%">
            <CustomInput
              label={t("nodes.nodeAPIPort")}
              size="sm"
              placeholder="62051"
              {...form.register("api_port")}
              error={form.formState?.errors?.api_port?.message}
            />
          </Box>
        </HStack>
        {addAsHost && (
          <FormControl py={1}>
            <Checkbox {...form.register("add_as_new_host")}>
              <FormLabel m={0}>{t("nodes.addHostForEveryInbound")}</FormLabel>
            </Checkbox>
          </FormControl>
        )}
        <HStack w="full">
          {btnLeftAdornment}
          <Button
            px={5}
            w="full"
            size="sm"
            type="submit"
            flexGrow={1}
            colorScheme="primary"
            isLoading={isLoading}
            {...btnProps}
          >
            {submitBtnText}
          </Button>
        </HStack>
      </VStack>
    </form>
  );
}

const CustomInput = chakra(Input, {
  baseStyle: {
    bg: "white",
    _dark: {
      bg: "gray.700",
    },
  },
});
