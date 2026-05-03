import { StyleSheet } from "react-native";
import { colors, radii } from "@/lib/theme";

export const primaryCtaStyles = StyleSheet.create({
  cta: {
    width: "100%",
    height: 56,
    borderRadius: radii.pill,
    borderWidth: 2.5,
    borderColor: colors.ink,
    // Hard offset shadow — neo-brutalist
    shadowColor: colors.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 4, height: 4 },
    elevation: 4,
    overflow: "visible",
  },
  ctaInner: {
    flex: 1,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    overflow: "hidden",
  },
  ctaPressed: {
    transform: [{ translateX: 2 }, { translateY: 2 }],
    shadowOffset: { width: 2, height: 2 },
  },
  ctaDisabled: { opacity: 0.45 },
  ctaText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
});
