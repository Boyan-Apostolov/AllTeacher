import { StyleSheet } from "react-native";

import { colors, radii, shadow, spacing } from "@/lib/theme";

export const listenChoiceStyles = StyleSheet.create({
  audioCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.md,
    alignItems: "center",
    ...shadow.card,
  },
  promptNative: {
    fontSize: 16,
    color: colors.text,
    textAlign: "center",
    lineHeight: 22,
  },
  playButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radii.pill,
    ...shadow.raised,
  },
  playButtonActive: {
    backgroundColor: colors.brandDeep,
  },
  playButtonPressed: {
    transform: [{ scale: 0.98 }],
  },
  playButtonDisabled: {
    opacity: 0.5,
  },
  playButtonIcon: {
    fontSize: 22,
    color: colors.textOnDark,
  },
  playButtonLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textOnDark,
    letterSpacing: 0.3,
  },
  audioError: {
    color: colors.danger,
    fontSize: 13,
    textAlign: "center",
  },
  audioTextFallback: {
    color: colors.text,
    fontSize: 16,
    fontStyle: "italic",
    textAlign: "center",
    paddingTop: spacing.xs,
  },
  lockHint: {
    color: colors.textMuted,
    fontSize: 12,
    fontStyle: "italic",
    textAlign: "center",
    paddingTop: spacing.xs,
  },
  transcriptCard: {
    backgroundColor: colors.brandSoft,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: 4,
  },
  transcriptLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.brandDeep,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  transcriptText: {
    fontSize: 16,
    color: colors.text,
    lineHeight: 22,
  },
});
