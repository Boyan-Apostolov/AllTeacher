import { StyleSheet } from "react-native";

import { colors, radii, spacing } from "@/lib/theme";

export const curriculumRowStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "stretch",
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  body: {
    flex: 1,
    flexDirection: "column",
    padding: spacing.md,
    gap: spacing.sm,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.brandSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  iconEmoji: { fontSize: 22 },
  titleCol: { flex: 1, gap: 4 },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  meta: { fontSize: 12, color: colors.textMuted },

  progressSection: { gap: 5 },
  progressStepLabel: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: "500",
  },

  removeBtn: {
    paddingHorizontal: 14,
    justifyContent: "center",
    alignItems: "center",
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
    backgroundColor: colors.dangerSoft,
  },
  removeBtnText: { fontSize: 22, color: colors.danger, fontWeight: "700" },
});
