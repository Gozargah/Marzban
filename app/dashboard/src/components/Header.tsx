import { Box, chakra, HStack, IconButton, useColorMode } from "@chakra-ui/react";
import { Bars3Icon, MoonIcon, SunIcon } from "@heroicons/react/24/outline";
import { REPO_URL } from "constants/Project";
import differenceInDays from "date-fns/differenceInDays";
import isValid from "date-fns/isValid";
import { FC } from "react";
import GitHubButton from "react-github-btn";
import { useTranslation } from "react-i18next";
import { updateThemeColor } from "utils/themeColor";
import { Language } from "./Language";

type HeaderProps = {
  /** Opens the nav drawer; only rendered where the sidebar is hidden. */
  onMenuOpen?: () => void;
};

const iconProps = { baseStyle: { w: 4, h: 4 } };

const DarkIcon = chakra(MoonIcon, iconProps);
const LightIcon = chakra(SunIcon, iconProps);
const MenuIcon = chakra(Bars3Icon, iconProps);

const NOTIFICATION_KEY = "marzban-menu-notification";

export const shouldShowDonation = (): boolean => {
  const date = localStorage.getItem(NOTIFICATION_KEY);
  if (!date) return true;
  try {
    if (date && isValid(parseInt(date))) {
      if (differenceInDays(new Date(), new Date(parseInt(date))) >= 7) return true;
      return false;
    }
    return true;
  } catch (err) {
    return true;
  }
};

/** Silences the donation dot for a week (the sidebar shows it now). */
export const dismissDonationNotice = (): void => {
  localStorage.setItem(NOTIFICATION_KEY, new Date().getTime().toString());
};

/**
 * Top bar: nav trigger on small screens, global controls on the right.
 * The page title belongs to the page itself now (components/ui PageHeader),
 * so it isn't repeated here.
 */
export const Header: FC<HeaderProps> = ({ onMenuOpen }) => {
  const { t } = useTranslation();
  const { colorMode, toggleColorMode } = useColorMode();
  const gBtnColor = colorMode === "dark" ? "dark_dimmed" : colorMode;

  return (
    <HStack gap="2" justifyContent="space-between" minW="0" mb="2">
      {onMenuOpen ? (
        <IconButton
          display={{ base: "inline-flex", md: "none" }}
          size="sm"
          variant="outline"
          aria-label={t("sidebar.expand")}
          onClick={onMenuOpen}
        >
          <MenuIcon />
        </IconButton>
      ) : (
        <Box />
      )}

      <HStack alignItems="center" spacing="2" flexShrink={0}>
        <Box
          display={{ base: "none", lg: "flex" }}
          alignItems="center"
          pr="1"
          __css={{ "& span": { display: "inline-flex" } }}
        >
          <GitHubButton
            href={REPO_URL}
            data-color-scheme={`no-preference: ${gBtnColor}; light: ${gBtnColor}; dark: ${gBtnColor};`}
            data-size="large"
            data-show-count="true"
            aria-label="Star Marzban on GitHub"
          >
            Star
          </GitHubButton>
        </Box>

        <Language />

        <IconButton
          size="sm"
          variant="outline"
          aria-label="switch theme"
          onClick={() => {
            updateThemeColor(colorMode == "dark" ? "light" : "dark");
            toggleColorMode();
          }}
        >
          {colorMode === "light" ? <DarkIcon /> : <LightIcon />}
        </IconButton>
      </HStack>
    </HStack>
  );
};
