import {
  Box,
  chakra,
  HStack,
  Icon as ChakraIcon,
  IconButton,
  Text,
  Tooltip,
  VStack,
} from "@chakra-ui/react";
import {
  ArrowLeftOnRectangleIcon,
  ChartPieIcon,
  ChevronLeftIcon,
  ClipboardDocumentListIcon,
  Cog6ToothIcon,
  CurrencyDollarIcon,
  LinkIcon,
  ServerStackIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";
import { DONATION_URL } from "constants/Project";
import useGetUser from "hooks/useGetUser";
import { FC, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";
import { dismissDonationNotice, shouldShowDonation } from "./Header";

const COLLAPSED_KEY = "panel-sidebar-collapsed";

export const SIDEBAR_WIDTH = { collapsed: "64px", expanded: "236px" };

type Item = {
  to: string;
  label: string;
  icon: any;
  sudoOnly?: boolean;
  external?: boolean;
  dot?: boolean;
  /** highlight the item for every route beneath it, e.g. /settings/core */
  prefix?: boolean;
};

type Group = { title?: string; items: Item[] };

const isActive = (pathname: string, item: Item) =>
  item.prefix ? pathname.startsWith(item.to) : pathname === item.to;

const NavRow: FC<{
  item: Item;
  collapsed: boolean;
  active: boolean;
  onClick?: () => void;
}> = ({ item, collapsed, active, onClick }) => {
  const row = (
    <HStack
      as="span"
      w="full"
      spacing="3"
      px="3"
      py="2"
      borderRadius="lg"
      position="relative"
      justifyContent={collapsed ? "center" : "flex-start"}
      bg={active ? "ui.accentSubtle" : "transparent"}
      color={active ? "ui.accent" : "ui.textMuted"}
      fontWeight={active ? "500" : "400"}
      _hover={{ bg: active ? "ui.accentSubtle" : "ui.surfaceHover", color: active ? "ui.accent" : "ui.text" }}
      transition="background .12s ease, color .12s ease"
    >
      <ChakraIcon as={item.icon} w="5" h="5" flexShrink={0} />
      {!collapsed && (
        <Text fontSize="sm" noOfLines={1}>
          {item.label}
        </Text>
      )}
      {item.dot && (
        <Box
          bg="orange.400"
          w="2"
          h="2"
          rounded="full"
          position="absolute"
          top="2"
          right={collapsed ? "2" : "3"}
        />
      )}
    </HStack>
  );

  const link = (
    <Link to={item.to} onClick={onClick} target={item.external ? "_blank" : undefined}>
      {row}
    </Link>
  );

  return collapsed ? (
    <Tooltip label={item.label} placement="right" openDelay={200}>
      <Box w="full">{link}</Box>
    </Tooltip>
  ) : (
    <Box w="full">{link}</Box>
  );
};

/** The nav itself. Shared by the desktop rail and the mobile drawer, which is
 *  why collapsing and the "navigated somewhere" callback come from outside. */
export const SidebarNav: FC<{
  collapsed?: boolean;
  onNavigate?: () => void;
  header?: React.ReactNode;
}> = ({ collapsed = false, onNavigate, header }) => {
  const { t } = useTranslation();
  const location = useLocation();
  const { userData, getUserIsSuccess, getUserIsPending } = useGetUser();
  const isSudo = !getUserIsPending && getUserIsSuccess && userData?.is_sudo;
  const [showDonationDot, setShowDonationDot] = useState(shouldShowDonation());

  const groups: Group[] = [
    { items: [{ to: "/", label: t("sidebar.users"), icon: UsersIcon }] },
    {
      title: "Инфраструктура",
      items: [
        { to: "/hosts", label: t("header.hostSettings"), icon: LinkIcon, sudoOnly: true },
        { to: "/nodes", label: t("header.nodeSettings"), icon: ServerStackIcon, sudoOnly: true },
        { to: "/nodes-usage", label: t("header.nodesUsage"), icon: ChartPieIcon, sudoOnly: true },
      ],
    },
    {
      title: "Система",
      items: [
        { to: "/settings", label: "Настройки", icon: Cog6ToothIcon, sudoOnly: true, prefix: true },
        { to: "/audit", label: "История действий", icon: ClipboardDocumentListIcon, sudoOnly: true },
      ],
    },
  ];

  const footerItems: Item[] = [
    {
      to: DONATION_URL,
      label: t("header.donation"),
      icon: CurrencyDollarIcon,
      external: true,
      dot: showDonationDot,
    },
    { to: "/login", label: t("header.logout"), icon: ArrowLeftOnRectangleIcon },
  ];

  return (
    <>
      {header}

      {groups.map((group, i) => {
        const items = group.items.filter((item) => !item.sudoOnly || isSudo);
        if (items.length === 0) return null;
        return (
          <VStack key={i} align="stretch" spacing="1" pb="2">
            {group.title && !collapsed && (
              <Text
                px="3"
                pt="3"
                pb="1"
                fontSize="10px"
                textTransform="uppercase"
                letterSpacing="0.06em"
                color="ui.textFaint"
              >
                {group.title}
              </Text>
            )}
            {group.title && collapsed && <Box h="1px" bg="ui.border" mx="3" my="2" />}
            {items.map((item) => (
              <NavRow
                key={item.to}
                item={item}
                collapsed={collapsed}
                active={isActive(location.pathname, item)}
                onClick={onNavigate}
              />
            ))}
          </VStack>
        );
      })}

      <Box flex="1" />

      <VStack align="stretch" spacing="1">
        {footerItems.map((item) => (
          <NavRow
            key={item.to}
            item={item}
            collapsed={collapsed}
            active={location.pathname === item.to}
            onClick={() => {
              if (item.dot) {
                dismissDonationNotice();
                setShowDonationDot(false);
              }
              onNavigate?.();
            }}
          />
        ))}
      </VStack>
    </>
  );
};

const CollapseIcon = chakra(ChevronLeftIcon, { baseStyle: { w: 4, h: 4 } });

/** Desktop rail. Hidden below md — there the drawer in Layout takes over. */
export const Sidebar: FC = () => {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(COLLAPSED_KEY) === "1"
  );

  useEffect(() => {
    localStorage.setItem(COLLAPSED_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  return (
    <VStack
      as="nav"
      display={{ base: "none", md: "flex" }}
      align="stretch"
      spacing="0"
      w={collapsed ? SIDEBAR_WIDTH.collapsed : SIDEBAR_WIDTH.expanded}
      flexShrink={0}
      h="100vh"
      position="sticky"
      top="0"
      py="4"
      px="2"
      bg="ui.surface"
      borderRightWidth="1px"
      borderColor="ui.border"
      transition="width .15s ease"
      overflowY="auto"
    >
      <SidebarNav
        collapsed={collapsed}
        header={
          <HStack justifyContent={collapsed ? "center" : "space-between"} px="1" pb="3">
            {!collapsed && (
              <HStack spacing="2" minW="0">
                <Box
                  w="7"
                  h="7"
                  borderRadius="lg"
                  bg="primary.500"
                  color="white"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  fontSize="sm"
                  fontWeight="700"
                  flexShrink={0}
                >
                  M
                </Box>
                <Text fontWeight="600" fontSize="md" noOfLines={1}>
                  Marzban
                </Text>
              </HStack>
            )}
            <IconButton
              size="sm"
              variant="ghost"
              aria-label={collapsed ? t("sidebar.expand") : t("sidebar.collapse")}
              onClick={() => setCollapsed((value) => !value)}
            >
              <CollapseIcon transform={collapsed ? "rotate(180deg)" : undefined} />
            </IconButton>
          </HStack>
        }
      />
    </VStack>
  );
};
