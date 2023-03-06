import {
  Box,
  Button,
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
  LinkIcon,
  MoonIcon,
  SunIcon,
} from "@heroicons/react/24/outline";
import { useDashboard } from "contexts/DashboardContext";
import { FC, ReactNode } from "react";
import { Link } from "react-router-dom";

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
const HostsIcon = chakra(LinkIcon, iconProps);

export const Header: FC<HeaderProps> = ({ actions }) => {
  const { onEditingHosts } = useDashboard();
  const { colorMode, toggleColorMode } = useColorMode();

  return (
    <HStack gap={2} justifyContent="space-between">
      <Text as="h1" fontWeight="semibold" fontSize="2xl">
        Users
      </Text>
      <HStack>
        <IconButton
          size="sm"
          variant="outline"
          aria-label="switch theme"
          onClick={toggleColorMode}
        >
          {colorMode === "light" ? <DarkIcon /> : <LightIcon />}
        </IconButton>
        <Menu>
          <MenuButton
            as={IconButton}
            size="sm"
            variant="outline"
            icon={<SettingsIcon />}
          ></MenuButton>
          <MenuList minW="170px">
            <MenuItem
              maxW="170px"
              fontSize="sm"
              icon={<HostsIcon />}
              onClick={onEditingHosts.bind(null, true)}
            >
              Hosts Settings
            </MenuItem>
            <Link to="/login">
              <MenuItem maxW="170px" fontSize="sm" icon={<LogoutIcon />}>
                Log out
              </MenuItem>
            </Link>
          </MenuList>
        </Menu>
      </HStack>
    </HStack>
  );
};
