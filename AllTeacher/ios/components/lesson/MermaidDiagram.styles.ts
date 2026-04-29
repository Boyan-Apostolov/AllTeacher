import { StyleSheet } from "react-native";

import { colors, radii, spacing } from "@/lib/theme";

export const lessonMermaidStyles = StyleSheet.create({
  container: {
    backgroundColor: colors.brandSoft,
    borderRadius: radii.md,
    overflow: "hidden",
    // No shadow — the diagram already lives inside a shadowed card,
    // so doubling the elevation looks gaudy on iOS.
  },
  webview: {
    flex: 1,
    backgroundColor: "transparent",
  },
  fallback: {
    backgroundColor: colors.brandSoft,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  fallbackText: {
    color: colors.textMuted,
    fontSize: 12,
    fontStyle: "italic",
  },
});
