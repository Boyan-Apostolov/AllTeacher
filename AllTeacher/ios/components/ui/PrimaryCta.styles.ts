import { StyleSheet } from "react-native";

import { colors, radii, shadow } from "@/lib/theme";

export const primaryCtaStyles = StyleSheet.create({
  cta: {
    borderRadius: radii.pill,
    overflow: "hidden",
    ...shadow.raised,
  },
  ctaGradient: {
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaPressed: { transform: [{ scale: 0.98 }] },
  ctaDisabled: { opacity: 0.5 },
  ctaText: {
    color: colors.textOnDark,
    fontSize: 17,
    fontWeight: "800",
  },
});
