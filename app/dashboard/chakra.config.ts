import { defineStyle, defineStyleConfig, extendTheme } from "@chakra-ui/react";
export const theme = extendTheme({
  shadows: { outline: "0 0 0 2px var(--chakra-colors-primary-200)" },
  fonts: {
    body: `Inter,-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Oxygen,Ubuntu,Cantarell,Fira Sans,Droid Sans,Helvetica Neue,sans-serif`,
  },
  semanticTokens: {
    colors: {
      divider: {
        default: "#F0F0F0",
        _dark: "#313235",
      },
      "main-bg": {
        default: "#fff",
        _dark: "#222326",
      },
      body: {
        default: "#FAFAFA",
        _dark: "#1E1F22",
      },
      border: {
        default: "#EAECF0",
        _dark: "#3A3839",
      },
      "active-menu-bg": {
        default: "#fff",
        _dark: "#26272A",
      },
      "card-bg": {
        default: "#FCFCFC",
        _dark: "#26272A",
      },
      text: {
        default: "#344054",
        _dark: "#EEEEEE",
      },
      "text-active": {
        default: "#101828",
        _dark: "#EAECF0",
      },
      "text-inactive": {
        default: "#475467",
        _dark: "#98A2B3",
      },
      "text-nav-inactive": {
        default: "#737378",
        _dark: "#D6D6D6",
      },
      "text-nav-active": {
        default: "#101828",
        _dark: "#EDEDED",
      },
      "success-text": {
        default: "#067647",
        _dark: "#079455",
      },
      "success-border": {
        default: "#ABEFC6",
        _dark: "#85C7AB",
      },
      "success-bg": {
        default: "#ECFDF3",
        _dark: "#C5D3CC",
      },
      "error-text": {
        default: "#B42318",
        _dark: "#B42318",
      },
      "error-border": {
        default: "#FECDCA",
        _dark: "#D68983",
      },
      "error-bg": {
        default: "#FEF3F2",
        _dark: "#D4CBCB",
      },
      "th-bg": {
        default: "#FCFCFC",
        _dark: "#26272A",
      },
      "td-bg": {
        default: "#fff",
        _dark: "#222326",
      },
      "td-hover": {
        default: "#F9FAFB",
        _dark: "#27282B",
      },
    },
  },
  colors: {
    primary: {
      50: "#EBF2FE",
      100: "#D7E6FD",
      200: "#B0CDFB",
      300: "#89B4FA",
      400: "#629BF8",
      500: "#3B82F6",
      600: "#0B61EE",
      700: "#084BB8",
      800: "#063583",
      900: "#041F4D",
      950: "#021532",
    },
    gray: {
      25: "#FCFCFD",
      50: "#F9FAFB",
      100: "#F2F4F7",
      200: "#EAECF0",
      300: "#D0D5DD",
      400: "#98A2B3",
      500: "#98A2B3",
      600: "#475467",
      700: "#344054",
      750: "#222C3B",
      800: "#1D2939",
      900: "#101828",
      950: "#0C111D",
    },
  },
  components: {
    Badge: defineStyleConfig({
      baseStyle: {
        borderRadius: "6px",
      },
      variants: {
        subtle: (props) => {
          return {
            border: `1px solid var(--chakra-colors-${props.colorScheme}-300)`,
            paddingY: 0.5,
          };
        },
      },
    }),
    Button: defineStyleConfig({
      variants: {
        outline: defineStyle({
          bg: "td-bg",
          borderColor: "border",
        }),
        ghost: defineStyle({
          bg: "transparent",
          border: "1px solid",
          borderColor: "transparent",
          _light: {
            color: "gray.800",
          },
          _hover: {
            bg: "td-bg",
            borderColor: "border",
          },
        }),
      },
    }),
    Menu: {
      baseStyle: {
        list: {
          bg: "card-bg",
        },
        item: {
          bg: "card-bg",
          _hover: {
            bg: "blackAlpha.100",
            _dark: {
              bg: "whiteAlpha.100",
            },
          },
        },
      },
    },
    Alert: {
      baseStyle: {
        container: {
          borderRadius: "6px",
          fontSize: "sm",
        },
      },
    },
    Select: {
      baseStyle: {
        field: {
          _dark: {
            borderColor: "gray.600",
            borderRadius: "6px",
          },
          _light: {
            borderRadius: "6px",
          },
        },
      },
    },
    FormHelperText: {
      baseStyle: {
        fontSize: "xs",
      },
    },
    Divider: {
      baseStyle: {
        opacity: 1,
      },
    },
    FormLabel: {
      baseStyle: {
        fontSize: "sm",
        fontWeight: "medium",
        mb: "1",
        _dark: { color: "gray.300" },
      },
    },
    Input: {
      baseStyle: {
        addon: {
          borderColor: "border !important",
          _placeholder: {
            color: "text-inactive",
          },
        },
        field: {
          _placeholder: {
            color: "text-inactive",
          },
          _focusVisible: {
            boxShadow: "none",
          },
          _disabled: {
            _dark: {
              color: "whiteAlpha.100",
            },
          },
        },
      },
      variants: {
        outline: {
          borderColor: "border",
          addon: {
            borderColor: "border !important",
            _placeholder: {
              color: "text-inactive",
            },
          },
        },
      },
    },

    Table: {
      baseStyle: {
        table: {
          borderCollapse: "separate",
          borderSpacing: 0,
        },
        thead: {
          borderBottomColor: "border",
        },
        th: {
          background: "th-bg",
          borderColor: "border !important",
          borderBottomColor: "border !important",
          borderTop: "1px solid ",
          borderTopColor: "border !important",
          _first: {
            borderLeft: "1px solid",
            borderColor: "border !important",
          },
          _last: {
            borderRight: "1px solid",
            borderColor: "border !important",
          },
        },
        td: {
          transition: "all .1s ease-out",
          borderColor: "border",
          borderBottomColor: "border !important",
          background: "td-bg",
          _first: {
            borderLeft: "1px solid",
            borderColor: "border",
          },
          _last: {
            borderRight: "1px solid",
            borderColor: "border",
          },
        },
        tr: {
          "&.interactive": {
            cursor: "pointer",
            _hover: {
              "& > td": {
                bg: "td-hover",
              },
            },
          },
          _last: {
            "& > td": {
              _first: {
                borderBottomLeftRadius: "8px",
              },
              _last: {
                borderBottomRightRadius: "8px",
              },
            },
          },
        },
      },
    },
  },
});
