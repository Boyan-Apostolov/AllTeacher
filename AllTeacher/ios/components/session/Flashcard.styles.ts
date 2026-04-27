import { StyleSheet } from "react-native";

import { colors, radii, shadow, spacing } from "@/lib/theme";

export const flashcardStyles = StyleSheet.create({
  wrap: {
    height: 320,
    borderRadius: radii.xl,
  },
  face: {
    flex: 1,
    borderRadius: radii.xl,
    overflow: "hidden",
    backfaceVisibility: "hidden",
    ...shadow.raised,
  },
  faceAbs: {
    ...StyleSheet.absoluteFillObject,
  },
  gradient: {
    flex: 1,
    padding: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  back: {
    backgroundColor: colors.surface,
  },
  corner: {
    position: "absolute",
    top: spacing.md,
    left: spacing.md,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  cornerLight: {
    backgroundColor: colors.brandSoft,
  },
  cornerText: {
    color: colors.textOnDark,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  cornerTextLight: { color: colors.brandDeep },
  emoji: { fontSize: 36 },
  emojiLight: { fontSize: 36 },
  text: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.textOnDark,
    textAlign: "center",
    letterSpacing: -0.3,
    lineHeight: 32,
    paddingHorizontal: spacing.sm,
  },
  textDark: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
    lineHeight: 30,
    paddingHorizontal: spacing.sm,
  },
  hintRow: {
    position: "absolute",
    bottom: spacing.lg,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  hint: {
    fontSize: 12,
    fontWeight: "700",
    color: "rgba(255,255,255,0.85)",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  hintDark: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textMuted,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },

  ratingPrompt: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textOnDark,
    textAlign: "center",
    letterSpacing: 0.4,
  },
  ratingRow: { flexDirection: "row", gap: spacing.sm },
  ratingBtn: {
    flex: 1,
    borderRadius: radii.lg,
    overflow: "hidden",
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  ratingBtnInner: {
    paddingVertical: 14,
    alignItems: "center",
    gap: 4,
  },
  ratingBtnGradient: {
    paddingVertical: 14,
    alignItems: "center",
    gap: 4,
  },
  ratingBtnFaded: { opacity: 0.5 },
  ratingBtnPressed: { transform: [{ scale: 0.99 }] },
  ratingEmoji: { fontSize: 22 },
  ratingText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
  },
  ratingTextActive: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.textOnDark,
  },
});
