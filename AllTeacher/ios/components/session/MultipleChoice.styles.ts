import { StyleSheet } from "react-native";

import { colors, radii, shadow, spacing } from "@/lib/theme";

export const multipleChoiceStyles = StyleSheet.create({
  prompt: {
    fontSize: 17,
    color: colors.text,
    lineHeight: 24,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    ...shadow.card,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderWidth: 2,
    borderColor: "transparent",
    ...shadow.card,
  },
  optionPressed: { transform: [{ scale: 0.99 }] },
  optionChosen: {
    borderColor: colors.brand,
    backgroundColor: colors.brandSoft,
  },
  optionCorrect: {
    borderColor: colors.success,
    backgroundColor: colors.successSoft,
  },
  optionWrong: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerSoft,
  },
  optionFaded: { opacity: 0.55 },
  optionDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.brandSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  optionDotCorrect: { backgroundColor: colors.success },
  optionDotWrong: { backgroundColor: colors.danger },
  optionDotText: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.brandDeep,
  },
  optionDotTextOnAccent: { color: colors.textOnDark },
  optionText: { flex: 1, fontSize: 16, color: colors.text, lineHeight: 22 },
});
