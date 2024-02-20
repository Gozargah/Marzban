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
import { DonationCard } from "@/components/common/sidebar/DonationCard";
import { GithubStar } from "@/components/common/sidebar/GithubStar";
import { Language } from "@/components/common/sidebar/Language";
import { ThemeChangerButton } from "@/components/common/sidebar/ThemeChangerButton";
import { MenuItem, menu } from "core/data/menu";
import { DONATION_URL } from "core/data/project";
import { useDashboard } from "contexts/DashboardContext";
import { FC, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useGetCurrentAdmin } from "core/services/api";

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
  const { t } = useTranslation();
  const toggleDrawer = setDrawerOpen.bind(null, !isDrawerOpen);
  const sidebar = useMemo(() => <SidebarContent />, []);

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
            borderColor="#E5EAF0"
            _dark={{
              borderColor: "#282C2F",
            }}
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
                base: "calc(100% - 280px)",
                sm: "280px",
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

const SidebarContent = () => {
  const { version } = useDashboard();
  const { t } = useTranslation();
  const { data } = useGetCurrentAdmin();
  return (
    <VStack
      zIndex={1500}
      maxW={{
        base: "100%",
        md: "280px",
      }}
      w="full"
      h="full"
      bg="white"
      borderRight="1px solid"
      borderColor="#E5EAF0"
      _dark={{
        bg: "#1E1F22",
        borderColor: "#282C2F",
      }}
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
        <NavMenu menu={menu} />
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
        />
        <Divider _light={{ borderColor: "#DCE0E4" }} />
        <HStack justify="space-between" w="full" alignItems="center">
          <GithubStar />
          <HStack>
            <Language />
            <ThemeChangerButton />
          </HStack>
        </HStack>
        <Divider _light={{ borderColor: "#DCE0E4" }} />
        <HStack pt="2" pl="1" w="full" justifyContent="space-between">
          <Text fontSize="sm" fontWeight="semibold">
            {data && data.username}
          </Text>
          <Tooltip label={t("header.logout")}>
            <IconButton aria-label="sign out" color="gray.400" size="sm" variant="ghost">
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

const NavMenu: FC<{ menu: MenuItem[] }> = ({ menu }) => {
  const [isOpen, setOpen] = useState(false);
  const { t } = useTranslation();
  return (
    <VStack gap="1" w="full">
      {menu.map((menuItem) => {
        return (
          <Box w="full" key={menuItem.href || menuItem.title}>
            <Button
              w="full"
              justifyContent="start"
              fontSize={{
                md: "md",
                base: "sm",
              }}
              fontWeight="medium"
              color="gray.300"
              bg="transparent"
              _hover={{
                bg: "blackAlpha.100",
                _dark: {
                  bg: "whiteAlpha.100",
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
              }}
              _light={{ color: "gray.600" }}
              rightIcon={menuItem.children ? <DropdownIcon transform={isOpen ? "rotate(180deg)" : ""} /> : undefined}
            >
              <Text as="span" color="whiteAlpha.800" _light={{ color: "gray.700" }} flexGrow={1} textAlign="left">
                {t(menuItem.title)}
              </Text>
            </Button>
            {menuItem.children && (
              <Collapse in={isOpen} animateOpacity>
                <Box pl="8" mt="2">
                  <NavMenu menu={menuItem.children} />
                </Box>
              </Collapse>
            )}
          </Box>
        );
      })}
    </VStack>
  );
};
