import { StyleSheet } from "react-native";

import { colors, radii, shadow, spacing } from "@/lib/theme";

export const summaryViewStyles = StyleSheet.create({
  heroBlock: {
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
    fontSize: 30,
    fontWeight: "900",
    color: colors.textOnDark,
    letterSpacing: -0.4,
    lineHeight: 36,
  },
  sub: {
    fontSize: 15,
    color: "rgba(255,255,255,0.92)",
    lineHeight: 22,
  },
  card: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: radii.xl,
    gap: spacing.sm,
    ...shadow.card,
  },
  hint: {
    fontSize: 13,
    color: "rgba(255,255,255,0.85)",
    textAlign: "center",
    paddingHorizontal: spacing.lg,
  },
});
