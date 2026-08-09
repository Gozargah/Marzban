/**
 * Drop-in replacements for Chakra's Modal parts that render as a plain page
 * section when they sit inside <PageMode>.
 *
 * The screens behind the old burger menu were all written as modals. Rather
 * than fork each of them into a second page-shaped copy, they now import their
 * Modal parts from here: in a modal context nothing changes, and on a route of
 * their own the dialog chrome (overlay, centring, close button) falls away.
 */
import {
  Box,
  HStack,
  Modal as ChakraModal,
  ModalBody as ChakraModalBody,
  ModalCloseButton as ChakraModalCloseButton,
  ModalContent as ChakraModalContent,
  ModalFooter as ChakraModalFooter,
  ModalHeader as ChakraModalHeader,
  ModalOverlay as ChakraModalOverlay,
} from "@chakra-ui/react";
import { createContext, FC, PropsWithChildren, useContext } from "react";

const PageModeContext = createContext(false);

export const PageMode: FC<PropsWithChildren> = ({ children }) => (
  <PageModeContext.Provider value={true}>{children}</PageModeContext.Provider>
);

export const usePageMode = () => useContext(PageModeContext);

export const Modal: FC<any> = ({ children, isOpen, ...props }) => {
  if (!usePageMode())
    return (
      <ChakraModal isOpen={isOpen} {...props}>
        {children}
      </ChakraModal>
    );
  // a screen whose owner hasn't opened it yet has nothing to show
  return isOpen === false ? null : <>{children}</>;
};

export const ModalOverlay: FC<any> = (props) =>
  usePageMode() ? null : <ChakraModalOverlay {...props} />;

// Layout props coming from the modal version (fit-content widths, side
// margins, centring) are dropped on purpose: on a page the screen gets the
// full column instead.
export const ModalContent: FC<any> = ({ children, ...props }) =>
  usePageMode() ? (
    // capped: the forms inside were laid out for a dialog and read badly when
    // stretched across a wide monitor; tables that need more scroll instead
    <Box w="full" maxW="6xl">
      {children}
    </Box>
  ) : (
    <ChakraModalContent {...props}>{children}</ChakraModalContent>
  );

export const ModalHeader: FC<any> = ({ children, ...props }) =>
  usePageMode() ? (
    <Box as="h2" fontSize="xl" fontWeight="semibold" mb="4">
      {children}
    </Box>
  ) : (
    <ChakraModalHeader {...props}>{children}</ChakraModalHeader>
  );

export const ModalBody: FC<any> = ({ children, ...props }) =>
  usePageMode() ? <Box>{children}</Box> : <ChakraModalBody {...props}>{children}</ChakraModalBody>;

export const ModalFooter: FC<any> = ({ children, ...props }) =>
  usePageMode() ? (
    <HStack justifyContent="flex-end" spacing="3" mt="6">
      {children}
    </HStack>
  ) : (
    <ChakraModalFooter {...props}>{children}</ChakraModalFooter>
  );

export const ModalCloseButton: FC<any> = (props) =>
  usePageMode() ? null : <ChakraModalCloseButton {...props} />;
