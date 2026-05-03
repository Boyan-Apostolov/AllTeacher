import { StyleSheet } from "react-native";
import { colors, spacing } from "@/lib/theme";

export const summaryViewStyles = StyleSheet.create({
  heroBlock: {
    gap: spacing.sm,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "900",
    color: colors.ink3,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 30,
    fontWeight: "900",
    color: colors.ink,
    letterSpacing: -0.4,
    lineHeight: 36,
  },
  sub: {
    fontSize: 15,
    color: colors.ink3,
    lineHeight: 22,
  },
  card: {
    backgroundColor: colors.card,
    padding: spacing.lg,
    borderRadius: 20,
    gap: spacing.sm,
    borderWidth: 2,
    borderColor: colors.ink,
    shadowColor: colors.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 4, height: 4 },
    elevation: 4,
  },
  hint: {
    fontSize: 13,
    color: colors.ink3,
    textAlign: "center",
    paddingHorizontal: spacing.lg,
  },
});
