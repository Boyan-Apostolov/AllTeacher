import { StyleSheet } from "react-native";

import { colors, radii, shadow, spacing } from "@/lib/theme";

export const metricGridStyles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  cell: {
    flexBasis: "48%",
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    ...shadow.card,
  },
  label: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: colors.textMuted,
    marginBottom: 4,
  },
  value: {
    fontSize: 22,
    fontWeight: "900",
    color: colors.text,
    letterSpacing: -0.4,
  },
  hint: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
});
