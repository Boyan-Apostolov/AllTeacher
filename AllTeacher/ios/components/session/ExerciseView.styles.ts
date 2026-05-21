import { StyleSheet } from "react-native";

import { colors, radii, shadow, spacing } from "@/lib/theme";

export const exerciseViewStyles = StyleSheet.create({
  emptyCard: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: radii.xl,
    ...shadow.card,
  },
  emptyText: { fontSize: 15, color: colors.text, lineHeight: 22 },

  scoring: {
    alignItems: "center",
    gap: 8,
    paddingVertical: spacing.xxl,
  },
  scoringText: {
    fontSize: 13,
    color: colors.textOnDark,
    fontWeight: "600",
  },
});
