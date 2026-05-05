import { StyleSheet } from "react-native";
import { colors, spacing } from "@/lib/theme";

export const planViewStyles = StyleSheet.create({
  heroBlock: {
    gap: spacing.sm,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "900",
    color: colors.ink3,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginTop: spacing.sm,
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
  sectionHeader: {
    fontSize: 12,
    fontWeight: "900",
    color: colors.ink3,
    textTransform: "uppercase",
    letterSpacing: 1,
    paddingHorizontal: spacing.xs,
  },
  phaseCard: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 2,
    borderColor: colors.ink,
    shadowColor: colors.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 3, height: 3 },
    elevation: 3,
  },
  phaseStripe: {
    width: 4,
    borderRadius: 2,
    backgroundColor: colors.brand,
  },
  phaseCol: { flex: 1, gap: 4 },
  phaseName: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.ink,
  },
  phaseWeeks: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.brand,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  phaseDesc: {
    fontSize: 14,
    color: colors.ink2,
    lineHeight: 20,
  },
  emptyCard: {
    backgroundColor: colors.card,
    padding: spacing.lg,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.ink,
    shadowColor: colors.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 3, height: 3 },
    elevation: 3,
  },
  emptyText: {
    fontSize: 13,
    color: colors.ink3,
  },
});
