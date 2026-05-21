import { StyleSheet } from "react-native";

import { colors, radii, shadow, spacing } from "@/lib/theme";

export const weekProgressListStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadow.card,
  },
  header: {
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: colors.text,
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  index: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.brandSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  indexComplete: { backgroundColor: colors.successSoft },
  indexBonus: { backgroundColor: colors.accentSoft },
  indexText: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.brandDeep,
  },
  indexCompleteText: { color: "#15803d" },
  indexBonusText: { color: "#9d174d" },

  body: { flex: 1, gap: 2 },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  title: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    fontWeight: "700",
  },
  bonusBadge: {
    fontSize: 10,
    fontWeight: "800",
    color: "#9d174d",
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.pill,
  },
  meta: { fontSize: 12, color: colors.textMuted },

  scoreCol: { alignItems: "flex-end", minWidth: 56 },
  scoreText: { fontSize: 14, fontWeight: "800", color: colors.text },
  scoreLabel: { fontSize: 10, color: colors.textFaint },

  empty: {
    fontSize: 13,
    color: colors.textMuted,
    fontStyle: "italic",
    paddingVertical: spacing.sm,
  },
});
