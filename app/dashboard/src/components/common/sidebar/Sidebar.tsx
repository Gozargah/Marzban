import {
  Box,
  Button,
  Collapse,
  Divider,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerOverlay,
  HStack,
  IconButton,
  Text,
  Tooltip,
  VStack,
  chakra,
  useBreakpointValue,
} from "@chakra-ui/react";
import {
  ArrowRightStartOnRectangleIcon,
  Bars3CenterLeftIcon,
  ChevronDownIcon,
  LifebuoyIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import LogoSVG from "assets/logo.svg?react";
import { DonationCard } from "components/common/sidebar/DonationCard";
import { GithubStar } from "components/common/sidebar/GithubStar";
import { Language } from "components/common/sidebar/Language";
import { ThemeChangerButton } from "components/common/sidebar/ThemeChangerButton";
import { MenuItem, menu } from "config/menu";
import { DONATION_URL } from "config/project";
import { useDashboard } from "contexts/DashboardContext";
import { FC, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";
import { useGetCurrentAdmin } from "services/api";

const LogoIcon = chakra(LogoSVG, {
  baseStyle: {
    w: 6,
    h: 6,
    strokeWidth: "2px",
  },
});

const Logo = () => {
  return (
    <HStack color="gray.800" _dark={{ color: "whiteAlpha.800" }}>
      <LogoIcon />
      <Text fontWeight="semibold">Marzban</Text>
    </HStack>
  );
};

export const Sidebar: FC = () => {
  const [isDrawerOpen, setDrawerOpen] = useState(false);
  const toggleDrawer = setDrawerOpen.bind(null, !isDrawerOpen);
  const sidebar = useMemo(() => <SidebarContent toggleDrawer={toggleDrawer} isDrawerOpen={isDrawerOpen} />, []);

  return useBreakpointValue(
    {
      base: (
        <>
          <HStack
            display={{
              base: "flex",
              md: "none",
            }}
            justify="space-between"
            w="full"
            bg="transparent"
            borderBottom="1px solid"
            borderColor="divider"
            px="4"
            py="3"
          >
            <Logo />
            <IconButton size="sm" color="gray.500" p="1" aria-label="open menu" variant="ghost" onClick={toggleDrawer}>
              <Bars3CenterLeftIcon width="24px" />
            </IconButton>
          </HStack>
          <Drawer placement="left" onClose={toggleDrawer} isOpen={isDrawerOpen}>
            <DrawerOverlay />
            <IconButton
              position="absolute"
              zIndex={1400}
              top="3"
              right="3"
              size="sm"
              p="1"
              aria-label="close menu"
              variant="solid"
              color="blackAlpha.600"
              _dark={{
                bg: "#1E1F22",
                color: "whiteAlpha.400",
              }}
              onClick={toggleDrawer}
            >
              <XMarkIcon width="24px" />
            </IconButton>
            <DrawerContent
              p={0}
              maxW={{
                base: "280px",
              }}
              zIndex={1500}
              position="relative"
            >
              <DrawerBody p={0} zIndex={1500} position="relative">
                {sidebar}
              </DrawerBody>
            </DrawerContent>
          </Drawer>
        </>
      ),
      md: sidebar,
    },
    {
      fallback: "md",
    }
  )!;
};

const SidebarContent: FC<{ isDrawerOpen: boolean; toggleDrawer: () => void }> = ({ isDrawerOpen, toggleDrawer }) => {
  const { version } = useDashboard();
  const { t } = useTranslation();
  const { data } = useGetCurrentAdmin();
  const handleOnClick = () => {
    if (isDrawerOpen) toggleDrawer();
  };
  return (
    <VStack
      zIndex={1500}
      maxW={{
        base: "100%",
        md: "280px",
      }}
      w="full"
      h="full"
      bg="body"
      borderRight="1px solid"
      borderColor="divider"
      px={{ md: 4, base: 2 }}
      py="5"
      pt={{
        base: 5,
        md: 7,
      }}
      justifyContent="space-between"
      position="fixed"
      top={0}
      maxHeight="100vh"
      left={0}
      overflowY="auto"
    >
      <VStack w="full" gap="30px">
        <HStack w="full" justify="space-between" px="2">
          <Logo />
          {version && (
            <Box
              border="1.5px solid"
              rounded="full"
              borderColor="whiteAlpha.400"
              color="whiteAlpha.500"
              _light={{
                borderColor: "blackAlpha.700",
                color: "blackAlpha.700",
              }}
              fontWeight="medium"
              px="2"
              py="0.5"
              fontSize="xs"
            >
              v{version}
            </Box>
          )}
        </HStack>
        <NavMenu menu={menu} handleOnClick={handleOnClick} />
      </VStack>
      <VStack w="full">
        <DonationCard />
        <NavMenu
          menu={[
            {
              title: "donation.menuTitle",
              href: DONATION_URL,
              icon: <LifebuoyIcon width="24" />,
              target: "_blank",
            },
          ]}
          handleOnClick={handleOnClick}
        />
        <Divider borderColor="divider" />
        <HStack justify="space-between" w="full" alignItems="center">
          <GithubStar />
          <HStack>
            <Language />
            <ThemeChangerButton />
          </HStack>
        </HStack>
        <Divider borderColor="divider" />
        <HStack pt="2" pl="1" w="full" justifyContent="space-between">
          <Text fontSize="sm" fontWeight="semibold" color="text-nav-inactive">
            {data && data.username}
          </Text>
          <Tooltip label={t("header.logout")}>
            <IconButton as={Link} to="/login" aria-label="sign out" color="text-nav-inactive" size="sm" variant="ghost">
              <ArrowRightStartOnRectangleIcon width="18px" />
            </IconButton>
          </Tooltip>
        </HStack>
      </VStack>
    </VStack>
  );
};

const DropdownIcon = chakra(ChevronDownIcon, {
  baseStyle: {
    w: "16px",
    strokeWidth: "2px",
    transition: "all ease-out .2s",
  },
});

const isURLChildOfmenu = (menuList: typeof menu, pathname: string) => {
  return menuList.some((item): boolean => {
    return item.href === pathname;
  });
};

const NavButton: FC<{ menuItem: MenuItem; handleOnClick?: () => void }> = ({ menuItem, handleOnClick }) => {
  const { pathname } = useLocation();
  const [isOpen, setOpen] = useState((menuItem.children || false) && isURLChildOfmenu(menuItem.children, pathname));
  const { t } = useTranslation();
  const isActive = pathname === menuItem.href;

  return (
    <Box w="full" key={menuItem.href || menuItem.title}>
      <Button
        isActive={isActive}
        w="full"
        justifyContent="start"
        fontSize={{
          md: "md",
          base: "sm",
        }}
        fontWeight="medium"
        color="text-nav-inactive"
        bg="transparent"
        _hover={{
          bg: "active-menu-bg",
          color: "text-nav-inactive",
        }}
        border="1px solid"
        borderColor="transparent"
        _active={{
          bg: "active-menu-bg",
          borderColor: "border",
          color: "text-nav-active",
          _light: {
            boxShadow: "0px 2px 4px -2px rgba(16, 24, 40, 0.06)",
          },
        }}
        px={{
          base: 2,
          md: 3,
        }}
        h={{
          base: 9,
          md: 10,
        }}
        as={menuItem.href ? Link : undefined}
        key={menuItem.href}
        to={menuItem.href || ""}
        target={menuItem.target}
        leftIcon={menuItem.icon}
        onClick={() => {
          menuItem.children && setOpen(!isOpen);
          if (!menuItem.children) handleOnClick && handleOnClick();
        }}
        rightIcon={menuItem.children ? <DropdownIcon transform={isOpen ? "rotate(180deg)" : ""} /> : undefined}
      >
        <Text as="span" color="inherit" flexGrow={1} textAlign="left">
          {t(menuItem.title)}
        </Text>
      </Button>
      {menuItem.children && (
        <Collapse in={isOpen} animateOpacity style={{ width: "full" }}>
          <Box pl="8" mt="2">
            <NavMenu menu={menuItem.children} handleOnClick={handleOnClick} />
          </Box>
        </Collapse>
      )}
    </Box>
  );
};

const NavMenu: FC<{ menu: MenuItem[]; handleOnClick?: () => void }> = ({ menu, handleOnClick }) => {
  return (
    <VStack gap="1" w="full">
      {menu.map((menuItem, index) => {
        return <NavButton key={index} menuItem={menuItem} handleOnClick={handleOnClick} />;
      })}
    </VStack>
  );
};
