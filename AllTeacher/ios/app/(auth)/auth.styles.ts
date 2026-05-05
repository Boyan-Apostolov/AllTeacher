import { StyleSheet } from "react-native";
import { colors } from "@/lib/theme";

/**
 * Shared chrome for login + signup screens — neo-brutalist warm style.
 */
export const authStyles = StyleSheet.create({
  flex: { flex: 1 },

  scroll: { flexGrow: 1 },

  container: {
    flex: 1,
    paddingHorizontal: 28,
    paddingBottom: 40,
  },

  mascotRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 12,
    marginTop: 8,
  },

  heroTitle: {
    fontSize: 44,
    fontWeight: "900",
    color: colors.ink,
    letterSpacing: -1.5,
    lineHeight: 42,
    marginTop: 20,
  },

  heroTitleAccent: { color: colors.brand },

  heroSub: {
    fontSize: 15,
    color: colors.ink3,
    marginTop: 16,
    fontWeight: "500",
  },

  fields: { gap: 12, marginTop: 32 },

  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    backgroundColor: colors.brandSoft,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.ink,
    marginTop: 4,
  },

  checkBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: colors.brand,
    borderWidth: 2,
    borderColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },

  checkText: {
    fontSize: 13,
    color: colors.ink,
    fontWeight: "600",
    flex: 1,
  },

  stepsRow: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },

  errorWrap: { marginTop: 16 },
  ctaWrap: { marginTop: 20 },

  footerLink: { marginTop: 18, alignSelf: "center" },
  footer: { fontSize: 14, color: colors.ink3, fontWeight: "500" },
  footerAccent: { color: colors.brand, fontWeight: "800" },

  termsText: {
    fontSize: 12,
    color: colors.ink3,
    fontWeight: "500",
    textAlign: "center",
    marginTop: 14,
  },
  termsLink: { color: colors.ink, fontWeight: "700" },

  // Legacy compat for card, hero etc. (no longer used but kept to avoid TS errors)
  hero: {},
  eyebrow: {},
  card: {},
  cardSub: {},
});
