import { StyleSheet } from "react-native";

import { colors, radii, spacing } from "@/lib/theme";

export const languagePickerStyles = StyleSheet.create({
  hint: { fontSize: 13, color: colors.textMuted },
  chipsRow: {
    gap: spacing.sm,
    paddingVertical: 6,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: {
    borderColor: colors.brand,
    backgroundColor: colors.brandSoft,
  },
  chipFlag: { fontSize: 14 },
  chipText: { fontSize: 14, color: colors.text },
  chipTextActive: { color: colors.brandDeep, fontWeight: "700" },
  input: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: "transparent",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
  },
});
