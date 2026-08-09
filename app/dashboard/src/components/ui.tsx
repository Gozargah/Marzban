/**
 * Small shared building blocks for the redesigned screens.
 *
 * Every page used to draw its own boxes, headings and hint popovers, which is
 * why nodes, hosts and settings all looked slightly different. These are the
 * pieces they now share: a surface, a section with a header, a page header, a
 * hint bubble, a field wrapper and an empty state.
 */
import {
  Box,
  BoxProps,
  Divider,
  FormControl,
  FormLabel,
  HStack,
  Icon as ChakraIcon,
  Popover,
  PopoverArrow,
  PopoverBody,
  PopoverContent,
  PopoverTrigger,
  Portal,
  Text,
  Tooltip,
  VStack,
} from "@chakra-ui/react";
import { InformationCircleIcon } from "@heroicons/react/24/outline";
import { FC, PropsWithChildren, ReactNode } from "react";

/** A card: page background one shade down, hairline border, soft radius. */
export const Panel: FC<BoxProps> = ({ children, ...props }) => (
  <Box
    bg="ui.surface"
    borderWidth="1px"
    borderColor="ui.border"
    borderRadius="xl"
    boxShadow="card"
    {...props}
  >
    {children}
  </Box>
);

/** Square tinted icon chip used in section and page headers. */
export const IconChip: FC<{ icon: any; tone?: string; size?: string }> = ({
  icon,
  tone = "primary",
  size = "9",
}) => (
  <Box
    flexShrink={0}
    w={size}
    h={size}
    borderRadius="lg"
    display="flex"
    alignItems="center"
    justifyContent="center"
    bg={tone === "primary" ? "ui.accentSubtle" : `${tone}.50`}
    color={tone === "primary" ? "ui.accent" : `${tone}.500`}
    _dark={tone === "primary" ? undefined : { bg: `${tone}.900`, color: `${tone}.200` }}
  >
    <ChakraIcon as={icon} w="5" h="5" />
  </Box>
);

/** Title + subtitle + actions, above the content of a page. */
export const PageHeader: FC<{
  title: ReactNode;
  description?: ReactNode;
  icon?: any;
  actions?: ReactNode;
}> = ({ title, description, icon, actions }) => (
  <HStack
    align={{ base: "stretch", sm: "center" }}
    flexDir={{ base: "column", sm: "row" }}
    justify="space-between"
    gap="3"
    mb="5"
    w="full"
  >
    <HStack spacing="3" minW="0" align="center">
      {icon && <IconChip icon={icon} size="10" />}
      <Box minW="0">
        <Text textStyle="pageTitle" noOfLines={1}>
          {title}
        </Text>
        {description && (
          <Text fontSize="sm" color="ui.textMuted" mt="0.5">
            {description}
          </Text>
        )}
      </Box>
    </HStack>
    {actions && (
      <HStack spacing="2" flexShrink={0} justify={{ base: "stretch", sm: "flex-end" }}>
        {actions}
      </HStack>
    )}
  </HStack>
);

/** A titled block of settings. `actions` sit on the header row, right side. */
export const Section: FC<
  PropsWithChildren<{
    title?: ReactNode;
    description?: ReactNode;
    icon?: any;
    actions?: ReactNode;
    bodyProps?: BoxProps;
  }> &
    BoxProps
> = ({ title, description, icon, actions, children, bodyProps, ...props }) => (
  <Panel overflow="hidden" {...props}>
    {(title || actions) && (
      <>
        <HStack
          px={{ base: "4", md: "5" }}
          py="4"
          justify="space-between"
          align={{ base: "flex-start", sm: "center" }}
          flexDir={{ base: "column", sm: "row" }}
          gap="3"
        >
          <HStack spacing="3" minW="0" align="center">
            {icon && <IconChip icon={icon} />}
            <Box minW="0">
              <Text textStyle="sectionTitle">{title}</Text>
              {description && (
                <Text fontSize="xs" color="ui.textMuted" mt="0.5">
                  {description}
                </Text>
              )}
            </Box>
          </HStack>
          {actions && <HStack spacing="2">{actions}</HStack>}
        </HStack>
        <Divider borderColor="ui.border" />
      </>
    )}
    <Box px={{ base: "4", md: "5" }} py="4" {...bodyProps}>
      {children}
    </Box>
  </Panel>
);

