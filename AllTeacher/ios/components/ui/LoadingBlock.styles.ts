import { StyleSheet } from "react-native";

import { spacing } from "@/lib/theme";

export const loadingBlockStyles = StyleSheet.create({
  center: {
    alignItems: "center",
    gap: 8,
    paddingVertical: spacing.xxl,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
  },
});
