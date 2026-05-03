import { StyleSheet } from "react-native";
import { colors, spacing } from "@/lib/theme";

export const flashcardStyles = StyleSheet.create({
  // The outer Pressable is the card "frame" — border + shadow live here.
  wrap: {
    height: 300,
    borderRadius: 20,
    borderWidth: 2.5,
    borderColor: colors.ink,
    overflow: "hidden",          // clips both faces to the rounded frame
    shadowColor: colors.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 5, height: 5 },
    elevation: 5,
  },
  // Both faces fill the entire wrap via absoluteFillObject.
  face: {
    ...StyleSheet.absoluteFillObject,
    backfaceVisibility: "hidden",
  },
  faceInner: {
    flex: 1,
    padding: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  frontBg: { backgroundColor: colors.flash },
  backBg:  { backgroundColor: colors.card  },

  corner: {
    position: "absolute",
    top: spacing.md,
    left: spacing.md,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  cornerLight: {
    backgroundColor: colors.paperAlt,
    borderWidth: 1.5,
    borderColor: colors.ink,
  },
  cornerText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  cornerTextLight: { color: colors.ink },
  emoji:      { fontSize: 36 },
  emojiLight: { fontSize: 36 },
  text: {
    fontSize: 24,
    fontWeight: "900",
    color: "#fff",
    textAlign: "center",
    letterSpacing: -0.3,
    lineHeight: 30,
    paddingHorizontal: spacing.sm,
  },
  textDark: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.ink,
    textAlign: "center",
    lineHeight: 28,
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
    fontSize: 11,
    fontWeight: "800",
    color: "rgba(255,255,255,0.80)",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  hintDark: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.ink3,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },

  // Rating row
  ratingPrompt: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.ink,
    textAlign: "center",
  },
  ratingRow: { flexDirection: "row", gap: spacing.sm },
  ratingBtn: {
    flex: 1,
    borderRadius: 14,
    overflow: "hidden",          // clips active bg to borderRadius
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.ink,
    shadowColor: colors.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 3, height: 3 },
    elevation: 3,
  },
  ratingBtnInner: {
    paddingVertical: 14,
    alignItems: "center",
    gap: 4,
  },
  ratingBtnActive: {
    paddingVertical: 14,
    alignItems: "center",
    gap: 4,
  },
  ratingBtnFaded:   { opacity: 0.45 },
  ratingBtnPressed: {
    shadowOffset: { width: 1, height: 1 },
    transform: [{ translateX: 2 }, { translateY: 2 }],
  },
  ratingEmoji: { fontSize: 22 },
  ratingText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.ink,
  },
  ratingTextActive: {
    fontSize: 13,
    fontWeight: "900",
    color: "#fff",
  },
});
