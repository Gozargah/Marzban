import {
  Box,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerOverlay,
  HStack,
  useDisclosure,
  VStack,
} from "@chakra-ui/react";
import { fetchInbounds } from "contexts/DashboardContext";
import { FC, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Footer } from "./Footer";
import { Header } from "./Header";
import { Sidebar, SidebarNav } from "./Sidebar";

export const Layout: FC = () => {
  const drawer = useDisclosure();
  const { pathname } = useLocation();

  // Every screen needs the inbound list, not just the users page: opening
  // /hosts directly used to leave it empty and the page crashed on the first
  // inbound it read.
  useEffect(() => {
    fetchInbounds();
  }, []);

  // a route change with the drawer still open leaves it covering the new page
  useEffect(() => {
    drawer.onClose();
  }, [pathname]);

  return (
    <HStack align="stretch" spacing="0" minH="100vh">
      <Sidebar />

      <Drawer isOpen={drawer.isOpen} placement="left" onClose={drawer.onClose} size="xs">
        <DrawerOverlay />
        <DrawerContent bg="ui.surface">
          <DrawerBody py="4" px="2">
            <VStack align="stretch" spacing="0" h="full">
              <SidebarNav onNavigate={drawer.onClose} />
            </VStack>
          </DrawerBody>
        </DrawerContent>
      </Drawer>

      <VStack
        flex="1"
        minW="0"
        justifyContent="space-between"
        rowGap="4"
        p={{ base: "3", md: "6" }}
      >
        <Box w="full" minW="0">
          <Header onMenuOpen={drawer.onOpen} />
          {/* wide screens (tables, JSON editors) scroll inside the column
              instead of pushing the whole page sideways on a phone */}
          <Box mt="4" w="full" minW="0" overflowX="auto">
            <Outlet />
          </Box>
        </Box>
        <Footer />
      </VStack>
    </HStack>
  );
};
