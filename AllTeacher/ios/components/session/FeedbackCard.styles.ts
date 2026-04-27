import { StyleSheet } from "react-native";

import { colors, radii, shadow, spacing } from "@/lib/theme";

export const feedbackCardStyles = StyleSheet.create({
  card: {
    padding: spacing.lg,
    borderRadius: radii.xl,
    gap: spacing.sm,
    ...shadow.card,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  verdictRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  icon: { fontSize: 22 },
  verdict: {
    fontSize: 14,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  score: {
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  body: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  block: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.06)",
    gap: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
});
