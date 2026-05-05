import { StyleSheet } from "react-native";
import { colors, spacing } from "@/lib/theme";

export const feedbackCardStyles = StyleSheet.create({
  card: {
    padding: spacing.lg,
    borderRadius: 16,
    gap: spacing.sm,
    borderWidth: 2,
    borderColor: colors.ink,
    shadowColor: colors.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 4, height: 4 },
    elevation: 4,
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
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  score: {
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  body: {
    fontSize: 15,
    color: colors.ink2,
    lineHeight: 22,
  },
  block: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1.5,
    borderTopColor: "rgba(26,20,16,0.12)",
    gap: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: "900",
    color: colors.ink3,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
});
