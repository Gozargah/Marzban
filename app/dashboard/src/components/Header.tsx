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
  useBreakpointValue,
  useColorMode,
} from "@chakra-ui/react";
import {
  ArrowLeftOnRectangleIcon,
  Bars3Icon,
  ChartPieIcon,
  Cog6ToothIcon,
  CurrencyDollarIcon,
  DocumentMinusIcon,
  LinkIcon,
  MoonIcon,
  SquaresPlusIcon,
  SunIcon,
} from "@heroicons/react/24/outline";
import { DONATION_URL, REPO_URL } from "constants/Project";
import { useDashboard } from "contexts/DashboardContext";
import { useAccentColor } from "contexts/AccentColorContext";
import differenceInDays from "date-fns/differenceInDays";
import isValid from "date-fns/isValid";
import { FC, ReactNode, useState } from "react";
import GitHubButton from "react-github-btn";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { updateThemeColor } from "utils/themeColor";
import { Language } from "./Language";
import useGetUser from "hooks/useGetUser";

type HeaderProps = {
  actions?: ReactNode;
};
const iconProps = {
  baseStyle: {
    w: 4,
    h: 4,
  },
};

const DarkIcon = chakra(MoonIcon, iconProps);
const LightIcon = chakra(SunIcon, iconProps);
const CoreSettingsIcon = chakra(Cog6ToothIcon, iconProps);
const SettingsIcon = chakra(Bars3Icon, iconProps);
const LogoutIcon = chakra(ArrowLeftOnRectangleIcon, iconProps);
const DonationIcon = chakra(CurrencyDollarIcon, iconProps);
const HostsIcon = chakra(LinkIcon, iconProps);
const NodesIcon = chakra(SquaresPlusIcon, iconProps);
const NodesUsageIcon = chakra(ChartPieIcon, iconProps);
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

export const shouldShowDonation = (): boolean => {
  const date = localStorage.getItem(NOTIFICATION_KEY);
  if (!date) return true;
  try {
    if (date && isValid(parseInt(date))) {
      if (differenceInDays(new Date(), new Date(parseInt(date))) >= 7)
        return true;
      return false;
    }
    return true;
  } catch (err) {
    return true;
  }
};

export const Header: FC<HeaderProps> = ({ actions }) => {
  const { userData, getUserIsSuccess, getUserIsPending } = useGetUser();
  const { accent } = useAccentColor();
  const isMobile = useBreakpointValue({ base: true, md: false });

  const isSudo = () => {
    if (!getUserIsPending && getUserIsSuccess) {
      return userData.is_sudo;
    }
    return false;
  };

  const {
    onEditingHosts,
    onResetAllUsage,
    onEditingNodes,
    onShowingNodesUsage,
  } = useDashboard();
  const { t } = useTranslation();
  const { colorMode, toggleColorMode } = useColorMode();
  const [showDonationNotif, setShowDonationNotif] = useState(
    shouldShowDonation()
  );
  const gBtnColor = colorMode === "dark" ? "dark_dimmed" : colorMode;

  const handleOnClose = () => {
    localStorage.setItem(NOTIFICATION_KEY, new Date().getTime().toString());
    setShowDonationNotif(false);
  };

  return (
    <HStack
      gap={2}
      justifyContent="space-between"
      __css={{
        "& .menuList": {
          direction: "ltr",
        },
      }}
      position="relative"
      className="glass-header"
      px={4}
      py={3}
    >
      <HStack spacing={3}>
        <Box
          className="accent-dot"
          display={{ base: "block", md: "block" }}
        />
        <Text
          as="h1"
          fontWeight="bold"
          fontSize={{ base: "lg", md: "2xl" }}
          bgGradient={`linear(to-r, ${accent.primary}, ${accent.secondary})`}
          bgClip="text"
          transition="all 0.5s ease"
        >
          {t("users")}
        </Text>
      </HStack>
      {showDonationNotif && (
        <NotificationCircle top="2" right="2" zIndex={9999} />
      )}
      <Box overflow="auto" css={{ direction: "rtl" }}>
        <HStack alignItems="center" spacing={2}>
          <Menu>
            <MenuButton
              as={IconButton}
              size="sm"
              variant="ghost"
              icon={
                <>
                  <SettingsIcon />
                </>
              }
              position="relative"
              _hover={{ bg: "rgba(255,255,255,0.1)" }}
            ></MenuButton>
            <MenuList minW="170px" zIndex={99999} className="menuList">
              {isSudo() && (
                <>
                  <MenuItem
                    maxW="170px"
                    fontSize="sm"
                    icon={<HostsIcon />}
                    onClick={onEditingHosts.bind(null, true)}
                  >
                    {t("header.hostSettings")}
                  </MenuItem>
                  <MenuItem
                    maxW="170px"
                    fontSize="sm"
                    icon={<NodesIcon />}
                    onClick={onEditingNodes.bind(null, true)}
                  >
                    {t("header.nodeSettings")}
                  </MenuItem>
                  <MenuItem
                    maxW="170px"
                    fontSize="sm"
                    icon={<NodesUsageIcon />}
                    onClick={onShowingNodesUsage.bind(null, true)}
                  >
                    {t("header.nodesUsage")}
                  </MenuItem>
                  <MenuItem
                    maxW="170px"
                    fontSize="sm"
                    icon={<ResetUsageIcon />}
                    onClick={onResetAllUsage.bind(null, true)}
                  >
                    {t("resetAllUsage")}
                  </MenuItem>
                </>
              )}
              <Link to={DONATION_URL} target="_blank">
                <MenuItem
                  maxW="170px"
                  fontSize="sm"
                  icon={<DonationIcon />}
                  position="relative"
                  onClick={handleOnClose}
                >
                  {t("header.donation")}{" "}
                  {showDonationNotif && (
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

          {isSudo() && !isMobile && (
            <IconButton
              size="sm"
              variant="ghost"
              aria-label="core settings"
              _hover={{ bg: "rgba(255,255,255,0.1)" }}
              onClick={() => {
                useDashboard.setState({ isEditingCore: true });
              }}
            >
              <CoreSettingsIcon />
            </IconButton>
          )}

          {!isMobile && <Language />}

          <IconButton
            size="sm"
            variant="ghost"
            aria-label="switch theme"
            _hover={{ bg: "rgba(255,255,255,0.1)" }}
            onClick={() => {
              updateThemeColor(colorMode == "dark" ? "light" : "dark");
              toggleColorMode();
            }}
          >
            {colorMode === "light" ? <DarkIcon /> : <LightIcon />}
          </IconButton>

          {!isMobile && (
            <Box
              css={{ direction: "ltr" }}
              display="flex"
              alignItems="center"
              pr="2"
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
          )}
        </HStack>
      </Box>
    </HStack>
  );
};
