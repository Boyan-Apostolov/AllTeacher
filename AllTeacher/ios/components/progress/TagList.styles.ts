import { StyleSheet } from "react-native";

import { colors, radii, shadow, spacing } from "@/lib/theme";

/**
 * Shared styles for the Weak / Strength tag lists. Same layout, different
 * accent — colour is passed in by the calling component.
 */
export const tagListStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadow.card,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  emoji: { fontSize: 18 },
  title: {
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: colors.text,
  },
  empty: {
    fontSize: 13,
    color: colors.textMuted,
    fontStyle: "italic",
    paddingVertical: spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    gap: spacing.sm,
  },
  rank: {
    width: 22,
    fontSize: 12,
    fontWeight: "800",
    color: colors.textFaint,
  },
  tag: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    fontWeight: "600",
  },
  count: {
    fontSize: 12,
    fontWeight: "700",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
});
