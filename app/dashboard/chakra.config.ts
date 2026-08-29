import { extendTheme } from "@chakra-ui/react";

/**
 * Chakra retuned to the Xenith design system, for the dialogs that have not
 * been rewritten on it yet: square corners, hairline borders, the accent ramp
 * and the Barlow/IBM Plex Mono type. Colours mirror the --xn-* tokens in
 * src/xenith/xenith.css; change them there first.
 */
const accent = {
  50: "#eef6ff",
  100: "#eef6ff",
  200: "#d6ebff",
  300: "#b5d9fd",
  400: "#94bce3",
  500: "#5980a6",
  600: "#597ea3",
  700: "#416180",
  800: "#2c455d",
  900: "#1d2d3d",
};

const square = { borderRadius: 0 };

export const theme = extendTheme({
  config: { initialColorMode: "light", useSystemColorMode: false },
  shadows: { outline: "0 0 0 2px #5980a6" },
  radii: { none: 0, sm: 0, base: 0, md: 0, lg: 0, xl: 0, "2xl": 0, "3xl": 0, full: 0 },
  fonts: {
    body: `Barlow, system-ui, sans-serif`,
    heading: `"Barlow Condensed", system-ui, sans-serif`,
    mono: `"IBM Plex Mono", ui-monospace, monospace`,
  },
  colors: {
    "light-border": "#d2d2d4",
    primary: accent,
    accent,
    gray: {
      50: "#f5f5f8",
      100: "#f5f5f8",
      200: "#e7e7ea",
      300: "#d4d4d7",
      400: "#b7b7ba",
      500: "#98989b",
      600: "#7a7a7d",
      700: "#5d5d60",
      750: "#424244",
      800: "#424244",
      900: "#2b2b2d",
    },
  },
  styles: {
    global: {
      body: { background: "#f2f2f3", color: "#1d1f20" },
    },
  },
  components: {
    Alert: { baseStyle: { container: { ...square, fontSize: "sm" } } },
    Badge: { baseStyle: square },
    Button: {
      baseStyle: {
        ...square,
        fontFamily: `"Barlow Condensed", system-ui, sans-serif`,
        fontWeight: 600,
        letterSpacing: "0.01em",
      },
    },
    Modal: {
      baseStyle: {
        overlay: { background: "rgba(43,43,45,0.5)", backdropFilter: "none" },
        dialog: { ...square, background: "#f2f2f3", border: "1px solid rgba(29,31,32,0.16)", boxShadow: "none" },
        header: { fontFamily: `"Barlow Condensed", system-ui, sans-serif`, fontWeight: 600 },
      },
    },
    Menu: { baseStyle: { list: { ...square, boxShadow: "none", borderColor: "rgba(29,31,32,0.16)" }, item: square } },
    Popover: { baseStyle: { content: { ...square, boxShadow: "none" } } },
    Tooltip: { baseStyle: square },
    Tag: { baseStyle: { container: square } },
    Select: { baseStyle: { field: { ...square, borderColor: "rgba(29,31,32,0.16)" } } },
    FormHelperText: { baseStyle: { fontSize: "xs" } },
    FormLabel: {
      baseStyle: {
        fontSize: "10.5px",
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        fontWeight: 400,
        color: "gray.600",
        mb: "1.5",
      },
    },
    Input: {
      baseStyle: {
        addon: square,
        field: {
          ...square,
          background: "#e9e9ea",
          borderColor: "rgba(29,31,32,0.16)",
          _focusVisible: { boxShadow: "none", borderColor: "#5980a6", outlineColor: "#5980a6" },
          _placeholder: { color: "gray.500" },
        },
      },
    },
    Textarea: { baseStyle: { ...square, background: "#e9e9ea", borderColor: "rgba(29,31,32,0.16)" } },
    NumberInput: { baseStyle: { field: square } },
    Table: {
      baseStyle: {
        table: { borderCollapse: "collapse" },
        th: {
          background: "transparent",
          borderColor: "rgba(29,31,32,0.16) !important",
          fontFamily: `Barlow, system-ui, sans-serif`,
          letterSpacing: "0.08em",
          fontWeight: 400,
        },
        td: { borderColor: "rgba(29,31,32,0.16)" },
      },
    },
  },
});
