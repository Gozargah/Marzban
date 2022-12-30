import { Box, HStack, Text } from "@chakra-ui/react";
import { FC, ReactNode } from "react";

type HeaderProps = {
  actions?: ReactNode;
};

export const Header: FC<HeaderProps> = ({ actions }) => {
  return (
    <HStack gap={2} justifyContent="space-between">
      <Text as="h1" fontWeight="semibold" fontSize="2xl">
        Users
      </Text>
      {actions && <Box>{actions}</Box>}
    </HStack>
  );
};
