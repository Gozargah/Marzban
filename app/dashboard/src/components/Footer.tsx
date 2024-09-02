import { BoxProps, HStack, Link, Text } from "@chakra-ui/react";
import { ORGANIZATION_URL, REPO_URL } from "constants/Project";
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
        <Link color="blue.400" href={REPO_URL}>
          Marzban
        </Link>
        {version ? ` (v${version}), ` : ", "}
        Made with ❤️ in{" "}
        <Link color="blue.400" href={ORGANIZATION_URL}>
          Gozargah
        </Link>
      </Text>
    </HStack>
  );
};
