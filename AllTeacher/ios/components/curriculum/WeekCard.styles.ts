import { StyleSheet } from "react-native";

import { colors, radii, shadow, spacing } from "@/lib/theme";

export const weekCardStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: radii.xl,
    gap: spacing.sm,
    ...shadow.card,
  },
  cardComplete: {
    borderWidth: 2,
    borderColor: colors.success,
    backgroundColor: colors.successSoft,
  },
  cardUpcoming: {
    borderWidth: 2,
    borderColor: colors.brand,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  headerCol: { flex: 1 },
  badge: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: colors.textOnDark,
    fontSize: 14,
    fontWeight: "800",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flexWrap: "wrap",
  },
  title: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.text,
  },
  objective: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 19,
    marginTop: 2,
  },
  statusPillDone: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.pill,
    backgroundColor: colors.success,
  },
  statusPillDoneText: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.textOnDark,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  statusPillProgress: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.pill,
    backgroundColor: colors.warningSoft,
  },
  statusPillProgressText: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.warning,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },

  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 4,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.textFaint,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  modulesCol: { gap: spacing.sm },
  moduleRow: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "flex-start",
  },
  moduleCol: { flex: 1, gap: 2 },
  kindPill: {
    backgroundColor: colors.brandSoft,
    borderRadius: radii.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 2,
  },
  kindPillText: {
    fontSize: 11,
    color: colors.brandDeep,
    fontWeight: "800",
    textTransform: "lowercase",
  },
  moduleTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
  },
  moduleDesc: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
  },

  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  metaPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.pill,
  },
  metaPillText: {
    fontSize: 12,
    color: colors.text,
    fontWeight: "600",
  },
  focusText: {
    fontSize: 12,
    color: colors.textMuted,
    fontStyle: "italic",
  },

  cta: {
    marginTop: spacing.sm,
    borderRadius: radii.pill,
    overflow: "hidden",
  },
  ctaGradient: {
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaPressed: { transform: [{ scale: 0.98 }] },
  ctaText: {
    color: colors.textOnDark,
    fontSize: 15,
    fontWeight: "800",
  },
});
