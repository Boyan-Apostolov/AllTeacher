import { StyleSheet } from "react-native";

import { colors, radii } from "@/lib/theme";

export const progressBarStyles = StyleSheet.create({
  track: {
    height: 6,
    backgroundColor: colors.border,
    borderRadius: radii.pill,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: radii.pill,
  },
});
