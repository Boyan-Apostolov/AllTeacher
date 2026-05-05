import { StyleSheet } from "react-native";

import { colors, spacing } from "@/lib/theme";

const INK_SHADOW = {
  shadowColor: colors.ink,
  shadowOpacity: 1,
  shadowRadius: 0,
  shadowOffset: { width: 3, height: 3 },
  elevation: 3,
};

export const weekProgressListStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: spacing.lg,
    gap: spacing.sm,
    borderWidth: 2,
    borderColor: colors.ink,
    ...INK_SHADOW,
  },
  header: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: colors.ink3,
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
    borderRadius: 8,
    backgroundColor: colors.brandSoft,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: colors.ink,
  },
  indexComplete: { backgroundColor: colors.okSoft },
  indexBonus: { backgroundColor: colors.flashSoft },
  indexText: {
    fontSize: 12,
    fontWeight: "900",
    color: colors.brand,
  },
  indexCompleteText: { color: colors.ok },
  indexBonusText: { color: colors.flash },

  body: { flex: 1, gap: 2 },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  title: {
    flex: 1,
    fontSize: 15,
    color: colors.ink,
    fontWeight: "700",
  },
  bonusBadge: {
    fontSize: 10,
    fontWeight: "900",
    color: colors.flash,
    backgroundColor: colors.flashSoft,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.flash,
  },
  meta: { fontSize: 12, color: colors.ink3 },

  scoreCol: { alignItems: "flex-end", minWidth: 56 },
  scoreText: { fontSize: 14, fontWeight: "900", color: colors.brand },
  scoreLabel: { fontSize: 10, color: colors.ink3 },

  empty: {
    fontSize: 13,
    color: colors.ink3,
    fontStyle: "italic",
    paddingVertical: spacing.sm,
  },
});
