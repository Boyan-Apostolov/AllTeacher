import { StyleSheet } from "react-native";

import { colors, radii, shadow, spacing } from "@/lib/theme";

export const streakCardStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    ...shadow.card,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  flameWrap: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: spacing.sm,
  },
  flame: { fontSize: 32 },
  daysNumber: {
    fontSize: 30,
    fontWeight: "900",
    color: colors.text,
    letterSpacing: -0.4,
  },
  daysLabel: {
    fontSize: 14,
    color: colors.textMuted,
    marginLeft: 4,
  },
  bestPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.brandSoft,
  },
  bestText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.brandDeep,
  },

  heatmap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  cell: {
    width: 16,
    height: 16,
    borderRadius: 4,
    backgroundColor: colors.surfaceMuted,
    opacity: 0.18,
  },
  cellActive: {
    backgroundColor: colors.brand,
    opacity: 1,
  },
  cellToday: {
    borderWidth: 2,
    borderColor: colors.brandDeep,
  },

  legendRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.sm,
  },
  legendText: { fontSize: 11, color: colors.textFaint },
});
