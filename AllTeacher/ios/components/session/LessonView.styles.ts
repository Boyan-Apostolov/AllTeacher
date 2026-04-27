import { StyleSheet } from "react-native";

import { colors, radii, shadow, spacing } from "@/lib/theme";

export const lessonViewStyles = StyleSheet.create({
  container: {
    gap: spacing.lg,
  },
  header: {
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  kindRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  kindPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255,255,255,0.92)",
  },
  kindEmoji: { fontSize: 14 },
  kindText: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.brandDeep,
    letterSpacing: 0.4,
  },
  kindCount: {
    fontSize: 12,
    fontWeight: "700",
    color: "rgba(255,255,255,0.85)",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 24,
    fontWeight: "900",
    color: colors.textOnDark,
    letterSpacing: -0.3,
    lineHeight: 30,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.xl,
    gap: spacing.lg,
    ...shadow.card,
  },
  intro: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.text,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.brand,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  bulletDot: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.brand,
    fontWeight: "900",
  },
  bulletText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
  },
  exampleBox: {
    backgroundColor: colors.brandSoft,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  exampleText: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
  },
  pitfallBox: {
    backgroundColor: colors.warningSoft,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  pitfallLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.warning,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  nextUp: {
    fontSize: 14,
    lineHeight: 20,
    fontStyle: "italic",
    color: colors.textMuted,
    paddingHorizontal: spacing.xs,
  },
});
