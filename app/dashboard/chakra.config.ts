import { extendTheme } from "@chakra-ui/react";

/**
 * Panel theme.
 *
 * The stock Marzban theme drew every surface with a full 1px box and a fairly
 * saturated blue. This one follows the look the panel was redesigned towards:
 * one page tint, cards a shade above it, hairline borders, generous radii, and
 * an indigo accent that stays readable on both backgrounds.
 *
 * Colours are exposed as semantic tokens (`ui.*`) so components stop repeating
 * `_dark={{ borderColor: "gray.600" }}` at every call site.
 */
export const theme = extendTheme({
  fonts: {
    body: `Inter,-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica Neue,sans-serif`,
    heading: `Inter,-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica Neue,sans-serif`,
    mono: `ui-monospace,SFMono-Regular,SF Mono,Menlo,Consolas,Liberation Mono,monospace`,
  },

  // Tighter tracking on the big sizes — Inter reads cramped at its defaults
  // once headings get past ~20px.
  textStyles: {
    pageTitle: { fontSize: { base: "xl", md: "2xl" }, fontWeight: "600", letterSpacing: "-0.02em" },
    sectionTitle: { fontSize: "md", fontWeight: "600", letterSpacing: "-0.01em" },
    muted: { fontSize: "sm", color: "ui.textMuted" },
  },

  radii: { sm: "6px", md: "8px", lg: "10px", xl: "14px", "2xl": "18px" },

  shadows: {
    outline: "0 0 0 3px var(--chakra-colors-primary-alpha)",
    card: "0 1px 2px rgba(16,24,40,.04)",
    raised: "0 8px 24px -12px rgba(16,24,40,.28)",
  },

  colors: {
    // kept: plenty of stock Marzban components still reference it by name
    "light-border": "#e4e6eb",
    "primary-alpha": "rgba(92,124,250,.35)",
    primary: {
      50: "#edf2ff",
      100: "#dbe4ff",
      200: "#bac8ff",
      300: "#91a7ff",
      400: "#748ffc",
      500: "#5c7cfa",
      600: "#4c6ef5",
      700: "#4263eb",
      800: "#3b5bdb",
      900: "#364fc7",
    },
    // Dark surfaces: charcoal rather than pure black, so borders and elevation
    // stay visible without having to lift the whole page brightness.
    gray: {
      600: "#2f3136",
      650: "#292a2f",
      700: "#26272c",
      750: "#212226",
      800: "#1a1b1e",
      900: "#141517",
    },
  },

  semanticTokens: {
    colors: {
      "ui.page": { default: "#f6f7f9", _dark: "#1a1b1e" },
      "ui.surface": { default: "#ffffff", _dark: "#212226" },
      "ui.surfaceMuted": { default: "#f2f4f7", _dark: "#1e1f23" },
      "ui.surfaceHover": { default: "#f6f7f9", _dark: "#26272c" },
      "ui.border": { default: "#e4e6eb", _dark: "#2f3136" },
      "ui.borderStrong": { default: "#d3d7de", _dark: "#3a3d44" },
      "ui.text": { default: "#14161a", _dark: "#e8eaef" },
      "ui.textMuted": { default: "#6b7280", _dark: "#9298a4" },
      "ui.textFaint": { default: "#9aa1ac", _dark: "#6d727c" },
      "ui.accent": { default: "primary.600", _dark: "primary.400" },
      "ui.accentSubtle": { default: "#eef2ff", _dark: "rgba(92,124,250,.14)" },
    },
  },

  styles: {
    global: {
      body: {
        bg: "ui.page",
        color: "ui.text",
        fontFeatureSettings: `"cv02","cv03","cv04","tnum"`,
      },
      // A default scrollbar on a charcoal panel is the loudest thing on screen.
      "*::-webkit-scrollbar": { width: "10px", height: "10px" },
      "*::-webkit-scrollbar-thumb": {
        bg: "ui.borderStrong",
        borderRadius: "8px",
        border: "3px solid transparent",
        backgroundClip: "content-box",
      },
      "*::-webkit-scrollbar-track": { bg: "transparent" },
    },
  },

  components: {
    Alert: {
      baseStyle: { container: { borderRadius: "lg", fontSize: "sm" } },
    },

    Badge: {
      baseStyle: {
        borderRadius: "sm",
        textTransform: "none",
        fontWeight: "500",
        fontSize: "xs",
        px: "1.5",
        py: "0.5",
      },
    },

    Button: {
      baseStyle: { borderRadius: "md", fontWeight: "500" },
      variants: {
        outline: { borderColor: "ui.borderStrong", _hover: { bg: "ui.surfaceHover" } },
        ghost: { _hover: { bg: "ui.surfaceHover" } },
      },
    },

    Tooltip: {
      baseStyle: {
        borderRadius: "md",
        fontSize: "xs",
        px: "2.5",
        py: "1.5",
        maxW: "260px",
      },
    },

    Modal: {
      baseStyle: {
        dialog: { bg: "ui.surface", borderRadius: "xl" },
        header: { fontSize: "lg", fontWeight: "600" },
      },
    },

    Popover: {
      baseStyle: {
        content: {
          bg: "ui.surface",
          borderColor: "ui.border",
          borderRadius: "lg",
          boxShadow: "raised",
          _focusVisible: { boxShadow: "raised" },
        },
      },
    },

    Menu: {
      baseStyle: {
        list: {
          bg: "ui.surface",
          borderColor: "ui.border",
          borderRadius: "lg",
          boxShadow: "raised",
          py: "1",
        },
        item: { bg: "transparent", _hover: { bg: "ui.surfaceHover" }, fontSize: "sm" },
      },
    },

    Switch: { defaultProps: { colorScheme: "primary" } },
    Checkbox: { defaultProps: { colorScheme: "primary" } },
    Radio: { defaultProps: { colorScheme: "primary" } },
    Progress: { defaultProps: { colorScheme: "primary" } },
    Tabs: { defaultProps: { colorScheme: "primary" } },

    FormHelperText: { baseStyle: { fontSize: "xs" } },
    FormLabel: {
      baseStyle: {
        fontSize: "sm",
        fontWeight: "500",
        mb: "1.5",
        color: "ui.text",
      },
    },

    Input: {
      baseStyle: {
        addon: { borderColor: "ui.border", bg: "ui.surfaceMuted" },
        field: {
          borderRadius: "md",
          borderColor: "ui.border",
          _placeholder: { color: "ui.textFaint" },
          _hover: { borderColor: "ui.borderStrong" },
          _focusVisible: {
            borderColor: "primary.500",
            boxShadow: "0 0 0 3px var(--chakra-colors-primary-alpha)",
          },
          _disabled: { opacity: 0.55 },
        },
      },
    },

    Textarea: {
      baseStyle: {
        borderRadius: "md",
        borderColor: "ui.border",
        _placeholder: { color: "ui.textFaint" },
        _hover: { borderColor: "ui.borderStrong" },
        _focusVisible: {
          borderColor: "primary.500",
          boxShadow: "0 0 0 3px var(--chakra-colors-primary-alpha)",
        },
      },
    },

    Select: {
      baseStyle: {
        field: {
          borderRadius: "md",
          borderColor: "ui.border",
          _hover: { borderColor: "ui.borderStrong" },
          _focusVisible: {
            borderColor: "primary.500",
            boxShadow: "0 0 0 3px var(--chakra-colors-primary-alpha)",
          },
        },
      },
    },

    // Hairline rows instead of a full grid: the old style boxed every cell,
    // which made long tables look like a spreadsheet.
    Table: {
      baseStyle: {
        table: { borderCollapse: "separate", borderSpacing: 0 },
        th: {
          bg: "ui.surfaceMuted",
          color: "ui.textMuted",
          borderBottom: "1px solid",
          borderColor: "ui.border !important",
          borderBottomColor: "ui.border !important",
          textTransform: "none",
          letterSpacing: "0",
          fontSize: "xs",
          fontWeight: "500",
          _first: { borderTopLeftRadius: "lg" },
          _last: { borderTopRightRadius: "lg" },
        },
        td: {
          transition: "background .12s ease-out",
          borderBottom: "1px solid",
          borderColor: "ui.border",
          borderBottomColor: "ui.border !important",
        },
        tr: {
          "&.interactive": {
            cursor: "pointer",
            _hover: { "& > td": { bg: "ui.surfaceHover" } },
          },
          _last: {
            "& > td": {
              borderBottomWidth: { base: "1px", md: "0" },
              _first: { borderBottomLeftRadius: "lg" },
              _last: { borderBottomRightRadius: "lg" },
            },
          },
        },
      },
    },
  },
});
