import { StyleSheet } from "react-native";

import { colors, radii, shadow, spacing } from "@/lib/theme";

export const questionViewStyles = StyleSheet.create({
  header: {
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  progressRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: spacing.xs,
  },
  progressDot: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.32)",
  },
  progressDotActive: {
    backgroundColor: colors.textOnDark,
  },
  eyebrow: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginTop: spacing.sm,
  },
  title: {
    fontSize: 30,
    fontWeight: "900",
    color: colors.textOnDark,
    letterSpacing: -0.4,
    lineHeight: 36,
  },

  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    ...shadow.card,
  },
  optionDisabled: { opacity: 0.5 },
  optionPressed: {
    transform: [{ scale: 0.99 }],
    backgroundColor: colors.brandSoft,
  },
  optionDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.brandSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  optionDotText: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.brandDeep,
  },
  optionText: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    lineHeight: 22,
  },
});
