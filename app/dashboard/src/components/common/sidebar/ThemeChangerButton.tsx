import { IconButton, Tooltip, chakra, useColorMode } from "@chakra-ui/react";
import { MoonIcon, SunIcon } from "@heroicons/react/24/outline";
import { useTranslation } from "react-i18next";
import { updateThemeColor } from "core/utils/themeColor";

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
  const { t } = useTranslation();
  return (
    <Tooltip label={t("theme.toggleButton")} placement="top">
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
    </Tooltip>
  );
};
