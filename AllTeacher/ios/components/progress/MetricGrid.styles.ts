import { StyleSheet } from "react-native";
import { colors, spacing } from "@/lib/theme";

export const metricGridStyles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  cell: {
    flexBasis: "48%",
    flexGrow: 1,
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: spacing.md,
    borderWidth: 2,
    borderColor: colors.ink,
    shadowColor: colors.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 3, height: 3 },
    elevation: 3,
  },
  label: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: colors.ink3,
    marginBottom: 4,
  },
  value: {
    fontSize: 24,
    fontWeight: "900",
    color: colors.ink,
    letterSpacing: -0.5,
  },
  hint: { fontSize: 12, color: colors.ink3, marginTop: 2 },
});
