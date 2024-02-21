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
  ChartPieIcon,
  Cog6ToothIcon,
  CurrencyDollarIcon,
  DocumentMinusIcon,
  LinkIcon,
  SquaresPlusIcon,
} from "@heroicons/react/24/outline";
import { NOTIFICATION_KEY, shouldShowDonation } from "components/common/sidebar/DonationCard";
import { GithubStar } from "components/common/sidebar/GithubStar";
import { ThemeChangerButton } from "components/common/sidebar/ThemeChangerButton";
import { DONATION_URL } from "core/data/project";
import { useDashboard } from "contexts/DashboardContext";
import { FC, ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Language } from "components/common/sidebar/Language";

type HeaderProps = {
  actions?: ReactNode;
};
const iconProps = {
  baseStyle: {
    w: 4,
    h: 4,
  },
};

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

export const Header: FC<HeaderProps> = ({ actions }) => {
  const { onEditingHosts, onResetAllUsage, onEditingNodes, onShowingNodesUsage } = useDashboard();
  const { t } = useTranslation();
  const [showDonationNotif, setShowDonationNotif] = useState(shouldShowDonation());

  const handleOnClose = () => {
    localStorage.setItem(NOTIFICATION_KEY, new Date().getTime().toString());
    setShowDonationNotif(false);
  };
  const { colorMode } = useColorMode();
  const gBtnColor = colorMode === "dark" ? "dark_dimmed" : colorMode;

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
    >
      <Text as="h1" fontWeight="semibold" fontSize="2xl">
        {t("users")}
      </Text>
      {showDonationNotif && <NotificationCircle top="0" right="0" zIndex={1399} />}
      <Box overflow="auto" css={{ direction: "rtl" }}>
        <HStack alignItems="center">
          <Menu>
            <MenuButton
              as={IconButton}
              size="sm"
              variant="outline"
              icon={
                <>
                  <SettingsIcon />
                </>
              }
              position="relative"
            ></MenuButton>
            <MenuList minW="170px" zIndex={1399} className="menuList">
              <MenuItem maxW="170px" fontSize="sm" icon={<HostsIcon />} onClick={onEditingHosts.bind(null, true)}>
                {t("header.hostSettings")}
              </MenuItem>
              <MenuItem maxW="170px" fontSize="sm" icon={<NodesIcon />} onClick={onEditingNodes.bind(null, true)}>
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
              <MenuItem maxW="170px" fontSize="sm" icon={<ResetUsageIcon />} onClick={onResetAllUsage.bind(null, true)}>
                {t("resetAllUsage")}
              </MenuItem>
              <Link to={DONATION_URL} target="_blank">
                <MenuItem
                  maxW="170px"
                  fontSize="sm"
                  icon={<DonationIcon />}
                  position="relative"
                  onClick={handleOnClose}
                >
                  {t("header.donation")} {showDonationNotif && <NotificationCircle top="3" right="2" />}
                </MenuItem>
              </Link>
              <Link to="/login">
                <MenuItem maxW="170px" fontSize="sm" icon={<LogoutIcon />}>
                  {t("header.logout")}
                </MenuItem>
              </Link>
            </MenuList>
          </Menu>

          <IconButton
            size="sm"
            variant="outline"
            aria-label="core settings"
            onClick={() => {
              useDashboard.setState({ isEditingCore: true });
            }}
          >
            <CoreSettingsIcon />
          </IconButton>
          <ThemeChangerButton />
          <Language />

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
            <GithubStar />
          </Box>
        </HStack>
      </Box>
    </HStack>
  );
};
