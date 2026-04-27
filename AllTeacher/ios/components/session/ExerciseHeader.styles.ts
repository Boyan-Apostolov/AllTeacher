import { StyleSheet } from "react-native";

import { colors, radii, spacing } from "@/lib/theme";

export const exerciseHeaderStyles = StyleSheet.create({
  block: {
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  kindRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  kindPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255,255,255,0.92)",
  },
  kindEmoji: { fontSize: 14 },
  kindText: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.brandDeep,
    letterSpacing: 0.4,
  },
  kindCount: {
    fontSize: 12,
    fontWeight: "700",
    color: "rgba(255,255,255,0.85)",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 24,
    fontWeight: "900",
    color: colors.textOnDark,
    letterSpacing: -0.3,
    lineHeight: 30,
  },
});
