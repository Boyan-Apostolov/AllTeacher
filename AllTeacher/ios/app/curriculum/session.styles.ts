import { StyleSheet } from "react-native";
import { colors, spacing } from "@/lib/theme";

export const sessionScreenStyles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  emptyCard: {
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.ink,
    padding: spacing.lg,
    borderRadius: 16,
    shadowColor: colors.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 3, height: 3 },
    elevation: 3,
  },
  emptyText: { fontSize: 15, color: colors.ink2, lineHeight: 22 },
});