/** The little "?" next to a label. Short text tooltips, rich content popovers. */
export const Hint: FC<{ label?: ReactNode; children?: ReactNode }> = ({
  label,
  children,
}) => {
  const trigger = (
    <Box as="span" display="inline-flex" color="ui.textFaint" cursor="help" _hover={{ color: "ui.textMuted" }}>
      <ChakraIcon as={InformationCircleIcon} w="4" h="4" />
    </Box>
  );

  if (children)
    return (
      <Popover isLazy placement="top" trigger="hover">
        <PopoverTrigger>
          <Box as="span" display="inline-flex">
            {trigger}
          </Box>
        </PopoverTrigger>
        <Portal>
          <PopoverContent maxW="320px">
            <PopoverArrow />
            <PopoverBody fontSize="xs">{children}</PopoverBody>
          </PopoverContent>
        </Portal>
      </Popover>
    );

  return (
    <Tooltip label={label} placement="top" openDelay={200} hasArrow>
      {trigger}
    </Tooltip>
  );
};

/** Label (with optional hint) + control + helper/error text. */
export const Field: FC<
  PropsWithChildren<{
    label?: ReactNode;
    hint?: ReactNode;
    /** Rich hint body; takes precedence over `hint`. */
    hintBody?: ReactNode;
    helper?: ReactNode;
    error?: ReactNode;
    isInvalid?: boolean;
  }>
> = ({ label, hint, hintBody, helper, error, isInvalid, children }) => (
  <FormControl isInvalid={isInvalid || !!error}>
    {label && (
      <FormLabel mb="1.5" display="flex" alignItems="center" gap="1.5">
        <Box as="span">{label}</Box>
        {(hint || hintBody) && <Hint label={hint}>{hintBody}</Hint>}
      </FormLabel>
    )}
    {children}
    {error ? (
      <Text fontSize="xs" color="red.400" mt="1.5">
        {error}
      </Text>
    ) : (
      helper && (
        <Text fontSize="xs" color="ui.textMuted" mt="1.5">
          {helper}
        </Text>
      )
    )}
  </FormControl>
);

/** Row of a settings list: text on the left, control on the right. */
export const SettingRow: FC<
  PropsWithChildren<{ label: ReactNode; description?: ReactNode; hint?: ReactNode }>
> = ({ label, description, hint, children }) => (
  <HStack
    justify="space-between"
    align={{ base: "flex-start", sm: "center" }}
    flexDir={{ base: "column", sm: "row" }}
    gap="3"
    w="full"
    py="1"
  >
    <Box minW="0">
      <HStack spacing="1.5">
        <Text fontSize="sm" fontWeight="500">
          {label}
        </Text>
        {hint && <Hint label={hint} />}
      </HStack>
      {description && (
        <Text fontSize="xs" color="ui.textMuted" mt="0.5">
          {description}
        </Text>
      )}
    </Box>
    <Box flexShrink={0}>{children}</Box>
  </HStack>
);

export const EmptyState: FC<{
  icon?: any;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}> = ({ icon, title, description, action }) => (
  <VStack py="10" px="4" spacing="3" textAlign="center">
    {icon && <IconChip icon={icon} size="12" />}
    <Box>
      <Text fontWeight="500">{title}</Text>
      {description && (
        <Text fontSize="sm" color="ui.textMuted" mt="1" maxW="420px">
          {description}
        </Text>
      )}
    </Box>
    {action}
  </VStack>
);

/** Key/value pair, used inside the node and host cards. */
export const MetaItem: FC<{ label: ReactNode; value: ReactNode }> = ({
  label,
  value,
}) => (
  <Box minW="0">
    <Text fontSize="10px" textTransform="uppercase" letterSpacing="0.04em" color="ui.textFaint">
      {label}
    </Text>
    <Text fontSize="sm" noOfLines={1} sx={{ fontVariantNumeric: "tabular-nums" }}>
      {value}
    </Text>
  </Box>
);
