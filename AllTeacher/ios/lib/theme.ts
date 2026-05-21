/**
 * AllTeacher design tokens.
 *
 * One source of truth for colors / type / spacing across all screens.
 * Goal: warm, modern, friendly — a learning app that feels like an app,
 * not a dashboard.
 */
import { Platform, StyleSheet } from "react-native";

export const colors = {
  // Background
  bg: "#1e1252",          // deep indigo — dark, not white
  surface: "#ffffff",
  surfaceMuted: "#2d1b6e",

  // Brand — friendly purple → magenta
  brand: "#7c5cff",
  brandDeep: "#5f3dff",
  brandSoft: "#efe9ff",
  accent: "#ff6ec4",
  accentSoft: "#ffe3f1",

  // Status
  success: "#22c55e",
  successSoft: "#dcfce7",
  warning: "#f59e0b",
  warningSoft: "#fff4d6",
  danger: "#ef4444",
  dangerSoft: "#ffe4e4",
  info: "#0ea5e9",
  infoSoft: "#e0f2fe",

  // Text
  text: "#1d1640",
  textMuted: "#6b6485",
  textFaint: "#9d97b3",
  textOnDark: "#ffffff",

  // Borders / dividers
  border: "#ece6f7",
  borderStrong: "#d9d0ee",
};

/**
 * Per-exercise-type accent palette. Legacy `essay_prompt` rows fall back
 * to `multiple_choice` colors via the `?? typeAccent.multiple_choice`
 * pattern at call sites — no separate entry needed.
 */
export const typeAccent: Record<
  "multiple_choice" | "flashcard" | "short_answer",
  { fg: string; bg: string; gradientFrom: string; gradientTo: string; emoji: string; label: string }
> = {
  multiple_choice: {
    fg: "#5f3dff",
    bg: "#efe9ff",
    gradientFrom: "#a78bfa",
    gradientTo: "#7c5cff",
    emoji: "🎯",
    label: "Multiple choice",
  },
  flashcard: {
    fg: "#0ea5e9",
    bg: "#e0f2fe",
    gradientFrom: "#67e8f9",
    gradientTo: "#0ea5e9",
    emoji: "🃏",
    label: "Flashcard",
  },
  short_answer: {
    fg: "#16a34a",
    bg: "#dcfce7",
    gradientFrom: "#86efac",
    gradientTo: "#16a34a",
    emoji: "✏️",
    label: "Short answer",
  },
};

export const radii = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
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

export const type = StyleSheet.create({
  display: {
    fontSize: 34,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: -0.5,
  },
  h1: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: -0.3,
  },
  h2: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
  },
  h3: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.text,
  },
  body: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 22,
  },
  bodyMuted: {
    fontSize: 15,
    color: colors.textMuted,
    lineHeight: 22,
  },
  caption: {
    fontSize: 13,
    color: colors.textMuted,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.brand,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textFaint,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
});

export const shadow = {
  card: {
    shadowColor: "#3b1e8a",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  raised: {
    shadowColor: "#3b1e8a",
    shadowOpacity: 0.16,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
};
