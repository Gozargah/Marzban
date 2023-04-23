import {
  Box,
  chakra,
  HStack,
  IconButton,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Text,
  useColorMode,
} from "@chakra-ui/react";
import {
  ArrowLeftOnRectangleIcon,
  Bars3Icon,
  CurrencyDollarIcon,
  DocumentMinusIcon,
  LinkIcon,
  MoonIcon,
  SunIcon,
} from "@heroicons/react/24/outline";
import { useDashboard } from "contexts/DashboardContext";
import { FC, ReactNode, useState } from "react";
import { Link } from "react-router-dom";
import GitHubButton from "react-github-btn";
import { DONATION_URL, REPO_URL } from "constants/Project";
import { useTranslation } from "react-i18next";
import { Language } from "./Language";
import { updateThemeColor } from "utils/themeColor";

const DarkIcon = chakra(MoonIcon, {
  baseStyle: {
    w: "4",
    h: "4",
  },
});
const LightIcon = chakra(SunIcon, {
  baseStyle: {
    w: "4",
    h: "4",
  },
});

type HeaderProps = {
  actions?: ReactNode;
};
const iconProps = {
  baseStyle: {
    w: 4,
    h: 4,
  },
};

const SettingsIcon = chakra(Bars3Icon, iconProps);
const LogoutIcon = chakra(ArrowLeftOnRectangleIcon, iconProps);
const DonationIcon = chakra(CurrencyDollarIcon, iconProps);
const HostsIcon = chakra(LinkIcon, iconProps);
const ResetUsageIcon = chakra(DocumentMinusIcon, iconProps);
const NotificationCircle = chakra(Box, {
  baseStyle: {
    bg: "yellow.500",
    w: "2",
    h: "2",
    rounded: "full",
    position: "absolute",
  },
});

const NOTIFICATION_KEY = "marzban-menu-notification";

export const Header: FC<HeaderProps> = ({ actions }) => {
  const { onEditingHosts, onResetAllUsage } = useDashboard();
  const { t } = useTranslation();
  const { colorMode, toggleColorMode } = useColorMode();
  const [notificationsChecked, setNotificationChecked] = useState(
    localStorage.getItem(NOTIFICATION_KEY)
  );
  const gBtnColor = colorMode === "dark" ? "dark_dimmed" : colorMode;

  const handleOnClose = () => {
    localStorage.setItem(NOTIFICATION_KEY, "true");
    setNotificationChecked("true");
  };

  return (
    <HStack gap={2} justifyContent="space-between">
      <Text as="h1" fontWeight="semibold" fontSize="2xl">
        {t("users")}
      </Text>
      <HStack alignItems="center">
        <Box
          display="flex"
          alignItems="center"
          __css={{
            "&  span": {
              display: "inline-flex",
            },
          }}
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
        <Language />
        <Menu onClose={handleOnClose}>
          <MenuButton
            as={IconButton}
            size="sm"
            variant="outline"
            icon={
              <>
                <SettingsIcon />
                {!notificationsChecked && (
                  <NotificationCircle top="-1" right="-1" />
                )}
              </>
            }
            position="relative"
          ></MenuButton>
          <MenuList minW="170px" zIndex={99999}>
            <MenuItem
              maxW="170px"
              fontSize="sm"
              icon={<HostsIcon />}
              onClick={onEditingHosts.bind(null, true)}
            >
              {t("header.hostsSetting")}
            </MenuItem>
            <MenuItem
              maxW="170px"
              fontSize="sm"
              icon={<ResetUsageIcon />}
              onClick={onResetAllUsage.bind(null, true)}
            >
              {t("resetAllUsage")}
            </MenuItem>
            <Link to={DONATION_URL} target="_blank">
              <MenuItem
                maxW="170px"
                fontSize="sm"
                icon={<DonationIcon />}
                position="relative"
              >
                {t("header.donation")}{" "}
                {!notificationsChecked && (
                  <NotificationCircle top="3" right="2" />
                )}
              </MenuItem>
            </Link>
            <Link to="/login">
              <MenuItem maxW="170px" fontSize="sm" icon={<LogoutIcon />}>
                {t("header.logout")}
              </MenuItem>
            </Link>
          </MenuList>
        </Menu>
      </HStack>
    </HStack>
  );
};
