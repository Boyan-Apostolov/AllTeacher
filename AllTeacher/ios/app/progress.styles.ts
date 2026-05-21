import { StyleSheet } from "react-native";

import { colors, radii, shadow, spacing } from "@/lib/theme";

export const progressScreenStyles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.xxl,
  },

  // Hero block above the cards.
  heroEyebrow: {
    color: "#ffffffcc",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  heroTitle: {
    color: colors.textOnDark,
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  heroSubtitle: {
    color: "#ffffffcc",
    fontSize: 14,
  },

  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },

  // Per-curriculum picker rows.
  curriculumCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadow.card,
  },
  curriculumRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  curriculumRowLast: { borderBottomWidth: 0 },
  curriculumEmoji: {
    fontSize: 22,
    width: 32,
    textAlign: "center",
  },
  curriculumBody: { flex: 1, gap: 2 },
  curriculumTitle: {
    fontSize: 15,
    color: colors.text,
    fontWeight: "700",
  },
  curriculumMeta: { fontSize: 12, color: colors.textMuted },
  curriculumScore: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.text,
    minWidth: 44,
    textAlign: "right",
  },

  empty: {
    fontSize: 13,
    color: colors.textMuted,
    fontStyle: "italic",
    paddingVertical: spacing.sm,
  },
});
