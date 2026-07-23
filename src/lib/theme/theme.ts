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
declare module "@mui/material/Typography" {
  interface TypographyPropsVariantOverrides {
    actionPill: true;
    actionPillBackward: true;
    animatedUnderline: true;
  }
}

export const theme = createTheme({
  cssVariables: { colorSchemeSelector: "class" },
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
    MuiCssBaseline: {
      styleOverrides: `
        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        ::-webkit-scrollbar-track {
          background: transparent;
        }
        ::-webkit-scrollbar-thumb {
          background-color: var(--mui-palette-primary-main);
          border-radius: 8px;
          border: 2px solid transparent;
          background-clip: content-box;
          opacity: 0.8;
        }
        ::-webkit-scrollbar-thumb:hover {
          background-color: var(--mui-palette-primary-dark);
        }
      `,
    },
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
    MuiPaper: { 
      styleOverrides: { 
        root: ({ theme }) => ({ 
          backgroundImage: "none",
          boxShadow: "var(--mui-shadows-1)",
          borderColor: theme.vars?.palette?.divider,
        }) 
      } 
    },
    MuiCard: {
      styleOverrides: {
        root: ({ theme }) => ({
          backgroundImage: "none",
          boxShadow: "var(--mui-shadows-1)",
        })
      }
    },
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
    MuiLink: {
      variants: [
        {
          props: { variant: "actionPill" },
          style: {
            display: "inline-flex",
            alignItems: "center",
            fontWeight: 600,
            color: "var(--mui-palette-text-secondary)",
            padding: "4px 12px",
            borderRadius: "100px",
            transition: "all 0.2s ease",
            textDecoration: "none",
            "&:hover": {
              backgroundColor: "var(--mui-palette-primary-main)",
              color: "var(--mui-palette-primary-contrastText)",
              "&::after": {
                width: 14,
                opacity: 1,
                transform: "translateX(2px)",
                marginLeft: 4,
              }
            },
            "&::after": {
              content: '"→"',
              fontFamily: "var(--font-geist-sans), sans-serif",
              display: "inline-block",
              width: 0,
              opacity: 0,
              transform: "translateX(-4px)",
              transition: "all 0.2s ease",
              overflow: "hidden",
            }
          }
        },
        {
          props: { variant: "actionPillBackward" },
          style: {
            display: "inline-flex",
            alignItems: "center",
            fontWeight: 600,
            color: "var(--mui-palette-text-secondary)",
            padding: "4px 12px",
            borderRadius: "100px",
            transition: "all 0.2s ease",
            textDecoration: "none",
            "&:hover": {
              backgroundColor: "var(--mui-palette-primary-main)",
              color: "var(--mui-palette-primary-contrastText)",
              "&::before": {
                width: 14,
                opacity: 1,
                transform: "translateX(-2px)",
                marginRight: 4,
              }
            },
            "&::before": {
              content: '"←"',
              fontFamily: "var(--font-geist-sans), sans-serif",
              display: "inline-block",
              width: 0,
              opacity: 0,
              transform: "translateX(4px)",
              transition: "all 0.2s ease",
              overflow: "hidden",
            }
          }
        },
        {
          props: { variant: "animatedUnderline" },
          style: {
            position: "relative",
            display: "inline-block",
            textDecoration: "none",
            fontWeight: 500,
            transition: "color 0.2s ease",
            "&:hover": {
              color: "var(--mui-palette-primary-main)",
              textDecoration: "none",
            },
            "&::after": {
              content: '""',
              position: "absolute",
              bottom: -2,
              left: 0,
              width: "100%",
              height: "2px",
              borderRadius: "2px",
              backgroundColor: "var(--mui-palette-primary-main)",
              transform: "scaleX(0)",
              transformOrigin: "left",
              transition: "transform 0.3s ease",
            },
            "&:hover::after": { transform: "scaleX(1)" },
          },
        }
      ]
    },
  },
});

export default theme;
