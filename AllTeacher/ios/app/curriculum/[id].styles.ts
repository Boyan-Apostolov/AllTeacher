import { StyleSheet } from "react-native";
import { colors, radii, spacing } from "@/lib/theme";

export const curriculumScreenStyles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    gap: spacing.lg,
    paddingBottom: 60,
  },

  emptyCard: {
    backgroundColor: colors.card,
    padding: spacing.lg,
    borderRadius: radii.xl,
    gap: spacing.sm,
    borderWidth: 2,
    borderColor: colors.ink,
    shadowColor: colors.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 3, height: 3 },
    elevation: 3,
  },
  emptyText: { fontSize: 14, color: colors.ink, lineHeight: 20, fontWeight: "500" },

  // Action buttons ("Add more sessions" / "Make it harder")
  actionRow: { flexDirection: "row", gap: spacing.sm },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: colors.ink,
    minHeight: 44,
    shadowColor: colors.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 3, height: 3 },
    elevation: 3,
  },
  actionBtnPrimary: { backgroundColor: colors.brand },
  actionBtnSecondary: { backgroundColor: colors.mc },
  actionBtnDisabled: { opacity: 0.5 },
  actionBtnText: { color: "#fff", fontSize: 13, fontWeight: "800", textAlign: "center" },

  actionBanner: {
    backgroundColor: colors.okSoft,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 2,
    borderColor: colors.ink,
  },
  actionBannerText: { fontSize: 13, color: colors.ink, lineHeight: 18, fontWeight: "600" },
});
