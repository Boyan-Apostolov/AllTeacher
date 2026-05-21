import { StyleSheet } from "react-native";

import { colors, radii, shadow, spacing } from "@/lib/theme";

export const sessionScreenStyles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  emptyCard: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: radii.xl,
    ...shadow.card,
  },
  emptyText: { fontSize: 15, color: colors.text, lineHeight: 22 },
});
