import { ArrowPathIcon, TrashIcon } from "@heroicons/react/24/outline";
import { Box, chakra, Text } from "@chakra-ui/react";
import { FC, PropsWithChildren } from "react";

/** Kept here for the dialogs that still use the Chakra components. */
export const DeleteIcon = chakra(TrashIcon, {
  baseStyle: { w: 5, h: 5 },
});

export const ReloadIcon = chakra(ArrowPathIcon, {
  baseStyle: { w: 4, h: 4 },
});

export type IconType = {
  color: string;
};

export const Icon: FC<PropsWithChildren<IconType>> = ({ children, color }) => {
  return (
    <Box
      position="relative"
      width="36px"
      height="36px"
      display="flex"
      justifyContent="center"
      alignItems="center"
      _before={{
        content: '""',
        display: "block",
        position: "absolute",
        top: "0",
        left: "0",
        width: "calc(100%)",
        height: "calc(100%)",
        bg: `${color}.400`,
        opacity: ".5",
        borderRadius: 0,
        zIndex: "1",
        _dark: {
          bg: `${color}.400`,
        },
      }}
      _after={{
        content: '""',
        display: "block",
        position: "absolute",
        top: "0",
        left: "0",
        width: "calc(100% + 10px)",
        height: "calc(100% + 10px)",
        transform: "translate(-5px, -5px)",
        bg: `${color}.400`,
        opacity: ".4",
        borderRadius: 0,
        zIndex: "1",
        _dark: {
          bg: `${color}.400`,
        },
      }}
    >
      <Text
        color={`${color}.500`}
        _dark={{ color: `${color}.900` }}
        position="relative"
        zIndex="2"
      >
        {children}
      </Text>
    </Box>
  );
};
