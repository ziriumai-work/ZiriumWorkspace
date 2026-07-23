// Zirium AI brand color system — single source of truth for every color in the
// app. Brand values are sampled from public/logo.png (black Z + sky-blue Z on
// white, sky-blue "Ai" wordmark). The MUI theme (theme.ts) and any remaining
// CSS variables (globals.css) both derive from this file.

// ---------------------------------------------------------------------------
// Brand — the exact logo colors.
// ---------------------------------------------------------------------------
export const brand = {
  black: "#000000", // logo Z strokes + "Zirium" wordmark
  blue: "#3EC8F4", //  logo sky-blue strokes + "Ai" wordmark + sparkle
  white: "#FFFFFF", // logo background
};

// ---------------------------------------------------------------------------
// Sky-blue ramp built around the brand blue (#3EC8F4 = blue[400]).
// Lighter steps for soft backgrounds, darker steps for readable text/buttons.
// ---------------------------------------------------------------------------
export const blue = {
  50: "#EAF9FE",
  100: "#D0F2FD",
  200: "#A6E7FB",
  300: "#72D9F8",
  400: "#3EC8F4", // brand
  500: "#1AB3E8",
  600: "#0D93C7", // primary action color in light mode (readable on white)
  700: "#0F76A0",
  800: "#125F80",
  900: "#134E69",
};

// ---------------------------------------------------------------------------
// Neutrals derived from the brand black, cooled with a hint of the brand blue
// so grays harmonize with the sky-blue accent instead of fighting it.
// ---------------------------------------------------------------------------
export const neutral = {
  0: "#FFFFFF",
  50: "#F7F9FA",
  100: "#EFF2F4",
  200: "#E2E7EA",
  300: "#CBD3D8",
  400: "#9DA9B0",
  500: "#6E7B84",
  600: "#4F5B63",
  700: "#3B454C",
  800: "#262E33",
  900: "#15191C",
  950: "#0C0F11", // near the brand black, lifted just enough for dark surfaces
};

// ---------------------------------------------------------------------------
// Feedback / accent hues, tuned to sit well next to the sky blue.
// ---------------------------------------------------------------------------
export const green = { light: "#DCF5E9", main: "#2EA26E", dark: "#1E7A50" };
export const amber = { light: "#FBF0DA", main: "#DE9B26", dark: "#9F6E17" };
export const orange = { light: "#FCE9DD", main: "#E8793D", dark: "#B5541E" };
export const red = { light: "#FCE2E2", main: "#E5484D", dark: "#B22528" };
export const purple = { light: "#EFE9FB", main: "#8E6BD8", dark: "#6644B8" };
export const pink = { light: "#FBE5F1", main: "#E45FA3", dark: "#B93B7C" };
export const yellow = { light: "#FAF3D2", main: "#D9B024", dark: "#96781A" };

// ---------------------------------------------------------------------------
// Semantic surfaces per color scheme. These back both the MUI palette and the
// CSS variables in globals.css.
// ---------------------------------------------------------------------------
export const light = {
  background: neutral[50],
  surface: neutral[100], // slightly darker surface for variety, or keep 50
  card: neutral[0],
  border: neutral[200],
  text: neutral[900],
  textMuted: neutral[500],
  accent: blue[600], //      readable sky blue for text/buttons on white
  accentBright: blue[400], // the raw brand blue (icons, dots, highlights)
  accentSoft: blue[50], //   soft blue fill behind active nav / chips
  accentForeground: neutral[0],
};

export const dark = {
  background: neutral[950],
  surface: neutral[900],
  card: "#111517",
  border: neutral[800],
  text: neutral[100],
  textMuted: neutral[400],
  accent: blue[400], //      brand blue pops on dark backgrounds
  accentBright: blue[400],
  accentSoft: "#0E2A38", //  deep blue-tinted fill
  accentForeground: neutral[950],
};

// ---------------------------------------------------------------------------
// Domain color maps — one base hue per status/priority. Components render
// these as soft "badge" chips (see chipSx in projectMeta.ts).
// ---------------------------------------------------------------------------
export const projectStatus = {
  backlog: neutral[400],
  planned: blue[500],
  in_progress: amber.main,
  in_review: purple.main,
  done: green.main,
  archived: neutral[300],
};

export const projectPriority = {
  low: neutral[400],
  medium: blue[500],
  high: orange.main,
  urgent: red.main,
};

export const dailyTaskStatus = {
  todo: neutral[400],
  in_progress: amber.main,
  done: green.main,
  not_completed: red.main,
};

export const employeeStatus = {
  active: green.main,
  on_leave: amber.main,
  terminated: red.main,
  offboarded: neutral[400],
};

// Notion-table select/status option palette (keys match OptionColor in types).
export const optionColors = {
  gray: neutral[400],
  blue: blue[500],
  green: green.main,
  yellow: yellow.main,
  orange: orange.main,
  red: red.main,
  purple: purple.main,
  pink: pink.main,
};

const colors = {
  brand,
  blue,
  neutral,
  green,
  amber,
  orange,
  red,
  purple,
  pink,
  yellow,
  light,
  dark,
  projectStatus,
  projectPriority,
  dailyTaskStatus,
  employeeStatus,
  optionColors,
};

export default colors;
