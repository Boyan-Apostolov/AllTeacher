import { StyleSheet } from "react-native";

import { colors, radii, shadow, spacing } from "@/lib/theme";

export const planViewStyles = StyleSheet.create({
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
    marginTop: spacing.sm,
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

  sectionHeader: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.textOnDark,
    textTransform: "uppercase",
    letterSpacing: 1,
    paddingHorizontal: spacing.xs,
  },

  phaseCard: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadow.card,
  },
  phaseStripe: {
    width: 4,
    borderRadius: 2,
    backgroundColor: colors.brand,
  },
  phaseCol: { flex: 1, gap: 4 },
  phaseName: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.text,
  },
  phaseWeeks: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.brand,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  phaseDesc: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },

  emptyCard: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: radii.xl,
    ...shadow.card,
  },
  emptyText: {
    fontSize: 13,
    color: colors.textMuted,
  },
});
