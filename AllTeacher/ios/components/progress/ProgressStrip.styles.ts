import { StyleSheet } from "react-native";

import { colors, radii, shadow, spacing } from "@/lib/theme";

export const progressStripStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadow.card,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: colors.textMuted,
  },
  replanBadge: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: colors.brandDeep,
    backgroundColor: colors.brandSoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "stretch",
    paddingVertical: spacing.sm,
  },
  stat: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  statValue: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
  },
  statLabel: {
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 0.2,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: 4,
  },
  lastActive: {
    fontSize: 12,
    color: colors.textFaint,
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  ctaBtn: {
    flex: 1,
    minWidth: 140,
    backgroundColor: colors.brand,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaBtnDisabled: { opacity: 0.6 },
  ctaBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  ghostBtn: {
    flex: 1,
    minWidth: 120,
    backgroundColor: colors.brandSoft,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  ghostBtnText: {
    color: colors.brandDeep,
    fontSize: 14,
    fontWeight: "700",
  },
});
