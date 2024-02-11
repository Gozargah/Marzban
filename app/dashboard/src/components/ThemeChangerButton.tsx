import { IconButton, chakra, useColorMode } from "@chakra-ui/react";
import { MoonIcon, SunIcon } from "@heroicons/react/24/outline";
import { updateThemeColor } from "utils/themeColor";

const iconProps = {
  baseStyle: {
    w: 4,
    h: 4,
  },
};

const DarkIcon = chakra(MoonIcon, iconProps);
const LightIcon = chakra(SunIcon, iconProps);

export const ThemeChangerButton = () => {
  const { colorMode, toggleColorMode } = useColorMode();
  return (
    <IconButton
      size="sm"
      variant="solid"
      colorScheme="gray"
      aria-label="switch theme"
      onClick={() => {
        updateThemeColor(colorMode == "dark" ? "light" : "dark");
        toggleColorMode();
      }}
    >
      {colorMode === "light" ? <DarkIcon /> : <LightIcon />}
    </IconButton>
  );
};
