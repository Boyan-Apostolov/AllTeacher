import { StyleSheet } from "react-native";

import { colors, spacing } from "@/lib/theme";

export const summaryRowStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  icon: { fontSize: 20 },
  col: { flex: 1 },
  label: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.textFaint,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  value: {
    fontSize: 15,
    color: colors.text,
    marginTop: 2,
  },
});
