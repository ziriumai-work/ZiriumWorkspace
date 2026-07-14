"use client";

// MUI theme built from the brand color system in colors.js. CSS variables are
// enabled with the `media` color-scheme selector so light/dark follows the OS
// preference — the same behavior the app had with plain CSS variables.

import { createTheme } from "@mui/material/styles";
import { blue, neutral, green, amber, red, light, dark } from "./colors";

declare module "@mui/material/styles" {
  interface Palette {
    surface: string;
    accentSoft: string;
  }
  interface PaletteOptions {
    surface?: string;
    accentSoft?: string;
  }
}

export const theme = createTheme({
  cssVariables: { colorSchemeSelector: "media" },
  colorSchemes: {
    light: {
      palette: {
        primary: {
          main: light.accent,
          light: blue[400],
          dark: blue[700],
          contrastText: light.accentForeground,
        },
        secondary: { main: neutral[600] },
        success: { main: green.main },
        warning: { main: amber.main },
        error: { main: red.main },
        info: { main: blue[500] },
        background: { default: light.background, paper: light.card },
        text: { primary: light.text, secondary: light.textMuted },
        divider: light.border,
        surface: light.surface,
        accentSoft: light.accentSoft,
      },
    },
    dark: {
      palette: {
        primary: {
          main: dark.accent,
          light: blue[300],
          dark: blue[600],
          contrastText: dark.accentForeground,
        },
        secondary: { main: neutral[300] },
        success: { main: green.main },
        warning: { main: amber.main },
        error: { main: red.main },
        info: { main: blue[400] },
        background: { default: dark.background, paper: dark.card },
        text: { primary: dark.text, secondary: dark.textMuted },
        divider: dark.border,
        surface: dark.surface,
        accentSoft: dark.accentSoft,
      },
    },
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily:
      "var(--font-geist-sans), ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    button: { textTransform: "none", fontWeight: 600 },
    h1: { fontSize: "1.5rem", fontWeight: 600, letterSpacing: "-0.02em" },
    h2: { fontSize: "1.125rem", fontWeight: 600, letterSpacing: "-0.01em" },
    subtitle2: { fontWeight: 600 },
  },
  components: {
    MuiButton: {
      defaultProps: { size: "small", disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 8 },
      },
    },
    MuiTextField: { defaultProps: { size: "small" } },
    MuiSelect: { defaultProps: { size: "small" } },
    MuiChip: { defaultProps: { size: "small" } },
    MuiTable: { defaultProps: { size: "small" } },
    MuiTooltip: { defaultProps: { arrow: true } },
    MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } },
    MuiDialog: {
      styleOverrides: {
        paper: { borderRadius: 16 },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: { borderRadius: 12 },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: { root: { borderRadius: 8 } },
    },
  },
});

export default theme;
