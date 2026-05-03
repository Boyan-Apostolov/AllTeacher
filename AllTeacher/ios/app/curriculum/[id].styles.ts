import { StyleSheet } from "react-native";

import { colors, radii, shadow, spacing } from "@/lib/theme";

export const curriculumScreenStyles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  emptyCard: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: radii.xl,
    gap: spacing.sm,
    ...shadow.card,
  },
  emptyText: { fontSize: 14, color: colors.text, lineHeight: 20 },

  // ── Action buttons ("Add more sessions" / "Make it harder") ────────────
  actionRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.lg,
    minHeight: 44,
    ...shadow.card,
  },
  actionBtnPrimary: {
    backgroundColor: colors.brand,
  },
  actionBtnSecondary: {
    backgroundColor: "#e8530a",
  },
  actionBtnDisabled: {
    opacity: 0.6,
  },
  actionBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  actionBanner: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.brand,
  },
  actionBannerText: {
    fontSize: 13,
    color: colors.text,
    lineHeight: 18,
  },
});
