import { StyleSheet } from "react-native";
import { colors, spacing } from "@/lib/theme";

export const streakCardStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.brand,
    borderRadius: 20,
    padding: spacing.lg,
    borderWidth: 2.5,
    borderColor: colors.ink,
    shadowColor: colors.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 5, height: 5 },
    elevation: 5,
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
    fontSize: 36,
    fontWeight: "900",
    color: "#fff",
    letterSpacing: -1,
  },
  daysLabel: { fontSize: 15, color: "rgba(255,255,255,0.85)", marginLeft: 4 },
  bestPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.18)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.4)",
  },
  bestText: { fontSize: 12, fontWeight: "800", color: "#fff" },
  heatmap: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  cell: {
    width: 16,
    height: 16,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  cellActive: {
    backgroundColor: "#fff",
    opacity: 1,
  },
  cellToday: {
    borderWidth: 2,
    borderColor: colors.ink,
  },
  legendRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.sm,
  },
  legendText: { fontSize: 11, color: "rgba(255,255,255,0.75)" },
});
