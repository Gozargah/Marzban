import { BoxProps, HStack, Link, Text } from "@chakra-ui/react";
import { ORGANIZATION_URL } from "constants/Project";
import { FC } from "react";

export const Footer: FC<BoxProps> = (props) => {
  return (
    <HStack w="full" py="0" position="relative" {...props}>
      <Text
        display="inline-block"
        flexGrow={1}
        textAlign="center"
        color="gray.500"
        fontSize="xs"
      >
        Made with ❤️ in{" "}
        <Link color="blue.400" href={ORGANIZATION_URL}>
          Gozargah
        </Link>
      </Text>
    </HStack>
  );
};
