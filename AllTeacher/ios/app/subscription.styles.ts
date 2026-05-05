import { StyleSheet } from "react-native";
import { colors, spacing } from "@/lib/theme";

export const subStyles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: 100, // extra space for bottom tab bar
  },

  // ── Hero ───────────────────────────────────────────────────
  heroBlock: { gap: spacing.xs },
  heroEyebrow: {
    fontSize: 12,
    fontWeight: "900",
    color: colors.ink3,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  heroTitle: {
    fontSize: 30,
    fontWeight: "900",
    color: colors.ink,
    letterSpacing: -0.4,
    lineHeight: 36,
  },
  heroSubtitle: {
    fontSize: 14,
    color: colors.ink3,
    lineHeight: 20,
  },

  // ── Current plan inline meta (shown inside the active tier card) ─
  currentMeta: {
    fontSize: 13,
    color: colors.ink3,
    lineHeight: 18,
    marginTop: 2,
  },

  // ── Section label ──────────────────────────────────────────
  sectionLabel: {
    fontSize: 11,
    fontWeight: "900",
    color: colors.ink3,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: -4,
  },

  // ── Tier cards ─────────────────────────────────────────────
  tierCard: {
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: colors.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 4, height: 4 },
    elevation: 4,
  },
  tierCardActive: {
    borderWidth: 3,
    shadowOffset: { width: 5, height: 5 },
  },
  tierNameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  tierHeader: {
    padding: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: colors.ink,
    gap: spacing.xs,
  },
  tierHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  tierEmoji: { fontSize: 28 },
  tierName: {
    fontSize: 22,
    fontWeight: "900",
    color: colors.ink,
    letterSpacing: -0.3,
  },
  tierPriceBlock: { alignItems: "flex-end" },
  tierPrice: {
    fontSize: 22,
    fontWeight: "900",
    color: colors.ink,
    letterSpacing: -0.3,
  },
  tierPricePer: {
    fontSize: 11,
    color: colors.ink3,
    fontWeight: "600",
  },
  currentChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.ink,
  },
  currentChipText: {
    fontSize: 11,
    fontWeight: "900",
    color: "#fff",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  tierTagline: {
    fontSize: 13,
    color: colors.ink3,
    lineHeight: 18,
  },

  // Features list
  tierBody: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  featureIcon: { fontSize: 14, lineHeight: 20, width: 20, textAlign: "center" },
  featureText: {
    flex: 1,
    fontSize: 14,
    color: colors.ink,
    fontWeight: "500",
    lineHeight: 20,
  },
  featureTextMuted: { color: colors.ink4 },

  // Upgrade button
  upgradeBtn: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.ink,
    alignItems: "center",
    shadowColor: colors.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 3, height: 3 },
    elevation: 3,
  },
  upgradeBtnText: {
    fontSize: 15,
    fontWeight: "900",
    color: "#fff",
  },
  upgradeBtnDisabled: {
    backgroundColor: colors.paperAlt,
    shadowOpacity: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  upgradeBtnDisabledText: { color: colors.ink3 },
  downgradeBtn: {
    backgroundColor: colors.paperAlt,
    shadowOpacity: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  downgradeBtnText: { color: colors.ink },

  // ── Feature comparison table ───────────────────────────────
  comparisonCard: {
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: colors.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 3, height: 3 },
    elevation: 3,
  },
  comparisonHeaderRow: {
    flexDirection: "row",
    borderBottomWidth: 2,
    borderBottomColor: colors.ink,
    backgroundColor: colors.ink,
  },
  comparisonHeaderCell: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
  },
  comparisonHeaderText: {
    fontSize: 12,
    fontWeight: "900",
    color: colors.paper,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  comparisonRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(26,20,16,0.08)",
  },
  comparisonRowLast: { borderBottomWidth: 0 },
  comparisonFeatureCell: {
    flex: 2,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    justifyContent: "center",
  },
  comparisonFeatureText: {
    fontSize: 13,
    color: colors.ink,
    fontWeight: "600",
  },
  comparisonCheckCell: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    borderLeftWidth: 1,
    borderLeftColor: "rgba(26,20,16,0.08)",
  },
  comparisonCheckText: { fontSize: 16 },

  // ── Bottom links ───────────────────────────────────────────
  linkRow: {
    flexDirection: "row",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: spacing.lg,
  },
  linkBtn: {
    paddingVertical: 4,
  },
  linkText: {
    fontSize: 13,
    color: colors.ink3,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
  legalText: {
    fontSize: 11,
    color: colors.ink4,
    textAlign: "center",
    lineHeight: 16,
  },
});
