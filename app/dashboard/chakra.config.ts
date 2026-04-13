import { extendTheme } from "@chakra-ui/react";
export const theme = extendTheme({
  config: {
    initialColorMode: "dark",
    useSystemColorMode: false,
  },
  shadows: { outline: "0 0 0 2px var(--accent-glow, rgba(59,130,246,0.3))" },
  fonts: {
    body: `Inter,-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Oxygen,Ubuntu,Cantarell,Fira Sans,Droid Sans,Helvetica Neue,sans-serif`,
  },
  styles: {
    global: {
      body: {
        bg: "transparent",
        _dark: {
          bg: "transparent",
        },
      },
    },
  },
  colors: {
    "light-border": "rgba(255, 255, 255, 0.2)",
    primary: {
      50: "#9cb7f2",
      100: "#88a9ef",
      200: "#749aec",
      300: "#618ce9",
      400: "#4d7de7",
      500: "#396fe4",
      600: "#3364cd",
      700: "#2e59b6",
      800: "#284ea0",
      900: "#224389",
    },
    gray: {
      750: "rgba(30, 41, 59, 0.7)",
    },
  },
  components: {
    Alert: {
      baseStyle: {
        container: {
          borderRadius: "12px",
          fontSize: "sm",
          backdropFilter: "blur(12px)",
        },
      },
    },
    Select: {
      baseStyle: {
        field: {
          _dark: {
            borderColor: "rgba(255,255,255,0.1)",
            borderRadius: "12px",
            bg: "rgba(15, 23, 42, 0.4)",
          },
          _light: {
            borderRadius: "12px",
            bg: "rgba(255,255,255,0.3)",
          },
        },
      },
    },
    FormHelperText: {
      baseStyle: {
        fontSize: "xs",
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
          _dark: {
            borderColor: "rgba(255,255,255,0.1)",
            _placeholder: {
              color: "gray.500",
            },
          },
        },
        field: {
          borderRadius: "12px",
          _focusVisible: {
            boxShadow: "0 0 0 2px var(--accent-glow)",
            borderColor: "var(--accent-primary)",
            outlineColor: "var(--accent-primary)",
          },
          _dark: {
            borderColor: "rgba(255,255,255,0.1)",
            bg: "rgba(15, 23, 42, 0.4)",
            _disabled: {
              color: "gray.400",
              borderColor: "rgba(255,255,255,0.05)",
            },
            _placeholder: {
              color: "gray.500",
            },
          },
          _light: {
            bg: "rgba(255,255,255,0.3)",
            borderColor: "rgba(255,255,255,0.3)",
          },
        },
      },
    },
    Button: {
      baseStyle: {
        borderRadius: "12px",
        fontWeight: "600",
      },
    },
    Menu: {
      baseStyle: {
        list: {
          borderRadius: "16px",
          border: "1px solid",
          borderColor: "rgba(255,255,255,0.1)",
          backdropFilter: "blur(20px)",
          _dark: {
            bg: "rgba(15, 23, 42, 0.8)",
          },
          _light: {
            bg: "rgba(255, 255, 255, 0.8)",
          },
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.2)",
        },
        item: {
          borderRadius: "8px",
          mx: "1",
          _dark: {
            bg: "transparent",
            _hover: {
              bg: "rgba(255,255,255,0.08)",
            },
          },
          _light: {
            bg: "transparent",
            _hover: {
              bg: "rgba(0,0,0,0.05)",
            },
          },
        },
      },
    },
    Modal: {
      baseStyle: {
        dialog: {
          borderRadius: "20px",
          border: "1px solid rgba(255,255,255,0.1)",
          _dark: {
            bg: "rgba(15, 23, 42, 0.85)",
            backdropFilter: "blur(20px)",
          },
          _light: {
            bg: "rgba(255, 255, 255, 0.85)",
            backdropFilter: "blur(20px)",
          },
        },
        overlay: {
          backdropFilter: "blur(8px)",
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
          borderBottomColor: "rgba(255,255,255,0.1)",
        },
        th: {
          background: "rgba(255,255,255,0.15)",
          borderColor: "rgba(255,255,255,0.15) !important",
          borderBottomColor: "rgba(255,255,255,0.15) !important",
          borderTop: "1px solid ",
          borderTopColor: "rgba(255,255,255,0.15) !important",
          _first: {
            borderLeft: "1px solid",
            borderColor: "rgba(255,255,255,0.15) !important",
          },
          _last: {
            borderRight: "1px solid",
            borderColor: "rgba(255,255,255,0.15) !important",
          },
          _dark: {
            borderColor: "rgba(255,255,255,0.08) !important",
            background: "rgba(15, 23, 42, 0.5)",
          },
        },
        td: {
          transition: "all .2s ease-out",
          borderColor: "rgba(255,255,255,0.1)",
          borderBottomColor: "rgba(255,255,255,0.1) !important",
          _first: {
            borderLeft: "1px solid",
            borderColor: "rgba(255,255,255,0.1)",
            _dark: {
              borderColor: "rgba(255,255,255,0.06)",
            },
          },
          _last: {
            borderRight: "1px solid",
            borderColor: "rgba(255,255,255,0.1)",
            _dark: {
              borderColor: "rgba(255,255,255,0.06)",
            },
          },
          _dark: {
            borderColor: "rgba(255,255,255,0.06)",
            borderBottomColor: "rgba(255,255,255,0.06) !important",
          },
        },
        tr: {
          "&.interactive": {
            cursor: "pointer",
            _hover: {
              "& > td": {
                bg: "rgba(255,255,255,0.08)",
              },
              _dark: {
                "& > td": {
                  bg: "rgba(255,255,255,0.04)",
                },
              },
            },
          },
          _last: {
            "& > td": {
              _first: {
                borderBottomLeftRadius: "12px",
              },
              _last: {
                borderBottomRightRadius: "12px",
              },
            },
          },
        },
      },
    },
  },
});
