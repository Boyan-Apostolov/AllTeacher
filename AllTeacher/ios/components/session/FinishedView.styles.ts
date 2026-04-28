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
    gap: spacing.md,
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

  // Per-exercise bar chart inside the score card.
  chart: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: spacing.xs,
    marginTop: spacing.sm,
    width: "100%",
    minHeight: 120,
  },
  chartCol: {
    flex: 1,
    maxWidth: 36,
    alignItems: "center",
    gap: spacing.xs,
  },
  chartBarTrack: {
    width: "100%",
    height: 96,
    borderRadius: radii.sm,
    backgroundColor: colors.brandSoft,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  chartBar: {
    width: "100%",
    borderRadius: radii.sm,
  },
  chartLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textMuted,
  },
  chartLegend: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  legendSwatch: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  legendText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: "600",
  },

  // Recap cards (weak areas / strengths).
  recapCard: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: radii.lg,
    gap: spacing.sm,
    ...shadow.card,
  },
  recapTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  recapRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  recapDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  recapText: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    lineHeight: 21,
  },

  // Bonus-drill prompt block.
  bonusCard: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: radii.lg,
    gap: spacing.sm,
    borderWidth: 2,
    borderColor: colors.accent,
    ...shadow.card,
  },
  bonusEyebrow: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.accent,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  bonusTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text,
  },
  bonusBlurb: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
  },
});
