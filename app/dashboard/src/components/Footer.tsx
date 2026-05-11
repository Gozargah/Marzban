import { BoxProps, HStack, Text } from "@chakra-ui/react";
import { useDashboard } from "contexts/DashboardContext";
import { FC } from "react";

export const Footer: FC<BoxProps> = (props) => {
  const { version } = useDashboard();
  return (
    <HStack w="full" py="0" position="relative" {...props}>
      <Text
        display="inline-block"
        flexGrow={1}
        textAlign="center"
        color="gray.500"
        fontSize="xs"
      >
        NeonGate{version ? ` (v${version})` : ""}
      </Text>
    </HStack>
  );
};
