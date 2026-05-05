import { StyleSheet } from "react-native";
import { colors, spacing } from "@/lib/theme";

/**
 * Shared styles for short-answer + essay-prompt exercise bodies.
 */
export const textResponseStyles = StyleSheet.create({
  prompt: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.ink,
    lineHeight: 26,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 16,
    padding: spacing.lg,
    shadowColor: colors.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 3, height: 3 },
    elevation: 3,
  },
  textInput: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.ink,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    minHeight: 80,
    color: colors.ink,
    shadowColor: colors.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 3, height: 3 },
    elevation: 3,
  },
  textInputTall: { minHeight: 200, textAlignVertical: "top" },
  textInputFocused: {
    borderColor: colors.short,
    shadowOffset: { width: 4, height: 4 },
  },
  textInputDisabled: { opacity: 0.6 },

  metaPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.paperAlt,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.ink,
    overflow: "hidden",
  },
  metaPillText: {
    fontSize: 12,
    color: colors.ink,
    fontWeight: "700",
  },
  rubricCard: {
    backgroundColor: colors.shortSoft,
    borderWidth: 2,
    borderColor: colors.ink,
    padding: spacing.lg,
    borderRadius: 14,
    gap: spacing.sm,
  },
  rubricTitle: {
    fontSize: 11,
    fontWeight: "900",
    color: colors.short,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  rubricRow: { flexDirection: "row", gap: 8 },
  rubricBullet: { color: colors.short, fontSize: 16, fontWeight: "900" },
  rubricText: {
    flex: 1,
    fontSize: 14,
    color: colors.ink2,
    lineHeight: 20,
  },
});
