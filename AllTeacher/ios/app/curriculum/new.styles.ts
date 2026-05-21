import { StyleSheet } from "react-native";

import { colors, radii, shadow, spacing, type } from "@/lib/theme";

export const newCurriculumStyles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  eyebrow: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginTop: spacing.md,
  },
  title: {
    fontSize: 36,
    fontWeight: "900",
    color: colors.textOnDark,
    letterSpacing: -0.6,
    lineHeight: 40,
  },
  subtitle: {
    fontSize: 15,
    color: "rgba(255,255,255,0.92)",
    lineHeight: 22,
    marginBottom: spacing.sm,
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadow.card,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.brand,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  fieldHint: { fontSize: 13, color: colors.textMuted },

  textarea: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: "transparent",
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    minHeight: 110,
    textAlignVertical: "top",
    color: colors.text,
  },

  suggestionsLabel: {
    ...type.label,
    marginTop: spacing.sm,
  },
  suggestionsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  suggestionChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.brandSoft,
  },
  suggestionText: {
    fontSize: 13,
    color: colors.brandDeep,
    fontWeight: "600",
  },

  cancel: { paddingVertical: spacing.md, alignItems: "center" },
  cancelText: { color: colors.textOnDark, fontSize: 14, fontWeight: "600" },
});
