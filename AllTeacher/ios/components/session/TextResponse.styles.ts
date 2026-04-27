import { StyleSheet } from "react-native";

import { colors, radii, shadow, spacing } from "@/lib/theme";

/**
 * Shared styles for the short-answer + essay-prompt exercise bodies.
 * Both render a labelled prompt, an optional rubric/meta, and a multiline
 * text input that submits via the shared PrimaryCta.
 */
export const textResponseStyles = StyleSheet.create({
  prompt: {
    fontSize: 17,
    color: colors.text,
    lineHeight: 24,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    ...shadow.card,
  },
  textInput: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: "transparent",
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    minHeight: 80,
    color: colors.text,
    ...shadow.card,
  },
  textInputTall: { minHeight: 200, textAlignVertical: "top" },
  textInputFocused: { borderColor: colors.brand },
  textInputDisabled: { opacity: 0.7 },

  metaPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.pill,
    fontSize: 12,
    color: colors.text,
    fontWeight: "600",
    overflow: "hidden",
  },
  rubricCard: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: radii.lg,
    gap: spacing.sm,
    ...shadow.card,
  },
  rubricTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.brand,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  rubricRow: { flexDirection: "row", gap: 8 },
  rubricBullet: { color: colors.brand, fontSize: 16, fontWeight: "800" },
  rubricText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
});
