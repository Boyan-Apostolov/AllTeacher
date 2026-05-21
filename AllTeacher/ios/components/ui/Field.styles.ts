import { StyleSheet } from "react-native";

import { colors, radii } from "@/lib/theme";

export const fieldStyles = StyleSheet.create({
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 6,
    marginLeft: 4,
  },
  input: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1.5,
    borderColor: "transparent",
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text,
  },
  inputFocused: {
    borderColor: colors.brand,
    backgroundColor: colors.surface,
  },
});
