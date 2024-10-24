import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useColorMode } from "@chakra-ui/react";
import { upperFirst } from "lodash-es";
import { MoonIcon, SunIcon } from "lucide-react";
import { FC } from "react";
import { updateThemeColor } from "utils/themeColor";

export const ThemeSwitchButton: FC = () => {
  const { colorMode, toggleColorMode } = useColorMode();
  const { setTheme } = useTheme();
  const toggleTheme = () => {
    const color = colorMode == "dark" ? "light" : "dark";
    updateThemeColor(color);
    toggleColorMode();
    setTheme(color);
  };
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="outline" size="icon" onClick={toggleTheme}>
          {colorMode === "light" ? <MoonIcon /> : <SunIcon />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>Toggle Theme to {upperFirst()}</TooltipContent>
    </Tooltip>
  );
};
