import { StyleSheet } from "react-native";

import { colors, radii, shadow, spacing, type } from "@/lib/theme";

/**
 * Shared chrome for the login + signup screens. Both render the same
 * hero block and a card with input fields, error message, and primary CTA.
 */
export const authStyles = StyleSheet.create({
  flex: { flex: 1 },

  hero: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  eyebrow: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    marginBottom: spacing.sm,
  },
  heroTitle: {
    fontSize: 40,
    fontWeight: "900",
    color: colors.textOnDark,
    letterSpacing: -0.8,
    lineHeight: 44,
  },
  heroSub: {
    fontSize: 16,
    color: "rgba(255,255,255,0.9)",
    marginTop: spacing.md,
  },

  card: {
    marginHorizontal: spacing.lg,
    marginTop: "auto",
    marginBottom: spacing.lg,
    padding: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    ...shadow.raised,
  },
  cardSub: { ...type.bodyMuted, marginTop: spacing.xs },
  fields: { gap: spacing.md, marginTop: spacing.lg },

  errorWrap: { marginTop: spacing.md },
  ctaWrap: { marginTop: spacing.lg },

  footerLink: { marginTop: spacing.lg, alignSelf: "center" },
  footer: { fontSize: 14, color: colors.textMuted },
  footerAccent: { color: colors.brand, fontWeight: "700" },
});
