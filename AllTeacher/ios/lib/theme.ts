/**
 * AllTeacher design tokens — neo-brutalist, warm.
 *
 * Palette: warm coral brand on cream paper, chunky ink borders,
 * offset box-shadows. Per-exercise type accents (purple/teal/gold).
 */
import { Platform, StyleSheet } from "react-native";

export const colors = {
  // Backgrounds
  bg: "#F0EEE9",           // warm off-white canvas
  paper: "#FBF4E6",        // cream page
  paperAlt: "#F1E8D4",     // slightly darker cream
  card: "#FFFFFF",

  // Brand — warm coral
  brand: "#FF6B3D",
  brandDark: "#E04A1C",
  brandSoft: "#FFE0D1",

  // Ink (borders + text)
  ink: "#1A1410",          // near-black — used for all borders
  ink2: "#3D3530",
  ink3: "#7A6F66",
  ink4: "#B5ACA3",
  line: "rgba(26,20,16,0.10)",

  // Exercise type accents
  mc: "#7C5CFF",           // multiple choice — purple
  mcSoft: "#E7DFFF",
  flash: "#0BC5C2",        // flashcard — teal
  flashSoft: "#CFF2F1",
  short: "#FFB020",        // short answer — gold
  shortSoft: "#FFE9B8",

  // Status
  ok: "#22A06B",
  okSoft: "#CDEBDB",
  warn: "#E84545",
  warnSoft: "#F8D8D8",
  amber: "#F2A100",
  amberSoft: "#FFF4D6",

  // Legacy aliases kept for compatibility with existing screens
  brand_legacy: "#7c5cff",
  brandDeep: "#5f3dff",
  brandSoft_legacy: "#efe9ff",
  success: "#22A06B",
  successSoft: "#CDEBDB",
  warning: "#F2A100",
  warningSoft: "#FFF4D6",
  danger: "#E84545",
  dangerSoft: "#F8D8D8",
  info: "#0BC5C2",
  infoSoft: "#CFF2F1",
  text: "#1A1410",
  textMuted: "#7A6F66",
  textFaint: "#B5ACA3",
  textOnDark: "#FFFFFF",
  surface: "#FFFFFF",
  surfaceMuted: "#F1E8D4",
  border: "#1A1410",
  borderStrong: "#1A1410",
};

/**
 * Per-exercise-type accent palette.
 * Legacy `essay_prompt` rows fall back to `multiple_choice`.
 */
export const typeAccent: Record<
  "multiple_choice" | "flashcard" | "short_answer",
  { fg: string; bg: string; gradientFrom: string; gradientTo: string; emoji: string; label: string }
> = {
  multiple_choice: {
    fg: "#7C5CFF",
    bg: "#E7DFFF",
    gradientFrom: "#A78BFA",
    gradientTo: "#7C5CFF",
    emoji: "🎯",
    label: "Multiple choice",
  },
  flashcard: {
    fg: "#0BC5C2",
    bg: "#CFF2F1",
    gradientFrom: "#67E8F9",
    gradientTo: "#0BC5C2",
    emoji: "🃏",
    label: "Flashcard",
  },
  short_answer: {
    fg: "#FFB020",
    bg: "#FFE9B8",
    gradientFrom: "#FFD166",
    gradientTo: "#FFB020",
    emoji: "✏️",
    label: "Short answer",
  },
};

export const radii = {
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
  pill: 999,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const fonts = {
  display: Platform.select({ ios: "System", default: "System" }),
};

/** Neo-brutalist offset shadow (hard edge, not blurred) */
export const brutalistShadow = (
  offsetX = 4,
  offsetY = 4,
  color = "#1A1410"
): object => ({
  shadowColor: color,
  shadowOpacity: 1,
  shadowRadius: 0,
  shadowOffset: { width: offsetX, height: offsetY },
  elevation: 4,
});

export const type = StyleSheet.create({
  display: {
    fontSize: 36,
    fontWeight: "900",
    color: colors.ink,
    letterSpacing: -1.2,
    lineHeight: 38,
  },
  h1: {
    fontSize: 28,
    fontWeight: "900",
    color: colors.ink,
    letterSpacing: -0.8,
    lineHeight: 30,
  },
  h2: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.ink,
    letterSpacing: -0.4,
  },
  h3: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.ink,
  },
  body: {
    fontSize: 15,
    color: colors.ink,
    lineHeight: 22,
    fontWeight: "500",
  },
  bodyMuted: {
    fontSize: 14,
    color: colors.ink3,
    lineHeight: 21,
    fontWeight: "500",
  },
  caption: {
    fontSize: 13,
    color: colors.ink3,
    fontWeight: "600",
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.brand,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.ink4,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
});

export const shadow = {
  card: {
    shadowColor: colors.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 3, height: 3 },
    elevation: 3,
  },
  raised: {
    shadowColor: colors.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 5, height: 5 },
    elevation: 5,
  },
};
