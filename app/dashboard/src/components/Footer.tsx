import { BoxProps, HStack, Link, Text } from "@chakra-ui/react";
import { ORGANIZATION_URL, REPO_URL } from "constants/Project";
import { useDashboard } from "contexts/DashboardContext";
import { useAccentColor } from "contexts/AccentColorContext";
import { FC } from "react";

export const Footer: FC<BoxProps> = (props) => {
  const { version } = useDashboard();
  const { accent } = useAccentColor();
  return (
    <HStack
      w="full"
      py="3"
      position="relative"
      className="glass-header"
      px={4}
      mt={4}
      {...props}
    >
      <Text
        display="inline-block"
        flexGrow={1}
        textAlign="center"
        color="gray.400"
        fontSize="xs"
      >
        <Link
          color={accent.primary}
          href={REPO_URL}
          transition="color 0.5s ease"
        >
          Marzban
        </Link>
        {version ? ` (v${version}), ` : ", "}
        Made with ❤️ in{" "}
        <Link
          color={accent.primary}
          href={ORGANIZATION_URL}
          transition="color 0.5s ease"
        >
          Gozargah
        </Link>
      </Text>
    </HStack>
  );
};
