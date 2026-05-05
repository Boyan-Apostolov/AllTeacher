import { StyleSheet } from "react-native";
import { colors, spacing } from "@/lib/theme";

export const exerciseHeaderStyles = StyleSheet.create({
  block: {
    gap: spacing.sm,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  progressTrack: {
    flex: 1,
    height: 12,
    backgroundColor: colors.card,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.ink,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRightWidth: 2,
    borderRightColor: colors.ink,
  },
  countText: {
    fontSize: 13,
    fontWeight: "900",
    color: colors.ink,
    minWidth: 32,
    textAlign: "right",
  },
});
