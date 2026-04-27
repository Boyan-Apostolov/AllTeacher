import { StyleSheet } from "react-native";

import { colors, radii, shadow, spacing } from "@/lib/theme";

export const homeStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.xxl,
  },

  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#ffffffaa",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },

  // Hero
  hero: {
    borderRadius: radii.xl,
    padding: spacing.xl,
    gap: spacing.sm,
    overflow: "hidden",
  },
  heroEyebrow: {
    color: "#ffffffcc",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  heroTitle: {
    color: colors.textOnDark,
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    color: "#ffffffcc",
    fontSize: 15,
    marginBottom: spacing.md,
  },
  heroCta: {
    backgroundColor: "#ffffff",
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: radii.pill,
    alignSelf: "flex-start",
    ...shadow.raised,
  },
  heroCtaText: {
    color: colors.brandDeep,
    fontSize: 15,
    fontWeight: "700",
  },

  // Cards
  card: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  emptyCard: {
    alignItems: "flex-start",
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  emptyEmoji: { fontSize: 36 },
  emptyCta: {
    marginTop: spacing.sm,
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderRadius: radii.pill,
  },
  emptyCtaText: { color: "#fff", fontWeight: "700" },

  // Diagnostics
  diagRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  diagDetail: { fontSize: 11, color: "#ffffff55" },
  diagError: { fontSize: 11, color: colors.danger },

  // Sign out
  signOut: {
    marginTop: spacing.md,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "#ffffff22",
    backgroundColor: "#ffffff0f",
  },
  signOutText: { fontSize: 14, color: "#ffffffaa", fontWeight: "600" },
});
