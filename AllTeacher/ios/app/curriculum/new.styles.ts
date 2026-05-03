import { StyleSheet } from "react-native";
import { colors, radii, spacing } from "@/lib/theme";

export const newCurriculumStyles = StyleSheet.create({
  content: {
    paddingHorizontal: 24,
    paddingBottom: 60,
    gap: 20,
  },

  eyebrow: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.ink3,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: spacing.md,
  },
  title: {
    fontSize: 36,
    fontWeight: "900",
    color: colors.ink,
    letterSpacing: -1.2,
    lineHeight: 36,
  },
  titleAccent: { color: colors.brand },
  subtitle: {
    fontSize: 14,
    color: colors.ink3,
    lineHeight: 21,
    fontWeight: "500",
  },

  card: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 18,
    borderWidth: 2.5,
    borderColor: colors.ink,
    shadowColor: colors.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 4, height: 4 },
    elevation: 4,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.ink3,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  fieldHint: { fontSize: 13, color: colors.ink3, fontWeight: "500" },

  textarea: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.ink,
    minHeight: 120,
    textAlignVertical: "top",
    lineHeight: 26,
    letterSpacing: -0.3,
    padding: 0,
  },
  charCount: {
    fontSize: 11,
    color: colors.ink4,
    fontFamily: "monospace",
    textAlign: "right",
    marginTop: 4,
  },

  suggestionsLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.ink3,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  suggestionsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  // Suggestion chips are rendered as <Sticker> components — no style needed here

  cancel: { paddingVertical: spacing.md, alignItems: "center" },
  cancelText: { color: colors.ink3, fontSize: 14, fontWeight: "600" },
});
