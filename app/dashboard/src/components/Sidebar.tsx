import { Box, Button, Collapse, HStack, Image, Text, VStack, chakra } from "@chakra-ui/react";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { MenuItem, menu } from "constants/menu";
import { useDashboard } from "contexts/DashboardContext";
import { FC, useState } from "react";
import { Link } from "react-router-dom";

export const Sidebar = () => {
  const { version } = useDashboard();
  return (
    <VStack maxW="300px" w="full" h="full" bg="gray.950" px="4" py="5" justifyContent="space-between">
      <VStack w="full" gap="40px">
        <HStack w="full" justify="space-between" px="2">
          <HStack>
            <Image src="/statics/logo.png" />
            <Text fontWeight="semibold" color="white">
              Marzban
            </Text>
          </HStack>
          <Box
            border="1.5px solid"
            rounded="full"
            borderColor="gray.500"
            color="gray.500"
            fontWeight="medium"
            px="2"
            py="0.5"
            fontSize="xs"
          >
            v{version}
          </Box>
        </HStack>
        <NavMenu menu={menu} />
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
  return (
    <VStack gap="1" w="full">
      {menu.map((menuItem) => {
        return (
          <Box w="full" key={menuItem.href}>
            <Button
              w="full"
              justifyContent="start"
              fontSize="16px"
              fontWeight="semibold"
              color="gray.300"
              bg="transparent"
              _hover={{
                bg: "gray.800",
              }}
              px="3"
              as={menuItem.href ? Link : undefined}
              key={menuItem.href}
              to={menuItem.href || ""}
              leftIcon={menuItem.icon}
              onClick={() => {
                menuItem.children && setOpen(!isOpen);
              }}
              rightIcon={menuItem.children ? <DropdownIcon transform={isOpen ? "rotate(180deg)" : ""} /> : undefined}
            >
              <Text as="span" color="white" flexGrow={1} textAlign="left">
                {menuItem.title}
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
