import { StyleSheet } from "react-native";

import { colors, radii, shadow, spacing } from "@/lib/theme";

export const finishedViewStyles = StyleSheet.create({
  hero: {
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  eyebrow: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 32,
    fontWeight: "900",
    color: colors.textOnDark,
    letterSpacing: -0.4,
    lineHeight: 38,
  },
  sub: {
    fontSize: 15,
    color: "rgba(255,255,255,0.92)",
    lineHeight: 22,
  },

  scoreCard: {
    backgroundColor: colors.surface,
    padding: spacing.xl,
    borderRadius: radii.xl,
    alignItems: "center",
    gap: spacing.xs,
    ...shadow.raised,
  },
  scoreNumber: {
    fontSize: 64,
    fontWeight: "900",
    color: colors.brandDeep,
    letterSpacing: -2,
  },
  scoreLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
});
